-- ============================================================
-- عيادة الدكتور محمد عارف عبد الرحمن: نسخ تفاصيل وإضافات
-- عيادة الدكتور مازن العوض (تخصص الأسنان) — دفتر الأسعار + الأدوية الشائعة
-- ============================================================
insert into public.dental_pricebook (clinic_id, category, treatment, price, color, created_at)
select '0015c9f9-c90e-496e-a65b-2ad04a85be8e', d.category, d.treatment, d.price, d.color, now()
from public.dental_pricebook d
where d.clinic_id = 'feae3070-7837-4f7d-9353-b7139784d229'
  and not exists (
    select 1 from public.dental_pricebook x
    where x.clinic_id = '0015c9f9-c90e-496e-a65b-2ad04a85be8e'
  );

insert into public.doctor_favorite_medications (clinic_id, doctor_id, name, dosage, duration, instructions, created_at)
select '0015c9f9-c90e-496e-a65b-2ad04a85be8e', '1bc8018d-28eb-4cef-a450-1594ed38198e', f.name, f.dosage, f.duration, f.instructions, now()
from public.doctor_favorite_medications f
where f.clinic_id = 'feae3070-7837-4f7d-9353-b7139784d229'
  and not exists (
    select 1 from public.doctor_favorite_medications y
    where y.clinic_id = '0015c9f9-c90e-496e-a65b-2ad04a85be8e'
  );

select
  (select count(*) from public.dental_pricebook where clinic_id = '0015c9f9-c90e-496e-a65b-2ad04a85be8e') as prices_arif,
  (select count(*) from public.doctor_favorite_medications where clinic_id = '0015c9f9-c90e-496e-a65b-2ad04a85be8e') as favorites_arif,
  (select count(*) from public.dental_pricebook where clinic_id = 'feae3070-7837-4f7d-9353-b7139784d229') as prices_mazen,
  (select count(*) from public.doctor_favorite_medications where clinic_id = 'feae3070-7837-4f7d-9353-b7139784d229') as favorites_mazen;
