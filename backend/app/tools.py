"""app/tools.py — business logic for the agent's tool calls.

Pure functions over the datastore (no HTTP here) so they're unit-testable. app/main.py wraps these
as webhook endpoints. Supabase is the source of truth; Cliniko write-back is enqueued to pms_outbox
(drained by app/pms_writeback.py — built next).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import psycopg2

from app import db, config
from app.availability import find_availability, normalize_name

CLINIC_TZ = config.CLINIC_TZ


# ── helpers ──────────────────────────────────────────────────────────────────
def _parse_iso(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=CLINIC_TZ)
    return dt


def _patients_for_phone(phone: str) -> List[Dict[str, Any]]:
    return db.query(
        """select p.id, p.full_name, p.cliniko_patient_id
             from patients p join patient_phones pp on pp.patient_id = p.id
            where pp.phone_e164 = %s order by p.created_at""",
        (phone,),
    )


def _get_or_create_patient(full_name: str, phone: str) -> str:
    """Match an existing patient by phone + (case-insensitive) name, else create one."""
    for p in _patients_for_phone(phone):
        if p["full_name"].strip().lower() == full_name.strip().lower():
            return p["id"]
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("insert into patients(full_name) values(%s) returning id", (full_name.strip(),))
        pid = cur.fetchone()[0]
        cur.execute(
            "insert into patient_phones(phone_e164, patient_id) values(%s,%s) on conflict do nothing",
            (phone, pid),
        )
    return pid


def _fee_if_in_window(appt_start: datetime, fee_amount: int, now: Optional[datetime]) -> Optional[Dict[str, Any]]:
    """Fee applies ONLY when the change happens within FEE_WINDOW_HOURS of the appointment start."""
    now = now or datetime.now(CLINIC_TZ)
    if appt_start - now <= timedelta(hours=config.FEE_WINDOW_HOURS):
        return {"amount": fee_amount, "currency": config.CURRENCY}
    return None


# ── 1. identify_caller ───────────────────────────────────────────────────────
def identify_caller(phone: str, spoken_name: Optional[str] = None) -> Dict[str, Any]:
    patients = _patients_for_phone(phone)
    # most recent session for this phone that could be resumed
    sess = db.query_one(
        """select id, state, context_json, direction, updated_at
             from call_sessions
            where phone_e164 = %s and state in ('interrupted','callback_pending','active')
            order by updated_at desc limit 1""",
        (phone,),
    )
    resume = None
    dropped = callback = False
    if sess and sess["state"] in ("interrupted", "callback_pending"):
        # only offer resume if recent (within 2h)
        recent = (datetime.now(CLINIC_TZ) - sess["updated_at"]) <= timedelta(hours=2)
        if recent:
            resume = sess["context_json"]
            dropped = sess["state"] == "interrupted"
            callback = sess["state"] == "callback_pending"

    return {
        "known": bool(patients),
        "multiple_patients": len(patients) > 1,   # family line -> ask name to disambiguate
        "patients": [{"id": p["id"], "name": normalize_name(p["full_name"])} for p in patients],
        "resume_context": resume,
        "dropped_call": dropped,
        "callback": callback,
    }


# ── 1b. create_patient (explicit registration) ────────────────────────────────
def create_patient(*, full_name: str, phone: str) -> Dict[str, Any]:
    """Registers the patient in Supabase (source of truth) and syncs them to Cliniko
    immediately — not deferred to the first booking — so the two systems don't drift
    if the caller registers but doesn't finish booking in the same call."""
    if not full_name or not full_name.strip():
        return {"ok": False, "error": "name_required"}
    pid = _get_or_create_patient(full_name, phone)
    row = db.query_one("select id, full_name, cliniko_patient_id from patients where id=%s", (pid,))

    synced = bool(row.get("cliniko_patient_id"))
    if not synced:
        try:
            from app.cliniko import Cliniko
            from app.pms_writeback import _ensure_cliniko_patient
            _ensure_cliniko_patient(Cliniko(), pid)
            synced = True
        except Exception:
            synced = False  # non-fatal: booking write-back will retry-create this later

    return {"ok": True, "patient_id": pid, "full_name": normalize_name(row["full_name"]),
            "cliniko_synced": synced}


