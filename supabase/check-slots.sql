select a.start_time, p.full_name
from public.appointments a
left join public.patients p on p.id = a.patient_id
where a.clinic_id in (select id from public.clinics where name in ('عيادة فاطمة سالم الجاموس','عيادة حازم محمد الشيخ'))
  and a.appointment_date = current_date and a.status not in ('cancelled','no_show')
order by a.clinic_id, a.start_time;
