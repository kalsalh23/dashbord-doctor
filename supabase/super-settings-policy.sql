-- super admin can edit any clinic's settings (price, reminder template, ...)
drop policy if exists settings_write_super on public.clinic_settings;
create policy settings_write_super on public.clinic_settings for all to authenticated
  using (public.is_super()) with check (public.is_super());
