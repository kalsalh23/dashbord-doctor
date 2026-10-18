
-- ===== 3) Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ø·Ù„Ø¨: ÙŠØµØ¨Ø­ Ù…Ø±ÙŠØ¶Ø§Ù‹ + Ù…ÙˆØ¹Ø¯Ø§Ù‹ Ø­Ù‚ÙŠÙ‚ÙŠØ§Ù‹ ÙÙŠ Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ =====
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
    return jsonb_build_object('error', 'Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯');
  end if;
  if v_req.clinic_id <> v_staff_clinic then
    return jsonb_build_object('error', 'Ø§Ù„Ø·Ù„Ø¨ ÙŠØ®Øµ Ø¹ÙŠØ§Ø¯Ø© Ø£Ø®Ø±Ù‰');
  end if;
  if v_req.status <> 'new' then
    return jsonb_build_object('error', 'ØªÙ… Ù…Ø¹Ø§Ù„Ø¬Ø© Ù‡Ø°Ø§ Ø§Ù„Ø·Ù„Ø¨ Ù…Ø³Ø¨Ù‚Ø§Ù‹');
  end if;

  -- Ø§Ù„Ù…Ø±ÙŠØ¶: Ø¯Ù…Ø¬ Ø¨Ø§Ù„Ù‡Ø§ØªÙ Ø£Ùˆ Ø¥Ù†Ø´Ø§Ø¡
  select id into v_patient from public.patients
  where clinic_id = v_req.clinic_id and phone = v_req.patient_phone limit 1;
  if v_patient is null then
    insert into public.patients (clinic_id, full_name, phone, notes)
    values (v_req.clinic_id, v_req.patient_name, v_req.patient_phone,
            'Ù…Ø±ÙŠØ¶ Ù…Ù† Ø¯Ù„ÙŠÙ„ Ø·ÙŠØ¨Ø© Ø§Ù„Ø¥Ù…Ø§Ù… Ø§Ù„Ø·Ø¨ÙŠ â€” Ø£ÙˆÙ„ Ø·Ù„Ø¨: ' || to_char(now(), 'YYYY-MM-DD'))
    returning id into v_patient;
  end if;

  -- Ø§Ù„Ù…ÙˆØ¹Ø¯: Ø§Ù„ØªØ§Ø±ÙŠØ® Ø§Ù„Ù…Ø·Ù„ÙˆØ¨ + Ø§Ù„ÙˆÙ‚Øª Ù…Ù† Ø§Ù„Ù†Øµ Ø§Ù„Ù…ÙØ¶Ù„ (Ø§ÙØªØ±Ø§Ø¶ÙŠØ§Ù‹ 09:00) ÙˆÙ…Ø¯Ø© 30 Ø¯Ù‚ÙŠÙ‚Ø©
  v_start := coalesce((substring(coalesce(v_req.preferred_time, '') from '(\d{1,2}:\d{2})'))::time, '09:00'::time);

  insert into public.appointments (clinic_id, patient_id, appointment_date, start_time, end_time, status, notes)
  values (v_req.clinic_id, v_patient, coalesce(v_req.requested_date, current_date),
          v_start, v_start + interval '30 minutes', 'confirmed',
          'Ù…Ù† Ø¯Ù„ÙŠÙ„ Ø·ÙŠØ¨Ø© Ø§Ù„Ø¥Ù…Ø§Ù… (' || coalesce(v_req.day_label, '') || ') â€” ' || coalesce(v_req.preferred_time, ''))
  returning id into v_appt;

  update public.platform_requests set status = 'confirmed' where id = p_request_id;
  return jsonb_build_object('ok', true, 'appointment_id', v_appt, 'patient_id', v_patient);
end; $$;

