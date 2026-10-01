-- clinic + settings + schedules + demo data
insert into public.clinics (name, specialty, phone, address)
values ('عيادة د. قصي الصالح', 'طب عام', '0991234567', 'دمشقة - شارع بغداد')
returning id;

insert into public.clinic_settings (clinic_id, doctor_name, consultation_price, currency, whatsapp_country_code)
select id, 'د. قصي الصالح', 150000, 'ل.س', '963' from public.clinics;

insert into public.doctor_schedules (clinic_id, weekday, start_time, end_time, is_active)
select c.id, w.d, '17:00'::time, '21:00'::time, w.active
from public.clinics c
cross join (values (0,true),(1,true),(2,true),(3,true),(4,true),(5,false),(6,true)) as w(d, active)
where not exists (select 1 from public.doctor_schedules ds where ds.clinic_id = c.id);

-- demo patients
insert into public.patients (clinic_id, full_name, phone, date_of_birth, gender, address, notes)
select c.id, v.full_name, v.phone, v.dob, v.gender, v.address, v.notes
from public.clinics c
cross join (values
  ('محمد أحمد', '0991112223', '1990-05-14'::date, 'male', 'دمشقة - المزة', null),
  ('سارة خالد', '0992223334', '1995-11-02'::date, 'female', 'دمشقة - كفرسوسة', null),
  ('رامي العلي', '0993334445', '1978-03-21'::date, 'male', 'ريف دمشق - جرمانا', 'يفضل الموعد مساءً'),
  ('لينا حسن', '0994445556', '2001-08-30'::date, 'female', 'دمشقة - البرامكة', null)
) as v(full_name, phone, dob, gender, address, notes);

-- medical info for رامي العلي (allergy demo)
insert into public.medical_information (clinic_id, patient_id, chronic_diseases, allergies, current_medications, previous_surgeries, important_notes)
select p.clinic_id, p.id, 'ارتفاع ضغط الدم', 'حساسية الأسبرين', 'أملوديبين 5 ملغ يومياً', 'استئصال الزائدة الدودية 2015', 'ينبغي توخي الحذر عند وصف مضادات الالتهاب'
from public.patients p where p.full_name = 'رامي العلي';

-- past completed appointment + visit + meds + payment (رامي العلي, 10 days ago)
with c as (select id from public.clinics limit 1),
a as (
  insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status, price)
  select c.id, p.id, current_date - 10, '17:30'::time, '17:40'::time, 'completed', 150000
  from c, public.patients p where p.full_name = 'رامي العلي'
  returning id, clinic_id, patient_id
)
insert into public.visits (clinic_id, patient_id, appointment_id, visit_date, chief_complaint, symptoms, physical_examination, diagnosis, treatment_plan, medical_notes)
select a.clinic_id, a.patient_id, a.id, current_date - 10,
  'صداع متكرر وزغللة في العين', 'صداع في مقدمة الرأس منذ أسبوعين، يزداد نهاية اليوم', 'ضغط الدم 155/95، باقي الفحص طبيعي',
  'ارتفاع ضغط الدم - المرحلة الأولى', 'خفض الضغط دوائياً مع نظام غذائي قليل الملح ومتابعة بعد أسبوعين',
  'نصح المريض بقياس الضغط منزلياً يومياً وتسجيل القراءات'
from a;

insert into public.medications (clinic_id, visit_id, patient_id, name, dosage, duration, instructions)
select v.clinic_id, v.id, v.patient_id, x.name, x.dosage, x.duration, x.instructions
from public.visits v
cross join (values
  ('أملوديبين', '5 ملغ', 'شهر واحد', 'قرص واحد صباحاً بعد الأكل'),
  ('باراسيتامول', '500 ملغ', 'عند الحاجة', 'قرص عند الصداع بحد أقصى 3 مرات يومياً')
) as x(name, dosage, duration, instructions)
where v.patient_id = (select id from public.patients where full_name = 'رامي العلي');

insert into public.payments (clinic_id, patient_id, appointment_id, total_amount, amount, remaining, method, status, paid_at)
select v.clinic_id, v.patient_id, v.appointment_id, 150000, 150000, 0, 'cash', 'paid', now() - interval '10 days'
from public.visits v where v.patient_id = (select id from public.patients where full_name = 'رامي العلي');

-- today's appointments: سارة arrived (pay later), محمد confirmed 17:30
with c as (select id from public.clinics limit 1)
insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status, price)
select c.id, p.id, current_date, t.st::time, (t.st::time + interval '10 minutes'), t.status, 150000
from c
cross join (values
  ('سارة خالد', '17:00', 'arrived'),
  ('محمد أحمد', '17:30', 'confirmed'),
  ('لينا حسن', '19:00', 'confirmed')
) as t(pname, st, status)
join public.patients p on p.full_name = t.pname;

-- payment for سارة (pay later => due)
insert into public.payments (clinic_id, patient_id, appointment_id, total_amount, amount, remaining, method, status)
select a.clinic_id, a.patient_id, a.id, 150000, 0, 150000, 'cash', 'due_later'
from public.appointments a
join public.patients p on p.id = a.patient_id
where p.full_name = 'سارة خالد' and a.appointment_date = current_date;
