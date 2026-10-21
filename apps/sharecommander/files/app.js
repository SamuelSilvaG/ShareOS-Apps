'use strict';
// ShareCommander – two-pane file manager in the style of Total Commander.
// Works on the virtual file system (VFS) in the browser that WebTerm uses too
// (localStorage "shareos.vfs" on the apps origin of the box). Text files are
// stored as text, other files as data: URL (node.bin).
// With the permission "files" (ShareOS 0.1.0-beta.11+) a pane can also show
// the folders of the box (ShareOS.fs) – with the rights of the signed-in user.

// --- ShareOS app bridge ---------------------------------------------------------
// Inside ShareOS the app SDK (/_shareos/app.js) is loaded: messages go through
// ShareOS.emit/on (BroadcastChannel "shareos", every app on the box hears them).
const APP = 'sharecommander';
const SOS = window.ShareOS || null;

// open another app of the box in its own window (ShareOS 0.2.0-beta.2+ does it
// with look, language and account; older versions: a pop-up window here)
const APP_SIZE = { webpad: { width: 1100, height: 760 }, webplayer: { width: 940, height: 600 } };
function openApp(app) {
  const size = APP_SIZE[app] || { width: 1000, height: 700 };
  if (SOS && SOS.openApp) return SOS.openApp(app, size);
  return window.open(new URL('/' + app + '/index.html', location.href).href, 'sosapp-' + app, `popup,width=${size.width},height=${size.height}`);
}
const chan = !SOS && 'BroadcastChannel' in window ? new BroadcastChannel('shareos') : null;
const handlers = {};
function emit(type, data) {
  if (SOS) SOS.emit(type, data);
  else if (chan) chan.postMessage({ type, data, from: APP });
}
function on(type, fn) {
  if (SOS) SOS.on(type, fn);
  else (handlers[type] = handlers[type] || []).push(fn);
}
if (chan) chan.onmessage = (ev) => {
  const m = ev.data || {};
  (handlers[m.type] || []).forEach((fn) => { try { fn(m.data, m.from); } catch (e) { } });
};

// which apps are open: they answer "ping" with "pong" and announce "app-ready"
const seen = {}, pending = {};
on('pong', (d, from) => { if (from) seen[from] = Date.now(); });
on('app-ready', (d, from) => {
  if (!from) return;
  seen[from] = Date.now();
  const q = pending[from]; delete pending[from];
  (q || []).forEach((m) => emit(m.type, m.data));
});
on('ping', () => emit('pong', {}));
const alive = (app) => Date.now() - (seen[app] || 0) < 8000;
setInterval(() => emit('ping', {}), 3000);
emit('ping', {});
emit('app-ready', {});

// send to another app; opens it in its own window when it is not running
function sendTo(app, type, data, label) {
  const msg = { type, data };
  if (alive(app)) { emit(type, data); return; }
  (pending[app] = pending[app] || []).push(msg);
  if (!openApp(app)) showToast(`${label}: Fenster blockiert – Pop-ups für diese Seite erlauben.`);
  setTimeout(() => {
    if (pending[app]) { delete pending[app]; showToast(`${label} meldet sich nicht – ist die App installiert (und aktuell)?`); }
  }, 20000);
}

// Webpad saved a file we sent it: write it back into the VFS
on('file-saved', (d) => {
  if (!d || d.to !== APP || typeof d.path !== 'string') return;
  const bm = /^box:([^/]+)\/(.*)$/.exec(d.path);
  if (bm) {              // a file of the box: write it back there
    const parts = bm[2].split('/'), name = parts.pop();
    boxWrite(bm[1], parts.join('/'), name, new Blob([String(d.content ?? '')]))
      .then(() => { refreshBox(); showToast(`Auf der Box gespeichert: ${bm[1]}/${bm[2]}`); })
      .catch((e) => showToast(`Speichern auf der Box fehlgeschlagen: ${e.message}`));
    return;
  }
  const path = resolvePath('/', d.path);
  const name = path.split('/').pop();
  const dir = getNode(parentOf(path));
  if (!name || !dir || dir.type !== 'dir') return;
  if (dir.ro || (dir.children[name] && dir.children[name].ro)) { showToast(`'${name}' ist schreibgeschützt – nicht übernommen.`); return; }
  dir.children[name] = { type: 'file', mtime: nowStamp(), content: String(d.content ?? '') };
  saveVFS();
  renderBothPanes();
  showToast(`Datei aktualisiert: ${path}`);
});

// --- Gemeinsames Virtuelles Dateisystem (VFS) ---
const defaultVFS = {
  '/': {
    type: 'dir',
    mtime: '2026-01-19 10:00',
    children: {
      'home': {
        type: 'dir',
        mtime: '2026-01-19 10:00',
        children: {
          'user': {
            type: 'dir',
            mtime: '2026-01-19 10:05',
            children: {
              'readme.txt': {
                type: 'file',
                mtime: '2026-01-19 10:05',
                content: 'Willkommen im ShareCommander (Total Commander Style)!\n\nTastenkürzel:\n- Tab: Zwischen linkem und rechtem Fenster wechseln\n- Pfeile, Pos1, Ende, Bild auf/ab: Cursor bewegen\n- Enter: Ordner öffnen / Datei anzeigen\n- Einfg oder Leertaste: markieren\n- F2: Umbenennen\n- F3: Datei-Schnellvorschau\n- F4: Datei direkt in Webpad bearbeiten\n- F5: Kopieren ins andere Fenster\n- F6: Verschieben ins andere Fenster\n- F7: Neuer Ordner\n- F8: Neue Datei\n- Entf: Löschen\n- Strg+M: Mehrfach umbenennen'
              },
              'todo.md': {
                type: 'file',
                mtime: '2026-01-19 10:12',
                content: '# ShareOS Projektplan\n- [x] Webpad (Notepad++ Editor)\n- [x] WebTerm (Terminal)\n- [x] WinWeb (Media Player)\n- [x] ShareCommander (Zwei-Spalten-Dateimanager)'
              },
              'hello.js': {
                type: 'file',
                mtime: '2026-01-19 10:15',
                content: 'console.log("Hallo aus dem gemeinsamen ShareOS Dateisystem!");\nreturn 42;'
              },
              'config.json': {
                type: 'file',
                mtime: '2026-01-19 10:20',
                content: '{\n  "os": "ShareOS",\n  "version": "1.0.0",\n  "theme": "dark"\n}'
              }
            }
          }
        }
      }
    }
  }
};

// all apps of the box share one origin; this key is shared with WebTerm on purpose
const VFS_KEY = 'shareos.vfs', THEME_KEY = 'sharecommander.theme';
const MAX_BIN = 1024 * 1024;     // binary files in the VFS (localStorage is ~5 MB for all apps)
function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); return true; }
  catch (e) { return null; }
}
function loadVFS() {
  for (const k of [VFS_KEY, 'webterm.vfs', 'shareos_vfs']) {
    try {
      const v = JSON.parse(store(k) || 'null');
      if (v && v['/'] && v['/'].type === 'dir') return v;
    } catch (e) { }
  }
  return JSON.parse(JSON.stringify(defaultVFS));
}
let vfs = loadVFS();

function saveVFS() {
  // /box (files of the box opened in WebTerm) is never stored
  const copy = { '/': { ...vfs['/'], children: { ...vfs['/'].children } } };
  delete copy['/'].children.box;
  if (store(VFS_KEY, JSON.stringify(copy)) === null) {
    showToast('Browser-Speicher voll – Änderung nicht gespeichert. Große Dateien löschen oder herunterladen.');
    return false;
  }
  return true;
}
// WebTerm (another window) changed the VFS
addEventListener('storage', (e) => {
  if (e.key !== VFS_KEY || !e.newValue) return;
  try {
    const v = JSON.parse(e.newValue);
    if (!v || !v['/']) return;
    const box = vfs['/'].children.box;
    vfs = v;
    if (box) vfs['/'].children.box = box;
    renderBothPanes();
  } catch (err) { }
});

