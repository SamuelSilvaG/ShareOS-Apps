# Changelog

## 1.0.1

- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## 1.0.0

- First release (draft by Jan, made to work with the box): media jobs run on the box with FFmpeg through `ShareOS.media` (permission `media`, ShareOS 0.2.0-beta.5+); the system app `ffmpeg` comes along from the store (`"requires"`).
- Source and target folder with the box's file dialog (`ShareOS.fs.pick`), file details from `ffprobe` (length, size, video, audio and subtitle tracks).
- *Audio umwandeln / herausholen*: MP3, M4A (AAC), Opus, FLAC, WAV or the track as it is; bitrate, choice of audio track. *Container wechseln*: MP4, MKV, MOV, TS, WebM without re-encoding. *Ausschnitt* with start and length.
- Preview of the FFmpeg call the box runs; jobs with progress, cancel, remove; results go to the WinWeb Player or become the next source.
- No video re-encoding (the box's CPU is far too slow for it), no uploads from the computer: the files are on the box.
- ShareOS look, light and dark, every accent colour.
