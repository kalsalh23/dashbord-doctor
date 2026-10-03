-- public bucket for clinic prescription branding assets
insert into storage.buckets (id, name, public, file_size_limit)
values ('clinic-assets', 'clinic-assets', true, 5242880)
on conflict (id) do nothing;

drop policy if exists clinic_assets_read on storage.objects;
create policy clinic_assets_read on storage.objects for select to public, anon, authenticated
  using (bucket_id = 'clinic-assets');

drop policy if exists clinic_assets_write on storage.objects;
create policy clinic_assets_write on storage.objects for insert to authenticated
  with check (bucket_id = 'clinic-assets' and (storage.foldername(name))[1] = public.current_clinic_id()::text);

drop policy if exists clinic_assets_update on storage.objects;
create policy clinic_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'clinic-assets' and (storage.foldername(name))[1] = public.current_clinic_id()::text)
  with check (bucket_id = 'clinic-assets' and (storage.foldername(name))[1] = public.current_clinic_id()::text);

drop policy if exists clinic_assets_delete on storage.objects;
create policy clinic_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'clinic-assets' and (storage.foldername(name))[1] = public.current_clinic_id()::text);
