"""db/seed_supabase.py — mirror the clinic reference data into Supabase.

Reads seed/clinic.json (the clinic definition) + seed/cliniko_ids.json (Cliniko id map) and
upserts branches, appointment types, doctors, doctor->appointment-type links, and weekly schedules.
Idempotent: safe to re-run. Patients are NOT seeded here (deferred).

Usage:
    DATABASE_URL=... python -m db.seed_supabase
"""

from __future__ import annotations

import json
import os
from pathlib import Path

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env", override=True)

ROOT = Path(__file__).resolve().parent.parent
CLINIC = json.loads((ROOT / "seed" / "clinic.json").read_text())
IDS = json.loads((ROOT / "seed" / "cliniko_ids.json").read_text())


def seed(conn):
    cur = conn.cursor()
    br_ids = IDS.get("branches", {})
    at_ids = IDS.get("appointment_types", {})
    doc_ids = IDS.get("doctors", {})

    # branches
    for b in CLINIC["branches"]:
        cur.execute(
            """insert into branches(id,name,address,tz,open_time,close_time,buffer_minutes,cliniko_business_id)
               values(%s,%s,%s,%s,%s,%s,%s,%s)
               on conflict (id) do update set
                 name=excluded.name, address=excluded.address, tz=excluded.tz,
                 open_time=excluded.open_time, close_time=excluded.close_time,
                 buffer_minutes=excluded.buffer_minutes,
                 cliniko_business_id=excluded.cliniko_business_id""",
            (b["key"], b["name"], b.get("address"), CLINIC.get("time_zone", "Asia/Kolkata"),
             b["open_time"], b["close_time"], b.get("buffer_minutes", 0), br_ids.get(b["key"])),
        )

    # appointment types
    for a in CLINIC["appointment_types"]:
        cur.execute(
            """insert into appointment_types(id,name,duration_min,cliniko_appointment_type_id)
               values(%s,%s,%s,%s)
               on conflict (id) do update set
                 name=excluded.name, duration_min=excluded.duration_min,
                 cliniko_appointment_type_id=excluded.cliniko_appointment_type_id""",
            (a["key"], a["name"], a["duration_min"], at_ids.get(a["key"])),
        )

    # doctors + links + schedules (rebuild links/schedules for a clean mirror)
    for d in CLINIC["doctors"]:
        full = f"{d['first_name']} {d['last_name']}"
        cur.execute(
            """insert into practitioners(id,full_name,specialty,cliniko_practitioner_id)
               values(%s,%s,%s,%s)
               on conflict (id) do update set
                 full_name=excluded.full_name, specialty=excluded.specialty,
                 cliniko_practitioner_id=excluded.cliniko_practitioner_id""",
            (d["key"], full, d["specialty"], doc_ids.get(d["key"])),
        )
        cur.execute("delete from practitioner_appointment_types where practitioner_id=%s", (d["key"],))
        for at_key in d.get("appointment_types", []):
            cur.execute(
                """insert into practitioner_appointment_types(practitioner_id,appointment_type_id)
                   values(%s,%s) on conflict do nothing""", (d["key"], at_key))

        cur.execute("delete from practitioner_schedules where practitioner_id=%s", (d["key"],))
        for blk in d.get("schedule", []):
            for wd in blk["weekdays"]:
                cur.execute(
                    """insert into practitioner_schedules(practitioner_id,branch_id,weekday,start_time,end_time)
                       values(%s,%s,%s,%s,%s)""",
                    (d["key"], blk["branch"], wd, blk["start"], blk["end"]))

    # sync-cleanup: drop practitioners no longer in the config (only if unreferenced by appointments).
    # Cascades to their schedules + appointment-type links.
    keep = [d["key"] for d in CLINIC["doctors"]]
    cur.execute(
        """delete from practitioners
            where id <> all(%s)
              and id not in (select distinct practitioner_id from appointments)""",
        (keep,),
    )
    removed = cur.rowcount
    if removed:
        print(f"  (removed {removed} practitioner(s) no longer in config)")

    conn.commit()

    # report
    for t in ("branches", "appointment_types", "practitioners",
              "practitioner_appointment_types", "practitioner_schedules"):
        cur.execute(f"select count(*) from {t}")
        print(f"  {t:32} {cur.fetchone()[0]}")


def main():
    dsn = os.getenv("DATABASE_URL")
    if not dsn:
        raise SystemExit("DATABASE_URL not set")
    conn = psycopg2.connect(dsn)
    try:
        print(f"Mirroring clinic '{CLINIC['clinic_name']}' into Supabase:")
        seed(conn)
        print("Done.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
