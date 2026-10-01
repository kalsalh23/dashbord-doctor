-- ============================================================
-- Clinic management system — schema (multi-tenant, clinic_id)
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- clinics ----------
create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  phone text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- profiles ----------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_id uuid references public.clinics(id) on delete set null,
  full_name text not null default '',
  role text not null default 'reception' check (role in ('reception','doctor','admin')),
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_clinic_idx on public.profiles (clinic_id);

-- ---------- clinic_settings ----------
create table public.clinic_settings (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null unique references public.clinics(id) on delete cascade,
  doctor_name text,
  consultation_price numeric(12,2) not null default 0,
  currency text not null default 'ر.س',
  reminder_template text not null default 'مرحبًا {patient}،
نذكركم بأن لديكم موعدًا مع {doctor} {when} الساعة {time}.
نتمنى لكم السلامة.',
  whatsapp_country_code text not null default '963',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- doctor_schedules ----------
create table public.doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0=Sunday .. 6=Saturday (JS getDay)
  start_time time not null default '17:00',
  end_time time not null default '21:00',
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id, doctor_id, weekday)
);
create unique index doctor_schedules_clinic_default_uniq
  on public.doctor_schedules (clinic_id, coalesce(doctor_id, '00000000-0000-0000-0000-000000000000'::uuid), weekday);

-- ---------- patients ----------
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  full_name text not null,
  phone text not null,
  date_of_birth date,
  gender text check (gender in ('male','female')),
  address text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index patients_clinic_phone_idx on public.patients (clinic_id, phone);
create index patients_clinic_name_idx on public.patients (clinic_id, full_name);

