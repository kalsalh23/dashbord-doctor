-- ============================================================
-- جسر دليل طيبة الإمام الطبي → نظام إدارة العيادة (clinic-manager)
-- يشغَّل مرة واحدة في SQL Editor لمشروع Supabase الخاص بالعيادة
-- ============================================================
-- 1) مرجع الطلب من المنصة (للربط العكسي)
alter table public.appointments add column if not exists platform_ref uuid;
create index if not exists appointments_platform_ref_idx on public.appointments (platform_ref);

-- 2) استقبال طلب موعد من المنصة (يستدعيه /api/bridge-appointment بمفتاح مشترك)
create or replace function public.bridge_create_appointment(
  p_secret text,
  p_platform_ref uuid,
  p_patient_name text,
  p_patient_phone text,
  p_requested_date date,
  p_day_label text,
  p_preferred_time text,
  p_note text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_clinic uuid;
  v_patient uuid;
  v_start time;
  v_end time;
  v_appt uuid;
  v_time_text text := btrim(coalesce(p_preferred_time, ''));
begin
  if p_secret is distinct from 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5' then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if p_platform_ref is null then
    return jsonb_build_object('error', 'platform_ref مطلوب');
  end if;

  -- العيادة: الأولى النشطة (نظام مخصص لعيادة واحدة حالياً)
  select id into v_clinic from public.clinics where is_active order by created_at limit 1;
  if v_clinic is null then
    return jsonb_build_object('error', 'لا توجد عيادة مسجلة في النظام');
  end if;

  -- منع التكرار: نفس مرجع المنصة موجود مسبقاً؟
  if exists (select 1 from public.appointments where platform_ref = p_platform_ref) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- المريض: بحث بالهاتف ضمن العيادة، وإلا إنشاء ملف جديد
  select id into v_patient from public.patients
  where clinic_id = v_clinic and phone = btrim(p_patient_phone) limit 1;
  if v_patient is null then
    insert into public.patients (clinic_id, full_name, phone, notes)
    values (v_clinic, btrim(p_patient_name), btrim(p_patient_phone),
            'مريض من دليل طيبة الإمام الطبي — أول طلب: ' || to_char(now(), 'YYYY-MM-DD'))
    returning id into v_patient;
  end if;

  -- الوقت: استخراج HH:MM من نص الوقت المفضل إن وجد، وإلا 09:00 ومدة الكشف 30 دقيقة
  v_start := coalesce(
    (substring(v_time_text from '(\d{1,2}:\d{2})'))::time,
    '09:00'::time
  );
  v_end := v_start + interval '30 minutes';

  -- إدراج الموعد بحالة new (بانتظار قبول الاستقبال/الطبيب)
  insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status, notes, platform_ref)
  values (
    v_clinic, v_patient,
    coalesce(p_requested_date, current_date),
    v_start, v_end,
    'new',
    concat_ws(' | ',
      'من دليل طيبة الإمام الطبي (' || coalesce(p_day_label, '') || ')',
      nullif(btrim(p_note), ''),
      ('الوقت المفضل: ' || v_time_text)
    ),
    p_platform_ref
  )
  returning id into v_appt;

  -- إشعار داخلي للاستقبال والطبيب
  insert into public.notifications (clinic_id, target_role, title, body, type, link)
  values (
    v_clinic, 'all',
    'طلب موعد جديد من دليل طيبة الإمام',
    p_patient_name || ' — ' || coalesce(p_day_label, '') || ' ' || v_time_text,
    'booking',
    '/reception/appointments'
  );

  return jsonb_build_object('ok', true, 'appointment_id', v_appt, 'patient_id', v_patient);
end; $$;

grant execute on function public.bridge_create_appointment(text, uuid, text, text, date, text, text, text) to anon;

-- 3) عودة الحالة للمنصة: قبول/رفض/إنجاز في النظام → يُبلَّغ دليلك فوراً فيحدّث طلب المريض
create extension if not exists pg_net;

create or replace function public.bridge_status_to_platform()
returns trigger language plpgsql security definer as $$
declare
  v_secret text := 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5';
begin
  if NEW.platform_ref is not null and OLD.status is distinct from NEW.status
     and NEW.status in ('confirmed','cancelled','completed') then
    perform net.http_post(
      url := 'https://dalil-altaybeh.vercel.app/api/bridge-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-bridge-secret', v_secret
      ),
      body := jsonb_build_object('platform_ref', NEW.platform_ref, 'status', NEW.status)
    );
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_bridge_status on public.appointments;
create trigger trg_bridge_status after update on public.appointments
for each row execute function bridge_status_to_platform();
