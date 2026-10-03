-- prescription template footer lines (per clinic, editable from settings)
alter table public.clinic_settings
  add column if not exists prescription_footer1 text not null default 'يرجى عرض العلاج قبل الاستعمال',
  add column if not exists prescription_footer2 text not null default 'المراجعة المعلنية خلال أسبوع فقط';
