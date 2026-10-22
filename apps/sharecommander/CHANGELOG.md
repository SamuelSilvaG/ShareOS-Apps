## 1.3.0

- Inside ShareOS **both panes start on the box**: left the personal folder, right the next folder (a share). The browser storage (VFS) is still in the drive list, now named "Browser-Speicher (nur dieser Browser)" and listed last.
- **Shares by rights** (with ShareOS 0.2.0-beta.6): users see their personal folder and the shares they may use; read-only shares are marked with 🔒 "(nur lesen)", and the box refuses changes there.
- Clear hint instead of a silent fallback: when the account has no access to the folders of the box (the admin switches it on under Users → "Dateien"), or when there is neither a personal folder nor a share.
- A new browser storage no longer gets the example folders `/etc` and `/media` (they looked like system files of the box).
- Messages of the box in German (read only, no permission, already exists, drive full, storage limit).

## 1.2.0

- F4 (Webpad) and media (WinWeb Player) open a closed app in its **own window** instead of a browser tab (with ShareOS 0.2.0-beta.2 through `ShareOS.openApp`, with look, language and account); a blocked pop-up is reported.

## 1.1.0

- **Folders of the box:** each pane can show a folder of the box (drive list above the pane: VFS or BOX:// with the folders the signed-in user may reach) – list, copy and move (also between box and VFS, box files over 1 MB stay on the box), new folder/file, rename, multi-rename, delete with an extra warning, upload from the computer, ZIP packing and unpacking on the box (up to 200 MB), preview (pictures and media straight from the box, text, hex), F4 to Webpad and saving back to the box, music and videos streamed to WinWeb Player, download.
- Needs the new permission `files` and ShareOS 0.1.0-beta.11 or newer. Inside ShareOS the right pane starts on the box.

## 1.0.0

- First version in the ShareOS app store: two panes, copy/move/rename/delete, multi-rename, preview, function key bar, themes including the ShareOS look.
- Shares the browser file system with WebTerm (`shareos.vfs`) and updates when the other window changes it.
- Real ZIP archives: packing (stored, UTF-8 names) and unpacking with subfolders (stored and deflate); archives of the earlier JSON format still unpack.
- Binary files are kept as binary (before they were read as text and broken), with a size limit and a clear message when the browser storage is full.
- Keyboard navigation (arrows, Enter, Insert/Space, Home/End, page keys), F2 rename, protection against overwriting and copying a folder into itself, read-only folders respected.
- Bridges in the format of the ShareOS SDK: Webpad (`open-file`/`file-saved`) and WinWeb Player (`open-media`), opened when not running.
