"""app/outbound.py — outbound call orchestration with retry + continuation.

Lifecycle:
  enqueue -> (worker) process_due places the Bolna call -> Bolna posts a terminal status ->
  handle_status decides: completed / retry-later / continue-dropped / give-up.

Retry policy (configurable):
  - not-connected (no_answer/busy/failed): retry with backoff up to max_attempts, then give up ->
    mark the session callback_pending (so if the patient calls back we carry context) + log a follow-up.
  - dropped mid-conversation: retry to CONTINUE, carrying the saved session context so the agent
    resumes instead of restarting. On give-up, same callback_pending fallback.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app import db, config
from app.bolna_calls import BolnaCaller

CLINIC_TZ = config.CLINIC_TZ
BACKOFF_MINUTES = [15, 60, 180]   # by attempt number

_NOT_CONNECTED = {"no_answer", "not_answered", "busy", "rejected"}
_FAILED = {"failed", "error", "timeout", "cancelled", "canceled"}
_DROPPED = {"dropped", "call_disconnected", "disconnected", "interrupted", "hangup"}
_COMPLETE = {"completed", "success", "succeeded", "ended", "done"}


def _backoff(attempts: int) -> datetime:
    idx = min(max(attempts - 1, 0), len(BACKOFF_MINUTES) - 1)
    return datetime.now(CLINIC_TZ) + timedelta(minutes=BACKOFF_MINUTES[idx])


# ── enqueue ──────────────────────────────────────────────────────────────────
def enqueue_call(*, phone: str, purpose: str = "callback", patient_id: Optional[str] = None,
                 session_id: Optional[str] = None, max_attempts: int = 3,
                 delay_minutes: int = 0) -> Dict[str, Any]:
    next_at = datetime.now(CLINIC_TZ) + timedelta(minutes=delay_minutes)
    row = db.query_one(
        """insert into outbound_calls(phone_e164, patient_id, session_id, purpose, max_attempts, next_attempt_at)
           values(%s,%s,%s,%s,%s,%s) returning id""",
        (phone, patient_id, session_id, purpose, max_attempts, next_at),
    )
    return {"ok": True, "outbound_id": row["id"]}


# ── worker: place due calls ──────────────────────────────────────────────────
def process_due(now: Optional[datetime] = None, caller: Optional[BolnaCaller] = None) -> Dict[str, Any]:
    now = now or datetime.now(CLINIC_TZ)
    caller = caller or BolnaCaller()
    due = db.query(
        """select * from outbound_calls
            where status='pending' and next_attempt_at <= %s and attempts < max_attempts
            order by next_attempt_at limit 20""",
        (now,),
    )
    placed = 0
    for c in due:
        # carry resume context if this is a continuation
        user_data: Dict[str, Any] = {"phone_number": c["phone_e164"], "purpose": c["purpose"],
                                     "outbound_id": c["id"]}
        if c["session_id"]:
            sess = db.query_one("select context_json from call_sessions where id=%s", (c["session_id"],))
            if sess and sess.get("context_json"):
                user_data["resume_context"] = sess["context_json"]

        res = caller.place_call(c["phone_e164"], user_data)
        attempts = c["attempts"] + 1
        if res.get("ok"):
            db.execute(
                "update outbound_calls set status='calling', attempts=%s, bolna_execution_id=%s, updated_at=now() where id=%s",
                (attempts, res["execution_id"], c["id"]))
            placed += 1
        else:
            # couldn't even place the call -> treat as a failed attempt
            _schedule_retry_or_giveup(c, attempts, last_status=f"place_failed:{res.get('error')}")
    return {"due": len(due), "placed": placed}


# ── handle a terminal status from Bolna ──────────────────────────────────────
def handle_status(*, execution_id: str, status: str) -> Dict[str, Any]:
    c = db.query_one("select * from outbound_calls where bolna_execution_id=%s", (execution_id,))
    if not c:
        return {"ok": False, "error": "outbound_call_not_found"}
    s = (status or "").strip().lower()

    if s in _COMPLETE:
        db.execute("update outbound_calls set status='completed', last_status=%s, updated_at=now() where id=%s",
                   (s, c["id"]))
        return {"ok": True, "action": "completed"}

    if s in _DROPPED:
        # connected but dropped -> retry to CONTINUE; keep the session context (resume, not restart)
        if c["session_id"]:
            db.execute("update call_sessions set state='interrupted', updated_at=now() where id=%s", (c["session_id"],))
        action = _schedule_retry_or_giveup(c, c["attempts"], last_status=s, purpose="continue")
        return {"ok": True, "action": action}

    if s in _NOT_CONNECTED or s in _FAILED:
        action = _schedule_retry_or_giveup(c, c["attempts"], last_status=s)
        return {"ok": True, "action": action}

    # unknown terminal status -> record, don't loop
    db.execute("update outbound_calls set last_status=%s, updated_at=now() where id=%s", (s, c["id"]))
    return {"ok": True, "action": "recorded"}


def _schedule_retry_or_giveup(c: Dict[str, Any], attempts: int, *, last_status: str,
                              purpose: Optional[str] = None) -> str:
    if attempts < c["max_attempts"]:
        db.execute(
            """update outbound_calls set status='pending', attempts=%s, last_status=%s,
                   next_attempt_at=%s, purpose=coalesce(%s, purpose), updated_at=now() where id=%s""",
            (attempts, last_status, _backoff(attempts), purpose, c["id"]))
        return "retry_scheduled"
    # give up -> mark terminal + set callback_pending so an inbound callback carries context
    final = "dropped" if last_status in _DROPPED else ("no_answer" if last_status in _NOT_CONNECTED else "failed")
    db.execute("update outbound_calls set status='max_retries', last_status=%s, updated_at=now() where id=%s",
               (last_status, c["id"]))
    if c["session_id"]:
        db.execute("update call_sessions set state='callback_pending', updated_at=now() where id=%s", (c["session_id"],))
    else:
        # ensure there is a callback_pending session so a return call is recognised
        db.execute(
            """insert into call_sessions(phone_e164, patient_id, direction, state)
               values(%s,%s,'outbound','callback_pending')""",
            (c["phone_e164"], c["patient_id"]))
    db.execute(
        "insert into followups(phone_e164, patient_id, reason, notes) values(%s,%s,'outbound_unreachable',%s)",
        (c["phone_e164"], c["patient_id"], f"Outbound call gave up after {attempts} attempts (last: {last_status})"))
    return "gave_up_callback_pending"


def list_outbound(limit: int = 100) -> List[Dict[str, Any]]:
    return db.query(
        """select id, phone_e164, purpose, status, attempts, max_attempts, next_attempt_at,
                  last_status, updated_at
             from outbound_calls order by updated_at desc limit %s""", (limit,))
