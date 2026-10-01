-- cleanup probe
delete from auth.identities where user_id = '035cb660-c9d0-489e-957f-7784dbee68f7';
delete from auth.users where id = '035cb660-c9d0-489e-957f-7784dbee68f7';
delete from public.profiles where id = '035cb660-c9d0-489e-957f-7784dbee68f7';

-- 1) allow super_admin role
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('reception','doctor','admin','super_admin'));

-- 2) helpers
create or replace function public.is_super()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin' and is_active = true
  )
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active = true and role in ('admin','super_admin')
  )
$$;

-- 3) super policies
drop policy if exists clinics_select_super on public.clinics;
create policy clinics_select_super on public.clinics for select to authenticated
  using (public.is_super());

drop policy if exists clinics_update_super on public.clinics;
create policy clinics_update_super on public.clinics for update to authenticated
  using (public.is_super()) with check (public.is_super());

drop policy if exists profiles_select_super on public.profiles;
create policy profiles_select_super on public.profiles for select to authenticated
  using (public.is_super());

drop policy if exists settings_select_super on public.clinic_settings;
create policy settings_select_super on public.clinic_settings for select to authenticated
  using (public.is_super());

drop policy if exists schedules_select_super on public.doctor_schedules;
create policy schedules_select_super on public.doctor_schedules for select to authenticated
  using (public.is_super());

-- 4) RPCs -----------------------------------------------------------------

-- create a clinic with default settings and a full working week
create or replace function public.super_create_clinic(
  p_name text, p_specialty text default null, p_phone text default null,
  p_address text default null, p_consultation_price numeric default 0,
  p_doctor_name text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_super() then raise exception 'FORBIDDEN'; end if;
  insert into public.clinics (name, specialty, phone, address)
  values (p_name, p_specialty, p_phone, p_address) returning id into new_id;
  insert into public.clinic_settings (clinic_id, doctor_name, consultation_price)
  values (new_id, p_doctor_name, p_consultation_price);
  insert into public.doctor_schedules (clinic_id, weekday, start_time, end_time, is_active)
  select new_id, w.d, '17:00'::time, '21:00'::time, w.active
  from (values (0,true),(1,true),(2,true),(3,true),(4,true),(5,false),(6,true)) as w(d, active);
  return new_id;
end $$;

-- create a staff user (doctor / reception / clinic admin) with a password
create or replace function public.super_create_user(
  p_email text, p_password text, p_full_name text,
  p_role text, p_clinic_id uuid, p_phone text default null
)
returns uuid
language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_super() then raise exception 'FORBIDDEN'; end if;
  if p_role not in ('doctor','reception','admin') then raise exception 'BAD_ROLE'; end if;
  if p_password is null or length(p_password) < 6 then raise exception 'WEAK_PASSWORD'; end if;
  new_id := gen_random_uuid();
  begin
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new, phone_change_token)
    values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
      lower(trim(p_email)), crypt(p_password, gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', p_role),
      now(), now(), '', '', '', '', '');
  exception when unique_violation then
    raise exception 'EMAIL_EXISTS';
  end;
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, 'email', 'email',
    jsonb_build_object('sub', new_id::text, 'email', lower(trim(p_email)), 'email_verified', true),
    now(), now(), now());
  update public.profiles
    set full_name = p_full_name, role = p_role, clinic_id = p_clinic_id, phone = p_phone
    where id = new_id;
  return new_id;
end $$;

-- reset a user's password
create or replace function public.super_reset_password(p_user_id uuid, p_new_password text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super() then raise exception 'FORBIDDEN'; end if;
  if p_new_password is null or length(p_new_password) < 6 then raise exception 'WEAK_PASSWORD'; end if;
  update auth.users set encrypted_password = crypt(p_new_password, gen_salt('bf')), updated_at = now()
    where id = p_user_id;
end $$;

-- list clinic staff with emails (auth schema is not exposed to PostgREST)
create or replace function public.super_list_users(p_clinic_id uuid)
returns table (id uuid, email text, full_name text, role text, phone text, is_active boolean)
language sql security definer set search_path = public as $$
  select pr.id, u.email, pr.full_name, pr.role, pr.phone, pr.is_active
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where pr.clinic_id = p_clinic_id
  order by pr.role, pr.full_name
$$;

-- per-clinic quick stats for the super panel
create or replace function public.super_clinic_stats()
returns table (clinic_id uuid, patients bigint, appointments_today bigint, pending_followups bigint)
language sql security definer set search_path = public as $$
  select c.id,
    (select count(*) from public.patients p where p.clinic_id = c.id),
    (select count(*) from public.appointments a where a.clinic_id = c.id and a.appointment_date = current_date and a.status not in ('cancelled','no_show')),
    (select count(*) from public.follow_up_requests f where f.clinic_id = c.id and f.status = 'pending')
  from public.clinics c
$$;

grant execute on function public.super_create_clinic(text,text,text,text,numeric,text) to authenticated;
grant execute on function public.super_create_user(text,text,text,text,uuid,text) to authenticated;
grant execute on function public.super_reset_password(uuid,text) to authenticated;
grant execute on function public.super_list_users(uuid) to authenticated;
grant execute on function public.super_clinic_stats() to authenticated;

-- 5) promote the owner account to super admin (keeps clinic membership)
update public.profiles set role = 'super_admin'
  where id = 'c2a1bf00-efb1-4be3-86f8-5ca2d4c740cb';
