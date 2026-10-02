-- ============================================================
-- ترقية الجسر: صندوق «طلبات واردة من دليل طيبة» + إشعار خارجي للموظفين
-- 1) طلب المنصة لا يدخل جدول المواعيد إطلاقاً — يبقى في platform_requests
--    حتى يقبله موظف الاستقبال (فيصبح موعداً حقيقياً) أو يرفضه
-- 2) عند وصول طلب: إشعار خارجي (web-push) لكل موظف فعّل الإشعارات في العيادة
-- ============================================================

-- ===== 1) صندوق الطلبات الواردة =====
create table if not exists public.platform_requests (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  platform_ref uuid not null unique,
  patient_name text not null,
  patient_phone text not null,
  requested_date date,
  day_label text,
  preferred_time text,
  note text,
  status text not null default 'new' check (status in ('new','confirmed','rejected')),
  created_at timestamptz not null default now()
);
create index platform_requests_clinic_idx on public.platform_requests (clinic_id, created_at desc);
alter table public.platform_requests enable row level security;

create policy platform_requests_read on public.platform_requests
for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.clinic_id = platform_requests.clinic_id));

-- ===== 2) استقبال الطلب: إلى الصندوق فقط (لا مواعيد، لا مرضى) =====
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
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_clinic uuid;
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
  if v_clinic is null then
    select id into v_clinic from public.clinics where is_active order by created_at limit 1;
  end if;
  if v_clinic is null then
    return jsonb_build_object('error', 'لا توجد عيادة مسجلة في النظام');
  end if;

  -- منع التكرار
  if exists (select 1 from public.platform_requests where platform_ref = p_platform_ref) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- الصندوق فقط: لا مواعيد ولا مرضى قبل قرار الاستقبال
  insert into public.platform_requests (clinic_id, platform_ref, patient_name, patient_phone, requested_date, day_label, preferred_time, note)
  values (v_clinic, p_platform_ref, btrim(p_patient_name), btrim(p_patient_phone), p_requested_date, p_day_label, btrim(coalesce(p_preferred_time, '')), nullif(btrim(coalesce(p_note, '')), ''));

  insert into public.notifications (clinic_id, target_role, title, body, type, link)
  values (v_clinic, 'all',
    'طلب موعد جديد من دليل طيبة الإمام',
    p_patient_name || ' — ' || coalesce(p_day_label, '') || ' ' || btrim(coalesce(p_preferred_time, '')),
    'booking', '/reception/appointments');

  return jsonb_build_object('ok', true, 'inbox', true, 'clinic_id', v_clinic);
end; $$;

-- ===== 3) قبول الطلب: يصبح مريضاً + موعداً حقيقياً في جدول المواعيد =====
create or replace function public.platform_request_accept(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_req public.platform_requests%rowtype;
  v_staff uuid;
  v_staff_clinic uuid;
  v_patient uuid;
  v_start time;
  v_appt uuid;
begin
  select id, clinic_id into v_staff, v_staff_clinic from public.profiles where id = auth.uid();
  if v_staff is null then
    return jsonb_build_object('error', 'unauthorized');
  end if;

  select * into v_req from public.platform_requests where id = p_request_id;
  if v_req.id is null then
    return jsonb_build_object('error', 'الطلب غير موجود');
  end if;
  if v_req.clinic_id <> v_staff_clinic then
    return jsonb_build_object('error', 'الطلب يخص عيادة أخرى');
  end if;
  if v_req.status <> 'new' then
    return jsonb_build_object('error', 'تم معالجة هذا الطلب مسبقاً');
  end if;

  -- المريض: دمج بالهاتف أو إنشاء
  select id into v_patient from public.patients
  where clinic_id = v_req.clinic_id and phone = v_req.patient_phone limit 1;
  if v_patient is null then
    insert into public.patients (clinic_id, full_name, phone, notes)
    values (v_req.clinic_id, v_req.patient_name, v_req.patient_phone,
            'مريض من دليل طيبة الإمام الطبي — أول طلب: ' || to_char(now(), 'YYYY-MM-DD'))
    returning id into v_patient;
  end if;

  -- الموعد: التاريخ المطلوب + الوقت من النص المفضل (افتراضياً 09:00) ومدة 30 دقيقة
  v_start := coalesce((substring(coalesce(v_req.preferred_time, '') from '(\d{1,2}:\d{2})'))::time, '09:00'::time);

  insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status, notes)
  values (v_req.clinic_id, v_patient, coalesce(v_req.requested_date, current_date),
          v_start, v_start + interval '30 minutes', 'confirmed',
          'من دليل طيبة الإمام (' || coalesce(v_req.day_label, '') || ') — ' || coalesce(v_req.preferred_time, ''))
  returning id into v_appt;

  update public.platform_requests set status = 'confirmed' where id = p_request_id;
  return jsonb_build_object('ok', true, 'appointment_id', v_appt, 'patient_id', v_patient);
