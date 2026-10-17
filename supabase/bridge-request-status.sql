-- ============================================================
-- استعلام حالة طلب حجز (للمواطن في منصة دليل طيبة)
-- تُتيح للمنصة/المواطن الاستقصاء ( polling ) المجاني داخل المتصفح:
--   GET /api/bridge-request-status?secret=...&platform_ref=...
-- تعيد: حالة الطلب (new/confirmed/rejected) + بيانات الموعد عند القبول.
--
-- ملاحظة: هذه الدالة موجودة أيضاً ضمن fix-notifications-all.sql —
-- شغّل أحدهما فقط.
-- ============================================================

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

  -- عند القبول: أعِد بيانات الموعد المؤكد (التاريخ/الوقت) ليُخبر المواطن
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
