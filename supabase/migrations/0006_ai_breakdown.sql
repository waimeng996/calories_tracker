-- 0006_ai_breakdown.sql
-- Stores the AI's per-component reasoning (e.g. "bread 2 slices: 140kcal" /
-- "cooking oil 2 tbsp: 240kcal") alongside the final totals so it can be
-- reviewed later against the numbers it explains.

alter table public.meal_logs
  add column if not exists ai_breakdown text;
