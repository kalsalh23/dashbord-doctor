-- doctor self-service settings: avatar + consultation price (doctor can change the clinic price)
alter table public.profiles add column if not exists avatar_url text;

-- public bucket for profile pictures (2MB limit)
insert into storage.buckets (id, name, public, file_size_limit)
values ('profile-avatars', 'profile-avatars', true, 2097152)
on conflict (id) do nothing;

drop policy if exists avatar_read on storage.objects;
create policy avatar_read on storage.objects for select to public, anon, authenticated
  using (bucket_id = 'profile-avatars');

drop policy if exists avatar_insert on storage.objects;
create policy avatar_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatar_update on storage.objects;
create policy avatar_update on storage.objects for update to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists avatar_delete on storage.objects;
create policy avatar_delete on storage.objects for delete to authenticated
  using (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- doctors (and clinic admins) may set their clinic's consultation price
create or replace function public.doctor_set_consultation_price(p_price numeric)
returns void
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  select clinic_id into cid from public.profiles where id = auth.uid();
  if cid is null then raise exception 'FORBIDDEN'; end if;
  if not (public.has_role('doctor') or public.is_admin()) then raise exception 'FORBIDDEN'; end if;
  if p_price is null or p_price < 0 then raise exception 'BAD_PRICE'; end if;
  update public.clinic_settings set consultation_price = p_price where clinic_id = cid;
end $$;

grant execute on function public.doctor_set_consultation_price(numeric) to authenticated;
