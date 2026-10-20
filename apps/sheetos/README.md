# ShareOS SheetOS

Schlanke Tabellenkalkulation für ShareOS.

- **Formeln** mit eigenem Rechenkern (kein `eval`): `+ - * / ^ &`, Vergleiche, Klammern, Zellbezüge und Bereiche (`A1:B5`); Funktionen `SUM`, `AVG`/`AVERAGE`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `ROUND`, `ABS`, `SQRT`, `IF`, `AND`, `OR`, `NOT`, `CONCAT`, `LEN`, `UPPER`, `LOWER`, `TODAY` – auch mit deutschen Namen (`SUMME`, `MITTELWERT`, `WENN` …). Argumente mit `;` oder `,`. Fehler wie `#DIV/0!`, `#NAME?`, `#CIRC!` (Zirkelbezug).
- **Zahlen** auch mit Komma (`1,5`, `1.234,5`) und Prozent (`12 %`).
- **Bedienen wie gewohnt**: Pfeiltasten, Enter, Tab, F2, Entf, Tippen startet die Eingabe, Bereiche mit Shift oder Ziehen; Summe/Mittelwert der Markierung in der Statusleiste; Kopieren/Einfügen als Text mit Tabs – passt zu Excel und LibreOffice.
- **SUM / AVG / MIN / MAX**: für die markierten Zellen (Ergebnis darunter) oder die Zahlen über der aktuellen Zelle.
- **CSV** öffnen (Trennzeichen und Dezimalzeichen werden erkannt) und herunterladen, **JSON** mit Formeln.
- **Dateien der Box** (ShareOS 0.1.0-beta.9+): Im Dateibrowser steht bei `.csv`/`.tsv` „SheetOS ↗“; **Strg+S** speichert zurück. Eingetragenes bleibt genau so, wie es war (führende Nullen, `1,5`), ebenso Byte-Order-Mark und Zeilenenden; nur Formeln werden durch ihr Ergebnis ersetzt (Hinweis vor dem ersten Speichern).
- Ohne geöffnete Datei bleibt die Tabelle im Browser gespeichert. Im ShareOS-Look (hell/dunkel, Akzentfarbe).
