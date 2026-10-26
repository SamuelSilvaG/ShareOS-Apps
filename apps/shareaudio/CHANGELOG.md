# Changelog

## [1.0.3] - 2026-10-26
### Geändert
- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## [1.0.2] - 2026-10-24

### Changed
- Updated the version number that was previously forgotten.
- Adjusted CSS to ensure the UI fits narrow screens such as smartphones.

### Geändert
- Versionsnummer angepasst, die zuvor vergessen wurde.
- CSS angepasst, damit die Oberfläche auf schmale Bildschirme wie Smartphones passt.

## [1.0.1] - 2026-10-23

### Fixed
- Header wraps on mobile instead of scrolling horizontally: Search / center items moved to a dedicated line, account name truncated, version number hidden.

### Behoben
- Auf dem Handy bricht die Kopfleiste um, statt seitlich zu scrollen: Suche bzw. Mitte in eigener Zeile, Kontoname gekürzt, Versionsnummer ausgeblendet.

## [1.0.0] - 2026-10-23

### Added
- Initial release of ShareAudio for the ShareOS ecosystem.
- In-browser recording via MediaRecorder API.
- Audio visualizer with AudioContext canvas frequency bars.
- Persistent storage on the box under voice_memos/ via ShareOS.fs.
- Direct playback, download, and deletion functions for voice messages.

### Hinzugefügt
- Erstveröffentlichung von ShareAudio für das ShareOS-Ökosystem.
- Aufnahme über `MediaRecorder` API direkt im Browser.
- Audio-Visualizer mit `AudioContext` Canvas-Frequenzbalken.
- Persistente Speicherung auf der Box unter `voice_memos/` via `ShareOS.fs`.
- Direkte Wiedergabe, Download und Löschfunktion von Sprachnachrichten.
