'use strict';

/**
 * HomePing 2.0 – reachability of the homelab, checked from the box through
 * ShareOS.netcheck (permission "netcheck", admin accounts, ShareOS
 * 0.2.0-beta.11+): ping, TCP port or web address (HTTP/HTTPS), automatically
 * or on demand, with the last results per host. The host list is kept in
 * the personal folder on the box (network/hosts.json).
 */

const SOS = window.ShareOS || null;
const FS = (SOS && SOS.fs) ? SOS.fs : null;
const NET = (SOS && SOS.netcheck) ? SOS.netcheck : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

const $ = (id) => document.getElementById(id);
$('user-display').textContent = `Account: ${user}`;

const NETWORK_DIR = 'network';
const HOSTS_FILE = 'hosts.json';
const HISTORY = 24;
let boxRootName = null;

let hosts = [];
let activeStatus = 'all';
let editingHostId = null;
let checking = false;
let lastRun = null;
let timer = null;

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
}
function showBanner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('hidden');
}

// hosts of 1.x had only "host" (they were never really checked): ping
function normalize(h) {
  return {
    id: h.id || Date.now() + Math.random(), name: h.name || h.host || 'Host', icon: h.icon || '🖥️',
    check: h.check || 'ping', host: h.host || '', port: h.port || null, url: h.url || '',
    status: 'unknown', latency: null, error: null, history: Array.isArray(h.history) ? h.history.slice(-HISTORY) : [], checked: null
  };
}
const saved = (h) => ({ id: h.id, name: h.name, icon: h.icon, check: h.check, host: h.host, port: h.port, url: h.url });

// 1. host list: personal folder on the box, browser as fallback
async function initStorage() {
  try { hosts = (JSON.parse(localStorage.getItem('homeping_hosts') || '[]') || []).map(normalize); } catch (_) { hosts = []; }
  renderAll();
  if (!FS) {
    $('storage-status').textContent = 'Hosts: Browser';
    $('storage-indicator').textContent = 'Speicher: Browser';
    return;
  }
  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      boxRootName = (roots.find(r => r.home) || roots[0]).name;
      await FS.mkdir(boxRootName, '', NETWORK_DIR).catch(() => {});
      $('storage-status').textContent = `Hosts: 🏠 ${boxRootName}/${NETWORK_DIR}/${HOSTS_FILE}`;
      $('storage-indicator').textContent = `Box: ${boxRootName}`;
      try {
        const handle = await FS.open(boxRootName, NETWORK_DIR, HOSTS_FILE);
        const list = JSON.parse(await (await handle.blob()).text());
        // the sample hosts of 1.0/1.1 were never real: drop them
        hosts = list.filter(h => !(h.id <= 3 && ['FritzBox Router', 'Proxmox VE Server', 'TrueNAS Speicher'].includes(h.name))).map(normalize);
        renderAll();
      } catch (_) { /* no list yet */ }
    }
  } catch (err) {
    console.warn('FS error:', err);
  }
}

async function saveHosts() {
  try { localStorage.setItem('homeping_hosts', JSON.stringify(hosts.map(saved))); } catch (_) {}
  if (!FS || !boxRootName) return;
  try {
    const handle = await FS.open(boxRootName, NETWORK_DIR, HOSTS_FILE, { write: true, create: true });
    await handle.save(new Blob([JSON.stringify(hosts.map(saved), null, 2)], { type: 'application/json' }));
  } catch (e) {
    showToast('Speichern auf der Box fehlgeschlagen: ' + e.message);
  }
}

// 2. checks from the box
function checkOf(h) {
  if (h.check === 'tcp') return { kind: 'tcp', host: h.host, port: +h.port };
  if (h.check === 'http') return { kind: 'http', url: h.url };
  return { kind: 'ping', host: h.host, count: 2 };
}

