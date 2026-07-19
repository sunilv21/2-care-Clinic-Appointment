# 2care.ai Voice AI Receptionist — Build Plan

**Target:** Inbound bilingual (English + Hindi, mid-call code-switch) voice receptionist for a real
multi-branch clinic. Full appointment lifecycle (book / reschedule / cancel / conflict resolution)
against **live availability**, backed by a **real datastore** with write-time double-booking checks
and a **mock PMS write-back** with idempotency. Plus a **re-runnable eval harness** reporting
per-language metrics.

**Platform decision: Bolna** (locked). Justification in §2.

---

## 0. What we reuse from CleverCruit vs. what is new

| Reuse (adapt) | Build new |
|---|---|
| Bolna HTTP client pattern (`sip_service.py`) — auth, retries, execution polling | Bolna **inbound** agent config + **tool webhooks** (current code is outbound-only) |
| SQLite/WAL patterns, FK cascade, migration style (`db.py`) | Postgres schema for clinic domain (branches, practitioners, slots, patients, appointments, call_sessions) |
| `logger.py` (PII masking), `settings.py`, `.env` loading | Tool-calling FastAPI router (`/tools/*`) — the agent↔backend contract |
| Transcript normalization (`extract_transcript_entries`) | Call-session state store + dropped-call / callback / returning-patient recovery |
| FastAPI app shell, run scripts | Mock PMS write-back service (Cliniko-style) with idempotency + defined failure behavior |
| — | Eval harness (multi-turn, per-language, latency breakdown, turns-to-completion) |

The outbound campaign UI (React) is **not needed** for this assignment and is left out of scope
(kept in repo but not part of the deliverable path).

---

## 1. Clinic (real, sourced — not invented)

Pick one **real Indian clinic chain with ≥2 branches** and source doctors/departments/slot
structure from its public site (e.g. a real dental or multi-speciality clinic with two listed
locations). Locale consequences that the test cases probe:

- **Timezone:** `Asia/Kolkata` everywhere. All "today"/same-day logic computed in clinic-local time,
  never naive UTC. (Directly targets the "UTC shifts today→tomorrow" test.)
- **Currency:** `INR (₹)` consistently for any fee mention. (Targets the currency test.)
- **Two branches** are load-bearing: earliest-slot-across-branches and branch-specific triage
  scenarios require it.

Data captured per entity:
- **Branch:** id, name, address, timezone, opening hours, inter-appointment **buffer minutes**.
- **Practitioner:** id, display name (stored possibly ALL-CAPS — see pronunciation test), specialty/department, branch membership (a practitioner may sit at one or both branches), per-branch working hours.
- **Slot model:** generated from practitioner working hours × slot length, minus buffer, minus booked appointments → **derived live**, never a static "available slots" table (stale-availability test).

---

## 2. Stack justification (Bolna) — for the README

Write the README section around **real drivers**, not "it was easier":

- **Inbound + telephony:** Bolna supports inbound agents attached to a phone number with per-call
  `user_data`/context and end-of-call webhooks — the shape this assignment needs. We already have a
  working Bolna auth/execution integration to build on.
- **Tool-calling reliability:** Bolna exposes API/function tools the agent invokes mid-call. Our
  design keeps the schema **small and strongly-typed** (§5) so tool-call reliability is maximised —
  fewer, well-scoped tools beat many overlapping ones.
