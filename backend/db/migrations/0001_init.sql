-- 0001_init.sql — Clinic receptionist datastore (Supabase Postgres / any Postgres)
-- Source of truth for scheduling. Availability is DERIVED (no static free-slot table).
-- Write-time double-booking prevention via an EXCLUDE constraint (needs btree_gist).
--
-- Weekday convention: ISO dow, 1=Mon .. 7=Sun (matches clinic.json + extract(isodow ...)).

create extension if not exists btree_gist;
create extension if not exists pgcrypto;   -- gen_random_uuid()

-- ── Reference: branches / appointment types / doctors ──────────────────────
create table if not exists branches (
  id             text primary key,               -- our key, e.g. 'indiranagar'
  name           text not null,
  address        text,
  tz             text not null default 'Asia/Kolkata',
  open_time      time not null,
  close_time     time not null,
  buffer_minutes int  not null default 0,
  cliniko_business_id text
);

create table if not exists appointment_types (
  id           text primary key,                 -- 'consult','first','followup'
  name         text not null,
  duration_min int  not null check (duration_min > 0),
  cliniko_appointment_type_id text
);

create table if not exists practitioners (
  id        text primary key,                    -- 'doc_gen'
  full_name text not null,                        -- may be ALL-CAPS in source; normalized for speech in app
  specialty text not null,
  cliniko_practitioner_id text
);

-- appointment types each doctor offers (many-to-many)
create table if not exists practitioner_appointment_types (
  practitioner_id     text not null references practitioners(id) on delete cascade,
  appointment_type_id text not null references appointment_types(id) on delete cascade,
  primary key (practitioner_id, appointment_type_id)
);

-- weekly working-hours blocks, per doctor per branch
create table if not exists practitioner_schedules (
  id              bigserial primary key,
  practitioner_id text not null references practitioners(id) on delete cascade,
  branch_id       text not null references branches(id) on delete cascade,
  weekday         int  not null check (weekday between 1 and 7),  -- ISO: 1=Mon..7=Sun
  start_time      time not null,
  end_time        time not null,
  check (end_time > start_time)
);
create index if not exists idx_sched_prac on practitioner_schedules (practitioner_id);
create index if not exists idx_sched_branch_dow on practitioner_schedules (branch_id, weekday);

-- ── Patients ───────────────────────────────────────────────────────────────
create table if not exists patients (
  id         uuid primary key default gen_random_uuid(),
  full_name  text not null,
  dob        date,
  notes      text,
  cliniko_patient_id text,
  created_at timestamptz not null default now()
);

-- MANY patients may share ONE phone (family line) -> phone is NOT unique
create table if not exists patient_phones (
  phone_e164 text not null,
  patient_id uuid not null references patients(id) on delete cascade,
  primary key (phone_e164, patient_id)
);
create index if not exists idx_patient_phones_phone on patient_phones (phone_e164);

-- ── Appointments (source of truth, write-time conflict guard) ───────────────
create table if not exists appointments (
  id                  uuid primary key default gen_random_uuid(),
  patient_id          uuid not null references patients(id),
  practitioner_id     text not null references practitioners(id),
  branch_id           text not null references branches(id),
  appointment_type_id text not null references appointment_types(id),
  start_ts            timestamptz not null,
  end_ts              timestamptz not null,
  status              text not null default 'booked'
                        check (status in ('booked','cancelled','completed')),
  created_at          timestamptz not null default now(),
  pms_sync_state      text not null default 'pending'
                        check (pms_sync_state in ('pending','synced','failed')),
  idempotency_key     text unique,
  cliniko_appointment_id text,
  check (end_ts > start_ts),
  -- A practitioner cannot hold two BOOKED appointments that overlap in time,
  -- at ANY branch (can't be in two places at once). Enforced at write time.
  constraint no_double_booking
    exclude using gist (
      practitioner_id with =,
      tstzrange(start_ts, end_ts) with &&
    ) where (status = 'booked')
);
create index if not exists idx_appt_patient on appointments (patient_id);
create index if not exists idx_appt_prac_start on appointments (practitioner_id, start_ts);
create index if not exists idx_appt_branch_start on appointments (branch_id, start_ts);

-- ── Call state (drop / callback / returning / family-line recovery) ─────────
create table if not exists call_sessions (
  id                 uuid primary key default gen_random_uuid(),
  phone_e164         text not null,
  patient_id         uuid references patients(id),
  direction          text not null default 'inbound'
                       check (direction in ('inbound','outbound')),
  state              text not null default 'active'
                       check (state in ('active','interrupted','completed','callback_pending')),
  context_json       jsonb not null default '{}',
  bolna_execution_id text,
  last_turn_at       timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_sessions_phone on call_sessions (phone_e164, updated_at desc);

-- ── Follow-ups (human handoff / clinical / out-of-scope) ────────────────────
create table if not exists followups (
  id             uuid primary key default gen_random_uuid(),
  phone_e164     text,
  patient_id     uuid references patients(id),
  reason         text not null,
  notes          text,
  transcript_ref text,
  resolved       boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ── PMS write-back outbox (idempotency + retry to Cliniko) ──────────────────
create table if not exists pms_outbox (
  id              uuid primary key default gen_random_uuid(),
  appointment_id  uuid not null references appointments(id) on delete cascade,
  idempotency_key text not null unique,
  operation       text not null default 'create'
                    check (operation in ('create','cancel','reschedule')),
  payload_json    jsonb not null,
  status          text not null default 'pending'
                    check (status in ('pending','sent','failed')),
  attempts        int  not null default 0,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_outbox_status on pms_outbox (status, updated_at);
