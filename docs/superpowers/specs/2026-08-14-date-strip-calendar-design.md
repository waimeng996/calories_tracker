# Scrollable Date Strip + Calendar Picker

## Problem
Dashboard date strip (`app/(app)/page.tsx`) only shows the current Monday-first week (7 days) — no way to browse further back or jump to an arbitrary past date/month.

## Design
- New client component `components/DateStrip.tsx` replaces the inline week-strip JSX:
  - Renders `dateKeys` (ascending) in a horizontally-scrollable row (`overflow-x-auto`), each date a `Link` to `/?date=...` like before.
  - `useEffect` + `scrollIntoView({inline:'center'})` on the selected date's ref on mount/date-change, so opening the dashboard lands scrolled to the selected day.
  - A 📅 icon button next to the strip is a native `<input type="date">` (transparent, overlaid) — `max` capped at the strip's last date (today), `onChange` navigates to `/?date=<picked>`. Native picker means arbitrary past months are reachable with zero custom calendar UI.
- `page.tsx`: `weekDateKeys()` (Monday-first, 7 days) replaced with `recentDateKeys()` (ascending, last 60 days ending today). Weekday label logic moves into `DateStrip` (derived from `getUTCDay()` per date, since the strip is no longer week-aligned).
- Dates older than the 60-day strip (reached only via the calendar picker) still render correctly — the dashboard's data query was never date-range-limited to the strip.

## Out of scope
- Infinite-scroll / lazy-loading older dates into the strip itself (60 days fixed is enough given the calendar picker covers anything older).
