## 1.2.0

- `webpad <file>` opens a closed Webpad in its **own window** instead of a browser tab (with ShareOS 0.2.0-beta.2 through `ShareOS.openApp`, with look, language and account).

## 1.1.0

- The virtual file system is shared with ShareCommander (`shareos.vfs`, taken over from `webterm.vfs` on the first start); changes in the other window show up at once.
- Binary files (from ShareCommander) are recognised: `cat`, `grep` and `webpad` say so instead of printing data.

## 1.0.0

- First version as a ShareOS app: tabs, a virtual file system in the browser (`ls`, `cd`, `cat`, `grep` …), JavaScript sandbox (`run`), themes including the ShareOS look.
- `webpad <file>` opens a file of the virtual file system in Webpad (Webpad 1.2+); saving in Webpad writes it back.
- Opens text and log files from the ShareOS file browser (read-only) to `cat` and `grep` them (ShareOS 0.1.0-beta.9+).
