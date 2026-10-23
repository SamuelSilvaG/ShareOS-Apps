# Changelog

## [1.0.1] - 2026-10-23
### Behoben
- Auf dem Handy bricht die Kopfleiste um, statt seitlich zu scrollen: Suche bzw. Mitte in eigener Zeile, Kontoname gekürzt, Versionsnummer ausgeblendet.

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von ShareVault: Privater Passwort- und 2FA-Manager.
- Echte Ende-zu-Ende-Verschlüsselung im Browser mit PBKDF2 und AES-GCM-256 (WebCrypto API).
- RFC 6238 konforme 2FA/TOTP Einmalkennwort-Engine mit Live-Countdown.
- Versions-Badge (v1.0.0) im Header und Sperrbildschirm.
- Neuer, markanter 3D-Button für „Sperren“.
- Persistente und sichere Speicherung auf der Box via `ShareOS.fs` (`vault.enc`) mit Multi-User-Trennung.
