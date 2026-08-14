-- 0005_weight_logs.sql

create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.weight_logs enable row level security;

create policy "weight_logs_owner_all" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index weight_logs_user_date_idx on public.weight_logs (user_id, date desc);
