"""app/pms_writeback.py — drain pms_outbox to Cliniko (the PMS write-back).

Supabase is authoritative; this syncs confirmed bookings to Cliniko asynchronously.
- Idempotency: outbox rows are unique per idempotency_key; a create that already has a
  cliniko_appointment_id is skipped. Cliniko patient is created once and cached on the patient row.
- Retry: failures increment attempts and stay 'pending' until MAX_ATTEMPTS, then 'failed' +
  the appointment is flagged (pms_sync_state='failed') and a followup is logged for reconciliation.
- Defined failure: set PMS_FAIL_MODE=1 to force every write to fail (exercises the failure path in
  the eval harness without breaking real Cliniko).

Run once:      python -m app.pms_writeback
Loop worker:   python -m app.pms_writeback --loop 10
"""

from __future__ import annotations

import argparse
import os
import time
from datetime import timezone
from typing import Any, Dict

from app import db
from app.cliniko import Cliniko

MAX_ATTEMPTS = 5


def _utc(dt) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _ensure_cliniko_patient(cli: Cliniko, patient_id: str) -> str:
    p = db.query_one("select id, full_name, cliniko_patient_id from patients where id=%s", (patient_id,))
    if p and p.get("cliniko_patient_id"):
        return p["cliniko_patient_id"]
    parts = (p["full_name"] or "Patient").split(" ", 1)
    first, last = parts[0], (parts[1] if len(parts) > 1 else "-")
    phone = db.query_one("select phone_e164 from patient_phones where patient_id=%s limit 1", (patient_id,))
    cid = cli.create_patient(first, last, phone["phone_e164"] if phone else None)
    db.execute("update patients set cliniko_patient_id=%s where id=%s", (cid, patient_id))
    return cid


def _appt_bundle(appointment_id: str) -> Dict[str, Any]:
    return db.query_one(
        """select a.id, a.patient_id, a.start_ts, a.end_ts, a.status, a.cliniko_appointment_id,
                  p.cliniko_practitioner_id, b.cliniko_business_id, at.cliniko_appointment_type_id,
                  p.full_name as doctor, b.name as branch
             from appointments a
             join practitioners p on p.id=a.practitioner_id
             join branches b on b.id=a.branch_id
             join appointment_types at on at.id=a.appointment_type_id
            where a.id=%s""",
        (appointment_id,),
    )


def _process(cli: Cliniko, row: Dict[str, Any]) -> None:
    if os.getenv("PMS_FAIL_MODE"):
        raise RuntimeError("PMS_FAIL_MODE forced failure")

    op = row["operation"]
    appt = _appt_bundle(row["appointment_id"])
    if not appt:
        raise RuntimeError("appointment missing")

    if op == "create":
        if appt["cliniko_appointment_id"]:
            return  # already synced (idempotent)
        cpid = _ensure_cliniko_patient(cli, appt["patient_id"])
        note = f"Booked via voice agent — {appt['doctor']} @ {appt['branch']}"
        cid = cli.create_appointment(
            patient_id=cpid, practitioner_id=appt["cliniko_practitioner_id"],
            business_id=appt["cliniko_business_id"],
            appointment_type_id=appt["cliniko_appointment_type_id"],
            starts_at_utc=_utc(appt["start_ts"]), ends_at_utc=_utc(appt["end_ts"]), notes=note,
        )
        db.execute("update appointments set cliniko_appointment_id=%s, pms_sync_state='synced' where id=%s",
                   (cid, appt["id"]))

    elif op == "reschedule":
        if not appt["cliniko_appointment_id"]:
            # never synced a create; do it now
            return _process(cli, {**row, "operation": "create"})
        cli.update_appointment(appt["cliniko_appointment_id"],
                               starts_at_utc=_utc(appt["start_ts"]), ends_at_utc=_utc(appt["end_ts"]))
        db.execute("update appointments set pms_sync_state='synced' where id=%s", (appt["id"],))

    elif op == "cancel":
        if appt["cliniko_appointment_id"]:
            cli.delete_appointment(appt["cliniko_appointment_id"])
        db.execute("update appointments set pms_sync_state='synced' where id=%s", (appt["id"],))


def drain_once() -> Dict[str, int]:
    rows = db.query(
        "select * from pms_outbox where status='pending' and attempts < %s order by created_at",
        (MAX_ATTEMPTS,),
    )
    if not rows:
        return {"processed": 0, "sent": 0, "failed": 0}
    cli = Cliniko()
    sent = failed = 0
    for row in rows:
        try:
            _process(cli, row)
            db.execute("update pms_outbox set status='sent', updated_at=now() where id=%s", (row["id"],))
            sent += 1
        except Exception as e:
            attempts = row["attempts"] + 1
            final = attempts >= MAX_ATTEMPTS
            db.execute(
                "update pms_outbox set attempts=%s, last_error=%s, status=%s, updated_at=now() where id=%s",
                (attempts, str(e)[:500], "failed" if final else "pending", row["id"]),
            )
            if final:
                db.execute("update appointments set pms_sync_state='failed' where id=%s", (row["appointment_id"],))
                db.execute(
                    "insert into followups(reason, notes) values('pms_sync_failed', %s)",
                    (f"Cliniko write-back failed for appointment {row['appointment_id']}: {str(e)[:200]}",),
                )
            failed += 1
    return {"processed": len(rows), "sent": sent, "failed": failed}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", type=int, default=0, help="poll interval seconds (0 = run once)")
    args = ap.parse_args()
    if args.loop:
        print(f"write-back worker: polling every {args.loop}s")
        while True:
            try:
                res = drain_once()
                if res["processed"]:
                    print("drain:", res)
            except Exception as e:
                # a transient DB/network blip shouldn't kill the whole worker (or, via run.py's
                # supervisor, the rest of the app) — log and keep polling.
                print(f"[pms_writeback] cycle failed, will retry next poll: {e}")
            time.sleep(args.loop)
    else:
        print("drain:", drain_once())


if __name__ == "__main__":
    main()
