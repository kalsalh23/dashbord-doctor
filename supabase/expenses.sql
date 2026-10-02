-- clinic expenses (salaries, equipment, supplies, anything)
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  title text not null,
  amount numeric(12,2) not null default 0 check (amount >= 0),
  category text not null default 'other' check (category in ('salary','supplies','equipment','rent','maintenance','other')),
  expense_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists expenses_clinic_date_idx on public.expenses (clinic_id, expense_date desc);

alter table public.expenses enable row level security;

create policy expenses_select on public.expenses for select to authenticated
  using (public.same_clinic(clinic_id));
create policy expenses_insert on public.expenses for insert to authenticated
  with check (
    public.same_clinic(clinic_id)
    and (public.has_role('reception') or public.has_role('doctor') or public.is_admin())
  );
create policy expenses_update on public.expenses for update to authenticated
  using ((public.has_role('reception') or public.is_admin()) and public.same_clinic(clinic_id))
  with check ((public.has_role('reception') or public.is_admin()) and public.same_clinic(clinic_id));
create policy expenses_delete on public.expenses for delete to authenticated
  using (public.is_admin() and public.same_clinic(clinic_id));
