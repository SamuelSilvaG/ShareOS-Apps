# Changelog

## [2.0.1] - 2026-10-26
### Geändert
- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## [2.0.0] - 2026-10-24
### Sicherheit
- **Alles verschlüsselt:** Schlüssel, Tokens und Zertifikate liegen nur noch verschlüsselt auf der Box (`security/keykeeper.enc`, AES-GCM-256, Schlüssel aus dem Master-Passwort mit PBKDF2-SHA256 und 250 000 Runden). Vorher standen sie im Klartext in `security/credentials.json` und im Browser.
- **Sperrbildschirm** mit Master-Passwort (mindestens 8 Zeichen); 🔒 sperrt sofort, nach 10 Minuten ohne Bedienung sperrt KeyKeeper sich selbst.
- **Umzug aus 1.0:** Beim Anlegen des Tresors werden die Einträge aus `credentials.json` übernommen und die unverschlüsselte Datei (und die Browser-Kopie) gelöscht.
- Keine Beispiel-Schlüssel mehr; die Beispiele aus 1.0 werden nicht übernommen.

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von KeyKeeper für das ShareOS-Ökosystem.
- Verwaltung von privaten SSH-Keys, API-Token und SSL-Zertifikaten für die Homelab-Infrastruktur.
- Ein-Klick-Zwischenablage für Secrets.
- Horizontale Sub-Header-Filterleiste nach Typ.
- Persistente Speicherung unter `security/credentials.json` via `ShareOS.fs`.
