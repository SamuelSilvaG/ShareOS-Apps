# ShareOS WinWeb Player

Audio- und Videoplayer im Retro-Stil für ShareOS.

- **Wiedergabe** von MP3, WAV, OGG/Opus, FLAC, M4A/AAC, MP4 und WebM – was der Browser kann. Dateien per Auswahl oder **Drag & Drop**, Videos klappen das Video-Deck mit Vollbild auf.
- **Dateien der Box** (ShareOS 0.1.0-beta.9+): Im Dateibrowser steht bei Musik und Videos „WinWeb Player ↗“; die Datei wird direkt von der Box gestreamt (keine Kopie im Browser). Spulen in großen Dateien braucht ShareOS 0.1.0-beta.11.
- **Visualizer** (Web Audio): Spektrum mit Peak-Punkten, Oszilloskop, Spiegelwelle – Klick auf das Display wechselt.
- **10-Band-Equalizer** mit Vorverstärker, Balance, Lautstärke und Presets (Bass, Rock, Electronic, Vocal, Klassik).
- **Playlist** mit Filter, Laufzeit, Zufall/Wiederholen und Stream-URLs (andere Server nur mit CORS, sonst bleiben Equalizer und Visualizer stumm – dann meldet der Player das).
- **Synth-Demo**: erzeugt einen 16-Sekunden-Chiptune im Browser, zum Ausprobieren ohne eigene Datei.
- **Skins**: ShareOS (folgt Hell/Dunkel und Akzentfarbe, Standard in ShareOS), Classic, Cyber, Foobar.
- **Brücke**: Andere Apps (z. B. ShareCommander) schicken Medien über den ShareOS-Kanal (`open-media`).
- Tasten: Leertaste Pause/Weiter, Pfeil links/rechts 5 s spulen.
