# Changelog

## [1.0.1] - 2026-10-25
### Behoben
- Nur noch echte Messwerte: Die Zeilen „Router“ und „DNS“ zeigten erfundene Werte (Ping zur Box × 0,85, „DNS Auflösung ok“) und sind entfernt; bei einer fehlgeschlagenen Durchsatzmessung steht „—“ statt eines geschätzten Werts; die Texte behaupten nichts mehr über ein VPN.

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von SpeedCheck für das ShareOS-Ökosystem.
- Echtzeit-Latenzmessung (Ping), Jitter- und Durchsatz-Ermittlung zur heimischen Box.
- Visueller Canvas-Latenzgraph.
- Heimnetz-Knotenprüfung (Router, DNS, Dateisystem-I/O).
- Automatische Protokollierung der Messwerte unter `diagnostics/network_logs.json` via `ShareOS.fs`.
