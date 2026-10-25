# Changelog

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von PassphraseGen für das ShareOS-Ökosystem.
- Kryptografisch sichere Zufallsauswahl via `crypto.getRandomValues` (CSPRNG).
- Diceware-Wortliste mit einprägsamen deutschen Begriffen.
- Entropie- und Sicherheitsstufen-Berechnung in Echtzeit.
- Konfigurierbare Wortanzahl, Trennzeichen, Groß-/Kleinschreibung und Zufallszahlen.
- Speicherung des Verlaufs unter `passwords/passphrases.json` via `ShareOS.fs`.