-- ---------- medical_information ----------
create table public.medical_information (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null unique references public.patients(id) on delete cascade,
  chronic_diseases text,
  allergies text,
  current_medications text,
  previous_surgeries text,
  important_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- appointments ----------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete set null,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'confirmed' check (status in (
    'new','confirmed','arrived','waiting','in_consultation','completed','cancelled','no_show')),
  price numeric(12,2),
  reminder_sent_at timestamptz,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_clinic_date_idx on public.appointments (clinic_id, appointment_date);
create index appointments_patient_idx on public.appointments (patient_id, appointment_date desc);
-- one active appointment per slot
create unique index appointments_slot_uniq on public.appointments (clinic_id, appointment_date, start_time)
  where status not in ('cancelled','no_show');

-- ---------- visits ----------
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  doctor_id uuid references public.profiles(id) on delete set null,
  visit_date date not null default current_date,
  chief_complaint text,
  symptoms text,
  physical_examination text,
  diagnosis text,
  treatment_plan text,
  medical_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index visits_patient_idx on public.visits (patient_id, visit_date desc);

-- ---------- medications ----------
create table public.medications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  visit_id uuid not null references public.visits(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null,
  dosage text,
  duration text,
  instructions text,
  created_at timestamptz not null default now()
);
create index medications_visit_idx on public.medications (visit_id);

-- ---------- attachments ----------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  visit_id uuid references public.visits(id) on delete set null,
  name text not null,
  category text not null default 'document' check (category in ('lab','imaging','document','other')),
  file_type text,
  file_size bigint,
  storage_path text not null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index attachments_patient_idx on public.attachments (patient_id, created_at desc);

-- ---------- payments ----------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  total_amount numeric(12,2) not null default 0,
  amount numeric(12,2) not null default 0,
  remaining numeric(12,2) not null default 0,
  method text not null default 'cash' check (method in ('cash','card','transfer','other')),
  status text not null default 'paid' check (status in ('paid','due_later')),
  paid_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_clinic_created_idx on public.payments (clinic_id, created_at desc);

-- ---------- follow_up_requests ----------
create table public.follow_up_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  doctor_id uuid references public.profiles(id) on delete set null,
  visit_id uuid references public.visits(id) on delete set null,
  interval_days int not null check (interval_days between 1 and 365),
  suggested_date date not null,
  status text not null default 'pending' check (status in ('pending','scheduled','completed','cancelled')),
  appointment_id uuid references public.appointments(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index follow_ups_clinic_status_idx on public.follow_up_requests (clinic_id, status);

-- ---------- notifications ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  target_role text not null default 'all' check (target_role in ('reception','doctor','admin','all')),
  title text not null,
  body text,
  type text not null default 'info' check (type in ('info','follow_up','transfer','booking','cancellation','reminder')),
  link text,
  is_read boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index notifications_clinic_idx on public.notifications (clinic_id, created_at desc);

-- ---------- audit_logs ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

-- ---------- helper functions ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.current_clinic_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select clinic_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_role_name()
returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

-- is the caller an active staff member of the given clinic?
create or replace function public.same_clinic(cid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and clinic_id = cid and is_active = true
  )
$$;

create or replace function public.has_role(r text)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = r and is_active = true
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role('admin')
$$;



-- ---------- updated_at triggers ----------
do $$
declare t text;
begin
  foreach t in array array['clinics','profiles','clinic_settings','doctor_schedules','patients',
    'medical_information','appointments','visits','payments','follow_up_requests']
  loop
    execute format('create trigger set_updated_at_%s before update on public.%I
      for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- new auth user -> profile ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'reception')
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- RLS ----------
alter table public.clinics enable row level security;
alter table public.profiles enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.doctor_schedules enable row level security;
alter table public.patients enable row level security;
alter table public.medical_information enable row level security;
alter table public.appointments enable row level security;
alter table public.visits enable row level security;
alter table public.medications enable row level security;
alter table public.attachments enable row level security;
alter table public.payments enable row level security;
alter table public.follow_up_requests enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- clinics
create policy clinics_select on public.clinics for select to authenticated
  using (public.same_clinic(id));
create policy clinics_insert on public.clinics for insert to authenticated
  with check (public.is_admin());
create policy clinics_update on public.clinics for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.same_clinic(clinic_id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- clinic_settings
create policy settings_select on public.clinic_settings for select to authenticated
  using (public.same_clinic(clinic_id));
create policy settings_write on public.clinic_settings for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and public.same_clinic(clinic_id));

-- doctor_schedules
create policy schedules_select on public.doctor_schedules for select to authenticated
  using (public.same_clinic(clinic_id));
create policy schedules_write on public.doctor_schedules for all to authenticated
  using (public.is_admin()) with check (public.is_admin() and public.same_clinic(clinic_id));

-- patients
create policy patients_select on public.patients for select to authenticated
  using (public.same_clinic(clinic_id));
create policy patients_insert on public.patients for insert to authenticated
  with check (public.same_clinic(clinic_id));
create policy patients_update on public.patients for update to authenticated
  using (public.same_clinic(clinic_id)) with check (public.same_clinic(clinic_id));
create policy patients_delete on public.patients for delete to authenticated
  using (public.is_admin());

-- medical_information
create policy medinfo_select on public.medical_information for select to authenticated
  using (public.same_clinic(clinic_id));
create policy medinfo_write on public.medical_information for all to authenticated
  using (public.has_role('doctor') or public.is_admin())
  with check ((public.has_role('doctor') or public.is_admin()) and public.same_clinic(clinic_id));

-- appointments
create policy appts_select on public.appointments for select to authenticated
  using (public.same_clinic(clinic_id));
create policy appts_insert on public.appointments for insert to authenticated
  with check (public.same_clinic(clinic_id));
create policy appts_update on public.appointments for update to authenticated
  using (public.same_clinic(clinic_id)) with check (public.same_clinic(clinic_id));
create policy appts_delete on public.appointments for delete to authenticated
  using (public.is_admin());

-- visits
create policy visits_select on public.visits for select to authenticated
  using (public.same_clinic(clinic_id));
create policy visits_write on public.visits for all to authenticated
  using (public.has_role('doctor') or public.is_admin())
  with check ((public.has_role('doctor') or public.is_admin()) and public.same_clinic(clinic_id));

-- medications
create policy meds_select on public.medications for select to authenticated
  using (public.same_clinic(clinic_id));
create policy meds_write on public.medications for all to authenticated
  using (public.has_role('doctor') or public.is_admin())
  with check ((public.has_role('doctor') or public.is_admin()) and public.same_clinic(clinic_id));

-- attachments
create policy attach_select on public.attachments for select to authenticated
  using (public.same_clinic(clinic_id));
create policy attach_insert on public.attachments for insert to authenticated
  with check (public.same_clinic(clinic_id));
create policy attach_delete on public.attachments for delete to authenticated
  using (public.is_admin() or uploaded_by = auth.uid());

-- payments
create policy payments_select on public.payments for select to authenticated
  using (public.same_clinic(clinic_id));
create policy payments_insert on public.payments for insert to authenticated
  with check ((public.has_role('reception') or public.is_admin()) and public.same_clinic(clinic_id));
create policy payments_update on public.payments for update to authenticated
  using ((public.has_role('reception') or public.is_admin()) and public.same_clinic(clinic_id))
  with check ((public.has_role('reception') or public.is_admin()) and public.same_clinic(clinic_id));

-- follow_up_requests
create policy fups_select on public.follow_up_requests for select to authenticated
  using (public.same_clinic(clinic_id));
create policy fups_insert on public.follow_up_requests for insert to authenticated
  with check (public.same_clinic(clinic_id));
create policy fups_update on public.follow_up_requests for update to authenticated
  using (public.same_clinic(clinic_id)) with check (public.same_clinic(clinic_id));

-- notifications
create policy notifs_select on public.notifications for select to authenticated
  using (
    public.same_clinic(clinic_id)
    and (target_role = 'all' or target_role = public.current_role_name())
  );
create policy notifs_insert on public.notifications for insert to authenticated
  with check (public.same_clinic(clinic_id));
create policy notifs_update on public.notifications for update to authenticated
  using (public.same_clinic(clinic_id)) with check (public.same_clinic(clinic_id));

-- audit_logs
create policy audit_insert on public.audit_logs for insert to authenticated
  with check (public.same_clinic(clinic_id));
create policy audit_select on public.audit_logs for select to authenticated
  using (public.is_admin());

-- ---------- storage bucket ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('patient-attachments', 'patient-attachments', false, 26214400)
on conflict (id) do nothing;

create policy storage_attach_read on storage.objects for select to authenticated
  using (bucket_id = 'patient-attachments' and (storage.foldername(name))[1] = public.current_clinic_id()::text);
create policy storage_attach_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'patient-attachments' and (storage.foldername(name))[1] = public.current_clinic_id()::text);
create policy storage_attach_delete on storage.objects for delete to authenticated
  using (bucket_id = 'patient-attachments' and public.is_admin());
