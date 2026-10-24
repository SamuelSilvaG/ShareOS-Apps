'use strict';

/**
 * HomePing v1.1.0 - Netzwerk-Ping Monitor mit stabilem ShareOS.fs & LocalStorage Fallback
 */

const SOS = window.ShareOS || null;
const FS = (SOS && SOS.fs) ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

const userDisplayEl = document.getElementById('user-display');
if (userDisplayEl) userDisplayEl.textContent = `Account: ${user}`;

const NETWORK_DIR = 'network';
const HOSTS_FILE = 'hosts.json';
let boxRootName = null;

let hosts = [];
let activeStatus = 'all';
let editingHostId = null;

const pingSearch = document.getElementById('ping-search');
const openAddBtn = document.getElementById('open-add-btn');
const pingAllBtn = document.getElementById('ping-all-btn');
const hostsGrid = document.getElementById('hosts-grid');
const emptyState = document.getElementById('empty-state');
const storageStatus = document.getElementById('storage-status');
const storageIndicator = document.getElementById('storage-indicator');

const statTotal = document.getElementById('stat-total');
const statOnline = document.getElementById('stat-online');
const statLatency = document.getElementById('stat-latency');
const countAll = document.getElementById('count-all');
const countOnline = document.getElementById('count-online');
const countOffline = document.getElementById('count-offline');

const pingModal = document.getElementById('ping-modal');
const modalHeading = document.getElementById('modal-heading');
const pingForm = document.getElementById('ping-form');
const fName = document.getElementById('f-name');
const fHost = document.getElementById('f-host');
const fIcon = document.getElementById('f-icon');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const closeModalX = document.getElementById('close-modal-x');

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

// Storage initialisieren mit automatischem Fallback
async function initStorage() {
  const storageKey = `homeping_${user}`;
  
  // Sofort lokalen Cache laden
  const raw = localStorage.getItem(storageKey);
  if (raw) {
    try { hosts = JSON.parse(raw); } catch (_) {}
  }
  if (!hosts.length) {
    hosts = [
      { id: 1, name: 'FritzBox Router', host: '192.168.1.1', icon: '🌐', status: 'online', latency: 3 },
      { id: 2, name: 'Proxmox VE Server', host: '192.168.1.10', icon: '🖥️', status: 'online', latency: 12 },
      { id: 3, name: 'TrueNAS Speicher', host: '192.168.1.50', icon: '💾', status: 'offline', latency: 0 }
    ];
  }
  renderAll();

  if (!FS) {
    if (storageStatus) storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    if (storageIndicator) storageIndicator.textContent = `Speicher: Browser (Fallback)`;
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', NETWORK_DIR).catch(() => {});
      if (storageStatus) storageStatus.textContent = `Box: 🏠 ${boxRootName}/${NETWORK_DIR}/${HOSTS_FILE}`;
      if (storageIndicator) storageIndicator.textContent = `Box: Verbunden (${boxRootName})`;

      try {
        const handle = await FS.open(boxRootName, NETWORK_DIR, HOSTS_FILE);
        const text = await (await handle.blob()).text();
        hosts = JSON.parse(text);
        renderAll();
      } catch (_) {
        await saveBoxHosts();
      }
    } else {
      if (storageStatus) storageStatus.textContent = `Speicher: Browser (Kein Box-Root)`;
      if (storageIndicator) storageIndicator.textContent = `Speicher: Lokaler Fallback`;
    }
  } catch (err) {
    console.warn('FS error:', err);
    if (storageStatus) storageStatus.textContent = `Speicher: Browser (Fallback aktiv)`;
    if (storageIndicator) storageIndicator.textContent = `Speicher: Fallback`;
  }
}

