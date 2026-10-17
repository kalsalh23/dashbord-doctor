-- ============================================================
-- إعادة تعيين كاملة لعيادتي الدكتور عارف والدكتورة ريام
-- يشغّل في Supabase SQL Editor
-- ============================================================

-- معرفات العيادات:
-- الدكتور عارف (الدكتور محمد عارف): 0015c9f9-c90e-496e-a65b-2ad04a85be8e
-- الدكتورة ريام: 9d7fd606-4635-4533-b59c-6a67b3d722ee

-- ⚠️ تحذير: هذا سيحذف جميع البيانات نهائياً - لا يمكن التراجع
-- يرجى أخذ نسخة احتياطية قبل التشغيل

DO $$
DECLARE
  v_aref_clinic uuid := '0015c9f9-c90e-496e-a65b-2ad04a85be8e';
  v_riam_clinic uuid := '9d7fd606-4635-4533-b59c-6a67b3d722ee';
  v_target_clinics uuid[] := ARRAY['0015c9f9-c90e-496e-a65b-2ad04a85be8e', '9d7fd606-4635-4533-b59c-6a67b3d722ee'];
BEGIN
  -- 1. حذف المواعيد (appointments) - بما فيها من دليلك الطبي
  DELETE FROM public.appointments WHERE clinic_id = ANY(v_target_clinics);

  -- 2. حذف الزيارات (visits) والسجلات الطبية
  DELETE FROM public.visits WHERE clinic_id = ANY(v_target_clinics);

  -- 3. حذف الوصفات الطبية (prescriptions / dental_chart_entries)
  DELETE FROM public.dental_chart_entries WHERE clinic_id = ANY(v_target_clinics);

  -- 4. حذف المدفوعات (payments)
  DELETE FROM public.payments WHERE clinic_id = ANY(v_target_clinics);

  -- 5. حذف طلبات المتابعة (follow_up_requests)
  DELETE FROM public.follow_up_requests WHERE clinic_id = ANY(v_target_clinics);

  -- 6. حذف الإشعارات (notifications)
  DELETE FROM public.notifications WHERE clinic_id = ANY(v_target_clinics);

  -- 7. حذف سجلات التدقيق (audit_logs)
  DELETE FROM public.audit_logs WHERE clinic_id = ANY(v_target_clinics);

  -- 8. حذف المرضى (patients) - فقط للعيادتين المستهدفتين
  DELETE FROM public.patients WHERE clinic_id = ANY(v_target_clinics);

  -- 9. حذف إعدادات العيادة (clinic_settings) - إعادة تعيين للإعدادات الافتراضية
  UPDATE public.clinic_settings SET
    slot_minutes = 10,
    slots_before_break = 8,
    break_minutes = 10,
    consultation_price = 50000,
    currency = 'ر.س',
    doctor_name = '',
    prescription_template = 'rose',
    prescription_watermark = null,
    prescription_side = 'right'
  WHERE clinic_id = ANY(v_target_clinics);

  -- 10. إعادة تعيين جداول أوقات العمل (doctor_schedules) - تفعيل جميع الأيام مع أوقات افتراضية
  DELETE FROM public.doctor_schedules WHERE clinic_id = ANY(v_target_clinics);
  INSERT INTO public.doctor_schedules (clinic_id, weekday, is_active, start_time, end_time)
  SELECT c.id, w.weekday, true, '17:00', '21:00'
  FROM unnest(ARRAY['0015c9f9-c90e-496e-a65b-2ad04a85be8e'::uuid, '9d7fd606-4635-4533-b59c-6a67b3d722ee'::uuid]) c(id)
  CROSS JOIN generate_series(0, 6) w(weekday);

  -- 11. حذف أي ملفات تعريف (profiles) مرتبطة بالعيادتين فقط إذا لم تكن أدمن/سوبر أدمن
  -- ملاحظة: عادة ما تبقى حسابات الأطباء - قم بإلغاء التعليق إذا أردت حذفها أيضاً
  -- DELETE FROM public.profiles WHERE clinic_id = ANY(v_target_clinics) AND role NOT IN ('admin', 'super_admin');

  RAISE NOTICE 'تم إعادة تعيين كاملة للعيادتين: % و %', 'د. عارف', 'د. ريام';
END $$;