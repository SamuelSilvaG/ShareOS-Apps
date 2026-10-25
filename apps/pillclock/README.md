# PillClock (`pillclock`)

Diskreter Medikamenten-Einnahmeplan & Vitalwerte-Tracker für das [ShareOS-Apps](https://github.com/UniqueDroid/ShareOS-Apps) Ökosystem.

## Features
- **Medikamenten-Management**: Einnahmezeiten, Dosierung und tägliches Abhaken per Klick.
- **Vitalwerte-Protokoll**: Erfassung von Blutdruck, Puls, Gewicht, Blutzucker und Temperatur.
- **Vollständige Datensouveränität**: Da sensible Gesundheitsdaten niemals das eigene Heimnetz oder VPN verlassen, speichert PillClock alle Einträge verschlüsselt bzw. direkt unter `health/meds_vitals.json` auf der Box via `ShareOS.fs`.
