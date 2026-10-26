# Changelog

## [2.0.1] - 2026-10-26
### Geändert
- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## [2.0.0] - 2026-10-24
### Geändert
- **Echte Docker-Hosts** statt einer Beispielliste: Die Box spricht mit der Docker-API deiner Server (`http://server:2375` oder `https://server:2376`) – über die neue Berechtigung `docker` (ShareOS 0.2.0-beta.11, nur Administratoren). Docker selbst läuft nicht auf der Box.
- Container mit Zustand, Status, Ports und **Stack** (Compose-Projekt, als Filter); Hosts einzeln oder alle zusammen.
- **Starten, Stoppen, Neustart** wirken wirklich; **Protokoll** (100–1000 Zeilen) mit CPU- und RAM-Verbrauch des Containers.
- Hosts verwalten unter „🖥️ Hosts“ (mit Hinweis, wie man die API am Server freigibt); Aktualisierung alle 30 s.
- Entfernt: „Container hinzufügen“ und „Prune“ der Beispielliste.

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von DockerDeck für das ShareOS-Ökosystem.
- Container-Manager zur Verwaltung von Homelab-Diensten, Docker Stacks und Images.
- Start-, Stop- und Neustart-Aktionen direkt per Knopfdruck.
- Horizontale Sub-Header-Filter nach Status (Running/Stopped) und Kategorien.
- Prune-Funktion zum Bereinigen gestoppter Container.
- Persistente Speicherung unter `system/dockerdeck_containers.json` via `ShareOS.fs`.
