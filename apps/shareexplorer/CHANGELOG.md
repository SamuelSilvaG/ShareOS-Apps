## 1.1.0

- **Progress of a copy or move that takes longer:** a small window at the bottom right shows how much is copied, the speed and the time left, with *Cancel* (what was copied so far stays). Asked for in [ShareOS discussion #88](https://github.com/UniqueDroid/ShareOS/discussions/88). Needs ShareOS 0.3.0-beta.14 or newer; on older versions copying works as before, without the window.
- Moving within one drive is done at once and shows no window; a move to another drive is a copy and shows it.
- **Uploading large files works, with the same window.** Files of more than 64 MB stopped with "Failed to fetch": apps could only save files up to that size, and the box cut the connection instead of saying so. With ShareOS 0.3.0-beta.14 uploads have no limit and show amount, speed, time left and *Cancel*; on older versions a file that is too large is refused with the reason before anything is sent.
- **New folders appear in the tree on the left at once**, renamed and deleted ones follow, also in a folder something was pasted or dropped into. The tree kept what it had read once.
- After an upload through the file dialog the message said "0 files uploaded".
- Context menu: the sub-menu of the first entry (*View*) stayed open while the pointer was on another entry.

## 1.0.0

- First version: file manager for the folders of the box in the style of the Windows file explorer (own drawings and colours, no Microsoft artwork).
- Command bar (New, cut, copy, paste, rename, delete, sort, view, upload, download), address bar with clickable path (a click into the free part takes a typed path), back/forward/up/refresh and search in the folder.
- Navigation pane with the personal folder and a folder tree of the shares and USB drives; details pane with a preview of pictures, video, audio, PDF and text.
- Details, large icons (with thumbnails) and list view; sorting by name, date, type and size; hidden items.
- Rename in place (F2, the name without its extension selected), new folder (Ctrl+Shift+N) and text document, delete with a question (the box has no recycle bin), copy/cut/paste also across shares (a copy in the same folder gets "- Kopie"), drag and drop (Ctrl: copy), upload by button or by dropping files from the computer (an existing name gets "(2)"), download.
- Viewer for pictures, videos, music, PDF and text with ← → through the folder; properties (Alt+Enter); keyboard like the original (arrows, Enter, Backspace, Alt+arrows, Del, Ctrl+A/C/X/V, F5).
- Read-only shares are respected; light/dark follows ShareOS. One button switches to the ShareOS style (theme and accent colour of ShareOS); the choice is kept.
- English when ShareOS is not set to German.