# ── 1c. get_doctors (roster — no times; live from Supabase, synced with Cliniko) ──
def get_doctors(*, branch: Optional[str] = None, specialty: Optional[str] = None) -> Dict[str, Any]:
    rows = db.query(
        """select p.id, p.full_name, p.specialty,
                  array_agg(distinct b.id) as branch_ids, array_agg(distinct b.name) as branch_names
             from practitioners p
             join practitioner_schedules s on s.practitioner_id = p.id
             join branches b on b.id = s.branch_id
            where p.active = true and b.active = true
            group by p.id, p.full_name, p.specialty
            order by p.full_name""")
    out = []
    for r in rows:
        if specialty and specialty.strip().lower() not in r["specialty"].lower():
            continue
        if branch:
            bv = branch.strip().lower()
            if not any(bv == bid.lower() or bv in bname.lower()
                       for bid, bname in zip(r["branch_ids"], r["branch_names"])):
                continue
        out.append({
            "practitioner_id": r["id"], "name": normalize_name(r["full_name"]),
            "specialty": r["specialty"], "branches": r["branch_names"],
        })
    return {"count": len(out), "doctors": out}


# ── 1d. get_branch_info ───────────────────────────────────────────────────────
def get_branch_info() -> Dict[str, Any]:
    rows = db.query("select id, name, address, open_time, close_time from branches where active = true order by name")
    return {"branches": [
        {"branch_id": r["id"], "name": r["name"], "address": r["address"],
         "hours": f"{r['open_time']}–{r['close_time']}"} for r in rows
    ]}


# ── 2. find_availability (thin wrapper over the engine) ──────────────────────
def availability(**kwargs) -> Dict[str, Any]:
    # small LLMs often stringify booleans/ints — coerce defensively
    v = kwargs.get("earliest_across_all")
    if isinstance(v, str):
        kwargs["earliest_across_all"] = v.strip().lower() in ("true", "1", "yes")
    if isinstance(kwargs.get("limit"), str):
        try:
            kwargs["limit"] = int(kwargs["limit"])
        except ValueError:
            kwargs.pop("limit", None)
    kwargs = {k: v for k, v in kwargs.items() if v not in ("", None)}
    slots = find_availability(**kwargs)
    return {"count": len(slots), "slots": slots}


# ── 2b. get_earliest_slot (dedicated — avoids the LLM mis-setting a flag) ─────
def get_earliest_slot(*, specialty: Optional[str] = None, branch: Optional[str] = None,
                      appointment_type: str = "consult") -> Dict[str, Any]:
    kwargs = {k: v for k, v in {"specialty": specialty, "branch": branch}.items() if v}
    slots = find_availability(appointment_type=appointment_type, earliest_across_all=True, limit=3, **kwargs)
    return {"count": len(slots), "slots": slots}


# ── 3. book_appointment ──────────────────────────────────────────────────────
def book_appointment(
    *, patient_name: str, phone: str, practitioner_id: str, branch_id: str,
    start_iso: str, appointment_type_id: str = "consult",
    idempotency_key: Optional[str] = None, now: Optional[datetime] = None,
) -> Dict[str, Any]:
    if not patient_name or not patient_name.strip():
        return {"ok": False, "error": "name_required",
                "message": "Full name is required before booking."}

    idem = idempotency_key or str(uuid.uuid4())
    # idempotency: if this key already booked, return that appointment
    existing = db.query_one("select id, start_ts, branch_id from appointments where idempotency_key=%s", (idem,))
    if existing:
        return {"ok": True, "appointment_id": existing["id"], "idempotent_replay": True}

    at = db.query_one("select duration_min from appointment_types where id=%s", (appointment_type_id,))
    if not at:
        return {"ok": False, "error": "bad_appointment_type"}
    start = _parse_iso(start_iso)
    end = start + timedelta(minutes=at["duration_min"])

    patient_id = _get_or_create_patient(patient_name, phone)

    try:
        with db.get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                """insert into appointments(patient_id,practitioner_id,branch_id,appointment_type_id,
                       start_ts,end_ts,idempotency_key)
                   values(%s,%s,%s,%s,%s,%s,%s) returning id""",
                (patient_id, practitioner_id, branch_id, appointment_type_id, start, end, idem),
            )
            appt_id = cur.fetchone()[0]
            _enqueue_outbox(cur, appt_id, idem, "create")
    except psycopg2.errors.ExclusionViolation:
        # slot got taken between the availability check and booking -> live re-check upstream
        return {"ok": False, "conflict": True,
                "message": "That slot was just taken. Let me find the next available time."}

    # echo back the branch/doctor actually booked (spoken branch must match booked branch)
    row = db.query_one(
        """select a.start_ts, a.end_ts, b.name as branch_name, p.full_name as doctor,
                  at.name as appt_type
             from appointments a join branches b on b.id=a.branch_id
             join practitioners p on p.id=a.practitioner_id
             join appointment_types at on at.id=a.appointment_type_id
            where a.id=%s""",
        (appt_id,),
    )
    return {
        "ok": True, "appointment_id": appt_id,
        "branch": row["branch_name"], "doctor": normalize_name(row["doctor"]),
        "appointment_type": row["appt_type"],
        "start_local": start.astimezone(CLINIC_TZ).strftime("%Y-%m-%d %H:%M"),
    }


