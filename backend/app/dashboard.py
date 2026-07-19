"""app/dashboard.py — read-only queries for the frontend dashboard.

Everything here is SELECT-only (plus live Cliniko GETs). It never mutates state, so the dashboard
can't break the booking pipeline.
"""

from __future__ import annotations

from typing import Any, Dict, List

from app import db
from app.availability import normalize_name
from app.cliniko import Cliniko
from app.bolna_calls import BolnaCaller


def summary() -> Dict[str, Any]:
    def n(sql, params=()):
        return db.query_one(sql, params)["c"]
    return {
        "branches": n("select count(*) c from branches"),
        "doctors": n("select count(*) c from practitioners"),
        "appointment_types": n("select count(*) c from appointment_types"),
        "appointments_booked": n("select count(*) c from appointments where status='booked'"),
        "patients": n("select count(*) c from patients"),
        "outbound_pending": n("select count(*) c from outbound_calls where status in ('pending','calling')"),
        "followups_open": n("select count(*) c from followups where resolved=false"),
        "sessions_open": n("select count(*) c from call_sessions where state in ('active','interrupted','callback_pending')"),
    }


def clinic() -> Dict[str, Any]:
    branches = db.query("select id, name, address, buffer_minutes, open_time, close_time, cliniko_business_id from branches order by name")
    doctors = db.query("select id, full_name, specialty, cliniko_practitioner_id from practitioners order by full_name")
    for d in doctors:
        d["display_name"] = normalize_name(d["full_name"])
    appt_types = db.query("select id, name, duration_min from appointment_types order by duration_min")
    return {"branches": branches, "doctors": doctors, "appointment_types": appt_types}


def appointments(limit: int = 100) -> List[Dict[str, Any]]:
    rows = db.query(
        """select a.id, a.start_ts, a.end_ts, a.status, a.pms_sync_state, a.cliniko_appointment_id, a.origin,
                  pt.full_name as patient, p.full_name as doctor, b.name as branch, at.name as appt_type
             from appointments a
             join patients pt on pt.id=a.patient_id
             join practitioners p on p.id=a.practitioner_id
             join branches b on b.id=a.branch_id
             join appointment_types at on at.id=a.appointment_type_id
            order by a.start_ts desc limit %s""", (limit,))
    for r in rows:
        r["doctor"] = normalize_name(r["doctor"])
    return rows


def calendar(date_from: str, date_to: str) -> Dict[str, Any]:
    """Cliniko-style calendar feed: booked appointments in a date range plus the list of active
    practitioners (columns), so the UI can render a day/week grid exactly like Cliniko's."""
    from zoneinfo import ZoneInfo
    from datetime import datetime, timedelta
    tz = ZoneInfo("Asia/Kolkata")
    start = datetime.strptime(date_from, "%Y-%m-%d").replace(tzinfo=tz)
    end = datetime.strptime(date_to, "%Y-%m-%d").replace(tzinfo=tz) + timedelta(days=1)

    rows = db.query(
        """select a.id, a.start_ts, a.end_ts, a.status, a.origin,
                  a.practitioner_id, pt.full_name as patient, p.full_name as doctor,
                  b.name as branch, at.name as appt_type
             from appointments a
             join patients pt on pt.id=a.patient_id
             join practitioners p on p.id=a.practitioner_id
             join branches b on b.id=a.branch_id
             join appointment_types at on at.id=a.appointment_type_id
            where a.status='booked' and a.start_ts >= %s and a.start_ts < %s
            order by a.start_ts""", (start, end))

    events = []
    for r in rows:
        s = r["start_ts"].astimezone(tz)
        e = r["end_ts"].astimezone(tz)
        events.append({
            "id": r["id"], "practitioner_id": r["practitioner_id"],
            "doctor": normalize_name(r["doctor"]), "patient": normalize_name(r["patient"]),
            "appt_type": r["appt_type"], "branch": r["branch"], "origin": r["origin"],
            "date": s.strftime("%Y-%m-%d"),
            "start": s.strftime("%H:%M"), "end": e.strftime("%H:%M"),
            "start_min": s.hour * 60 + s.minute, "end_min": e.hour * 60 + e.minute,
        })

    docs = db.query(
        "select id, full_name, specialty from practitioners where active=true order by full_name")
    doctors = [{"id": d["id"], "name": normalize_name(d["full_name"]), "specialty": d["specialty"]}
               for d in docs]
    return {"events": events, "doctors": doctors}


def patients(limit: int = 100) -> List[Dict[str, Any]]:
    return db.query(
        """select p.id, p.full_name, p.cliniko_patient_id,
                  coalesce(string_agg(distinct pp.phone_e164, ', '), '') as phones,
                  count(distinct a.id) as appt_count
             from patients p
             left join patient_phones pp on pp.patient_id=p.id
             left join appointments a on a.patient_id=p.id
            group by p.id order by p.created_at desc limit %s""", (limit,))


