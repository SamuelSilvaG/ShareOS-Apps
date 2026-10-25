# Changelog

## [2.0.0] - 2026-10-24
### Geändert
- **Echter PDF-Betrachter:** Die Seiten werden mit pdf.js gezeichnet (mitgeliefert, offline), mit Blättern, Zoom und „an Breite anpassen“. Vorher wurde die Datei nur als Text angezeigt.
- **Unterschrift im PDF:** zeichnen (Maus, Finger, Stift), auf der Seite an die richtige Stelle ziehen, Größe ändern; „Speichern“ legt mit pdf-lib ein neues PDF `…_unterschrieben.pdf` an – im Dateidialog der Box oder als Download. Vorher entstand nur eine HTML-Datei.
- Öffnen von der Box (Dateidialog), vom Gerät oder aus dem Dateibrowser von ShareOS („In TinyPDF öffnen“).
- Entfernt: Beispiel-„Verträge“ und die Ordnersuche.

## [1.0.0] - 2026-10-23
### Hinzugefügt
- Erstveröffentlichung von TinyPDF für das ShareOS-Ökosystem.
- Integrierter PDF- und Dokumenten-Viewer mit automatischer VFS-Dateisuche (`ShareOS.fs`).
- Touch- & Maus-Signaturpad zum digitalen Unterschreiben von Verträgen und Belegen.
- Zoom-Steuerung (70% bis 160%) und Export-Funktion.
- Vollständig compliant mit ShareOS 0.2.0-beta.1+ und mobile optimiert.
