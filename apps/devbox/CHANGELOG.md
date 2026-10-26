## 1.1.1

- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## 1.1.0

- First version in the ShareOS app store: JSON, Base64/URL/HTML/hex, checksums, regex tester, diff, JWT decoder.
- ShareOS look (light/dark, accent colour) and files of the box: `.json` opens in the formatter, images and archives (`.iso`, `.img`, `.zip` …) get their checksums (up to 256 MB).
- Checksums of files of this computer too (up to 1 GB) and a comparison with the expected checksum (e.g. the content of a `.sha256` file).
- Line diff via the longest common subsequence; regex tester also without `g`, shows groups; UTF-8 safe Base64 and Base64url; HTML entities and hex can be decoded.
