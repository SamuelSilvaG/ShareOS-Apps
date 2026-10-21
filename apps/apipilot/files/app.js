'use strict';
// API-Pilot – REST and GraphQL client in the style of Postman / ReqBin.
// Requests go out from the browser (fetch), so the target must allow CORS;
// the box itself sends nothing. With the permission "files" a response can be
// saved on the box (ShareOS.fs.pick), and Webpad opens it for editing.

const APP = 'apipilot';
const SOS = window.ShareOS || null;
if (SOS) document.documentElement.setAttribute('data-look', 'shareos');
const $ = (id) => document.getElementById(id);

// --- ShareOS app bridge (same as ShareCommander) ----------------------------
const APP_SIZE = { webpad: { width: 1100, height: 760 } };
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
function sendTo(app, type, data, label) {
  if (alive(app)) { emit(type, data); return; }
  (pending[app] = pending[app] || []).push({ type, data });
  if (!openApp(app)) status(`${label}: Fenster blockiert – Pop-ups für diese Seite erlauben.`, true);
  setTimeout(() => {
    if (pending[app]) { delete pending[app]; status(`${label} meldet sich nicht – ist die App installiert?`, true); }
  }, 20000);
}

// --- small helpers -----------------------------------------------------------
function status(text, bad) {
  const el = $('pilot-status');
  el.textContent = text;
  el.style.color = bad ? 'var(--err)' : '';
}
function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1048576).toFixed(2) + ' MB';
}
function load(key, def) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
}
function store(key, v) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { }
}
// UTF-8 safe Base64 (btoa only takes Latin-1)
function b64(s) {
  let bin = '';
  new TextEncoder().encode(s).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
// a value for the shell in single quotes
const shq = (s) => "'" + String(s).replace(/'/g, "'\\''") + "'";

// --- tabs --------------------------------------------------------------------
function tabs(btnSel, viewPrefix, key) {
  document.querySelectorAll(btnSel).forEach((btn) => btn.addEventListener('click', () => {
    document.querySelectorAll(btnSel).forEach((b) => b.classList.remove('active'));
    document.querySelectorAll(`[id^="${viewPrefix}"]`).forEach((v) => v.classList.add('hidden'));
    btn.classList.add('active');
    $(viewPrefix + btn.dataset[key]).classList.remove('hidden');
    if (btn.dataset[key] === 'history') renderHistory();
  }));
}
tabs('.sub-tab', 'sub-', 'sub');
tabs('.res-tab', 'resview-', 'restab');

// --- the request form ----------------------------------------------------------
const F = {
  method: $('req-method'), url: $('req-url'), params: $('req-params-input'), headers: $('req-headers-input'),
  authType: $('auth-type'), token: $('auth-token'), user: $('auth-user'), pass: $('auth-pass'),
  bodyMode: $('body-mode'), body: $('req-body-input'), vars: $('req-vars-input')
};

function parseLines(text, sep) {
  const out = [];
  text.split('\n').forEach((line) => {
    const i = line.indexOf(sep);
    if (!line.trim()) return;
    if (i <= 0) out.push([line.trim(), '']);
    else out.push([line.slice(0, i).trim(), line.slice(i + 1).trim()]);
  });
  return out.filter(([k]) => k);
}

function updateForm() {
  const t = F.authType.value;
  F.token.hidden = t !== 'bearer';
  F.user.hidden = F.pass.hidden = t !== 'basic';
  $('header-count').textContent = parseLines(F.headers.value, ':').length;
  const mode = F.bodyMode.value;
  F.vars.hidden = mode !== 'graphql';
  F.body.placeholder = {
    json: '{\n  "title": "ShareOS API-Pilot",\n  "completed": false\n}',
    graphql: 'query {\n  country(code: "DE") { name capital currency }\n}',
    form: 'Ein Feld pro Zeile: name=Wert\nuser=jan\nlang=de',
    text: 'Beliebiger Text'
  }[mode];
  let hint = '', bad = false;
  const body = F.body.value.trim();
  if (mode === 'json' && body) {
    try { JSON.parse(body); hint = 'gültiges JSON'; } catch (e) { hint = 'kein gültiges JSON'; bad = true; }
  }
  if (mode === 'graphql' && F.vars.value.trim()) {
    try { JSON.parse(F.vars.value); } catch (e) { hint = 'Variablen: kein gültiges JSON'; bad = true; }
  }
  const h = $('body-hint');
  h.textContent = hint;
  h.classList.toggle('err', bad);
}
[F.authType, F.headers, F.bodyMode, F.body, F.vars].forEach((el) => el.addEventListener('input', updateForm));

// build url, headers and body from the form; secrets only when asked
function buildRequest() {
  const method = F.method.value;
  let url = F.url.value.trim();
  if (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'https://' + url;
  const qs = new URLSearchParams();
  parseLines(F.params.value, '=').forEach(([k, v]) => qs.append(k, v));
  const q = qs.toString();
  if (q) url += (url.includes('?') ? '&' : '?') + q;

  const headers = {};
  parseLines(F.headers.value, ':').forEach(([k, v]) => { headers[k] = v; });
  const has = (name) => Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase());
  if (F.authType.value === 'bearer' && F.token.value.trim()) headers.Authorization = 'Bearer ' + F.token.value.trim();
  if (F.authType.value === 'basic' && (F.user.value || F.pass.value)) headers.Authorization = 'Basic ' + b64(F.user.value + ':' + F.pass.value);

  let body = null;
  const raw = F.body.value;
  const mode = F.bodyMode.value;
  if (!['GET', 'HEAD'].includes(method) || mode === 'graphql') {
    if (mode === 'graphql' && raw.trim()) {
      let variables;
      if (F.vars.value.trim()) variables = JSON.parse(F.vars.value);
      body = JSON.stringify(variables ? { query: raw, variables } : { query: raw });
      if (!has('Content-Type')) headers['Content-Type'] = 'application/json';
    } else if (mode === 'form' && raw.trim()) {
      const f = new URLSearchParams();
      parseLines(raw, '=').forEach(([k, v]) => f.append(k, v));
      body = f.toString();
      if (!has('Content-Type')) headers['Content-Type'] = 'application/x-www-form-urlencoded';
    } else if (raw.trim()) {
      body = raw;
      if (!has('Content-Type')) headers['Content-Type'] = mode === 'json' ? 'application/json' : 'text/plain;charset=UTF-8';
    }
  }
  // GraphQL is sent as POST even when GET is selected
  return { method: mode === 'graphql' && body && method === 'GET' ? 'POST' : method, url, headers, body };
}

// --- code generator ------------------------------------------------------------
function codeSnippet(r) {
  const curl = [`curl -X ${r.method} ${shq(r.url)}`]
    .concat(Object.entries(r.headers).map(([k, v]) => `  -H ${shq(k + ': ' + v)}`))
    .concat(r.body != null ? [`  --data-raw ${shq(r.body)}`] : [])
    .join(' \\\n');
  let js =`const res = await fetch(${JSON.stringify(r.url)}, {\n  method: ${JSON.stringify(r.method)},\n  headers: ${JSON.stringify(r.headers, null, 2).replace(/\n/g, '\n  ')}`;
  if (r.body != null) js += `,\n  body: ${JSON.stringify(r.body)}`;
  js += `\n});\nconst data = await res.text();\nconsole.log(res.status, data);`;
  return `# cURL\n\n${curl}\n\n// JavaScript (fetch)\n\n${js}\n`;
}

// --- history (localStorage; per account inside ShareOS, without secrets) ------
const HKEY = 'apipilot.history';
let history = load(HKEY, []);
function remember(entry) {
  history = history.filter((h) => !(h.method === entry.method && h.url === entry.url && h.body === entry.body));
  history.unshift(entry);
  history = history.slice(0, 30);
  store(HKEY, history);
}
function renderHistory() {
  const list = $('history-list');
  list.textContent = '';
  if (!history.length) {
    const p = document.createElement('p');
    p.className = 'empty';
    p.textContent = 'Noch keine Anfragen.';
    list.appendChild(p);
    return;
  }
  history.forEach((h) => {
    const b = document.createElement('button');
    b.className = 'history-item';
    const m = document.createElement('span'); m.className = 'm'; m.textContent = h.method;
    const u = document.createElement('span'); u.className = 'u'; u.textContent = h.url; u.title = h.url;
    const s = document.createElement('span'); s.className = 's'; s.textContent = h.status || '';
    b.append(m, u, s);
    b.addEventListener('click', () => {
      F.method.value = h.method; F.url.value = h.url; F.params.value = h.params || '';
      F.headers.value = h.headers || ''; F.bodyMode.value = h.bodyMode || 'json';
      F.body.value = h.body || ''; F.vars.value = h.vars || '';
      updateForm();
      status('Anfrage aus dem Verlauf geladen.');
    });
    list.appendChild(b);
  });
}
$('history-clear').addEventListener('click', () => { history = []; store(HKEY, history); renderHistory(); });

// --- send ---------------------------------------------------------------------------
let last = { text: '', type: '' };
let busy = null;

async function send() {
  if (busy) { busy.abort(); return; }
  let r;
  try { r = buildRequest(); } catch (e) { status('Anfrage unvollständig: ' + e.message, true); return; }
  if (!r.url) { F.url.focus(); return; }
  try { new URL(r.url); } catch (e) { status('Ungültige Adresse.', true); return; }
  $('res-code-output').value = codeSnippet(r);

  const opts = { method: r.method, headers: r.headers };
  if (r.body != null) opts.body = r.body;
  busy = new AbortController();
  opts.signal = busy.signal;
  const sendBtn = $('send-btn');
  sendBtn.textContent = '✖ ABBRECHEN';
  status(`Sende ${r.method} ${r.url} …`);
  const stEl = $('res-status');
  const t0 = performance.now();
  const entry = { method: F.method.value, url: F.url.value.trim(), params: F.params.value, headers: F.headers.value, bodyMode: F.bodyMode.value, body: F.body.value, vars: F.vars.value };

  try {
    const res = await fetch(r.url, opts);
    const buf = await res.arrayBuffer();
    const ms = Math.round(performance.now() - t0);
    stEl.textContent = `Status: ${res.status} ${res.statusText}`;
    stEl.className = 'res-badge ' + (res.ok ? 'ok' : 'err');
    $('res-time').textContent = `Zeit: ${ms} ms`;
    $('res-size').textContent = `Größe: ${fmtBytes(buf.byteLength)}`;

    const type = res.headers.get('content-type') || '';
    let text = new TextDecoder().decode(buf);
    if (/json/i.test(type) || /^\s*[[{]/.test(text)) {
      try { text = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { }
    }
    if (r.method === 'HEAD') text = '(HEAD: keine Antwort-Daten)';
    last = { text, type };
    $('res-body-output').value = text;

    const hl = [];
    res.headers.forEach((v, k) => hl.push(`${k}: ${v}`));
    $('res-headers-output').value = hl.join('\n') +
      '\n\n# Der Browser zeigt nur die Header, die der Server per CORS freigibt (Access-Control-Expose-Headers).';
    status(`Empfangen: ${res.status} ${res.statusText} in ${ms} ms`);
    entry.status = res.status;
  } catch (err) {
    const aborted = err.name === 'AbortError';
    stEl.textContent = aborted ? 'Abgebrochen' : 'Netzwerkfehler';
    stEl.className = 'res-badge err';
    $('res-time').textContent = 'Zeit: – ms';
    $('res-size').textContent = 'Größe: –';
    const mixed = location.protocol === 'https:' && r.url.startsWith('http:');
    last = { text: '', type: '' };
    $('res-body-output').value = aborted ? 'Die Anfrage wurde abgebrochen.' :
      `Fehler: ${err.message}\n\nMögliche Gründe:\n` +
      (mixed ? '- Diese Seite läuft über HTTPS, die Adresse ist http:// – der Browser blockiert das (gemischte Inhalte). https:// verwenden.\n' : '') +
      '- Der Server erlaubt keine Anfragen aus dem Browser (CORS). API-Pilot sendet direkt aus dem Browser, nicht über die Box.\n' +
      '- Adresse falsch, Server nicht erreichbar oder Zertifikat ungültig.\n';
    $('res-headers-output').value = '';
    status(aborted ? 'Abgebrochen.' : 'Anfrage fehlgeschlagen.', !aborted);
    entry.status = aborted ? '' : 'Fehler';
  } finally {
    busy = null;
    sendBtn.textContent = '🚀 SENDEN';
    remember(entry);
  }
}
$('send-btn').addEventListener('click', send);
F.url.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });

// --- examples -------------------------------------------------------------------------
const presets = {
  jsonplaceholder: { method: 'GET', url: 'https://jsonplaceholder.typicode.com/posts/1', headers: 'Accept: application/json', bodyMode: 'json', body: '' },
  post: { method: 'POST', url: 'https://jsonplaceholder.typicode.com/posts', headers: 'Accept: application/json', bodyMode: 'json', body: '{\n  "title": "Hallo von ShareOS",\n  "body": "API-Pilot",\n  "userId": 1\n}' },
  graphql: { method: 'POST', url: 'https://countries.trevorblades.com/graphql', headers: '', bodyMode: 'graphql', body: 'query ($code: ID!) {\n  country(code: $code) { name capital currency emoji }\n}', vars: '{ "code": "DE" }' },
  ipify: { method: 'GET', url: 'https://api.ipify.org?format=json', headers: '', bodyMode: 'json', body: '' }
};
document.querySelectorAll('.preset-btn').forEach((btn) => btn.addEventListener('click', () => {
  const p = presets[btn.dataset.preset];
  if (!p) return;
  F.method.value = p.method; F.url.value = p.url; F.params.value = '';
  F.headers.value = p.headers; F.bodyMode.value = p.bodyMode; F.body.value = p.body; F.vars.value = p.vars || '';
  updateForm();
  status('Beispiel geladen – SENDEN drücken.');
}));

// --- the response: copy, download, box, Webpad ------------------------------------------
function fileName() {
  const t = last.type;
  const ext = /json/i.test(t) ? '.json' : /html/i.test(t) ? '.html' : /xml/i.test(t) ? '.xml' : /csv/i.test(t) ? '.csv' : '.txt';
  let base = 'antwort';
  try { base = (new URL(F.url.value.trim()).pathname.split('/').filter(Boolean).pop() || new URL(F.url.value.trim()).hostname).replace(/[^\w.-]+/g, '_'); } catch (e) { }
  return base.replace(/\.(json|html|xml|csv|txt)$/i, '') + ext;
}
function haveResponse() {
  if (last.text) return true;
  status('Noch keine Antwort.', true);
  return false;
}

$('copy-res-btn').addEventListener('click', async () => {
  if (!haveResponse()) return;
  try { await navigator.clipboard.writeText(last.text); }
  catch (e) {
    // no clipboard API without HTTPS: copy through the selection
    const ta = $('res-body-output');
    ta.focus(); ta.select();
    try { document.execCommand('copy'); } catch (e2) { status('Kopieren nicht möglich.', true); return; }
  }
  status('Antwort in die Zwischenablage kopiert.');
});

$('download-btn').addEventListener('click', () => {
  if (!haveResponse()) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([last.text], { type: last.type || 'text/plain' }));
  a.download = fileName();
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
});

// on the box: file dialog of ShareOS (permission "files", ShareOS 0.2.0-beta.1+)
if (SOS && SOS.fs && SOS.fs.pick) {
  $('save-box-btn').hidden = false;
  $('save-box-btn').addEventListener('click', async () => {
    if (!haveResponse()) return;
    const picked = await SOS.fs.pick({ title: 'Antwort auf der Box speichern', save: true, name: fileName() });
    if (!picked || !picked.length) return;
    const p = picked[0];
    try {
      const f = await SOS.fs.open(p.root, p.path, p.name, { write: true, create: true });
      await f.save(new Blob([last.text], { type: last.type || 'text/plain' }));
      status(`Gespeichert: ${p.path ? p.path + '/' : ''}${p.name}`);
    } catch (e) { status('Speichern: ' + e.message, true); }
  });
}

$('webpad-btn').addEventListener('click', () => {
  if (!haveResponse()) return;
  const name = fileName();
  sendTo('webpad', 'open-file', { to: 'webpad', reply: APP, path: 'apipilot:' + name, name, content: last.text, readonly: false }, 'Webpad');
  status('An Webpad geschickt.');
});
// saved in Webpad: the edited text replaces the response here (e.g. to save it on the box)
on('file-saved', (d) => {
  if (!d || d.to !== APP || typeof d.path !== 'string' || !d.path.startsWith('apipilot:')) return;
  last = { text: String(d.content ?? ''), type: last.type };
  $('res-body-output').value = last.text;
  status('Änderungen aus Webpad übernommen.');
});

// --- remember the form between visits (without secrets) --------------------------------
const FKEY = 'apipilot.form';
const saved = load(FKEY, null);
if (saved) {
  ['method', 'url', 'params', 'headers', 'bodyMode', 'body', 'vars'].forEach((k) => { if (typeof saved[k] === 'string') F[k].value = saved[k]; });
  if (saved.authType) F.authType.value = saved.authType;
}
let saveTimer = null;
document.addEventListener('input', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store(FKEY, {
    method: F.method.value, url: F.url.value, params: F.params.value, headers: F.headers.value,
    bodyMode: F.bodyMode.value, body: F.body.value, vars: F.vars.value, authType: F.authType.value
  }), 400);
});
updateForm();
