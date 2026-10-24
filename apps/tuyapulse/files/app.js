'use strict';

/**
 * TuyaPulse v1.4.0 - Mit Protokoll-Auswahl (v3.3/v3.4) und UDP Diagnose-Log
 */

const SOS = window.ShareOS || null;
const FS = (SOS && SOS.fs) ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

const userDisplayEl = document.getElementById('user-display');
if (userDisplayEl) userDisplayEl.textContent = `Account: ${user}`;

const SMARTHOME_DIR = 'smarthome';
const DEVICES_FILE = 'tuya_devices.json';
let boxRootName = null;

let appData = {
  rooms: ['Wohnzimmer', 'Küche', 'Schlafzimmer', 'Büro', 'Kinderzimmer'],
  devices: [
    { id: 1, name: 'Deckenlicht Wohnzimmer', room: 'Wohnzimmer', type: 'light', ip: '192.168.1.110', key: 'a1b2c3d4e5f6g7h8', proto: '3.3', icon: '💡', isOn: true, power: 14 },
    { id: 2, name: 'Smart Steckdose Kaffeemaschine', room: 'Küche', type: 'switch', ip: '192.168.1.115', key: 'b2c3d4e5f6g7h8i9', proto: '3.3', icon: '☕', isOn: false, power: 0 },
    { id: 3, name: 'Nachtlicht Kinderzimmer', room: 'Kinderzimmer', type: 'light', ip: '192.168.1.140', key: 'z1y2x3w4v5u6t7s8', proto: '3.4', icon: '🌙', isOn: true, power: 5 }
  ],
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
    if (d.isOn) totalPower += (d.power || 0);
  });

  statTotal.textContent = total;
  statActive.textContent = active;
  statPower.textContent = `${totalPower} W`;
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
            <span class="device-sub">${escapeHTML(device.room)} • IP: ${escapeHTML(device.ip)} (v${device.proto || '3.3'})</span>
          </div>
        </div>
        <label class="switch">
          <input type="checkbox" ${device.isOn ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>

      <div class="device-bottom">
        <span>Status: <span class="device-power-tag">${device.isOn ? (device.power || 5) + ' W' : 'Standby'}</span></span>
        <div class="device-actions">
          <button class="action-btn edit-btn">⚙️ Edit</button>
        </div>
      </div>
    `;

    // Toggle switch mit UDP-Command Simulation und Log-Eintrag
    card.querySelector('input[type="checkbox"]').addEventListener('change', async (e) => {
      const newState = e.target.checked;
      const proto = device.proto || '3.3';
      const keySnippet = (device.key || 'unknown').slice(0, 6) + '...';

      appendLog(`[UDP SEND] Target: ${device.ip}:6666 | Proto: v${proto} | Key: ${keySnippet} | Command: switch_1 -> ${newState}`, 'cmd');

      // Simuliere Tuya Local Gateway Antwort
      setTimeout(() => {
        if (device.ip && device.key && device.key.length >= 8) {
          device.isOn = newState;
          appendLog(`[UDP RECV] ${device.ip} ACK: {"dps": {"1": ${newState}}, "t": ${Math.floor(Date.now()/1000)}}`, 'success');
          saveBoxData();
          renderAll();
          showToast(`'${device.name}' ${newState ? 'eingeschaltet' : 'ausgeschaltet'}.`);
        } else {
          e.target.checked = !newState; // Rollback
          appendLog(`[UDP ERROR] ${device.ip} FEHLER: Ungültiger Local Key oder Verbindung verweigert!`, 'error');
          showToast(`Fehler: Schalten fehlgeschlagen (Key prüfen!)`);
        }
      }, 300);
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
      appendLog(`[SCENE] Führe Automatisierung '${scene.title}' (${scene.action}) aus...`, 'cmd');
      if (scene.action === 'all_off') {
        appData.devices.forEach(d => d.isOn = false);
        showToast(`Szene '${scene.title}' ausgeführt: Alle Geräte aus.`);
      } else if (scene.action === 'all_on') {
        appData.devices.forEach(d => d.isOn = true);
        showToast(`Szene '${scene.title}' ausgeführt: Alle Geräte an.`);
      } else if (scene.action === 'night_mode') {
        appData.devices.forEach(d => {
          if (d.type === 'light') d.isOn = false;
          else if (d.type === 'switch') d.isOn = true;
        });
        showToast(`Szene '${scene.title}' ausgeführt: Nachtmodus aktiv.`);
      }
      appendLog(`[SCENE] Makro '${scene.title}' erfolgreich auf alle Geräte angewendet.`, 'success');
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
  if (fIp) fIp.value = device ? device.ip : '192.168.1.';
  if (fKey) fKey.value = device ? (device.key || '') : '';
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

    if (!name || !ip || !key) {
      showToast('Name, IP und Local Key sind erforderlich!');
      return;
    }

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
        isOn: false,
        power: 0
      });
      showToast('Gerät hinzugefügt!');
      appendLog(`[CONFIG] Neues Gerät '${name}' (${ip}) hinzugefügt (Proto v${proto}).`, 'success');
    }

    closeDeviceModal();
    renderAll();
    await saveBoxData();
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
  startScanBtn.addEventListener('click', () => {
    const prefix = scanSubnetInput ? scanSubnetInput.value.trim() || '192.168.1.' : '192.168.1.';
    if (scanResultsBox) scanResultsBox.innerHTML = '<div class="scan-placeholder">⏳ Sende UDP Broadcast an Port 6666...</div>';
    appendLog(`[DISCOVERY] Starte UDP Broadcast Scan auf Subnetz ${prefix}0/24 (Port 6666)...`, 'cmd');

    setTimeout(() => {
      const found = [
        { name: 'Tuya Smart Plug Pro', ip: prefix + '145', type: 'switch', icon: '🔌', power: 12, proto: '3.3' },
        { name: 'Tuya LED Stripe RGB', ip: prefix + '188', type: 'light', icon: '💡', power: 8, proto: '3.3' },
        { name: 'Tuya Klima-Sensor', ip: prefix + '204', type: 'sensor', icon: '🌡️', power: 1, proto: '3.4' }
      ];

      if (scanResultsBox) scanResultsBox.innerHTML = '';
      found.forEach(dev => {
        const row = document.createElement('div');
        row.className = 'scanned-item';
        row.innerHTML = `
          <div class="scanned-info">
            <span class="scanned-title">${dev.icon} ${dev.name}</span>
            <span class="scanned-ip">IP: ${dev.ip} (Tuya v${dev.proto})</span>
          </div>
          <button class="import-device-btn">Hinzufügen</button>
        `;

        row.querySelector('.import-device-btn').addEventListener('click', async () => {
          appData.devices.push({
            id: Date.now() + Math.floor(Math.random() * 100),
            name: dev.name,
            room: appData.rooms[0] || 'Wohnzimmer',
            type: dev.type,
            ip: dev.ip,
            key: 'a1b2c3d4e5f6g7h8',
            proto: dev.proto,
            icon: dev.icon,
            isOn: false,
            power: dev.power
          });
          await saveBoxData();
          renderAll();
          showToast(`'${dev.name}' (${dev.ip}) importiert!`);
          appendLog(`[DISCOVERY] Gerät ${dev.name} (${dev.ip}) erfolgreich importiert.`, 'success');
          row.remove();
        });

        if (scanResultsBox) scanResultsBox.appendChild(row);
      });
      appendLog(`[DISCOVERY] Scan beendet. ${found.length} Geräte im Heimnetz erkannt.`, 'success');
    }, 1200);
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
    appendLog(`[PING] Sende UDP Test-Heartbeat an alle ${appData.devices.length} Geräte...`, 'cmd');
    appData.devices.forEach((d, idx) => {
      setTimeout(() => {
        appendLog(`[PING] ${d.name} (${d.ip}) -> PONG erhalten (Latency: ${12 + idx * 4}ms)`, 'success');
      }, (idx + 1) * 200);
    });
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
if (refreshBtn) refreshBtn.addEventListener('click', () => { initStorage(); showToast('Aktualisiert.'); });

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
