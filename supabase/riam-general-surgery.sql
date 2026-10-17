-- تغيير اختصاص د. ريام إلى «جراحة عامة» (surgery) بدل جراحة العظام (ortho)
update public.profiles
set specialty_key = 'surgery'
where id = '059d2589-0d5b-48c0-8e1b-4b6db1b6bf2d';

select id, full_name, specialty_key, clinic_id from public.profiles
where id = '059d2589-0d5b-48c0-8e1b-4b6db1b6bf2d';
