"""app/cliniko_sync.py — pull appointments booked directly in Cliniko (e.g. clinic staff using the
Cliniko UI) into Supabase, so they block the same slots our own booking flow sees.

Write-back (app/pms_writeback.py) only goes Supabase -> Cliniko, for appointments the agent creates.
This module closes the other direction: Cliniko -> Supabase, for appointments Cliniko creates.

For each known doctor (practitioners.cliniko_practitioner_id), fetch their Cliniko appointments and:
  - if it's new (no Supabase row has this cliniko_appointment_id) and not cancelled -> import it,
    creating/matching the patient by phone, tagged origin='cliniko_manual'.
  - if we already have it and Cliniko now shows it cancelled -> cancel our copy too.
  - if we already have it and the time changed in Cliniko -> update our copy (reschedule propagation).

Run once:      python -m app.cliniko_sync
Loop worker:   python -m app.cliniko_sync --loop 60
"""

from __future__ import annotations

import argparse
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import psycopg2

from app import db
from app.cliniko import Cliniko


def _parse_cliniko_ts(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def _get_or_create_patient_from_cliniko(cli: Cliniko, cliniko_patient_id: str) -> str:
    existing = db.query_one("select id from patients where cliniko_patient_id=%s", (cliniko_patient_id,))
    if existing:
        return existing["id"]

    p = cli.get(f"patients/{cliniko_patient_id}")
    first = (p.get("first_name") or "Patient").strip()
    last = (p.get("last_name") or "").strip()
    full_name = f"{first} {last}".strip()
    phones = [ph.get("number") for ph in (p.get("patient_phone_numbers") or []) if ph.get("number")]

    # match an existing local patient by phone + name if possible, else create a new one
    pid = None
    if phones:
        row = db.query_one(
            """select p.id from patients p join patient_phones pp on pp.patient_id=p.id
               where pp.phone_e164=%s and lower(p.full_name)=lower(%s) limit 1""",
            (phones[0], full_name),
        )
        if row:
            pid = row["id"]

    with db.get_conn() as conn:
        cur = conn.cursor()
        if not pid:
            cur.execute(
                "insert into patients(full_name, cliniko_patient_id) values(%s,%s) returning id",
                (full_name, cliniko_patient_id))
            pid = cur.fetchone()[0]
            for ph in phones:
                cur.execute(
                    "insert into patient_phones(phone_e164, patient_id) values(%s,%s) on conflict do nothing",
                    (ph, pid))
        else:
            cur.execute("update patients set cliniko_patient_id=%s where id=%s", (cliniko_patient_id, pid))
    return pid


def _slugify(name: str, existing: set) -> str:
    base = "".join(c if c.isalnum() else "_" for c in name.strip().lower()).strip("_") or "item"
    slug = base
    i = 2
    while slug in existing:
        slug = f"{base}_{i}"
        i += 1
    return slug


# ── branches: pull from Cliniko businesses (name + existence) ────────────────
def reconcile_branches(cli: Optional[Cliniko] = None) -> Dict[str, int]:
    """Cliniko is the source of truth for which branches exist and their names. New businesses are
    imported (with default hours/buffer, flagged for review); renamed businesses update the local
    name; archived/removed businesses set the local branch inactive (kept, since appointments may
    reference it). Hours/buffer are local operational config Cliniko doesn't store, so they're left
    untouched on existing branches."""
    cli = cli or Cliniko()
    imported = renamed = deactivated = reactivated = 0

    active_biz = {}  # cliniko_business_id -> name
    page = 1
    while True:
        data = cli.get("businesses", {"per_page": 100, "page": page})
        batch = data.get("businesses", [])
        for b in batch:
            if not b.get("archived_at"):
                active_biz[str(b["id"])] = b.get("business_name") or "Branch"
        if not data.get("links", {}).get("next"):
            break
        page += 1

    existing_ids = {r["id"] for r in db.query("select id from branches")}

    for biz_id, name in active_biz.items():
        local = db.query_one("select id, name, active from branches where cliniko_business_id=%s", (biz_id,))
        if local:
            if not local["active"]:
                db.execute("update branches set active=true where id=%s", (local["id"],))
                reactivated += 1
            if local["name"] != name:
                db.execute("update branches set name=%s where id=%s", (name, local["id"]))
                renamed += 1
        else:
            slug = _slugify(name, existing_ids)
            existing_ids.add(slug)
            db.execute(
                """insert into branches(id,name,address,tz,open_time,close_time,buffer_minutes,cliniko_business_id,active)
                   values(%s,%s,%s,'Asia/Kolkata','09:00','18:00',10,%s,true)""",
                (slug, name, "", biz_id))
            db.execute(
                "insert into followups(reason, notes) values('new_cliniko_branch', %s)",
                (f"New branch '{name}' appeared in Cliniko and was imported with default hours "
                 f"(09:00-18:00, buffer 10) — set real hours/buffer and assign doctor schedules.",))
            imported += 1

    # branches whose Cliniko business is now archived/gone -> deactivate (don't delete)
    for row in db.query("select id, cliniko_business_id from branches where active=true and cliniko_business_id is not null"):
        if row["cliniko_business_id"] not in active_biz:
            db.execute("update branches set active=false where id=%s", (row["id"],))
            deactivated += 1

    return {"branches_imported": imported, "branches_renamed": renamed,
            "branches_deactivated": deactivated, "branches_reactivated": reactivated}


# ── practitioners: pull from Cliniko (name + existence) ──────────────────────
def reconcile_practitioners(cli: Optional[Cliniko] = None) -> Dict[str, int]:
    """Cliniko is the source of truth for which doctors exist and their names. New practitioners are
    imported (specialty 'Unassigned', no schedule -> not bookable until configured, flagged for
    review); renamed practitioners update the local name; deactivated/removed practitioners set the
    local practitioner inactive. Specialty + schedules are local config Cliniko doesn't store."""
    cli = cli or Cliniko()
    imported = renamed = deactivated = reactivated = 0

    seen = {}  # cliniko_practitioner_id -> (name, active)
    page = 1
    while True:
        data = cli.get("practitioners", {"per_page": 100, "page": page})
        batch = data.get("practitioners", [])
        for p in batch:
            first = (p.get("first_name") or "").strip()
            last = (p.get("last_name") or "").strip()
            name = f"{first} {last}".strip()
            seen[str(p["id"])] = (name or "Doctor", bool(p.get("active")))
        if not data.get("links", {}).get("next"):
            break
        page += 1

    existing_ids = {r["id"] for r in db.query("select id from practitioners")}

    for prac_id, (name, is_active) in seen.items():
        local = db.query_one("select id, full_name, active from practitioners where cliniko_practitioner_id=%s", (prac_id,))
        if local:
            if is_active and not local["active"]:
                db.execute("update practitioners set active=true where id=%s", (local["id"],))
                reactivated += 1
            elif not is_active and local["active"]:
                db.execute("update practitioners set active=false where id=%s", (local["id"],))
                deactivated += 1
            # last-write-wins name: only pull Cliniko's name if it differs (Cliniko is source of truth)
            if local["full_name"].strip().lower() != name.strip().lower():
                db.execute("update practitioners set full_name=%s where id=%s", (name, local["id"]))
                renamed += 1
        elif is_active:
            slug = _slugify(name, existing_ids)
            existing_ids.add(slug)
            db.execute(
                """insert into practitioners(id, full_name, specialty, cliniko_practitioner_id, active)
                   values(%s,%s,'Unassigned',%s,true)""",
                (slug, name, prac_id))
            db.execute(
                "insert into followups(reason, notes) values('new_cliniko_doctor', %s)",
                (f"New doctor '{name}' appeared in Cliniko and was imported — set their specialty "
                 f"and working-hours schedule so they become bookable.",))
            imported += 1

    return {"doctors_imported": imported, "doctors_renamed": renamed,
            "doctors_deactivated": deactivated, "doctors_reactivated": reactivated}


def _branch_and_type_maps() -> tuple[Dict[str, str], Dict[str, str]]:
    branches = db.query("select id, cliniko_business_id from branches where cliniko_business_id is not null")
    types = db.query("select id, cliniko_appointment_type_id from appointment_types where cliniko_appointment_type_id is not null")
    return ({b["cliniko_business_id"]: b["id"] for b in branches},
            {t["cliniko_appointment_type_id"]: t["id"] for t in types})


# ── patients: full two-way last-write-wins ───────────────────────────────────
def reconcile_patients(cli: Optional[Cliniko] = None) -> Dict[str, int]:
    """Fetch every Cliniko patient (not just ones tied to an appointment) and reconcile with
    Supabase. Whichever side has the newer updated_at wins for that patient's name; the other
    side is updated to match. A patient that exists only in Cliniko is imported."""
    cli = cli or Cliniko()
    imported = pulled_from_cliniko = pushed_to_cliniko = 0

    page = 1
    while True:
        data = cli.get("patients", {"per_page": 100, "page": page})
        batch = data.get("patients", [])
        if not batch:
            break
        for cp in batch:
            cliniko_id = str(cp["id"])
            first = (cp.get("first_name") or "").strip()
            last = (cp.get("last_name") or "").strip()
            cliniko_name = f"{first} {last}".strip()
            cliniko_updated = _parse_cliniko_ts(cp["updated_at"])
            phones = [ph.get("number") for ph in (cp.get("patient_phone_numbers") or []) if ph.get("number")]

            local = db.query_one(
                "select id, full_name, updated_at from patients where cliniko_patient_id=%s", (cliniko_id,))

            if not local:
                # not yet linked — try matching by phone+name before creating a new one
                if phones:
                    local = db.query_one(
                        """select p.id, p.full_name, p.updated_at from patients p
                           join patient_phones pp on pp.patient_id=p.id
                           where pp.phone_e164=%s and lower(p.full_name)=lower(%s) limit 1""",
                        (phones[0], cliniko_name))
                if local:
                    db.execute("update patients set cliniko_patient_id=%s where id=%s", (cliniko_id, local["id"]))
                else:
                    with db.get_conn() as conn:
                        cur = conn.cursor()
                        cur.execute(
                            "insert into patients(full_name, cliniko_patient_id) values(%s,%s) returning id",
                            (cliniko_name or "Unknown", cliniko_id))
                        pid = cur.fetchone()[0]
                        for ph in phones:
                            cur.execute(
                                "insert into patient_phones(phone_e164, patient_id) values(%s,%s) on conflict do nothing",
                                (ph, pid))
                    imported += 1
                continue

            # both sides know this patient — last-write-wins on full_name
            if local["full_name"].strip().lower() == cliniko_name.strip().lower():
                continue  # already in sync
            local_updated = local["updated_at"]
            if cliniko_updated > local_updated:
                db.execute("update patients set full_name=%s where id=%s", (cliniko_name, local["id"]))
                pulled_from_cliniko += 1
            else:
                parts = local["full_name"].split(" ", 1)
                cli.update_patient(cliniko_id, first_name=parts[0], last_name=(parts[1] if len(parts) > 1 else ""))
                pushed_to_cliniko += 1

        if not data.get("links", {}).get("next"):
            break
        page += 1

    return {"patients_imported": imported, "patients_pulled_from_cliniko": pulled_from_cliniko,
            "patients_pushed_to_cliniko": pushed_to_cliniko}


def reconcile_appointments(cli: Optional[Cliniko] = None) -> Dict[str, int]:
    cli = cli or Cliniko()
    doctors = db.query("select id, cliniko_practitioner_id from practitioners where cliniko_practitioner_id is not null")
    branch_map, type_map = _branch_and_type_maps()

    imported = cancelled = rescheduled = skipped = conflicts = 0

    for doc in doctors:
        data = cli.get("individual_appointments", {
            "q[]": f"practitioner_id:={doc['cliniko_practitioner_id']}", "per_page": 100,
        })
        fetched = data.get("individual_appointments", [])
        seen_ids = {str(a["id"]) for a in fetched}

        for appt in fetched:
            cliniko_appt_id = str(appt["id"])
            local = db.query_one(
                "select id, status, start_ts, updated_at from appointments where cliniko_appointment_id=%s",
                (cliniko_appt_id,))
            is_cancelled = bool(appt.get("cancelled_at"))

            if local:
                # already tracked (either agent-created and written back, or previously imported)
                if is_cancelled and local["status"] == "booked":
                    db.execute("update appointments set status='cancelled' where id=%s", (local["id"],))
                    cancelled += 1
                elif not is_cancelled:
                    new_start = _parse_cliniko_ts(appt["starts_at"])
                    if new_start != local["start_ts"]:
                        # last-write-wins: only pull Cliniko's time if Cliniko was touched more
                        # recently than our own row — otherwise our own change is newer and hasn't
                        # been written back to Cliniko yet (pms_writeback will get to it), so
                        # overwriting here would silently undo the agent's own reschedule.
                        cliniko_updated = _parse_cliniko_ts(appt["updated_at"])
                        if cliniko_updated <= local["updated_at"]:
                            skipped += 1
                            continue
                        new_end = _parse_cliniko_ts(appt["ends_at"])
                        try:
                            db.execute("update appointments set start_ts=%s, end_ts=%s where id=%s",
                                      (new_start, new_end, local["id"]))
                            rescheduled += 1
                        except psycopg2.errors.ExclusionViolation:
                            db.execute(
                                "insert into followups(reason, notes) values('cliniko_sync_conflict', %s)",
                                (f"Cliniko rescheduled appointment {cliniko_appt_id} to a time that conflicts "
                                 f"with another booking — needs manual review.",))
                            conflicts += 1
                continue

            if is_cancelled:
                continue  # never seen it, and it's already cancelled -> nothing to import

            business_cid = str((appt.get("business") or {}).get("links", {}).get("self", "")).rstrip("/").rsplit("/", 1)[-1] \
                if appt.get("business") else None
            # Cliniko embeds relations as {links:{self:...}}; extract the id from the URL
            def _rel_id(key: str) -> Optional[str]:
                rel = appt.get(key)
                if not rel:
                    return None
                self_link = (rel.get("links") or {}).get("self", "")
                return self_link.rstrip("/").rsplit("/", 1)[-1] or None

            business_id = _rel_id("business")
            appt_type_id = _rel_id("appointment_type")
            patient_id_c = _rel_id("patient")

            branch_id = branch_map.get(business_id)
            appointment_type_id = type_map.get(appt_type_id)
            if not branch_id or not appointment_type_id or not patient_id_c:
                skipped += 1
                continue

            patient_id = _get_or_create_patient_from_cliniko(cli, patient_id_c)
            start = _parse_cliniko_ts(appt["starts_at"])
            end = _parse_cliniko_ts(appt["ends_at"])

            try:
                db.execute(
                    """insert into appointments(patient_id, practitioner_id, branch_id, appointment_type_id,
                           start_ts, end_ts, status, pms_sync_state, origin, cliniko_appointment_id,
                           idempotency_key)
                       values(%s,%s,%s,%s,%s,%s,'booked','synced','cliniko_manual',%s,%s)""",
                    (patient_id, doc["id"], branch_id, appointment_type_id, start, end,
                     cliniko_appt_id, f"cliniko-import-{cliniko_appt_id}"))
                imported += 1
            except psycopg2.errors.ExclusionViolation:
                db.execute(
                    "insert into followups(reason, notes) values('cliniko_sync_conflict', %s)",
                    (f"Cliniko appointment {cliniko_appt_id} conflicts with an existing booking for "
                     f"the same practitioner/time — needs manual review.",))
                conflicts += 1

        # Cliniko's DELETE hard-removes an appointment (no cancelled_at left to see) — so a booked
        # local row whose cliniko_appointment_id has vanished from Cliniko's current list entirely
        # was cancelled/deleted there. Only checked for rows we know Cliniko has seen (id not null).
        vanished = db.query(
            """select id, cliniko_appointment_id from appointments
                where practitioner_id=%s and status='booked' and cliniko_appointment_id is not null""",
            (doc["id"],))
        for row in vanished:
            if row["cliniko_appointment_id"] not in seen_ids:
                db.execute("update appointments set status='cancelled' where id=%s", (row["id"],))
                cancelled += 1

    return {"imported": imported, "cancelled": cancelled, "rescheduled": rescheduled,
            "skipped": skipped, "conflicts": conflicts}


def reconcile(cli: Optional[Cliniko] = None) -> Dict[str, int]:
    """Full sync driven by Cliniko. Order matters: branches + doctors first (structure), then
    patients (so appointment import has a patient to attach to), then appointments. Cliniko is the
    source of truth for existence/names of branches & doctors; patients are two-way last-write-wins."""
    cli = cli or Cliniko()
    result = {}
    result.update(reconcile_branches(cli))
    result.update(reconcile_practitioners(cli))
    result.update(reconcile_patients(cli))
    result.update(reconcile_appointments(cli))
    return result


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--loop", type=int, default=0, help="poll interval seconds (0 = run once)")
    args = ap.parse_args()
    if args.loop:
        print(f"cliniko-sync worker: polling every {args.loop}s")
        while True:
            try:
                res = reconcile()
                if any(res.values()):
                    print("reconcile:", res)
            except Exception as e:
                print(f"[cliniko_sync] cycle failed, will retry next poll: {e}")
            time.sleep(args.loop)
    else:
        print("reconcile:", reconcile())


if __name__ == "__main__":
    main()
