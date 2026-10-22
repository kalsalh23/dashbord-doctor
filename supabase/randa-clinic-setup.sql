-- ============================================================
-- عيادة الدكتورة رندة مصطفى الشيخ علي — اختصاص الغدد والسكري
--   - إنشاء العيادة (إن لم تكن موجودة) + إعدادتها + أيام الدوام
--   - سعر الكشفية: 0 (تُحدّد من قبل الطبيبة)، مدة الفحص 15 دقيقة، عملة ر.س
--   - أيام الدوام: السبت–الخميس دوام 17:00–21:00، الجمعة عطلة
--     ( نفس افتراض باقي العيادات — تُبنى منها الحجزات )
-- ============================================================
do $$
declare
  v_clinic_id uuid = 'a3f8c210-4b67-4e9a-b3d1-5c7e9f2a8b14';
begin
  insert into public.clinics (id, name, specialty, specialty_key, is_active)
  values (v_clinic_id, 'عيادة الدكتورة رندة مصطفى الشيخ علي', 'غدد وسكري', 'endocrine', true)
  on conflict (id) do update set
    name = excluded.name,
    specialty = excluded.specialty,
    specialty_key = excluded.specialty_key,
    is_active = excluded.is_active;
end $$;

insert into public.clinic_settings (clinic_id, doctor_name, consultation_price, currency, whatsapp_country_code, slot_minutes, slots_before_break, break_minutes)
values (
  'a3f8c210-4b67-4e9a-b3d1-5c7e9f2a8b14',
  'د. رندة مصطفى الشيخ علي',
  0,
  'ر.س',
  '963',
  15,
  8,
  0
)
on conflict (clinic_id) do update set
  doctor_name = excluded.doctor_name,
  slot_minutes = excluded.slot_minutes,
  slots_before_break = excluded.slots_before_break,
  break_minutes = excluded.break_minutes;

-- أيام الدوام: السبت–الخميس دوام 17:00–21:00، الجمعة عطلة
insert into public.doctor_schedules (clinic_id, weekday, start_time, end_time, is_active)
select 'a3f8c210-4b67-4e9a-b3d1-5c7e9f2a8b14', w.d, '17:00'::time, '21:00'::time, w.active
from (values (0,true),(1,true),(2,true),(3,true),(4,true),(5,false),(6,true)) as w(d, active)
where not exists (
  select 1 from public.doctor_schedules s where s.clinic_id = 'a3f8c210-4b67-4e9a-b3d1-5c7e9f2a8b14'
);

select cs.clinic_id, cs.doctor_name, cs.slot_minutes, cs.slots_before_break, cs.break_minutes,
  (select count(*) from public.doctor_schedules d where d.clinic_id = cs.clinic_id) as schedule_days
from public.clinic_settings cs where cs.clinic_id = 'a3f8c210-4b67-4e9a-b3d1-5c7e9f2a8b14';