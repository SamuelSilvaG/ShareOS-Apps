# Changelog

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von SysMon (ehemals WebTask) angepasst an ShareOS 0.2.0-beta.1+.
- Hardware-Vitals: CPU-Auslastung, RAM-Verbrauch (Heap), Uptime und I/O-Status.
- Echtzeit-Canvas-Ressourcengraph (2-Sekunden-Stream).
- Horizontale Sub-Header-Filterleiste für Tasks (Alle, WebApps, Core, Background Worker).
- Bereinigung inaktiver Tasks („⚡ Aufräumen“) und Beenden per PID.
- Snapshot-Protokollierung unter `system/sysmon_snapshots.json` via `ShareOS.fs`.
