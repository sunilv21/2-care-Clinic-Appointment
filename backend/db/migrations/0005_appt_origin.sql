-- 0005_appt_origin.sql — track whether an appointment was created by the agent or imported from a
-- booking made directly in Cliniko (e.g. by clinic staff via the Cliniko UI).
alter table appointments add column if not exists origin text not null default 'agent';
alter table appointments drop constraint if exists appointments_origin_check;
alter table appointments add constraint appointments_origin_check
  check (origin in ('agent', 'cliniko_manual'));
