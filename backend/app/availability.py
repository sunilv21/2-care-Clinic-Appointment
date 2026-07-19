"""app/availability.py — live availability engine.

Slots are DERIVED at query time from: practitioner working hours (practitioner_schedules) minus
booked appointments minus the branch buffer, computed in clinic-local time (Asia/Kolkata). There is
no stored free-slot table, so results are always live.

Handles the assignment's scheduling scenarios:
- underspecified time windows (date + time_from/time_to)
- earliest slot across ALL practitioners and BOTH branches (earliest_across_all)
- branch-specific / specialty triage (branch, specialty filters)
- same-day buffer between appointments (branch.buffer_minutes)
- never returns past slots (compares against 'now' in clinic tz)
- ALL-CAPS doctor names normalized for natural speech
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from datetime import datetime, date, timedelta
from zoneinfo import ZoneInfo
from typing import Any, Dict, List, Optional

from app import db

CLINIC_TZ = ZoneInfo("Asia/Kolkata")
DEFAULT_HORIZON_DAYS = 14
WEEKDAY_NAME = {1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
                5: "Friday", 6: "Saturday", 7: "Sunday"}


def normalize_name(s: str) -> str:
    """ALL-CAPS -> Title Case for natural TTS; leave mixed-case names alone."""
    if s and s.isupper():
        return s.title()
    return s


@dataclass
class Slot:
    start_iso: str
    end_iso: str
    local_date: str      # YYYY-MM-DD (clinic tz)
    local_time: str      # HH:MM (clinic tz)
    weekday: str
    practitioner_id: str
    practitioner_name: str
    specialty: str
    branch_id: str
    branch_name: str
    appointment_type_id: str
    duration_min: int

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _parse_hhmm(s: Optional[str]):
    if not s:
        return None
    h, m = s.split(":")
    return int(h), int(m)


def find_availability(
    *,
    appointment_type: str = "consult",
    branch: Optional[str] = None,          # branch id or name
    practitioner: Optional[str] = None,    # practitioner id or name
    specialty: Optional[str] = None,
    date: Optional[str] = None,            # 'YYYY-MM-DD' single day
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    time_from: Optional[str] = None,       # 'HH:MM' clinic-local window
    time_to: Optional[str] = None,
    earliest_across_all: bool = False,
    limit: int = 5,
    now: Optional[datetime] = None,        # injectable for tests
) -> List[Dict[str, Any]]:
    now = now or datetime.now(CLINIC_TZ)

    at = db.query_one("select id, duration_min from appointment_types where id=%s", (appointment_type,))
    if not at:
        at = db.query_one("select id, duration_min from appointment_types where id='consult'")
    duration = at["duration_min"]
    at_id = at["id"]

    # date range
    if date:
        d0 = d1 = _to_date(date)
    else:
        d0 = _to_date(date_from) if date_from else now.date()
        d1 = _to_date(date_to) if date_to else d0 + timedelta(days=DEFAULT_HORIZON_DAYS)
    if d1 < d0:
        d1 = d0

    # candidate practitioners: offer this appt type, match practitioner/specialty filter
    prac_rows = db.query(
        """select p.id, p.full_name, p.specialty
           from practitioners p
           join practitioner_appointment_types pat on pat.practitioner_id = p.id
          where pat.appointment_type_id = %s and p.active = true""",
        (at_id,),
    )
    if practitioner:
        pv = practitioner.strip().lower()
        prac_rows = [p for p in prac_rows
                     if pv == p["id"].lower() or pv in p["full_name"].lower()]
    if specialty:
        sv = specialty.strip().lower()
        prac_rows = [p for p in prac_rows if sv in p["specialty"].lower()]
    if not prac_rows:
        return []
    prac_ids = [p["id"] for p in prac_rows]
    prac_by_id = {p["id"]: p for p in prac_rows}

    # schedules for these practitioners (+ branch info), optional branch filter
    sched = db.query(
        """select s.practitioner_id, s.branch_id, s.weekday, s.start_time, s.end_time,
                  b.name as branch_name, b.buffer_minutes
             from practitioner_schedules s
             join branches b on b.id = s.branch_id
            where s.practitioner_id = any(%s) and b.active = true""",
        (prac_ids,),
    )
    if branch:
        bv = branch.strip().lower()
        sched = [s for s in sched if bv == s["branch_id"].lower() or bv in s["branch_name"].lower()]
    if not sched:
        return []

    # booked appointments for these practitioners over the window (with a day of pad for buffer)
    win_start = datetime.combine(d0, datetime.min.time(), CLINIC_TZ) - timedelta(days=1)
    win_end = datetime.combine(d1, datetime.max.time(), CLINIC_TZ) + timedelta(days=1)
    booked = db.query(
        """select practitioner_id, start_ts, end_ts
             from appointments
            where status='booked' and practitioner_id = any(%s)
              and start_ts < %s and end_ts > %s""",
        (prac_ids, win_end, win_start),
    )
    booked_by_prac: Dict[str, List[Dict[str, Any]]] = {}
    for b in booked:
        booked_by_prac.setdefault(b["practitioner_id"], []).append(b)

    tf = _parse_hhmm(time_from)
    tt = _parse_hhmm(time_to)

    slots: List[Slot] = []
    day = d0
    while day <= d1:
        iso_dow = day.isoweekday()
        for s in sched:
            if s["weekday"] != iso_dow:
                continue
            buf = timedelta(minutes=s["buffer_minutes"] or 0)
            block_start = datetime.combine(day, s["start_time"], CLINIC_TZ)
            block_end = datetime.combine(day, s["end_time"], CLINIC_TZ)
            cur = block_start
            step = timedelta(minutes=duration)
            while cur + step <= block_end:
                c_start, c_end = cur, cur + step
                cur = c_end  # advance for next iteration
                if c_start <= now:                       # no past / current slots
                    continue
                if tf and (c_start.hour, c_start.minute) < tf:
                    continue
                if tt and (c_start.hour, c_start.minute) >= tt:
                    continue
                # buffer-aware conflict against this practitioner's booked appts
                clash = False
                for b in booked_by_prac.get(s["practitioner_id"], []):
                    bs, be = b["start_ts"], b["end_ts"]
                    if c_start < be + buf and bs < c_end + buf:
                        clash = True
                        break
                if clash:
                    continue
                p = prac_by_id[s["practitioner_id"]]
                slots.append(Slot(
                    start_iso=c_start.isoformat(),
                    end_iso=c_end.isoformat(),
                    local_date=c_start.strftime("%Y-%m-%d"),
                    local_time=c_start.strftime("%H:%M"),
                    weekday=WEEKDAY_NAME[iso_dow],
                    practitioner_id=p["id"],
                    practitioner_name=normalize_name(p["full_name"]),
                    specialty=p["specialty"],
                    branch_id=s["branch_id"],
                    branch_name=s["branch_name"],
                    appointment_type_id=at_id,
                    duration_min=duration,
                ))
        day += timedelta(days=1)

    slots.sort(key=lambda x: x.start_iso)
    if earliest_across_all:
        limit = min(limit, 3)
    return [s.to_dict() for s in slots[:max(1, limit)]]


def _to_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()