function nowStamp() {
  const d = new Date(), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// --- Dual-Pane State ---
const state = {
  activeSide: 'left',
  left: { drive: 'vfs', cwd: '/home/user', selected: new Set(), cursor: null, filter: '', sortBy: 'name', sortAsc: true, view: [], items: null },
  right: { drive: 'vfs', cwd: '/etc', selected: new Set(), cursor: null, filter: '', sortBy: 'name', sortAsc: true, view: [], items: null }
};

// --- folders of the box (ShareOS.fs, permission "files") ---------------------
// A pane shows either the VFS (drive "vfs") or a folder root of the box; on the
// box cwd is "/" + the path inside the root.
const FS = SOS && SOS.fs ? SOS.fs : null;
let boxRoots = [];
const isBox = (side) => state[side].drive !== 'vfs';
const relOf = (cwd) => cwd.replace(/^\/+/, '');
function stampOf(sec) {
  const d = new Date(sec * 1000), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
async function loadBox(side) {
  const p = state[side];
  try {
    const r = await FS.list(p.drive, relOf(p.cwd));
    p.items = r.entries.filter((e) => e.type !== 'other').map((e) => ({ name: e.name, isDir: e.type === 'dir' || e.type === 'dirlink', size: e.size, mtime: stampOf(e.mtime) }));
    p.free = r.free;
  } catch (e) {
    showToast(`Box: ${e.message}`);
    if (p.cwd !== '/') { p.cwd = parentOf(p.cwd); return loadBox(side); }
    p.items = [];
  }
  renderPane(side);
  if (side === state.activeSide) updatePreviewIfOpen();
}
function refreshBox() {
  return Promise.all(['left', 'right'].filter(isBox).map(loadBox));
}
// read / write one file of the box
async function boxRead(root, rel, name) {
  const f = await FS.open(root, rel, name);
  return new Uint8Array(await (await f.blob()).arrayBuffer());
}
async function boxWrite(root, rel, name, blob) {
  const f = await FS.open(root, rel, name, { write: true, create: true });
  return f.save(blob);
}
function setDrive(side, drive) {
  const p = state[side];
  p.drive = drive; p.selected.clear(); p.cursor = null; p.items = null; p.filter = '';
  document.getElementById(`drive-${side}`).value = drive;
  document.getElementById(`filter-${side}`).value = '';
  p.cwd = drive === 'vfs' ? '/home/user' : '/';
  if (drive === 'vfs') renderPane(side); else loadBox(side);
}
function fillDrives() {
  for (const side of ['left', 'right']) {
    const sel = document.getElementById(`drive-${side}`);
    sel.innerHTML = boxRoots.map((r) => `<option value="${escapeHTML(r.name)}">${r.usb ? '🔌' : r.home ? '🏠' : r.ro ? '🔒' : '🗄️'} ${r.home ? 'Persönlicher Ordner' : escapeHTML(r.name)}${r.ro ? ' (nur lesen)' : ''}</option>`).join('') +
      '<option value="vfs">💻 Browser-Speicher (nur dieser Browser)</option>';
    sel.value = state[side].drive;
    sel.hidden = !boxRoots.length;
    document.getElementById(`badge-${side}`).hidden = !!boxRoots.length;
  }
}

const themes = ['shareos', 'dark', 'norton', 'matrix'];
let currentThemeIdx = 0;

// --- VFS Helper Functions ---
function resolvePath(cwd, target) {
  if (!target || target === '/') return '/';
  if (target === '~') return '/home/user';
  const parts = (target.startsWith('/') ? target : cwd + '/' + target).split('/');
  const resolved = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') resolved.pop();
    else resolved.push(p);
  }
  return '/' + resolved.join('/');
}
const parentOf = (path) => path.replace(/\/[^/]*$/, '') || '/';
const joinPath = (dir, name) => (dir === '/' ? '/' : dir + '/') + name;

function getNode(path) {
  if (path === '/') return vfs['/'];
  const parts = path.split('/').filter(Boolean);
  let curr = vfs['/'];
  for (const p of parts) {
    if (!curr || curr.type !== 'dir' || !curr.children || !Object.prototype.hasOwnProperty.call(curr.children, p)) return null;
    curr = curr.children[p];
  }
  return curr;
}
const validName = (n) => typeof n === 'string' && n.length > 0 && n.length <= 128 && !n.includes('/') && n !== '.' && n !== '..';

// bytes of a file node (text as UTF-8, binary from its data: URL)
function nodeBytes(node) {
  if (node.bin) {
    const b64 = String(node.content || '').split(',')[1] || '';
    const bin = atob(b64);
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  }
  return new TextEncoder().encode(node.content || '');
}
function nodeMime(node) {
  if (node.bin) return (/^data:([^;,]+)/.exec(node.content || '') || [, 'application/octet-stream'])[1];
  return 'text/plain;charset=utf-8';
}
function getByteSize(node) {
  if (node.type === 'dir') return 0;
  if (node.bin) {
    const b64 = String(node.content || '').split(',')[1] || '';
    return Math.floor(b64.length * 3 / 4) - (b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0);
  }
  return new Blob([node.content || '']).size;
}

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytes) / Math.log(k)));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getExtension(name, isDir) {
  if (isDir) return '<DIR>';
  const idx = name.lastIndexOf('.');
  return idx > 0 ? name.slice(idx + 1).toLowerCase() : 'file';
}
const MEDIA_EXT = ['mp3', 'wav', 'ogg', 'oga', 'opus', 'flac', 'm4a', 'aac', 'mp4', 'm4v', 'webm'];
const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'];
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', bmp: 'image/bmp', ico: 'image/x-icon',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', zip: 'application/zip', pdf: 'application/pdf' };

function getFileIcon(name, isDir) {
  if (isDir) return '📁';
  const ext = getExtension(name, false);
  if (['txt', 'md', 'log'].includes(ext)) return '📄';
  if (['js', 'json', 'html', 'css', 'py', 'sh'].includes(ext)) return '💻';
  if (MEDIA_EXT.includes(ext)) return '🎵';
  if (IMAGE_EXT.includes(ext)) return '🖼️';
  if (['zip', 'tar', 'gz'].includes(ext)) return '📦';
  return '📃';
}

function cloneNode(node) {
  return JSON.parse(JSON.stringify(node));
}

// a file read from the computer: text when it is valid UTF-8 without NUL bytes,
// otherwise a data: URL (up to MAX_BIN)
async function fileToNode(name, bytes, mtime) {
  let text = null;
  if (!bytes.includes(0)) {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { text = null; }
  }
  if (text !== null) return { type: 'file', mtime: mtime || nowStamp(), content: text };
  if (bytes.length > MAX_BIN) return null;
  const mime = MIME[getExtension(name, false)] || 'application/octet-stream';
  const url = await new Promise((res) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(new Blob([bytes], { type: mime }));
  });
  return { type: 'file', mtime: mtime || nowStamp(), bin: true, content: url };
}

// --- Rendering Panes ---
function setActivePane(side) {
  state.activeSide = side;
  document.getElementById('pane-left').classList.toggle('active-pane', side === 'left');
  document.getElementById('pane-right').classList.toggle('active-pane', side === 'right');
  updatePreviewIfOpen();
}

function renderBothPanes() {
  renderPane('left');
  renderPane('right');
  updatePreviewIfOpen();
}

function renderPane(side) {
  const pState = state[side];
  const box = isBox(side);
  let dirNode = null;
  if (!box) {
    dirNode = getNode(pState.cwd);
    while (!dirNode || dirNode.type !== 'dir') {     // the folder is gone (deleted elsewhere)
      pState.cwd = parentOf(pState.cwd);
      dirNode = getNode(pState.cwd);
    }
  }

  document.getElementById(`path-${side}`).textContent = box ? pState.drive + pState.cwd : pState.cwd;
  const tbody = document.getElementById(`list-${side}`);
  tbody.innerHTML = '';

  const children = box
    ? (pState.items || []).map((i) => ({ ...i, node: {}, ext: getExtension(i.name, i.isDir) }))
    : Object.entries(dirNode.children || {}).map(([name, node]) => ({
      name,
      node,
      isDir: node.type === 'dir',
      ext: getExtension(name, node.type === 'dir'),
      size: getByteSize(node),
      mtime: node.mtime || '–'
    }));
  const present = new Set(children.map((c) => c.name));

  const filtered = children.filter(item => item.name.toLowerCase().includes(pState.filter.toLowerCase()));

  // Sort (Directories always on top like Total Commander)
  filtered.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
    let cmp = 0;
    if (pState.sortBy === 'name') cmp = a.name.localeCompare(b.name);
    else if (pState.sortBy === 'ext') cmp = a.ext.localeCompare(b.ext);
    else if (pState.sortBy === 'size') cmp = a.size - b.size;
    else if (pState.sortBy === 'mtime') cmp = a.mtime.localeCompare(b.mtime);
    return pState.sortAsc ? cmp : -cmp;
  });

  // forget selections of entries that are gone
  for (const n of [...pState.selected]) if (!present.has(n)) pState.selected.delete(n);

  pState.view = (pState.cwd !== '/' ? ['..'] : []).concat(filtered.map((i) => i.name));
  if (!pState.view.includes(pState.cursor)) pState.cursor = pState.view[0] ?? null;

  if (pState.cwd !== '/') {
    const upTr = document.createElement('tr');
    if (pState.cursor === '..') upTr.classList.add('cursor-row');
    upTr.innerHTML = `
      <td></td>
      <td class="dir-entry">⬆️ [..]</td>
      <td>&lt;DIR&gt;</td>
      <td style="text-align:right;">--</td>
      <td>--</td>
    `;
    upTr.addEventListener('dblclick', () => navigateTo(side, '..'));
    upTr.addEventListener('click', () => { setActivePane(side); pState.cursor = '..'; renderPane(side); });
    tbody.appendChild(upTr);
  }

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    const isSelected = pState.selected.has(item.name);
    if (isSelected) tr.classList.add('selected-row');
    if (pState.cursor === item.name) tr.classList.add('cursor-row');

    const icon = getFileIcon(item.name, item.isDir);
    const sizeText = item.isDir ? '&lt;DIR&gt;' : formatBytes(item.size);

    tr.innerHTML = `
      <td><input type="checkbox" class="row-cb" ${isSelected ? 'checked' : ''}></td>
      <td class="${item.isDir ? 'dir-entry' : ''}">${icon} ${escapeHTML(item.name)}${item.node.ro ? ' 🔒' : ''}</td>
      <td>${escapeHTML(item.ext)}</td>
      <td style="text-align: right;">${sizeText}</td>
      <td>${escapeHTML(item.mtime)}</td>
    `;

    const cb = tr.querySelector('.row-cb');
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      setActivePane(side);
      if (cb.checked) pState.selected.add(item.name);
      else pState.selected.delete(item.name);
      pState.cursor = item.name;
      renderPane(side);
    });

    tr.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      setActivePane(side);
      if (e.shiftKey && pState.cursor) {          // range like in other file managers
        const a = pState.view.indexOf(pState.cursor), b = pState.view.indexOf(item.name);
        pState.view.slice(Math.min(a, b), Math.max(a, b) + 1).forEach((n) => { if (n !== '..') pState.selected.add(n); });
      } else if (e.ctrlKey || e.metaKey) {
        if (pState.selected.has(item.name)) pState.selected.delete(item.name);
        else pState.selected.add(item.name);
      }
      pState.cursor = item.name;
      renderPane(side);
      updatePreviewIfOpen();
    });

    tr.addEventListener('dblclick', () => {
      setActivePane(side);
      pState.cursor = item.name;
      openEntry(side, item.name);
    });

    tbody.appendChild(tr);
  });

  const totalBytes = filtered.reduce((acc, i) => acc + i.size, 0);
  document.getElementById(`stats-${side}`).textContent = (box && pState.items === null) ? 'Lade …' :
    `${pState.selected.size} markiert | ${filtered.length} Einträge (${formatBytes(totalBytes)})` + (box && pState.free != null ? ` | frei: ${formatBytes(pState.free)}` : '');
  const cur = tbody.querySelector('tr.cursor-row');
  if (cur && side === state.activeSide) cur.scrollIntoView({ block: 'nearest' });
}

