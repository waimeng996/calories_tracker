-- 0004_meal_type_insulin.sql
-- Adds meal categorization and inline insulin logging to meal_logs, per the
-- dashboard/log UI-UX redesign: insulin is now recorded as part of a meal
-- (not a standalone log) and meals are grouped by breakfast/lunch/dinner/snack.

alter table public.meal_logs
  add column if not exists meal_type text not null default 'snack'
    check (meal_type in ('breakfast','lunch','dinner','snack')),
  add column if not exists insulin_units numeric;
