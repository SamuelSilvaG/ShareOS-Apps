# Changelog

## [2.0.1] - 2026-10-26
### Geändert
- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## [2.0.0] - 2026-10-24
### Geändert
- **Echte Prüfungen von der Box aus** statt Zufallswerten – über die neue Berechtigung `netcheck` (ShareOS 0.2.0-beta.11, nur Administratoren).
- Je Host eine Prüfung: **Ping** (Antworten, Verlust, Latenz), **Port** (z. B. SSH 22) oder **Webadresse** (HTTP-Status, Zertifikat).
- Automatisch prüfen (aus, 30 s, 1 min, 5 min) oder „Alle prüfen“; Verlauf der letzten 24 Ergebnisse und „x % erreichbar“ je Host; Fehlergrund bei Offline.
- Keine Beispiel-Hosts mehr; die Beispiele aus 1.x werden aus der Liste entfernt.

## [1.1.0] - 2026-10-23
### Fixes
- **ShareOS.fs & LocalStorage Fallback**: Behebt Speicherprobleme auf der Box und speichert Daten ausfallsicher im Browser.
