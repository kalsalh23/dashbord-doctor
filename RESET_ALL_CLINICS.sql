-- إعادة تعيين كاملة لعيادتي الدكتور عارف والدكتورة ريام
BEGIN;

-- 1. حذف سجلات مخطط الأسنان (لا توجد حاليًا)
DELETE FROM public.dental_chart_entries WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

-- 2. حذف الزيارات
DELETE FROM public.visits WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

-- 3. حذف المدفوعات
DELETE FROM public.payments WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

-- 4. حذف المواعيد (جميعها بما فيها دليلك الطبي)
DELETE FROM public.appointments WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

-- 5. حذف طلبات المتابعة
DELETE FROM public.follow_up_requests WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

-- 6. حذف الإشعارات
DELETE FROM public.notifications WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

-- 7. حذف سجلات التدقيق
DELETE FROM public.audit_logs WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

-- 8. حذف المرضى (الأرشيف)
DELETE FROM public.patients WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

-- 9. إعادة ضبط جداول أوقات العمل
DELETE FROM public.doctor_schedules WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');
INSERT INTO public.doctor_schedules (clinic_id, weekday, is_active, start_time, end_time)
SELECT c.id, w.weekday, true, '17:00', '21:00'
FROM unnest(ARRAY['0015c9f9-c90e-496e-a65b-2ad04a85be8e'::uuid,'9d7fd606-4635-4533-b59c-6a67b3d722ee'::uuid]) AS c(id)
CROSS JOIN generate_series(0, 6) AS w(weekday);

-- 10. إعادة ضبط إعدادات العيادة (الأعمدة التي تسمح بها القيود فقط)
UPDATE public.clinic_settings SET
  slot_minutes = 10,
  slots_before_break = 8,
  break_minutes = 10,
  consultation_price = 50000,
  currency = 'ر.س',
  prescription_template = 'rose'
WHERE clinic_id IN ('0015c9f9-c90e-496e-a65b-2ad04a85be8e','9d7fd606-4635-4533-b59c-6a67b3d722ee');

COMMIT;

SELECT 'reset done' AS status;