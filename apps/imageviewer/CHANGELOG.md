# Changelog

## 1.0.1

- Single-instance window management: opening multiple image files from ShareOS file manager reuses the existing viewer window over a dedicated channel instead of opening duplicate windows.
- Fixed transferred image loading in primary window to show the newly selected file instead of the window's original file.
- Preserved fit-to-screen default for images that don't fit with swipe navigation on touch devices, and maintained the 100% cap preventing small images from upscaling.
- Fixed hand-over screen styling to use ShareOS theme tokens and increased handshake timeout.
- Fixed sidebar gallery drawer to start collapsed by default in both HTML and JS, avoiding visual flicker or closing animations on launch.

## 1.0.0

- Initial release for ShareOS (requires ShareOS 0.2.0-beta.9+, permission `files`).
- Direct high-resolution image streaming from box storage without server transcoding.
- Interactive smooth zoom & pan: mouse wheel zoom centered at cursor, drag-to-pan, fit-to-screen (0), and actual 1:1 pixel size (1).
- Touch gestures for mobile and tablets: pinch-to-zoom, single-finger pan when zoomed, horizontal swipe navigation, and double-tap toggle.
- Image transformations: 90° clockwise and counter-clockwise rotation (`R`, `L`), and horizontal flip mirror (`H`).
- Automated slideshow mode with 4-second intervals and pause toggle (`Space`).
- Image Gallery sidebar drawer with instant search filtering, thumbnail placeholders, and folder browsing via `ShareOS.fs`.
- Smart single-image mode: automatically collapses the sidebar gallery when opening a standalone image file, maximizing view area.
- Fullscreen mode (`F`), image metadata badge (`I`) displaying resolution and size, and keyboard & remote shortcut support.
- Multilingual support: English, Portuguese, and German.

