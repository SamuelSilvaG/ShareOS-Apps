# ShareOS ShareCommander

Zwei-Spalten-Dateimanager im Stil von **Total Commander / Norton Commander** für ShareOS.

- **Zwei Panels**: Sortieren (Name, Typ, Größe, Datum), Filtern, Markieren (Strg/Shift-Klick, Einfg, Leertaste, Strg+A), Kopieren (`F5`) und Verschieben (`F6`) ins andere Panel – mit Rückfrage vor dem Überschreiben und Schutz davor, einen Ordner in sich selbst zu kopieren.
- **Tastatur wie im Original**: Pfeile, Pos1/Ende, Bild auf/ab, Enter, Backspace, Tab, `F2`/`Shift+F6` umbenennen, `F7` Ordner, `F8` Datei, `Entf`, `Strg+M` Mehrfach-Umbenennen, `F3`/`Strg+Q` Vorschau.
- **Gemeinsames Dateisystem im Browser** (`shareos.vfs`): dieselben Dateien wie in **WebTerm** – Änderungen erscheinen im anderen Fenster sofort. Textdateien als Text, andere Dateien (Bilder, Musik, ZIP) bis 1 MB je Datei; der Browser-Speicher ist für alle Apps zusammen nur einige MB groß.
- **ZIP**: packt markierte Dateien und Ordner zu echten `.zip`-Archiven (Download und, wenn klein genug, im Dateisystem) und entpackt ZIP-Dateien mit Unterordnern (gespeichert oder Deflate).
- **Mehrfach-Umbenennen** (`Strg+M`): Maske mit `[N]` (alter Name) und `[C]` (Zähler), Suchen und Ersetzen, Groß-/Kleinschreibung, Vorschau mit Konfliktprüfung.
- **Vorschau** (`F3`): Text, Bilder, Audio/Video, Hex-Ansicht für andere Dateien.
- **Brücken**: `F4` öffnet eine Textdatei in **Webpad** (Strg+S dort schreibt zurück), Doppelklick auf Musik/Video spielt sie im **WinWeb Player** – beide werden bei Bedarf geöffnet.
- **Import**: Dateien vom Rechner, ganze Ordner (Chrome/Edge), **OPFS-Abgleich** mit dem privaten Speicher des Browsers (hin und zurück).
- **Themes**: ShareOS (folgt Hell/Dunkel und Akzentfarbe, Standard in ShareOS), Dark, Norton Blue, Matrix.

- **Ordner der Box** (ab 1.1, ShareOS 0.1.0-beta.11+, Berechtigung `files`): Über die Laufwerksauswahl oben im Panel zeigt jedes Panel entweder das Browser-Dateisystem (`VFS://`) oder einen Ordner der Box (`BOX://`) – genau die Ordner, die der angemeldete Benutzer auch im Dateibrowser von ShareOS sieht, mit seinen Rechten. Kopieren und Verschieben gehen zwischen Box-Ordnern und zwischen Box und VFS, dazu Umbenennen, Löschen (mit Warnung), Hochladen, ZIP packen/entpacken, Vorschau, `F4` → Webpad (Speichern schreibt auf die Box) und Musik/Videos direkt in den WinWeb Player.
