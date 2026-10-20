-- ============================================================
-- إشعار واحد لكل حجز (منصة «دليل طيبة الإمام») + ترميز عربي صحيح
--
-- المشكلة: كل حجز من المنصة كان يُنشئ إشعارين للطبيب:
--   1) إشعار من مشغّل appointments (trigger) بعنوان «حجز جديد»
--   2) إشعار من دالة الجسر bridge_create_appointment (عنوان مشوّه الترميز)
-- الحل: التمييز بمعرّف الحجز (platform_ref) — مصدر واحد للإشعار فقط:
--   • إن سبق أن طلبت المنصة الحجز (platform_requests) → الإشعار صادر منها
--   • وإلا → الإشعار يصدر من مشغّل المواعيد
-- ============================================================

create or replace function public.bridge_create_appointment(
  p_secret text,
  p_platform_ref uuid,
  p_patient_name text,
  p_patient_phone text,
  p_requested_date date,
  p_day_label text,
  p_preferred_time text,
  p_note text,
  p_clinic_id uuid default null,
  p_doctor_name text default null
)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare
  v_clinic uuid;
  v_notified boolean := false;
begin
  if p_secret is distinct from 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5' then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if p_platform_ref is null then
    return jsonb_build_object('error', 'platform_ref مطلوب');
  end if;

  if p_clinic_id is not null then
    select id into v_clinic from public.clinics where id = p_clinic_id and is_active;
  end if;
  if v_clinic is null and p_doctor_name is not null and trim(p_doctor_name) != '' then
    select c.id into v_clinic
    from public.clinics c
    join public.profiles p on p.clinic_id = c.id and p.role = 'doctor'
    where c.is_active and lower(trim(coalesce(p.full_name, ''))) = lower(trim(p_doctor_name))
    limit 1;
  end if;
  if v_clinic is null and p_doctor_name is not null and trim(p_doctor_name) != '' then
    select c.id into v_clinic
    from public.clinics c
    join public.clinic_settings s on s.clinic_id = c.id
    where c.is_active and lower(trim(coalesce(s.doctor_name, ''))) like '%' || lower(trim(p_doctor_name)) || '%'
    limit 1;
  end if;
  if v_clinic is null then
    select id into v_clinic from public.clinics where is_active order by created_at limit 1;
  end if;
  if v_clinic is null then
    return jsonb_build_object('error', 'لا توجد عيادة مسجلة في النظام');
  end if;

  -- منع التكرار: نفس الحجز
  if exists (select 1 from public.platform_requests where platform_ref = p_platform_ref) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- الطلب محفوظ: لا يُنشأ موعد ولا يُنبّه الطبيب
  insert into public.platform_requests (clinic_id, platform_ref, patient_name, patient_phone, requested_date, day_label, preferred_time, note)
  values (v_clinic, p_platform_ref, btrim(p_patient_name), btrim(p_patient_phone), p_requested_date, p_day_label, btrim(coalesce(p_preferred_time, '')), nullif(btrim(coalesce(p_note, '')), ''));

  -- إشعار واحد فقط: يتخطّاه إن كان الحجز قد تأكّد فعلاً (نبّهه مشغّل المواعيد)
  if not exists (select 1 from public.appointments where platform_ref = p_platform_ref) then
    insert into public.notifications (clinic_id, target_role, title, body, type, link)
    values (v_clinic, 'all',
      'طلب حجز جديد من دليل طيبة الإمام',
      p_patient_name || ' — ' || coalesce(p_day_label, '') || ' ' || btrim(coalesce(p_preferred_time, '')),
      'booking', '/reception/appointments');
    v_notified := true;
  end if;

  return jsonb_build_object('ok', true, 'inbox', v_notified, 'clinic_id', v_clinic);
end; $fn$;

