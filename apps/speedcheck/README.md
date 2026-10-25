# SpeedCheck (`speedcheck`)

Messung der Verbindung zur Box (Ping, Jitter, Durchsatz) – zu Hause oder über VPN – als App für das [ShareOS-Apps](https://github.com/UniqueDroid/ShareOS-Apps) Ökosystem.

## Features
- **VPN-Tunnel-Check**: Misst Latenz (Ping) und Jitter-Schwankungen direkt zur heimischen Box.
- **Durchsatztest**: Ermittelt die reale Datentransferrate über die Verbindung.
- **Status**: Zeigt an, ob die Box antwortet und ob das Protokoll auf der Box gespeichert wird.
- **ShareOS 0.2.0-beta.1+ Konform**: Speichert Diagnoseprotokolle persistent unter `diagnostics/network_logs.json` via `ShareOS.fs`.
