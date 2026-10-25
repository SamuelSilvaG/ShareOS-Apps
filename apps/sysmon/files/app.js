'use strict';

/**
 * SysMon 2.0 – the box's values and processes through ShareOS.sysinfo
 * (permission "sysinfo", admin accounts, ShareOS 0.2.0-beta.11+): CPU,
 * memory, temperature, fan, load, drives, network and the process list,
 * live every 3 seconds; processes can be ended. Snapshots go to the
 * personal folder on the box (system/sysmon_snapshots.json).
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const SYS = SOS && SOS.sysinfo ? SOS.sysinfo : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const SYSTEM_DIR = 'system';
const SNAPSHOT_FILE = 'sysmon_snapshots.json';
const INTERVAL = 3000;
let boxRootName = null;

let activeTab = 'all';
let paused = false;
let historyCPU = [];
let historyRAM = [];
let lastCpu = null;          // {total, idle} of the last sample
let lastTicks = {};          // pid -> ticks of the last sample
let lastProcCpu = null;      // cpu.total at the last process sample
let lastNet = null;          // {rx, tx, t}
let processes = [];
let info = null;
let busy = false;

const $ = (id) => document.getElementById(id);
const procSearch = $('proc-search');
const valCpu = $('val-cpu'), fillCpu = $('fill-cpu'), subCpu = $('sub-cpu');
const valRam = $('val-ram'), fillRam = $('fill-ram'), subRam = $('sub-ram');
const valTemp = $('val-io'), fillTemp = $('fill-io'), subTemp = $('sub-io');
const valUptime = $('val-uptime'), fillLoad = $('fill-load'), subClient = $('sub-client');
const sysCanvas = $('sys-canvas');
const ctx = sysCanvas.getContext('2d');
const procTbody = $('proc-tbody');
const storageStatus = $('storage-status');
const sysStats = $('sys-stats');

// processes ShareOS keeps alive (the box refuses to end them as well)
const PROTECTED = new Set(['init', 'ubusd', 'rpcd', 'uhttpd', 'dns320l-daemon', 'syslogd', 'klogd']);
const STATE = { R: ['running', '● Läuft'], S: ['idle', '◌ Wartet'], I: ['idle', '◌ Leerlauf'], D: ['disk', '⏳ E/A'], Z: ['zombie', '✖ Zombie'], T: ['idle', '⏸ Angehalten'] };

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

const fmtMB = (b) => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : (b / 1048576).toFixed(b < 10485760 ? 1 : 0) + ' MB';
const fmtBytes = (b) => b >= 1e12 ? (b / 1e12).toFixed(1) + ' TB' : b >= 1e9 ? (b / 1e9).toFixed(1) + ' GB' : (b / 1e6).toFixed(0) + ' MB';
const fmtRate = (b) => b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB/s' : (b / 1024).toFixed(0) + ' KB/s';
function fmtUptime(s) {
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
  return d ? `${d} T ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}
const level = (pct) => pct > 85 ? 'crit' : pct > 60 ? 'warn' : 'ok';

// 1. personal folder on the box (snapshots)
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = 'Snapshots: Browser';
    return;
  }
  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      boxRootName = (roots.find(r => r.home) || roots[0]).name;
      await FS.mkdir(boxRootName, '', SYSTEM_DIR).catch(() => {});
      storageStatus.textContent = `Snapshots: 🏠 ${boxRootName}/${SYSTEM_DIR}/${SNAPSHOT_FILE}`;
    }
  } catch (err) {
    console.warn('FS error:', err);
  }
}

async function saveSnapshot() {
  if (!info) { showToast('Noch keine Werte.'); return; }
  const snapshot = {
    timestamp: new Date().toISOString(),
    host: info.hostname, model: info.model, version: info.version,
    cpu: valCpu.textContent, ram: valRam.textContent, temperature: valTemp.textContent,
    uptime: info.uptime, load: info.load,
    volumes: info.volumes,
    processes: processes.map(p => ({ pid: p.pid, name: p.name, user: p.user, cpu: +p.cpu.toFixed(1), rss: p.rss, cmd: p.cmd }))
  };
  if (FS && boxRootName) {
    try {
      let snaps = [];
      try {
        const handle = await FS.open(boxRootName, SYSTEM_DIR, SNAPSHOT_FILE);
        snaps = JSON.parse(await (await handle.blob()).text());
      } catch (_) { snaps = []; }
      snaps.unshift(snapshot);
      snaps.length = Math.min(snaps.length, 30);
      const w = await FS.open(boxRootName, SYSTEM_DIR, SNAPSHOT_FILE, { write: true, create: true });
      await w.save(new Blob([JSON.stringify(snaps, null, 2)], { type: 'application/json' }));
      showToast('Snapshot auf der Box gesichert.');
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  } else {
    try { localStorage.setItem('sysmon_snapshot', JSON.stringify(snapshot)); } catch (_) {}
    showToast('Snapshot im Browser gesichert.');
  }
}

// 2. values of the box
function renderInfo(d) {
  info = d;
  // CPU from two samples of the jiffies
  if (d.cpu && lastCpu) {
    const dt = d.cpu.total - lastCpu.total, di = d.cpu.idle - lastCpu.idle;
    const pct = dt > 0 ? Math.max(0, Math.min(100, Math.round((1 - di / dt) * 100))) : 0;
    valCpu.textContent = `${pct} %`;
    fillCpu.style.width = `${pct}%`;
    fillCpu.className = `meter-fill ${level(pct)}`;
    historyCPU.push(pct);
    if (historyCPU.length > 60) historyCPU.shift();
  }
  if (d.cpu) lastCpu = d.cpu;
  subCpu.textContent = `${d.cores} ${d.cores === 1 ? 'Kern' : 'Kerne'} · ${d.procs ? d.procs.split('/')[1] + ' Prozesse' : ''}`;

  const m = d.memory || {};
  const used = (m.memtotal || 0) - (m.memavailable || 0);
  const ramPct = m.memtotal ? Math.round(used / m.memtotal * 100) : 0;
  valRam.textContent = fmtMB(used);
  fillRam.style.width = `${ramPct}%`;
  fillRam.className = `meter-fill ${level(ramPct)}`;
  subRam.textContent = `von ${fmtMB(m.memtotal || 0)} · ${ramPct} %` + (m.swaptotal ? ` · Swap ${fmtMB((m.swaptotal || 0) - (m.swapfree || 0))}` : '');
  historyRAM.push(ramPct);
  if (historyRAM.length > 60) historyRAM.shift();

  if (d.temperature != null) {
    const t = d.temperature / 1000;
    valTemp.textContent = `${t.toFixed(0)} °C`;
    const tp = Math.min(100, Math.round(t / 65 * 100));
    fillTemp.style.width = `${tp}%`;
    fillTemp.className = `meter-fill ${t >= 55 ? 'crit' : t >= 48 ? 'warn' : 'ok'}`;
  } else {
    valTemp.textContent = '–';
  }
  subTemp.textContent = d.fan_pwm == null ? 'kein Lüfterwert' : `Lüfter ${d.fan_pwm === 0 ? 'aus' : d.fan_pwm < 200 ? 'halb' : 'voll'} (${Math.round(d.fan_pwm / 255 * 100)} %)`;

  valUptime.textContent = fmtUptime(d.uptime);
  const lp = Math.min(100, Math.round((d.load[0] / (d.cores || 1)) * 50));
  fillLoad.style.width = `${lp}%`;
  fillLoad.className = `meter-fill ${level(lp)}`;
  subClient.textContent = `Last ${d.load.map(x => x.toFixed(2)).join(' ')} · ${d.board || d.model || ''} · ShareOS ${d.version || ''}`;

  // network rate from two samples
  const now = Date.now(), n = d.network || {};
  if (lastNet && n.rx_bytes != null) {
    const s = (now - lastNet.t) / 1000;
    $('net-indicator').textContent = `eth0 ${n.speed ? n.speed + ' Mbit/s' : ''} · ↓ ${fmtRate(Math.max(0, n.rx_bytes - lastNet.rx) / s)} · ↑ ${fmtRate(Math.max(0, n.tx_bytes - lastNet.tx) / s)}`;
  }
  if (n.rx_bytes != null) lastNet = { rx: n.rx_bytes, tx: n.tx_bytes, t: now };

  renderVolumes(d.volumes || [], d.disks || []);
  drawSystemGraph();
}

function renderVolumes(vols, disks) {
  const box = $('volume-list');
  if (!vols.length) { box.innerHTML = '<span class="vital-sub">Keine Laufwerke eingehängt.</span>'; return; }
  const asleep = disks.filter(x => x.standby).map(x => x.name);
  box.innerHTML = vols.map(v => {
    const pct = v.size ? Math.round(v.used / v.size * 100) : 0;
    const label = v.name === 'flash' ? 'Flash (Einstellungen & Pakete)' : v.name;
    return `<div class="volume-row">
      <span class="volume-name">${v.usb ? '🔌' : v.name === 'flash' ? '💾' : '🗄️'} ${escapeHTML(label)}<small>${escapeHTML(v.mount)} · ${escapeHTML(v.fs || '')}</small></span>
      <div class="meter-bar"><div class="meter-fill ${level(pct)}" style="width:${pct}%"></div></div>
      <span class="volume-val">${fmtBytes(v.used)} / ${fmtBytes(v.size)} · ${pct} %</span>
    </div>`;
  }).join('') + (asleep.length ? `<span class="vital-sub">Im Standby: ${asleep.map(escapeHTML).join(', ')}</span>` : '');
}

// 3. graph: CPU and RAM in percent
function drawSystemGraph() {
  const w = sysCanvas.width, h = sysCanvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#1e293f';
  ctx.lineWidth = 1;
  for (let y = 25; y < h; y += 35) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  const line = (hist, color, fill) => {
    if (hist.length < 2) return;
    const step = w / 59, x0 = w - (hist.length - 1) * step;
    const y = (v) => h - ((v / 100) * (h - 20)) - 10;
    if (fill) {
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, fill); grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      hist.forEach((v, i) => i ? ctx.lineTo(x0 + i * step, y(v)) : ctx.moveTo(x0, y(v)));
      ctx.lineTo(w, h); ctx.lineTo(x0, h); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
    }
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2.2;
    hist.forEach((v, i) => i ? ctx.lineTo(x0 + i * step, y(v)) : ctx.moveTo(x0, y(v)));
    ctx.stroke();
  };
  line(historyRAM, '#a78bfa', null);
  line(historyCPU, '#0ea5e9', 'rgba(14, 165, 233, 0.35)');
}

// 4. processes
function kindOf(p) {
  if (p.kernel) return 'workers';
  return p.user === 'root' || p.user === 'nobody' || p.user === 'daemon' ? 'system' : 'apps';
}

function takeProcesses(d) {
  const dt = lastProcCpu != null ? d.cpu.total - lastProcCpu : 0;
  const ticks = {};
  processes = d.processes.map(p => {
    ticks[p.pid] = p.ticks;
    const prev = lastTicks[p.pid];
    return { ...p, kind: kindOf(p), cpu: dt > 0 && prev != null ? Math.max(0, (p.ticks - prev) / dt * 100) : 0 };
  });
  lastTicks = ticks;
  lastProcCpu = d.cpu.total;
  processes.sort((a, b) => b.cpu - a.cpu || b.rss - a.rss || a.pid - b.pid);
}

function renderProcesses() {
  const query = procSearch.value.trim().toLowerCase();
  const counts = { all: processes.length, apps: 0, system: 0, workers: 0 };
  processes.forEach(p => counts[p.kind]++);
  $('count-all').textContent = counts.all;
  $('count-apps').textContent = counts.apps;
  $('count-sys').textContent = counts.system;
  $('count-workers').textContent = counts.workers;

  const filtered = processes.filter(p => {
    if (activeTab !== 'all' && p.kind !== activeTab) return false;
    if (!query) return true;
    return p.name.toLowerCase().includes(query) || p.cmd.toLowerCase().includes(query) ||
      String(p.pid) === query || p.user.toLowerCase().includes(query);
  });
  sysStats.textContent = `${filtered.length} von ${processes.length} Prozessen`;

  if (!filtered.length) {
    procTbody.innerHTML = `<tr class="empty-row"><td colspan="6">${processes.length ? 'Kein Prozess passt zum Filter.' : 'Lade …'}</td></tr>`;
    return;
  }
  procTbody.innerHTML = filtered.map(p => {
    const st = STATE[p.state] || ['idle', p.state];
    const action = p.kernel ? '<span class="proc-muted">Kernel</span>'
      : PROTECTED.has(p.name) || p.pid === 1 ? '<span class="proc-muted">Geschützt</span>'
      : `<button class="proc-action-btn" data-pid="${p.pid}" data-name="${escapeHTML(p.name)}">Beenden</button>`;
    return `<tr class="proc-row">
      <td><div class="proc-name-cell"><span>${escapeHTML(p.name)}</span><span class="proc-badge">PID ${p.pid}</span>
        ${p.cmd && p.cmd !== p.name ? `<span class="proc-cmd" title="${escapeHTML(p.cmd)}">${escapeHTML(p.cmd)}</span>` : ''}</div></td>
      <td><span class="proc-badge">${escapeHTML(p.user || '–')}</span></td>
      <td><span class="status-pill status-${st[0]}">${st[1]}</span></td>
      <td style="font-family:monospace;">${p.cpu.toFixed(1)}%</td>
      <td style="font-family:monospace;">${p.kernel ? '–' : fmtMB(p.rss)}</td>
      <td style="text-align:right;">${action}</td>
    </tr>`;
  }).join('');
}

procTbody.addEventListener('click', async (e) => {
  const btn = e.target.closest('.proc-action-btn');
  if (!btn) return;
  const pid = +btn.dataset.pid, name = btn.dataset.name;
  if (!confirm(`Prozess „${name}“ (PID ${pid}) beenden?`)) return;
  try {
    await SYS.kill(pid, 'TERM');
    showToast(`„${name}“ beendet.`);
    setTimeout(tick, 600);
  } catch (err) {
    showToast('Beenden fehlgeschlagen: ' + err.message);
  }
});

// 5. loop
async function tick() {
  if (!SYS || busy || paused || document.hidden) return;
  busy = true;
  try {
    const [d, p] = await Promise.all([SYS.info(), SYS.processes()]);
    renderInfo(d);
    takeProcesses(p);
    renderProcesses();
    $('live-indicator').textContent = `● LIVE (alle ${INTERVAL / 1000} s)`;
  } catch (err) {
    $('live-indicator').textContent = '● Fehler';
    if (/no access/.test(err.message)) {
      showBanner('Kein Zugriff: SysMon zeigt die Werte der Box nur Administratoren.');
      paused = true;
    } else {
      showToast('Werte der Box: ' + err.message);
    }
  } finally {
    busy = false;
  }
}

document.querySelectorAll('#view-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#view-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    renderProcesses();
  });
});
procSearch.addEventListener('input', renderProcesses);
$('refresh-now-btn').addEventListener('click', () => { tick(); });
$('pause-btn').addEventListener('click', (e) => {
  paused = !paused;
  e.currentTarget.textContent = paused ? '▶ Weiter' : '⏸ Anhalten';
  $('live-indicator').textContent = paused ? '⏸ angehalten' : `● LIVE (alle ${INTERVAL / 1000} s)`;
  if (!paused) tick();
});
$('save-snapshot-btn').addEventListener('click', saveSnapshot);
document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
if (!SYS) {
  showBanner('SysMon braucht ShareOS 0.2.0-beta.11 oder neuer und ein Administratorkonto (Berechtigung „sysinfo“). Ohne sie zeigt die App keine Werte.');
  $('live-indicator').textContent = '● keine Verbindung';
  procTbody.innerHTML = '<tr class="empty-row"><td colspan="6">Keine Werte der Box verfügbar.</td></tr>';
} else {
  tick();
  setInterval(tick, INTERVAL);
}
