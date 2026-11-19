## 1.1.0

- **Progress of a copy or move that takes longer:** a small window at the bottom right shows how much is copied, the speed and the time left, with *Cancel* (what was copied so far stays). Asked for in [ShareOS discussion #88](https://github.com/UniqueDroid/ShareOS/discussions/88). Needs ShareOS 0.3.0-beta.14 or newer; on older versions copying works as before, without the window.
- Moving within one drive is done at once and shows no window; a move to another drive is a copy and shows it.
- **Uploading large files works, with the same window.** Files of more than 64 MB stopped with "Failed to fetch": apps could only save files up to that size, and the box cut the connection instead of saying so. With ShareOS 0.3.0-beta.14 uploads have no limit and show amount, speed, time left and *Cancel*; on older versions a file that is too large is refused with the reason before anything is sent.
- The favourites follow the personal folder: a new *Documents* or *Pictures* shows up at once.
- After an upload through the file dialog the message said "0 files uploaded".
- Context menu: the sub-menu of the first entry (*View*) stayed open while the pointer was on another entry.

## 1.0.0

- First version: file manager for the folders of the box in the style of the macOS Finder (own drawings and colours, no Apple artwork).
- Toolbar with back/forward, the folder name, icon / list / column view, sort, actions, upload and search; sidebar with favourites (the personal folder and its usual folders), shares and USB drives; path bar and status line with the free space.
- Column view like the original: one column per folder, a click opens the next one, the selected file shows a preview column; ← → walk the columns.
- Quick Look with the space bar (pictures, video, music, PDF, text, ← → through the folder), Get Info (⌘I / Ctrl+I).
- Rename with Enter (the name without its extension selected), new folder (⇧⌘N), delete with a question (the box has no trash), copy and paste (⌘C/⌘V, ⌥⌘V moves), drag and drop (⌥ or Ctrl: copy), upload by button or by dropping files from the computer, download.
- Shortcuts work with ⌘ on a Mac and with Ctrl elsewhere; read-only shares are respected; light/dark follows ShareOS. One button switches to the ShareOS style (theme and accent colour of ShareOS); the choice is kept.
- English when ShareOS is not set to German.
