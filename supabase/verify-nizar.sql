-- temp verification: test visit in نزار's clinic + temporarily point the owner at it
with c as (select id from public.clinics where name = 'عيادة د. نزار عبد الستار الشيخ'),
p as (
  insert into public.patients (clinic_id, full_name, phone, gender)
  select c.id, 'مريض تجريبي نزار', '0997777666', 'male' from c returning id
),
a as (
  insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status)
  select c.id, p.id, current_date, '12:00', '12:10', 'arrived' from c, p returning id, patient_id
)
insert into public.visits (clinic_id, patient_id, appointment_id, visit_date, chief_complaint, diagnosis, treatment_plan, medical_notes)
select c.id, a.patient_id, a.id, current_date,
  'ألم أسفل الظهر مع تنميل بالطرف السفلي', 'انزلاق غضروفي قطني L4-L5',
  'راحة نسبية + أدوية مسكنة + جلسات علاج طبيعي', 'يُنصح بتصوير رنين مغناطيسي بعد أسبوعين إذا استمرت الأعراض'
from c, p, a
returning id;

update public.profiles set clinic_id = (select id from public.clinics where name = 'عيادة د. نزار عبد الستار الشيخ')
  where id = 'c2a1bf00-efb1-4be3-86f8-5ca2d4c740cb';
