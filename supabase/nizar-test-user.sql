-- حساب اختبار طبيب في عيادة د. نزار (للتحقق من ورقة المعاينة)
delete from public.profiles where id in (select id from auth.users where email = 'nizar-test@noor-clinic.com');
delete from auth.identities where user_id in (select id from auth.users where email = 'nizar-test@noor-clinic.com');
delete from auth.users where email = 'nizar-test@noor-clinic.com';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'nizar-test@noor-clinic.com', crypt('NizarTest2026#', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'د. اختبار نزار', 'role', 'doctor'),
  now(), now());

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  now(), now(), now()
from auth.users u where u.email = 'nizar-test@noor-clinic.com';

update public.profiles
set clinic_id = (select id from public.clinics where name like '%نزار%'), full_name = 'د. اختبار نزار',
    role = 'doctor', specialty_key = 'general'
where id in (select id from auth.users where email = 'nizar-test@noor-clinic.com');

update auth.users set confirmation_token='', recovery_token='', email_change_token_new='',
  email_change='', email_change_token_current='', reauthentication_token='', phone_change=''
where email = 'nizar-test@noor-clinic.com';
