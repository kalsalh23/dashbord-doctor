-- FIX: auth.identities convention is provider_id = user_id (not 'email').
-- The old hardcoded provider_id='email' collided with the UNIQUE (provider_id, provider)
-- constraint on the second created user, surfacing as a confusing duplicate-key error.
create or replace function public.super_create_user(
  p_email text, p_password text, p_full_name text,
  p_role text, p_clinic_id uuid, p_phone text default null
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
      jsonb_build_object('full_name', p_full_name, 'role', p_role),
      now(), now(), '', '', '', '', '');
  exception when unique_violation then
    raise exception 'EMAIL_EXISTS';
  end;
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), new_id, new_id::text, 'email',
    jsonb_build_object('sub', new_id::text, 'email', lower(trim(p_email)), 'email_verified', true, 'phone_verified', false),
    now(), now(), now());
  update public.profiles
    set full_name = p_full_name, role = p_role, clinic_id = p_clinic_id, phone = p_phone
    where id = new_id;
  return new_id;
end $$;
