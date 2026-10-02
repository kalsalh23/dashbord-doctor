-- specialty-aware clinic system + dental chart (odontogram)
alter table public.clinics add column if not exists specialty_key text not null default 'general';

-- dental chart entries tied to visits
create table if not exists public.dental_chart_entries (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete cascade,
  tooth_no int not null check (tooth_no between 11 and 48),
  procedure text not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists dental_entries_patient_idx on public.dental_chart_entries (patient_id, created_at desc);
create index if not exists dental_entries_visit_idx on public.dental_chart_entries (visit_id);

alter table public.dental_chart_entries enable row level security;

create policy dental_select on public.dental_chart_entries for select to authenticated
  using (public.same_clinic(clinic_id));
create policy dental_insert on public.dental_chart_entries for insert to authenticated
  with check (public.same_clinic(clinic_id));
create policy dental_delete on public.dental_chart_entries for delete to authenticated
  using (public.same_clinic(clinic_id));

-- extended clinic creation with a specialty key
create or replace function public.super_create_clinic(
  p_name text, p_specialty text default null, p_phone text default null,
  p_address text default null, p_consultation_price numeric default 0,
  p_doctor_name text default null, p_specialty_key text default 'general'
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_super() then raise exception 'FORBIDDEN'; end if;
  insert into public.clinics (name, specialty, phone, address, specialty_key)
  values (p_name, p_specialty, p_phone, p_address, p_specialty_key) returning id into new_id;
  insert into public.clinic_settings (clinic_id, doctor_name, consultation_price)
  values (new_id, p_doctor_name, p_consultation_price);
  insert into public.doctor_schedules (clinic_id, weekday, start_time, end_time, is_active)
  select new_id, w.d, '17:00'::time, '21:00'::time, w.active
  from (values (0,true),(1,true),(2,true),(3,true),(4,true),(5,false),(6,true)) as w(d, active);
  return new_id;
end $$;

grant execute on function public.super_create_clinic(text,text,text,text,numeric,text,text) to authenticated;

-- tag the existing demo clinic as general dentistry? keep 'general' — owner can change it.
