# Photo Upload/Camera Choice

## Problem
`PhotoCapture.tsx` forces `capture="environment"` — only opens the camera, no gallery option.

## Design
`PhotoCapture.tsx`: two buttons side by side, each a `<label>` wrapping a hidden `<input type="file" accept="image/*">`:
- 「拍照」— input has `capture="environment"`
- 「从相册选」— input has no `capture` attribute (browser shows file/gallery picker)

Both call the same `onCapture(file)` prop. No changes needed downstream (`/log` page already just receives a `File`).

## Out of scope
- Multi-file selection, drag-and-drop.
