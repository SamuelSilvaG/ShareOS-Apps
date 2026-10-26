# Changelog

## [1.0.2] - 2026-10-26
### Geändert
- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## [1.0.1] - 2026-10-23
### Behoben
- Auf dem Handy bricht die Kopfleiste um, statt seitlich zu scrollen: Suche bzw. Mitte in eigener Zeile, Kontoname gekürzt, Versionsnummer ausgeblendet.

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von ExpenseTracker für das ShareOS-Ökosystem.
- Übersichtliches Finanz-Dashboard (Einnahmen, Ausgaben, Saldo) mit Monatsnavigation.
- Schnelle mobile Erfassung von Belegen mit Kategorien und Einnahmen-/Ausgaben-Umschalter.
- CSV-Exportkompatibilität für Tabellenkalkulationen wie SheetOS oder Excel.
- Monatsweise persistente Speicherung auf der Box unter `finances/YYYY-MM.json` via `ShareOS.fs`.
