-- 0003_goal_override.sql
-- Persists whether the user explicitly overrode an unsafe goal pace at onboarding,
-- so the dashboard can keep showing a risk warning afterward (not just at onboarding time).

alter table public.profiles add column if not exists goal_override_accepted boolean not null default false;
