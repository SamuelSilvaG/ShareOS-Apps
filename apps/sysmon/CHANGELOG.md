# Changelog

## [2.0.0] - 2026-10-24
### Geändert
- **Echte Werte der Box** statt Beispielwerten: CPU (aus zwei Messungen), Arbeitsspeicher, Temperatur und Lüfter, Laufzeit und Last, Netzwerk (↓/↑), Laufwerke mit Belegung und Standby – über die neue Berechtigung `sysinfo` (ShareOS 0.2.0-beta.11, nur Administratoren).
- **Prozessliste der Box:** alle Prozesse mit Benutzer, Zustand, CPU-Anteil, Speicher und Befehlszeile; Filter Benutzer & Apps / System / Kernel; **Beenden** schickt TERM – Prozesse, die ShareOS braucht, sind geschützt.
- Verlauf mit CPU und RAM; „Anhalten“ statt „Aufräumen“; Snapshots enthalten die echten Werte.
- Ohne die Berechtigung (ältere ShareOS, kein Admin) zeigt die App einen Hinweis statt erfundener Zahlen.

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von SysMon (ehemals WebTask) angepasst an ShareOS 0.2.0-beta.1+.
- Hardware-Vitals: CPU-Auslastung, RAM-Verbrauch (Heap), Uptime und I/O-Status.
- Echtzeit-Canvas-Ressourcengraph (2-Sekunden-Stream).
- Horizontale Sub-Header-Filterleiste für Tasks (Alle, WebApps, Core, Background Worker).
- Bereinigung inaktiver Tasks („⚡ Aufräumen“) und Beenden per PID.
- Snapshot-Protokollierung unter `system/sysmon_snapshots.json` via `ShareOS.fs`.
