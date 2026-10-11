-- عيادة الدكتورة ريام نصر عبد الرحمن: إعدادات العيادة + أيام الدوام
-- (جدول المواعيد يعمل بفاصل 10 دقائق بين كل موعد والذي يليه — بلا استراحة إجبارية)
insert into public.clinic_settings (clinic_id, doctor_name, consultation_price, currency, whatsapp_country_code, slot_minutes, slots_before_break, break_minutes)
values (
  '9d7fd606-4635-4533-b59c-6a67b3d722ee',
  'د. ريام نصر عبد الرحمن',
  0,
  'ر.س',
  '963',
  10,
  8,
  0
)
on conflict (clinic_id) do update set
  doctor_name = excluded.doctor_name,
  slot_minutes = excluded.slot_minutes,
  slots_before_break = excluded.slots_before_break,
  break_minutes = excluded.break_minutes;

-- أيام الدوام: السبت–الخميس دوام 17:00–21:00، الجمعة عطلة (نفس افتراض باقي العيادات)
insert into public.doctor_schedules (clinic_id, weekday, start_time, end_time, is_active)
select '9d7fd606-4635-4533-b59c-6a67b3d722ee', w.d, '17:00'::time, '21:00'::time, w.active
from (values (0,true),(1,true),(2,true),(3,true),(4,true),(5,false),(6,true)) as w(d, active)
where not exists (
  select 1 from public.doctor_schedules s where s.clinic_id = '9d7fd606-4635-4533-b59c-6a67b3d722ee'
);

select cs.clinic_id, cs.slot_minutes, cs.slots_before_break, cs.break_minutes,
  (select count(*) from public.doctor_schedules d where d.clinic_id = cs.clinic_id) as schedule_days
from public.clinic_settings cs where cs.clinic_id = '9d7fd606-4635-4533-b59c-6a67b3d722ee';
