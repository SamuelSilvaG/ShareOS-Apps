# Changelog

## 1.0.1

- Fixed image opening zoom to default to 1:1 actual pixel resolution instead of shrinking into a tiny thumbnail.
- Fixed single-instance window management: opening multiple images from ShareOS file manager seamlessly reuses the existing viewer window instead of cluttering the desktop with duplicate windows.
- Fixed sidebar gallery drawer to start collapsed by default in both HTML and JS, avoiding visual flicker or closing animations on launch.

## 1.0.0

- Initial release for ShareOS (requires ShareOS 0.2.0-beta.9+, permission `files`).
- Direct high-resolution image streaming from box storage without server transcoding.
- Interactive smooth zoom & pan: mouse wheel zoom centered at cursor, drag-to-pan, fit-to-screen (`0`), and actual 1:1 pixel size (`1`).
- Touch gestures for mobile and tablets: pinch-to-zoom, single-finger pan when zoomed, horizontal swipe navigation, and double-tap toggle.
- Image transformations: 90° clockwise and counter-clockwise rotation (`R`, `L`), and horizontal flip mirror (`H`).
- Automated slideshow mode with 4-second intervals and pause toggle (`Space`).
- Image Gallery sidebar drawer with instant search filtering, thumbnail placeholders, and folder browsing via `ShareOS.fs`.
- Fullscreen mode (`F`), image metadata badge (`I`) displaying resolution and size, and keyboard & remote shortcut support.
- Multilingual support: English, Portuguese, and German.

