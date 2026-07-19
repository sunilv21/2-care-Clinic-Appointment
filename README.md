# Aarogya — Bilingual Voice AI Receptionist for a Clinic

A production-style inbound voice agent that books, reschedules, and cancels clinic appointments over
the phone, in **English and Hindi (with mid-call code-switching)**, against **live availability**,
backed by a real Postgres database with write-time double-booking prevention and a real PMS (Cliniko)
write-back, plus a bidirectional sync worker that keeps both systems consistent automatically.

- **Voice platform:** Bolna (inbound agent — SIP trunk · STT · LLM · TTS · barge-in)
- **Datastore / source of truth for scheduling:** Supabase Postgres
- **PMS system-of-record + write-back target:** Cliniko (real account, not a mock)
- **Telephony carrier (under Bolna):** Twilio
- **Clinic modeled:** *Aarogya Multi-Speciality Clinic* — 1 branch (Indiranagar), 4 doctors (General Medicine,
  Dermatology, Pediatrics, Orthopedics), IST, ₹ (INR)

> ⚠️ **This project runs entirely on free/trial tiers** of Twilio, Bolna, and Cliniko. See
> [Free-tier constraints](#free-tier-constraints-read-this-first) — several real, non-obvious
> limitations shaped the architecture and are worth knowing before you test or deploy this.

> Full design rationale and a requirement-by-requirement coverage matrix live in
> **[BUILD_PLAN.md](BUILD_PLAN.md)**. This README is the complete setup + reference doc.

---

## Repo structure — two independent projects

This repo is split into two top-level folders, deployed **separately**:

```
backend/    FastAPI tool API, Supabase, Cliniko integration, background workers — deploy to
            a Python host (Render / Railway / Fly / any Procfile-reading PaaS)
frontend/   React ops dashboard (Vite build) — deploy to a static host (Vercel / Netlify / or
            let the backend serve it for single-host local dev)
```

They talk to each other over plain HTTP (`VITE_API_BASE_URL` on the frontend → the backend's public
URL, with CORS configured on the backend to allow it). Neither folder imports across the boundary —
`backend/` never runs Node, `frontend/` never runs Python. Each has its own `.env.example`.

> **This is why the "why does it not work on Vercel" question comes up**: Vercel runs stateless,
> short-lived serverless functions and doesn't read `Procfile`. `backend/` needs a real always-on
> process (it holds a DB connection pool and runs background workers as infinite loops), so it must
> go on a host built for that — `frontend/` is a plain static Vite build and is exactly what Vercel is
> for. Deploy them to the right host each.

---

## Table of contents

- [Quick Start](#quick-start)
- [Repo structure — two independent projects](#repo-structure--two-independent-projects)
- [Free-tier constraints (read this first)](#free-tier-constraints-read-this-first)
- [Architecture](#architecture)
- [Why Bolna (stack justification)](#why-bolna-stack-justification)
- [Multilingual approach](#multilingual-approach-no-dictionaries)
- [The backend](#the-backend)
- [Cliniko ↔ Supabase sync](#cliniko--supabase-sync)
- [Tool API reference](#tool-api-reference)
- [Ops dashboard](#ops-dashboard)
- [Outbound calls (retry + continuation)](#outbound-calls-retry--continuation)
- [Eval harness](#eval-harness)
- [Latency](#latency)
- [Run it yourself (from a clean clone)](#run-it-yourself-from-a-clean-clone)
- [Bolna agent setup](#bolna-agent-setup)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Known limitations](#known-limitations)
- [Additional Documentation](#additional-documentation)
- [Repo layout](#repo-layout)

---

## Quick Start

Get the system running in 5 minutes:

```bash
# Backend setup
cd backend
pip install -r requirements.txt
cp .env.example .env  # Add your API keys
python -m db.apply                    # Setup database
python -m seed.seed_cliniko --apply   # Seed Cliniko
python -m db.seed_supabase           # Mirror to Supabase
python run.py                        # Start backend (port 8080)

# Frontend setup (new terminal)
cd frontend
npm install
npm run dev                          # Start frontend (port 5173)
```

Access the dashboard at `http://localhost:5173`. For detailed setup instructions, see [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

---

## Free-tier constraints (read this first)

This entire system was built and tested on **free/trial accounts**. That was a deliberate choice
(zero cost to demo), but it has real, non-cosmetic consequences worth knowing before you judge
behavior you see on a live call:

| Provider | Free tier | Constraint hit | How we handled it |
|---|---|---|---|
| **Twilio** (under Bolna) | Trial account | Can only **call phone numbers you've explicitly verified** in the Twilio console (Verified Caller IDs). Any outbound call to an unverified number fails with `"Trial accounts can only make calls to verified phone numbers."` | Every real number we test outbound calling with must be verified first. The [outbound retry system](#outbound-calls-retry--continuation) still behaves correctly — it retries with backoff and gives up gracefully after 3 attempts, logging a follow-up — this is a real, working failure path, not a bug. |
| **Bolna** | Trial account | A **separate, independent verified-numbers restriction** from Twilio's — Bolna trial accounts limit outbound calling to their own verified list, and cap concurrency at **2 simultaneous calls**. Also: the Bolna **dashboard UI for adding custom-function tools is unreliable on this tier** — the per-function JSON editor and "Generate from cURL" both silently dropped the HTTP `url`/`method`/`headers` on save in our testing. | We configure the agent's tools via a direct `PUT https://api.bolna.ai/v2/agent/:id` call instead of the dashboard (see [Bolna agent setup](#bolna-agent-setup) and [Troubleshooting](#troubleshooting)) — this is fully reliable and reproducible from a script. |
| **Cliniko** | 30-day trial | **Practitioners cannot be created via the API** (`POST /practitioners` → 404) — only through the Cliniko UI, and trial accounts have a seat cap. Live `available_times`/`next_available_time` also require **manually-configured working hours** in the Cliniko UI before they return data. | Doctors are added once by hand in the Cliniko UI, then the seed matches them by name to get their real Cliniko IDs. Availability is computed **ourselves** (in Supabase), not read live from Cliniko, so the whole booking flow never depends on that manual-hours step. Cliniko itself is used purely as the PMS write-back target + patient/appointment record. |

None of these are bugs in this codebase — they're accounts on the smallest possible tier, by design,
to keep this demo free to run and re-run. Upgrading any of the three removes the corresponding
constraint with no code changes required.

---

## Architecture

```
Caller ──phone──▶  Bolna  [ Twilio SIP trunk · STT · LLM · TTS · barge-in ]
                             │  tool calls (HTTPS)         │ end-of-call webhook
                             ▼                             ▼
                     FastAPI tool API (backend/app/main.py)
                     /tools/identify_caller · create_patient · get_doctors · get_branch_info ·
                     find_availability · get_earliest_slot · book_appointment ·
                     get_patient_appointments · reschedule_appointment · cancel_appointment ·
                     log_followup · save_session_state
                             │                         │
                             ▼                         ▼
                   Supabase Postgres          Cliniko PMS (real, live account)
                   • source of truth          • system-of-record for patients/appointments
                   • EXCLUDE no-double-book   • write-back target (agent-created bookings)
                   • availability engine      • also the source for branches/doctors
                   • call session state       • idempotent write-back + retried on failure
                             ▲                         │
                             └── cliniko_sync worker (60s) ── pulls branch/doctor/patient/
                                 appointment changes made directly in Cliniko back into Supabase

                     ┌─────────────────────────────────────────────┐
                     │  React dashboard (frontend/) — deployed      │
                     │  separately (e.g. Vercel), talks to the      │
                     │  backend's public URL over HTTP + CORS       │
                     └─────────────────────────────────────────────┘
```

**Bolna owns the whole live call** (telephony, speech, the conversational LLM, and turn-taking). Our
backend only exposes the **tool webhooks** and the **data/business logic**. Supabase is authoritative
for scheduling; Cliniko is the PMS we write bookings back to after they're confirmed — and a background
worker keeps the two in sync in both directions (see [Cliniko ↔ Supabase sync](#cliniko--supabase-sync)).
The dashboard is a separate, optional ops UI — the voice pipeline (Bolna ↔ backend ↔ Supabase/Cliniko)
works whether or not the dashboard is deployed at all.

---

## Why Bolna (stack justification)

- **Inbound + tools:** Bolna runs an inbound agent on a phone number with mid-call tool calls and an
  end-of-call webhook — exactly the shape this needs.
- **Tool-calling reliability:** the schema is **small and strongly-typed** (12 orthogonal tools, each
  with a description written to teach the LLM *when* to call it, not just what it returns), which
  maximises reliable tool use.
- **Multilingual:** handled at the provider layer (STT/LLM/TTS), **not** a translation table. The LLM
  produces Hindi/Hinglish natively; tool inputs/outputs stay canonical (ISO datetimes, ids) so language
  never corrupts data.
- **Latency:** the live LLM is Bolna's own low-latency model; tool responses are kept tiny (ranked
  top-N slots) and each tool has a `pre_call_message` so latency is masked with a natural holding
  phrase instead of dead air.
- **Cost:** free trial tier was sufficient to build and demo the entire system end-to-end (see
  [Free-tier constraints](#free-tier-constraints-read-this-first)).

---

## Multilingual approach (no dictionaries)

The system prompt (`backend/bolna/system_prompt.md`) instructs the agent to **mirror the caller's
language**, code-switch back naturally, and **not drift** in a single-language turn. Understanding
and generation are the LLM's job — there is no canned phrase list or translation lookup. Numbers/
dates/times are spoken naturally in the active language. Names stored ALL-CAPS in the data (e.g.
`VANSHIKA DHAKAD`) are **normalized to Title Case for speech** so they aren't spelled out letter by
letter.

The prompt's core rule, verbatim: *"If the answer depends on live clinic data — patients, doctors,
schedules, availability, or appointments — always call the appropriate tool. Never answer from
memory."* A separate static [`backend/knowledge/`](backend/knowledge/) base (clinic info, policies,
FAQ, parking, insurance, escalation — 8 files) covers only things that don't change; doctor names,
schedules, and availability are never in the prompt or knowledge base, only ever behind a live tool
call.

---

## The backend

- **Real datastore with write-time conflict checks:** Supabase Postgres. Double-booking is prevented
  by a database `EXCLUDE USING gist` constraint on `(practitioner_id, tstzrange(start,end))` where
  `status='booked'` — an overlapping insert **fails at the database**, not in app logic. Cancelled
  appointments free the slot (partial index). Verified: overlapping insert rejected, adjacent slot
  allowed, cancelled-then-rebooked allowed.
- **Live availability engine** (`backend/app/availability.py`): slots are **derived at query time**
  from working hours − booked appointments − branch buffer, in clinic-local time (`Asia/Kolkata`). No
  stored free-slot table, so answers are always live — a slot booked seconds earlier is immediately
  gone on the next check. Handles cross-branch/earliest-search, specialty/branch triage,
  underspecified time windows ("Thursday morning", "around 4:30"), and same-day buffers.
- **12-tool API** (`backend/app/main.py`, `backend/app/tools.py`) — see the
  [full reference](#tool-api-reference) below. Booking requires a captured full name, is idempotent,
  and returns the exact doctor/branch/time actually booked (so the agent never states a different
  branch than what was confirmed). Fees are returned **only** when a change falls inside the policy
  window.
- **Cliniko write-back** (`backend/app/pms_writeback.py`): after a confirmed Supabase booking, the
  appointment is queued to `pms_outbox` and written to Cliniko with an idempotency key. **Defined
  failure behavior:** the booking stays confirmed to the caller; the outbox retries with backoff;
  after max attempts it's flagged and a follow-up is logged for reconciliation. `PMS_FAIL_MODE=1`
  forces the failure path for testing.
- **State retention:** `save_session_state` persists context each turn; the end-of-call webhook marks
  a dropped call `interrupted` (→ resume on callback), a missed outbound `callback_pending`, and a
  clean finish `completed`. `identify_caller` surfaces returning patients, family-line ambiguity
  (multiple patients on one phone number), and resume context from a dropped call.
- **CORS**: `backend/app/main.py` allows cross-origin requests via `ALLOWED_ORIGINS` (env var,
  comma-separated, `*` by default) — required so the dashboard can call this backend from a different
  domain when deployed separately (see [Deployment](#deployment)).

---

## Cliniko ↔ Supabase sync

Two separate, complementary sync paths keep both systems consistent without ever needing to re-run a
seed script by hand:

**Supabase → Cliniko (write-back, real-time):** every agent-confirmed booking is written to Cliniko
immediately via the outbox pattern described above.

**Cliniko → Supabase (reconcile, every 60s — `backend/app/cliniko_sync.py`):** a background worker
(`cliniko_sync_worker` in `backend/Procfile` / `backend/run.py`) pulls in anything changed **directly
in Cliniko** — by clinic staff using the Cliniko UI, not through the voice agent:

| What changed in Cliniko | What the worker does |
|---|---|
| New branch (business) added | Imported into Supabase with default hours/buffer; a follow-up is logged flagging it for real hours to be set |
| Branch renamed | Supabase name updated to match |
| Branch archived | Supabase branch marked `active=false` (kept, not deleted — historical appointments still reference it) and immediately stops being offered to callers |
| New practitioner added | Imported (specialty `"Unassigned"`, no schedule → **not bookable** until configured) with a follow-up logged |
| Practitioner renamed / deactivated | Supabase updated to match |
| Appointment booked directly in Cliniko | Imported into Supabase (matches/creates the patient, blocks the slot for the voice agent too), tagged `origin='cliniko_manual'` |
| Appointment cancelled/deleted in Cliniko | Detected (Cliniko hard-deletes rather than soft-cancelling, so this is detected by **absence** from Cliniko's current list, not a `cancelled_at` flag) and mirrored as `cancelled` in Supabase |
| Appointment rescheduled in Cliniko | Time updated in Supabase to match |
| Patient added/edited in Cliniko | Last-write-wins by timestamp against the Supabase copy |

This closes a real gap that was empirically tested and confirmed during development: booking a slot
directly in Cliniko did **not** block that slot for the voice agent until this worker existed. Run it
manually any time with `python -m app.cliniko_sync` (from inside `backend/`).

---

## Tool API reference

All 12 tools are POST endpoints under `/tools/*`, authenticated by an `X-Tool-Secret` header
(`TOOL_WEBHOOK_SECRET` in `backend/.env`). Full JSON-schema parameter definitions and Bolna-facing
descriptions live in [`backend/bolna/tools.json`](backend/bolna/tools.json).

| Tool | Purpose | Key behavior |
|---|---|---|
| `identify_caller` | Called first, every call, with the phone number | Surfaces known patient(s), family-line ambiguity (multiple patients on one number), and dropped-call/callback resume context |
| `create_patient` | Register a new patient | Requires full name; syncs to Cliniko **immediately**, not deferred to first booking |
| `get_doctors` | List doctors, optionally filtered by specialty/branch | Live roster only — never answered from the prompt |
| `get_branch_info` | List branches with address/hours | Live only |
| `find_availability` | General-purpose live slot search | Re-run every time the caller asks about a new day/time — never reused |
| `get_earliest_slot` | Dedicated "soonest across everyone" search | Compares every doctor/branch; avoids the LLM anchoring on one doctor |
| `book_appointment` | Book a confirmed slot | Idempotent (`idempotency_key`); rejects anonymous bookings; returns `conflict:true` on a live double-booking race |
| `get_patient_appointments` | Find a patient's existing appointment(s) | Used before reschedule/cancel so the caller never reads out an ID |
| `reschedule_appointment` | Move an appointment | Returns a fee **only** if inside the policy window |
| `cancel_appointment` | Cancel an appointment | Returns a fee **only** if inside the policy window |
| `log_followup` | Escalate to a human / log an out-of-scope issue | Never implies a live transfer unless one is happening |
| `save_session_state` | Persist call progress | Powers dropped-call resume; called after each meaningful step |

Plus one webhook (not an LLM tool): `POST /webhooks/bolna_call_end` — Bolna's end-of-call callback,
which finalizes the session state (`completed` / `interrupted` / `callback_pending`).

---

## Ops dashboard

A **React dashboard** (`frontend/`, a Vite build) — deployed separately from the backend (its own
static host, e.g. Vercel) or, for local dev / a single-host setup, served by the backend itself:

| View | What it shows |
|---|---|
| **Overview** | KPI stats, a live availability finder, and live Cliniko + Bolna connection status |
| **Inbound Calls** | Every call session with a transcript viewer and a "Schedule callback to continue" action for dropped calls |
| **Calendar** | A Cliniko-style day grid — doctors as columns, appointments as time-positioned blocks, color-coded Agent vs. Cliniko-origin |
| **Appointments** | Full appointment list with status, PMS sync state, and origin (Agent/Cliniko) |
| **Patients** | Patient roster with phone numbers and Cliniko link status |
| **Outbound Calls** | Enqueue/process controls for the retry-with-continuation system |
| **Follow-ups** | Escalations/out-of-scope issues, with a "Mark resolved" action |
| **Call Sessions** | Raw session state (both directions) for debugging |
| **Clinic Setup** | Branches, doctors, appointment types, and their Supabase↔Cliniko links |

All data endpoints are read-only except explicit action buttons (enqueue call, resolve follow-up,
schedule callback) — the booking pipeline itself is never touched by the dashboard. A plain-HTML
fallback (`backend/app/static/index.html`) serves if no React build is found (checked at
`../frontend/dist` relative to `backend/`).

---

## Outbound calls (retry + continuation)

Clinic-initiated calls (reminders / callbacks / continuing a dropped call) are orchestrated with a
retry policy (`backend/app/outbound.py`): **not-connected** → retry with backoff (15m / 60m / 180m)
up to 3 attempts; **dropped mid-call** → retry to *continue* from the saved session context, not
restart; on give-up → mark `callback_pending` (so a return call from the patient carries context) and
log a follow-up. Worker: `python -m app.outbound_worker --loop 30` (from inside `backend/`).

This was tested against a real number and hit the Twilio/Bolna free-tier verified-number restriction
described above — the retry system itself worked exactly as designed (attempted, logged the real
provider error, retried on schedule, gave up gracefully).

---

## Eval harness

`backend/eval/` runs **scripted multi-turn conversations** through the *actual* system prompt + all
12 tools + the real database, driven by an LLM (NVIDIA NIM `nemotron-super-49b`, used **offline
only** — it is not the live Bolna model). Metrics are reported **per language, never blended**.

Run it (from inside `backend/`):
```bash
python -m eval.run_eval
```

**What it measures & why:** success rate (did it book / escalate correctly), **turns-to-completion**
(booking efficiency), **redundant-question count** via an LLM judge (catches broken state tracking),
and backend **tool latency**. These are the things a real front desk gets judged on.

<!-- EVAL_RESULTS -->
_Results from a run of `python -m eval.run_eval` (6 scenarios). The harness writes fresh results to
`backend/eval/last_run.json` each run — that file is gitignored (regenerated, not committed), so run
it yourself to reproduce these numbers:_

| Language | Success | Avg turns-to-book | Redundant Qs | Backend tool latency |
|---|---|---|---|---|
| English | 4/4 | 2.33 | 1 total (0.25 avg) | ~1865 ms |
| Hindi | 1/1 | 3.0 | 0 | ~2031 ms |
| Hinglish | 1/1 | 2.0 | 0 | ~3505 ms |

Reading: bookings complete in ~2–3 caller turns with near-zero redundant questions, and **Hindi /
Hinglish work end-to-end** (booked correctly, no language drift). The one flagged redundant question
(English) is a real, caught imperfection — the point of the metric.

**Where the harness gives false confidence (honest caveats):**
- It drives **text, not audio** — it does NOT test ASR errors on Hinglish, TTS pronunciation, barge-in
  timing, or network jitter. Those are voice-layer, testable only on a live call.
- The harness LLM (nemotron-49b) is **not** the live Bolna LLM, so it validates the **prompt logic +
  tools + backend**, not the live model's exact wording or latency.
- Scenario timing is relative to "now," so availability depends on real clinic hours the day it runs.

---

## Latency

- **Live path:** Bolna streams STT→LLM→TTS; component latency (ASR/LLM/TTS/network) is read from
  Bolna's per-call analytics per language (voice layer).
- **Backend tool latency** is measured directly by the eval harness (typically ~1–2 s per tool call
  against Supabase over the pooler). Tool responses are kept small and masked with a `pre_call_message`
  holding phrase per tool so the caller never hears dead air.

---

## Run it yourself (from a clean clone)

```bash
# ── Backend ──────────────────────────────────────────────
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in DATABASE_URL, CLINIKO_API_KEY, BOLNA_*, TOOL_WEBHOOK_SECRET, etc.

# Database: apply schema + seed the clinic
python -m db.apply                   # 7 migrations -> Supabase
python -m seed.seed_cliniko --apply  # branches + appt types in Cliniko (idempotent)
python -m db.seed_supabase           # mirror clinic (branches/doctors/schedules) into Supabase

# Run EVERYTHING with one command (web + all background workers)
python run.py                 # -> http://localhost:8080/  (serves the dashboard too, if built)

# Expose publicly for Bolna + configure the agent (see below)
ngrok http 8080

# Eval
python -m eval.run_eval

# ── Frontend (separate terminal) ─────────────────────────
cd ../frontend
npm install
cp .env.example .env   # only needed if running the dashboard against a REMOTE backend;
                        # leave unset for local dev (Vite's proxy handles it)
npm run dev             # -> http://localhost:5173  (dev server, proxies API calls to :8080)
# or: npm run build     # -> dist/, which backend/run.py will auto-detect and serve at :8080/
```

`python run.py` (run from inside `backend/`) starts the FastAPI server, the Cliniko write-back
worker, the outbound-call worker, and the Cliniko reconcile worker together; Ctrl+C stops them all.
To run just the web server: `python run.py --no-workers`.

**Cliniko one-time manual step:** doctors must be added via the Cliniko UI (the API can't create
practitioners on this tier), and each practitioner's **working hours** should be set so Cliniko's own
records stay consistent with write-back appointments. The sync worker then picks up
new/renamed/deactivated practitioners automatically — no reseeding needed after that.

---

## Bolna agent setup

Because of the [dashboard reliability issue on Bolna's free tier](#free-tier-constraints-read-this-first),
configure the agent via a direct API call rather than the dashboard function editor:

1. **System prompt:** paste [`backend/bolna/system_prompt.md`](backend/bolna/system_prompt.md) as the
   agent's prompt (this part of the dashboard *is* reliable).
2. **Knowledge base:** upload the 8 files in [`backend/knowledge/`](backend/knowledge/).
3. **Tools + webhook headers:** build and send a `PUT https://api.bolna.ai/v2/agent/:agent_id` request
   with the agent's full config, where `tasks[0].tools_config.api_tools` is:
   ```json
   {
     "tools": [ { "key": "custom_task", "name": "...", "parameters": {...}, "description": "...", "pre_call_message": "..." } ],
     "tools_params": { "<tool_name>": { "method": "POST", "url": "...", "param": {...}, "headers": {"X-Tool-Secret": "..."} } }
   }
   ```
   and top-level `webhook_headers: {"X-Tool-Secret": "..."}`. See
   [Troubleshooting](#troubleshooting) for exactly how this shape was discovered, and
   Generate `backend/bolna/tools.resolved.json` (gitignored — contains your real secret) for a
   ready-to-send `api_tools` object built from `backend/bolna/tools.json`:

   ```bash
   cd backend
   python -m bolna.build_agent_tools
   ```

   Paste that generated object into `tasks[0].tools_config.api_tools` in the `PUT /v2/agent/:id`
   payload.
4. **Phone number:** attach an inbound number to the agent (Twilio, under Bolna).
5. Full step-by-step in [`backend/bolna/SETUP.md`](backend/bolna/SETUP.md).

---

## Deployment

The backend and frontend deploy **independently**, to different kinds of hosts.

### Backend (`backend/`) — any Python PaaS that runs a persistent process

Needs a host that keeps a process running and reads a `Procfile` — **Render, Railway, Fly.io** all
work. **Not Vercel** (see [the note at the top](#repo-structure--two-independent-projects)).

1. Create the service with **Root Directory = `backend/`** (so it picks up `Procfile` and
   `requirements.txt` from there, and runs with `backend/` as its working directory — required, since
   `.env`/config are loaded relative to CWD).
2. Set every var from `backend/.env.example` in the platform's environment/secrets config, plus
   `ALLOWED_ORIGINS` = the frontend's deployed URL (e.g. `https://your-dashboard.vercel.app`) once you
   have it.
3. Deploy `web` as the primary process; `pms_worker`, `outbound_worker`, `cliniko_sync_worker`, and
   `keep_warm_worker` (see `backend/Procfile`) as background workers — or run `python run.py` as a
   single process if the platform only supports one process type.
4. Point the Bolna agent's tool URLs and end-of-call webhook at this deployed URL (replaces the ngrok
   tunnel used in local dev) — re-run the `PUT /v2/agent/:id` update with the new `BASE_URL`.
5. Supabase and Cliniko are both already-hosted services — no database provisioning needed beyond
   running `python -m db.apply` once against the target `DATABASE_URL`.

Render prep is included in [`render.yaml`](render.yaml). After Render creates the backend URL, set
`BASE_URL` and `KEEP_WARM_URL` to that public URL, then redeploy and regenerate the Bolna tool config:

```bash
cd backend
python -m bolna.build_agent_tools
```

The keep-warm worker pings `KEEP_WARM_URL` + `KEEP_WARM_PATH` (default `/health`) every
`KEEP_WARM_INTERVAL_SECONDS` seconds (default `300`). It is useful as a separate Render worker or
external pinger. If the only running process is a free web service that Render has already suspended,
an in-process pinger cannot wake itself; use the separate worker/cron-style pinger or upgrade the web
service for truly no cold starts.

### Frontend (`frontend/`) — any static host (Vercel, Netlify, Cloudflare Pages, …)

1. Create the project with **Root Directory = `frontend/`**. Vercel auto-detects Vite
   (`frontend/vercel.json` pins the build command/output dir explicitly too).
2. Set **`VITE_API_BASE_URL`** to the backend's deployed URL from the step above (this is the one
   thing that makes the split actually work — without it, the dashboard tries relative paths against
   its own static-host domain and every API call 404s).
3. Deploy. No server, no background process, no `Procfile` — it's a static build.

### Single-host alternative (local dev, or a simple demo)

Skip the split: build the frontend (`npm run build` inside `frontend/`) and run the backend
(`python run.py` inside `backend/`) — it auto-detects the sibling `frontend/dist` and serves the
dashboard itself at `/`, same-origin, no CORS or `VITE_API_BASE_URL` needed. This is exactly what
[Run it yourself](#run-it-yourself-from-a-clean-clone) does locally, and `ngrok http 8080` stands in
for a public URL in that mode.

---

## Troubleshooting

**"It doesn't work on Vercel."** Vercel can't run `backend/` at all — see the note at the top of this
README. Deploy `backend/` to Render/Railway/Fly and `frontend/` to Vercel, as two separate projects
(see [Deployment](#deployment)).

**Dashboard loads but every API call fails / CORS error in the browser console (split deployment).**
Two things to check: (1) `VITE_API_BASE_URL` was actually set **at build time** on the frontend host
(Vite bakes env vars in at build, not runtime — changing it requires a rebuild/redeploy, not just a
restart); (2) the backend's `ALLOWED_ORIGINS` includes the frontend's real deployed domain (or is
left as `*`, which is fine for this read-mostly dashboard with no cookie auth).

**Bolna dashboard: "Function name must be a string" when adding a tool.** The dashboard's function
editor expects one flat JSON object per tool (`{name, description, parameters, key:"custom_task",
value:{...}}`), not the array/wrapper shape some reference docs show. Even formatted correctly, in
testing the dashboard's own "Publish" step **silently dropped the entire `value` block** (url/method/
headers) on save, every time, across multiple attempts (raw JSON paste, "Generate from cURL", and
direct per-function JSON editing all lost it on publish). The reliable fix: skip the dashboard
entirely and `PUT` the agent config directly — see [Bolna agent setup](#bolna-agent-setup). The real,
working shape (discovered by testing against the live API): `tools[]` holds only LLM-facing metadata
(name/description/parameters); the actual HTTP call details live in a **separate `tools_params` dict
keyed by tool name** — not nested inside each `tools[]` entry.

**Outbound call fails with `"Trial accounts can only make calls to verified phone numbers."`** This is
a real Twilio (or separately, Bolna) trial-account restriction, not a bug — see
[Free-tier constraints](#free-tier-constraints-read-this-first). Verify the destination number in
whichever account is actually placing the call (check Bolna's dashboard for which Twilio account/SID
its number is provisioned under before assuming your own Twilio console verification applies).

**Dashboard shows a 404 on a new endpoint after a code change.** The running `python run.py` process
loads Python routes at startup only — restart it (`Ctrl+C`, then `python run.py` again, from inside
`backend/`) after pulling new backend code. A rebuilt `frontend/dist/` is served straight from disk
and updates immediately with no backend restart needed.

**Two `python run.py` instances fight over port 8080.** Only run one instance at a time (one
terminal, or let an agent/background process own it) — a second instance will fail to bind with
`[Errno 10048] / Address already in use`.

**`ModuleNotFoundError` / `.env` not found when running a script.** Every backend script loads
`.env` and imports (`app.*`, `db.*`, etc.) relative to the **current working directory**, not the
script's file location — always run backend commands from inside `backend/` (`cd backend` first).

**A background worker crashes but the web server stays up.** This is by design — `run.py` treats only
the web process as critical; a worker that dies (e.g. from a transient dropped Supabase pooler
connection) is logged and **auto-restarted after a 5s backoff**, without disturbing live calls. The
worker loops also each catch per-cycle exceptions and simply retry on the next poll, and the DB layer
discards dead pooled connections rather than reusing them — so a brief DB/network blip self-heals with
no intervention. (On a PaaS running each `Procfile` process separately, the platform's own restart
policy provides the same guarantee.)

---

## Known limitations

- **Live LLM latency** depends on Bolna's model choice; the NVIDIA NIM models used by the offline eval
  harness are too slow for live voice and are never used on a real call.
- Clinic **doctor specialties/schedules are representative data** assigned to real Cliniko
  practitioner records (see [Free-tier constraints](#free-tier-constraints-read-this-first) — Cliniko
  trial doesn't allow API-created practitioners).
- Cliniko allows overlapping appointments on its own (it only *flags* conflicts via a `conflicts`
  link), so **Supabase's `EXCLUDE` constraint is the real double-booking guard**; Cliniko is the
  write-back record.
- The clinic currently models **one branch** (Indiranagar) — the architecture and code fully
  support multiple branches (see the cross-branch logic in `backend/app/availability.py`); additional
  branches can be added via Cliniko and will automatically sync to Supabase.
- No auth on tool webhooks beyond a shared secret (scoped appropriately for a single-tenant demo, not
  multi-tenant production). Dashboard API endpoints have no auth at all (read-mostly ops tool).
- Running entirely on free tiers (see above) means concurrency (2 simultaneous Bolna calls) and
  outbound reach (verified numbers only) are both capped until any of the three services are upgraded.

---

## Additional Documentation

For more detailed documentation on specific aspects of the project:

- **[docs/GETTING_STARTED.md](docs/GETTING_STARTED.md)** - Comprehensive setup guide for new developers, including prerequisites, configuration, and development workflow
- **[docs/API_DOCUMENTATION.md](docs/API_DOCUMENTATION.md)** - Complete API reference for all backend and frontend endpoints
- **[docs/COMPONENT_DOCUMENTATION.md](docs/COMPONENT_DOCUMENTATION.md)** - Detailed documentation of React components and UI patterns
- **[frontend/README.md](frontend/README.md)** - Frontend-specific documentation with tech stack, project structure, and development guide
- **[BUILD_PLAN.md](BUILD_PLAN.md)** - Architecture decisions, design rationale, and requirement coverage matrix
- **[backend/bolna/SETUP.md](backend/bolna/SETUP.md)** - Step-by-step Bolna agent configuration guide

---

## Repo layout

```
backend/
  app/            FastAPI tool API, availability engine, tools, Cliniko write-back + reconcile sync,
                  outbound retry/continue orchestration, dashboard API
  db/             SQL migrations (7) + apply/seed scripts (Supabase)
  seed/           Cliniko clinic seeder + clinic.json config (initial setup only — see sync section)
  bolna/          system prompt, tool definitions (tools.json), agent setup guide
  knowledge/      static knowledge-base files (clinic, branches, policy, FAQ — no live data)
  eval/           scripted multi-turn harness + per-language metrics
  run.py          one-command launcher (web + all background workers)
  Procfile        process definitions for PaaS deployment
  requirements.txt
  .env.example    required backend environment variables template

frontend/
  src/            React dashboard source (Overview, Inbound Calls, Calendar, Appointments, Patients,
                  Outbound, Follow-ups, Call Sessions, Clinic Setup)
  dist/           Vite build output (gitignored — run `npm run build` to generate)
  vercel.json     explicit build config for Vercel
  .env.example    VITE_API_BASE_URL template (only needed for a split deployment)

BUILD_PLAN.md     full design + requirement coverage matrix
README.md         this file
```
