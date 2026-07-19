"""app/bolna_calls.py — minimal Bolna OUTBOUND calling client.

Places outbound calls via Bolna and reads execution status. Inbound calls are handled entirely inside
Bolna; this is only for clinic-initiated calls (reminders / callbacks / continuing a dropped call).
"""

from __future__ import annotations

import os
from typing import Any, Dict, Optional

import httpx
from dotenv import load_dotenv

load_dotenv(dotenv_path=".env", override=True)

BOLNA_BASE_URL = os.getenv("BOLNA_BASE_URL", "https://api.bolna.ai").rstrip("/")
BOLNA_API_KEY = os.getenv("BOLNA_API_KEY", "")
BOLNA_AGENT_ID = os.getenv("BOLNA_AGENT_ID", "")
BOLNA_FROM_NUMBER = os.getenv("BOLNA_FROM_NUMBER", "")


class BolnaCaller:
    def __init__(self, api_key: Optional[str] = None, agent_id: Optional[str] = None):
        self.api_key = api_key or BOLNA_API_KEY
        self.agent_id = agent_id or BOLNA_AGENT_ID

    def configured(self) -> bool:
        return bool(self.api_key and self.agent_id)

    def place_call(self, to_number: str, user_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if not self.configured():
            return {"ok": False, "error": "bolna_not_configured"}
        payload: Dict[str, Any] = {
            "agent_id": self.agent_id,
            "recipient_phone_number": to_number,
            "user_data": user_data or {},
        }
        if BOLNA_FROM_NUMBER:
            payload["from_phone_number"] = BOLNA_FROM_NUMBER
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        try:
            with httpx.Client(timeout=30) as c:
                r = c.post(f"{BOLNA_BASE_URL}/call", json=payload, headers=headers)
            if r.status_code >= 300:
                return {"ok": False, "error": f"{r.status_code}: {r.text[:200]}"}
            body = r.json() if r.text else {}
            data = body.get("data") if isinstance(body.get("data"), dict) else body
            eid = str(data.get("execution_id") or data.get("id") or data.get("call_id") or "").strip()
            if not eid:
                return {"ok": False, "error": "no_execution_id"}
            return {"ok": True, "execution_id": eid}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_agent(self) -> Dict[str, Any]:
        """Fetch the agent config — used to verify the API key + agent are valid and to check
        whether the system prompt / tools / webhook are actually wired up yet."""
        if not self.configured():
            return {"ok": False, "error": "bolna_not_configured"}
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            with httpx.Client(timeout=20) as c:
                r = c.get(f"{BOLNA_BASE_URL}/v2/agent/{self.agent_id}", headers=headers)
            if r.status_code >= 300:
                return {"ok": False, "error": f"{r.status_code}: {r.text[:200]}"}
            d = r.json()
            task = (d.get("tasks") or [{}])[0]
            tools_cfg = task.get("tools_config", {})
            llm = tools_cfg.get("llm", {})
            api_tools = tools_cfg.get("api_tools")
            if isinstance(api_tools, dict):
                has_tools = bool(api_tools.get("tools"))
            else:
                has_tools = bool(api_tools)
            return {
                "ok": True,
                "agent_id": d.get("id"),
                "agent_name": d.get("agent_name"),
                "agent_status": d.get("agent_status"),
                "webhook_url": d.get("webhook_url"),
                "llm_model": llm.get("model"),
                "stt_provider": tools_cfg.get("transcriber", {}).get("provider"),
                "stt_language": tools_cfg.get("transcriber", {}).get("language"),
                "tts_provider": tools_cfg.get("synthesizer", {}).get("provider"),
                "has_tools": bool(task.get("tools")) or has_tools,
            }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def list_phone_numbers(self) -> Dict[str, Any]:
        if not self.configured():
            return {"ok": False, "error": "bolna_not_configured"}
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            with httpx.Client(timeout=20) as c:
                r = c.get(f"{BOLNA_BASE_URL}/phone-numbers/all", headers=headers)
            if r.status_code >= 300:
                return {"ok": False, "error": f"{r.status_code}: {r.text[:200]}"}
            nums = r.json() or []
            mine = [n for n in nums if n.get("agent_id") == self.agent_id]
            return {"ok": True, "numbers": [n.get("phone_number") for n in mine]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_execution(self, execution_id: str) -> Dict[str, Any]:
        headers = {"Authorization": f"Bearer {self.api_key}"}
        try:
            with httpx.Client(timeout=20) as c:
                r = c.get(f"{BOLNA_BASE_URL}/executions/{execution_id}", headers=headers)
            if r.status_code >= 300:
                return {"ok": False, "error": f"{r.status_code}"}
            body = r.json() if r.text else {}
            data = body.get("data") if isinstance(body.get("data"), dict) else body
            return {"ok": True, "status": str(data.get("status") or data.get("state") or "").lower()}
        except Exception as e:
            return {"ok": False, "error": str(e)}
