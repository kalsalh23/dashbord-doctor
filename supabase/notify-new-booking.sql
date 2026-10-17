-- ============================================================
-- إشعار داخل النظام عند وصول حجز جديد (جرس الإشعارات + إشعار المتصفح + نغمة)
-- — يعمل عبر Web Push المجاني داخل المتصفح (بلا خدمات خارجية)
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_staff_new_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_clinic text;
  v_patient text;
  v_msg text;
begin
  v_clinic := (select name from public.clinics where id = NEW.clinic_id);
  v_patient := (select full_name from public.patients where id = NEW.patient_id);
  v_msg := 'حجز جديد في ' || coalesce(v_clinic, 'العيادة') ||
           ' — ' || coalesce(v_patient, 'مريض') ||
           ' · ' || to_char(NEW.appointment_date, 'YYYY-MM-DD') ||
           ' الساعة ' || coalesce(NEW.start_time::text, '');

  insert into public.notifications (clinic_id, target_role, title, body, type, link)
  values (NEW.clinic_id, 'doctor', 'حجز جديد', v_msg, 'booking', '/doctor/schedule');

  return NEW;
end $function$


DROP TRIGGER IF EXISTS trg_notify_staff_new_booking ON public.appointments;
CREATE TRIGGER trg_notify_staff_new_booking
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_new_booking();
