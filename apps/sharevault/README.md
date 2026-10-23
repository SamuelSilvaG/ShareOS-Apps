# ShareVault (`sharevault`)

Privater, verschlüsselter Passwort- und 2FA-Manager für das [ShareOS-Apps](https://github.com/UniqueDroid/ShareOS-Apps) Ökosystem.

## Features
- **Clientseitige AES-GCM-256 Verschlüsselung**: Niemand auf der Box (nicht einmal der Root-Administrator) kann deine Passwörter ohne das Master-Passwort lesen.
- **Integrierter 2FA Authenticator (TOTP)**: Berechnet 6-stellige Einmalcodes in Echtzeit inklusive 30s-Ticker.
- **Passwort-Generator**: Erstellt kryptografisch sichere Passwörter auf Knopfdruck.
- **ShareOS 0.2.0-beta.1+ Konform**: Speichert die verschlüsselte Datei `vault.enc` über `ShareOS.fs` im persönlichen Home-Laufwerk des Benutzers.
