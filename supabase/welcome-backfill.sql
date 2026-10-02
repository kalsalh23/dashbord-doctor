-- backfill welcome for the existing dentist
insert into public.notifications (clinic_id, target_role, user_id, title, body, type)
select clinic_id, 'doctor', id,
  'مرحبًا بك في نظام إدارة العيادة 👋',
  'تم إنشاء حسابك بنجاح — مخطط الأسنان متاح لك داخل شاشة الكشف. نتمنى لك تجربة موفقة، ولأي استفسار تواصل مع إدارة النظام.',
  'info'
from public.profiles
where email in (select u.email from auth.users u where u.email = 'fares.dentist@noor-clinic.com')
  and not exists (select 1 from public.notifications n where n.user_id = profiles.id and n.title like 'مرحبًا%');

-- remove the welcome-test account
delete from auth.identities where user_id = (select id from auth.users where email = 'welcome-test@noor-clinic.com');
delete from auth.users where email = 'welcome-test@noor-clinic.com';
delete from public.notifications where user_id = '4968e595-bcc2-444b-8669-e99440b390e3';
delete from public.profiles where full_name = 'د. ترحيب';

select 'done' as status;
