-- emergency_broadcast with target date
DROP FUNCTION IF EXISTS public.emergency_broadcast(text, boolean);
DROP FUNCTION IF EXISTS public.emergency_broadcast(text, boolean, date);

CREATE OR REPLACE FUNCTION public.emergency_broadcast(p_note text DEFAULT '', p_cancel boolean DEFAULT true, p_date date DEFAULT current_date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $
declare
  v_clinic uuid := (select clinic_id from public.profiles where id = auth.uid());
  v_doctor text := (select full_name from public.profiles where id = auth.uid());
  v_clinic_name text := (select name from public.clinics where id = v_clinic);
  v_count int := 0;
  r record;
  v_list jsonb := '[]'::jsonb;
  v_target_date date := coalesce(p_date, current_date);
begin
  if v_clinic is null then raise exception 'FORBIDDEN'; end if;
  if not (public.has_role('doctor') or public.is_admin()) then raise exception 'FORBIDDEN'; end if;

  for r in
    select a.id, a.start_time, p.full_name, p.phone
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.clinic_id = v_clinic
      and a.appointment_date = v_target_date
      and a.status in ('confirmed','new','arrived','waiting','in_consultation')
  loop
    v_list := v_list || jsonb_build_object(
      'id', r.id, 'start_time', r.start_time,
      'patient_name', r.full_name, 'phone', r.phone
    );
    v_count := v_count + 1;
  end loop;

  if p_cancel then
    update public.appointments
    set status = 'cancelled',
        notes = concat_ws(' — ', nullif(notes, ''), '????? ???? ???? ???????')
    where clinic_id = v_clinic
      and appointment_date = v_target_date
      and status in ('confirmed','new','arrived','waiting','in_consultation');
  end if;

  insert into public.notifications (clinic_id, target_role, title, body, type)
  values (
    v_clinic,
    'reception',
    '???? ??????? — ????? ?????? ?????',
    '????? ?????? ????? ???? ' || coalesce(v_doctor, '??????') || ' ??? ' || v_count || ' ???? ??????? ???????? ????? ??????? ????? ?????.',
    'cancellation'
  );

  insert into public.audit_logs (clinic_id, user_id, action, details)
  values (v_clinic, auth.uid(), 'emergency_broadcast',
    jsonb_build_object('notified', v_count, 'cancelled', p_cancel, 'note', p_note, 'date', v_target_date));

  return jsonb_build_object('count', v_count, 'cancelled', p_cancel, 'list', v_list, 'date', v_target_date);
end $;

GRANT EXECUTE ON FUNCTION public.emergency_broadcast(text, boolean, date) TO authenticated;

