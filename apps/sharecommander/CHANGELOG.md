## 1.0.0

- First version in the ShareOS app store: two panes, copy/move/rename/delete, multi-rename, preview, function key bar, themes including the ShareOS look.
- Shares the browser file system with WebTerm (`shareos.vfs`) and updates when the other window changes it.
- Real ZIP archives: packing (stored, UTF-8 names) and unpacking with subfolders (stored and deflate); archives of the earlier JSON format still unpack.
- Binary files are kept as binary (before they were read as text and broken), with a size limit and a clear message when the browser storage is full.
- Keyboard navigation (arrows, Enter, Insert/Space, Home/End, page keys), F2 rename, protection against overwriting and copying a folder into itself, read-only folders respected.
- Bridges in the format of the ShareOS SDK: Webpad (`open-file`/`file-saved`) and WinWeb Player (`open-media`), opened when not running.
