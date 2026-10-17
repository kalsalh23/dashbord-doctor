-- ============================================================
-- تنظيف الحجوزات الوهمية / المكررة في عيادة د. نizar
-- يشغّل المستخدم في Supabase SQL Editor.
-- 1) يلغي الحجوزات المكررة لنفس (العيادة، التاريخ، الوقت) — يُبقي أقدم حجز فقط.
-- 2) (اختياري) إلغاء حجوزات تاريخ محدد بالكامل.
-- لذلك يرجى التأكد من نسخة احتياطية قبل التشغيل.
-- ============================================================

-- 1) مع عدم وجود مواعيد مكررة (الفهرس الفريد يمنعها أصلاً) — لا حاجة لهذه الخطوة.
--    الفحص فقط: هل توجد تكرارات لنفس الوقت في نفس اليوم؟
select a.clinic_id, a.appointment_date, a.start_time, count(*) as n
from public.appointments a
where a.status not in ('cancelled','no_show')
group by a.clinic_id, a.appointment_date, a.start_time
having count(*) > 1;

-- 2) إلغاء كل مواعيد يوم محدد (مثال 2026-10-13) — حرّر الأوقات بإعادة قراءتها كملغاة
--    عدّل التاريخ وأزل التعليق للتشغيل:
-- update public.appointments
-- set status = 'cancelled',
--     notes = concat_ws(' — ', nullif(notes, ''), 'إلغاء يدوي')
-- where appointment_date = date '2026-10-13'
--   and status not in ('cancelled','no_show','completed');
