-- 0002_rls.sql — Lock down every table.
-- This datastore is server-only: the FastAPI backend connects with the service role (or a direct
-- Postgres role), which BYPASSES RLS. Enabling RLS with NO policies denies all access to the
-- anon/authenticated roles, so nothing here is reachable through the Supabase Data API.
-- (If a table ever needs client access, add explicit policies then — never open by default.)

alter table branches                      enable row level security;
alter table appointment_types             enable row level security;
alter table practitioners                 enable row level security;
alter table practitioner_appointment_types enable row level security;
alter table practitioner_schedules        enable row level security;
alter table patients                      enable row level security;
alter table patient_phones                enable row level security;
alter table appointments                  enable row level security;
alter table call_sessions                 enable row level security;
alter table followups                     enable row level security;
alter table pms_outbox                    enable row level security;