# ── 3b. get_patient_appointments (needed before reschedule/cancel) ───────────
def get_patient_appointments(*, phone: Optional[str] = None, patient_id: Optional[str] = None) -> Dict[str, Any]:
    if not phone and not patient_id:
        return {"ok": False, "error": "phone_or_patient_id_required"}
    pids = [patient_id] if patient_id else [p["id"] for p in _patients_for_phone(phone)]
    if not pids:
        return {"ok": True, "appointments": []}
    rows = db.query(
        """select a.id as appointment_id, a.start_ts, a.end_ts, a.status,
                  p.full_name as patient_name, pr.full_name as doctor, b.name as branch,
                  at.name as appointment_type
             from appointments a
             join patients p on p.id = a.patient_id
             join practitioners pr on pr.id = a.practitioner_id
             join branches b on b.id = a.branch_id
             join appointment_types at on at.id = a.appointment_type_id
            where a.patient_id = any(%s::uuid[]) and a.status = 'booked'
            order by a.start_ts""", (pids,))
    for r in rows:
        r["doctor"] = normalize_name(r["doctor"])
        r["patient_name"] = normalize_name(r["patient_name"])
    return {"ok": True, "appointments": rows}


# ── 4. reschedule_appointment ────────────────────────────────────────────────
def reschedule_appointment(
    *, appointment_id: str, new_start_iso: str,
    idempotency_key: Optional[str] = None, now: Optional[datetime] = None,
) -> Dict[str, Any]:
    appt = db.query_one(
        """select a.*, at.duration_min from appointments a
             join appointment_types at on at.id=a.appointment_type_id
            where a.id=%s""", (appointment_id,))
    if not appt or appt["status"] != "booked":
        return {"ok": False, "error": "not_found_or_not_booked"}

    fee = _fee_if_in_window(appt["start_ts"], config.RESCHEDULE_FEE, now)
    new_start = _parse_iso(new_start_iso)
    new_end = new_start + timedelta(minutes=appt["duration_min"])
    idem = idempotency_key or str(uuid.uuid4())

    try:
        with db.get_conn() as conn:
            cur = conn.cursor()
            cur.execute(
                "update appointments set start_ts=%s, end_ts=%s, pms_sync_state='pending' where id=%s",
                (new_start, new_end, appointment_id),
            )
            _enqueue_outbox(cur, appointment_id, idem, "reschedule")
    except psycopg2.errors.ExclusionViolation:
        return {"ok": False, "conflict": True,
                "message": "That new time isn't free. Let me check other options."}

    out = {"ok": True, "appointment_id": appointment_id,
           "new_start_local": new_start.astimezone(CLINIC_TZ).strftime("%Y-%m-%d %H:%M")}
    if fee:
        out["fee"] = fee   # only present when inside the policy window
    return out


# ── 5. cancel_appointment ────────────────────────────────────────────────────
def cancel_appointment(*, appointment_id: str, now: Optional[datetime] = None) -> Dict[str, Any]:
    appt = db.query_one("select id, start_ts, status from appointments where id=%s", (appointment_id,))
    if not appt or appt["status"] != "booked":
        return {"ok": False, "error": "not_found_or_not_booked"}
    fee = _fee_if_in_window(appt["start_ts"], config.CANCELLATION_FEE, now)
    idem = str(uuid.uuid4())
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute("update appointments set status='cancelled', pms_sync_state='pending' where id=%s",
                    (appointment_id,))
        _enqueue_outbox(cur, appointment_id, idem, "cancel")
    out = {"ok": True, "appointment_id": appointment_id}
    if fee:
        out["fee"] = fee
    return out


# ── 6. log_followup ──────────────────────────────────────────────────────────
def log_followup(*, reason: str, phone: Optional[str] = None, patient_id: Optional[str] = None,
                 notes: Optional[str] = None, transcript_ref: Optional[str] = None) -> Dict[str, Any]:
    with db.get_conn() as conn:
        cur = conn.cursor()
        cur.execute(
            """insert into followups(phone_e164, patient_id, reason, notes, transcript_ref)
               values(%s,%s,%s,%s,%s) returning id""",
            (phone, patient_id, reason, notes, transcript_ref),
        )
        fid = cur.fetchone()[0]
    return {"ok": True, "followup_id": fid,
            "message": "Noted — someone from the clinic will follow up."}


