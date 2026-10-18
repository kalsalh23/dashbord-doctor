
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

drop policy if exists staff_push_own on public.staff_push_subscriptions;
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
