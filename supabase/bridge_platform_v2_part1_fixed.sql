-- ============================================================
-- ØªØ±Ù‚ÙŠØ© Ø§Ù„Ø¬Ø³Ø±: ØµÙ†Ø¯ÙˆÙ‚ Â«Ø·Ù„Ø¨Ø§Øª ÙˆØ§Ø±Ø¯Ø© Ù…Ù† Ø¯Ù„ÙŠÙ„ Ø·ÙŠØ¨Ø©Â» + Ø¥Ø´Ø¹Ø§Ø± Ø®Ø§Ø±Ø¬ÙŠ Ù„Ù„Ù…ÙˆØ¸ÙÙŠÙ†
-- 1) Ø·Ù„Ø¨ Ø§Ù„Ù…Ù†ØµØ© Ù„Ø§ ÙŠØ¯Ø®Ù„ Ø¬Ø¯ÙˆÙ„ Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø¥Ø·Ù„Ø§Ù‚Ø§Ù‹ â€” ÙŠØ¨Ù‚Ù‰ ÙÙŠ platform_requests
--    Ø­ØªÙ‰ ÙŠÙ‚Ø¨Ù„Ù‡ Ù…ÙˆØ¸Ù Ø§Ù„Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ (ÙÙŠØµØ¨Ø­ Ù…ÙˆØ¹Ø¯Ø§Ù‹ Ø­Ù‚ÙŠÙ‚ÙŠØ§Ù‹) Ø£Ùˆ ÙŠØ±ÙØ¶Ù‡
-- 2) Ø¹Ù†Ø¯ ÙˆØµÙˆÙ„ Ø·Ù„Ø¨: Ø¥Ø´Ø¹Ø§Ø± Ø®Ø§Ø±Ø¬ÙŠ (web-push) Ù„ÙƒÙ„ Ù…ÙˆØ¸Ù ÙØ¹Ù‘Ù„ Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª ÙÙŠ Ø§Ù„Ø¹ÙŠØ§Ø¯Ø©
-- ============================================================

-- ===== 1) ØµÙ†Ø¯ÙˆÙ‚ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„ÙˆØ§Ø±Ø¯Ø© =====
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

-- ===== 2) Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ Ø§Ù„Ø·Ù„Ø¨: Ø¥Ù„Ù‰ Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚ ÙÙ‚Ø· (Ù„Ø§ Ù…ÙˆØ§Ø¹ÙŠØ¯ØŒ Ù„Ø§ Ù…Ø±Ø¶Ù‰) =====
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
    return jsonb_build_object('error', 'platform_ref Ù…Ø·Ù„ÙˆØ¨');
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
    return jsonb_build_object('error', 'Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¹ÙŠØ§Ø¯Ø© Ù…Ø³Ø¬Ù„Ø© ÙÙŠ Ø§Ù„Ù†Ø¸Ø§Ù…');
  end if;

  -- Ù…Ù†Ø¹ Ø§Ù„ØªÙƒØ±Ø§Ø±
  if exists (select 1 from public.platform_requests where platform_ref = p_platform_ref) then
    return jsonb_build_object('ok', true, 'duplicate', true);
  end if;

  -- Ø§Ù„ØµÙ†Ø¯ÙˆÙ‚ ÙÙ‚Ø·: Ù„Ø§ Ù…ÙˆØ§Ø¹ÙŠØ¯ ÙˆÙ„Ø§ Ù…Ø±Ø¶Ù‰ Ù‚Ø¨Ù„ Ù‚Ø±Ø§Ø± Ø§Ù„Ø§Ø³ØªÙ‚Ø¨Ø§Ù„
  insert into public.platform_requests (clinic_id, platform_ref, patient_name, patient_phone, requested_date, day_label, preferred_time, note)
  values (v_clinic, p_platform_ref, btrim(p_patient_name), btrim(p_patient_phone), p_requested_date, p_day_label, btrim(coalesce(p_preferred_time, '')), nullif(btrim(coalesce(p_note, '')), ''));

  insert into public.notifications (clinic_id, target_role, title, body, type, link)
  values (v_clinic, 'all',
    'Ø·Ù„Ø¨ Ù…ÙˆØ¹Ø¯ Ø¬Ø¯ÙŠØ¯ Ù…Ù† Ø¯Ù„ÙŠÙ„ Ø·ÙŠØ¨Ø© Ø§Ù„Ø¥Ù…Ø§Ù…',
    p_patient_name || ' â€” ' || coalesce(p_day_label, '') || ' ' || btrim(coalesce(p_preferred_time, '')),
    'booking', '/reception/appointments');

  return jsonb_build_object('ok', true, 'inbox', true, 'clinic_id', v_clinic);
end; $$;