def outbound(limit: int = 100) -> List[Dict[str, Any]]:
    return db.query(
        """select id, phone_e164, purpose, status, attempts, max_attempts, next_attempt_at,
                  last_status, updated_at
             from outbound_calls order by updated_at desc limit %s""", (limit,))


def followups(limit: int = 100) -> List[Dict[str, Any]]:
    return db.query(
        "select id, phone_e164, reason, notes, resolved, created_at from followups order by created_at desc limit %s",
        (limit,))


def sessions(limit: int = 100) -> List[Dict[str, Any]]:
    return db.query(
        """select id, phone_e164, direction, state, ended_status, updated_at
             from call_sessions order by updated_at desc limit %s""", (limit,))


# ── inbound calls (the core patient-facing call flow) ────────────────────────
def inbound_calls(limit: int = 100) -> List[Dict[str, Any]]:
    rows = db.query(
        """select s.id, s.phone_e164, s.patient_id, p.full_name as patient_name,
                  s.state, s.ended_status, s.created_at, s.updated_at
             from call_sessions s
             left join patients p on p.id = s.patient_id
            where s.direction = 'inbound'
            order by s.updated_at desc limit %s""", (limit,))
    for r in rows:
        if r.get("patient_name"):
            r["patient_name"] = normalize_name(r["patient_name"])
        r["needs_attention"] = r["state"] in ("interrupted", "callback_pending")
    return rows


def session_detail(session_id: str) -> Dict[str, Any] | None:
    row = db.query_one(
        """select s.*, p.full_name as patient_name
             from call_sessions s left join patients p on p.id = s.patient_id
            where s.id = %s""", (session_id,))
    if not row:
        return None
    if row.get("patient_name"):
        row["patient_name"] = normalize_name(row["patient_name"])
    transcript = row.get("transcript_json")
    row["turns"] = len(transcript) if isinstance(transcript, list) else None

    linked: List[Dict[str, Any]] = []
    if row.get("patient_id"):
        linked = db.query(
            """select a.id, a.start_ts, a.status, p.full_name as doctor, b.name as branch
                 from appointments a
                 join practitioners p on p.id = a.practitioner_id
                 join branches b on b.id = a.branch_id
                where a.patient_id = %s
                order by a.created_at desc limit 5""", (row["patient_id"],))
        for a in linked:
            a["doctor"] = normalize_name(a["doctor"])
    row["linked_appointments"] = linked
    return row


# ── mutations the dashboard needs to actually "handle" things ────────────────
def resolve_followup(followup_id: str) -> Dict[str, Any]:
    n = db.execute("update followups set resolved=true where id=%s", (followup_id,))
    return {"ok": n > 0}


# ── live Cliniko passthrough (read-only) ─────────────────────────────────────
def cliniko_snapshot() -> Dict[str, Any]:
    try:
        c = Cliniko()
        biz = c.get("businesses", {"per_page": 50}).get("businesses", [])
        prac = c.get("practitioners", {"per_page": 50}).get("practitioners", [])
        pat = c.get("patients", {"per_page": 1})
        appts = c.get("individual_appointments", {"per_page": 1})
        return {
            "ok": True, "shard": c.shard,
            "businesses": [{"id": b["id"], "name": b.get("business_name")} for b in biz],
            "practitioners": [{"id": p["id"], "name": f"{p.get('first_name','')} {p.get('last_name','')}".strip(),
                               "active": p.get("active")} for p in prac],
            "patients_total": pat.get("total_entries"),
            "appointments_total": appts.get("total_entries"),
        }
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}


# ── live Bolna passthrough (read-only) ───────────────────────────────────────
def bolna_snapshot() -> Dict[str, Any]:
    caller = BolnaCaller()
    if not caller.configured():
        return {"ok": False, "error": "BOLNA_API_KEY / BOLNA_AGENT_ID not set in .env"}
    agent = caller.get_agent()
    if not agent.get("ok"):
        return {"ok": False, "error": agent.get("error", "could not reach Bolna")}
    phones = caller.list_phone_numbers()
    setup_complete = bool(agent.get("webhook_url")) and agent.get("has_tools")
    return {
        "ok": True,
        "agent_id": agent["agent_id"], "agent_name": agent["agent_name"],
        "agent_status": agent["agent_status"],
        "llm_model": agent.get("llm_model"), "stt_provider": agent.get("stt_provider"),
        "stt_language": agent.get("stt_language"), "tts_provider": agent.get("tts_provider"),
        "phone_numbers": phones.get("numbers", []) if phones.get("ok") else [],
        "webhook_configured": bool(agent.get("webhook_url")),
        "tools_configured": bool(agent.get("has_tools")),
        "setup_complete": setup_complete,
    }
