'use strict';
// --- ShareOS app bridge -------------------------------------------------------
// Inside ShareOS the app SDK (/_shareos/app.js) is loaded: messages go through
// ShareOS.emit/on (BroadcastChannel "shareos", every app on the box hears them).
// Outside ShareOS the same channel is used directly, so two apps served from
// the same web server still talk to each other.
const APP = 'webterm';
const SOS = window.ShareOS || null;
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

// Webpad saved a file we sent it: write it back into the virtual file system
on('file-saved', (d) => {
  if (!d || d.to !== APP || typeof d.path !== 'string') return;
  const parts = d.path.split('/').filter(Boolean);
  const fileName = parts.pop();
  const dirNode = getNode('/' + parts.join('/'));
  if (!fileName || !dirNode || dirNode.type !== 'dir') return;
  if (dirNode.children[fileName]?.ro) { print(`<span class="text-warn">[ShareOS] '${escapeHTML(fileName)}' ist schreibgeschützt – Änderung aus Webpad nicht übernommen.</span>`); return; }
  dirNode.children[fileName] = { type: 'file', content: String(d.content ?? '') };
  saveVFS();
  print(`<span class="text-accent">[ShareOS] '${escapeHTML(d.path)}' wurde in Webpad gespeichert.</span>`);
});

// which apps are open: they answer "ping" with "pong" and announce "app-ready"
const seen = {};
on('pong', (d, from) => { if (from) seen[from] = Date.now(); });
on('app-ready', (d, from) => {
  if (!from) return;
  seen[from] = Date.now();
  const q = pending[from]; delete pending[from];
  (q || []).forEach((m) => emit(m.type, m.data));
});
on('ping', () => emit('pong', {}));
const pending = {};
const alive = (app) => Date.now() - (seen[app] || 0) < 8000;
setInterval(() => emit('ping', {}), 3000);
emit('ping', {});
emit('app-ready', {});

// --- Virtuelles Dateisystem (VFS) ---
const defaultVFS = {
  '/': {
    type: 'dir',
    children: {
      'home': {
        type: 'dir',
        children: {
          'user': {
            type: 'dir',
            children: {
              'readme.txt': { type: 'file', content: 'Willkommen bei ShareOS WebTerm!\nTippe "help" für eine Liste aller Befehle.\nMit "webpad readme.txt" öffnest du diese Datei im Editor.' },
              'todo.md': { type: 'file', content: '# ShareOS To-Do\n- [x] WebPad bauen\n- [x] WebTerm integrieren\n- [ ] ShareCommander entwickeln' },
              'hello.js': { type: 'file', content: 'console.log("Hallo aus dem ShareOS Terminal!");\nreturn 42;' }
            }
          }
        }
      },
      'etc': {
        type: 'dir',
        children: {
          'os-release': { type: 'file', content: 'NAME="ShareOS"\nVERSION="1.0.0 (Web)"\nID=shareos' }
        }
      }
    }
  }
};

// all apps of the box share one origin: the VFS is shared with ShareCommander
// on purpose ("shareos.vfs"), everything else has our own key
const VFS_KEY = 'shareos.vfs', THEME_KEY = 'webterm.theme';
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
let vfs = null;
try { vfs = JSON.parse(store(VFS_KEY) || store('webterm.vfs') || store('shareos_vfs') || 'null'); } catch (e) { vfs = null; }
if (!vfs || !vfs['/'] || vfs['/'].type !== 'dir') vfs = JSON.parse(JSON.stringify(defaultVFS));
// ShareCommander (another window) changed the VFS
addEventListener('storage', (e) => {
  if (e.key !== VFS_KEY || !e.newValue) return;
  try {
    const v = JSON.parse(e.newValue);
    if (!v || !v['/'] || v['/'].type !== 'dir') return;
    const box = vfs['/'].children.box;
    vfs = v;
    if (box) vfs['/'].children.box = box;
  } catch (err) { }
});
function saveVFS() {
  const copy = { '/': { ...vfs['/'], children: { ...vfs['/'].children } } };
  delete copy['/'].children.box;
  if (store(VFS_KEY, JSON.stringify(copy)) === null && !saveVFS.warned) { saveVFS.warned = true; }
}
const validName = (n) => typeof n === 'string' && n.length > 0 && n.length <= 128 && !n.includes('/') && n !== '.' && n !== '..';

// --- Multi-Tab Sessions ---
let sessions = [];
let activeSessionId = null;

