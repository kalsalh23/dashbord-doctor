-- seed two test appointments today for the emergency broadcast verification
with c as (select id from public.clinics where name = 'عيادة د. قصي الصالح')
insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status, price)
select c.id, p.id, current_date, t.st::time, (t.st::time + interval '10 minutes'), 'confirmed', 150000
from c
cross join (values ('18:00'::text), ('18:20'::text)) as t(st)
join public.patients p on p.full_name in ('محمد أحمد', 'سارة خالد')
  and (p.full_name, t.st) in (('محمد أحمد', '18:00'), ('سارة خالد', '18:20'))
returning id, patient_id;
