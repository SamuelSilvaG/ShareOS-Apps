'use strict';

/**
 * DockerDeck 2.0 – the Docker hosts of the homelab through ShareOS.docker
 * (permission "docker", admin accounts, ShareOS 0.2.0-beta.11+): the box
 * talks to their Docker Engine API. Containers with state, stack (compose
 * project) and ports; start, stop, restart, log and CPU/memory per container.
 * Docker itself does not run on the box.
 */

const SOS = window.ShareOS || null;
const DK = SOS && SOS.docker ? SOS.docker : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

const $ = (id) => document.getElementById(id);
$('user-display').textContent = `Account: ${user}`;

let hosts = [];
let containers = [];       // [{host, hostLabel, id, name, image, state, status, ports, stack}]
let hostState = {};        // name -> {ok, version, images, error}
let activeFilter = 'all';
let activeStack = null;
let logTarget = null;

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}
function showBanner(text) {
  const b = $('banner');
  b.textContent = text;
  b.classList.remove('hidden');
}
function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}
const fmtMB = (b) => b >= 1073741824 ? (b / 1073741824).toFixed(2) + ' GB' : Math.round(b / 1048576) + ' MB';

// 1. hosts and containers
async function loadAll() {
  if (!DK) return;
  try {
    hosts = await DK.hosts();
  } catch (err) {
    showBanner(/no access/.test(err.message) ? 'Kein Zugriff: DockerDeck ist nur für Administratoren.' : 'Docker-Hosts: ' + err.message);
    return;
  }
  renderHostSelect();
  $('storage-status').textContent = hosts.length ? `${hosts.length} Docker-Host${hosts.length === 1 ? '' : 's'} eingetragen` : 'kein Docker-Host eingetragen';
  const sel = $('host-select').value;
  const list = sel ? hosts.filter(h => h.name === sel) : hosts;
  $('refresh-containers-btn').disabled = true;
  const all = [];
  await Promise.all(list.map(async (h) => {
    try {
      const [v, cs, imgs] = await Promise.all([DK.version(h.name), DK.containers(h.name, true), DK.images(h.name).catch(() => null)]);
      hostState[h.name] = { ok: true, version: v.Version, images: Array.isArray(imgs) ? imgs.length : null };
      for (const c of cs) {
        all.push({
          host: h.name, hostLabel: h.label, id: c.Id, name: (c.Names && c.Names[0] || c.Id.slice(0, 12)).replace(/^\//, ''),
          image: c.Image, state: c.State, status: c.Status,
          stack: c.Labels && (c.Labels['com.docker.compose.project'] || c.Labels['com.docker.stack.namespace']) || null,
          ports: (c.Ports || []).filter(p => p.PublicPort).map(p => `${p.PublicPort}:${p.PrivatePort}${p.Type === 'udp' ? '/udp' : ''}`)
            .filter((x, i, a) => a.indexOf(x) === i).join(', ')
        });
      }
    } catch (err) {
      hostState[h.name] = { ok: false, error: err.message };
    }
  }));
  $('refresh-containers-btn').disabled = false;
  containers = all.sort((a, b) => (a.stack || '~').localeCompare(b.stack || '~') || a.name.localeCompare(b.name));
  const bad = list.filter(h => hostState[h.name] && !hostState[h.name].ok);
  if (bad.length) showToast(bad.map(h => `${h.label}: ${hostState[h.name].error}`).join(' · '));
  renderAll();
}

function renderHostSelect() {
  const sel = $('host-select'), cur = sel.value;
  sel.innerHTML = `<option value="">Alle Hosts (${hosts.length})</option>` + hosts.map(h => `<option value="${escapeHTML(h.name)}">${escapeHTML(h.label)}</option>`).join('');
  if (hosts.some(h => h.name === cur)) sel.value = cur;
}

// 2. view
function renderAll() {
  const running = containers.filter(c => c.state === 'running');
  const stacks = [...new Set(containers.map(c => c.stack).filter(Boolean))];
  $('count-all').textContent = containers.length;
  $('count-running').textContent = running.length;
  $('count-stopped').textContent = containers.length - running.length;
  $('stat-total').textContent = stacks.length;
  $('stat-running').textContent = `${running.length} / ${containers.length}`;
  const sel = $('host-select').value;
  const shown = sel ? [sel] : hosts.map(h => h.name);
  const imgs = shown.map(n => hostState[n] && hostState[n].images).filter(x => x != null);
  $('stat-ram').textContent = imgs.length ? imgs.reduce((a, b) => a + b, 0) : '–';
  const ok = shown.filter(n => hostState[n] && hostState[n].ok);
  const versions = [...new Set(ok.map(n => hostState[n].version))];
  const d = $('stat-daemon');
  d.textContent = !shown.length ? '–' : ok.length === shown.length ? (versions.length === 1 ? 'v' + versions[0] : `${ok.length} verbunden`) : `${ok.length} / ${shown.length} erreichbar`;
  d.className = 'v-val ' + (shown.length && ok.length === shown.length ? 'daemon-ok' : '');

  const bar = $('stack-filter-bar');
  if (activeStack && !stacks.includes(activeStack)) activeStack = null;
  bar.innerHTML = stacks.length ? stacks.map(s => `<button class="filter-pill${s === activeStack ? ' active' : ''}" data-stack="${escapeHTML(s)}">📦 ${escapeHTML(s)}</button>`).join('') : '';
  renderGrid();
}

const STATE = { running: ['running', '● Running'], exited: ['stopped', '⚪ Gestoppt'], created: ['stopped', '⚪ Erstellt'], paused: ['paused', '⏸ Pausiert'], restarting: ['restarting', '🔁 Startet neu'], dead: ['dead', '✖ Tot'], removing: ['dead', '✖ Wird entfernt'] };

function renderGrid() {
  const query = $('container-search').value.trim().toLowerCase();
  const filtered = containers.filter(c => {
    if (activeFilter === 'running' && c.state !== 'running') return false;
    if (activeFilter === 'stopped' && c.state === 'running') return false;
    if (activeStack && c.stack !== activeStack) return false;
    return !query || [c.name, c.image, c.stack || '', c.ports, c.hostLabel].some(x => x.toLowerCase().includes(query));
  });
  $('grid-title').textContent = activeStack ? `STACK ${activeStack.toUpperCase()}` : 'CONTAINER';
  const empty = $('empty-state');
  empty.classList.toggle('hidden', filtered.length > 0);
  if (!hosts.length) { $('empty-title').textContent = 'Noch kein Docker-Host'; $('empty-sub').classList.remove('hidden'); }
  else { $('empty-title').textContent = containers.length ? 'Kein Container passt zum Filter' : 'Keine Container gefunden'; $('empty-sub').classList.add('hidden'); }
  const multi = hosts.length > 1 && !$('host-select').value;
  $('containers-grid').innerHTML = filtered.map(c => {
    const st = STATE[c.state] || ['stopped', c.state];
    const run = c.state === 'running';
    const key = escapeHTML(c.host + '|' + c.id);
    return `<div class="container-card" data-key="${key}">
      <div class="container-top">
        <div class="container-meta">
          <div class="container-icon-badge">${c.stack ? '📦' : '🐳'}</div>
          <div class="container-title-box">
            <span class="container-name">${escapeHTML(c.name)}</span>
            <span class="container-image">${escapeHTML(c.image)}</span>
          </div>
        </div>
        <span class="status-pill status-${st[0]}">${st[1]}</span>
      </div>
      <div class="container-sub">
        ${c.stack ? `<span class="tag">📦 ${escapeHTML(c.stack)}</span>` : ''}
        ${multi ? `<span class="tag">🖥️ ${escapeHTML(c.hostLabel)}</span>` : ''}
        <span>${escapeHTML(c.status || '')}</span>
      </div>
      <div class="container-info-row">
        <span>Ports: ${escapeHTML(c.ports || '–')}</span>
      </div>
      <div class="container-bottom">
        <div class="container-actions">
          <button class="action-btn" data-act="${run ? 'stop' : 'start'}">${run ? '⏹️ Stoppen' : '▶️ Starten'}</button>
          <button class="action-btn" data-act="restart"${run ? '' : ' disabled'}>🔄 Neustart</button>
          <button class="action-btn" data-act="logs">📜 Protokoll</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// 3. actions on a container
$('containers-grid').addEventListener('click', async (e) => {
  const btn = e.target.closest('.action-btn');
  const card = e.target.closest('.container-card');
  if (!btn || !card || btn.disabled) return;
  const [host, id] = card.dataset.key.split('|');
  const c = containers.find(x => x.host === host && x.id === id);
  if (!c) return;
  const act = btn.dataset.act;
  if (act === 'logs') { openLogs(c); return; }
  if (act === 'stop' && !confirm(`Container „${c.name}“ stoppen?`)) return;
  card.querySelectorAll('.action-btn').forEach(b => { b.disabled = true; });
  try {
    await DK.action(host, id, act);
    showToast(`„${c.name}“ ${act === 'start' ? 'gestartet' : act === 'stop' ? 'gestoppt' : 'neu gestartet'}.`);
  } catch (err) {
    showToast(`${c.name}: ${err.message}`);
  }
  await loadAll();
});

// 4. log and resources of one container
async function openLogs(c) {
  logTarget = c;
  $('log-heading').textContent = `Protokoll · ${c.name}`;
  $('log-modal').classList.remove('hidden');
  await reloadLogs();
}
async function reloadLogs() {
  const c = logTarget;
  if (!c) return;
  $('log-box').textContent = 'Lade …';
  $('log-stats').textContent = '';
  try {
    const text = await DK.logs(c.host, c.id, +$('log-tail').value);
    $('log-box').textContent = text || '(keine Ausgabe)';
    $('log-box').scrollTop = $('log-box').scrollHeight;
  } catch (err) {
    $('log-box').textContent = 'Fehler: ' + err.message;
  }
  if (c.state === 'running') {
    try {
      const s = await DK.stats(c.host, c.id);
      const cpuD = s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
      const sysD = (s.cpu_stats.system_cpu_usage || 0) - (s.precpu_stats.system_cpu_usage || 0);
      const cores = s.cpu_stats.online_cpus || (s.cpu_stats.cpu_usage.percpu_usage || []).length || 1;
      const cpu = sysD > 0 ? cpuD / sysD * cores * 100 : 0;
      const mem = s.memory_stats.usage - ((s.memory_stats.stats || {}).inactive_file || (s.memory_stats.stats || {}).cache || 0);
      $('log-stats').textContent = `CPU ${cpu.toFixed(1)} % · RAM ${fmtMB(mem)}${s.memory_stats.limit ? ' / ' + fmtMB(s.memory_stats.limit) : ''}`;
    } catch (_) { /* stats are optional */ }
  }
}
$('log-reload').addEventListener('click', reloadLogs);
$('log-tail').addEventListener('change', reloadLogs);
const closeLog = () => { $('log-modal').classList.add('hidden'); logTarget = null; };
$('close-log-x').addEventListener('click', closeLog);
$('log-modal').addEventListener('click', (e) => { if (e.target === $('log-modal')) closeLog(); });

// 5. managing the hosts
function renderHostList() {
  $('host-list').innerHTML = hosts.length ? hosts.map(h => {
    const st = hostState[h.name];
    return `<div class="host-row"><span>${st ? (st.ok ? '🟢' : '🔴') : '⚪'}</span>
      <div class="grow"><b>${escapeHTML(h.label)}</b><small>${escapeHTML(h.name)} · ${escapeHTML(h.url)}${h.insecure ? ' · Zertifikat ungeprüft' : ''}${st && !st.ok ? ' · ' + escapeHTML(st.error) : ''}</small></div>
      <button class="del" data-name="${escapeHTML(h.name)}" title="Host entfernen">🗑</button></div>`;
  }).join('') : '<p class="form-hint">Noch kein Host eingetragen.</p>';
}
$('hosts-btn').addEventListener('click', () => { renderHostList(); $('hosts-modal').classList.remove('hidden'); });
const closeHosts = () => $('hosts-modal').classList.add('hidden');
$('close-hosts-x').addEventListener('click', closeHosts);
$('hosts-close-btn').addEventListener('click', closeHosts);
$('hosts-modal').addEventListener('click', (e) => { if (e.target === $('hosts-modal')) closeHosts(); });
$('host-list').addEventListener('click', async (e) => {
  const b = e.target.closest('.del');
  if (!b || !confirm(`Host „${b.dataset.name}“ aus DockerDeck entfernen? (Am Server ändert sich nichts.)`)) return;
  try { hosts = await DK.removeHost(b.dataset.name); delete hostState[b.dataset.name]; renderHostList(); await loadAll(); }
  catch (err) { showToast(err.message); }
});
$('host-form').addEventListener('submit', async () => {
  const name = $('f-hname').value.trim().toLowerCase();
  try {
    hosts = await DK.setHost({ name, label: $('f-hlabel').value.trim(), url: $('f-hurl').value.trim(), insecure: $('f-hinsecure').checked });
    $('host-form').reset();
    showToast('Host gespeichert – verbinde …');
    await loadAll();
    renderHostList();
    const st = hostState[name];
    showToast(st && st.ok ? `Verbunden: Docker ${st.version}` : `Gespeichert, aber nicht erreichbar: ${st ? st.error : ''}`);
  } catch (err) {
    showToast(err.message);
  }
});

// 6. filters and refresh
document.querySelectorAll('#status-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#status-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderGrid();
  });
});
$('stack-filter-bar').addEventListener('click', (e) => {
  const b = e.target.closest('.filter-pill');
  if (!b) return;
  activeStack = activeStack === b.dataset.stack ? null : b.dataset.stack;
  renderAll();
});
$('container-search').addEventListener('input', renderGrid);
$('host-select').addEventListener('change', loadAll);
$('refresh-containers-btn').addEventListener('click', loadAll);
setInterval(() => { if (DK && !document.hidden && $('log-modal').classList.contains('hidden') && $('hosts-modal').classList.contains('hidden')) loadAll(); }, 30000);

if (!DK) {
  showBanner('DockerDeck braucht ShareOS 0.2.0-beta.11 oder neuer und ein Administratorkonto (Berechtigung „docker“).');
  $('empty-state').classList.remove('hidden');
  $('hosts-btn').disabled = true;
} else {
  loadAll().then(() => { if (!hosts.length) { renderHostList(); $('hosts-modal').classList.remove('hidden'); } });
}
