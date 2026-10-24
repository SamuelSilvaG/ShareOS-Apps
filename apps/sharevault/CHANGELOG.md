# Changelog

## [1.1.0] - 2026-10-24
### Hinzugefügt
- **Rubriken:** Jeder Eintrag gehört zu einer Rubrik. Ein neuer Tresor bringt Beispiele mit (Allgemein, E-Mail, Banking & Finanzen, Shopping, Social Media, Streaming, Arbeit, Server & Homelab, WLAN & Netzwerk).
- **Eigene Rubriken:** im Eintrag unter „Rubrik“ → „➕ Neue Rubrik …“ oder über **⚙️ Rubriken**: anlegen, Symbol und Name ändern, löschen (die Einträge wandern nach „Allgemein“), Beispiele wiederherstellen.
- Filterleiste mit allen Rubriken und der Anzahl ihrer Einträge über dem Grid; die Suche findet auch den Namen der Rubrik. Auf dem Handy ist die Leiste seitlich wischbar.
- Die Kachel zeigt das Symbol und den Namen ihrer Rubrik.

### Geändert
- Tresor-Format 2: die Datei enthält Einträge und Rubriken (`{ entries, categories }`). Tresore aus 1.0.x werden weiter geöffnet; ihre Einträge landen in „Allgemein“, die Beispiel-Rubriken kommen dazu.

## [1.0.5] - 2026-10-24
### Hinzugefügt
- **Modernes Grid-Layout in der Mitte**: Die Passwörter werden nun in einer übersichtlichen Kachel-Ansicht (Grid) im zentralen Arbeitsbereich dargestellt (ähnlich wie TuyaPulse).
- **Originaler Login & Farben**: Der Anmeldebildschirm und die originalen Farbwerte (`#0f172a` / `#1e293b` / `#10b981`) wurden vollständig beibehalten.
