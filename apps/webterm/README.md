# ShareOS WebTerm

Ein leichtgewichtiges Terminal im Stil von **Windows Terminal / Bash** für ShareOS.

- **Tabs**: mehrere unabhängige Sitzungen (`+` oder Strg+Shift+T).
- **Virtuelles Dateisystem** im Browser (`ls`, `cd`, `pwd`, `cat`, `touch`, `write`, `mkdir`, `rm`, `grep`), gemeinsam mit **ShareCommander** (`shareos.vfs`) – was du dort kopierst oder entpackst, siehst du hier sofort.
- **Brücke zu Webpad** (Webpad 1.2+): `webpad <datei>` öffnet die Datei in Webpad (öffnet Webpad bei Bedarf), Strg+S in Webpad schreibt sie zurück. Nachrichten im Format des ShareOS-App-SDK über den BroadcastChannel `shareos`.
- **JavaScript-Sandbox**: `run hello.js` führt ein Skript in einem abgeschotteten Rahmen aus – ohne Zugriff auf die Seite, die Box oder andere Apps; nach 5 s wird abgebrochen.
- **Dateien der Box ansehen**: Im ShareOS-Dateibrowser steht bei `.log`, `.txt`, `.js`, `.json`, `.csv`, `.conf` „WebTerm ↗“; die Datei liegt dann schreibgeschützt unter `/box` – z. B. `grep error system.log` (ShareOS 0.1.0-beta.9+).
- **Themes**: `shareos` (folgt Hell/Dunkel und Akzentfarbe von ShareOS, Standard in ShareOS), `dark`, `matrix`, `ubuntu`, `amber`.
- Komfort: Verlauf (Pfeil hoch/runter), Tab-Vervollständigung, Strg+L leert.

Läuft auch als einfache Dateien auf jedem Webserver; ShareOS-Funktionen fehlen dann.