function navigateTo(side, target) {
  const pState = state[side];
  const from = pState.cwd;
  if (isBox(side)) {
    const next = target === '~' ? '/' : resolvePath(pState.cwd, target);
    if (target !== '..' && target !== '/' && target !== '~' && !(pState.items || []).some((i) => i.name === target && i.isDir)) return;
    pState.cwd = next;
    pState.selected.clear();
    pState.cursor = target === '..' ? from.split('/').pop() : null;
    pState.items = null;
    renderPane(side);
    loadBox(side);
    return;
  }
  const nextPath = resolvePath(pState.cwd, target);
  const node = getNode(nextPath);
  if (node && node.type === 'dir') {
    pState.cwd = nextPath;
    pState.selected.clear();
    // going up: the cursor stays on the folder we came from
    pState.cursor = target === '..' ? from.split('/').pop() : null;
    renderPane(side);
  }
}

function openEntry(side, name) {
  if (name === '..') { navigateTo(side, '..'); return; }
  if (isBox(side)) {
    const it = (state[side].items || []).find((i) => i.name === name);
    if (!it) return;
    if (it.isDir) navigateTo(side, name); else handleFileDoubleClick(side, name, null);
    return;
  }
  const node = getNode(state[side].cwd).children[name];
  if (!node) return;
  if (node.type === 'dir') navigateTo(side, name);
  else handleFileDoubleClick(side, name, node);
}

function getTargetNames(side) {
  const pState = state[side];
  if (pState.selected.size > 0) return Array.from(pState.selected);
  if (pState.cursor && pState.cursor !== '..') return [pState.cursor];
  return [];
}
function cursorFile(side) {
  const name = state[side].cursor;
  if (isBox(side)) {
    const it = name && name !== '..' ? (state[side].items || []).find((i) => i.name === name) : null;
    return it ? { name, box: true, root: state[side].drive, rel: relOf(state[side].cwd), size: it.size,
      node: { type: it.isDir ? 'dir' : 'file', mtime: it.mtime }, path: 'box:' + state[side].drive + joinPath(state[side].cwd, name) } : null;
  }
  const dir = getNode(state[side].cwd);
  if (!name || name === '..' || !dir.children[name]) return null;
  return { name, node: dir.children[name], path: joinPath(state[side].cwd, name) };
}
function canWrite(dirPath) {
  for (let p = dirPath; ; p = parentOf(p)) {
    const n = getNode(p);
    if (n && n.ro) return false;
    if (p === '/') return true;
  }
}

// --- Core Operations (F2 - F8, Copy, Move, Delete, Mkdir) ---
// --- box operations (one or both panes on the box) ---
// recursive copy from a VFS node into a folder of the box
async function vfsToBox(node, name, root, rel, stat) {
  if (node.type === 'dir') {
    await FS.mkdir(root, rel, name).catch((e) => { if (e.message !== 'already exists') throw e; });
    const sub = (rel ? rel + '/' : '') + name;
    for (const [k, v] of Object.entries(node.children || {})) await vfsToBox(v, k, root, sub, stat);
  } else {
    await boxWrite(root, rel, name, new Blob([nodeBytes(node)]));
    stat.files++;
  }
}
// recursive copy from the box into a VFS folder node; too large files are skipped
async function boxToVfs(root, rel, name, isDir, dirNode, stat) {
  if (isDir) {
    const d = dirNode.children[name] && dirNode.children[name].type === 'dir' ? dirNode.children[name] : { type: 'dir', mtime: nowStamp(), children: {} };
    dirNode.children[name] = d;
    const sub = (rel ? rel + '/' : '') + name;
    const r = await FS.list(root, sub);
    for (const e of r.entries) if (e.type === 'dir' || e.type === 'file') await boxToVfs(root, sub, e.name, e.type === 'dir', d, stat);
  } else {
    const it = await FS.open(root, rel, name);
    if (it.size > MAX_BIN) { stat.skipped++; return; }
    const node = await fileToNode(name, new Uint8Array(await (await it.blob()).arrayBuffer()));
    if (node) { dirNode.children[name] = node; stat.files++; } else stat.skipped++;
  }
}

async function copyOrMoveBox(isMove, srcSide, dstSide, names) {
  const S = state[srcSide], D = state[dstSide];
  const sBox = isBox(srcSide), dBox = isBox(dstSide);
  const dstNames = dBox ? (D.items || []).map((i) => i.name) : Object.keys(getNode(D.cwd).children);
  const clash = names.filter((n) => dstNames.includes(n));
  if (clash.length && !confirm(`Im Ziel gibt es schon: ${clash.join(', ')}\n\nÜberschreiben?`)) return;
  const label = isMove ? 'verschoben' : 'kopiert';
  showToast(`${names.length} Element(e) werden ${label} …`);
  const stat = { files: 0, skipped: 0 };
  try {
    if (sBox && dBox) {
      if (clash.length) await FS.remove(D.drive, relOf(D.cwd), clash);
      await (isMove ? FS.move : FS.copy)(S.drive, relOf(S.cwd), names, D.drive, relOf(D.cwd));
    } else if (!sBox && dBox) {
      const srcDir = getNode(S.cwd);
      if (clash.length) await FS.remove(D.drive, relOf(D.cwd), clash);
      for (const n of names) if (srcDir.children[n]) await vfsToBox(srcDir.children[n], n, D.drive, relOf(D.cwd), stat);
      if (isMove) { names.forEach((n) => delete srcDir.children[n]); saveVFS(); }
    } else {
      const dstDir = getNode(D.cwd);
      for (const n of names) {
        const it = (S.items || []).find((i) => i.name === n);
        if (it) await boxToVfs(S.drive, relOf(S.cwd), n, it.isDir, dstDir, stat);
      }
      if (!saveVFS()) { vfs = loadVFS(); throw new Error('Browser-Speicher voll'); }
      if (isMove && !stat.skipped) await FS.remove(S.drive, relOf(S.cwd), names);
    }
    S.selected.clear();
    showToast(`${names.length} Element(e) ${label}` + (stat.skipped ? ` – ${stat.skipped} Datei(en) zu groß für den Browser-Speicher (über 1 MB) übersprungen${isMove ? ', Quelle bleibt' : ''}` : '') + '.');
  } catch (e) {
    showToast(`${isMove ? 'Verschieben' : 'Kopieren'} fehlgeschlagen: ${e.message}`);
  }
  await refreshBox();
  renderBothPanes();
}

