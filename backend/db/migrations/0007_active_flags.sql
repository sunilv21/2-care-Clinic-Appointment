-- 0007_active_flags.sql — soft-active flags so the Cliniko reconcile worker can disable
-- branches/practitioners that were archived or removed in Cliniko, without deleting rows that
-- historical appointments still reference.
alter table branches       add column if not exists active boolean not null default true;
alter table practitioners  add column if not exists active boolean not null default true;
