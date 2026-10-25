'use strict';

/**
 * TuyaPulse 2.0 – Tuya devices in the local network through ShareOS.tuya
 * (permission "tuya", admin accounts, ShareOS 0.2.0-beta.11+): find, read
 * and switch them without the cloud (protocol 3.3/3.4). Devices, rooms and
 * scenes live in the personal folder on the box (smarthome/tuya_devices.json).
 */

const SOS = window.ShareOS || null;
const FS = (SOS && SOS.fs) ? SOS.fs : null;
const TUYA = (SOS && SOS.tuya) ? SOS.tuya : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

const userDisplayEl = document.getElementById('user-display');
if (userDisplayEl) userDisplayEl.textContent = `Account: ${user}`;

const SMARTHOME_DIR = 'smarthome';
const DEVICES_FILE = 'tuya_devices.json';
let boxRootName = null;

let appData = {
  rooms: ['Wohnzimmer', 'Küche', 'Schlafzimmer', 'Büro', 'Kinderzimmer'],
  devices: [],
  scenes: [
    { id: 101, title: 'Alle Lichter Aus', action: 'all_off' },
    { id: 102, title: 'Nachtmodus', action: 'night_mode' }
  ]
};

let activeView = 'devices';
let activeRoom = 'all';
let editingDeviceId = null;

// UI Elements
const deviceSearch = document.getElementById('device-search');
const openAddBtn = document.getElementById('open-add-btn');
const openRoomModalBtn = document.getElementById('open-room-modal-btn');
const openScanModalBtn = document.getElementById('open-scan-modal-btn');
const openLogModalBtn = document.getElementById('open-log-modal-btn');
const openAddSceneBtn = document.getElementById('open-add-scene-btn');
const refreshBtn = document.getElementById('refresh-btn');

const sectionDevices = document.getElementById('section-devices');
const sectionScenes = document.getElementById('section-scenes');
const devicesGrid = document.getElementById('devices-grid');
const scenesGrid = document.getElementById('scenes-grid');
const emptyDevices = document.getElementById('empty-devices');
const emptyScenes = document.getElementById('empty-scenes');
const storageStatus = document.getElementById('storage-status');
const roomFilterBar = document.getElementById('room-filter-bar');

const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');
const statPower = document.getElementById('stat-power');
const countDevices = document.getElementById('count-devices');
const countScenes = document.getElementById('count-scenes');

// Modals & Forms
const deviceModal = document.getElementById('device-modal');
const deviceModalHeading = document.getElementById('device-modal-heading');
const deviceForm = document.getElementById('device-form');
const fName = document.getElementById('f-name');
const fRoom = document.getElementById('f-room');
const fType = document.getElementById('f-type');
const fIp = document.getElementById('f-ip');
const fKey = document.getElementById('f-key');
const fDevId = document.getElementById('f-devid');
const fDp = document.getElementById('f-dp');
const fProto = document.getElementById('f-proto');
const fIcon = document.getElementById('f-icon');
const deviceDeleteBtn = document.getElementById('device-delete-btn');
const deviceCancelBtn = document.getElementById('device-cancel-btn');
const closeDeviceX = document.getElementById('close-device-x');

const roomModal = document.getElementById('room-modal');
const closeRoomX = document.getElementById('close-room-x');
const closeRoomModalBtn = document.getElementById('close-room-modal-btn');
const roomForm = document.getElementById('room-form');
const newRoomInput = document.getElementById('new-room-input');
const roomsManageList = document.getElementById('rooms-manage-list');

const scanModal = document.getElementById('scan-modal');
const closeScanX = document.getElementById('close-scan-x');
const closeScanModalBtn = document.getElementById('close-scan-modal-btn');
const startScanBtn = document.getElementById('start-scan-btn');
const scanSubnetInput = document.getElementById('scan-subnet-input');
const scanResultsBox = document.getElementById('scan-results-box');

const logModal = document.getElementById('log-modal');
const closeLogX = document.getElementById('close-log-x');
const closeLogModalBtn = document.getElementById('close-log-modal-btn');
const clearLogBtn = document.getElementById('clear-log-btn');
const testPingBtn = document.getElementById('test-ping-btn');
const logTerminal = document.getElementById('log-terminal');