function copyOrMove(isMove = false) {
  const srcSide = state.activeSide;
  const dstSide = srcSide === 'left' ? 'right' : 'left';
  const srcPath = state[srcSide].cwd;
  const dstPath = state[dstSide].cwd;
  if (isBox(srcSide) || isBox(dstSide)) {
    const names = getTargetNames(srcSide);
    if (!names.length) { showToast('Keine Dateien oder Ordner ausgewählt.'); return; }
    if (state[srcSide].drive === state[dstSide].drive && srcPath === dstPath) { showToast('Quell- und Zielverzeichnis sind identisch!'); return; }
    if (!isBox(dstSide) && !canWrite(dstPath)) { showToast(`${dstPath} ist schreibgeschützt.`); return; }
    if (state[srcSide].drive === state[dstSide].drive) {
      const inside = names.find((n) => dstPath === joinPath(srcPath, n) || dstPath.startsWith(joinPath(srcPath, n) + '/'));
      if (inside) { showToast(`'${inside}' kann nicht in sich selbst ${isMove ? 'verschoben' : 'kopiert'} werden.`); return; }
    }
    copyOrMoveBox(isMove, srcSide, dstSide, names);
    return;
  }

  if (srcPath === dstPath) { showToast('Quell- und Zielverzeichnis sind identisch!'); return; }
  const names = getTargetNames(srcSide);
  if (!names.length) { showToast('Keine Dateien oder Ordner ausgewählt.'); return; }
  if (!canWrite(dstPath)) { showToast(`${dstPath} ist schreibgeschützt.`); return; }
  if (isMove && !canWrite(srcPath)) { showToast(`${srcPath} ist schreibgeschützt – nur Kopieren geht.`); return; }

  const srcDir = getNode(srcPath);
  const dstDir = getNode(dstPath);
  // a folder cannot go into itself or one of its subfolders
  const inside = names.find((n) => dstPath === joinPath(srcPath, n) || dstPath.startsWith(joinPath(srcPath, n) + '/'));
  if (inside) { showToast(`'${inside}' kann nicht in sich selbst ${isMove ? 'verschoben' : 'kopiert'} werden.`); return; }
  const clash = names.filter((n) => dstDir.children[n]);
  if (clash.length && !confirm(`Im Ziel gibt es schon: ${clash.join(', ')}\n\nÜberschreiben?`)) return;

  let done = 0;
  names.forEach(name => {
    const item = srcDir.children[name];
    if (!item) return;
    const copy = cloneNode(item);
    delete copy.ro;
    copy.mtime = nowStamp();
    dstDir.children[name] = copy;
    if (isMove) delete srcDir.children[name];
    done++;
  });

  state[srcSide].selected.clear();
  saveVFS();
  renderBothPanes();
  showToast(`${done} Element(e) ${isMove ? 'verschoben' : 'kopiert'} nach ${dstPath}`);
}

function askName(text, value) {
  const n = prompt(text, value || '');
  if (n === null) return null;
  const clean = n.trim();
  if (!validName(clean)) { showToast('Ungültiger Name (kein „/“, nicht leer, höchstens 128 Zeichen).'); return null; }
  return clean;
}

function createFolder() {
  const side = state.activeSide;
  if (isBox(side)) {
    const n = askName('Neuer Ordnername:');
    if (!n) return;
    FS.mkdir(state[side].drive, relOf(state[side].cwd), n)
      .then(() => { state[side].cursor = n; showToast(`Ordner '${n}' erstellt.`); return refreshBox(); })
      .catch((e) => showToast(`Ordner: ${e.message}`));
    return;
  }
  if (!canWrite(state[side].cwd)) { showToast('Dieser Ordner ist schreibgeschützt.'); return; }
  const clean = askName('Neuer Ordnername:');
  if (!clean) return;
  const dirNode = getNode(state[side].cwd);
  if (dirNode.children[clean]) { showToast('Existiert bereits!'); return; }
  dirNode.children[clean] = { type: 'dir', mtime: nowStamp(), children: {} };
  state[side].cursor = clean;
  saveVFS();
  renderBothPanes();
  showToast(`Ordner '${clean}' erstellt.`);
}

function createNewFile() {
  const side = state.activeSide;
  if (isBox(side)) {
    const n = askName('Neuer Dateiname (z. B. notiz.txt):');
    if (!n) return;
    if ((state[side].items || []).some((i) => i.name === n)) { showToast('Existiert bereits!'); return; }
    boxWrite(state[side].drive, relOf(state[side].cwd), n, new Blob([]))
      .then(() => { state[side].cursor = n; showToast(`Datei '${n}' angelegt.`); return refreshBox(); })
      .catch((e) => showToast(`Datei: ${e.message}`));
    return;
  }
  if (!canWrite(state[side].cwd)) { showToast('Dieser Ordner ist schreibgeschützt.'); return; }
  const clean = askName('Neuer Dateiname (z. B. notiz.txt):');
  if (!clean) return;
  const dirNode = getNode(state[side].cwd);
  if (dirNode.children[clean]) { showToast('Existiert bereits!'); return; }
  dirNode.children[clean] = { type: 'file', mtime: nowStamp(), content: '' };
  state[side].cursor = clean;
  saveVFS();
  renderBothPanes();
  showToast(`Datei '${clean}' angelegt.`);
}

function renameEntry() {
  const side = state.activeSide;
  const f = cursorFile(side);
  if (!f) return;
  if (f.box) {
    const n = askName('Neuer Name:', f.name);
    if (!n || n === f.name) return;
    FS.rename(f.root, f.rel, f.name, n)
      .then(() => { state[side].selected.delete(f.name); state[side].cursor = n; return refreshBox(); })
      .catch((e) => showToast(`Umbenennen: ${e.message}`));
    return;
  }
  if (!canWrite(state[side].cwd) || f.node.ro) { showToast('Schreibgeschützt.'); return; }
  const clean = askName('Neuer Name:', f.name);
  if (!clean || clean === f.name) return;
  const dirNode = getNode(state[side].cwd);
  if (dirNode.children[clean] && !confirm(`'${clean}' gibt es schon. Überschreiben?`)) return;
  dirNode.children[clean] = dirNode.children[f.name];
  dirNode.children[clean].mtime = nowStamp();
  delete dirNode.children[f.name];
  state[side].selected.delete(f.name);
  state[side].cursor = clean;
  saveVFS();
  renderBothPanes();
}

function deleteSelected() {
  const side = state.activeSide;
  const names = getTargetNames(side);
  if (!names.length) return;
  if (isBox(side)) {
    if (!confirm(`Wirklich ${names.length} Element(e) AUF DER BOX löschen? (${names.join(', ')})\n\nDas lässt sich nicht rückgängig machen.`)) return;
    FS.remove(state[side].drive, relOf(state[side].cwd), names)
      .then(() => { state[side].selected.clear(); showToast(`${names.length} Element(e) gelöscht.`); return refreshBox(); })
      .catch((e) => showToast(`Löschen: ${e.message}`));
    return;
  }
  if (!canWrite(state[side].cwd)) { showToast('Dieser Ordner ist schreibgeschützt.'); return; }
  if (!confirm(`Wirklich ${names.length} Element(e) löschen? (${names.join(', ')})`)) return;

  const dirNode = getNode(state[side].cwd);
  names.forEach(n => delete dirNode.children[n]);
  state[side].selected.clear();
  saveVFS();
  renderBothPanes();
  showToast(`${names.length} Element(e) gelöscht.`);
}

// --- ZIP: real archives (store when packing; store and deflate when unpacking) ---
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}
function dosTime(stamp) {
  const m = /^(\d{4})-(\d\d)-(\d\d) (\d\d):(\d\d)/.exec(stamp || '') || [];
  const d = m.length ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : new Date();
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5), date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}

function buildZip(entries) {      // [{ name, data: Uint8Array, mtime }]
  const enc = new TextEncoder();
  let offset = 0;
  const localParts = [], centralParts = [];
  for (const e of entries) {
    const name = enc.encode(e.name), crc = crc32(e.data), t = dosTime(e.mtime);
    const lHeader = new Uint8Array(30 + name.length);
    const lv = new DataView(lHeader.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true);          // names are UTF-8
    lv.setUint16(8, 0, true);               // stored
    lv.setUint16(10, t.time, true);
    lv.setUint16(12, t.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, e.data.length, true);
    lv.setUint32(22, e.data.length, true);
    lv.setUint16(26, name.length, true);
    lHeader.set(name, 30);

    const cHeader = new Uint8Array(46 + name.length);
    const cv = new DataView(cHeader.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(12, t.time, true);
    cv.setUint16(14, t.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, e.data.length, true);
    cv.setUint32(24, e.data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cHeader.set(name, 46);

    localParts.push(lHeader, e.data);
    centralParts.push(cHeader);
    offset += lHeader.length + e.data.length;
  }
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' });
}

async function inflateRaw(bytes) {
  if (!('DecompressionStream' in window)) throw new Error('Dieser Browser kann nicht entpacken (DecompressionStream fehlt).');
  const ds = new DecompressionStream('deflate-raw');
  const out = new Response(new Blob([bytes]).stream().pipeThrough(ds));
  return new Uint8Array(await out.arrayBuffer());
}
async function readZip(bytes) {   // -> [{ path, data, dir }]
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('Keine ZIP-Datei.');
  const count = v.getUint16(eocd + 10, true);
  let p = v.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = [];
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt.');
    const flags = v.getUint16(p + 8, true), method = v.getUint16(p + 10, true);
    const csize = v.getUint32(p + 20, true), nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true), lofs = v.getUint32(p + 42, true);
    const path = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (flags & 1) throw new Error(`'${path}' ist verschlüsselt.`);
    if (path.endsWith('/')) { out.push({ path, dir: true }); continue; }
    const lnlen = v.getUint16(lofs + 26, true), lxlen = v.getUint16(lofs + 28, true);
    const raw = bytes.subarray(lofs + 30 + lnlen + lxlen, lofs + 30 + lnlen + lxlen + csize);
    let data;
    if (method === 0) data = raw.slice();
    else if (method === 8) data = await inflateRaw(raw);
    else throw new Error(`'${path}': Packverfahren ${method} wird nicht unterstützt.`);
    out.push({ path, data });
  }
  return out;
}

