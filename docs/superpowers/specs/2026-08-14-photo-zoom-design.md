# Photo Zoom (meal log photos)

## Problem
Meal photo thumbnails in `MealCard` are 36x36px with no way to see the full image.

## Design
- New component `components/PhotoLightbox.tsx`: fixed full-screen overlay (`position: fixed; inset:0`), black/dim background, centered `<img>` at full resolution (object-fit: contain), close button (X, top-right), clicking the backdrop also closes.
- `MealCard.tsx`: thumbnail gets `onClick` only when `photoUrl` is not null (adds `cursor-pointer`); clicking sets local `useState<boolean>` open flag rendering `<PhotoLightbox src={photoUrl} onClose={...} />`.
- No pinch-zoom/pan — tap to open, tap to close, that's it.
- No new API/DB changes; reuses the already-signed `photoUrl` passed into `MealCard`.

## Out of scope
- Multi-photo galleries, pinch-to-zoom/pan, swipe between meals.