# ── 7. save_session_state ────────────────────────────────────────────────────
def save_session_state(*, phone: str, context: Any, state: str = "active",
                       bolna_execution_id: Optional[str] = None,
                       direction: str = "inbound") -> Dict[str, Any]:
    import json
    if isinstance(context, str):
        # Bolna's custom_task params are string-substituted, so context arrives as a JSON string
        try:
            context = json.loads(context) if context.strip() else {}
        except json.JSONDecodeError:
            context = {"raw": context}
    elif context is None:
        context = {}
    existing = db.query_one(
        """select id from call_sessions where phone_e164=%s and state in ('active','interrupted')
           order by updated_at desc limit 1""", (phone,))
    with db.get_conn() as conn:
        cur = conn.cursor()
        if existing:
            cur.execute(
                """update call_sessions set context_json=%s, state=%s, bolna_execution_id=coalesce(%s,bolna_execution_id),
                       last_turn_at=now(), updated_at=now() where id=%s returning id""",
                (json.dumps(context), state, bolna_execution_id, existing["id"]))
            sid = cur.fetchone()[0]
        else:
            cur.execute(
                """insert into call_sessions(phone_e164, context_json, state, bolna_execution_id, direction)
                   values(%s,%s,%s,%s,%s) returning id""",
                (phone, json.dumps(context), state, bolna_execution_id, direction))
            sid = cur.fetchone()[0]
    return {"ok": True, "session_id": sid}


# ── 8. finalize_call (end-of-call webhook logic) ─────────────────────────────
_COMPLETE = {"completed", "success", "succeeded", "ended", "done"}
_NO_ANSWER = {"no_answer", "not_answered", "busy", "rejected"}


def finalize_call(*, phone: Optional[str] = None, status: Optional[str] = None, direction: str = "inbound",
                  transcript: Any = None, bolna_execution_id: Optional[str] = None) -> Dict[str, Any]:
    """Map a Bolna terminal status to a resumable session state.

    - clean finish              -> 'completed'
    - outbound unanswered       -> 'callback_pending'  (patient calls back -> we carry context)
    - anything else (inbound)   -> 'interrupted'       (dropped -> resume on callback)
    """
    import json
    phone = (phone or "").strip() or None
    s = (status or "").strip().lower()
    if direction == "outbound" and s in _NO_ANSWER:
        new_state = "callback_pending"
    elif s in _COMPLETE:
        new_state = "completed"
    else:
        new_state = "interrupted"

    if phone:
        existing = db.query_one(
            """select id from call_sessions where phone_e164=%s
               order by updated_at desc limit 1""", (phone,))
    else:
        existing = None
    with db.get_conn() as conn:
        cur = conn.cursor()
        if existing:
            cur.execute(
                """update call_sessions set state=%s, ended_status=%s, ended_at=now(),
                       transcript_json=coalesce(%s, transcript_json),
                       bolna_execution_id=coalesce(%s, bolna_execution_id), updated_at=now()
                   where id=%s returning id""",
                (new_state, s, json.dumps(transcript) if transcript is not None else None,
                 bolna_execution_id, existing["id"]))
            sid = cur.fetchone()[0]
        else:
            if phone:
                cur.execute(
                    """insert into call_sessions(phone_e164, state, ended_status, ended_at,
                           transcript_json, bolna_execution_id, direction)
                       values(%s,%s,%s,now(),%s,%s,%s) returning id""",
                    (phone, new_state, s,
                     json.dumps(transcript) if transcript is not None else None,
                     bolna_execution_id, direction))
            else:
                cur.execute(
                    """insert into call_sessions(state, ended_status, ended_at,
                           transcript_json, bolna_execution_id, direction)
                       values(%s,%s,now(),%s,%s,%s) returning id""",
                    (new_state, s,
                     json.dumps(transcript) if transcript is not None else None,
                     bolna_execution_id, direction))
            sid = cur.fetchone()[0]
    return {"ok": True, "session_id": sid, "state": new_state}


# ── outbox helper (write-back queue; drained in #4) ──────────────────────────
def _enqueue_outbox(cur, appointment_id: str, idempotency_key: str, operation: str) -> None:
    import json
    cur.execute(
        """insert into pms_outbox(appointment_id, idempotency_key, operation, payload_json)
           values(%s,%s,%s,%s)
           on conflict (idempotency_key) do nothing""",
        (appointment_id, idempotency_key, operation, json.dumps({"appointment_id": appointment_id})),
    )
