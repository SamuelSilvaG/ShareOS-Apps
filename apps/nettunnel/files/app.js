'use strict';
// NetTunnel – the box as an OpenVPN client, through the ShareOS app SDK:
//   ShareOS.vpn  profiles, connect/disconnect, state, log (permission "vpn",
//                admin accounts only, ShareOS 0.2.0-beta.6+, system app "openvpn")
//   ShareOS.fs   pick an .ovpn file on the box (permission "files")
// The box cleans every profile on import (no scripts, plugins, file
// references) and runs OpenVPN itself; this page only steers it.

const SOS = window.ShareOS || null;
const $ = (id) => document.getElementById(id);
const STATE_TXT = {
  CONNECTED: 'verbunden', CONNECTING: 'verbindet …', WAIT: 'wartet auf den Server …', AUTH: 'meldet sich an …',
  GET_CONFIG: 'holt die Einstellungen …', ASSIGN_IP: 'bekommt eine Adresse …', ADD_ROUTES: 'setzt Routen …',
  RECONNECTING: 'verbindet neu …', RESOLVE: 'sucht den Server …', TCP_CONNECT: 'verbindet (TCP) …', EXITING: 'trennt …', OFF: 'getrennt'
};
// messages of the box -> German
const ERRORS = [
  [/not installed/, 'OpenVPN ist nicht installiert – System-App „openvpn“ im Store installieren.'],
  [/^no access/, 'Kein Zugriff – NetTunnel ist nur für Administratoren (ein VPN betrifft das Netzwerk der ganzen Box).'],
  [/no tunnel support/, 'Diese Firmware kann noch keine Tunnel (TUN) – ShareOS aktualisieren.'],
  [/^server profiles/, 'Das ist ein Server-Profil – NetTunnel verbindet die Box nur als Client.'],
  [/must be inside the profile/, 'Das Profil verweist auf Dateien (Zertifikate, Schlüssel). Sie müssen im Profil selbst stehen (<ca>…</ca>).'],
  [/^no "remote"/, 'Im Profil steht kein Server („remote“).'],
  [/exists$/, 'Ein Profil mit diesem Namen gibt es schon.'],
  [/^invalid name/, 'Ungültiger Name (Buchstaben, Ziffern, Leerzeichen, - _ .).'],
  [/needs a user name and password/, 'Das Profil braucht Benutzername und Passwort – unter „Bearbeiten“ eintragen.'],
  [/^profile too big/, 'Das Profil ist zu groß.'],
  [/^empty profile/, 'Die Datei ist leer.'],
  [/did not start/, 'OpenVPN ist nicht gestartet – siehe Protokoll.']
];
function de(msg) {
  msg = String(msg || '');
  for (const [re, t] of ERRORS) if (re.test(msg)) return t;
  return msg;
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function fmtBytes(b) {
  b = +b || 0; if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return b.toFixed(b < 10 ? 1 : 0).replace('.', ',') + ' ' + u[i];
}
function banner(text) { const b = $('banner'); b.classList.toggle('hidden', !text); b.textContent = text || ''; }

let data = { profiles: [], status: null }, timer = 0;

// --- state ---------------------------------------------------------------------------
function renderState() {
  const st = data.status || {}, s = $('state');
  const on = st.state === 'CONNECTED', busy = st.running && !on;
  s.className = 'state' + (on ? ' ok' : busy ? ' busy' : '');
  s.textContent = on ? 'VPN verbunden' : busy ? 'VPN ' + (STATE_TXT[st.state] || st.state) : 'VPN getrennt';
  const box = $('status'); box.textContent = '';
  if (!st.running) {
    box.appendChild(el('p', 'muted', data.profiles.length ? 'Keine Verbindung. Links ein Profil wählen und verbinden.' : 'Noch kein Profil – oben ein .ovpn-Profil einspielen.'));
    return;
  }
  const dl = el('dl', 'kv');
  const row = (k, v) => { dl.appendChild(el('dt', null, k)); dl.appendChild(el('dd', null, v)); };
  row('Profil', st.profile || '–');
  row('Zustand', STATE_TXT[st.state] || st.state);
  row('Tunnel-Adresse', st.ip || '–');
  row('Server', st.remote || '–');
  if (st.since) row('Seit', new Date(st.since * 1000).toLocaleString('de-DE'));
  row('Empfangen', fmtBytes(st.bytes_in));
  row('Gesendet', fmtBytes(st.bytes_out));
  box.appendChild(dl);
}

function renderProfiles() {
  const box = $('profiles'), st = data.status || {};
  box.textContent = '';
  if (!data.profiles.length) {
    box.appendChild(el('div', 'empty muted', 'Noch kein VPN-Profil. Ein .ovpn-Profil von der Box oder vom Computer einspielen – es kommt meist vom VPN-Anbieter oder vom Router im Büro.'));
    return;
  }
  for (const p of data.profiles) {
    const active = st.running && st.profile === p.name;
    const d = el('div', 'prof' + (active && st.state === 'CONNECTED' ? ' on' : ''));
    const top = el('div', 'top');
    top.appendChild(el('span', 'name', p.name));
    if (active) top.appendChild(el('span', 'badge' + (st.state === 'CONNECTED' ? '' : ' warn'), STATE_TXT[st.state] || st.state));
    d.appendChild(top);
    d.appendChild(el('div', 'sub', 'Server ' + (p.remote || '?')));
    const b = el('div', 'badges');
    b.appendChild(el('span', 'badge', p.full ? 'Gesamter Verkehr' : 'Nur VPN-Netze'));
    if (p.autostart) b.appendChild(el('span', 'badge', 'Beim Start'));
    if (p.needs_auth) b.appendChild(el('span', 'badge' + (p.auth ? '' : ' warn'), p.auth ? 'Anmeldung gespeichert' : 'Anmeldung fehlt'));
    if (p.removed && p.removed.length) {
      const r = el('span', 'badge', 'bereinigt');
      r.title = 'Beim Einspielen entfernt: ' + p.removed.join(', ');
      b.appendChild(r);
    }
    d.appendChild(b);
    const acts = el('div', 'acts');
    const btn = (label, fn, cls) => { const x = el('button', 'sos-btn small' + (cls ? ' ' + cls : ''), label); x.addEventListener('click', fn); acts.appendChild(x); return x; };
    if (active) btn('Trennen', () => run(SOS.vpn.disconnect(), 'Getrennt.'));
    else btn('Verbinden', () => run(SOS.vpn.connect(p.name), 'Verbindet „' + p.name + '“ …'), 'primary');
    btn('Bearbeiten', () => editDialog(p));
    btn('Löschen', async () => {
      if (!confirm('Profil „' + p.name + '“ löschen?' + (active ? ' Die Verbindung wird getrennt.' : ''))) return;
      run(SOS.vpn.remove(p.name), 'Profil gelöscht.');
    }, 'danger');
    d.appendChild(acts);
    box.appendChild(d);
  }
}

async function run(promise, okText) {
  try { await promise; if (okText) toast(okText); }
  catch (e) { toast(de(e.message)); }
  load();
}

async function load() {
  clearTimeout(timer);
  try {
    data = await SOS.vpn.list();
    if (!data.status.installed) banner('OpenVPN fehlt: im ShareOS-Store die System-App „openvpn“ installieren. Danach NetTunnel neu öffnen.');
    else banner('');
  } catch (e) {
    banner(de(e.message));
    $('profiles').textContent = '';
  }
  renderProfiles();
  renderState();
  const st = data.status || {};
  timer = setTimeout(load, st.running && st.state !== 'CONNECTED' ? 2000 : 10000);
}

async function loadLog() {
  try { const l = (await SOS.vpn.log()).log; const p = $('log'); p.textContent = l || '(leer)'; p.scrollTop = p.scrollHeight; }
  catch (e) { $('log').textContent = de(e.message); }
}

// --- import and edit dialog ------------------------------------------------------------
function dialog(o) {
  const d = $('dlg'), f = $('dlg-form');
  $('dlg-title').textContent = o.title;
  $('dlg-ok').textContent = o.ok;
  f.name.value = o.name || ''; f.name.readOnly = !!o.lockName;
  f.user.value = ''; f.pass.value = '';
  $('dlg-auth').classList.toggle('hidden', !o.auth);
  $('dlg-auth-hint').textContent = o.authHint || 'Das Profil verlangt Benutzername und Passwort des VPN.';
  f.full.checked = o.full !== false;
  f.autostart.checked = !!o.autostart;
  $('dlg-auto-row').classList.toggle('hidden', !o.showAuto);
  d.returnValue = '';
  d.showModal();
  return new Promise((ok) => d.addEventListener('close', () => {
    if (d.returnValue !== 'ok') return ok(null);
    ok({ name: f.name.value.trim(), user: f.user.value, pass: f.pass.value, full: f.full.checked, autostart: f.autostart.checked });
  }, { once: true }));
}

async function importText(fileName, text) {
  if (text.length > 250000) { toast('Das Profil ist zu groß.'); return; }
  const needs = /^\s*-{0,2}auth-user-pass\b/m.test(text);
  const base = String(fileName || 'VPN').replace(/\.(ovpn|conf)$/i, '').replace(/[^A-Za-z0-9 _.-]/g, '').slice(0, 40) || 'VPN';
  const r = await dialog({ title: 'Profil einspielen', ok: 'Einspielen', name: base, auth: needs, full: true, showAuto: false });
  if (!r) return;
  try {
    const res = await SOS.vpn.importProfile(r.name, text, { user: needs ? r.user : undefined, pass: needs ? r.pass : undefined, full: r.full });
    toast(res.removed && res.removed.length ? 'Eingespielt. Entfernt: ' + res.removed.join(', ') : 'Profil „' + r.name + '“ eingespielt.');
  } catch (e) { toast(de(e.message)); }
  load();
}

async function editDialog(p) {
  const r = await dialog({ title: 'Profil ' + p.name, ok: 'Speichern', name: p.name, lockName: true, auth: true,
    authHint: p.needs_auth ? (p.auth ? 'Leer lassen, um die gespeicherte Anmeldung zu behalten.' : 'Das Profil verlangt Benutzername und Passwort des VPN.') : 'Nur nötig, wenn der VPN-Server danach fragt.',
    full: p.full, autostart: p.autostart, showAuto: true });
  if (!r) return;
  const o = { full: r.full, autostart: r.autostart };
  if (r.user || r.pass) { o.user = r.user; o.pass = r.pass; }
  run(SOS.vpn.set(p.name, o), 'Gespeichert. Gilt beim nächsten Verbinden.');
}

$('add-box').addEventListener('click', async () => {
  const r = await SOS.fs.pick({ title: 'OpenVPN-Profil wählen', ext: ['.ovpn', '.conf'] }).catch((e) => { toast(de(e.message)); return null; });
  if (!r || !r[0]) return;
  try {
    const f = await SOS.fs.open(r[0].root, r[0].path || '', r[0].name);
    importText(r[0].name, await f.text());
  } catch (e) { toast(de(e.message)); }
});
$('add-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (file) importText(file.name, await file.text());
});
$('log-refresh').addEventListener('click', loadLog);

// --- start ---------------------------------------------------------------------------------
if (!SOS || !SOS.vpn) {
  banner(!SOS || !SOS.fs ? 'NetTunnel läuft nur auf einer ShareOS-Box, geöffnet aus der ShareOS-Oberfläche.' : 'NetTunnel braucht ShareOS 0.2.0-beta.6 oder neuer.');
  $('add-box').disabled = true;
  $('profiles').textContent = '';
  $('state').textContent = 'nicht verfügbar';
} else {
  load();
  loadLog();
  setInterval(loadLog, 15000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(); });
}
