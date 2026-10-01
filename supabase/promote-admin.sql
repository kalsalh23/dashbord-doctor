update public.profiles
set role = 'admin',
    clinic_id = (select id from public.clinics limit 1),
    full_name = 'د. قصي الصالح',
    phone = '0991234567'
where id = 'c2a1bf00-efb1-4be3-86f8-5ca2d4c740cb';

select id, full_name, role, clinic_id from public.profiles;
