-- 0004_outbound.sql — outbound call orchestration with retry + continuation.
-- Tracks outbound calls (reminders, callbacks, continuations of dropped calls) and their retry state.

create table if not exists outbound_calls (
  id                 uuid primary key default gen_random_uuid(),
  phone_e164         text not null,
  patient_id         uuid references patients(id),
  session_id         uuid references call_sessions(id),   -- context to resume, if any
  purpose            text not null default 'callback',    -- reminder | callback | continue | followup
  status             text not null default 'pending'
                       check (status in ('pending','calling','completed','no_answer',
                                         'failed','dropped','max_retries','cancelled')),
  attempts           int  not null default 0,
  max_attempts       int  not null default 3,
  next_attempt_at    timestamptz not null default now(),
  bolna_execution_id text,
  last_status        text,
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index if not exists idx_outbound_due on outbound_calls (status, next_attempt_at);
create index if not exists idx_outbound_phone on outbound_calls (phone_e164);

alter table outbound_calls enable row level security;
