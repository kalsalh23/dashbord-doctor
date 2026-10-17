-- reverse notification to the citizen when reception approves an external booking:
-- internal notification for the doctor (جرس الإشعارات + إشعار المتصفح المجاني)
create or replace function public.on_appointment_accepted()
returns trigger
language plpgsql
security definer
set search_path to public
as $$
declare
  v_patient text;
begin
  if old.status = 'new' and new.status in ('confirmed','arrived') then
    select full_name into v_patient from public.patients where id = new.patient_id;

    -- internal notification for the doctor
    insert into public.notifications (clinic_id, target_role, title, body, type)
    values (
      new.clinic_id,
      'doctor',
      'تم قبول طلب الحجز',
      coalesce(v_patient, 'مريض') || ' — تم تأكيد موعده ' || new.appointment_date::text || ' الساعة ' || coalesce(new.start_time::text, ''),
      'booking'
    );
  end if;
  return new;
end $$;

drop trigger if exists trg_appointment_accepted on public.appointments;
create trigger trg_appointment_accepted
after update on public.appointments
for each row execute function public.on_appointment_accepted();