const outputEl = document.getElementById('terminal-output');
const inputEl = document.getElementById('cmd-input');
const promptEl = document.getElementById('prompt-label');
const tabsContainer = document.getElementById('tabs-container');
const viewport = document.getElementById('terminal-viewport');

let nextSession = 1;
function createSession() {
  const id = nextSession++;
  const session = {
    id,
    title: `bash (${sessions.length + 1})`,
    cwd: '/home/user',
    history: [],
    historyIndex: -1,
    logs: [
      `<span class="text-accent">ShareOS WebTerm [Version 1.0.0]</span>`,
      `Tippe <b>help</b> für alle verfügbaren Befehle oder <b>sysinfo</b> für Systemdaten.\n`
    ]
  };
  sessions.push(session);
  switchSession(id);
}

function switchSession(id) {
  activeSessionId = id;
  renderTabs();
  renderSession();
  inputEl.focus();
}

function closeSession(id, e) {
  e.stopPropagation();
  if (sessions.length === 1) return;
  sessions = sessions.filter(s => s.id !== id);
  if (activeSessionId === id) {
    activeSessionId = sessions[sessions.length - 1].id;
  }
  renderTabs();
  renderSession();
}

function renderTabs() {
  tabsContainer.innerHTML = '';
  sessions.forEach(s => {
    const tab = document.createElement('div');
    tab.className = `tab ${s.id === activeSessionId ? 'active' : ''}`;
    tab.innerHTML = `<span>>_ ${s.title}</span><span class="tab-close" title="Schließen">×</span>`;
    tab.addEventListener('click', () => switchSession(s.id));
    tab.querySelector('.tab-close').addEventListener('click', (e) => closeSession(s.id, e));
    tabsContainer.appendChild(tab);
  });
}

function getActiveSession() {
  return sessions.find(s => s.id === activeSessionId);
}

function renderSession() {
  const s = getActiveSession();
  outputEl.innerHTML = s.logs.map(line => `<div class="output-line">${line}</div>`).join('');
  const displayPath = s.cwd.replace('/home/user', '~');
  promptEl.innerHTML = `<span class="prompt-user">user@shareos</span>:<span class="prompt-path">${displayPath}</span>$`;
  viewport.scrollTop = viewport.scrollHeight;
}

function print(html) {
  const s = getActiveSession();
  s.logs.push(html);
  const div = document.createElement('div');
  div.className = 'output-line';
  div.innerHTML = html;
  outputEl.appendChild(div);
  viewport.scrollTop = viewport.scrollHeight;
}

// --- Pfad- & VFS-Helfer ---
function resolvePath(cwd, target) {
  if (!target || target === '~') return '/home/user';
  if (target.startsWith('~/')) target = '/home/user/' + target.slice(2);
  const parts = (target.startsWith('/') ? target : cwd + '/' + target).split('/');
  const resolved = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') resolved.pop();
    else resolved.push(p);
  }
  return '/' + resolved.join('/');
}

function getNode(path) {
  if (path === '/') return vfs['/'];
  const parts = path.split('/').filter(Boolean);
  let curr = vfs['/'];
  for (const p of parts) {
    if (!curr || curr.type !== 'dir' || !curr.children[p]) return null;
    curr = curr.children[p];
  }
  return curr;
}

