# Changelog

## 1.2.0

- Multilingual user interface: Portuguese, English, and German (`pt`, `en`, `de`).
- Automatic language detection (saved choice → `ShareOS.lang` → browser locale, fallback to English).
- New "Language" / "Sprache" / "Idioma" menu in the menu bar to manually switch and persist language in `localStorage`.
- Portuguese description and "Open with" label in `app.json`.

## 1.1.0

- Works with ShareOS 0.2.0-beta.4+: talks to the account's own Transmission daemon through `ShareOS.torrent` (permission `torrent`); the daemon is the system app `transmission-daemon`. The direct `:9091` fallback and the RPC address setting are gone (the browser blocked them).
- Download folder chosen with the box's folder dialog (`ShareOS.fs.pick({ folder: true })`), shown as "Mein Ordner/…"; publisher is the author.
- Needs the system app `transmission-daemon` (`"requires"`): the store installs it along.
- Clear messages when the daemon is not installed or no drive is set up.
- Buttons readable in every look: the accent buttons (e.g. *Hinzufügen*) were white on white with the accent colour "white", the other buttons dark on dark in the light look.

## 1.0.0

- Erstveröffentlichung für ShareOS
- Native Einbindung in das ShareOS-Design (Dark/Light/Akzentfarben)
- Vollständige Steuerung von Torrents (Starten, Pausieren, Löschen, Drosselung)
- Direkte Integration mit dem ShareOS-Dateibrowser: Öffnen von `.torrent`-Dateien
- Dateiauswahl über ShareOS.fs (`ShareOS.fs.pick`) zum Speichern auf NAS-Freigaben
- Turtle-Modus (alternative Geschwindigkeitsbegrenzungen)
- Detailansicht für Übertragung, Tracker, Peers und einzelne Dateien