- **Multilingual / code-switch:** Handled at the **provider layer**, not a lookup table. Choose an
  STT that transcribes Hindi + Hinglish and a TTS with native Hindi. Candidate stack:
  **STT:** Deepgram (Hindi) or **Sarvam** (strong on Indian-language + Hinglish code-switch);
  **LLM:** GPT‑4o class (natively bilingual, handles intra-sentence switching);
  **TTS:** ElevenLabs multilingual v2 or **Sarvam** (natural Hindi, avoids the "two languages
  stitched together" artefact). *Final STT/TTS pick to be A/B'd on real Hinglish calls (§9 caveat).*
- **Latency:** Bolna streams STT→LLM→TTS; we further cut perceived latency with holding phrases
  during tool calls (§8). Report Bolna's per-call component timings.
- **Cost:** Per-minute provider pricing; note the trade of Sarvam (India-optimised) vs
  Deepgram+ElevenLabs (quality) and which we shipped and why.

> README must state the *decision* and the *evidence* (latency numbers, a Hinglish call that worked),
> not just capabilities.

---

## 2.5 Cliniko as the PMS system-of-record (verified live)

Cliniko API key is connected (shard **`au5`**, base `https://api.au5.cliniko.com/v1/`, HTTP Basic
auth with key as username, `User-Agent` w/ contact email required). Verified account state:

- **1 business** ("sunil verma"), country **IN**, timezone **Asia/Kolkata** — locale defaults already correct.
- **1 practitioner**, **0 patients**, **2 appointment types** (Standard 30m, First 45m).
- `available_times` / `next_available_time` return **"not found"** because the practitioner has **no
  working hours configured** — Cliniko only computes availability after working hours are set, and that
  is a **one-time UI setup** (not reliably API-writable). This is the single manual setup step.

**What Cliniko gives us (created via API in the seed):** businesses = **branches**,
appointment_types = **departments/visit types**, patients, and appointments (create rejects conflicts
at write = a second safety net).

**Cliniko API constraints discovered while seeding (drive the design):**
- **Practitioners are NOT API-creatable** — `POST /practitioners` → 404 (they're tied to invited user
  seats; trials cap them). ⟹ **doctors are authoritative in Supabase**; the seed maps each Supabase
  doctor to an existing Cliniko practitioner for write-back, and the real doctor name is echoed into
  the Cliniko appointment note. (`seed/cliniko_ids.json` currently maps all 7 doctors → the one trial
  practitioner.)
- **Timezone support disabled** on this account ⟹ don't send `time_zone` on `POST /businesses` (422);
  branches inherit the account tz (`Asia/Kolkata`).
- **`POST /appointment_types`** requires `color` (hex like `#B8D9FF`) and `max_attendees` (int).
- **`POST /patients`** accepts nested `patient_phone_numbers` and works; patients are deletable (204).
- Seed is **idempotent** (match-by-name → reuse) and safe to re-run.

**Role split (decided):**
- **Cliniko = clinic system-of-record + PMS write-back target.** We create the 2-branch clinic
  (doctors, appointment types, patients) here — "Use Cliniko for clinic creation." After a confirmed
  booking, we **write the appointment back to Cliniko** (`POST /appointments`) with idempotency +
  retry — this is exactly the assignment's "PMS write-back API that tool calls hit *after a confirmed
  booking*."
- **Supabase = our operational datastore + live scheduling engine.** We store practitioner working
  hours / slot templates and **compute availability ourselves** (tz + buffer aware, cross-branch,
  earliest-search) so the live call path is fast and **reproducible** without depending on Cliniko's
  UI-configured availability. The `appointments` table carries the **write-time double-booking EXCLUDE
  constraint** (assignment bullet 1). Plus `call_sessions`, `followups`, `pms_outbox`.

> Why not read availability from Cliniko directly? It needs UI-configured working hours (not
> reproducible from a clean clone), and it adds a third-party call into the latency-critical speech
> path. We keep availability in Supabase (fast, seeded, deterministic) and use Cliniko as the
> authoritative **write-back** PMS + patient/doctor record. Cliniko's own conflict rejection on
> `POST /appointments` is a free second check. *(Alternative — Cliniko-authoritative availability via
> `available_times` — is documented as a fallback but not the primary.)*

## 3. Architecture

```
        ┌─────────────┐   inbound PSTN    ┌───────────────────────────┐
Caller ─┤ Phone number ├──────────────────┤  Bolna inbound agent      │
        └─────────────┘                   │  STT · LLM · TTS · prompt │
                                          │  (bilingual, barge-in)    │
                                          └────────────┬──────────────┘
                                       tool calls (HTTPS webhooks) │  end-of-call webhook
                                                        ▼          ▼
                                   ┌──────────────────────────────────────────┐
                                   │  FastAPI backend (public URL)             │
                                   │  /tools/identify_caller                   │
                                   │  /tools/find_availability                 │
                                   │  /tools/book_appointment                  │
                                   │  /tools/reschedule · /cancel              │
                                   │  /tools/log_followup                      │
                                   │  /tools/save_session_state                │
                                   │  /webhooks/bolna_call_end                 │
                                   └───────┬───────────────────────┬──────────┘
                                           ▼                       ▼
                          ┌────────────────────────┐   ┌───────────────────────────┐
                          │ Supabase Postgres      │   │ Cliniko PMS (real, au5)   │
                          │ (source of truth)      │──▶│ system-of-record +        │
                          │ • overlap EXCLUDE      │   │ write-back target         │
                          │   constraint (no       │   │ • businesses = branches   │
                          │   double-booking)      │   │ • practitioners = doctors │
                          │ • availability engine  │   │ • patients, appointments  │
                          │ • call_sessions state  │◀──│ • rejects conflicts too   │
                          │ • pms_outbox (idemp.)  │   │   (2nd safety net)        │
                          └────────────────────────┘   └───────────────────────────┘
```

**Datastore = Supabase Postgres** (decided) for two assignment-critical reasons:
1. **Write-time double-booking prevention** via a real DB constraint: `EXCLUDE USING gist` on
   `(practitioner_id WITH =, branch_id WITH =, tstzrange(start,end) WITH &&)` (needs `btree_gist`).
   This makes an overlapping insert **fail at the database**, not in app logic — exactly what
   "conflict checks enforced at write time" asks for.
2. Real concurrency for the "slot taken by the time of booking" re-check test.

Runnable-from-clean-clone: schema + `btree_gist` + seed shipped as **SQL migrations** applied to a
Supabase project (one command via the Supabase CLI / `supabase db push`). Supabase is also the
**hosted DB for the live deployment**, so local and production are the same engine — no SQLite/PG
drift. Connection via the Postgres connection string (service role for the backend); RLS off for the
tool backend (server-trusted), documented as a scoped decision.

**Backend must be publicly reachable** (Bolna webhooks call in): deploy to Render/Railway/Fly with
the DB attached. Live phone number attaches to the Bolna agent whose tools point at that URL.

---

## 4. Data model (Postgres)

```
branches(id, name, address, tz='Asia/Kolkata', open_time, close_time, buffer_minutes,
         cliniko_business_id)                             -- maps to Cliniko business
practitioners(id, full_name, specialty, cliniko_practitioner_id, ...)  -- full_name may be ALL-CAPS
practitioner_branches(practitioner_id, branch_id, work_start, work_end, weekday_mask)
appointment_types(id, name, duration_min, cliniko_appointment_type_id) -- Standard 30m / First 45m
patients(id, full_name, dob, notes, cliniko_patient_id)
patient_phones(phone_e164, patient_id)                    -- MANY patients ↔ one phone (family line)
appointments(id, patient_id, practitioner_id, branch_id, start_ts, end_ts,
             status[booked|cancelled|completed], created_at, pms_sync_state, idempotency_key,
             cliniko_appointment_id)                      -- filled after successful write-back
   -- EXCLUDE constraint prevents overlapping booked appts per practitioner+branch
call_sessions(id, phone_e164, patient_id?, state[active|interrupted|completed|callback_pending],
              context_json, last_turn_at, bolna_execution_id, direction[in|out], updated_at)
followups(id, phone_e164, patient_id?, reason, transcript_ref, created_at, resolved)
pms_outbox(id, appointment_id, idempotency_key, payload_json, attempts, status, last_error)
```

- **Availability is derived**, never stored as a truth table: `find_availability` computes free
  slots = working hours − booked appts − buffer, in clinic tz, at query time.
- `call_sessions.context_json` holds the running booking context (name, intent, chosen branch/
  practitioner/slot, what's already been asked) — the backbone of state retention.

---

## 5. Tool-calling schema (agent ↔ backend contract)

Small, orthogonal, strongly-typed. Each returns compact JSON the LLM can speak back.

| Tool | Input | Returns | Notes / scenarios served |
|---|---|---|---|
| `identify_caller` | `phone`, `spoken_name?` | `{patients[], open_session?, callback?, dropped_call?}` | Returning patient, family-line disambiguation, callback, dropped-call resume |
| `find_availability` | `{branch?, practitioner?, specialty?, date?, time_from?, time_to?, earliest_across_all?}` | ranked live slots w/ branch+practitioner+local date | Underspecified time refs; earliest-across-branches; branch triage; **always live** (stale-availability) |
| `book_appointment` | `{patient_name, patient_id?, practitioner_id, branch_id, start_ts, idempotency_key}` | `{ok, appointment_id}` or `{conflict:true}` | Write-time conflict → graceful re-offer; name required; PMS write-back triggered |
| `reschedule_appointment` | `{appointment_id, new_start_ts, idempotency_key}` | `{ok}` / `{conflict}` / `{fee: {amount, currency}}` | Correct new slot; fee **only if inside policy window** |
| `cancel_appointment` | `{appointment_id}` | `{ok, fee?}` | Fee only when policy window triggers |
| `log_followup` | `{reason, notes}` | `{ok}` | Human handoff / clinical concern / out-of-scope |
| `save_session_state` | `{context}` | `{ok}` | Called each meaningful turn → enables drop/callback resume |

Design rules baked into the contract (map to test cases):
- `book_appointment` **requires a captured name** (server rejects anonymous) → "always capture full name."
- `find_availability` with `earliest_across_all:true` scans **all practitioners × both branches** and
  returns the globally earliest — the backend does the search, so the LLM can't anchor on one doctor.
- Backend echoes the **exact branch** in the tool result; the prompt speaks back what the tool
  returned → "spoken branch must match booked branch."
- Availability respects `buffer_minutes` → "same-day buffer."
- Names returned in Title Case for speaking even if stored ALL-CAPS → "pronounce naturally."

---

## 6. Bilingual + code-switch approach (no dictionaries)

- **Provider-level** multilingual ASR/LLM/TTS (§2). The prompt instructs: mirror the caller's
  language and code-switching; in a single-language turn, **do not drift** into the other language;
  keep numbers/dates natural in whichever language is active.
- The LLM (not a translation table) produces Hindi/Hinglish. Tool **inputs/outputs stay in a
  canonical machine format** (ISO datetimes, ids) so language never corrupts data.
- Prompt authored and tested in **Hindi first-class**, not English-translated-on-the-fly (graded:
  "prompt holds up in Hindi").

---

## 7. Required scenarios & test cases → coverage matrix

| Requirement / test | How it's handled |
|---|---|
| Underspecified time ("Dec 13 around 1", "Mon/Wed", "after work ~4:30", "any Thu morning") | LLM maps phrasing → `find_availability` structured window; backend resolves against live slots |
| Returning patient, no context | `identify_caller` by phone → prior patient + history injected into session |
| Missed outbound → callback | Unanswered outbound writes `call_sessions.state=callback_pending`; inbound `identify_caller` finds it, carries context |
| Stale availability from memory | Every new time request re-calls `find_availability`; prompt forbids answering from earlier tool output |
| Earliest slot across branches/practitioners | `earliest_across_all` server-side global search |
| Branch-specific triage reliability | `find_availability(branch, specialty)` deterministic query; idempotent, no intermittent failure |
| Dropped-call recovery | `save_session_state` each turn; on callback within window, agent acknowledges drop + resumes |
| Capture full name before booking | Server-enforced in `book_appointment` |
| Family line / shared phone | `identify_caller` returns multiple patients → agent asks name to disambiguate |
| Slot taken by booking time | `book_appointment` re-checks at write via EXCLUDE constraint → `{conflict}` → agent re-offers live |
| Spoken branch == booked branch | Tool result is the single source; prompt speaks it back verbatim |
| Same-day buffer respected | `buffer_minutes` in slot derivation |
| Reschedule books correct slot; fee only in window | `reschedule_appointment` returns `fee` only when policy window matched |
| Same-day local date correct | All date math in `Asia/Kolkata`; never naive UTC |
| Currency consistent | INR (₹) sourced from clinic locale |
| No language drift in single-language turn | Prompt rule + provider choice |
| Natural bidirectional code-switch | LLM-driven, TTS multilingual |
| Never re-ask answered question | `context_json` tracks what's known; prompt reads state before asking |
| Latency masked during tool calls | Holding phrases (§8), no stutter/filler |
| ALL-CAPS names pronounced naturally | Title-case normalization for speech |
| Interruption / barge-in | Bolna barge-in enabled; state kept server-side so mid-sentence cut-in doesn't lose place |
| Bot-or-human / ask for human | Prompt: answer honestly, offer callback; `log_followup` |
| Clinical concern / out-of-scope | `log_followup` + set "someone will call back" expectation, no fake live transfer |

---

## 8. Latency strategy (and what we report)

- **Mask tool-call latency** with a natural holding phrase ("Let me check that for you…") emitted
  *before* the tool call so there's no dead air or stutter.
- Keep tool responses **small** (ranked top-N slots, not raw dumps) → less LLM/TTS time.
- Backend availability query indexed and O(slots), fast enough to stay under a conversational beat.
- **Report** (from Bolna per-call analytics): ASR, LLM, TTS, network components, per language.

---

## 9. Eval harness

Two layers, both **re-runnable from a clean clone**:

**A. Logic/tool layer (deterministic, offline, hits real DB):**
- Factor the agent's brain (system prompt + tool schema + tool-calling loop) so the harness can run
  the **exact same prompt + tools** via the LLM API against the **real backend + Postgres**, driven
  by scripted multi-turn conversations — English scripts and Hindi scripts run separately.
- **Metrics, reported per language (not blended):**
  - correctness per scenario (right slot / right branch / no double-book),
  - **turns-to-completion** to a confirmed booking,
  - **redundant-question rate** (did it re-ask something already provided),
  - tool-call correctness (right tool, right args, live re-check happened).

**B. Voice layer (live calls):**
- Latency component breakdown (ASR/LLM/TTS/network) pulled from Bolna execution telemetry, per language.

**Documented honestly (where the harness gives false confidence):**
- Layer A uses **text, not audio** → it does **not** test ASR errors on Hinglish, barge-in timing,
  TTS pronunciation of ALL-CAPS names, or real network jitter. Those only surface on Layer B live
  calls. The harness proves the *logic and state machine*; it does **not** prove the *voice experience*.

---

## 10. Cliniko PMS write-back — defined behavior

The PMS write-back target is the **real Cliniko API** (not a mock) — the assignment allows this
("You can use Cliniko PMS"). Cliniko is `POST /appointments` (patient_id, practitioner_id,
business_id, appointment_type_id, starts_at, ends_at).

- On confirmed booking: **Supabase write is authoritative** (with the overlap EXCLUDE constraint).
  Then enqueue a sync row in `pms_outbox` with an **idempotency key** (= our `appointment_id`) and
  POST to Cliniko.
- **Idempotency:** we never POST the same `appointment_id` twice; the outbox row is the guard, and a
  successful Cliniko write records the returned `cliniko_appointment_id` back onto our appointment.
  Replays are no-ops.
- **On Cliniko failure (network / 5xx / 422):** booking stays confirmed to the caller;
  `pms_sync_state=pending`; a background worker retries with backoff draining `pms_outbox`.
  Reconciliation is possible because Supabase is the source of truth. A Cliniko **422 conflict** is
  treated as a real conflict signal (rare, since our EXCLUDE constraint already prevented overlaps) →
  flag for human review via `followups`.
  (Alternative stricter mode — don't confirm to caller until Cliniko acks — is a documented toggle;
  default is confirm-then-sync so a Cliniko outage never blocks a patient.)
- A **`PMS_FAIL_MODE` env flag** forces the failure path so the eval harness can exercise it
  deterministically without breaking real Cliniko.
- **Cliniko one-time setup:** practitioner working hours must be set in the Cliniko UI once so
  `POST /appointments` accepts our slots (and, if we ever fall back to Cliniko availability, so
  `available_times` works). Documented as the single manual step in the README.

---

## 11. Implementation roadmap (phased)

**Progress:** ✅ done · 🔨 in progress · ⬜ todo
- ✅ **Cliniko seed** — 2 branches + appt types + doctor mapping created & idempotent (`seed/`).
- ✅ **Supabase schema** — 11 tables, `no_double_booking` EXCLUDE constraint, RLS; validated (`db/migrations/`).
- ✅ **Clinic mirror** — branches/doctors/appt-types/schedules seeded to Supabase (`db/seed_supabase.py`).
- ✅ **Availability engine** — tz/buffer/cross-branch/earliest, live-subtraction validated (`app/availability.py`).
- ✅ **Tool webhook API** — 7 tools, all validated: name-required, idempotency, conflict, fee-window, resume (`app/main.py`, `app/tools.py`).
- ✅ **Cliniko write-back** — outbox → Cliniko round-trip validated (create/patient sync, failure path, retry) (`app/pms_writeback.py`, `app/cliniko.py`).
- ✅ **End-of-call webhook + state retention** — drop→interrupted→resume, missed-outbound→callback, complete→clear (`/webhooks/bolna_call_end`).
- ✅ **Bolna agent pack** — bilingual system prompt, 7 tool defs, setup guide (`bolna/`).
- ✅ **Eval harness** — scripted multi-turn EN/Hindi/Hinglish, per-language metrics; 6/6 pass (`eval/`).
- ✅ **Outbound retry/continue orchestration** — not-connected→retry, dropped→continue, give-up→callback_pending (`app/outbound.py`, worker).
- ✅ **React ops dashboard** (reverted to the polished UI, adapted to clinic) — Overview, **Inbound Calls** (list + transcript viewer + schedule-callback action), Appointments, Patients, Outbound Calls, Follow-ups (with resolve action), Call Sessions, Clinic Setup. Served by FastAPI at `/`; one-command launch via `python run.py`.
- ⬜ Deploy (ngrok/host) · Bolna dashboard config + phone · patients seed.

**Backend + agent + eval + dashboard complete.** Remaining: deploy, Bolna wiring, optional patients seed.



1. **Datastore + Cliniko seed** — Supabase schema + `btree_gist` EXCLUDE constraint (SQL migration); a
   `seed_cliniko.py` that creates the 2 branches (businesses), doctors (practitioners), appointment
   types, and patients **in Cliniko via API**, then mirrors their ids + working hours into Supabase.
   One-time Cliniko UI step: set practitioner working hours.
2. **Availability engine** — derived-slot query (tz-aware, buffer-aware, cross-branch/earliest).
3. **Tool webhooks** — the 7 tools in §5 as FastAPI routes; strong Pydantic schemas; idempotent booking with conflict handling.
4. **Mock PMS write-back** — Cliniko-style endpoints, idempotency, failure switch, `pms_outbox` retry worker.
5. **Call-session state** — `save_session_state` + `identify_caller` recovery logic (drop/callback/returning/family-line).
6. **Bolna agent** — inbound agent config, STT/TTS/LLM providers, bilingual prompt, tool bindings, holding phrases, barge-in; attach phone number.
7. **End-of-call webhook** — persist transcript + finalize session state.
8. **Eval harness** — Layer A scripted multi-turn (EN + HI) + metrics; Layer B latency pull.
9. **Deploy live** — hosted backend + DB + phone number; verify each scenario on the real number.
10. **README + write-up** — stack justification, latency numbers, multilingual approach, known limitations; prompt + prompt logic.

---

## 12. Known limitations to state up front (graded honesty)

- STT/TTS provider is the real bottleneck for Hinglish quality; we ship the A/B winner and name the loser.
- Offline harness can't validate the voice experience (§9).
- Real-clinic data is sourced from public info and may not match the clinic's actual live schedule.
- No auth on tool webhooks beyond a shared secret (scoped for assignment).
</content>
</invoke>
