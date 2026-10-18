-- doctor self-service settings: avatar + consultation price + slot minutes
-- kept for parity with the schema; the app now writes clinic_settings directly
-- via a Supabase query (no RPC needed). This function is retained so any
-- existing callers in the codebase still resolve; it is best-effort and
-- should be replaced by direct UPDATEs.
drop function if exists public.doctor_set_consultation_price(numeric, numeric);
drop function if exists public.doctor_set_consultation_price(numeric);
create or replace function public.doctor_set_consultation_price(p_price numeric, p_slot_minutes numeric default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_price is null or p_price < 0 then raise exception 'BAD_PRICE'; end if;
  update public.clinic_settings set
    consultation_price = p_price,
    slot_minutes = coalesce(p_slot_minutes, slot_minutes),
    examination_minutes = coalesce(p_slot_minutes, examination_minutes),
    consultation_minutes = coalesce(p_slot_minutes, consultation_minutes)
  where clinic_id = (select clinic_id from public.profiles where id = auth.uid()::uuid);
end $$;

grant execute on function public.doctor_set_consultation_price(numeric) to authenticated;
