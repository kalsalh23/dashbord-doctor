-- ============================================================
-- إصلاح حفظ كشف الأسنان: قيد tooth_no كان يمنع الأسنان اللبنية
-- (51–85) فكان «إنهاء الكشف» يفشل عند حفظ أي علاج على سنّ طفل
-- — خطأ 23514: violates check constraint dental_chart_entries_tooth_no_check
-- ============================================================

ALTER TABLE public.dental_chart_entries
  DROP CONSTRAINT IF EXISTS dental_chart_entries_tooth_no_check;

-- أسنان دائمة 11–48 + أسنان لبنية 51–85 (ترقيم FDI)
ALTER TABLE public.dental_chart_entries
  ADD CONSTRAINT dental_chart_entries_tooth_no_check
  CHECK ((tooth_no >= 11 AND tooth_no <= 48) OR (tooth_no >= 51 AND tooth_no <= 85));
