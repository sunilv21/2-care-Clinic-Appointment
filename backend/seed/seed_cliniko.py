"""seed/seed_cliniko.py

Idempotent Cliniko seeder for the clinic system-of-record.

Creates (or reuses, matched by natural key) the clinic in Cliniko from a config JSON:
appointment types, branches (businesses), doctors (practitioners), and patients + phone numbers.
Writes the resulting Cliniko ids to seed/cliniko_ids.json so Supabase can mirror them.

SAFETY: dry-run by default. It only writes to your live Cliniko account with --apply.

Usage:
    python -m seed.seed_cliniko                 # dry run against seed/clinic.json
    python -m seed.seed_cliniko --config seed/clinic.json
    python -m seed.seed_cliniko --apply         # actually create in Cliniko
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from seed.cliniko_client import ClinikoClient  # noqa: E402

load_dotenv()

SEED_DIR = Path(__file__).resolve().parent
IDS_OUT = SEED_DIR / "cliniko_ids.json"


def _norm(s: str) -> str:
    return (s or "").strip().lower()


class Seeder:
    def __init__(self, client: ClinikoClient, apply: bool, with_patients: bool = False):
        self.c = client
        self.apply = apply
        self.with_patients = with_patients
        self.ids: Dict[str, Dict[str, str]] = {
            "appointment_types": {}, "branches": {}, "doctors": {}, "patients": {},
        }

    def _log(self, action: str, kind: str, name: str, id_: str = ""):
        tag = "CREATE" if action == "create" else "REUSE "
        if action == "create" and not self.apply:
            tag = "WOULD "
        print(f"  [{tag}] {kind:16} {name}{(' -> ' + id_) if id_ else ''}")

    # ── appointment types ────────────────────────────────────
    def seed_appointment_types(self, cfg: List[Dict[str, Any]]):
        existing = {_norm(a["name"]): a for a in self.c.list_all("appointment_types", "appointment_types")}
        for at in cfg:
            found = existing.get(_norm(at["name"]))
            if found:
                self._log("reuse", "appt_type", at["name"], found["id"])
                self.ids["appointment_types"][at["key"]] = found["id"]
                continue
            body = {"name": at["name"], "duration_in_minutes": at["duration_min"],
                    "color": at.get("color", "#B8D9FF"), "max_attendees": at.get("max_attendees", 1)}
            if self.apply:
                new_id = self.c.post("appointment_types", body)["id"]
                self.ids["appointment_types"][at["key"]] = new_id
                self._log("create", "appt_type", at["name"], new_id)
            else:
                self._log("create", "appt_type", at["name"])

    # ── branches (Cliniko businesses) ────────────────────────
    def seed_branches(self, cfg: List[Dict[str, Any]], country: str, tz: str):
        existing = {_norm(b["business_name"]): b for b in self.c.list_all("businesses", "businesses")}
        for br in cfg:
            found = existing.get(_norm(br["name"]))
            if found:
                self._log("reuse", "branch", br["name"], found["id"])
                self.ids["branches"][br["key"]] = found["id"]
                continue
            # Account has timezone-support disabled -> branches inherit the account tz;
            # sending time_zone triggers a 422. country also inherits the account default.
            body = {"business_name": br["name"], "address_1": br.get("address", "")}
            if self.apply:
                new_id = self.c.post("businesses", body)["id"]
                self.ids["branches"][br["key"]] = new_id
                self._log("create", "branch", br["name"], new_id)
            else:
                self._log("create", "branch", br["name"])

    # ── doctors ──────────────────────────────────────────────
    # NOTE: Cliniko does NOT support creating practitioners via API (POST 404), and trials cap
    # practitioner seats. Doctors are therefore authoritative in Supabase (the scheduling engine
    # uses them). For PMS write-back we map each doctor to an existing Cliniko practitioner
    # (matched by name if possible, else a shared default); the real doctor is recorded in Supabase
    # and echoed into the Cliniko appointment note.
    def seed_doctors(self, cfg: List[Dict[str, Any]]):
        def natkey(p): return _norm(f"{p.get('first_name','')} {p.get('last_name','')}")
        prac = self.c.list_all("practitioners", "practitioners")
        by_name = {natkey(p): p for p in prac}
        active = [p for p in prac if p.get("active")] or prac
        default_id = active[0]["id"] if active else None
        for d in cfg:
            nk = _norm(f"{d['first_name']} {d['last_name']}")
            match = by_name.get(nk)
            pid = match["id"] if match else default_id
            self.ids["doctors"][d["key"]] = pid
            tag = "MATCH " if match else "MAP   "
            print(f"  [{tag}] doctor           {nk} -> cliniko_prac {pid or 'NONE'}"
                  f"{'' if match else ' (shared default; real doctor in Supabase)'}")

    # ── patients + phones ────────────────────────────────────
    def seed_patients(self, cfg: List[Dict[str, Any]]):
        def natkey(p): return _norm(f"{p.get('first_name','')} {p.get('last_name','')}")
        existing = {natkey(p): p for p in self.c.list_all("patients", "patients")}
        for pt in cfg:
            nk = _norm(f"{pt['first_name']} {pt['last_name']}")
            found = existing.get(nk)
            if found:
                self._log("reuse", "patient", nk, found["id"])
                self.ids["patients"][pt["key"]] = found["id"]
                continue
            body = {
                "first_name": pt["first_name"],
                "last_name": pt["last_name"],
                "patient_phone_numbers": [{"phone_type": "Mobile", "number": pt["phone"]}],
            }
            if self.apply:
                new_id = self.c.post("patients", body)["id"]
                self.ids["patients"][pt["key"]] = new_id
                self._log("create", "patient", nk, new_id)
            else:
                self._log("create", "patient", f"{nk} ({pt['phone']})")

    def run(self, cfg: Dict[str, Any]):
        print(f"\nCliniko seed  |  shard={self.c.shard}  |  mode={'APPLY' if self.apply else 'DRY-RUN'}")
        print(f"Clinic: {cfg.get('clinic_name')}\n")
        print("Appointment types:")
        self.seed_appointment_types(cfg["appointment_types"])
        print("Branches:")
        self.seed_branches(cfg["branches"], cfg.get("country_code", "IN"), cfg.get("time_zone", "Asia/Kolkata"))
        print("Doctors:")
        self.seed_doctors(cfg["doctors"])
        if self.with_patients:
            print("Patients:")
            self.seed_patients(cfg["patients"])
        else:
            print("Patients: skipped (use --with-patients to seed them)")
            self.ids.pop("patients", None)

        if self.apply:
            IDS_OUT.write_text(json.dumps(self.ids, indent=2))
            print(f"\nWrote Cliniko id map -> {IDS_OUT}")
        else:
            print("\nDry run complete. Re-run with --apply to write to Cliniko.")


def load_config(path: Optional[str]) -> Dict[str, Any]:
    p = Path(path) if path else (SEED_DIR / "clinic.json")
    if not p.exists():
        example = SEED_DIR / "clinic.example.json"
        print(f"[warn] {p} not found; falling back to {example.name}")
        p = example
    return json.loads(p.read_text())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--config", default=None)
    ap.add_argument("--apply", action="store_true", help="actually write to Cliniko (default: dry run)")
    ap.add_argument("--with-patients", action="store_true", help="also seed patients (default: skip)")
    args = ap.parse_args()

    cfg = load_config(args.config)
    client = ClinikoClient(contact_email=os.getenv("CONTACT_EMAIL", "info@skyvisa.in"))
    try:
        Seeder(client, apply=args.apply, with_patients=args.with_patients).run(cfg)
    finally:
        client.close()


if __name__ == "__main__":
    main()
