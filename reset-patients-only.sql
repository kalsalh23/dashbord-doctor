-- ============================================================
-- حذف بيانات المرضى فقط للعيادات الثلاث: د. عارف، د. ريام، د. نزار
-- لا يمس الإعدادات (clinic_settings) ولا أوقات العمل (doctor_schedules) ولا حسابات الأطباء (profiles)
-- يُشغل في Supabase SQL Editor
-- ============================================================

-- معرفات العيادات:
-- الدكتور محمد عارف عبد الرحمن: 0015c9f9-c90e-496e-a65b-2ad04a85be8e
-- الدكتورة ريام نصر عبد الرحمن: 9d7fd606-4635-4533-b59c-6a67b3d722ee
-- الدكتور نزار عبد الستار الشيخ: 7f521b29-25f7-45c0-a3db-1f5146698062

-- ⚠️ تحذير: هذا سيحذف جميع بيانات المرضى ومواعيدهم وزياراتهم ومدفوعاتهم نهائياً - لا يمكن التراجع

DO $$
DECLARE
  v_target_clinics uuid[] := ARRAY[
    '0015c9f9-c90e-496e-a65b-2ad04a85be8e',
    '9d7fd606-4635-4533-b59c-6a67b3d722ee',
    '7f521b29-25f7-45c0-a3db-1f5146698062'
  ];
BEGIN
  -- 1. حذف الأدوية المرتبطة بزيارات المرضى
  DELETE FROM public.medications WHERE clinic_id = ANY(v_target_clinics);

  -- 2. حذف المرفقات المرتبطة بالمرضى
  DELETE FROM public.attachments WHERE clinic_id = ANY(v_target_clinics);

  -- 3. حذف المخططات الطبية (أسنان / أذن وحنجرة)
  DELETE FROM public.dental_chart_entries WHERE clinic_id = ANY(v_target_clinics);
  DELETE FROM public.ent_chart_entries WHERE clinic_id = ANY(v_target_clinics);

  -- 4. حذف الزيارات (الأرشيف الطبي)
  DELETE FROM public.visits WHERE clinic_id = ANY(v_target_clinics);

  -- 5. حذف المدفوعات
  DELETE FROM public.payments WHERE clinic_id = ANY(v_target_clinics);

  -- 6. حذف طلبات المتابعة
  DELETE FROM public.follow_up_requests WHERE clinic_id = ANY(v_target_clinics);

  -- 7. حذف الإشعارات المرتبطة بالعيادات الثلاث
  DELETE FROM public.notifications WHERE clinic_id = ANY(v_target_clinics);

  -- 8. حذف سجلات التدقيق المتعلقة بهذه العيادات
  DELETE FROM public.audit_logs WHERE clinic_id = ANY(v_target_clinics);

  -- 9. حذف المواعيد جميعها
  DELETE FROM public.appointments WHERE clinic_id = ANY(v_target_clinics);

  -- 10. حذف المرضى (الأرشيف) - آخر خطوة لأن الجداول الأخرى تعتمد عليهم
  DELETE FROM public.patients WHERE clinic_id = ANY(v_target_clinics);

  RAISE NOTICE 'تم حذف بيانات المرضى والمواعيد والزيارات والمدفوعات والأرشيف للعيادات الثلاث بنجاح.';
END $$;

-- ملاحظة: لا يمس هذا السكربت:
-- clinics, clinic_settings, doctor_schedules, profiles (حسابات الأطباء)
