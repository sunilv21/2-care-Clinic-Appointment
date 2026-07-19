"""seed/cliniko_client.py

Thin, dependency-light Cliniko API client for the clinic seed.

Cliniko specifics baked in:
- Base URL is region-sharded; the shard is the suffix after the last '-' in the API key
  (e.g. key '...-au5' -> https://api.au5.cliniko.com/v1).
- Auth is HTTP Basic: API key as username, blank password.
- A descriptive User-Agent with a contact email is REQUIRED by Cliniko.
- List endpoints paginate; we follow `links.next`.
"""

from __future__ import annotations

import base64
import os
from typing import Any, Dict, List, Optional

import httpx


def shard_from_key(api_key: str) -> str:
    """Cliniko encodes the region shard as the suffix after the final '-'."""
    key = (api_key or "").strip()
    if "-" not in key:
        raise ValueError("Cliniko API key has no shard suffix (expected '...-<shard>')")
    return key.rsplit("-", 1)[1]


class ClinikoClient:
    def __init__(self, api_key: Optional[str] = None, contact_email: str = "info@skyvisa.in",
                 app_name: str = "2care-VoiceReceptionist", timeout: float = 30.0):
        self.api_key = (api_key or os.getenv("CLINIKO_API_KEY", "")).strip()
        if not self.api_key:
            raise ValueError("CLINIKO_API_KEY not set")
        self.shard = shard_from_key(self.api_key)
        self.base_url = f"https://api.{self.shard}.cliniko.com/v1"
        token = base64.b64encode(f"{self.api_key}:".encode()).decode()
        self._headers = {
            "Authorization": f"Basic {token}",
            "User-Agent": f"{app_name} ({contact_email})",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        self._client = httpx.Client(timeout=timeout, headers=self._headers)

    # ── low-level ────────────────────────────────────────────
    def get(self, path: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        r = self._client.get(f"{self.base_url}/{path.lstrip('/')}", params=params)
        r.raise_for_status()
        return r.json()

    def post(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        r = self._client.post(f"{self.base_url}/{path.lstrip('/')}", json=body)
        if r.status_code >= 300:
            raise RuntimeError(f"POST {path} -> {r.status_code}: {r.text}")
        return r.json()

    def patch(self, path: str, body: Dict[str, Any]) -> Dict[str, Any]:
        r = self._client.patch(f"{self.base_url}/{path.lstrip('/')}", json=body)
        if r.status_code >= 300:
            raise RuntimeError(f"PATCH {path} -> {r.status_code}: {r.text}")
        return r.json()

    def list_all(self, path: str, key: str, params: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """Follow pagination and return every record under `key`."""
        out: List[Dict[str, Any]] = []
        params = dict(params or {})
        params.setdefault("per_page", 100)
        url = f"{self.base_url}/{path.lstrip('/')}"
        while url:
            r = self._client.get(url, params=params)
            r.raise_for_status()
            data = r.json()
            out.extend(data.get(key, []))
            nxt = (data.get("links") or {}).get("next")
            url, params = (nxt, None) if nxt else (None, None)
        return out

    def close(self):
        self._client.close()
