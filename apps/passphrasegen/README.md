# PassphraseGen (`passphrasegen`)

Kryptografischer Diceware-Passphrase-Generator für das [ShareOS-Apps](https://github.com/UniqueDroid/ShareOS-Apps) Ökosystem.

## Features
- **Einprägsam & Extrem Sicher**: Erzeugt Passphrasen (z. B. `wolke-komet-sommer-42`), die sich der Mensch leicht merken kann, aber kryptografisch vor Brute-Force-Angriffen schützen.
- **CSPRNG**: Nutzt die WebCrypto API für echte kryptografische Zufallsbits.
- **Entropie-Anzeige**: Zeigt die errechnete Bit-Stärke der Passphrase direkt an.
- **ShareOS 0.2.0-beta.1+ Konform**: Speichert den Verlauf persistent unter `passwords/passphrases.json` via `ShareOS.fs`.