async function createZipArchive() {
  const side = state.activeSide;
  const names = getTargetNames(side);
  if (!names.length) { showToast('Bitte markiere Dateien zum Packen.'); return; }
  const zipName = askName('Name des ZIP-Archivs:', names.length === 1 ? names[0].replace(/\.[^.]+$/, '') + '.zip' : 'archiv.zip');
  if (!zipName) return;
  const finalZipName = /\.zip$/i.test(zipName) ? zipName : zipName + '.zip';
  if (isBox(side)) { packOnBox(side, names, finalZipName); return; }

  const dirNode = getNode(state[side].cwd);
  const entries = [];
  (function collect(map, prefix) {
    for (const [k, v] of Object.entries(map)) {
      if (v.type === 'file') entries.push({ name: prefix + k, data: nodeBytes(v), mtime: v.mtime });
      else if (v.type === 'dir' && v.children) collect(v.children, `${prefix}${k}/`);
    }
  })(Object.fromEntries(names.filter((n) => dirNode.children[n]).map((n) => [n, dirNode.children[n]])), '');

  if (!entries.length) { showToast('Keine packbaren Dateien gefunden.'); return; }
  const zipBlob = buildZip(entries);

  // into the VFS when it fits, and always as a download
  let inVfs = false;
  if (canWrite(state[side].cwd) && zipBlob.size <= MAX_BIN) {
    const node = await fileToNode(finalZipName, new Uint8Array(await zipBlob.arrayBuffer()));
    if (node && (!dirNode.children[finalZipName] || confirm(`'${finalZipName}' überschreiben?`))) {
      dirNode.children[finalZipName] = node;
      inVfs = saveVFS();
      state[side].cursor = finalZipName;
      renderBothPanes();
    }
  }
  downloadBlob(zipBlob, finalZipName);
  showToast(inVfs ? `ZIP '${finalZipName}' im VFS gespeichert und heruntergeladen.` : `ZIP '${finalZipName}' heruntergeladen (für den Browser-Speicher zu groß).`);
}

const BOX_ZIP_MAX = 200 * 1024 * 1024;     // packed in the browser's memory
async function packOnBox(side, names, zipName) {
  const p = state[side], root = p.drive, base = relOf(p.cwd);
  if ((p.items || []).some((i) => i.name === zipName) && !confirm(`'${zipName}' überschreiben?`)) return;
  showToast('Packe …');
  try {
    const entries = [];
    let total = 0;
    const collect = async (rel, name, isDir, prefix) => {
      if (isDir) {
        const sub = (rel ? rel + '/' : '') + name;
        for (const e of (await FS.list(root, sub, true)).entries)
          if (e.type === 'dir' || e.type === 'file') await collect(sub, e.name, e.type === 'dir', prefix + name + '/');
      } else {
        const f = await FS.open(root, rel, name);
        total += f.size;
        if (total > BOX_ZIP_MAX) throw new Error('zusammen über 200 MB – dafür ist der Browser nicht gedacht');
        entries.push({ name: prefix + name, data: new Uint8Array(await (await f.blob()).arrayBuffer()), mtime: nowStamp() });
      }
    };
    for (const n of names) {
      const it = (p.items || []).find((i) => i.name === n);
      if (it) await collect(base, n, it.isDir, '');
    }
    if (!entries.length) { showToast('Keine packbaren Dateien gefunden.'); return; }
    await boxWrite(root, base, zipName, buildZip(entries));
    p.cursor = zipName;
    await refreshBox();
    showToast(`ZIP '${zipName}' auf der Box angelegt (${entries.length} Datei(en)).`);
  } catch (e) { showToast('Packen fehlgeschlagen: ' + e.message); }
}
async function unpackOnBox(side, f) {
  const p = state[side];
  if (f.size > BOX_ZIP_MAX) { showToast('Das Archiv ist zum Entpacken im Browser zu groß (über 200 MB).'); return; }
  let target = f.name.replace(/\.zip$/i, '');
  const names = (p.items || []).map((i) => i.name);
  for (let i = 2; names.includes(target); i++) target = f.name.replace(/\.zip$/i, '') + '_' + i;
  showToast('Entpacke …');
  try {
    const files = await readZip(await boxRead(f.root, f.rel, f.name));
    await FS.mkdir(f.root, f.rel, target);
    const base = (f.rel ? f.rel + '/' : '') + target, made = new Set();
    const ensure = async (parts) => {
      for (let i = 1; i <= parts.length; i++) {
        const key = parts.slice(0, i).join('/');
        if (made.has(key)) continue;
        await FS.mkdir(f.root, [base, ...parts.slice(0, i - 1)].join('/'), parts[i - 1]).catch((e) => { if (e.message !== 'already exists') throw e; });
        made.add(key);
      }
    };
    let n = 0, skipped = 0;
    for (const z of files) {
      const parts = z.path.split('/').filter((x) => x && x !== '.' && x !== '..');
      if (!parts.length || !parts.every(validName)) { skipped++; continue; }
      if (z.dir) { await ensure(parts); continue; }
      await ensure(parts.slice(0, -1));
      await boxWrite(f.root, [base, ...parts.slice(0, -1)].join('/'), parts[parts.length - 1], new Blob([z.data]));
      n++;
    }
    p.cursor = target;
    await refreshBox();
    showToast(`${n} Datei(en) entpackt nach '${target}/'` + (skipped ? ` – ${skipped} übersprungen (ungültiger Name)` : ''));
  } catch (e) { showToast('Entpacken fehlgeschlagen: ' + e.message); await refreshBox(); }
}

async function unpackZipArchive() {
  const side = state.activeSide;
  const f = cursorFile(side);
  if (!f || f.node.type !== 'file' || !/\.zip$/i.test(f.name)) { showToast('Bitte wähle zuerst eine .zip-Datei aus!'); return; }
  if (f.box) { unpackOnBox(side, f); return; }
  if (!canWrite(state[side].cwd)) { showToast('Dieser Ordner ist schreibgeschützt.'); return; }
  const dirNode = getNode(state[side].cwd);
  let target = f.name.replace(/\.zip$/i, '');
  for (let i = 2; dirNode.children[target]; i++) target = f.name.replace(/\.zip$/i, '') + '_' + i;

  let files;
  try {
    // archives of ShareCommander before 1.0 were JSON
    if (!f.node.bin && f.node.content && f.node.content.startsWith('{')) {
      const parsed = JSON.parse(f.node.content);
      if (!parsed || !parsed.__shareos_zip__ || !Array.isArray(parsed.files)) throw new Error('Keine ZIP-Datei.');
      files = parsed.files.map((x) => ({ path: x.path, data: new TextEncoder().encode(x.content || '') }));
    } else {
      files = await readZip(nodeBytes(f.node));
    }
  } catch (e) { showToast('Entpacken fehlgeschlagen: ' + e.message); return; }

  const root = { type: 'dir', mtime: nowStamp(), children: {} };
  let n = 0, skipped = 0;
  for (const z of files) {
    const parts = z.path.split('/').filter((p) => p && p !== '.' && p !== '..');
    if (!parts.length || !parts.every(validName)) { skipped++; continue; }
    let d = root;
    for (const part of (z.dir ? parts : parts.slice(0, -1))) {
      if (!d.children[part] || d.children[part].type !== 'dir') d.children[part] = { type: 'dir', mtime: nowStamp(), children: {} };
      d = d.children[part];
    }
    if (z.dir) continue;
    const node = await fileToNode(parts[parts.length - 1], z.data);
    if (!node) { skipped++; continue; }
    d.children[parts[parts.length - 1]] = node;
    n++;
  }
  dirNode.children[target] = root;
  if (!saveVFS()) { delete dirNode.children[target]; return; }
  state[side].cursor = target;
  renderBothPanes();
  showToast(`${n} Datei(en) entpackt nach '${target}/'` + (skipped ? ` – ${skipped} übersprungen (zu groß oder ungültiger Name)` : ''));
}

