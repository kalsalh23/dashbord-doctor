-- إعادة إنشاء حساب اختبار ENT نظيفاً (الحذف: الملف ثم الهوية ثم المستخدم)
delete from public.profiles where id in (select id from auth.users where email = 'ent-test@noor-clinic.com');
delete from auth.identities where user_id in (select id from auth.users where email = 'ent-test@noor-clinic.com');
delete from auth.users where email = 'ent-test@noor-clinic.com';

insert into auth.users (instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
  'ent-test@noor-clinic.com', crypt('EntTest2026#', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', 'د. اختبار ENT', 'role', 'doctor'),
  now(), now());

insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true, 'phone_verified', false),
  now(), now(), now()
from auth.users u where u.email = 'ent-test@noor-clinic.com';

-- المشغّل on_auth_user_created أنشأ الملف تلقائياً — نحدّثه فقط
update public.profiles
set clinic_id = 'dd1c94e0-cded-4a27-9c52-4cc9c25d36f0', full_name = 'د. اختبار ENT',
    role = 'doctor', phone = '0990000001', specialty_key = 'ent'
where id in (select id from auth.users where email = 'ent-test@noor-clinic.com');

-- أعمدة التوكنات يجب أن تكون نصاً فارغاً وليست NULL وإلا فشل تسجيل الدخول (خطأ GoTrue)
update auth.users set confirmation_token='', recovery_token='', email_change_token_new='',
  email_change='', email_change_token_current='', reauthentication_token='', phone_change=''
where email = 'ent-test@noor-clinic.com';
