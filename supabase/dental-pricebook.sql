-- جدول أسعار علاجات الأسنان (أسعاري): فئة × علاج × سعر × لون
create table if not exists public.dental_pricebook (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  category text not null,
  treatment text not null,
  price numeric(12,2) not null default 0,
  color text not null default '#0d9488',
  created_at timestamptz not null default now()
);
create index if not exists dental_pricebook_clinic_idx on public.dental_pricebook (clinic_id, category);

alter table public.dental_pricebook enable row level security;

drop policy if exists dpb_select on public.dental_pricebook;
create policy dpb_select on public.dental_pricebook for select to authenticated
  using (public.same_clinic(clinic_id));
drop policy if exists dpb_write on public.dental_pricebook;
create policy dpb_write on public.dental_pricebook for all to authenticated
  using (public.same_clinic(clinic_id)) with check (public.same_clinic(clinic_id));

-- السماح للطبيب بتسجيل وتعديل الدفعات (كان محصوراً بالاستقبال والمدير)
drop policy if exists payments_insert on public.payments;
create policy payments_insert on public.payments for insert to authenticated
  with check (public.same_clinic(clinic_id));
drop policy if exists payments_update on public.payments;
create policy payments_update on public.payments for update to authenticated
  using (public.same_clinic(clinic_id)) with check (public.same_clinic(clinic_id));

-- السماح بحذف دفعة وزيارة (لحذف صفوف سجل اليوم)
drop policy if exists payments_delete on public.payments;
create policy payments_delete on public.payments for delete to authenticated
  using (public.same_clinic(clinic_id));
drop policy if exists visits_delete on public.visits;
create policy visits_delete on public.visits for delete to authenticated
  using (public.same_clinic(clinic_id));
