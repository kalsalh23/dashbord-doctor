-- ============================================================
-- جسر أوقات الدوام → منصة دليل طيبة الإمام الطبي (دليلك الطبي)
-- أي تغيير في «أوقات دوامي» (doctor_schedules) يُرسل فوراً للمنصة
-- لكلا الطبيبين (د. عارف ود. ريام) فيتغيّر جدول الحجز وأوقات الدوام هناك
-- ============================================================
-- 1) دالة القراءة (يستدعيها /api/bridge-hours في هذا المشروع)
create or replace function public.bridge_clinic_hours(p_secret text, p_clinic_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to public
as $$
declare
  v_secret constant text := 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5';
  v_days jsonb;
  v_text jsonb := '{}'::jsonb;
  v_clinic text;
  v_slot int;
  v_before int;
  v_break int;
  r record;
begin
  if p_secret is distinct from v_secret then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if p_clinic_id is null then
    return jsonb_build_object('error', 'clinic_id مطلوب');
  end if;

  select name into v_clinic from public.clinics where id = p_clinic_id;
  if v_clinic is null then
    return jsonb_build_object('error', 'clinic not found');
  end if;

  select
    coalesce(slot_minutes, 10),
    coalesce(slots_before_break, 8),
    coalesce(break_minutes, 0)
  into v_slot, v_before, v_break
  from public.clinic_settings where clinic_id = p_clinic_id;

  for r in
    select weekday,
           is_active,
           to_char(start_time, 'HH24:MI') as start_t,
           to_char(end_time, 'HH24:MI') as end_t
    from public.doctor_schedules
    where clinic_id = p_clinic_id
    order by weekday
  loop
    v_days := coalesce(v_days, '[]'::jsonb) || jsonb_build_object(
      'weekday', r.weekday,            -- 0=الأحد ... 6=السبت
      'active', r.is_active,
      'start', r.start_t,
      'end', r.end_t
    );
    -- نفس شكل حقل work_hours في المنصة: { sat: "17:00 - 21:00", sun: "مغلق" }
    v_text := v_text || jsonb_build_object(
      case r.weekday
        when 0 then 'sun' when 1 then 'mon' when 2 then 'tue' when 3 then 'wed'
        when 4 then 'thu' when 5 then 'fri' else 'sat'
      end,
      case when r.is_active then r.start_t || ' - ' || r.end_t else 'مغلق' end
    );
  end loop;

  return jsonb_build_object(
    'clinic_id', p_clinic_id,
    'clinic_name', v_clinic,
    'days', coalesce(v_days, '[]'::jsonb),
    'work_hours', v_text,
    'slot_minutes', v_slot,
    'slots_before_break', v_before,
    'break_minutes', v_break,
    'updated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS')
  );
end $$;

grant execute on function public.bridge_clinic_hours(text, uuid) to anon;

-- 2) إرسال جدول عيادة إلى المنصة (HTTP POST — بنفس أسلوب جسر الحالة)
create or replace function public.bridge_hours_to_platform(p_clinic_id uuid, p_event text default 'SYNC')
returns void
language plpgsql
security definer
set search_path to public
as $$
declare
  v_secret constant text := 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5';
  v_payload jsonb;
  v_request_id bigint;
begin
  if p_clinic_id is null then
    return;
  end if;

  -- الجدول الكامل الحالي للعيادة بعد التغيير — مستقلّ ومتكرر بأمان
  select public.bridge_clinic_hours(v_secret, p_clinic_id) into v_payload;
  if v_payload is null or v_payload ? 'error' then
    return;
  end if;

  v_payload := v_payload || jsonb_build_object('event', p_event);

  select net.http_post(
    url := 'https://dalil-altaybeh.vercel.app/api/bridge-hours',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bridge-secret', v_secret
    ),
    body := v_payload,
    timeout_milliseconds := 8000
  ) into v_request_id;
exception when others then
  -- أي خطأ في الإرسال لا يمنع حفظ الدوام داخل النظام
  return;
end $$;

-- 3) المُشغِّل: أي تغيير في أيام الدوام يُرسل الجدول فوراً
create or replace function public.bridge_hours_trigger()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_clinic uuid := coalesce(new.clinic_id, old.clinic_id);
begin
  perform public.bridge_hours_to_platform(v_clinic, tg_op);
  return null;
end $$;

drop trigger if exists trg_hours_to_platform on public.doctor_schedules;
create trigger trg_hours_to_platform
after insert or update or delete on public.doctor_schedules
for each row execute function public.bridge_hours_trigger();
