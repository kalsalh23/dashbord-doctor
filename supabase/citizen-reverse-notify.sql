-- reverse notification to the citizen when reception approves an external booking:
--  1) per-booking topic  booking-{appointment_id}   → the citizen's booking page (دليل طبي) listens via SSE
--  2) per-patient topic  pt-{phone_digits}          → persistent channel for apps that subscribe patients by phone
create or replace function public.on_appointment_accepted()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_patient text;
  v_clinic text;
  v_phone text;
  v_msg text;
begin
  if old.status = 'new' and new.status in ('confirmed','arrived') then
    select full_name, phone into v_patient, v_phone from public.patients where id = new.patient_id;
    select name into v_clinic from public.clinics where id = new.clinic_id;

    -- internal notification for the doctor
    insert into public.notifications (clinic_id, target_role, title, body, type)
    values (
      new.clinic_id,
      'doctor',
      'تم قبول طلب الحجز',
      coalesce(v_patient, 'مريض') || ' — تم تأكيد موعده ' || new.appointment_date::text || ' الساعة ' || coalesce(new.start_time::text, ''),
      'booking'
    );

    v_msg := 'تم تأكيد حجز دورك في ' || coalesce(v_clinic, 'العيادة') ||
             ' يوم ' || new.appointment_date::text || ' الساعة ' || coalesce(new.start_time::text, '') ||
             '. ننتظرك في الموعد.';

    begin
      perform net.http_post(
        url := 'https://ntfy.sh/booking-' || new.id::text,
        headers := jsonb_build_object('X-Title', 'تم حجز دورك ✅', 'X-Priority', 'high', 'X-Cache', 'yes'),
        body := to_jsonb(v_msg),
        timeout_milliseconds := 5000
      );
    exception when others then null;
    end;

    if coalesce(v_phone, '') <> '' then
      begin
        perform net.http_post(
          url := 'https://ntfy.sh/pt-' || regexp_replace(v_phone, '\D', '', 'g'),
          headers := jsonb_build_object('X-Title', 'تم حجز دورك ✅', 'X-Cache', 'yes'),
          body := to_jsonb(v_msg),
          timeout_milliseconds := 5000
        );
      exception when others then null;
      end;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_appointment_accepted on public.appointments;
create trigger trg_appointment_accepted
after update on public.appointments
for each row execute function public.on_appointment_accepted();
