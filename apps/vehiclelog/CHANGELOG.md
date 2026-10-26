# Changelog

## [1.0.1] - 2026-10-26
### Geändert
- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von VehicleLog für das ShareOS-Ökosystem.
- Digitales Fahrtenbuch mit Erfassung von Fahrten, Betankungen/Ladevorgängen und Werkstattkosten.
- Automatische Berechnung von Gesamtkilometern, Durchschnittsverbrauch (l/100km bzw. kWh/100km) und Kosten pro Kilometer.
- Horizontale Sub-Header-Filterleiste für schnelle Typ-Filterung.
- Integrierter CSV-Export für Finanzamt, Steuererklärung oder Excel.
- Persistente Speicherung unter `vehicle/logbook.json` via `ShareOS.fs`.
