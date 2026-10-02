-- welcome notification for newly created accounts (visible to that user only)
alter table public.notifications add column if not exists user_id uuid references public.profiles(id) on delete cascade;

drop policy if exists notifs_select on public.notifications;
create policy notifs_select on public.notifications for select to authenticated
  using (
    public.same_clinic(clinic_id)
    and (
      target_role = 'all'
      or target_role = public.current_role_name()
      or public.is_admin()
      or user_id = auth.uid()
    )
  );

-- account creation now greets the new user
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
  insert into public.notifications (clinic_id, target_role, user_id, title, body, type)
  values (
    p_clinic_id,
    p_role,
    new_id,
    'مرحبًا بك في نظام إدارة العيادة 👋',
    'تم إنشاء حسابك بنجاح' ||
      case when p_role = 'doctor' and coalesce(p_specialty_key, 'general') = 'dentistry'
        then ' — مخطط الأسنان متاح لك داخل شاشة الكشف.' else '.' end ||
      ' نتمنى لك تجربة موفقة، ولأي استفسار تواصل مع إدارة النظام.',
    'info'
  );
  return new_id;
end $$;
