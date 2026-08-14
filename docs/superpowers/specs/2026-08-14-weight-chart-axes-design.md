# Weight Chart Axis Labels + Tap Tooltip

## Problem
`WeightSection.tsx`'s 30-day weight chart is a bare polyline — no axis labels, no way to read an exact kg value for a given day.

## Design
- `plotPoints()` replaces `buildPolylinePoints()`: same normalization, but reserves padding (`PAD_LEFT/RIGHT/TOP/BOTTOM`) around the plot area for axis labels, and returns `{x,y}` coordinates instead of a string (so points can be reused for the line, dots, and labels).
- Y-axis: min/max kg values as `<text>` at top-left and bottom-left of the plot.
- X-axis: ≤5 evenly-spaced date labels (`MM/DD`) along the bottom, regardless of how many days of data (30 days would be too crowded to label every point).
- Each data point gets a small circle (visible r=2.5, invisible hit-area r=8 for tap reliability), `onClick` toggles `selectedIndex` state.
- Selected point shows a small dark tooltip (`<rect>` + `<text>`) above the dot with `{kg}kg {date}`, clamped to stay inside the chart bounds.
- Tap same point again (or tap another point) to change/close the tooltip — no outside-tap-to-dismiss (kept simple; re-tapping the dot is enough).

## Out of scope
- Hover-based (desktop mouse) tooltips — touch tap only, per mobile-first app.
- Changing the 30-day window or the moving-average line logic.
