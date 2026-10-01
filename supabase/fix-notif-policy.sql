-- admins should see all clinic notifications regardless of target_role
drop policy if exists notifs_select on public.notifications;
create policy notifs_select on public.notifications for select to authenticated
  using (
    public.same_clinic(clinic_id)
    and (
      target_role = 'all'
      or target_role = public.current_role_name()
      or public.is_admin()
    )
  );
