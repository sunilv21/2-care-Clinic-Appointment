-- 0003_call_end.sql — persist end-of-call info on the session (transcript + terminal status).
alter table call_sessions add column if not exists transcript_json jsonb;
alter table call_sessions add column if not exists ended_status text;
alter table call_sessions add column if not exists ended_at timestamptz;
