# Changelog

## [1.0.1] - 2026-10-26
### Geändert
- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).
- Die App startete nicht (Zeilenumbruch in einer Zeichenkette).

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von SmartBudget für das ShareOS-Ökosystem.
- Zählerstandserfassung und Kostenkalkulation für Strom (kWh), Gas (m³) und Wasser (m³).
- Dashboard-Übersicht mit Gesamtverbrauch und Tarifpreisen.
- Integrierter CSV-Export für Excel und Auswertungen.
- Horizontale Sub-Header-Filterleiste für schnelle Zähler-Auswahl.
- Persistente Speicherung unter `energy/meter_readings.json` via `ShareOS.fs`.