// --- Origin Private File System (OPFS) & folders of the computer ---
// OPFS is the browser's private storage of this origin: the active folder is
// copied there, and files that are only in OPFS come back into the folder
async function syncWithOPFS() {
  if (!navigator.storage || !navigator.storage.getDirectory) { showToast('OPFS wird von diesem Browser nicht unterstützt.'); return; }
  const side = state.activeSide;
  if (isBox(side)) { showToast('Der OPFS-Abgleich gilt für das Browser-Dateisystem (VFS).'); return; }
  const vfsDir = getNode(state[side].cwd);
  try {
    let dir = await navigator.storage.getDirectory();
    dir = await dir.getDirectoryHandle('sharecommander', { create: true });
    for (const part of state[side].cwd.split('/').filter(Boolean)) dir = await dir.getDirectoryHandle(part, { create: true });
    let out = 0, back = 0;
    for (const [name, node] of Object.entries(vfsDir.children)) {
      if (node.type !== 'file') continue;
      const w = await (await dir.getFileHandle(name, { create: true })).createWritable();
      await w.write(nodeBytes(node));
      await w.close();
      out++;
    }
    if (canWrite(state[side].cwd)) {
      for await (const [name, handle] of dir.entries()) {
        if (handle.kind !== 'file' || vfsDir.children[name] || !validName(name)) continue;
        const file = await handle.getFile();
        const node = await fileToNode(name, new Uint8Array(await file.arrayBuffer()), nowStamp());
        if (node) { vfsDir.children[name] = node; back++; }
      }
      if (back) { saveVFS(); renderBothPanes(); }
    }
    showToast(`⚡ OPFS: ${out} Datei(en) gesichert${back ? `, ${back} zurückgeholt` : ''}.`);
  } catch (err) {
    showToast(`OPFS-Fehler: ${err.message}`);
  }
}

async function mountLocalDirectory() {
  if (!window.showDirectoryPicker) { showToast('Ordner-Auswahl nur in Chrome/Edge – nutze stattdessen „Import“.'); return; }
  const side = state.activeSide;
  if (isBox(side)) {
    try {
      const dirHandle = await window.showDirectoryPicker();
      const p = state[side];
      await FS.mkdir(p.drive, relOf(p.cwd), dirHandle.name).catch((e) => { if (e.message !== 'already exists') throw e; });
      const sub = (relOf(p.cwd) ? relOf(p.cwd) + '/' : '') + dirHandle.name;
      let n = 0;
      for await (const [fname, handle] of dirHandle.entries()) {
        if (handle.kind !== 'file' || !validName(fname)) continue;
        await boxWrite(p.drive, sub, fname, await handle.getFile());
        n++;
      }
      await refreshBox();
      showToast(`Ordner '${dirHandle.name}' auf die Box kopiert: ${n} Datei(en).`);
    } catch (err) { if (err.name !== 'AbortError') showToast('Ordner: ' + err.message); }
    return;
  }
  if (!canWrite(state[side].cwd)) { showToast('Dieser Ordner ist schreibgeschützt.'); return; }
  try {
    const dirHandle = await window.showDirectoryPicker();
    const vfsDir = getNode(state[side].cwd);
    let name = dirHandle.name;
    for (let i = 2; vfsDir.children[name]; i++) name = dirHandle.name + '_' + i;
    const target = { type: 'dir', mtime: nowStamp(), children: {} };
    let n = 0, skipped = 0;
    for await (const [fname, handle] of dirHandle.entries()) {
      if (handle.kind !== 'file' || !validName(fname)) continue;
      const file = await handle.getFile();
      const node = await fileToNode(fname, new Uint8Array(await file.arrayBuffer()), new Date(file.lastModified).toISOString().slice(0, 16).replace('T', ' '));
      if (node) { target.children[fname] = node; n++; } else skipped++;
    }
    vfsDir.children[name] = target;
    if (!saveVFS()) { delete vfsDir.children[name]; return; }
    navigateTo(side, name);
    showToast(`Ordner '${dirHandle.name}' importiert: ${n} Datei(en)` + (skipped ? `, ${skipped} zu groß (über 1 MB)` : ''));
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Ordner-Zugriff abgebrochen.');
  }
}

// --- Quick View / File Preview (F3) & App Bridge (F4) ---
const previewPane = document.getElementById('preview-pane');
const workspaceEl = document.getElementById('workspace');
const previewBody = document.getElementById('preview-body');
const previewTitle = document.getElementById('preview-title');

function togglePreviewPane() {
  const isHidden = previewPane.classList.toggle('hidden');
  workspaceEl.classList.toggle('with-preview', !isHidden);
  if (!isHidden) updatePreviewIfOpen();
}

function hexDump(bytes) {
  const lines = [];
  for (let i = 0; i < bytes.length; i += 16) {
    const row = bytes.subarray(i, i + 16);
    const hex = Array.from(row, (b) => b.toString(16).padStart(2, '0')).join(' ').padEnd(47);
    const asc = Array.from(row, (b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : '.')).join('');
    lines.push(i.toString(16).padStart(6, '0') + '  ' + hex + '  ' + asc);
  }
  return lines.join('\n');
}

function updatePreviewIfOpen() {
  if (previewPane.classList.contains('hidden')) return;
  const f = cursorFile(state.activeSide);
  if (!f) {
    previewTitle.textContent = 'KEINE AUSWAHL';
    previewBody.innerHTML = '<div class="preview-placeholder">Wähle eine Datei in der Liste aus.</div>';
    return;
  }
  previewTitle.textContent = `VORSCHAU: ${f.name}`;
  if (f.box) { previewBox(f); return; }
  const item = f.node;
  if (item.type === 'dir') {
    const count = Object.keys(item.children || {}).length;
    previewBody.innerHTML = `📁 <b>Verzeichnis: ${escapeHTML(f.name)}</b>\n\nEnthält ${count} direkte Unterelemente.\nGeändert: ${escapeHTML(item.mtime || '--')}`;
    return;
  }
  const content = item.content || '';
  const mime = nodeMime(item);
  if (item.bin && /^image\//.test(mime) && mime !== 'image/svg+xml') {
    previewBody.innerHTML = '';
    const img = document.createElement('img');
    img.src = content;
    previewBody.appendChild(img);
  } else if (item.bin && /^(audio|video)\//.test(mime)) {
    previewBody.innerHTML = '';
    const m = document.createElement(mime.startsWith('video') ? 'video' : 'audio');
    m.controls = true;
    m.src = content;
    previewBody.appendChild(m);
  } else if (item.bin) {
    const bytes = nodeBytes(item);
    previewBody.innerHTML = '';
    const pre = document.createElement('div');
    pre.className = 'hex';
    pre.textContent = hexDump(bytes.subarray(0, 1024)) + (bytes.length > 1024 ? `\n… (${formatBytes(bytes.length)})` : '');
    previewBody.appendChild(pre);
  } else if (content.startsWith('data:image/') && !content.startsWith('data:image/svg')) {
    // images imported by ShareCommander before 1.0 (data: URL as text)
    previewBody.innerHTML = '';
    const img = document.createElement('img');
    img.src = content;
    previewBody.appendChild(img);
  } else {
    previewBody.textContent = content.length > 65536 ? content.slice(0, 65536) + '\n… (gekürzt)' : (content || '(Leere Datei)');
  }
}

// preview of a file of the box: pictures and media straight from the box,
// text up to 256 KB, otherwise the first KB as hex
let previewSeq = 0;
async function previewBox(f) {
  const seq = ++previewSeq;
  if (f.node.type === 'dir') { previewBody.innerHTML = `📁 <b>Verzeichnis: ${escapeHTML(f.name)}</b>\n\nGeändert: ${escapeHTML(f.node.mtime || '--')}`; return; }
  previewBody.innerHTML = '<div class="preview-placeholder">Lade …</div>';
  try {
    const file = await FS.open(f.root, f.rel, f.name);
    if (seq !== previewSeq) return;
    const ext = getExtension(f.name, false);
    previewBody.innerHTML = '';
    if (IMAGE_EXT.includes(ext) && ext !== 'svg') {
      const img = document.createElement('img'); img.src = file.url; previewBody.appendChild(img);
    } else if (MEDIA_EXT.includes(ext)) {
      const m = document.createElement(/^(mp4|m4v|webm)$/.test(ext) ? 'video' : 'audio');
      m.controls = true; m.preload = 'metadata'; m.src = file.url; previewBody.appendChild(m);
    } else {
      const bytes = new Uint8Array(await (await fetch(file.url, { headers: { Range: 'bytes=0-262143' } })).arrayBuffer()).subarray(0, 262144);
      if (seq !== previewSeq) return;
      let text = null;
      if (!bytes.subarray(0, 8192).includes(0)) { try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { text = f.size > bytes.length ? new TextDecoder().decode(bytes) : null; } }
      if (text !== null) previewBody.textContent = (text || '(Leere Datei)') + (f.size > bytes.length ? `\n… (gekürzt, ${formatBytes(f.size)})` : '');
      else {
        const pre = document.createElement('div'); pre.className = 'hex';
        pre.textContent = hexDump(bytes.subarray(0, 1024)) + (f.size > 1024 ? `\n… (${formatBytes(f.size)})` : '');
        previewBody.appendChild(pre);
      }
    }
  } catch (e) { if (seq === previewSeq) previewBody.textContent = 'Vorschau nicht möglich: ' + e.message; }
}

