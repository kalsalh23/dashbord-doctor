-- staff notifications -> Web Push (VAPID) via the send-push edge function (unlimited, free)
create or replace function public.push_notification_to_staff()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_secret text := 'PUSH_SECRET_9ed4199c2859459c86fc2216';
begin
  if new.clinic_id is null then
    return new;
  end if;
  begin
    perform net.http_post(
      url := 'https://lucnobmmrqujhgbhmciz.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', v_secret
      ),
      body := jsonb_build_object(
        'clinicId', new.clinic_id,
        'targetRole', new.target_role,
        'userId', new.user_id,
        'title', coalesce(new.title, 'إشعار جديد'),
        'body', coalesce(new.body, '')
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    null; -- never block inserts because of push failures
  end;
  return new;
end $$;

drop trigger if exists trg_notifications_push on public.notifications;
create trigger trg_notifications_push
after insert on public.notifications
for each row execute function public.push_notification_to_staff();
