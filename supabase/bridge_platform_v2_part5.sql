
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
