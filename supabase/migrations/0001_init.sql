-- 0001_init.sql

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  age integer not null,
  weight_kg numeric not null,
  height_cm numeric not null,
  sex text not null check (sex in ('male','female')),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null check (goal in ('lose','maintain','gain')),
  target_weight_kg numeric,
  target_date date,
  daily_calories numeric not null,
  daily_carbs_g numeric not null,
  daily_protein_g numeric not null,
  daily_fat_g numeric not null,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_owner_all" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  photo_url text,
  user_note text,
  ai_raw_description text,
  calories numeric not null,
  carbs_g numeric not null,
  protein_g numeric not null,
  fat_g numeric not null,
  created_at timestamptz not null default now()
);

alter table public.meal_logs enable row level security;

create policy "meal_logs_owner_all" on public.meal_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index meal_logs_user_logged_at_idx on public.meal_logs (user_id, logged_at desc);

create table public.insulin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  logged_at timestamptz not null default now(),
  units numeric not null,
  meal_log_id uuid references public.meal_logs(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.insulin_logs enable row level security;

create policy "insulin_logs_owner_all" on public.insulin_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index insulin_logs_user_logged_at_idx on public.insulin_logs (user_id, logged_at desc);

-- Storage bucket for meal photos, private, path convention: {user_id}/{meal_log_id}.jpg
insert into storage.buckets (id, name, public) values ('meal-photos', 'meal-photos', false)
  on conflict (id) do nothing;

create policy "meal_photos_owner_select" on storage.objects
  for select using (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "meal_photos_owner_insert" on storage.objects
  for insert with check (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "meal_photos_owner_delete" on storage.objects
  for delete using (bucket_id = 'meal-photos' and auth.uid()::text = (storage.foldername(name))[1]);
