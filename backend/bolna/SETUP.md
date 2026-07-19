# Bolna Agent Setup — Aarogya Clinic Receptionist ("Asha")

This wires the Bolna **inbound** voice agent to the backend tool API. Architecture: Bolna owns the
whole live call (SIP trunk, STT, LLM, TTS); the agent calls our FastAPI **tools** for anything live —
patients, doctors, availability, bookings. Supabase is the source of truth (kept in sync with Cliniko);
Cliniko is the real PMS system-of-record + write-back target. The system prompt never contains clinic
data — every doctor/slot/patient answer comes from a tool call, never from memory.

## 1. Deploy the backend (public URL)
Bolna calls our webhooks over HTTPS, so the FastAPI app must be reachable.

```bash
python run.py            # web + Cliniko write-back worker + outbound worker, one command
# expose it publicly (reserved ngrok domain, see BASE_URL in .env):
ngrok http --domain=<your-domain> 8080
```
Use the resulting `https://…` as **`{BASE_URL}`** below.

`TOOL_WEBHOOK_SECRET` is already generated and set in `.env` — use that exact value as the
`X-Tool-Secret` header on every tool and webhook below. Check `http://localhost:8080/` (dashboard
sidebar) or `GET /api/dashboard/bolna` any time to see whether Bolna is actually connected and fully
configured (green = tools + webhook wired; amber = connected but setup incomplete).

## 2. Create the Bolna agent
In the Bolna dashboard, create an **inbound** agent and configure:

**Providers (bilingual English + Hindi + code-switch):**
- **LLM:** use **Bolna's built-in LLM** for the live agent — pick a **low-latency** option that handles
  Hindi + tool-calling (a GPT-4o-class model). Temperature low (~0.3–0.4) for reliable tool calls.
  > Latency matters for voice: NVIDIA NIM hosted models (used by our offline eval) are too slow for
  > real-time speech (8b hallucinates; 49b/70b are 13–50s per turn). Keep the *live* LLM fast; the
  > NVIDIA nemotron model is for the **offline eval harness only**, not the phone agent.
- **STT:** a model that transcribes Hindi + Hinglish. Options to A/B on real calls:
  Deepgram (Hindi) or **Sarvam** (strong on Indian-language + code-switch).
- **TTS:** native, natural Hindi voice — **ElevenLabs multilingual v2** or **Sarvam**. Avoid a purely
  English voice (it mangles Hindi). Pick the one that sounds least "stitched" on Hinglish.
- **Interruption / barge-in:** ON, with a short endpointing/wait so callers can cut in naturally.
  Conversation state lives server-side (save_session_state), so a barge-in won't lose place.

> Justify the final STT/TTS pick in the README with a real Hinglish test call (latency + naturalness).

**System prompt:** paste the full contents of [`bolna/system_prompt.md`](system_prompt.md) — the
persona (Asha), the "always call a tool for live data, never guess" rule, and per-scenario guidance
(identification, booking, reschedule, cancel, escalation, dropped calls).

**Knowledge base:** upload the files in [`knowledge/`](../knowledge/) (clinic, branches, departments,
appointment policy, insurance, parking, FAQ, escalation). These are **static only** — no doctor names
or live availability — by design, so the agent can't answer live questions from stale KB content.

**Tools / functions:** add all 12 tools from [`bolna/tools.json`](tools.json):
`identify_caller`, `create_patient`, `get_doctors`, `get_branch_info`, `find_availability`,
`get_earliest_slot`, `book_appointment`, `get_patient_appointments`, `reschedule_appointment`,
`cancel_appointment`, `log_followup`, `save_session_state`.

Generate the exact `api_tools` object Bolna expects:

```bash
cd backend
python -m bolna.build_agent_tools
```

This writes `bolna/tools.resolved.json`. Use that generated object as
`tasks[0].tools_config.api_tools` in the direct `PUT /v2/agent/:agent_id` update. It separates the
function schemas from `tools_params`, so Bolna keeps the HTTP `url`, `method`, and `headers` instead
of losing them through the dashboard editor.

For each tool, the generated config sets:
- HTTP **POST** to `{BASE_URL}/tools/<name>`
- Header `X-Tool-Secret: {TOOL_WEBHOOK_SECRET}`
- the JSON-schema parameters as given (each tool's `description` in tools.json is written to teach the
  LLM *when* to call it — paste those descriptions verbatim, don't shorten them).
Map the caller's phone number (Bolna call variable) into the `phone` fields.

**End-of-call webhook:** set Bolna's post-call webhook to `POST {BASE_URL}/webhooks/bolna_call_end`
with the terminal status + transcript (see `call_end_webhook` in tools.json). This drives dropped-call
and missed-callback recovery.

## 3. Attach a phone number
Assign an inbound phone number to the agent in Bolna. That number is what goes in the submission
("the phone number we should call to test it live").

## 4. One-time Cliniko step
In the Cliniko UI, set **working hours** for the 3 practitioners (Kavindra Sharma, Aryan Vaishy,
Vanshika Dhakad) at their branches. Availability is computed in Supabase, but this keeps Cliniko's own
records consistent and lets write-back appointments sit inside real working hours.

## 5. Smoke test the live number
Call it and run the scenarios: earliest slot, "Dermatology at Whitefield", an underspecified time
("Thursday morning"), a reschedule, a Hindi-only turn, and a Hinglish turn. Confirm the booking shows
up in Cliniko.
