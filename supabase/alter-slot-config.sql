alter table public.clinic_settings
  add column if not exists slot_minutes int not null default 10,
  add column if not exists slots_before_break int not null default 8,
  add column if not exists break_minutes int not null default 10;