-- ===== 4) Ø±ÙØ¶ Ø§Ù„Ø·Ù„Ø¨ =====
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
    return jsonb_build_object('error', 'Ø§Ù„Ø·Ù„Ø¨ ØºÙŠØ± Ù…ÙˆØ¬ÙˆØ¯');
  end if;
  if v_req.clinic_id <> v_staff_clinic then
    return jsonb_build_object('error', 'Ø§Ù„Ø·Ù„Ø¨ ÙŠØ®Øµ Ø¹ÙŠØ§Ø¯Ø© Ø£Ø®Ø±Ù‰');
  end if;
  if v_req.status <> 'new' then
    return jsonb_build_object('error', 'ØªÙ… Ù…Ø¹Ø§Ù„Ø¬Ø© Ù‡Ø°Ø§ Ø§Ù„Ø·Ù„Ø¨ Ù…Ø³Ø¨Ù‚Ø§Ù‹');
  end if;
  update public.platform_requests set status = 'rejected' where id = p_request_id;
  return jsonb_build_object('ok', true);
end; $$;

grant execute on function public.platform_request_accept(uuid) to authenticated;
grant execute on function public.platform_request_reject(uuid) to authenticated;

-- ===== 5) Ø¹ÙˆØ¯Ø© Ø§Ù„Ø­Ø§Ù„Ø© Ù„Ù„Ù…Ù†ØµØ©: Ù…Ù† ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ø·Ù„Ø¨Ø§Øª (Ø¨Ø¹Ø¯ Ø§Ù„Ù‚Ø¨ÙˆÙ„/Ø§Ù„Ø±ÙØ¶) =====
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

-- Ø¥Ù„ØºØ§Ø¡ Ù…Ø´ØºÙ„ Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ù‚Ø¯ÙŠÙ… (Ù„Ù… ÙŠØ¹Ø¯ ÙŠØ³ØªØ®Ø¯Ù… â€” Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ù„Ø§ ØªØ­Ù…Ù„ platform_ref Ø¨Ø¹Ø¯ Ø§Ù„Ø¢Ù†)
drop trigger if exists trg_bridge_status on public.appointments;

-- ===== 6) Ø§Ø´ØªØ±Ø§ÙƒØ§Øª Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ† Ù„Ù„Ø¥Ø´Ø¹Ø§Ø± Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠ =====
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
    return jsonb_build_object('error', 'Ø¨ÙŠØ§Ù†Ø§Øª Ù†Ø§Ù‚ØµØ©');
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

-- Ø£Ù‡Ø¯Ø§Ù Ø§Ù„Ø¥Ø´Ø¹Ø§Ø± Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠ: Ù„Ù„Ø§Ø³ØªØ¯Ø¹Ø§Ø¡ Ø§Ù„Ø¢Ù…Ù† Ù…Ù† /api/bridge-appointment
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
        -- Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ø°ÙŠ ØªÙƒØªØ¨Ù‡ ÙˆØ§Ø¬Ù‡Ø© Â«ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§ØªÂ» ÙÙŠ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚
        select endpoint, p256dh, auth from public.push_subscriptions where clinic_id = p_clinic_id
        union
        -- Ø§Ù„Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ù‚Ø¯ÙŠÙ… (ØªÙˆØ§ÙÙ‚ Ø®Ù„ÙÙŠ)
        select endpoint, p256dh, auth from public.staff_push_subscriptions where clinic_id = p_clinic_id
      ) t
    ), '[]'::jsonb)
  );
end; $$;

grant execute on function public.bridge_staff_targets(text, uuid) to anon;

-- ===== 7) ØªÙ†Ø¸ÙŠÙ: Ø­Ø°Ù Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„ØªÙŠ Ø¯Ø®Ù„Øª Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø³Ø§Ø¨Ù‚Ø§Ù‹ Ù‚Ø¨Ù„ Ù‡Ø°Ù‡ Ø§Ù„ØªØ±Ù‚ÙŠØ© (Ø¥Ù† ÙˆØ¬Ø¯Øª ÙˆÙ„Ù… ØªÙØ¹Ø§Ù„Ø¬) =====
-- (Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠ Ù„ÙƒÙ„ Ø·Ù„Ø¨ Ù‚Ø¯ÙŠÙ… ÙŠÙØ¹Ø§Ø¯ Ø¥Ù†Ø´Ø§Ø¤Ù‡ Ø¹Ù†Ø¯ Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ Ù…Ù† Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ø¬Ø¯ÙŠØ¯)
delete from public.appointments where platform_ref is not null and status = 'new';



