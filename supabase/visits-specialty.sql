-- specialty data fields per visit (jsonb) + full specialties support
alter table public.visits add column if not exists specialty_data jsonb;
