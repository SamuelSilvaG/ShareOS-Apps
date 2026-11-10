# Changelog

## 1.0.3

- Single-instance window management: opening multiple video files from ShareOS file manager seamlessly reuses the existing player window instead of opening multiple duplicate windows, appending to the playlist and bringing the active player to focus.
- Media Library sidebar starts collapsed by default in both HTML and JS, avoiding visual flicker or closing animations on launch, maximizing the cinema viewport.

## 1.0.2

- Fixed autoplay when opening video files directly from ShareOS File Manager (`?file=<ticket>`).
- Implemented policy-compliant autoplay fallback: attempts full unmuted playback first; if modern browser Autoplay Policy blocks unmuted media without prior gesture, immediately starts playing muted without delay and displays an unmute prompt (`#unmute-banner`) that restores audio on the first user interaction anywhere in the window.
- Added direct ticket URL fallback and resilient `window.ShareOS` checking in `checkOpenedFile()`.
- Automatically collapse the Media Library sidebar when playing a single video or opening a standalone video file, keeping the full viewport focused on cinema playback.

## 1.0.1

- Added **Stop** button (`#btn-stop`) and `S` keyboard shortcut to stop playback, reset player state, and return to the video list.
- Fixed vertical/portrait video (`1080x1920`) layout sizing so the video stage stays constrained within the viewport and controls are never pushed off-screen.
- Improved mobile responsiveness and touch UX: dynamic viewport height (`100dvh`), header library toggle button with backdrop, auto-collapsing drawer on playback start, two-row touch-friendly controls, centered floating dropdown menus on small screens, and tap-to-reveal controls without accidental pause.
- Improved multi-audio track selector: keep the Audio Tracks menu always accessible, support `video.audioTracks` events (`addtrack`/`change`) with micro-seek on track switch, and provide a one-click copyable flag hint (`#enable-experimental-web-platform-features`) for Edge/Chromium.
- Documented browser and codec limitations (zero-transcoding constraints for `E-AC3`/`AC3`/`DTS`, `video.audioTracks` flag, and embedded `.mkv` subtitles) in `README.md`.

## 1.0.0

- Initial release for ShareOS (requires ShareOS 0.2.0-beta.9+, permission `files`).
- Direct HTTP Range streaming from box storage without server-side transcoding (ideal for D-Link DNS-320/320L/325).
- Automatic external subtitle detection (`.srt`, `.vtt`) with real-time in-browser conversion to WebVTT.
- Multiple audio tracks support: switch between embedded audio tracks (e.g. dub / original) or load external synchronized audio (.m4a, .mp3, .aac, .opus).
- Media Library sidebar with folder scanning, search filtering, and playlist navigation.
- Cinema UI that follows the ShareOS theme (light/dark, accent colour) with custom controls, autohide, volume scrub, and aspect ratio cycling.
- Full TV Box and keyboard remote shortcut support.
- Multilingual support: English, Portuguese, and German.