function sendSelectedToWebPad() {
  const side = state.activeSide;
  const f = cursorFile(side);
  if (f && f.box && f.node.type === 'file') {
    if (f.size > 5 * 1024 * 1024) { showToast('Für Webpad zu groß (über 5 MB).'); return; }
    FS.open(f.root, f.rel, f.name).then((file) => file.text()).then((content) => {
      sendTo('webpad', 'open-file', { to: 'webpad', reply: APP, path: f.path, name: f.name, content, readonly: false }, 'Webpad');
      showToast(`📝 '${f.name}' von der Box an Webpad gesendet – Speichern dort schreibt auf die Box.`);
    }).catch((e) => showToast('Webpad: ' + e.message));
    return;
  }
  if (!f || f.node.type !== 'file' || f.node.bin) { showToast('Bitte wähle eine Textdatei für Webpad aus.'); return; }
  sendTo('webpad', 'open-file', {
    to: 'webpad', reply: APP, path: f.path, name: f.name, content: f.node.content || '',
    readonly: !!f.node.ro || !canWrite(state[side].cwd)
  }, 'Webpad');
  showToast(`📝 '${f.name}' an Webpad gesendet.`);
}

function sendSelectedToWebPlayer() {
  const f = cursorFile(state.activeSide);
  if (!f || f.node.type !== 'file') return;
  const ext = getExtension(f.name, false);
  if (f.box && MEDIA_EXT.includes(ext)) {     // streamed from the box, no copy
    FS.open(f.root, f.rel, f.name).then((file) => {
      sendTo('webplayer', 'open-media', { to: 'webplayer', name: f.name, url: new URL(file.url, location.href).href }, 'WinWeb Player');
      showToast(`🎵 '${f.name}' an WinWeb Player gesendet.`);
    }).catch((e) => showToast('Player: ' + e.message));
    return;
  }
  if (!MEDIA_EXT.includes(ext) || !f.node.bin) { showToast('Bitte eine Audio- oder Videodatei wählen.'); return; }
  const blob = new Blob([nodeBytes(f.node)], { type: MIME[ext] || nodeMime(f.node) });
  sendTo('webplayer', 'open-media', { to: 'webplayer', name: f.name, blob }, 'WinWeb Player');
  showToast(`🎵 '${f.name}' an WinWeb Player gesendet.`);
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function downloadSelectedFile() {
  const f = cursorFile(state.activeSide);
  if (!f || f.node.type !== 'file') return;
  if (f.box) {
    FS.open(f.root, f.rel, f.name).then((file) => {
      const a = document.createElement('a'); a.href = file.url; a.download = f.name; a.click();
    }).catch((e) => showToast('Download: ' + e.message));
    return;
  }
  downloadBlob(new Blob([nodeBytes(f.node)], { type: nodeMime(f.node) }), f.name);
}

function handleFileDoubleClick(side, name, node) {
  const ext = getExtension(name, false);
  if (MEDIA_EXT.includes(ext) && (!node || node.bin)) sendSelectedToWebPlayer();
  else if (ext === 'zip') unpackZipArchive();
  else if (previewPane.classList.contains('hidden')) togglePreviewPane();
  else updatePreviewIfOpen();
}

// --- Bulk Rename Tool (Multi-Rename) ---
const renameModal = document.getElementById('rename-modal');
const renameMask = document.getElementById('rename-mask');
const renameSearch = document.getElementById('rename-search');
const renameReplace = document.getElementById('rename-replace');
const renameCase = document.getElementById('rename-case');
const renamePreviewBody = document.getElementById('rename-preview-body');

function openBulkRenameModal() {
  const names = getTargetNames(state.activeSide);
  if (!names.length) { showToast('Bitte markiere zuerst Dateien für das Mehrfach-Umbenennen.'); return; }
  renameModal.classList.remove('hidden');
  updateBulkRenamePreview();
  renameMask.focus();
}

function computeNewName(oldName, index) {
  const dotIdx = oldName.lastIndexOf('.');
  const base = dotIdx > 0 ? oldName.slice(0, dotIdx) : oldName;
  const ext = dotIdx > 0 ? oldName.slice(dotIdx) : '';
  let resultBase = renameMask.value
    .replace(/\[N\]/gi, base)
    .replace(/\[C\]/gi, String(index + 1).padStart(2, '0'));
  const searchStr = renameSearch.value;
  if (searchStr) resultBase = resultBase.split(searchStr).join(renameReplace.value);
  let full = resultBase + ext;
  if (renameCase.value === 'lower') full = full.toLowerCase();
  if (renameCase.value === 'upper') full = full.toUpperCase();
  return full;
}
function renamePlan() {
  const side = state.activeSide, names = getTargetNames(side);
  const dirNode = isBox(side) ? { children: Object.fromEntries((state[side].items || []).map((i) => [i.name, 1])) } : getNode(state[side].cwd);
  const plan = names.map((oldName, idx) => ({ oldName, newName: computeNewName(oldName, idx) }));
  const targets = new Map();
  for (const p of plan) {
    if (!validName(p.newName)) p.error = 'ungültig';
    else if (targets.has(p.newName)) p.error = 'doppelt';
    else if (p.newName !== p.oldName && dirNode.children[p.newName] && !names.includes(p.newName)) p.error = 'existiert';
    targets.set(p.newName, true);
  }
  return plan;
}

function updateBulkRenamePreview() {
  renamePreviewBody.innerHTML = '';
  renamePlan().forEach((p) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHTML(p.oldName)}</td><td style="color:var(${p.error ? '--danger' : '--accent'}); font-weight:bold;">${escapeHTML(p.newName)}${p.error ? ' ⚠ ' + p.error : ''}</td>`;
    renamePreviewBody.appendChild(tr);
  });
}

[renameMask, renameSearch, renameReplace, renameCase].forEach(el => el.addEventListener('input', updateBulkRenamePreview));

document.getElementById('apply-rename-btn').addEventListener('click', () => {
  const side = state.activeSide;
  const plan = renamePlan();
  if (plan.some((p) => p.error)) { showToast('Bitte erst die markierten Konflikte lösen.'); return; }
  if (isBox(side)) { renameOnBox(side, plan.filter((p) => p.newName !== p.oldName)); return; }
  if (!canWrite(state[side].cwd)) { showToast('Dieser Ordner ist schreibgeschützt.'); return; }
  const dirNode = getNode(state[side].cwd);
  // two steps, so "a" -> "b" and "b" -> "a" work
  const moved = plan.filter((p) => p.newName !== p.oldName).map((p) => ({ ...p, node: dirNode.children[p.oldName] }));
  moved.forEach((p) => delete dirNode.children[p.oldName]);
  moved.forEach((p) => { dirNode.children[p.newName] = p.node; p.node.mtime = nowStamp(); });
  state[side].selected.clear();
  saveVFS();
  renameModal.classList.add('hidden');
  renderBothPanes();
  showToast(`${moved.length} Element(e) umbenannt.`);
});

// on the box: two steps over temporary names when names are swapped
async function renameOnBox(side, moved) {
  const root = state[side].drive, rel = relOf(state[side].cwd);
  const olds = new Set(moved.map((p) => p.oldName));
  const swap = moved.some((p) => olds.has(p.newName));
  try {
    if (swap) {
      for (const [i, p] of moved.entries()) { p.tmp = `.sc-rename-${Date.now()}-${i}`; await FS.rename(root, rel, p.oldName, p.tmp); }
      for (const p of moved) await FS.rename(root, rel, p.tmp, p.newName);
    } else {
      for (const p of moved) await FS.rename(root, rel, p.oldName, p.newName);
    }
    showToast(`${moved.length} Element(e) umbenannt.`);
  } catch (e) { showToast('Umbenennen: ' + e.message); }
  state[side].selected.clear();
  renameModal.classList.add('hidden');
  await refreshBox();
}

document.getElementById('close-rename-modal').addEventListener('click', () => renameModal.classList.add('hidden'));

// --- Event Listeners & Keyboard Shortcuts ---
['left', 'right'].forEach(side => {
  const paneEl = document.getElementById(`pane-${side}`);
  paneEl.addEventListener('click', () => setActivePane(side));

  paneEl.querySelectorAll('.mini-nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      setActivePane(side);
      const act = btn.dataset.action;
      if (act === 'root') navigateTo(side, '/');
      if (act === 'home') navigateTo(side, '~');
      if (act === 'up') navigateTo(side, '..');
    });
  });

  document.getElementById(`drive-${side}`).addEventListener('change', (e) => { setActivePane(side); setDrive(side, e.target.value); });

  document.getElementById(`filter-${side}`).addEventListener('input', (e) => {
    state[side].filter = e.target.value;
    renderPane(side);
  });

  paneEl.querySelector('.select-all-cb').addEventListener('change', (e) => {
    state[side].selected.clear();
    if (e.target.checked) state[side].view.filter((n) => n !== '..').forEach((k) => state[side].selected.add(k));
    renderPane(side);
  });

  paneEl.querySelectorAll('th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const sortField = th.dataset.sort;
      if (state[side].sortBy === sortField) state[side].sortAsc = !state[side].sortAsc;
      else { state[side].sortBy = sortField; state[side].sortAsc = true; }
      renderPane(side);
    });
  });
});

// Import files of the computer into the active pane
document.getElementById('upload-input').addEventListener('change', async (e) => {
  const files = Array.from(e.target.files);
  e.target.value = '';
  const side = state.activeSide;
  if (isBox(side)) {
    const p = state[side];
    let n = 0;
    try {
      for (const file of files) {
        if (!validName(file.name)) continue;
        if ((p.items || []).some((i) => i.name === file.name) && !confirm(`'${file.name}' überschreiben?`)) continue;
        showToast(`Lade ${file.name} hoch …`);
        await boxWrite(p.drive, relOf(p.cwd), file.name, file);
        n++;
      }
      showToast(`${n} Datei(en) auf die Box geladen.`);
    } catch (err) { showToast('Hochladen: ' + err.message); }
    await refreshBox();
    return;
  }
  if (!canWrite(state[side].cwd)) { showToast('Dieser Ordner ist schreibgeschützt.'); return; }
  const dirNode = getNode(state[side].cwd);
  let n = 0;
  const big = [];
  for (const file of files) {
    if (!validName(file.name)) continue;
    const node = await fileToNode(file.name, new Uint8Array(await file.arrayBuffer()));
    if (!node) { big.push(file.name); continue; }
    if (dirNode.children[file.name] && !confirm(`'${file.name}' überschreiben?`)) continue;
    dirNode.children[file.name] = node;
    n++;
  }
  if (n && !saveVFS()) { vfs = loadVFS(); renderBothPanes(); return; }
  renderBothPanes();
  showToast(`${n} Datei(en) in ${state[side].cwd} importiert.` + (big.length ? ` Zu groß für den Browser-Speicher (über 1 MB): ${big.join(', ')}` : ''));
});

// Toolbar & Function Bar Bindings
document.getElementById('mount-local-btn').addEventListener('click', mountLocalDirectory);
document.getElementById('sync-opfs-btn').addEventListener('click', syncWithOPFS);
document.getElementById('zip-pack-btn').addEventListener('click', createZipArchive);
document.getElementById('zip-unpack-btn').addEventListener('click', unpackZipArchive);
document.getElementById('bulk-rename-btn').addEventListener('click', openBulkRenameModal);
document.getElementById('quick-view-btn').addEventListener('click', togglePreviewPane);
document.getElementById('close-preview-btn').addEventListener('click', togglePreviewPane);

document.getElementById('open-webpad-btn').addEventListener('click', sendSelectedToWebPad);
document.getElementById('open-webplayer-btn').addEventListener('click', sendSelectedToWebPlayer);
document.getElementById('download-file-btn').addEventListener('click', downloadSelectedFile);

document.getElementById('fn-f2').addEventListener('click', renameEntry);
document.getElementById('fn-f3').addEventListener('click', togglePreviewPane);
document.getElementById('fn-f4').addEventListener('click', sendSelectedToWebPad);
document.getElementById('fn-f5').addEventListener('click', () => copyOrMove(false));
document.getElementById('fn-f6').addEventListener('click', () => copyOrMove(true));
document.getElementById('fn-f7').addEventListener('click', createFolder);
document.getElementById('fn-f8').addEventListener('click', createNewFile);
document.getElementById('fn-del').addEventListener('click', deleteSelected);

function setTheme(t, keep) {
  currentThemeIdx = Math.max(0, themes.indexOf(t));
  if (t === 'dark') document.documentElement.removeAttribute('data-look');
  else document.documentElement.setAttribute('data-look', t);
  if (keep) store(THEME_KEY, t);
}
document.getElementById('theme-btn').addEventListener('click', () => setTheme(themes[(currentThemeIdx + 1) % themes.length], true));
// ShareOS look by default inside ShareOS (follows light/dark and the accent colour)
setTheme(store(THEME_KEY) || (SOS ? 'shareos' : 'dark'));

// cursor movement in the active pane
function moveCursor(delta, extend) {
  const p = state[state.activeSide];
  if (!p.view.length) return;
  let i = p.view.indexOf(p.cursor);
  i = Math.max(0, Math.min(p.view.length - 1, (i < 0 ? 0 : i) + delta));
  p.cursor = p.view[i];
  renderPane(state.activeSide);
  updatePreviewIfOpen();
}
function toggleMark() {
  const p = state[state.activeSide];
  if (p.cursor && p.cursor !== '..') {
    if (p.selected.has(p.cursor)) p.selected.delete(p.cursor); else p.selected.add(p.cursor);
  }
  moveCursor(1);
}

// Global Keyboard Navigation (Total Commander Feel)
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (!renameModal.classList.contains('hidden')) { if (e.key === 'Escape') renameModal.classList.add('hidden'); return; }
  const k = e.key, ctrl = e.ctrlKey || e.metaKey;
  const map = {
    Tab: () => setActivePane(state.activeSide === 'left' ? 'right' : 'left'),
    ArrowUp: () => moveCursor(-1), ArrowDown: () => moveCursor(1),
    PageUp: () => moveCursor(-15), PageDown: () => moveCursor(15),
    Home: () => moveCursor(-1e6), End: () => moveCursor(1e6),
    Enter: () => { const p = state[state.activeSide]; if (p.cursor) openEntry(state.activeSide, p.cursor); },
    Insert: toggleMark, ' ': toggleMark,
    F2: renameEntry, F3: togglePreviewPane, F4: sendSelectedToWebPad,
    F5: () => copyOrMove(false), F6: () => (e.shiftKey ? renameEntry() : copyOrMove(true)),
    F7: createFolder, F8: createNewFile, Delete: deleteSelected,
    Backspace: () => navigateTo(state.activeSide, '..'),
    Escape: () => { state[state.activeSide].selected.clear(); renderPane(state.activeSide); }
  };
  let fn = map[k];
  if (ctrl) {
    const c = k.toLowerCase();
    fn = c === 'm' ? openBulkRenameModal : c === 'q' ? togglePreviewPane
      : c === 'a' ? () => { const p = state[state.activeSide]; p.view.filter((n) => n !== '..').forEach((n) => p.selected.add(n)); renderPane(state.activeSide); }
      : null;
  }
  if (!fn) return;
  e.preventDefault();
  fn();
});

// Toast Helper
let toastTimer = null;
// messages of the box in German
const BOX_ERR = [[/read only/g, 'nur lesen – hier darfst du nichts ändern'], [/permission denied/g, 'keine Berechtigung'],
  [/already exists/g, 'gibt es schon'], [/not found/g, 'nicht gefunden'], [/no space left on the drive/g, 'das Laufwerk ist voll'],
  [/storage limit reached/g, 'dein Speicherlimit ist erreicht'], [/unknown folder/g, 'unbekannter Ordner']];
function showToast(msg) {
  const t = document.getElementById('toast');
  for (const [re, de] of BOX_ERR) msg = String(msg).replace(re, de);
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add('hidden'), 4000);
}

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

// --- Initialize ---
renderBothPanes();
if (FS) {
  FS.roots().then((roots) => {
    boxRoots = roots || [];
    fillDrives();
    // inside ShareOS with access to the box: both panes start on the box –
    // left the personal folder, right the next folder (a share) if there is one
    if (boxRoots.length) {
      const first = boxRoots.find((r) => r.home) || boxRoots[0];
      setDrive('left', first.name);
      setDrive('right', (boxRoots.find((r) => r !== first) || first).name);
    } else banner('Für dein Konto gibt es auf der Box weder einen persönlichen Ordner noch eine Freigabe. Bis dahin zeigt ShareCommander nur den Speicher dieses Browsers.');
  }).catch((e) => showToast('Box: ' + e.message));
} else if (SOS && SOS.user && SOS.user !== 'guest') {
  // opened from ShareOS, but the account may not use the folders of the box
  banner('Kein Zugriff auf die Ordner der Box: Der Administrator kann ihn unter Benutzer → „Dateien“ für dein Konto einschalten. Bis dahin zeigt ShareCommander nur den Speicher dieses Browsers.');
}
function banner(text) {
  const b = document.getElementById('banner');
  b.textContent = text; b.hidden = false;
}