async function runChecks(list) {
  if (!NET || checking || !list.length) return;
  checking = true;
  list.forEach(h => { h.status = 'checking'; });
  renderAll();
  try {
    const results = [];
    for (let i = 0; i < list.length; i += 32) results.push(...await NET.check(list.slice(i, i + 32).map(checkOf)));
    const now = Date.now();
    list.forEach((h, i) => {
      const r = results[i] || { ok: false, error: 'keine Antwort' };
      h.status = r.ok ? 'online' : 'offline';
      h.latency = r.ok && r.ms != null ? Math.round(r.ms) : null;
      h.error = r.ok ? null : (r.error || 'nicht erreichbar');
      h.detail = r.kind === 'ping' && r.ok ? `${r.received}/${r.sent} Antworten${r.loss ? ' · ' + r.loss + ' % Verlust' : ''}`
        : r.kind === 'http' && r.status ? `HTTP ${r.status}${r.cert_ok === false ? ' · Zertifikat nicht vertrauenswürdig' : ''}`
        : r.kind === 'tcp' && r.ok ? `Port ${h.port} offen` : '';
      h.checked = now;
      h.history.push(r.ok ? Math.max(1, h.latency || 1) : -1);
      if (h.history.length > HISTORY) h.history.shift();
    });
    lastRun = now;
  } catch (err) {
    list.forEach(h => { if (h.status === 'checking') h.status = 'unknown'; });
    if (/no access/.test(err.message)) showBanner('Kein Zugriff: Nur Administratoren dürfen von der Box aus prüfen.');
    else showToast('Prüfen fehlgeschlagen: ' + err.message);
  } finally {
    checking = false;
    renderAll();
  }
}

function schedule() {
  clearInterval(timer);
  const s = +$('auto-interval').value;
  try { localStorage.setItem('homeping_interval', String(s)); } catch (_) {}
  if (s > 0 && NET) timer = setInterval(() => { if (!document.hidden) runChecks(hosts); }, s * 1000);
}

// 3. view
function renderAll() {
  const total = hosts.length;
  const online = hosts.filter(h => h.status === 'online');
  const lat = online.filter(h => h.latency != null);
  $('stat-total').textContent = total;
  $('stat-online').textContent = `${online.length} / ${total}`;
  $('stat-latency').textContent = lat.length ? `${Math.round(lat.reduce((a, h) => a + h.latency, 0) / lat.length)} ms` : '– ms';
  $('stat-last').textContent = lastRun ? new Date(lastRun).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–';
  $('count-all').textContent = total;
  $('count-online').textContent = online.length;
  $('count-offline').textContent = hosts.filter(h => h.status === 'offline').length;
  renderHosts();
}

const target = (h) => h.check === 'http' ? h.url : h.check === 'tcp' ? `${h.host}:${h.port}` : h.host;
const checkName = { ping: 'Ping', tcp: 'Port', http: 'Web' };

