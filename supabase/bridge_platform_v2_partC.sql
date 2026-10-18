
create or replace function public.staff_push_unregister(p_endpoint text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  delete from public.staff_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  return jsonb_build_object('ok', true);
end; $$;
