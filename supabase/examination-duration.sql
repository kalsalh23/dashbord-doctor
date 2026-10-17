-- Add examination/consultation duration field to clinic_settings
alter table public.clinic_settings
  add column if not exists examination_minutes int not null default 15
  check (examination_minutes between 10 and 60);

alter table public.clinic_settings
  add column if not exists consultation_minutes int not null default 15
  check (consultation_minutes between 10 and 60);

-- Also ensure slot_minutes is properly constrained
alter table public.clinic_settings
  drop constraint if exists clinic_settings_slot_minutes_check;
alter table public.clinic_settings
  add constraint clinic_settings_slot_minutes_check
  check (slot_minutes between 10 and 60);

