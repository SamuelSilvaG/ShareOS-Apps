'use strict';

/**
 * DockerDeck - Leichtgewichtiger Docker Container & Stack Manager
 * Speichert Daten unter system/dockerdeck_containers.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const SYSTEM_DIR = 'system';
const CONTAINERS_FILE = 'dockerdeck_containers.json';
let boxRootName = null;

let containers = [];
let activeFilter = 'all';
let activeCategory = 'all';
let editingContainerId = null;

// UI Elements
const containerSearch = document.getElementById('container-search');
const openAddBtn = document.getElementById('open-add-btn');
const pruneBtn = document.getElementById('prune-btn');
const refreshContainersBtn = document.getElementById('refresh-containers-btn');
const refreshBtn = document.getElementById('refresh-btn');
const containersGrid = document.getElementById('containers-grid');
const emptyState = document.getElementById('empty-state');
const storageStatus = document.getElementById('storage-status');

const statTotal = document.getElementById('stat-total');
const statRunning = document.getElementById('stat-running');
const statRam = document.getElementById('stat-ram');
const countAll = document.getElementById('count-all');
const countRunning = document.getElementById('count-running');
const countStopped = document.getElementById('count-stopped');

// Modal Elements
const containerModal = document.getElementById('container-modal');
const modalHeading = document.getElementById('modal-heading');
const containerForm = document.getElementById('container-form');
const fName = document.getElementById('f-name');
const fCat = document.getElementById('f-cat');
const fImage = document.getElementById('f-image');
const fPorts = document.getElementById('f-ports');
const fEnv = document.getElementById('f-env');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const closeModalX = document.getElementById('close-modal-x');

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

// 1. Storage & ShareOS.fs Setup
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadFallbackContainers();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', SYSTEM_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${SYSTEM_DIR}/${CONTAINERS_FILE}`;
      await loadBoxContainers();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackContainers();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackContainers();
  }
}

async function loadBoxContainers() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, SYSTEM_DIR, CONTAINERS_FILE);
    const text = await (await handle.blob()).text();
    containers = JSON.parse(text);
  } catch (_) {
    createDefaultContainers();
    await saveBoxContainers();
  }
  renderAll();
}

async function saveBoxContainers() {
  localStorage.setItem(`dockerdeck_${user}`, JSON.stringify(containers));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, SYSTEM_DIR, CONTAINERS_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(containers, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${SYSTEM_DIR}/${CONTAINERS_FILE}`, name: CONTAINERS_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackContainers() {
  const raw = localStorage.getItem(`dockerdeck_${user}`);
  if (raw) {
    try { containers = JSON.parse(raw); } catch (_) {}
  }
  if (!containers || !containers.length) {
    createDefaultContainers();
  }
  renderAll();
}

function createDefaultContainers() {
  containers = [
    { id: 1, name: 'nginx-proxy-manager', category: 'proxy', image: 'jc21/nginx-proxy-manager:latest', ports: '80:80, 443:443, 81:81', status: 'running', ram: 84, uptime: '3 Tage' },
    { id: 2, name: 'postgres-db', category: 'database', image: 'postgres:16-alpine', ports: '5432:5432', status: 'running', ram: 142, uptime: '3 Tage' },
    { id: 3, name: 'home-assistant', category: 'tools', image: 'ghcr.io/home-assistant/home-assistant:stable', ports: '8123:8123', status: 'running', ram: 310, uptime: '12 Tage' },
    { id: 4, name: 'jellyfin-media', category: 'media', image: 'jellyfin/jellyfin:latest', ports: '8096:8096', status: 'stopped', ram: 0, uptime: 'Gestoppt' }
  ];
}

// 2. Rendering
function renderAll() {
  updateStats();
  renderContainers();
}

function updateStats() {
  const total = containers.length;
  const running = containers.filter(c => c.status === 'running').length;

  let totalRam = 0;
  containers.forEach(c => {
    if (c.status === 'running') totalRam += (c.ram || 45);
  });

  statTotal.textContent = total;
  statRunning.textContent = running;
  statRam.textContent = `${totalRam} MB`;

  countAll.textContent = total;
  countRunning.textContent = running;
  countStopped.textContent = total - running;
}

function renderContainers() {
  const query = containerSearch.value.trim().toLowerCase();
  containersGrid.innerHTML = '';

  const filtered = containers.filter(c => {
    if (activeFilter === 'running' && c.status !== 'running') return false;
    if (activeFilter === 'stopped' && c.status !== 'stopped') return false;
    if (activeCategory !== 'all' && c.category !== activeCategory) return false;
    if (query) {
      return c.name.toLowerCase().includes(query) ||
             c.image.toLowerCase().includes(query) ||
             (c.ports || '').toLowerCase().includes(query);
    }
    return true;
  });

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(container => {
    const card = document.createElement('div');
    card.className = 'container-card';

    let statusHtml = '<span class="status-pill status-stopped">⚪ Stopped</span>';
    if (container.status === 'running') {
      statusHtml = '<span class="status-pill status-running">● Running</span>';
    }

    let icon = '🐳';
    if (container.category === 'database') icon = '🗄️';
    else if (container.category === 'proxy') icon = '🌐';
    else if (container.category === 'media') icon = '🎬';

    card.innerHTML = `
      <div class="container-top">
        <div class="container-meta">
          <div class="container-icon-badge">${icon}</div>
          <div class="container-title-box">
            <span class="container-name">${escapeHTML(container.name)}</span>
            <span class="container-image">${escapeHTML(container.image)}</span>
          </div>
        </div>
        ${statusHtml}
      </div>

      <div class="container-info-row">
        <span>Ports: ${escapeHTML(container.ports || '-')}</span>
        <span>RAM: ${container.status === 'running' ? (container.ram || 50) + ' MB' : '0 MB'}</span>
      </div>

      <div class="container-bottom">
        <div class="container-actions">
          <button class="action-btn toggle-btn">${container.status === 'running' ? '⏹️ Stoppen' : '▶️ Starten'}</button>
          <button class="action-btn restart-btn">🔄 Neustart</button>
          <button class="action-btn edit-btn">⚙️ Edit</button>
        </div>
      </div>
    `;

    // Start / Stop Toggle
    card.querySelector('.toggle-btn').addEventListener('click', async () => {
      container.status = container.status === 'running' ? 'stopped' : 'running';
      await saveBoxContainers();
      renderAll();
      showToast(`Container '${container.name}' ${container.status === 'running' ? 'gestartet' : 'gestoppt'}.`);
    });

    // Restart
    card.querySelector('.restart-btn').addEventListener('click', async () => {
      container.status = 'running';
      await saveBoxContainers();
      renderAll();
      showToast(`Container '${container.name}' neugestartet.`);
    });

    // Edit
    card.querySelector('.edit-btn').addEventListener('click', () => openModal(container));

    containersGrid.appendChild(card);
  });
}

// 3. Modal Logik
function openModal(container = null) {
  editingContainerId = container ? container.id : null;
  modalHeading.textContent = container ? 'Container bearbeiten' : 'Container hinzufügen';

  fName.value = container ? container.name : '';
  fCat.value = container ? container.category : 'proxy';
  fImage.value = container ? container.image : '';
  fPorts.value = container ? container.ports : '';
  fEnv.value = container ? (container.env || '') : '';

  modalDeleteBtn.classList.toggle('hidden', !container);
  containerModal.classList.remove('hidden');
  fName.focus();
}

function closeModal() {
  containerModal.classList.add('hidden');
  editingContainerId = null;
  containerForm.reset();
}

openAddBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
containerModal.addEventListener('click', (e) => {
  if (e.target === containerModal) closeModal();
});

containerForm.addEventListener('submit', async () => {
  const name = fName.value.trim();
  const category = fCat.value;
  const image = fImage.value.trim();
  const ports = fPorts.value.trim();
  const env = fEnv.value.trim();

  if (!name || !image) return;

  if (editingContainerId) {
    const item = containers.find(c => c.id === editingContainerId);
    if (item) {
      item.name = name;
      item.category = category;
      item.image = image;
      item.ports = ports;
      item.env = env;
    }
    showToast('Container aktualisiert.');
  } else {
    containers.push({
      id: Date.now(),
      name,
      category,
      image,
      ports,
      env,
      status: 'running',
      ram: Math.floor(Math.random() * 80 + 30),
      uptime: 'Gerade gestartet'
    });
    showToast('Container hinzugefügt & gestartet!');
  }

  closeModal();
  renderAll();
  await saveBoxContainers();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingContainerId) return;
  if (!confirm('Diesen Container wirklich löschen?')) return;

  containers = containers.filter(c => c.id !== editingContainerId);
  closeModal();
  renderAll();
  await saveBoxContainers();
  showToast('Container gelöscht.');
});

// 4. Prune & Filter Events
pruneBtn.addEventListener('click', async () => {
  const before = containers.length;
  containers = containers.filter(c => c.status === 'running');
  const removed = before - containers.length;
  await saveBoxContainers();
  renderAll();
  showToast(removed > 0 ? `${removed} gestoppte Container bereinigt (Prune).` : 'Keine gestoppten Container zum Bereinigen.');
});

document.querySelectorAll('#status-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#status-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (btn.dataset.filter) {
      activeFilter = btn.dataset.filter;
      activeCategory = 'all';
    } else if (btn.dataset.cat) {
      activeCategory = btn.dataset.cat;
      activeFilter = 'all';
    }
    renderContainers();
  });
});

containerSearch.addEventListener('input', renderContainers);
refreshContainersBtn.addEventListener('click', () => {
  renderAll();
  showToast('Container-Status aktualisiert.');
});
refreshBtn.addEventListener('click', () => {
  initStorage();
  showToast('Aktualisiert.');
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
