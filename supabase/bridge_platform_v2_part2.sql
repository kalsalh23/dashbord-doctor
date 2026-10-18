
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
