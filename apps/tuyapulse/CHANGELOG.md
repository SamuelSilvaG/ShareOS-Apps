# Changelog

## [2.0.0] - 2026-10-24
### Geändert
- **Echte Steuerung ohne Cloud:** Die Box spricht lokal mit den Tuya-Geräten (Protokoll 3.3 und 3.4) – über die neue Berechtigung `tuya` (ShareOS 0.2.0-beta.11, nur Administratoren). Der Schalter schaltet das Gerät wirklich, der Zustand wird alle 30 s abgefragt, Steckdosen mit Messung zeigen ihre Watt.
- **Suche:** Die Box lauscht auf die Meldungen der Geräte (UDP 6666/6667) und findet IP, Geräte-ID und Protokoll; „Hinzufügen“ übernimmt sie ins Formular, nur der Local Key fehlt noch.
- Neue Felder **Geräte-ID** und **Schalter-Datenpunkt** (meist 1, viele Lampen 20).
- **Szenen** schalten die Geräte wirklich; das Protokoll zeigt Anfragen und Antworten.
- Kein Demo-Hinweis und keine Beispielgeräte mehr; die Beispiele aus 1.x werden entfernt.

## [1.4.1] - 2026-10-24
### Geändert
- Als **Demo** gekennzeichnet (Hinweis oben, „DEMO“ neben dem Namen, Beschreibung im Store): Suche, Schalten und Watt-Werte sind nachgestellt. Ein Browser kann weder UDP senden noch mit Tuya-Geräten im Netz sprechen; die echte Steuerung kommt mit einem Dienst auf der Box (ShareOS).

## [1.4.0] - 2026-10-23
### Hinzugefügt
- **Protokoll-Auswahl (v3.3 / v3.4)**: Jedes Gerät kann nun mit seiner korrekten Tuya-Firmware-Version konfiguriert werden.
- **UDP Diagnose-Log & Test-Konsole**: Interaktives Terminal (`📡 UDP Log`) zur Überwachung von Befehlen, ACK-Antworten und Ping-Tests im Heimnetz.