-- تأكيد الحجز: يُنشئ الموعد فقط — الإشعار يصدر من مشغّل appointments (مرة واحدة)
create or replace function public.bridge_confirm_appointment(
  p_secret text,
  p_platform_ref uuid,
  p_clinic_id uuid,
  p_doctor_name text,
  p_patient_name text,
  p_patient_phone text,
  p_requested_date date,
  p_time text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_clinic uuid;
  v_doctor uuid;
  v_patient uuid;
  v_start time;
  v_appt uuid;
begin
  if p_secret is distinct from 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5' then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if p_patient_name is null or btrim(p_patient_name) = '' or p_patient_phone is null or btrim(p_patient_phone) = '' then
    return jsonb_build_object('error', 'بيانات المريض ناقصة');
  end if;

  if p_clinic_id is not null then
    select id into v_clinic from public.clinics where id = p_clinic_id and is_active;
  end if;
  if v_clinic is null and p_doctor_name is not null then
    select id into v_clinic from public.clinics where name = 'عيادة ' || btrim(p_doctor_name) limit 1;
  end if;
  if v_clinic is null then
    select id into v_clinic from public.clinics where is_active order by created_at limit 1;
  end if;
  if v_clinic is null and p_doctor_name is not null then
    insert into public.clinics (name, is_active) values ('عيادة ' || btrim(p_doctor_name), true) returning id into v_clinic;
  end if;
  if v_clinic is null then
    return jsonb_build_object('error', 'لا توجد عيادة مسجلة في النظام');
  end if;

  if p_doctor_name is not null and btrim(p_doctor_name) <> '' then
    select id into v_doctor from public.profiles
    where clinic_id = v_clinic and role = 'doctor'
      and (full_name ilike '%' || btrim(p_doctor_name) || '%' or btrim(p_doctor_name) ilike '%' || full_name || '%')
    limit 1;
  end if;

  select id into v_patient from public.patients
  where clinic_id = v_clinic and phone = btrim(p_patient_phone) limit 1;
  if v_patient is null then
    insert into public.patients (clinic_id, full_name, phone, notes)
    values (v_clinic, btrim(p_patient_name), btrim(p_patient_phone),
            'مريض من دليل طيبة الإمام الطبي — أول حجز: ' || to_char(now(), 'YYYY-MM-DD'))
    returning id into v_patient;
  end if;

  v_start := coalesce(p_time::time, '09:00'::time);

  begin
    insert into public.appointments (clinic_id, patient_id, doctor_id, appointment_date, start_time, end_time, status, notes, platform_ref)
    values (v_clinic, v_patient, v_doctor,
      coalesce(p_requested_date, current_date),
      v_start, v_start + interval '30 minutes', 'confirmed',
      concat_ws(' | ', 'حجز فوري من دليل طيبة الإمام الطبي', nullif(btrim(coalesce(p_note, '')), '')),
      p_platform_ref)
    returning id into v_appt;
  exception when unique_violation then
    return jsonb_build_object('error', 'taken');
  end;

  -- لا إشعار هنا: مشغّل appointments يُنشئ إشعاراً واحداً للطبيب

  return jsonb_build_object('ok', true, 'appointment_id', v_appt, 'patient_id', v_patient, 'clinic_id', v_clinic);
end; $fn$;

-- مشغّل المواعيد: يتخطّى الإشعار إن كانت المنصة قد نبّهت لنفس الحجز
create or replace function public.notify_staff_new_booking()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_clinic text;
  v_patient text;
  v_msg text;
begin
  v_clinic := (select name from public.clinics where id = NEW.clinic_id);
  v_patient := (select full_name from public.patients where id = NEW.patient_id);

  -- حجز من المنصة: المنصة هي التي نبّهت (إشعار واحد فقط)
  if NEW.platform_ref is not null
     and exists (select 1 from public.platform_requests where platform_ref = NEW.platform_ref) then
    return NEW;
  end if;

  v_msg := 'حجز جديد في ' || coalesce(v_clinic, 'العيادة') ||
           ' — ' || coalesce(v_patient, 'مريض') ||
           ' · ' || to_char(NEW.appointment_date, 'YYYY-MM-DD') ||
           ' الساعة ' || coalesce(NEW.start_time::text, '');

  insert into public.notifications (clinic_id, target_role, title, body, type, link)
  values (NEW.clinic_id, 'doctor', 'حجز جديد', v_msg, 'booking', '/doctor/schedule');

  return NEW;
end $fn$;

-- إصلاح النصوص المشوّهة المحفوظة سابقاً (ترميز خاطئ عند الإدخال)
update public.notifications
set title = convert_from(convert_to(title, 'WIN1252'), 'UTF8')
where title ~ '[ØÙÚÂâ€]';

update public.notifications
set body = replace(
      replace(
        replace(body, 'â€”', '—'),
        'âˆ’', '’'),
      'â€œ', '“')
where body like '%â€”%' or body like '%âˆ’%' or body like '%â€œ%';
