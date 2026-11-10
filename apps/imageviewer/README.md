# ImageViewer for ShareOS

A fast, lightweight, and modern image viewer and photo gallery web app for **ShareOS** (D-Link DNS-320L, DNS-320, DNS-325).

Designed specifically for low-power Kirkwood ARMv5 NAS devices (800 MHz / 1.0 GHz, 128–256 MB RAM) where server-side image processing or heavy thumbnail databases waste precious CPU and RAM. All rendering, zoom, pan, and transformations take place 100% on the client device (browser, phone, tablet, or TV) using native browser rendering.

---

## Features

1. **Direct Box Streaming:**
   - Server CPU usage remains virtually 0%.
   - Streams `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`, `.svg`, `.bmp`, `.ico`, and `.avif` directly from NAS storage volumes (`home`, `Volume_1`, etc.) via `ShareOS.fs`.

2. **Smooth Interactive Zoom & Pan:**
   - Mouse wheel zoom centered at cursor position.
   - Click and drag pan when zoomed in.
   - Instant Fit to screen (`0`) and 1:1 pixel size (`1`).
   - Touch pinch-to-zoom and pan for mobile devices and tablets.

3. **Image Transformations:**
   - 90° clockwise and counter-clockwise rotation (`R`, `L`).
   - Horizontal flip mirror mode (`H`).

4. **Automated Slideshow:**
   - Hands-free photo presentation with 4-second transitions (`Space`).

5. **Integrated with ShareOS File Browser:**
   - Associated with all major image extensions: clicking an image in ShareOS opens ImageViewer immediately (`?file=<ticket>`).
   - Single-instance window management: opening multiple image files from the file manager reuses the same window instead of cluttering your desktop with duplicate tabs/windows.
   - Smart single-image mode: automatically collapses the sidebar gallery when opening a standalone image file, keeping the entire screen focused on the picture.

6. **Image Gallery & Folder Browsing:**
   - Media Library sidebar with folder scanning, file search filtering, and quick navigation.
   - Metadata badge (`I`) displaying resolution (width × height), file format, and size.

7. **TV & Remote Friendly Keyboard Shortcuts:**
   - `←` / `→`: Previous / Next image
   - `+` / `-` or `Mouse Wheel`: Zoom in / Zoom out
   - `0`: Fit to screen
   - `1`: Actual 1:1 pixel size
   - `R` / `L`: Rotate 90° CW / CCW
   - `H`: Flip horizontally
   - `Space`: Start / pause slideshow
   - `F`: Toggle Fullscreen
   - `I`: Toggle image details badge
   - `S` / `Esc`: Stop & return to gallery list

---

## Requirements

- ShareOS 0.2.0-beta.9 or newer.
- Permission `files` (granted in ShareOS User Management).

---

## License

GPL-2.0-or-later

