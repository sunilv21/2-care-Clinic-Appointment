"""app/cliniko.py — minimal Cliniko client for the backend write-back.

Self-contained (doesn't depend on seed/) so the app deploys on its own. Same auth rules as the seed:
region shard from key suffix, HTTP Basic, required User-Agent.
"""

from __future__ import annotations

import base64
import os
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env", override=True)


def _shard(key: str) -> str:
    return key.rsplit("-", 1)[1]


class Cliniko:
    def __init__(self, api_key: Optional[str] = None, contact_email: Optional[str] = None):
        self.key = (api_key or os.getenv("CLINIKO_API_KEY", "")).strip()
        if not self.key:
            raise RuntimeError("CLINIKO_API_KEY not set")
        self.shard = _shard(self.key)
        self.base = f"https://api.{self.shard}.cliniko.com/v1"
        token = base64.b64encode(f"{self.key}:".encode()).decode()
        email = contact_email or os.getenv("CONTACT_EMAIL", "info@skyvisa.in")
        self._headers = {
            "Authorization": f"Basic {token}",
            "User-Agent": f"2care-VoiceReceptionist ({email})",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

    def _client(self) -> httpx.Client:
        return httpx.Client(timeout=30, headers=self._headers)

    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        with self._client() as c:
            r = c.get(f"{self.base}/{path.lstrip('/')}", params=params)
            r.raise_for_status()
            return r.json()

    def create_patient(self, first_name: str, last_name: str, phone: Optional[str] = None) -> str:
        body: Dict[str, Any] = {"first_name": first_name, "last_name": last_name}
        if phone:
            body["patient_phone_numbers"] = [{"phone_type": "Mobile", "number": phone}]
        with self._client() as c:
            r = c.post(f"{self.base}/patients", json=body)
            r.raise_for_status()
            return r.json()["id"]

    def update_patient(self, patient_id: str, *, first_name: Optional[str] = None,
                       last_name: Optional[str] = None) -> None:
        body: Dict[str, Any] = {}
        if first_name is not None:
            body["first_name"] = first_name
        if last_name is not None:
            body["last_name"] = last_name
        if not body:
            return
        with self._client() as c:
            r = c.patch(f"{self.base}/patients/{patient_id}", json=body)
            r.raise_for_status()

    def create_appointment(self, *, patient_id: str, practitioner_id: str, business_id: str,
                           appointment_type_id: str, starts_at_utc: str, ends_at_utc: str,
                           notes: Optional[str] = None) -> str:
        body = {
            "patient_id": patient_id, "practitioner_id": practitioner_id,
            "business_id": business_id, "appointment_type_id": appointment_type_id,
            "starts_at": starts_at_utc, "ends_at": ends_at_utc,
        }
        if notes:
            body["notes"] = notes
        with self._client() as c:
            r = c.post(f"{self.base}/individual_appointments", json=body)
            if r.status_code >= 300:
                raise RuntimeError(f"cliniko create appt {r.status_code}: {r.text[:300]}")
            return r.json()["id"]

    def update_appointment(self, cliniko_id: str, *, starts_at_utc: str, ends_at_utc: str) -> None:
        with self._client() as c:
            r = c.patch(f"{self.base}/individual_appointments/{cliniko_id}",
                        json={"starts_at": starts_at_utc, "ends_at": ends_at_utc})
            if r.status_code >= 300:
                raise RuntimeError(f"cliniko update appt {r.status_code}: {r.text[:300]}")

    def delete_appointment(self, cliniko_id: str) -> None:
        with self._client() as c:
            r = c.delete(f"{self.base}/individual_appointments/{cliniko_id}")
            if r.status_code not in (200, 204, 404):
                raise RuntimeError(f"cliniko delete appt {r.status_code}: {r.text[:300]}")
