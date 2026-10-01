-- doctor's frequently prescribed medications for one-tap entry during consultations
create table if not exists public.doctor_favorite_medications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  dosage text,
  duration text,
  instructions text,
  created_at timestamptz not null default now()
);
create index if not exists fav_meds_doctor_idx on public.doctor_favorite_medications (doctor_id, created_at desc);

alter table public.doctor_favorite_medications enable row level security;

create policy fav_meds_select on public.doctor_favorite_medications for select to authenticated
  using (public.same_clinic(clinic_id));
create policy fav_meds_write on public.doctor_favorite_medications for all to authenticated
  using ((doctor_id = auth.uid() or public.is_admin()) and public.same_clinic(clinic_id))
  with check ((doctor_id = auth.uid() or public.is_admin()) and public.same_clinic(clinic_id));
