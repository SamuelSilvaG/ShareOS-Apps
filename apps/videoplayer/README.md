# VideoPlayer for ShareOS

A lightweight, modern cinema and video player web app for **ShareOS** (D-Link DNS-320L, DNS-320, DNS-325).

Designed specifically for low-power Kirkwood ARMv5 NAS devices (800 MHz / 1.0 GHz, 128–256 MB RAM) where server-side CPU video transcoding is impossible. All audio and video decoding takes place 100% on the client device (browser, phone, tablet, or Android TV / TV Box) using native HTML5 media capabilities with HTTP 206 Range requests for instant seeking.

---

## Features

1. **Zero Transcoding Architecture:**
   - Server CPU usage remains virtually 0% during video playback.
   - Streams `.mp4`, `.m4v`, `.webm`, `.mkv`, `.mov`, and `.ogv` directly from NAS storage volumes (`home`, `Volume_1`, etc.) via `ShareOS.fs`.
   - Full HTTP Range request support for smooth scrubbing and instant seeking.

2. **Automatic External Subtitle Sync & Conversion:**
   - Automatically detects external `.srt` and `.vtt` subtitle files in the same directory sharing the video's base name.
   - Built-in, ultra-fast JavaScript parser converts SubRip (`.srt`) files to WebVTT dynamically on-the-fly.
   - Allows loading external subtitle files from the box or local computer with one click (or drag-and-drop).
   - Adjustable subtitle font sizes (Small, Normal, Large) with high-contrast cinema backgrounds (`::cue`).

3. **Multiple Audio Track Switching:**
   - Switches between multiple embedded audio tracks (e.g. Dual Audio: Portuguese Dubbed / Japanese or English Original) via HTML5 `video.audioTracks`.
   - Allows loading external synchronized audio files (`.m4a`, `.mp3`, `.aac`, `.opus`, `.ogg`) in any browser.

4. **Responsive Cinema Interface:**
   - Follows the ShareOS theme (`/_shareos/theme.css`): light/dark mode and the accent colour of the box; the video stage and its controls stay cinema-black.
   - Collapsible Media Library sidebar with folder scanning, video count, file size indicators, and real-time title search.
   - Aspect ratio toggle: Fit to screen (`contain`), 16:9 Widescreen (`fill`), Fill/Crop (`cover`), and Original (`scale-down`).
   - Playback speed control (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x).
   - Picture-in-Picture (PiP) and Fullscreen support.

5. **TV Box & Remote Friendly:**
   - Full keyboard navigation and TV remote shortcut support:
     - `Space` / `K`: Play / Pause
     - `S`: Stop playback & return to video list
     - `←` / `→`: Seek 5 seconds backward / forward
     - `J` / `L`: Seek 10 seconds backward / forward
     - `↑` / `↓`: Volume adjustment (5%)
     - `F`: Toggle Fullscreen
     - `M`: Toggle Mute
     - `C`: Toggle Subtitles on/off
     - `[` / `]`: Decrease / increase playback speed
     - `P`: Toggle Picture-in-Picture
     - `N`: Next video in playlist

6. **Integrated with ShareOS File Browser:**
   - Associated with `.mp4`, `.m4v`, `.webm`, `.mkv`, `.mov`, and `.ogv` files: double-clicking a video in ShareOS opens VideoPlayer immediately.

---

## Browser & Codec Limitations (Zero-Transcoding Constraints)

Because the NAS streams files directly without server-side FFmpeg re-encoding, playback depends on the codecs and features supported natively by your web browser:

1. **Audio Codecs (`E-AC3` / `AC3` / `DTS`):**
   - **AAC, MP3, Opus, Vorbis, FLAC:** Supported natively by all modern browsers (Chrome, Edge, Firefox, Safari).
   - **Dolby Digital (`AC3`) & Dolby Digital Plus (`E-AC3` / `DDP`):** Supported natively in **Microsoft Edge** (on Windows, via Windows Media Foundation) and **Safari** (macOS/iOS). Standard **Google Chrome** and **Firefox** do not ship licensed Dolby decoders — videos with `E-AC3`/`AC3` audio will play without sound in Chrome/Firefox unless opened in Edge/Safari or converted to AAC using the **MediaTranscoder** app.
   - **DTS / TrueHD:** Not supported natively by web browsers. Use **MediaTranscoder** to convert the audio track to AAC/Opus or load an external audio track.

2. **Embedded Multi-Audio Switching (`video.audioTracks`):**
   - Switching between multiple audio tracks embedded inside an `.mkv` or `.mp4` file uses the HTML5 `HTMLMediaElement.audioTracks` API.
   - Works out-of-the-box in **Safari**.
   - In **Microsoft Edge** and **Google Chrome**, this API is disabled by default behind an experimental flag. To enable embedded Dual-Audio switching:
     1. Open `edge://flags/#enable-experimental-web-platform-features` (or `chrome://flags/#enable-experimental-web-platform-features`).
     2. Set **Experimental Web Platform features** to **Enabled** and restart the browser.
   - *(External audio tracks loaded via "Load External Audio..." work in all browsers without any flag).*

3. **Subtitles in `.mkv` Containers:**
   - Web browsers (`FFmpegDemuxer` in Chromium/Edge/Firefox) do **not** demux embedded text subtitle streams (`subt` / internal SRT / ASS / SSA) packed inside `.mkv` files.
   - To display subtitles, keep an external `.srt` or `.vtt` file in the same folder with the same base name as the video (detected automatically), or load an external `.srt`/`.vtt` file via the **Subtitles (`CC`)** button.

---

## Requirements

- **Firmware:** ShareOS 0.2.0-beta.9 or newer.
- **Permissions:** `files` (to read media files from NAS storage).
- **Supported Formats:** Standard HTML5 video containers and codecs supported by the client browser (e.g. H.264/HEVC/AAC/E-AC3 in `.mp4`/`.mkv` depending on browser, VP8/VP9/AV1/Opus in `.webm`).
