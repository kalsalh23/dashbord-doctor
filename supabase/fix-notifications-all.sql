-- ============================================================
-- إصلاح نظام الإشعارات بين تطبيقي «الدليل» و«العيادة» — ملف واحد يشغَّل مرة واحدة
-- يحل:
--   1) عدم وصول الإشعار الخارجي للموظفين: كان الجسر يقرأ من جدول
--      staff_push_subscriptions بينما واجهة التفعيل داخل التطبيق تكتب في
--      push_subscriptions → الآن يقرأ الجسر من الاثنين (UNION).
--   2) استعلام حالة الطلب للمواطن (استقصاء مجاني ضمن المتصفح)
--      → دالة bridge_request_status + نقطة /api/bridge-request-status
--   3) التأكد من وجود مشغّل الإشعار الخارجي (send-push المجاني) وسياسات القراءة.
-- ملاحظة: يعمل هذا على كل العيادات (عيادتي د. عارف ود. ريام) — المشغّلات عامة.
-- ============================================================

-- 1) أهداف الإشعار الخارجي — تقرأ من الجدولين (الجديد + القديم)
create or replace function public.bridge_staff_targets(p_secret text, p_clinic_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5' then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  return jsonb_build_object(
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', t.endpoint, 'keys', jsonb_build_object('p256dh', t.p256dh, 'auth', t.auth)))
      from (
        -- الجدول الذي تكتبه واجهة «تفعيل الإشعارات» في التطبيق
        select endpoint, p256dh, auth from public.push_subscriptions where clinic_id = p_clinic_id
        union
        -- الجدول القديم (توافق خلفي)
        select endpoint, p256dh, auth from public.staff_push_subscriptions where clinic_id = p_clinic_id
      ) t
    ), '[]'::jsonb)
  );
end $$;

grant execute on function public.bridge_staff_targets(text, uuid) to anon;

-- 2) استعلام حالة الطلب للمواطن (استقصاء مجاني)
create or replace function public.bridge_request_status(
  p_secret text,
  p_platform_ref uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_req public.platform_requests%rowtype;
  v_appt_date text;
  v_appt_time text;
begin
  if p_secret is distinct from 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5' then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if p_platform_ref is null then
    return jsonb_build_object('error', 'platform_ref مطلوب');
  end if;

  select * into v_req from public.platform_requests where platform_ref = p_platform_ref;
  if v_req.id is null then
    return jsonb_build_object('error', 'not_found', 'status', 'not_found');
  end if;

  -- عند القبول: أعِد بيانات الموعد المؤكد (التاريخ/الوقت)
  v_appt_date := null;
  v_appt_time := null;
  if v_req.status = 'confirmed' then
    select a.appointment_date::text, a.start_time::text
      into v_appt_date, v_appt_time
      from public.appointments a
     where a.clinic_id = v_req.clinic_id
       and a.patient_id in (select id from public.patients where phone = v_req.patient_phone)
     order by a.created_at desc
     limit 1;
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', v_req.status,
    'platform_ref', v_req.platform_ref,
    'patient_name', v_req.patient_name,
    'requested_date', v_req.requested_date::text,
    'preferred_time', v_req.preferred_time,
    'day_label', v_req.day_label,
    'clinic_id', v_req.clinic_id,
    'created_at', v_req.created_at,
    'appointment', case when v_appt_date is null then null else jsonb_build_object(
          'appointment_date', v_appt_date,
          'start_time', v_appt_time
        ) end
  );
end $$;

grant execute on function public.bridge_request_status(text, uuid) to anon;

-- 3) التأكد من مشغّل الإشعار الخارجي المجاني (Web Push عبر دالة send-push)
--    — يعتبر idempotent: يُعاد إنشاؤه بلا ضرر إن وُجد
create or replace function public.push_notification_to_staff()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_secret text := 'PUSH_SECRET_3710e77462498c88717aa769';
begin
  if new.clinic_id is null then
    return new;
  end if;
  begin
    perform net.http_post(
      url := 'https://lucnobmmrqujhgbhmciz.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', v_secret
      ),
      body := jsonb_build_object(
        'clinicId', new.clinic_id,
        'targetRole', new.target_role,
        'userId', new.user_id,
        'title', coalesce(new.title, 'إشعار جديد'),
        'body', coalesce(new.body, '')
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    null; -- لا تُعطّل الإدراج بسبب فشل الدفع
  end;
  return new;
end $$;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
after insert on public.notifications
for each row execute function public.push_notification_to_staff();

-- 4) سياسة القراءة: كل موظفي العيادة يرون إشعارات العيادة (والمديرون الكل)
drop policy if exists notifs_select on public.notifications;
create policy notifs_select on public.notifications for select to authenticated
  using (
    public.same_clinic(clinic_id)
    and (
      target_role = 'all'
      or target_role = public.current_role_name()
      or public.is_admin()
    )
  );

-- 5) التحقق
select
  (select count(*) from pg_proc where proname = 'bridge_request_status')  as has_status_fn,
  (select count(*) from pg_proc where proname = 'bridge_staff_targets')   as has_targets_fn,
  (select count(*) from pg_trigger where tgname = 'trg_notifications_push') as has_push_trigger;
