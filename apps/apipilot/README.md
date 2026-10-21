# ShareOS API-Pilot

REST- und GraphQL-Client im Stil von **Postman / ReqBin** für ShareOS.

- **Anfragen:** `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`; Query-Parameter und Header zeilenweise, Authorization als Bearer-Token oder Basic (Benutzer + Passwort, UTF-8).
- **Body:** JSON (mit Prüfung), GraphQL (Abfrage + Variablen, wird als JSON per POST gesendet), Formular (`x-www-form-urlencoded`) oder Text.
- **Antwort:** Status, Zeit, Größe, Header und formatiertes JSON; *Abbrechen* während eine Anfrage läuft.
- **Code:** die aktuelle Anfrage als `cURL`-Befehl (sauber für die Shell gequotet) und als JavaScript-`fetch`.
- **Verlauf:** die letzten 30 Anfragen (ohne Token und Passwort), je Konto getrennt.
- **Auf der Box speichern** (Berechtigung `files`, ShareOS 0.2.0-beta.1+): Dateidialog der Box; sonst *Download*.
- **In Webpad öffnen:** die Antwort bearbeiten; *Speichern* in Webpad übernimmt den Text zurück.
- Strg+Enter sendet.

**Hinweis:** Die Anfragen gehen direkt aus dem Browser hinaus, nicht über die Box. Der Server muss deshalb Anfragen aus dem Browser erlauben (CORS); läuft ShareOS über HTTPS, gehen nur `https://`-Adressen. Viele öffentliche APIs (JSONPlaceholder, GraphQL-Länder-API, ipify) können das – die Beispiele zeigen es.

Im ShareOS-Look (hell/dunkel, Akzentfarbe); läuft auch als einfache Dateien auf jedem Webserver.
