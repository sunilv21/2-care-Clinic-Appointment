"""eval/agent_loop.py — run the ACTUAL agent brain (system prompt + tools) over scripted turns.

Uses OpenAI GPT-4o (the same LLM class the Bolna agent uses) with our real system prompt and the
7 tool definitions, executing tool calls against the real backend (app.tools) + Supabase + Cliniko.
This exercises the real prompt behaviour so we can measure turns-to-completion and redundant
questions per language.

It drives TEXT turns — it does NOT test ASR/TTS/barge-in (that's the voice layer, live only).
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Any, Dict, List

from openai import OpenAI
from dotenv import load_dotenv

from app import tools

load_dotenv(dotenv_path=".env", override=True)

ROOT = Path(__file__).resolve().parent.parent
SYSTEM_PROMPT = (ROOT / "bolna" / "system_prompt.md").read_text(encoding="utf-8")
_TOOLS_SPEC = json.loads((ROOT / "bolna" / "tools.json").read_text(encoding="utf-8"))

# LLM is provider-agnostic (OpenAI-compatible). Defaults to NVIDIA NIM.
LLM_BASE_URL = os.getenv("LLM_BASE_URL", "https://integrate.api.nvidia.com/v1")
LLM_API_KEY = os.getenv("LLM_API_KEY") or os.getenv("NVIDIA_API_KEY") or os.getenv("OPENAI_API_KEY", "")
MODEL = os.getenv("LLM_MODEL", "meta/llama-3.3-70b-instruct")


def make_client() -> OpenAI:
    return OpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)

# map tool name -> backend function
_DISPATCH = {
    "identify_caller":         lambda a: tools.identify_caller(a["phone"], a.get("spoken_name")),
    "create_patient":          lambda a: tools.create_patient(**a),
    "get_doctors":             lambda a: tools.get_doctors(**a),
    "get_branch_info":         lambda a: tools.get_branch_info(),
    "find_availability":       lambda a: tools.availability(**a),
    "get_earliest_slot":       lambda a: tools.get_earliest_slot(**a),
    "book_appointment":        lambda a: tools.book_appointment(**a),
    "get_patient_appointments": lambda a: tools.get_patient_appointments(**a),
    "reschedule_appointment":  lambda a: tools.reschedule_appointment(**a),
    "cancel_appointment":      lambda a: tools.cancel_appointment(**a),
    "log_followup":            lambda a: tools.log_followup(**a),
    "save_session_state":      lambda a: tools.save_session_state(**a),
}


def _openai_tools() -> List[Dict[str, Any]]:
    out = []
    for t in _TOOLS_SPEC:
        out.append({"type": "function", "function": {
            "name": t["name"], "description": t["description"],
            "parameters": t.get("parameters", {"type": "object", "properties": {}}),
        }})
    return out


class Conversation:
    def __init__(self, phone: str, client: OpenAI | None = None):
        self.client = client or make_client()
        self.phone = phone
        from datetime import datetime
        from zoneinfo import ZoneInfo
        today = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%A, %Y-%m-%d")
        self.messages: List[Dict[str, Any]] = [
            {"role": "system", "content": SYSTEM_PROMPT +
             f"\n\nToday's date is {today} (IST). Resolve 'today', 'tomorrow', weekday names against this."
             f"\nCaller's phone number for this call: {phone}. Pass this into tool `phone` fields."},
        ]
        self.tool_calls: List[Dict[str, Any]] = []   # {name, args, result, latency_ms}
        self.agent_replies: List[str] = []
        self.booked = False

    def _run_tool(self, name: str, args: Dict[str, Any]) -> Dict[str, Any]:
        args.setdefault("phone", self.phone) if name in (
            "identify_caller", "book_appointment", "log_followup", "save_session_state") else None
        t0 = time.perf_counter()
        try:
            result = _DISPATCH[name](args)
        except Exception as e:
            result = {"ok": False, "error": f"tool_exception: {e}"}
        latency = (time.perf_counter() - t0) * 1000
        self.tool_calls.append({"name": name, "args": args, "result": result,
                                "latency_ms": round(latency, 1)})
        if name == "book_appointment" and result.get("ok") and not result.get("conflict"):
            self.booked = True
        return result

    def user_turn(self, text: str, max_tool_iters: int = 10) -> str:
        """Feed one caller utterance; return the agent's spoken reply."""
        self.messages.append({"role": "user", "content": text})
        seen: Dict[str, Any] = {}   # dedupe identical tool calls within this turn
        for it in range(max_tool_iters):
            # on the last iteration, force a spoken reply (no more tools)
            force_text = it == max_tool_iters - 1
            resp = self.client.chat.completions.create(
                model=MODEL, messages=self.messages,
                tools=_openai_tools(),
                tool_choice=("none" if force_text else "auto"), temperature=0.2,
            )
            msg = resp.choices[0].message
            if not msg.tool_calls:
                self.messages.append({"role": "assistant", "content": msg.content or ""})
                self.agent_replies.append(msg.content or "")
                return msg.content or ""
            self.messages.append({
                "role": "assistant", "content": msg.content,
                "tool_calls": [tc.model_dump() for tc in msg.tool_calls],
            })
            for tc in msg.tool_calls:
                try:
                    args = json.loads(tc.function.arguments or "{}")
                except json.JSONDecodeError:
                    args = {}
                # dedupe: for availability, ignore volatile keys so near-identical repeats collapse
                dedupe_args = {k: v for k, v in args.items() if k not in ("limit",)}
                key = tc.function.name + json.dumps(dedupe_args, sort_keys=True, default=str)
                if key in seen:
                    result = {**seen[key], "_note": "You already called this and have the result. "
                              "Do NOT call it again — present the slots to the caller now, or book if "
                              "they already chose one. Never log a follow-up just because you looped."}
                else:
                    result = self._run_tool(tc.function.name, args)
                    seen[key] = result
                self.messages.append({
                    "role": "tool", "tool_call_id": tc.id,
                    "content": json.dumps(result, default=str),
                })
        self.agent_replies.append("(agent stalled)")
        return "(agent stalled)"