const sceneModal = document.getElementById('scene-modal');
const closeSceneX = document.getElementById('close-scene-x');
const sceneCancelBtn = document.getElementById('scene-cancel-btn');
const sceneForm = document.getElementById('scene-form');
const sceneTitle = document.getElementById('scene-title');
const sceneActionType = document.getElementById('scene-action-type');

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

function appendLog(text, type = 'info') {
  if (!logTerminal) return;
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  const timestamp = new Date().toTimeString().slice(0, 8);
  line.textContent = `[${timestamp}] ${text}`;
  logTerminal.appendChild(line);
  logTerminal.scrollTop = logTerminal.scrollHeight;
}

// the sample devices of 1.x were never real: drop them
const SAMPLE_KEYS = ['a1b2c3d4e5f6g7h8', 'b2c3d4e5f6g7h8i9', 'z1y2x3w4v5u6t7s8'];
function cleanDevices() {
  appData.devices = (appData.devices || []).filter(d => !SAMPLE_KEYS.includes(d.key));
}

const dpOf = (d) => String(d.dp || 1);
const devOf = (d) => ({ ip: d.ip, id: d.devId, key: d.key, version: d.proto || '3.3' });

// read the state of devices from the box (switch data point, power if reported)
async function pollDevices(list = appData.devices) {
  if (!TUYA) return;
  await Promise.all(list.filter(d => d.devId).map(async (d) => {
    try {
      const dps = await TUYA.status(devOf(d));
      d.online = true; d.error = null;
      if (dps && dps[dpOf(d)] !== undefined) d.isOn = !!dps[dpOf(d)];
      // plugs with metering: 19 = power in 0.1 W (some report on 5 or 104)
      const p = dps && (dps['19'] ?? dps['5'] ?? dps['104']);
      d.power = typeof p === 'number' ? Math.round(p / 10 * 10) / 10 : null;
      appendLog(`[STATUS] ${d.name} (${d.ip}): ${JSON.stringify(dps)}`, 'success');
    } catch (err) {
      d.online = false; d.error = err.message;
      appendLog(`[FEHLER] ${d.name} (${d.ip}): ${err.message}`, 'error');
    }
  }));
  renderAll();
}

async function switchDevice(d, on) {
  appendLog(`[SET] ${d.name} (${d.ip}) DP ${dpOf(d)} → ${on}`, 'cmd');
  const dps = await TUYA.set(devOf(d), { [dpOf(d)]: on });
  d.isOn = on; d.online = true; d.error = null;
  appendLog(`[OK] ${d.name}: ${JSON.stringify(dps)}`, 'success');
}

// 1. Storage & ShareOS.fs Setup mit automatischem Fallback
async function initStorage() {
  const storageKey = `tuyapulse_${user}`;

  const raw = localStorage.getItem(storageKey);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) appData.devices = parsed;
      else appData = parsed;
    } catch (_) {}
  }
  cleanDevices();
  renderAll();

  if (!FS) {
    if (storageStatus) storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', SMARTHOME_DIR).catch(() => {});
      if (storageStatus) storageStatus.textContent = `Box: 🏠 ${boxRootName}/${SMARTHOME_DIR}/${DEVICES_FILE}`;

      try {
        const handle = await FS.open(boxRootName, SMARTHOME_DIR, DEVICES_FILE);
        const text = await (await handle.blob()).text();
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          appData.devices = parsed;
        } else {
          appData.devices = parsed.devices || appData.devices;
          appData.rooms = parsed.rooms || appData.rooms;
          appData.scenes = parsed.scenes || appData.scenes;
        }
        cleanDevices();
        renderAll();
      } catch (_) {
        await saveBoxData();
      }
    } else {
      if (storageStatus) storageStatus.textContent = `Speicher: Browser (Fallback)`;
    }
  } catch (err) {
    console.warn('FS error:', err);
    if (storageStatus) storageStatus.textContent = `Speicher: Browser (FS Fehler)`;
  }
}