function renderHosts() {
  const grid = $('hosts-grid');
  const query = $('ping-search').value.trim().toLowerCase();
  const filtered = hosts.filter(h => {
    if (activeStatus !== 'all' && h.status !== activeStatus) return false;
    return !query || h.name.toLowerCase().includes(query) || target(h).toLowerCase().includes(query);
  });
  $('empty-state').classList.toggle('hidden', filtered.length > 0);
  if (!hosts.length) $('empty-state').querySelector('.empty-title').textContent = 'Keine Hosts konfiguriert';
  else $('empty-state').querySelector('.empty-title').textContent = 'Kein Host passt zum Filter';
  grid.innerHTML = filtered.map(h => {
    const pill = { online: ['online', '🟢 Online'], offline: ['offline', '🔴 Offline'], checking: ['checking', '⏳ Prüfe …'] }[h.status] || ['unknown', '⚪ Ungeprüft'];
    const max = Math.max(10, ...h.history.filter(x => x > 0));
    const bars = h.history.map(x => x < 0 ? '<i class="bad" title="nicht erreichbar"></i>' : `<i style="height:${Math.max(15, Math.round(x / max * 100))}%" title="${x} ms"></i>`).join('');
    const up = h.history.length ? Math.round(h.history.filter(x => x > 0).length / h.history.length * 100) : null;
    return `<div class="host-card" data-id="${h.id}">
      <div class="host-top">
        <div class="host-meta">
          <div class="host-icon">${escapeHTML(h.icon || '🖥️')}</div>
          <div>
            <div class="host-title">${escapeHTML(h.name)}</div>
            <div class="host-ip">${escapeHTML(target(h))}</div>
            <div class="host-check">${checkName[h.check] || 'Ping'}${up != null ? ` · ${up} % erreichbar` : ''}</div>
          </div>
        </div>
        <span class="status-pill ${pill[0]}">${pill[1]}</span>
      </div>
      <div class="host-history">${bars}</div>
      ${h.error && h.status === 'offline' ? `<div class="host-error">${escapeHTML(h.error)}</div>` : h.detail && h.status === 'online' ? `<div class="host-detail">${escapeHTML(h.detail)}</div>` : ''}
      <div class="host-bottom">
        <span>Latenz: <span class="host-latency">${h.status === 'online' && h.latency != null ? h.latency + ' ms' : 'N/A'}</span></span>
        <div class="host-actions">
          <button class="action-btn ping-single-btn">⚡ Prüfen</button>
          <button class="action-btn edit-btn">⚙️ Edit</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

$('hosts-grid').addEventListener('click', (e) => {
  const card = e.target.closest('.host-card');
  if (!card) return;
  const h = hosts.find(x => String(x.id) === card.dataset.id);
  if (!h) return;
  if (e.target.closest('.ping-single-btn')) {
    if (!NET) { showToast('Prüfen braucht ShareOS 0.2.0-beta.11 und ein Administratorkonto.'); return; }
    runChecks([h]);
  } else if (e.target.closest('.edit-btn')) openModal(h);
});

// 4. dialog
function showFields() {
  const k = $('f-check').value;
  $('row-host').classList.toggle('hidden', k === 'http');
  $('grp-port').classList.toggle('hidden', k !== 'tcp');
  $('grp-url').classList.toggle('hidden', k !== 'http');
}
function openModal(h = null) {
  editingHostId = h ? h.id : null;
  $('modal-heading').textContent = h ? 'Host bearbeiten' : 'Host hinzufügen';
  $('f-name').value = h ? h.name : '';
  $('f-icon').value = h ? h.icon : '🖥️';
  $('f-check').value = h ? h.check : 'ping';
  $('f-host').value = h ? h.host : '';
  $('f-port').value = h && h.port ? h.port : '';
  $('f-url').value = h ? h.url : '';
  showFields();
  $('modal-delete-btn').classList.toggle('hidden', !h);
  $('ping-modal').classList.remove('hidden');
  $('f-name').focus();
}
function closeModal() {
  $('ping-modal').classList.add('hidden');
  editingHostId = null;
  $('ping-form').reset();
}
$('f-check').addEventListener('change', showFields);
$('open-add-btn').addEventListener('click', () => openModal());
$('close-modal-x').addEventListener('click', closeModal);
$('modal-cancel-btn').addEventListener('click', closeModal);
$('ping-modal').addEventListener('click', (e) => { if (e.target === $('ping-modal')) closeModal(); });

$('ping-form').addEventListener('submit', async () => {
  const v = { name: $('f-name').value.trim(), icon: $('f-icon').value.trim() || '🖥️', check: $('f-check').value,
    host: $('f-host').value.trim(), port: +$('f-port').value || null, url: $('f-url').value.trim() };
  if (!v.name) return;
  if (v.check !== 'http' && !/^[A-Za-z0-9.:-]+$/.test(v.host)) { showToast('Bitte eine IP-Adresse oder einen Namen eingeben.'); return; }
  if (v.check === 'tcp' && !(v.port >= 1 && v.port <= 65535)) { showToast('Bitte einen Port von 1 bis 65535 eingeben.'); return; }
  if (v.check === 'http' && !/^https?:\/\/\S+$/.test(v.url)) { showToast('Die Webadresse beginnt mit http:// oder https://'); return; }
  let h;
  if (editingHostId) {
    h = hosts.find(x => x.id === editingHostId);
    const changed = h.check !== v.check || target(h) !== target({ ...h, ...v });
    Object.assign(h, v);
    if (changed) Object.assign(h, { status: 'unknown', history: [], latency: null, error: null });
    showToast('Host aktualisiert.');
  } else {
    h = normalize({ id: Date.now(), ...v });
    hosts.push(h);
    showToast('Host hinzugefügt.');
  }
  closeModal();
  renderAll();
  await saveHosts();
  if (NET) runChecks([h]);
});

$('modal-delete-btn').addEventListener('click', async () => {
  if (!editingHostId || !confirm('Diesen Host wirklich löschen?')) return;
  hosts = hosts.filter(h => h.id !== editingHostId);
  closeModal();
  renderAll();
  await saveHosts();
  showToast('Host gelöscht.');
});

$('ping-all-btn').addEventListener('click', () => {
  if (!NET) { showToast('Prüfen braucht ShareOS 0.2.0-beta.11 und ein Administratorkonto.'); return; }
  runChecks(hosts);
});

document.querySelectorAll('#status-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#status-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    renderHosts();
  });
});
$('ping-search').addEventListener('input', renderHosts);
$('auto-interval').addEventListener('change', schedule);

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

try { const s = localStorage.getItem('homeping_interval'); if (s != null) $('auto-interval').value = s; } catch (_) {}
if (!NET) showBanner('HomePing prüft von der Box aus und braucht dafür ShareOS 0.2.0-beta.11 oder neuer und ein Administratorkonto (Berechtigung „netcheck“). Hosts lassen sich trotzdem schon eintragen.');
initStorage().then(() => { if (NET) runChecks(hosts); schedule(); });
