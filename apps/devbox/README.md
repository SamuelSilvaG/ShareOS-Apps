# ShareOS DevBox

Werkzeugkasten für Entwickler im Stil von **CyberChef / DevToys** für ShareOS. Alles läuft im Browser, nichts verlässt das Gerät.

- **JSON**: prüfen, formatieren, verkleinern.
- **Base64 / URL / HTML / Hex**: kodieren und dekodieren (UTF-8, Base64url ohne Auffüllung geht auch).
- **Prüfsummen**: SHA-1, SHA-256, SHA-384, SHA-512 von Text oder einer Datei dieses Rechners (bis 1 GB), Vergleich mit der erwarteten Prüfsumme (z. B. Inhalt der `.sha256`-Datei eines Firmware-Downloads), UUID v4. Braucht HTTPS (Web Crypto).
- **Regex-Tester**: Treffer mit Position und Gruppen (auch benannte), mit und ohne Flag `g`.
- **Diff**: zeilenweiser Vergleich über die längste gemeinsame Teilfolge – eine eingefügte Zeile markiert nicht alles danach als geändert.
- **JWT-Decoder**: Header, Payload und die Zeiten `iat`/`nbf`/`exp` (Signatur wird nicht geprüft).
- **Dateien der Box** (ShareOS 0.1.0-beta.9+): Im Dateibrowser steht bei `.json` „DevBox ↗“ (Formatieren), bei `.iso`, `.img`, `.zip` usw. „Prüfsumme berechnen“ – praktisch, um Downloads zu prüfen (bis 256 MB).
- Im ShareOS-Look (hell/dunkel, Akzentfarbe); läuft auch als einfache Dateien auf jedem Webserver.
