-- ============================================================
-- إشعار واحد لكل حدث: web push + إشعار المتصفح يَستخدمان نفس الوسم (tag)
-- فيستبدل أحدهما الآخر بدل أن يتكدّس على الشاشة
-- ============================================================

create or replace function public.push_notification_to_staff()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  v_secret text := 'PUSH_SECRET_3710e77462498c88717aa769';
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
        'tag', 'clinic-' || new.id::text,
        'title', coalesce(new.title, 'إشعار جديد'),
        'body', coalesce(new.body, '')
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    null; -- لا تُعطّل الإدراج بسبب فشل الدفع
  end;
  return new;
end $$;
