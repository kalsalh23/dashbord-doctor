-- ============================================================
-- إزالة نظام ntfy بالكامل من قاعدة البيانات
-- الإشعارات أصبحت مجانية بالكامل من داخل المتصفح (Web Push + جرس الإشعارات)
-- هذه الترحيل يعيد تعريف الدوال الحيّة بلا أي نداءات خارجية
-- ============================================================

-- 1) حجز جديد → إشعار داخلي فقط (بلا قناة ntfy)
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
end $function$;

DROP TRIGGER IF EXISTS trg_notify_staff_new_booking ON public.appointments;
CREATE TRIGGER trg_notify_staff_new_booking
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_staff_new_booking();

-- 2) قبول طلب الحجز → إشعار داخلي فقط
CREATE OR REPLACE FUNCTION public.on_appointment_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_patient text;
begin
  if old.status = 'new' and new.status in ('confirmed','arrived') then
    select full_name into v_patient from public.patients where id = new.patient_id;

    insert into public.notifications (clinic_id, target_role, title, body, type)
    values (
      new.clinic_id,
      'doctor',
      'تم قبول طلب الحجز',
      coalesce(v_patient, 'مريض') || ' — تم تأكيد موعده ' || new.appointment_date::text || ' الساعة ' || coalesce(new.start_time::text, ''),
      'booking'
    );
  end if;
  return new;
end $function$;

DROP TRIGGER IF EXISTS trg_appointment_accepted ON public.appointments;
CREATE TRIGGER trg_appointment_accepted
  AFTER UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.on_appointment_accepted();

-- 3) الحالة الإسعافية → بدون قنوات خارجية (الاعتذار عبر واتساب من الواجهة)
DROP FUNCTION IF EXISTS public.emergency_broadcast(text, boolean);

CREATE OR REPLACE FUNCTION public.emergency_broadcast(p_note text DEFAULT ''::text, p_cancel boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  v_clinic uuid := (select clinic_id from public.profiles where id = auth.uid());
  v_doctor text := (select full_name from public.profiles where id = auth.uid());
  v_clinic_name text := (select name from public.clinics where id = v_clinic);
  v_count int := 0;
  r record;
  v_msg text;
  v_list jsonb := '[]'::jsonb;
begin
  if v_clinic is null then raise exception 'FORBIDDEN'; end if;
  if not (public.has_role('doctor') or public.is_admin()) then raise exception 'FORBIDDEN'; end if;

  for r in
    select a.id, a.start_time, p.full_name, p.phone
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.clinic_id = v_clinic
      and a.appointment_date = current_date
      and a.status in ('confirmed','new','arrived','waiting')
  loop
    v_msg := 'نعتذر منكم ' || coalesce(r.full_name, '') ||
             '، تعذر استقبال الحالات اليوم في ' || coalesce(v_clinic_name, 'العيادة') ||
             ' بسبب حالة إسعافية طارئة لدى ' || coalesce(v_doctor, 'الطبيب') || '. ' ||
             coalesce(nullif(p_note, ''), '') ||
             ' نرجو إعادة حجز موعدكم عبر دليل طبي أو بالاتصال بالعيادة. مع خالص تحياتنا، ' || coalesce(v_doctor, '');

    v_count := v_count + 1;
    v_list := v_list || jsonb_build_object(
      'id', r.id, 'start_time', r.start_time,
      'patient_name', r.full_name, 'phone', r.phone
    );
  end loop;

  if p_cancel then
    update public.appointments
    set status = 'cancelled',
        notes = concat_ws(' — ', nullif(notes, ''), 'أُلغي بسبب حالة إسعافية')
    where clinic_id = v_clinic
      and appointment_date = current_date
      and status in ('confirmed','new','arrived','waiting');
  end if;

  insert into public.notifications (clinic_id, target_role, title, body, type)
  values (
    v_clinic,
    'reception',
    'حالة إسعافية — إلغاء مواعيد اليوم',
    'أُرسل اعتذار جماعي باسم ' || coalesce(v_doctor, 'الطبيب') || ' إلى ' || v_count ||
      ' مريض' || case when p_cancel then ' وأُلغيت مواعيدهم اليوم' else '' end ||
      '. يرجى الاتصال بالمرضى وترتيب إعادة الحجز.',
    'cancellation'
  );

  insert into public.audit_logs (clinic_id, user_id, action, details)
  values (v_clinic, auth.uid(), 'emergency_broadcast',
    jsonb_build_object('notified', v_count, 'cancelled', p_cancel, 'note', p_note));

  return jsonb_build_object('count', v_count, 'cancelled', p_cancel, 'list', v_list);
end $function$;

grant execute on function public.emergency_broadcast(text, boolean) to authenticated;

-- 4) تنظيف أي روابط ntfy قديمة من الإشعارات المخزَّنة
update public.notifications
set link = null
where link ilike '%ntfy.sh%';
