'use strict';

/**
 * SysMon (WebTask / System Monitor)
 * CPU-, RAM- & Task-Manager mit ShareOS.fs Anbindung (system/sysmon_snapshots.json)
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const SYSTEM_DIR = 'system';
const SNAPSHOT_FILE = 'sysmon_snapshots.json';
let boxRootName = null;

let activeTab = 'all';
let startTime = Date.now();
let historyCPU = [];
let historyRAM = [];

// UI Elements
const procSearch = document.getElementById('proc-search');
const refreshNowBtn = document.getElementById('refresh-now-btn');
const killStaleBtn = document.getElementById('kill-stale-btn');
const saveSnapshotBtn = document.getElementById('save-snapshot-btn');

const valCpu = document.getElementById('val-cpu');
const fillCpu = document.getElementById('fill-cpu');
const subCpu = document.getElementById('sub-cpu');

const valRam = document.getElementById('val-ram');
const fillRam = document.getElementById('fill-ram');
const subRam = document.getElementById('sub-ram');

const valIo = document.getElementById('val-io');
const valUptime = document.getElementById('val-uptime');

const sysCanvas = document.getElementById('sys-canvas');
const ctx = sysCanvas.getContext('2d');
const procTbody = document.getElementById('proc-tbody');
const storageStatus = document.getElementById('storage-status');
const sysStats = document.getElementById('sys-stats');

const countAll = document.getElementById('count-all');
const countApps = document.getElementById('count-apps');
const countSys = document.getElementById('count-sys');
const countWorkers = document.getElementById('count-workers');

// Simulierte/Aktive Tasks aus dem ShareOS-Ökosystem
let processes = [
  { pid: 101, name: 'ShareOS Kernel / Core', type: 'system', status: 'running', cpu: 1.2, mem: 38.4, icon: '⚙️' },
  { pid: 102, name: 'ShareOS.fs VFS Daemon', type: 'system', status: 'running', cpu: 0.8, mem: 24.1, icon: '💾' },
  { pid: 103, name: 'WebTask Event Listener', type: 'system', status: 'running', cpu: 0.3, mem: 14.5, icon: '📡' },
  { pid: 201, name: 'ShareVault (AES-GCM)', type: 'apps', status: 'idle', cpu: 0.1, mem: 19.8, icon: '🛡️' },
  { pid: 202, name: 'PhotoDrop Gallery Sync', type: 'apps', status: 'idle', cpu: 0.4, mem: 42.6, icon: '📸' },
  { pid: 203, name: 'ExpenseTracker Ledger', type: 'apps', status: 'idle', cpu: 0.2, mem: 16.3, icon: '💳' },
  { pid: 204, name: 'TaskBoard Kanban Sync', type: 'apps', status: 'running', cpu: 0.9, mem: 22.0, icon: '📋' },
  { pid: 301, name: 'AudioContext Visualizer Worker', type: 'workers', status: 'idle', cpu: 0.0, mem: 8.5, icon: '⚡' },
  { pid: 302, name: 'ShareFeed Feed-Polling Job', type: 'workers', status: 'idle', cpu: 0.1, mem: 12.0, icon: '⚡' }
];

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function showBanner(text) {
  const b = document.getElementById('banner');
  b.textContent = text;
  b.classList.remove('hidden');
}

// 1. Storage & ShareOS.fs Initialisierung
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box. Administrator kann „Dateien“ unter Benutzer aktivieren.');
    }
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', SYSTEM_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${SYSTEM_DIR}/${SNAPSHOT_FILE}`;
      valIo.textContent = 'Verbunden';
      valIo.style.color = '#10b981';
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
    }
  } catch (err) {
    console.warn('FS error:', err);
  }
}

async function saveSnapshot() {
  const snapshot = {
    timestamp: new Date().toISOString(),
    user,
    cpu: valCpu.textContent,
    ram: valRam.textContent,
    uptime: valUptime.textContent,
    processCount: processes.length,
    processes: processes.map(p => ({ pid: p.pid, name: p.name, cpu: p.cpu, mem: p.mem }))
  };

  localStorage.setItem(`sysmon_snap_${user}`, JSON.stringify(snapshot));

  if (FS && boxRootName) {
    try {
      let snaps = [];
      try {
        const handle = await FS.open(boxRootName, SYSTEM_DIR, SNAPSHOT_FILE);
        snaps = JSON.parse(await (await handle.blob()).text());
      } catch (_) { snaps = []; }

      snaps.unshift(snapshot);
      if (snaps.length > 30) snaps.pop();

      const writeHandle = await FS.open(boxRootName, SYSTEM_DIR, SNAPSHOT_FILE, { write: true, create: true });
      await writeHandle.save(new Blob([JSON.stringify(snaps, null, 2)], { type: 'application/json' }));
      showToast('System-Snapshot auf Box gesichert!');
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  } else {
    showToast('Snapshot lokal gesichert.');
  }
}

// 2. Metriken-Simulation & Messung
function updateMetrics() {
  // Uptime
  const diffSec = Math.floor((Date.now() - startTime) / 1000);
  const hrs = String(Math.floor(diffSec / 3600)).padStart(2, '0');
  const mins = String(Math.floor((diffSec % 3600) / 60)).padStart(2, '0');
  const secs = String(diffSec % 60).padStart(2, '0');
  valUptime.textContent = `${hrs}:${mins}:${secs}`;

  // CPU
  let totalCpu = 0;
  processes.forEach(p => {
    // Leichte Fluktuation simulieren
    if (p.status === 'running') {
      p.cpu = +(Math.random() * 2.8 + 0.4).toFixed(1);
    } else {
      p.cpu = +(Math.random() * 0.3).toFixed(1);
    }
    totalCpu += p.cpu;
  });

  const cpuPct = Math.min(100, Math.round(totalCpu + 2));
  valCpu.textContent = `${cpuPct} %`;
  fillCpu.style.width = `${cpuPct}%`;
  fillCpu.className = `meter-fill ${cpuPct > 80 ? 'crit' : (cpuPct > 50 ? 'warn' : 'ok')}`;
  subCpu.textContent = `4 Cores aktiv • ~${(cpuPct * 0.024).toFixed(2)} GHz Last`;

  // RAM
  let totalMem = 0;
  processes.forEach(p => totalMem += p.mem);
  if (performance && performance.memory) {
    totalMem = +(performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
  }
  const ramVal = +(totalMem + 45).toFixed(1);
  valRam.textContent = `${ramVal} MB`;
  const ramPct = Math.min(100, Math.round((ramVal / 512) * 100));
  fillRam.style.width = `${ramPct}%`;
  subRam.textContent = `JS Heap: ${totalMem} MB (Limit: 512 MB)`;

  // History für Graph
  historyCPU.push(cpuPct);
  if (historyCPU.length > 40) historyCPU.shift();
  drawSystemGraph();

  renderProcesses();
}

// 3. Render Canvas Graph
function drawSystemGraph() {
  const w = sysCanvas.width;
  const h = sysCanvas.height;
  ctx.clearRect(0, 0, w, h);

  // Raster
  ctx.strokeStyle = '#1e293f';
  ctx.lineWidth = 1;
  for (let y = 25; y < h; y += 35) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (historyCPU.length < 2) return;

  const step = w / Math.max(historyCPU.length - 1, 1);

  // Gradient Fläche
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, 'rgba(14, 165, 233, 0.4)');
  grad.addColorStop(1, 'rgba(14, 165, 233, 0.0)');

  ctx.beginPath();
  historyCPU.forEach((val, i) => {
    const x = i * step;
    const y = h - ((val / 100) * (h - 20)) - 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo((historyCPU.length - 1) * step, h);
  ctx.lineTo(0, h);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Linie
  ctx.beginPath();
  ctx.strokeStyle = '#0ea5e9';
  ctx.lineWidth = 2.5;
  historyCPU.forEach((val, i) => {
    const x = i * step;
    const y = h - ((val / 100) * (h - 20)) - 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();
}

// 4. Tasks & Prozessliste rendern
function renderProcesses() {
  const query = procSearch.value.trim().toLowerCase();
  procTbody.innerHTML = '';

  const counts = { all: processes.length, apps: 0, system: 0, workers: 0 };
  processes.forEach(p => counts[p.type] = (counts[p.type] || 0) + 1);

  countAll.textContent = counts.all;
  countApps.textContent = counts.apps;
  countSys.textContent = counts.system;
  countWorkers.textContent = counts.workers;

  const filtered = processes.filter(p => {
    if (activeTab !== 'all' && p.type !== activeTab) return false;
    if (query) {
      return p.name.toLowerCase().includes(query) ||
             String(p.pid).includes(query) ||
             p.type.toLowerCase().includes(query);
    }
    return true;
  });

  sysStats.textContent = `${filtered.length} von ${processes.length} Tasks aktiv`;

  filtered.forEach(p => {
    const tr = document.createElement('tr');
    tr.className = 'proc-row';

    const statusBadge = p.status === 'running'
      ? '<span class="status-pill status-running">● Läuft</span>'
      : '<span class="status-pill status-idle">⏸ Standby</span>';

    tr.innerHTML = `
      <td>
        <div class="proc-name-cell">
          <span>${p.icon}</span>
          <span>${escapeHTML(p.name)}</span>
          <span class="proc-badge">PID ${p.pid}</span>
        </div>
      </td>
      <td><span class="proc-badge">${p.type}</span></td>
      <td>${statusBadge}</td>
      <td style="font-family:monospace;">${p.cpu.toFixed(1)}%</td>
      <td style="font-family:monospace;">${p.mem.toFixed(1)} MB</td>
      <td>
        ${p.type !== 'system' ? `<button class="proc-action-btn" data-pid="${p.pid}">Beenden</button>` : '<span style="color:var(--sos-muted); font-size:11px; float:right;">Geschützt</span>'}
      </td>
    `;

    const btn = tr.querySelector('.proc-action-btn');
    if (btn) {
      btn.addEventListener('click', () => {
        processes = processes.filter(x => x.pid !== p.pid);
        showToast(`Task '${p.name}' beendet.`);
        updateMetrics();
      });
    }

    procTbody.appendChild(tr);
  });
}

// 5. Events
document.querySelectorAll('#view-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#view-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    renderProcesses();
  });
});

procSearch.addEventListener('input', renderProcesses);
refreshNowBtn.addEventListener('click', () => {
  updateMetrics();
  showToast('Aktualisiert.');
});

killStaleBtn.addEventListener('click', () => {
  const before = processes.length;
  processes = processes.filter(p => p.type === 'system' || p.status === 'running');
  const killed = before - processes.length;
  updateMetrics();
  showToast(killed > 0 ? `${killed} inaktive Tasks bereinigt.` : 'Keine inaktiven Tasks vorhanden.');
});

saveSnapshotBtn.addEventListener('click', saveSnapshot);

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
updateMetrics();
setInterval(updateMetrics, 2000);