// --- Befehls-Definitionen ---
const commands = {
  help: () => [
    `<b>Verfügbare ShareOS-Befehle:</b>`,
    `  <b>ls</b>               Verzeichnisinhalt anzeigen`,
    `  <b>cd &lt;pfad&gt;</b>        Verzeichnis wechseln`,
    `  <b>pwd</b>              Aktuelles Verzeichnis ausgeben`,
    `  <b>cat &lt;datei&gt;</b>      Dateiinhalt ausgeben`,
    `  <b>touch &lt;datei&gt;</b>    Leere Datei erstellen`,
    `  <b>write &lt;d&gt; &lt;txt&gt;</b>  Text in eine Datei schreiben`,
    `  <b>mkdir &lt;ordner&gt;</b>   Neuen Ordner anlegen`,
    `  <b>rm &lt;name&gt;</b>        Datei oder Ordner löschen`,
    `  <b>grep &lt;such&gt; &lt;d&gt;</b>  Datei nach Text durchsuchen`,
    `  <b>webpad &lt;datei&gt;</b>   Datei in Webpad öffnen (Speichern schreibt zurück)`,
    `  <b>run &lt;datei.js&gt;</b>   JS-Skript in einer Sandbox ausführen`,
    `  <b>calc &lt;term&gt;</b>      Mathematischen Ausdruck berechnen`,
    `  <b>date</b>             Aktuelles Datum und Uhrzeit anzeigen`,
    `  <b>whoami</b>           Aktuellen Benutzer anzeigen`,
    `  <b>theme &lt;name&gt;</b>     Theme wechseln (shareos, dark, matrix, ubuntu, amber)`,
    `  <b>sysinfo</b>          System- und Browser-Informationen (Neofetch)`,
    `  <b>matrix</b>           Matrix-Bildschirmschoner starten/stoppen`,
    `  <b>clear</b>            Terminal leeren`
  ].join('\n'),

  clear: () => {
    getActiveSession().logs = [];
    outputEl.innerHTML = '';
    return null;
  },

  pwd: () => getActiveSession().cwd,

  whoami: () => 'user',

  date: () => new Date().toLocaleString('de-DE'),

  ls: (args) => {
    const s = getActiveSession();
    const target = resolvePath(s.cwd, args[0] || '.');
    const node = getNode(target);
    if (!node) return `<span class="text-error">ls: Pfad nicht gefunden: ${escapeHTML(args[0] || '')}</span>`;
    if (node.type === 'file') return escapeHTML(args[0]);
    const items = Object.entries(node.children).map(([name, data]) =>
      data.type === 'dir' ? `<span class="dir-item">${escapeHTML(name)}/</span>` : `<span class="file-item">${escapeHTML(name)}</span>`
    );
    return items.length ? items.join('  ') : '<i>(leer)</i>';
  },

  cd: (args) => {
    const s = getActiveSession();
    const target = resolvePath(s.cwd, args[0] || '~');
    const node = getNode(target);
    if (!node) return `<span class="text-error">cd: Kein solches Verzeichnis: ${escapeHTML(args[0] || '')}</span>`;
    if (node.type !== 'dir') return `<span class="text-error">cd: Ist kein Verzeichnis: ${escapeHTML(args[0] || '')}</span>`;
    s.cwd = target;
    return null;
  },

  cat: (args) => {
    if (!args[0]) return `<span class="text-error">cat: Dateiname fehlt</span>`;
    const target = resolvePath(getActiveSession().cwd, args[0]);
    const node = getNode(target);
    if (!node) return `<span class="text-error">cat: Datei nicht gefunden: ${escapeHTML(args[0])}</span>`;
    if (node.type === 'dir') return `<span class="text-error">cat: ${escapeHTML(args[0])} ist ein Verzeichnis</span>`;
    if (node.bin) return `<i>Binärdatei (aus ShareCommander) – nicht als Text darstellbar.</i>`;
    return escapeHTML(node.content);
  },

  touch: (args) => {
    if (!args[0]) return `<span class="text-error">touch: Dateiname fehlt</span>`;
    if (!validName(args[0])) return `<span class="text-error">touch: ungültiger Name</span>`;
    const s = getActiveSession();
    const parentNode = getNode(s.cwd);
    if (parentNode.ro) return `<span class="text-error">touch: Ordner ist schreibgeschützt</span>`;
    if (!parentNode.children[args[0]]) {
      parentNode.children[args[0]] = { type: 'file', content: '' };
      saveVFS();
    }
    return `Datei <b>${escapeHTML(args[0])}</b> bereit.`;
  },

  write: (args) => {
    if (args.length < 2) return `<span class="text-error">Verwendung: write &lt;datei&gt; &lt;text&gt;</span>`;
    const fileName = args[0];
    const content = args.slice(1).join(' ');
    if (!validName(fileName)) return `<span class="text-error">write: ungültiger Name</span>`;
    const s = getActiveSession();
    const parentNode = getNode(s.cwd);
    const old = parentNode.children[fileName];
    if (parentNode.ro || old?.ro) return `<span class="text-error">write: schreibgeschützt</span>`;
    if (old && old.type === 'dir') return `<span class="text-error">write: ${escapeHTML(fileName)} ist ein Verzeichnis</span>`;
    parentNode.children[fileName] = { type: 'file', content: content };
    saveVFS();
    return `Inhalt in <b>${escapeHTML(fileName)}</b> gespeichert.`;
  },

  grep: (args) => {
    if (args.length < 2) return `<span class="text-error">Verwendung: grep &lt;suchbegriff&gt; &lt;datei&gt;</span>`;
    const term = args[0];
    const target = resolvePath(getActiveSession().cwd, args[1]);
    const node = getNode(target);
    if (!node || node.type !== 'file') return `<span class="text-error">grep: Datei nicht gefunden: ${escapeHTML(args[1])}</span>`;
    if (node.bin) return `<i>Binärdatei – grep durchsucht nur Text.</i>`;
    const lines = node.content.split('\n');
    const matches = lines
      .map((l, idx) => ({ line: l, num: idx + 1 }))
      .filter(item => item.line.toLowerCase().includes(term.toLowerCase()))
      .map(item => `<span class="text-accent">${item.num}:</span> ${escapeHTML(item.line)}`);
    return matches.length ? matches.join('\n') : '<i>Keine Treffer.</i>';
  },

  mkdir: (args) => {
    if (!args[0]) return `<span class="text-error">mkdir: Ordnername fehlt</span>`;
    if (!validName(args[0])) return `<span class="text-error">mkdir: ungültiger Name</span>`;
    const s = getActiveSession();
    const parentNode = getNode(s.cwd);
    if (parentNode.ro) return `<span class="text-error">mkdir: Ordner ist schreibgeschützt</span>`;
    if (parentNode.children[args[0]]) return `<span class="text-error">mkdir: '${escapeHTML(args[0])}' existiert bereits</span>`;
    parentNode.children[args[0]] = { type: 'dir', children: {} };
    saveVFS();
    return `Ordner <b>${escapeHTML(args[0])}</b> erstellt.`;
  },

  rm: (args) => {
    if (!args[0]) return `<span class="text-error">rm: Name fehlt</span>`;
    const s = getActiveSession();
    const parentNode = getNode(s.cwd);
    if (!parentNode.children[args[0]]) return `<span class="text-error">rm: '${escapeHTML(args[0])}' existiert nicht</span>`;
    if (parentNode.ro || parentNode.children[args[0]].ro) return `<span class="text-error">rm: schreibgeschützt</span>`;
    delete parentNode.children[args[0]];
    saveVFS();
    return `'${escapeHTML(args[0])}' wurde gelöscht.`;
  },

  echo: (args) => escapeHTML(args.join(' ')),

  calc: (args) => {
    if (!args.length) return `<span class="text-error">Beispiel: calc 12 * (4 + 2)</span>`;
    try {
      const expr = args.join('').replace(/[^0-9+\-*/().%]/g, '');
      return `= <b>${Function('"use strict"; return (' + expr + ')')()}</b>`;
    } catch {
      return `<span class="text-error">Ungültiger mathematischer Ausdruck</span>`;
    }
  },

  theme: (args) => {
    const themes = ['shareos', 'dark', 'matrix', 'ubuntu', 'amber'];
    const t = (args[0] || '').toLowerCase();
    if (!themes.includes(t)) {
      return `Verfügbare Themes: <b>${themes.join(', ')}</b> (z.B. <i>theme matrix</i>; <i>shareos</i> folgt dem Aussehen von ShareOS)`;
    }
    setTerm(t);
    store(THEME_KEY, t);
    return `Theme geändert auf <b>${t}</b>.`;
  },

  webpad: (args) => {
    if (!args[0]) return `<span class="text-error">Verwendung: webpad &lt;dateiname&gt;</span>`;
    const s = getActiveSession();
    const target = resolvePath(s.cwd, args[0]);
    const node = getNode(target);
    if (node && node.type !== 'file') return `<span class="text-error">webpad: ${escapeHTML(args[0])} ist ein Verzeichnis</span>`;
    if (node && node.bin) return `<span class="text-error">webpad: ${escapeHTML(args[0])} ist eine Binärdatei</span>`;
    const msg = { type: 'open-file', data: { to: 'webpad', reply: APP, path: target, name: target.split('/').pop(),
      content: node ? node.content : '', readonly: !!node?.ro } };
    if (alive('webpad')) {
      emit(msg.type, msg.data);
      return `<span class="text-accent">'${escapeHTML(args[0])}' an Webpad geschickt – Speichern in Webpad schreibt die Datei hierher zurück.</span>`;
    }
    // Webpad is not open: open it (same web server) and send the file when it is ready
    (pending.webpad = pending.webpad || []).push(msg);
    const w = window.open(new URL('/webpad/index.html', location.href).href, 'sos-webpad');
    setTimeout(() => { if (pending.webpad) { delete pending.webpad; print(`<span class="text-error">Webpad meldet sich nicht – ist Webpad 1.2 oder neuer installiert?</span>`); } }, 20000);
    return w ? `<span class="text-accent">Webpad wird geöffnet …</span>` : `<span class="text-error">Fenster blockiert – Pop-ups für diese Seite erlauben.</span>`;
  },

  run: (args) => {
    if (!args[0]) return `<span class="text-error">Verwendung: run &lt;datei.js&gt;</span>`;
    const target = resolvePath(getActiveSession().cwd, args[0]);
    const node = getNode(target);
    if (!node || node.type !== 'file') return `<span class="text-error">Datei nicht gefunden: ${escapeHTML(args[0])}</span>`;
    runSandboxed(node.content).then((r) => {
      const out = r.logs.map(escapeHTML);
      if (r.error) out.push(`<span class="text-error">Fehler: ${escapeHTML(r.error)}</span>`);
      else if (r.result !== undefined) out.push(`<span class="text-accent">Rückgabe: ${escapeHTML(r.result)}</span>`);
      print(out.join('\n') || '<i>Skript ohne Ausgabe beendet.</i>');
    });
    return null;
  },

  sysinfo: () => {
    const cores = navigator.hardwareConcurrency || 'Unbekannt';
    const mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : 'N/A';
    const res = `${window.innerWidth}x${window.innerHeight}`;
    return `<div class="sysinfo-box"><pre class="ascii-logo">
   _____ __                  ____  _____
  / ___// /_  ____ _________ / __ \\/ ___/
  \\__ \\/ __ \\/ __ \`/ ___/ _ \\ / / /\\__ \\ 
 ___/ / / / / /_/ / /  /  __/ /_/ /___/ / 
/____/_/ /_/\\__,_/_/   \\___/\\____//____/  
</pre><div><b>user@shareos</b>
------------------
<b>OS:</b> ShareOS Web Environment
<b>Shell:</b> WebTerm 1.0 (DOM)
<b>Resolution:</b> ${res}
<b>CPU Threads:</b> ${cores}
<b>Memory:</b> ${mem}
<b>VFS Storage:</b> localStorage
<b>ShareOS SDK:</b> ${SOS ? 'verbunden (App ' + escapeHTML(SOS.app) + ')' : 'nicht geladen (läuft außerhalb von ShareOS)'}</div></div>`;
  },

  matrix: () => {
    toggleMatrix();
    return `Matrix-Modus umgeschaltet (Klicke oder drücke eine Taste zum Beenden).`;
  }
};

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

