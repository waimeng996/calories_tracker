# Edit Meal Log + Richer Card Info

## Problem
`meal_logs` rows can only be deleted, never corrected (e.g. wrong insulin units, AI mis-analyzed a macro). The dashboard's meal card also only shows time + calories, hiding carbs/protein/fat that are already in the row.

## Design

### Card info (`components/MealCard.tsx`)
Add a second line under the existing `{time} · {kcal}kcal · 💉{insulin}u` line: `碳水{carbs}g · 蛋白{protein}g · 脂肪{fat}g`. Requires `app/(app)/page.tsx` to pass `carbsG`/`proteinG`/`fatG` props (already selected via `select('*')`, just not threaded through).

### Edit API
New `PATCH` handler in `app/api/meal-logs/[id]/route.ts`, alongside the existing `DELETE`:
- Body: `{ description?, calories?, carbsG?, proteinG?, fatG?, insulinUnits? }` — all optional, only provided fields are updated.
- Same auth/ownership check pattern as `DELETE` (`.eq('id', params.id).eq('user_id', user.id)`), returns 401/404 the same way.
- Basic validation: `calories/carbsG/proteinG/fatG` must be finite numbers ≥ 0 if provided; `insulinUnits` ≥ 0 or `null`.

### Edit UI
New `components/MealEditModal.tsx` (client component), modeled on the existing modal-ish patterns in the app (fixed overlay like `PhotoLightbox`, form fields like `/log`'s edit form):
- Fields: 食物描述 (text), calories/碳水/蛋白/脂肪 (number), 胰岛素 units (number, optional).
- Save button → `PATCH /api/meal-logs/{id}`; on success closes modal + `router.refresh()`. On failure shows inline error, stays open.
- Cancel / backdrop click closes without saving.

### Trigger
`MealCard.tsx`: the text block (description + time/macros — everything except the photo thumbnail and delete button) becomes `onClick`-able, opening `MealEditModal` pre-filled with the row's current values. Delete button keeps its own click handler (`stopPropagation` not needed since it's a sibling, not nested inside the new clickable area).

## Out of scope
- Editing `meal_type` (moving a meal between breakfast/lunch/dinner/snack sections) or `logged_at`/time.
- Editing/replacing the photo.
