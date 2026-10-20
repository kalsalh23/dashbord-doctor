-- ============================================================
-- إعادة تعيين مواعيد "دليلك الطبي" (Dalilak) للعيادات الثلاث: د. عارف، د. ريام، د. نزار
-- يشغّل في Supabase SQL Editor
-- ============================================================

-- المواعيد القادمة من دليلك الطبي لها platform_ref غير فارغ
-- هذا يحذف فقط المواعيد التي جاءت عبر جسر دليلك الطبي

DO $$
DECLARE
  v_aref_clinic uuid := '0015c9f9-c90e-496e-a65b-2ad04a85be8e';
  v_riam_clinic uuid := '9d7fd606-4635-4533-b59c-6a67b3d722ee';
  v_nizar_clinic uuid := '7f521b29-25f7-45c0-a3db-1f5146698062';
  v_target_clinics uuid[] := ARRAY[
    '0015c9f9-c90e-496e-a65b-2ad04a85be8e', 
    '9d7fd606-4635-4533-b59c-6a67b3d722ee',
    '7f521b29-25f7-45c0-a3db-1f5146698062'
  ];
  v_deleted_count int;
BEGIN
  -- عدد المواعيد التي ستُحذف (للتقرير)
  SELECT count(*) INTO v_deleted_count
  FROM public.appointments
  WHERE clinic_id = ANY(v_target_clinics)
    AND platform_ref IS NOT NULL
    AND platform_ref <> '';

  -- حذف مواعيد دليلك الطبي فقط
  DELETE FROM public.appointments
  WHERE clinic_id = ANY(v_target_clinics)
    AND platform_ref IS NOT NULL
    AND platform_ref <> '';

  RAISE NOTICE 'تم حذف % موعد من تطبيق "دليلك الطبي" للعيادات الثلاث (د. عارف، د. ريام، د. نزار)', v_deleted_count;
END $$;

-- ملاحظة: هذا لا يلمس المرضى أو الزيارات أو المدفوعات - فقط المواعيد التي platform_ref <> ''