// --- Eingabe-Verarbeitung & Tastenkürzel ---
inputEl.addEventListener('keydown', (e) => {
  if (matrixInterval) stopMatrix();
  const s = getActiveSession();

  if (e.key === 'Enter') {
    const raw = inputEl.value.trim();
    const displayPath = s.cwd.replace('/home/user', '~');
    print(`<span class="prompt-user">user@shareos</span>:<span class="prompt-path">${displayPath}</span>$ ${escapeHTML(raw)}`);
    inputEl.value = '';

    if (raw) {
      s.history.push(raw);
      s.historyIndex = s.history.length;
      const parts = (raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [raw]).map(p => p.replace(/^"|"$/g, ''));
      const cmd = parts[0].toLowerCase();
      const args = parts.slice(1);

      if (commands[cmd]) {
        const out = commands[cmd](args);
        if (out !== null && out !== undefined) print(out);
      } else {
        print(`<span class="text-error">${escapeHTML(cmd)}: Befehl nicht gefunden. Tippe 'help'.</span>`);
      }
    }
    renderSession();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (s.historyIndex > 0) {
      s.historyIndex--;
      inputEl.value = s.history[s.historyIndex];
    }
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (s.historyIndex < s.history.length - 1) {
      s.historyIndex++;
      inputEl.value = s.history[s.historyIndex];
    } else {
      s.historyIndex = s.history.length;
      inputEl.value = '';
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const val = inputEl.value.trim();
    const parts = val.split(' ');
    if (parts.length === 1) {
      const match = Object.keys(commands).find(c => c.startsWith(parts[0]));
      if (match) inputEl.value = match + ' ';
    } else {
      const last = parts[parts.length - 1];
      const node = getNode(s.cwd);
      if (node && node.children) {
        const match = Object.keys(node.children).find(f => f.startsWith(last));
        if (match) {
          parts[parts.length - 1] = match;
          inputEl.value = parts.join(' ');
        }
      }
    }
  } else if (e.ctrlKey && e.key.toLowerCase() === 'l') {
    e.preventDefault();
    commands.clear();
  } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
    e.preventDefault();
    createSession();
  }
});

