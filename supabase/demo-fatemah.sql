-- 3) demo patients + 12 appointments today for د. فاطمة's clinic
with c as (select id from public.clinics where name = 'عيادة فاطمة سالم الجاموس'),
p as (
  insert into public.patients (clinic_id, full_name, phone, gender, date_of_birth)
  select c.id, v.full_name, v.phone, v.gender, v.dob from c
  cross join (values
    ('هبة السيد', '0993001101', 'female', '1994-02-11'::date),
    ('أحمد الخطيب', '0993001102', 'male', '1988-06-03'::date),
    ('نور الهدى', '0993001103', 'female', '2000-09-17'::date),
    ('خالد العلي', '0993001104', 'male', '1979-01-25'::date),
    ('رغد الشامي', '0993001105', 'female', '1996-12-08'::date),
    ('محمد برهان', '0993001106', 'male', '1991-04-30'::date),
    ('لينا كمال', '0993001107', 'female', '1985-08-19'::date),
    ('عمر الحلبي', '0993001108', 'male', '1993-03-14'::date),
    ('سلمى نصر', '0993001109', 'female', '1999-07-07'::date),
    ('ياسر القاسم', '0993001110', 'male', '1983-11-21'::date),
    ('مازن ديب', '0993001111', 'male', '1975-05-09'::date),
    ('جنى محمود', '0993001112', 'female', '2002-10-01'::date)
  ) as v(full_name, phone, gender, dob)
  returning id, full_name
),
slots(pname, h, m) as (values
  ('هبة السيد', '17', '00'),
  ('أحمد الخطيب', '17', '10'),
  ('نور الهدى', '17', '20'),
  ('خالد العلي', '17', '30'),
  ('رغد الشامي', '17', '40'),
  ('محمد برهان', '17', '50'),
  ('لينا كمال', '18', '00'),
  ('عمر الحلبي', '18', '10'),
  ('سلمى نصر', '18', '20'),
  ('ياسر القاسم', '18', '30'),
  ('مازن ديب', '18', '40'),
  ('جنى محمود', '18', '50')
)
insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status, price)
select c.id, p.id, current_date,
       (s.h || ':' || s.m)::time, ((s.h || ':' || s.m)::time + interval '10 minutes'), 'confirmed', 150000
from slots s
join p on p.full_name = s.pname
cross join c;

-- 4) 6 appointments today for د. حازم's clinic
with c as (select id from public.clinics where name = 'عيادة حازم محمد الشيخ'),
p as (
  insert into public.patients (clinic_id, full_name, phone, gender)
  select c.id, v.full_name, v.phone, v.gender from c
  cross join (values
    ('سامر ديب', '0994002201', 'male'),
    ('هيا السيد', '0994002202', 'female'),
    ('زياد غانم', '0994002203', 'male'),
    ('ميرا الحسن', '0994002204', 'female'),
    ('وليد الأحمد', '0994002205', 'male'),
    ('دلال نصر', '0994002206', 'female')
  ) as v(full_name, phone, gender)
  returning id, full_name
),
slots2(pname, h, m) as (values
  ('سامر ديب', '17', '00'),
  ('هيا السيد', '17', '10'),
  ('زياد غانم', '17', '20'),
  ('ميرا الحسن', '17', '30'),
  ('وليد الأحمد', '17', '40'),
  ('دلال نصر', '17', '50')
)
insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status, price)
select c.id, p.id, current_date,
       (s.h || ':' || s.m)::time, ((s.h || ':' || s.m)::time + interval '10 minutes'), 'confirmed', 100000
from slots2 s
join p on p.full_name = s.pname
cross join c;
