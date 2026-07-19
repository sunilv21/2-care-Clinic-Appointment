-- 0006_updated_at.sql — track last-modified time on patients + appointments, so the Cliniko
-- reconciliation worker can do proper last-write-wins instead of blindly overwriting whichever
-- side it processes last.

alter table patients add column if not exists updated_at timestamptz not null default now();
alter table appointments add column if not exists updated_at timestamptz not null default now();

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_patients_updated_at on patients;
create trigger trg_patients_updated_at
  before update on patients
  for each row execute function set_updated_at();

drop trigger if exists trg_appointments_updated_at on appointments;
create trigger trg_appointments_updated_at
  before update on appointments
  for each row execute function set_updated_at();