// --- Matrix Easter-Egg ---
let matrixInterval = null;
const canvas = document.getElementById('matrix-canvas');
const ctx = canvas.getContext('2d');

function toggleMatrix() {
  if (matrixInterval) { stopMatrix(); return; }
  canvas.style.display = 'block';
  canvas.width = viewport.clientWidth;
  canvas.height = viewport.clientHeight;
  const cols = Math.floor(canvas.width / 16);
  const drops = Array(cols).fill(1);
  matrixInterval = setInterval(() => {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#00ff41';
    ctx.font = '15px monospace';
    drops.forEach((y, i) => {
      const char = String.fromCharCode(0x30A0 + Math.random() * 96);
      ctx.fillText(char, i * 16, y * 16);
      if (y * 16 > canvas.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    });
  }, 45);
}

function stopMatrix() {
  clearInterval(matrixInterval);
  matrixInterval = null;
  canvas.style.display = 'none';
}

viewport.addEventListener('click', () => {
  if (matrixInterval) stopMatrix();
  inputEl.focus();
});
document.getElementById('new-tab-btn').addEventListener('click', createSession);

// --- terminal theme (the attribute data-theme belongs to the ShareOS SDK) ---
function setTerm(t) {
  if (t === 'dark') document.documentElement.removeAttribute('data-term');
  else document.documentElement.setAttribute('data-term', t);
}
setTerm(store(THEME_KEY) || (SOS ? 'shareos' : 'dark'));

// --- "run": JavaScript in a sandboxed frame (no access to this page, the box
// or the other apps), console.log is passed back, stopped after 5 s ---
function runSandboxed(code) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const f = document.createElement('iframe');
    f.className = 'sandbox';
    f.setAttribute('sandbox', 'allow-scripts');
    f.srcdoc = '<script>addEventListener("message",function(e){var d=e.data,logs=[],c={log:function(){logs.push([].slice.call(arguments).join(" "))}};c.info=c.warn=c.error=c.log;' +
      'try{var r=new Function("console",d.code)(c);parent.postMessage({id:d.id,logs:logs,result:r===undefined?undefined:String(r)},"*")}' +
      'catch(x){parent.postMessage({id:d.id,logs:logs,error:String(x&&x.message||x)},"*")}});<\/script>';
    const done = (r) => { clearTimeout(timer); removeEventListener('message', got); f.remove(); resolve(r); };
    const got = (e) => { if (e.source === f.contentWindow && e.data && e.data.id === id) done(e.data); };
    const timer = setTimeout(() => done({ logs: [], error: 'abgebrochen nach 5 s' }), 5000);
    addEventListener('message', got);
    f.onload = () => f.contentWindow.postMessage({ id, code: String(code) }, '*');
    document.body.appendChild(f);
  });
}

// Erste Sitzung beim Start initialisieren
createSession();

// --- a file of the box, opened from the ShareOS file browser (read-only) ---
if (SOS && SOS.file) {
  SOS.file.info().then(() => SOS.file.text()).then((text) => {
    const name = SOS.file.name;
    if (!validName(name)) return;
    vfs['/'].children.box = vfs['/'].children.box || { type: 'dir', ro: true, children: {} };
    vfs['/'].children.box.ro = true;
    vfs['/'].children.box.children[name] = { type: 'file', ro: true, content: text };
    const s = getActiveSession();
    s.cwd = '/box';
    print(`<span class="text-accent">[ShareOS] '${escapeHTML(name)}' von der Box geöffnet (nur lesen): /box/${escapeHTML(name)}</span>`);
    print(`Zum Beispiel: <b>cat ${escapeHTML(name)}</b> oder <b>grep error ${escapeHTML(name)}</b>`);
    renderSession();
    document.getElementById('status-right').textContent = name + ' · nur lesen';
  }).catch((e) => print(`<span class="text-error">[ShareOS] Datei konnte nicht geöffnet werden: ${escapeHTML(e.message)}</span>`));
}
