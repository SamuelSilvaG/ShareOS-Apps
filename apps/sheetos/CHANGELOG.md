## 1.0.1

- Folgt den Farben von ShareOS: hell/dunkel und Akzentfarbe (bisher immer das eigene dunkle Farbschema); das Layout bleibt.
- Englisch, wenn die ShareOS-Oberfläche nicht auf Deutsch steht ([#74](https://github.com/UniqueDroid/ShareOS/issues/74)).

## 1.0.0

- First version in the ShareOS app store.
- Own formula engine (no eval) with operators, comparisons, ranges and common functions (also German names), error values and cycle detection; numbers with decimal comma and percent.
- Keyboard and mouse like other spreadsheets, sum/average of the selection, copy and paste as tab separated text.
- CSV import with separator and decimal mark detection, CSV/JSON download; CSV files of the box open from the file browser and save back with Ctrl+S (ShareOS 0.1.0-beta.9+).
- Saving keeps the file as it was: typed values exactly as typed (leading zeros, "1,5"), only formulas become their result; byte order mark and line ends stay.