end; $$;

-- ===== 4) رفض الطلب =====
create or replace function public.platform_request_reject(p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_req public.platform_requests%rowtype;
  v_staff_clinic uuid;
begin
  select clinic_id into v_staff_clinic from public.profiles where id = auth.uid();
  if v_staff_clinic is null then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  select * into v_req from public.platform_requests where id = p_request_id;
  if v_req.id is null then
    return jsonb_build_object('error', 'الطلب غير موجود');
  end if;
  if v_req.clinic_id <> v_staff_clinic then
    return jsonb_build_object('error', 'الطلب يخص عيادة أخرى');
  end if;
  if v_req.status <> 'new' then
    return jsonb_build_object('error', 'تم معالجة هذا الطلب مسبقاً');
  end if;
  update public.platform_requests set status = 'rejected' where id = p_request_id;
  return jsonb_build_object('ok', true);
end; $$;

grant execute on function public.platform_request_accept(uuid) to authenticated;
grant execute on function public.platform_request_reject(uuid) to authenticated;

-- ===== 5) عودة الحالة للمنصة: من صندوق الطلبات (بعد القبول/الرفض) =====
create or replace function public.bridge_status_to_platform()
returns trigger language plpgsql security definer as $$
begin
  if OLD.status is distinct from NEW.status and NEW.status in ('confirmed','rejected') then
    perform net.http_post(
      url := 'https://dalil-altaybeh.vercel.app/api/bridge-status',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-bridge-secret', 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5'
      ),
      body := jsonb_build_object('platform_ref', NEW.platform_ref, 'status', case NEW.status when 'rejected' then 'cancelled' else NEW.status end)
    );
  end if;
  return NEW;
end; $$;

drop trigger if exists trg_bridge_status on public.appointments;
drop trigger if exists trg_bridge_status_platform on public.platform_requests;
create trigger trg_bridge_status_platform after update on public.platform_requests
for each row execute function bridge_status_to_platform();

-- إلغاء مشغل المواعيد القديم (لم يعد يستخدم — المواعيد لا تحمل platform_ref بعد الآن)
drop trigger if exists trg_bridge_status on public.appointments;

-- ===== 6) اشتراكات الموظفين للإشعار الخارجي =====
create table if not exists public.staff_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);
alter table public.staff_push_subscriptions enable row level security;

create policy staff_push_own on public.staff_push_subscriptions
for all to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create or replace function public.staff_push_register(p_endpoint text, p_p256dh text, p_auth text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_user uuid;
  v_clinic uuid;
begin
  select id, clinic_id into v_user, v_clinic from public.profiles where id = auth.uid();
  if v_user is null then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    return jsonb_build_object('error', 'بيانات ناقصة');
  end if;
  insert into public.staff_push_subscriptions (user_id, clinic_id, endpoint, p256dh, auth)
  values (v_user, v_clinic, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update set user_id = excluded.user_id, clinic_id = excluded.clinic_id, p256dh = excluded.p256dh, auth = excluded.auth;
  return jsonb_build_object('ok', true);
end; $$;

create or replace function public.staff_push_unregister(p_endpoint text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.staff_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  return jsonb_build_object('ok', true);
end; $$;

grant execute on function public.staff_push_register(text, text, text) to authenticated;
grant execute on function public.staff_push_unregister(text) to authenticated;

-- أهداف الإشعار الخارجي: للاستدعاء الآمن من /api/bridge-appointment
create or replace function public.bridge_staff_targets(p_secret text, p_clinic_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if p_secret is distinct from 'brg_a8f4e2c1d6b93k75m0p2q8r4t6v1x3z5' then
    return jsonb_build_object('error', 'unauthorized');
  end if;
  return jsonb_build_object(
    'targets', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', jsonb_build_object('p256dh', s.p256dh, 'auth', s.auth)))
      from public.staff_push_subscriptions s where s.clinic_id = p_clinic_id
    ), '[]'::jsonb)
  );
end; $$;

grant execute on function public.bridge_staff_targets(text, uuid) to anon;

-- ===== 7) تنظيف: حذف الطلبات التي دخلت المواعيد سابقاً قبل هذه الترقية (إن وجدت ولم تُعالج) =====
-- (الموعد الحقيقي لكل طلب قديم يُعاد إنشاؤه عند قبول الاستقبال من الصندوق الجديد)
delete from public.appointments where platform_ref is not null and status = 'new';
