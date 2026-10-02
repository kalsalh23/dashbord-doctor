-- per-device web push subscriptions (staff): unlimited, free, standard Web Push
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  role text not null default 'reception',
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

create policy subs_select on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());
create policy subs_insert on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid() and public.same_clinic(clinic_id));
create policy subs_delete on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
