-- the doctor (clinic owner) may also delete expenses, not just admins
drop policy if exists expenses_delete on public.expenses;
create policy expenses_delete on public.expenses for delete to authenticated
  using ((public.has_role('doctor') or public.is_admin()) and public.same_clinic(clinic_id));
