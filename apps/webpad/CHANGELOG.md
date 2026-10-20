## 1.4.0

- **Texts per account:** opened from ShareOS, Webpad loads the ShareOS app SDK first, so its open tabs, texts and settings in the browser belong to the account that opened it – another user in the same browser no longer sees them (ShareOS 0.2.0-beta.1). What has to stay private belongs on the box: *File → Save to the Box…* saves into your own folder.

## 1.3.0

- **Files of the box:** File → *Open from the Box…* / *Save to the Box…* with a small folder browser (folders the signed-in user may reach, new folder, overwrite question); Ctrl+S then saves back to the box. Needs the new permission `files` and ShareOS 0.1.0-beta.11 or newer; saving on your own computer works as before.
- Closing Webpad with its own ✕ crashed the whole browser for some users: Webpad now leaves fullscreen first, finishes its storage writes and closes its app channel before the window closes; nothing is written to IndexedDB while the page goes away.

## 1.2.0

- Takes files from other apps of the box (e.g. `webpad <file>` in WebTerm) and sends them back on Ctrl+S – messages of the ShareOS app SDK over the BroadcastChannel "shareos".

## 1.1.0

- Opens text files straight from the ShareOS file browser ("Webpad ↗" next to the file) in its own window; Ctrl+S saves back to the box (ShareOS 0.1.0-beta.9 or newer). Outside ShareOS nothing changes.

## 1.0.0

- First version as a ShareOS app; CodeMirror, crypto-js and the fonts are packaged with it, so it works without internet.
