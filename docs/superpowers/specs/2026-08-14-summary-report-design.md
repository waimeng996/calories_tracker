# Summary Report

## Problem
No way to see calorie deficit/surplus or weight change summarized over a chosen time range — only single-day dashboard view exists.

## Design

### Route
`app/(app)/report/page.tsx`, server component (same pattern as the dashboard page — queries Supabase directly, no new API route). Query params: `from`, `to` (`YYYY-MM-DD`). Default when absent: last 30 days ending today.

### Range picker
`components/ReportRangePicker.tsx` (client component): 7/30/90-day quick buttons + two `<input type="date">` for a custom range. All three write `?from=&to=` via `router.push` — the report page itself only ever reads resolved `from`/`to`, no preset-vs-custom branching server-side.

### Metrics (all computed server-side from `meal_logs` + `weight_logs` rows in `[from, to]`)
- **Days with data**: distinct calendar dates (Malaysia local, via `toMalaysiaLocal`) that have ≥1 meal log. Shown as "logged X / Y days" (Y = calendar days in range).
- **Calorie deficit/surplus**: computed only over logged days — `sum(target - consumed)` per logged day, where `target = profile.daily_calories` (today's target, applied uniformly; the app has no historical target log, so a mid-range target change won't be reflected — acceptable known limitation). Un-logged days are excluded rather than counted as 0 consumed, so missing logs don't fabricate a huge deficit. Positive = net deficit, negative = net surplus.
- **Average daily calories/macros**: total consumed (calories, carbs, protein, fat) / number of logged days.
- **Weight change**: new `summarizeRangeWeightChange()` in `lib/nutrition.ts` (sits next to `summarizeWeightTrend`, reuses its `MAX_SAFE_WEEKLY_CHANGE_*` constants) — first vs. last weight log in range, `changeKg`, `weeklyChangeKg` normalized by actual days between those two logs, `isSafe` flag using the existing safe-rate threshold.
- **Total insulin units**: sum of `insulin_units` across all meal logs in range; section hidden entirely if zero rows have a value.

### Entry point
📊 icon next to the dashboard's date strip / calendar icon, linking to `/report`.

## Out of scope
- Historical daily-target tracking (deficit calc always uses the current target).
- Charts/graphs on the report page — numbers + short text only, matching the rest of the app's density.