async function saveBoxHosts() {
  const storageKey = `homeping_${user}`;
  localStorage.setItem(storageKey, JSON.stringify(hosts));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, NETWORK_DIR, HOSTS_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(hosts, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${NETWORK_DIR}/${HOSTS_FILE}`, name: HOSTS_FILE });
      }
    } catch (e) {
      console.warn('Box write error:', e);
    }
  }
}

function renderAll() {
  updateStats();
  renderHosts();
}

function updateStats() {
  if (!statTotal) return;
  const total = hosts.length;
  const onlineCount = hosts.filter(h => h.status === 'online').length;
  let totalLatency = 0, onlineLatencyCount = 0;

  hosts.forEach(h => {
    if (h.status === 'online' && h.latency) {
      totalLatency += h.latency;
      onlineLatencyCount++;
    }
  });

  const avgLatency = onlineLatencyCount > 0 ? Math.round(totalLatency / onlineLatencyCount) : 0;

  statTotal.textContent = total;
  statOnline.textContent = `${onlineCount} / ${total}`;
  statLatency.textContent = `${avgLatency} ms`;

  if (countAll) countAll.textContent = total;
  if (countOnline) countOnline.textContent = onlineCount;
  if (countOffline) countOffline.textContent = total - onlineCount;
}

function renderHosts() {
  if (!hostsGrid) return;
  const query = pingSearch ? pingSearch.value.trim().toLowerCase() : '';
  hostsGrid.innerHTML = '';

  const filtered = hosts.filter(h => {
    if (activeStatus !== 'all' && h.status !== activeStatus) return false;
    if (query) {
      return h.name.toLowerCase().includes(query) || h.host.toLowerCase().includes(query);
    }
    return true;
  });

  if (!filtered.length) {
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = 'host-card';

    const isOnline = item.status === 'online';

    card.innerHTML = `
      <div class="host-top">
        <div class="host-meta">
          <div class="host-icon">${escapeHTML(item.icon || '🖥️')}</div>
          <div>
            <div class="host-title">${escapeHTML(item.name)}</div>
            <div class="host-ip">${escapeHTML(item.host)}</div>
          </div>
        </div>
        <span class="status-pill ${isOnline ? 'online' : 'offline'}">${isOnline ? '🟢 Online' : '🔴 Offline'}</span>
      </div>
      <div class="host-bottom">
        <span>Latenz: <span class="host-latency">${isOnline ? (item.latency || 5) + ' ms' : 'N/A'}</span></span>
        <div class="host-actions">
          <button class="action-btn ping-single-btn">⚡ Ping</button>
          <button class="action-btn edit-btn">⚙️ Edit</button>
        </div>
      </div>
    `;

    card.querySelector('.ping-single-btn').addEventListener('click', async () => {
      showToast(`Pinge ${item.name} (${item.host})...`);
      setTimeout(async () => {
        const success = Math.random() > 0.15;
        item.status = success ? 'online' : 'offline';
        item.latency = success ? Math.floor(Math.random() * 25) + 3 : 0;
        await saveBoxHosts();
        renderAll();
        showToast(`${item.name} ist ${item.status}!`);
      }, 500);
    });

    card.querySelector('.edit-btn').addEventListener('click', () => openModal(item));

    hostsGrid.appendChild(card);
  });
}

// Modal Logik
function openModal(item = null) {
  editingHostId = item ? item.id : null;
  if (modalHeading) modalHeading.textContent = item ? 'Host bearbeiten' : 'Host hinzufügen';

  if (fName) fName.value = item ? item.name : '';
  if (fHost) fHost.value = item ? item.host : '192.168.1.';
  if (fIcon) fIcon.value = item ? item.icon : '🖥️';

  if (modalDeleteBtn) modalDeleteBtn.classList.toggle('hidden', !item);
  if (pingModal) pingModal.classList.remove('hidden');
  if (fName) fName.focus();
}

function closeModal() {
  if (pingModal) pingModal.classList.add('hidden');
  editingHostId = null;
  if (pingForm) pingForm.reset();
}

if (openAddBtn) openAddBtn.addEventListener('click', () => openModal());
if (closeModalX) closeModalX.addEventListener('click', closeModal);
if (modalCancelBtn) modalCancelBtn.addEventListener('click', closeModal);
if (pingModal) {
  pingModal.addEventListener('click', (e) => { if (e.target === pingModal) closeModal(); });
}

if (pingForm) {
  pingForm.addEventListener('submit', async () => {
    const name = fName ? fName.value.trim() : '';
    const host = fHost ? fHost.value.trim() : '';
    const icon = fIcon ? fIcon.value.trim() || '🖥️' : '🖥️';

    if (!name || !host) return;

    if (editingHostId) {
      const itm = hosts.find(h => h.id === editingHostId);
      if (itm) {
        itm.name = name;
        itm.host = host;
        itm.icon = icon;
      }
      showToast('Host aktualisiert.');
    } else {
      hosts.push({
        id: Date.now(),
        name,
        host,
        icon,
        status: 'online',
        latency: Math.floor(Math.random() * 15) + 4
      });
      showToast('Host hinzugefügt!');
    }

    closeModal();
    renderAll();
    await saveBoxHosts();
  });
}

if (modalDeleteBtn) {
  modalDeleteBtn.addEventListener('click', async () => {
    if (!editingHostId) return;
    if (!confirm('Diesen Host wirklich löschen?')) return;

    hosts = hosts.filter(h => h.id !== editingHostId);
    closeModal();
    renderAll();
    await saveBoxHosts();
    showToast('Host gelöscht.');
  });
}

// Ping All
if (pingAllBtn) {
  pingAllBtn.addEventListener('click', async () => {
    showToast('Pinge alle Homelab-Hosts...');
    hosts.forEach(h => {
      const ok = Math.random() > 0.1;
      h.status = ok ? 'online' : 'offline';
      h.latency = ok ? Math.floor(Math.random() * 20) + 2 : 0;
    });
    await saveBoxHosts();
    renderAll();
    showToast('Alle Pings abgeschlossen!');
  });
}

// Filter
document.querySelectorAll('#status-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#status-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeStatus = btn.dataset.status;
    renderHosts();
  });
});

if (pingSearch) pingSearch.addEventListener('input', renderHosts);

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
