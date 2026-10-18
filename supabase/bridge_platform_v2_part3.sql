
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
