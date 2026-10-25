'use strict';

/**
 * SpeedCheck - latency, jitter and throughput between this device and the box
 * Ermittelt Latenzen zur Box, Jitter, Transferrate & speichert Logs via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const DIAG_DIR = 'diagnostics';
const LOG_FILE = 'network_logs.json';
let boxRootName = null;

let isRunning = false;
let pingHistory = [];
let diagnosticLogs = [];

// Elements
const runCheckBtn = document.getElementById('run-check-btn');
const valPing = document.getElementById('val-ping');
const subPing = document.getElementById('sub-ping');
const valJitter = document.getElementById('val-jitter');
const valSpeed = document.getElementById('val-speed');
const subSpeed = document.getElementById('sub-speed');
const valStatus = document.getElementById('val-status');
const subStatus = document.getElementById('sub-status');
const targetHostEl = document.getElementById('target-host');

const pingCanvas = document.getElementById('ping-canvas');
const ctx = pingCanvas.getContext('2d');
const nodesList = document.getElementById('nodes-list');
const saveLogBtn = document.getElementById('save-log-btn');
const storageStatus = document.getElementById('storage-status');

const DEFAULT_NODES = [
  { id: 'box-core', name: 'ShareOS Box Core', desc: 'Web-Server & Kernel API', type: 'self' },
  { id: 'storage', name: 'NAS / Festplatten-I/O', desc: 'Dateisystem-Durchsatz', type: 'io' }
];

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

// 1. Initialisierung & Host Detection
function initEnvironment() {
  const host = window.location.hostname || 'shareos.local';
  targetHostEl.textContent = `Ziel: ${host}`;
  renderNodes(DEFAULT_NODES);
  initStorage();
  drawPingChart([]);
}

// 2. Storage Setup
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadLocalLogs();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', DIAG_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${DIAG_DIR}/${LOG_FILE}`;
      await loadBoxLogs();
    } else {
      loadLocalLogs();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadLocalLogs();
  }
}

async function loadBoxLogs() {
  if (!FS || !boxRootName) return;
  try {
    const handle = await FS.open(boxRootName, DIAG_DIR, LOG_FILE);
    const text = await (await handle.blob()).text();
    diagnosticLogs = JSON.parse(text);
  } catch (_) {}
}

async function saveBoxLogs() {
  const record = {
    timestamp: new Date().toISOString(),
    ping: valPing.textContent,
    jitter: valJitter.textContent,
    speed: valSpeed.textContent,
    status: valStatus.textContent
  };
  diagnosticLogs.unshift(record);
  if (diagnosticLogs.length > 20) diagnosticLogs.pop();

  localStorage.setItem(`diag_logs_${user}`, JSON.stringify(diagnosticLogs));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, DIAG_DIR, LOG_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(diagnosticLogs, null, 2)], { type: 'application/json' }));
      showToast('Messung auf der Box archiviert.');
    } catch (e) {
      showToast('Log-Speichern fehlgeschlagen: ' + e.message);
    }
  } else {
    showToast('Messung lokal im Browser archiviert.');
  }
}

function loadLocalLogs() {
  const raw = localStorage.getItem(`diag_logs_${user}`);
  if (raw) {
    try { diagnosticLogs = JSON.parse(raw); } catch (_) {}
  }
}

// 3. Diagnose-Routine (Ping, Jitter, Transfer)
async function startDiagnosis() {
  if (isRunning) return;
  isRunning = true;
  runCheckBtn.disabled = true;
  runCheckBtn.textContent = '⏳ Messe...';

  valStatus.textContent = 'Läuft...';
  valStatus.style.color = '#38bdf8';
  subStatus.textContent = 'Messzyklen aktiv';

  pingHistory = [];
  const samples = 10;
  const pings = [];

  // Phase 1: Mehrere Latenz-Pings an die Box
  for (let i = 0; i < samples; i++) {
    const tStart = performance.now();
    try {
      // Cache-Busting Fetch auf statische Core-Ressource
      await fetch(`/_shareos/theme.css?_t=${Date.now()}_${i}`, { method: 'HEAD', cache: 'no-store' });
      const duration = Math.round(performance.now() - tStart);
      pings.push(duration);
      pingHistory.push(duration);
      drawPingChart(pingHistory);
    } catch (_) {
      pings.push(999);
    }
    await new Promise(r => setTimeout(r, 120));
  }

  // Auswertung Ping & Jitter
  const validPings = pings.filter(p => p < 990);
  let avgPing = 0;
  let jitter = 0;

  if (validPings.length > 0) {
    avgPing = Math.round(validPings.reduce((a, b) => a + b, 0) / validPings.length);
    const diffs = [];
    for (let i = 1; i < validPings.length; i++) {
      diffs.push(Math.abs(validPings[i] - validPings[i - 1]));
    }
    jitter = diffs.length ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : 0;
  }

  valPing.textContent = `${avgPing} ms`;
  subPing.textContent = avgPing < 45 ? 'Ausgezeichnet' : (avgPing < 100 ? 'Gut' : 'Erhöhte Latenz');
  valPing.style.color = avgPing < 50 ? '#10b981' : (avgPing < 120 ? '#f59e0b' : '#ef4444');

  valJitter.textContent = `${jitter} ms`;
  valJitter.style.color = jitter < 15 ? '#10b981' : '#f59e0b';

  // Phase 2: Durchsatz-Messung (kleiner Payload von der Box)
  subSpeed.textContent = 'Messe Durchsatz...';
  try {
    const tDownStart = performance.now();
    const res = await fetch(`/_shareos/app.js?_burst=${Date.now()}`, { cache: 'no-store' });
    const blob = await res.blob();
    const tDownEnd = performance.now();
    const sec = (tDownEnd - tDownStart) / 1000;
    const bitsLoaded = blob.size * 8;
    const mbps = ((bitsLoaded / sec) / (1024 * 1024)).toFixed(1);

    valSpeed.textContent = `${mbps} Mbit/s`;
    subSpeed.textContent = `Payload: ${(blob.size / 1024).toFixed(0)} KB in ${(sec * 1000).toFixed(0)} ms`;
  } catch (_) {
    valSpeed.textContent = '—';
    subSpeed.textContent = 'Messung fehlgeschlagen';
  }

  // Phase 3: Gesamtfazit & Nodes
  if (avgPing < 75) {
    valStatus.textContent = 'Exzellent';
    valStatus.style.color = '#10b981';
    subStatus.textContent = 'Verbindung zur Box stabil und schnell';
  } else if (avgPing < 180) {
    valStatus.textContent = 'Akzeptabel';
    valStatus.style.color = '#f59e0b';
    subStatus.textContent = 'Erhöhte Latenz (z. B. Mobilfunk)';
  } else {
    valStatus.textContent = 'Kritisch';
    valStatus.style.color = '#ef4444';
    subStatus.textContent = 'Paketverluste möglich';
  }

  updateNodeStatus(avgPing);
  await saveBoxLogs();

  isRunning = false;
  runCheckBtn.disabled = false;
  runCheckBtn.textContent = '🔄 Neu prüfen';
}

function updateNodeStatus(avgPing) {
  const isOnline = avgPing < 900 && avgPing > 0;
  const nodes = [
    { ...DEFAULT_NODES[0], status: isOnline ? 'Online (Aktiv)' : 'Offline', state: isOnline ? 'online' : 'offline' },
    { ...DEFAULT_NODES[1], status: FS ? 'ShareOS.fs angebunden' : 'Browser-Storage', state: FS ? 'online' : 'warning' }
  ];
  renderNodes(nodes);
}

function renderNodes(nodes) {
  nodesList.innerHTML = '';
  nodes.forEach(n => {
    const row = document.createElement('div');
    row.className = 'node-row';
    row.innerHTML = `
      <div class="node-left">
        <span class="node-indicator ${n.state || ''}"></span>
        <div>
          <div class="node-name">${escapeHTML(n.name)}</div>
          <div class="node-desc">${escapeHTML(n.desc)}</div>
        </div>
      </div>
      <div class="node-status">${escapeHTML(n.status || 'Bereit')}</div>
    `;
    nodesList.appendChild(row);
  });
}

// 4. Latenz-Kurve zeichnen (Canvas)
function drawPingChart(data) {
  const w = pingCanvas.width;
  const h = pingCanvas.height;
  ctx.clearRect(0, 0, w, h);

  // Hintergrund-Grid
  ctx.strokeStyle = '#1e2c42';
  ctx.lineWidth = 1;
  for (let y = 30; y < h; y += 35) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  if (!data || data.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '12px monospace';
    ctx.fillText('Starte die Diagnose, um den Latenzgraphen zu zeichnen...', 20, h / 2);
    return;
  }

  // Linie zeichnen
  const step = w / Math.max(data.length - 1, 1);
  const maxVal = Math.max(...data, 100);

  ctx.beginPath();
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 3;

  data.forEach((val, i) => {
    const x = i * step;
    const y = h - ((val / maxVal) * (h - 30)) - 10;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Punkte
  ctx.fillStyle = '#facc15';
  data.forEach((val, i) => {
    const x = i * step;
    const y = h - ((val / maxVal) * (h - 30)) - 10;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  });
}

runCheckBtn.addEventListener('click', startDiagnosis);
saveLogBtn.addEventListener('click', saveBoxLogs);

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initEnvironment();
