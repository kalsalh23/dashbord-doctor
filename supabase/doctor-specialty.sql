-- per-DOCTOR specialty: chosen when the account is created, drives his interface
alter table public.profiles add column if not exists specialty_key text not null default 'general';

-- account creation now accepts the doctor's specialty
create or replace function public.super_create_user(
  p_email text, p_password text, p_full_name text,
  p_role text, p_clinic_id uuid, p_phone text default null,
  p_specialty_key text default 'general'
)
returns uuid
language plpgsql security definer set search_path = public, extensions as $$
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
      jsonb_build_object('full_name', p_full_name, 'role', p_role, 'specialty_key', p_specialty_key),
      now(), now(), '', '', '', '', '');
  exception when unique_violation then
    raise exception 'EMAIL_EXISTS';
  end;
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text, 'email',
    jsonb_build_object('sub', new_id::text, 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
    now(), now(), now());
  update public.profiles
    set full_name = p_full_name, role = p_role, clinic_id = p_clinic_id, phone = p_phone,
        specialty_key = coalesce(p_specialty_key, 'general')
    where id = new_id;
  return new_id;
end $$;

-- staff list now includes each doctor's specialty
drop function if exists public.super_list_users(uuid);
create function public.super_list_users(p_clinic_id uuid)
returns table (id uuid, email text, full_name text, role text, phone text, is_active boolean, specialty_key text)
language sql security definer set search_path = public as $$
  select pr.id, u.email, pr.full_name, pr.role, pr.phone, pr.is_active, pr.specialty_key
  from public.profiles pr
  join auth.users u on u.id = pr.id
  where pr.clinic_id = p_clinic_id
  order by pr.role, pr.full_name
$$;

grant execute on function public.super_create_user(text,text,text,text,uuid,text,text) to authenticated;
grant execute on function public.super_list_users(uuid) to authenticated;
