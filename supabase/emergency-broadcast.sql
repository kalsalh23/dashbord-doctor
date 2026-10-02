-- emergency closure broadcast: apologize to ALL of today's patients in the doctor's
-- name, push to their channels, optionally cancel today's appointments for rebooking
create or replace function public.emergency_broadcast(p_note text default '', p_cancel boolean default true)
returns int
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_clinic uuid := (select clinic_id from public.profiles where id = auth.uid());
  v_doctor text := (select full_name from public.profiles where id = auth.uid());
  v_clinic_name text := (select name from public.clinics where id = v_clinic);
  v_count int := 0;
  r record;
  v_msg text;
begin
  if v_clinic is null then raise exception 'FORBIDDEN'; end if;
  if not (public.has_role('doctor') or public.is_admin()) then raise exception 'FORBIDDEN'; end if;

  for r in
    select a.id, a.start_time, p.full_name, p.phone
    from public.appointments a
    join public.patients p on p.id = a.patient_id
    where a.clinic_id = v_clinic
      and a.appointment_date = current_date
      and a.status in ('confirmed','new','arrived','waiting')
  loop
    v_msg := 'نعتذر منكم ' || coalesce(r.full_name, '') ||
             '، تعذر استقبال الحالات اليوم في ' || coalesce(v_clinic_name, 'العيادة') ||
             ' بسبب حالة إسعافية طارئة لدى ' || coalesce(v_doctor, 'الطبيب') || '. ' ||
             coalesce(nullif(p_note, ''), '') ||
             ' نرجو إعادة حجز موعدكم عبر دليل طبي أو بالاتصال بالعيادة. مع خالص تحياتنا، ' || coalesce(v_doctor, '');

    begin
      perform net.http_post(
        url := 'https://ntfy.sh/pt-' || regexp_replace(coalesce(r.phone, ''), '\D', '', 'g'),
        headers := jsonb_build_object('X-Title', 'إلغاء موعد اليوم — نعتذر', 'X-Priority', 'high', 'X-Cache', 'yes'),
        body := to_jsonb(v_msg),
        timeout_milliseconds := 5000
      );
    exception when others then null;
    end;

    begin
      perform net.http_post(
        url := 'https://ntfy.sh/booking-' || r.id::text,
        headers := jsonb_build_object('X-Title', 'إلغاء موعد اليوم — نعتذر', 'X-Cache', 'yes'),
        body := to_jsonb(v_msg),
        timeout_milliseconds := 5000
      );
    exception when others then null;
    end;

    v_count := v_count + 1;
  end loop;

  if p_cancel then
    update public.appointments
    set status = 'cancelled',
        notes = concat_ws(' — ', nullif(notes, ''), 'أُلغي بسبب حالة إسعافية')
    where clinic_id = v_clinic
      and appointment_date = current_date
      and status in ('confirmed','new','arrived','waiting');
  end if;

  insert into public.notifications (clinic_id, target_role, title, body, type)
  values (
    v_clinic,
    'reception',
    'حالة إسعافية — إلغاء مواعيد اليوم',
    'أُرسل اعتذار جماعي باسم ' || coalesce(v_doctor, 'الطبيب') || ' إلى ' || v_count ||
      ' مريض' || case when p_cancel then ' وأُلغيت مواعيدهم اليوم' else '' end ||
      '. يرجى الاتصال بالمرضى وترتيب إعادة الحجز.',
    'cancellation'
  );

  insert into public.audit_logs (clinic_id, user_id, action, details)
  values (v_clinic, auth.uid(), 'emergency_broadcast',
    jsonb_build_object('notified', v_count, 'cancelled', p_cancel, 'note', p_note));

  return v_count;
end $$;

grant execute on function public.emergency_broadcast(text, boolean) to authenticated;
