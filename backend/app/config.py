"""app/config.py — runtime config for the clinic backend.

Clinic-level settings (policy, currency, tz) come from seed/clinic.json so the datastore, agent, and
tools all share one source. Secrets come from .env.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import load_dotenv

load_dotenv(dotenv_path=".env", override=True)

ROOT = Path(__file__).resolve().parent.parent
_CLINIC = json.loads((ROOT / "seed" / "clinic.json").read_text())

CLINIC_NAME: str = _CLINIC.get("clinic_name", "Clinic")
TIME_ZONE: str = _CLINIC.get("time_zone", "Asia/Kolkata")
CLINIC_TZ = ZoneInfo(TIME_ZONE)
CURRENCY: str = _CLINIC.get("currency", "INR")

_policy = _CLINIC.get("policy", {})
RESCHEDULE_FEE = _policy.get("reschedule_fee_inr", 0)
CANCELLATION_FEE = _policy.get("cancellation_fee_inr", 0)
FEE_WINDOW_HOURS = _policy.get("fee_window_hours", 24)

# Shared secret for tool webhooks (Bolna -> backend). If unset, auth is skipped (local/dev only).
TOOL_WEBHOOK_SECRET = os.getenv("TOOL_WEBHOOK_SECRET", "")

# CORS: comma-separated list of allowed origins (e.g. the deployed dashboard's Vercel URL), or "*"
# for any origin (fine here — the dashboard sends no cookies/credentials cross-origin).
_origins = os.getenv("ALLOWED_ORIGINS", "*").strip()
ALLOWED_ORIGINS = ["*"] if _origins == "*" else [o.strip() for o in _origins.split(",") if o.strip()]
