# VideoPlayer for ShareOS

A lightweight, modern cinema and video player web app for **ShareOS** (D-Link DNS-320L, DNS-320, DNS-325).

Designed specifically for low-power Kirkwood ARMv5 NAS devices (800 MHz / 1.0 GHz, 128–256 MB RAM) where server-side CPU video transcoding is impossible. All audio and video decoding takes place 100% on the client device (browser, phone, tablet, or Android TV / TV Box) using native HTML5 media capabilities with HTTP 206 Range requests for instant seeking.

---

## Features

1. **Zero Transcoding Architecture:**
   - Server CPU usage remains virtually 0% during video playback.
   - Streams `.mp4`, `.m4v`, `.webm`, `.mov`, and `.ogv` directly from NAS storage volumes (`home`, `Volume_1`, etc.) via `ShareOS.fs`.
   - Full HTTP Range request support for smooth scrubbing and instant seeking.

2. **Automatic Subtitle Sync & Conversion:**
   - Automatically detects `.srt` and `.vtt` subtitles in the same directory sharing the video's base name.
   - Built-in, ultra-fast JavaScript parser converts SubRip (`.srt`) files to WebVTT dynamically on-the-fly.
   - Allows loading external subtitle files from the box or local computer with one click.
   - Adjustable subtitle font sizes (Small, Normal, Large) with high-contrast cinema backgrounds (`::cue`).

3. **Responsive Dark Cinema Interface:**
   - Sleek dark-mode interface styled with ShareOS design tokens (`var(--sos-*)`).
   - Collapsible Media Library sidebar with folder scanning, video count, file size indicators, and real-time title search.
   - Aspect ratio toggle: Fit to screen (`contain`), 16:9 Widescreen (`fill`), Fill/Crop (`cover`), and Original (`scale-down`).
   - Playback speed control (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
   - Picture-in-Picture (PiP) and Fullscreen support.

4. **TV Box & Remote Friendly:**
   - Full keyboard navigation and TV remote shortcut support:
     - `Space` / `K`: Play / Pause
     - `←` / `→`: Seek 5 seconds backward / forward
     - `J` / `L`: Seek 10 seconds backward / forward
     - `↑` / `↓`: Volume adjustment (5%)
     - `F`: Toggle Fullscreen
     - `M`: Toggle Mute
     - `C`: Toggle Subtitles on/off
     - `[` / `]`: Decrease / increase playback speed
     - `P`: Toggle Picture-in-Picture
     - `N`: Next video in playlist

5. **Integrated with ShareOS File Browser:**
   - Associated with `.mp4`, `.m4v`, `.webm`, `.mov`, and `.ogv` files: double-clicking a video in ShareOS opens VideoPlayer immediately.

---

## Requirements

- **Firmware:** ShareOS 0.2.0-beta.1 or newer.
- **Permissions:** `files` (to read media files from NAS storage).
- **Supported Formats:** Standard HTML5 video containers and codecs supported by the client browser (e.g. H.264/AAC in `.mp4`, VP8/VP9/AV1 in `.webm`).

