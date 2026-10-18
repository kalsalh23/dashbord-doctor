-- Allow doctors to update their own clinic's settings (price, slot minutes, etc.)
-- The existing settings_write policy only allows admins; doctors need to save
-- their own consultation price and slot minutes from DoctorSettings.jsx.
drop policy if exists settings_write_doctor on public.clinic_settings;
create policy settings_write_doctor on public.clinic_settings
for update to authenticated
using (public.same_clinic(clinic_id))
with check (public.same_clinic(clinic_id));