async function saveBoxData() {
  const storageKey = `tuyapulse_${user}`;
  localStorage.setItem(storageKey, JSON.stringify(appData));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, SMARTHOME_DIR, DEVICES_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(appData, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${SMARTHOME_DIR}/${DEVICES_FILE}`, name: DEVICES_FILE });
      }
    } catch (e) {
      console.warn('Box write error:', e);
    }
  }
}

// 2. Rendering
function renderAll() {
  updateStats();
  renderRoomFilters();
  renderDevices();
  renderScenes();
}

function updateStats() {
  if (!statTotal) return;
  const total = appData.devices.length;
  const active = appData.devices.filter(d => d.isOn).length;
  let totalPower = 0;
  appData.devices.forEach(d => {
    if (d.isOn && typeof d.power === 'number') totalPower += d.power;
  });

  statTotal.textContent = total;
  statActive.textContent = active;
  statPower.textContent = `${Math.round(totalPower * 10) / 10} W`;
  const gw = document.getElementById('stat-gateway');
  if (gw) {
    const known = appData.devices.filter(d => d.online !== undefined);
    gw.textContent = !TUYA ? 'keine Verbindung' : known.length ? `${known.filter(d => d.online).length} / ${total}` : '–';
    gw.style.color = known.some(d => d.online === false) ? '#fbbf24' : '';
  }
  if (countDevices) countDevices.textContent = total;
  if (countScenes) countScenes.textContent = (appData.scenes || []).length;
}

function renderRoomFilters() {
  if (!roomFilterBar) return;
  roomFilterBar.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = `filter-pill ${activeRoom === 'all' ? 'active' : ''}`;
  allBtn.textContent = `Alle Räume (${appData.devices.length})`;
  allBtn.addEventListener('click', () => {
    activeRoom = 'all';
    renderAll();
  });
  roomFilterBar.appendChild(allBtn);

  (appData.rooms || []).forEach(room => {
    const count = appData.devices.filter(d => d.room === room).length;
    const btn = document.createElement('button');
    btn.className = `filter-pill ${activeRoom === room ? 'active' : ''}`;
    btn.textContent = `${room} (${count})`;
    btn.addEventListener('click', () => {
      activeRoom = room;
      renderAll();
    });
    roomFilterBar.appendChild(btn);
  });
}

function renderDevices() {
  if (!devicesGrid) return;
  const query = deviceSearch ? deviceSearch.value.trim().toLowerCase() : '';
  devicesGrid.innerHTML = '';

  const filtered = appData.devices.filter(d => {
    if (activeRoom !== 'all' && d.room !== activeRoom) return false;
    if (query) {
      return d.name.toLowerCase().includes(query) ||
             d.room.toLowerCase().includes(query) ||
             d.ip.toLowerCase().includes(query);
    }
    return true;
  });

  if (!filtered.length) {
    if (emptyDevices) emptyDevices.classList.remove('hidden');
    return;
  }
  if (emptyDevices) emptyDevices.classList.add('hidden');

  filtered.forEach(device => {
    const card = document.createElement('div');
    card.className = `device-card ${device.isOn ? 'on' : ''}`;

    card.innerHTML = `
      <div class="device-top">
        <div class="device-meta">
          <div class="device-icon-badge">${escapeHTML(device.icon || '🔌')}</div>
          <div class="device-title-box">
            <span class="device-name">${escapeHTML(device.name)}</span>
            <span class="device-sub">${escapeHTML(device.room)} • IP: ${escapeHTML(device.ip)} (v${device.proto || '3.3'})${device.online === false ? ' • <span class="dev-offline">nicht erreichbar</span>' : ''}</span>
          </div>
        </div>
        <label class="switch">
          <input type="checkbox" ${device.isOn ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="device-bottom">
        <span>Status: <span class="device-power-tag" title="${escapeHTML(device.error || '')}">${device.online === false ? 'Fehler – siehe Protokoll' : device.isOn ? (typeof device.power === 'number' ? device.power + ' W' : 'an') : 'aus'}</span></span>
        <div class="device-actions">
          <button class="action-btn edit-btn">⚙️ Edit</button>
        </div>
      </div>
    `;

    // switch the real device through the box
    card.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
      const on = e.target.checked;
      if (!TUYA) { e.target.checked = !on; showToast('Schalten braucht ShareOS 0.2.0-beta.11 und ein Administratorkonto.'); return; }
      if (!device.devId) { e.target.checked = !on; showToast('Bitte zuerst die Geräte-ID eintragen (⚙️ Edit).'); return; }
      e.target.disabled = true;
      try {
        await switchDevice(device, on);
        showToast(`'${device.name}' ${on ? 'eingeschaltet' : 'ausgeschaltet'}.`);
        saveBoxData();
        setTimeout(() => pollDevices([device]), 1500);
      } catch (err) {
        e.target.checked = !on;
        device.online = false; device.error = err.message;
        appendLog(`[FEHLER] ${device.name}: ${err.message}`, 'error');
        showToast(`${device.name}: ${err.message}`);
      }
      e.target.disabled = false;
      renderAll();
    });

    card.querySelector('.edit-btn').addEventListener('click', () => openDeviceModal(device));

    devicesGrid.appendChild(card);
  });
}

function renderScenes() {
  if (!scenesGrid) return;
  scenesGrid.innerHTML = '';
  const scenes = appData.scenes || [];

  if (!scenes.length) {
    if (emptyScenes) emptyScenes.classList.remove('hidden');
    return;
  }
  if (emptyScenes) emptyScenes.classList.add('hidden');

  scenes.forEach(scene => {
    const card = document.createElement('div');
    card.className = 'scene-card';

    let actionLabel = 'Aktion ausführen';
    if (scene.action === 'all_off') actionLabel = 'Alle Geräte ausschalten';
    else if (scene.action === 'all_on') actionLabel = 'Alle Geräte einschalten';
    else if (scene.action === 'night_mode') actionLabel = 'Nachtmodus aktivieren';

    card.innerHTML = `
      <div class="scene-top">
        <div class="device-title-box">
          <span class="scene-title">⚡ ${escapeHTML(scene.title)}</span>
          <span class="device-sub">${actionLabel}</span>
        </div>
        <button class="run-scene-btn">Ausführen</button>
      </div>
    `;

    card.querySelector('.run-scene-btn').addEventListener('click', async () => {
      if (!TUYA) { showToast('Szenen brauchen ShareOS 0.2.0-beta.11 und ein Administratorkonto.'); return; }
      appendLog(`[SZENE] '${scene.title}' (${scene.action}) …`, 'cmd');
      const want = (d) => scene.action === 'all_off' ? false : scene.action === 'all_on' ? true
        : d.type === 'light' ? false : d.type === 'switch' ? true : null;
      let ok = 0, bad = 0;
      for (const d of appData.devices) {
        const on = want(d);
        if (on === null || !d.devId || d.type === 'sensor') continue;
        try { await switchDevice(d, on); ok++; } catch (err) { bad++; d.online = false; d.error = err.message; appendLog(`[FEHLER] ${d.name}: ${err.message}`, 'error'); }
      }
      showToast(`Szene '${scene.title}': ${ok} geschaltet${bad ? `, ${bad} Fehler` : ''}.`);
      await saveBoxData();
      renderAll();
    });

    scenesGrid.appendChild(card);
  });
}

// 3. View Switcher
document.querySelectorAll('#main-view-filter .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#main-view-filter .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeView = btn.dataset.view;

    if (activeView === 'devices') {
      if (sectionDevices) sectionDevices.classList.remove('hidden');
      if (sectionScenes) sectionScenes.classList.add('hidden');
    } else {
      if (sectionDevices) sectionDevices.classList.add('hidden');
      if (sectionScenes) sectionScenes.classList.remove('hidden');
    }
  });
});

// 4. Device Modal
function populateRoomSelect(selectedRoom = '') {
  if (!fRoom) return;
  fRoom.innerHTML = '';
  appData.rooms.forEach(room => {
    const opt = document.createElement('option');
    opt.value = room;
    opt.textContent = room;
    if (room === selectedRoom) opt.selected = true;
    fRoom.appendChild(opt);
  });
}

function openDeviceModal(device = null) {
  editingDeviceId = device ? device.id : null;
  if (deviceModalHeading) deviceModalHeading.textContent = device ? 'Gerät bearbeiten' : 'Smart-Home Gerät hinzufügen';

  if (fName) fName.value = device ? device.name : '';
  populateRoomSelect(device ? device.room : (activeRoom !== 'all' ? activeRoom : appData.rooms[0]));
  if (fType) fType.value = device ? device.type : 'switch';
  if (fIp) fIp.value = device ? device.ip : '';
  if (fKey) fKey.value = device ? (device.key || '') : '';
  if (fDevId) fDevId.value = device ? (device.devId || '') : '';
  if (fDp) fDp.value = device ? (device.dp || 1) : 1;
  if (fProto) fProto.value = device ? (device.proto || '3.3') : '3.3';
  if (fIcon) fIcon.value = device ? device.icon : '🔌';

  if (deviceDeleteBtn) deviceDeleteBtn.classList.toggle('hidden', !device);
  if (deviceModal) deviceModal.classList.remove('hidden');
  if (fName) fName.focus();
}

function closeDeviceModal() {
  if (deviceModal) deviceModal.classList.add('hidden');
  editingDeviceId = null;
  if (deviceForm) deviceForm.reset();
}

if (openAddBtn) openAddBtn.addEventListener('click', () => openDeviceModal());
if (closeDeviceX) closeDeviceX.addEventListener('click', closeDeviceModal);
if (deviceCancelBtn) deviceCancelBtn.addEventListener('click', closeDeviceModal);
if (deviceModal) {
  deviceModal.addEventListener('click', (e) => {
    if (e.target === deviceModal) closeDeviceModal();
  });
}

if (deviceForm) {
  deviceForm.addEventListener('submit', async () => {
    const name = fName ? fName.value.trim() : '';
    const room = fRoom ? fRoom.value : appData.rooms[0];
    const type = fType ? fType.value : 'switch';
    const ip = fIp ? fIp.value.trim() : '';
    const key = fKey ? fKey.value.trim() : '';
    const proto = fProto ? fProto.value : '3.3';
    const icon = fIcon ? fIcon.value.trim() || '🔌' : '🔌';
    const devId = fDevId ? fDevId.value.trim() : '';
    const dp = fDp ? Math.max(1, Math.min(255, +fDp.value || 1)) : 1;

    if (!name || !ip || !key || !devId) {
      showToast('Name, IP, Geräte-ID und Local Key sind erforderlich.');
      return;
    }
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { showToast('Bitte eine IPv4-Adresse eingeben.'); return; }
    if (key.length !== 16) { showToast('Der Local Key hat 16 Zeichen.'); return; }

    if (editingDeviceId) {
      const item = appData.devices.find(d => d.id === editingDeviceId);
      if (item) {
        item.name = name;
        item.room = room;
        item.type = type;
        item.ip = ip;
        item.key = key;
        item.proto = proto;
        item.icon = icon;
        item.devId = devId;
        item.dp = dp;
      }
      showToast('Gerät aktualisiert.');
      appendLog(`[CONFIG] Gerät '${name}' (${ip}) aktualisiert (Proto v${proto}).`, 'info');
    } else {
      appData.devices.push({
        id: Date.now(),
        name,
        room,
        type,
        ip,
        key,
        proto,
        icon,
        devId,
        dp,
        isOn: false,
        power: null
      });
      showToast('Gerät hinzugefügt!');
      appendLog(`[CONFIG] Neues Gerät '${name}' (${ip}) hinzugefügt (Proto v${proto}).`, 'success');
    }

    const saved = editingDeviceId ? appData.devices.find(d => d.id === editingDeviceId) : appData.devices[appData.devices.length - 1];
    closeDeviceModal();
    renderAll();
    await saveBoxData();
    if (saved) pollDevices([saved]);
  });
}

if (deviceDeleteBtn) {
  deviceDeleteBtn.addEventListener('click', async () => {
    if (!editingDeviceId) return;
    if (!confirm('Dieses Gerät wirklich löschen?')) return;

    appData.devices = appData.devices.filter(d => d.id !== editingDeviceId);
    closeDeviceModal();
    renderAll();
    await saveBoxData();
    showToast('Gerät gelöscht.');
  });
}

// 5. Auto-Scan
if (openScanModalBtn) {
  openScanModalBtn.addEventListener('click', () => {
    if (scanResultsBox) scanResultsBox.innerHTML = '<div class="scan-placeholder">Klicke auf „Scan starten“, um Geräte im Heimnetz zu finden.</div>';
    if (scanModal) scanModal.classList.remove('hidden');
  });
}

function closeScanModal() { if (scanModal) scanModal.classList.add('hidden'); }
if (closeScanX) closeScanX.addEventListener('click', closeScanModal);
if (closeScanModalBtn) closeScanModalBtn.addEventListener('click', closeScanModal);
if (scanModal) {
  scanModal.addEventListener('click', (e) => { if (e.target === scanModal) closeScanModal(); });
}

if (startScanBtn) {
  startScanBtn.addEventListener('click', async () => {
    if (!TUYA) { showToast('Die Suche braucht ShareOS 0.2.0-beta.11 und ein Administratorkonto.'); return; }
    const secs = +(scanSubnetInput ? scanSubnetInput.value : 6) || 6;
    startScanBtn.disabled = true;
    if (scanResultsBox) scanResultsBox.innerHTML = `<div class="scan-placeholder">⏳ Die Box lauscht ${secs} Sekunden auf Tuya-Geräte …</div>`;
    appendLog(`[SUCHE] ${secs} s auf UDP 6666/6667 …`, 'cmd');
    let found = [];
    try { found = await TUYA.discover(secs); }
    catch (err) { if (scanResultsBox) scanResultsBox.innerHTML = `<div class="scan-placeholder">Fehler: ${escapeHTML(err.message)}</div>`; startScanBtn.disabled = false; return; }
    startScanBtn.disabled = false;
    appendLog(`[SUCHE] ${found.length} Gerät(e) gefunden.`, 'success');
    if (!scanResultsBox) return;
    if (!found.length) { scanResultsBox.innerHTML = '<div class="scan-placeholder">Kein Gerät gemeldet. Sind die Geräte im selben Netz wie die Box? Protokoll-3.5-Geräte melden sich anders und werden noch nicht gefunden.</div>'; return; }
    scanResultsBox.innerHTML = '';
    found.forEach(dev => {
      const known = appData.devices.find(d => d.devId === dev.id);
      const row = document.createElement('div');
      row.className = 'scanned-item';
      row.innerHTML = `
        <div class="scanned-info">
          <span class="scanned-title">🔌 ${escapeHTML(known ? known.name : dev.id || 'Tuya-Gerät')}</span>
          <span class="scanned-ip">IP: ${escapeHTML(dev.ip)} · ID ${escapeHTML(dev.id || '?')} · v${escapeHTML(dev.version || '?')}</span>
        </div>
        <button class="import-device-btn">${known ? 'Bearbeiten' : 'Hinzufügen'}</button>`;
      row.querySelector('.import-device-btn').addEventListener('click', () => {
        closeScanModal();
        if (known) { known.ip = dev.ip; openDeviceModal(known); return; }
        openDeviceModal();
        if (fIp) fIp.value = dev.ip;
        if (fDevId) fDevId.value = dev.id || '';
        if (fProto && (dev.version === '3.3' || dev.version === '3.4')) fProto.value = dev.version;
        if (fName) fName.value = '';
        if (fKey) fKey.focus();
      });
      scanResultsBox.appendChild(row);
    });
  });
}

// 6. UDP Log Modal
if (openLogModalBtn) {
  openLogModalBtn.addEventListener('click', () => {
    if (logModal) logModal.classList.remove('hidden');
  });
}

function closeLogModal() { if (logModal) logModal.classList.add('hidden'); }
if (closeLogX) closeLogX.addEventListener('click', closeLogModal);
if (closeLogModalBtn) closeLogModalBtn.addEventListener('click', closeLogModal);
if (logModal) {
  logModal.addEventListener('click', (e) => { if (e.target === logModal) closeLogModal(); });
}

if (clearLogBtn) {
  clearLogBtn.addEventListener('click', () => {
    if (logTerminal) logTerminal.innerHTML = '<div class="log-line">[SYSTEM] Log geleert.</div>';
    showToast('UDP Log geleert.');
  });
}

if (testPingBtn) {
  testPingBtn.addEventListener('click', () => {
    appendLog(`[STATUS] Frage ${appData.devices.length} Geräte ab …`, 'cmd');
    pollDevices();
  });
}

// 7. Room Manager
function renderRoomsManageList() {
  if (!roomsManageList) return;
  roomsManageList.innerHTML = '';
  appData.rooms.forEach(room => {
    const div = document.createElement('div');
    div.className = 'room-manage-item';
    div.innerHTML = `
      <span>🏠 ${escapeHTML(room)}</span>
      <button class="del-room-btn" data-room="${escapeHTML(room)}">Löschen</button>
    `;

    div.querySelector('.del-room-btn').addEventListener('click', async () => {
      if (appData.rooms.length <= 1) {
        showToast('Es muss mindestens ein Raum existieren.');
        return;
      }
      if (confirm(`Raum '${room}' wirklich löschen?`)) {
        appData.rooms = appData.rooms.filter(r => r !== room);
        if (activeRoom === room) activeRoom = 'all';
        await saveBoxData();
        renderRoomsManageList();
        renderAll();
        showToast(`Raum '${room}' gelöscht.`);
      }
    });

    roomsManageList.appendChild(div);
  });
}

if (openRoomModalBtn) {
  openRoomModalBtn.addEventListener('click', () => {
    renderRoomsManageList();
    if (roomModal) roomModal.classList.remove('hidden');
    if (newRoomInput) newRoomInput.focus();
  });
}

function closeRoomModal() {
  if (roomModal) roomModal.classList.add('hidden');
  if (newRoomInput) newRoomInput.value = '';
}

if (closeRoomX) closeRoomX.addEventListener('click', closeRoomModal);
if (closeRoomModalBtn) closeRoomModalBtn.addEventListener('click', closeRoomModal);
if (roomModal) {
  roomModal.addEventListener('click', (e) => { if (e.target === roomModal) closeRoomModal(); });
}

if (roomForm) {
  roomForm.addEventListener('submit', async () => {
    const roomName = newRoomInput ? newRoomInput.value.trim() : '';
    if (!roomName) return;
    if (appData.rooms.includes(roomName)) {
      showToast('Dieser Raum existiert bereits.');
      return;
    }
    appData.rooms.push(roomName);
    if (newRoomInput) newRoomInput.value = '';
    await saveBoxData();
    renderRoomsManageList();
    renderAll();
    showToast(`Raum '${roomName}' hinzugefügt!`);
  });
}

// 8. Scene Modal
if (openAddSceneBtn) {
  openAddSceneBtn.addEventListener('click', () => {
    if (sceneModal) sceneModal.classList.remove('hidden');
    if (sceneTitle) sceneTitle.focus();
  });
}

function closeSceneModal() {
  if (sceneModal) sceneModal.classList.add('hidden');
  if (sceneForm) sceneForm.reset();
}

if (closeSceneX) closeSceneX.addEventListener('click', closeSceneModal);
if (sceneCancelBtn) sceneCancelBtn.addEventListener('click', closeSceneModal);
if (sceneModal) {
  sceneModal.addEventListener('click', (e) => { if (e.target === sceneModal) closeSceneModal(); });
}

if (sceneForm) {
  sceneForm.addEventListener('submit', async () => {
    const title = sceneTitle ? sceneTitle.value.trim() : '';
    const action = sceneActionType ? sceneActionType.value : 'all_off';
    if (!title) return;

    if (!appData.scenes) appData.scenes = [];
    appData.scenes.push({ id: Date.now(), title, action });
    closeSceneModal();
    renderAll();
    await saveBoxData();
    showToast(`Szene '${title}' erstellt!`);
  });
}

if (deviceSearch) deviceSearch.addEventListener('input', renderDevices);
if (refreshBtn) refreshBtn.addEventListener('click', () => { pollDevices(); showToast('Frage die Geräte ab …'); });

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

if (!TUYA) {
  const b = document.getElementById('banner');
  if (b) { b.textContent = 'TuyaPulse spricht über die Box mit den Geräten und braucht dafür ShareOS 0.2.0-beta.11 oder neuer und ein Administratorkonto (Berechtigung „tuya“). Geräte lassen sich schon eintragen.'; b.classList.remove('hidden'); }
}
initStorage().then(() => pollDevices());
setInterval(() => { if (!document.hidden) pollDevices(); }, 30000);
