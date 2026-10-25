'use strict';

/**
 * PillClock - Diskreter Medikamenten- & Vitalwert-Tracker
 * Speichert Daten unter health/meds_vitals.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const HEALTH_DIR = 'health';
const HEALTH_FILE = 'meds_vitals.json';
let boxRootName = null;

let activeView = 'meds';
let healthData = {
  medications: [],
  vitals: []
};

let editingMedId = null;

// UI Elements
const openAddMedBtn = document.getElementById('open-add-med-btn');
const openAddVitalBtn = document.getElementById('open-add-vital-btn');
const refreshBtn = document.getElementById('refresh-btn');
const storageStatus = document.getElementById('storage-status');

const sectionMeds = document.getElementById('section-meds');
const sectionVitals = document.getElementById('section-vitals');
const medsGrid = document.getElementById('meds-grid');
const emptyMedsEmpty = document.getElementById('empty-meds-empty');
const medsStats = document.getElementById('meds-stats');
const countMeds = document.getElementById('count-meds');

const vitalsTbody = document.getElementById('vitals-tbody');
const emptyVitalsEmpty = document.getElementById('empty-vitals-empty');
const vitalsStats = document.getElementById('vitals-stats');
const countVitals = document.getElementById('count-vitals');

// Med Modal Elements
const medModal = document.getElementById('med-modal');
const medModalHeading = document.getElementById('med-modal-heading');
const medForm = document.getElementById('med-form');
const mName = document.getElementById('m-name');
const mDose = document.getElementById('m-dose');
const mTime = document.getElementById('m-time');
const mFrequency = document.getElementById('m-frequency');
const mNotes = document.getElementById('m-notes');
const medDeleteBtn = document.getElementById('med-delete-btn');
const medCancelBtn = document.getElementById('med-cancel-btn');
const closeMedX = document.getElementById('close-med-x');

// Vital Modal Elements
const vitalModal = document.getElementById('vital-modal');
const vitalForm = document.getElementById('vital-form');
const vType = document.getElementById('v-type');
const vDate = document.getElementById('v-date');
const groupV1 = document.getElementById('group-v1');
const groupV2 = document.getElementById('group-v2');
const labelV1 = document.getElementById('label-v1');
const labelV2 = document.getElementById('label-v2');
const vVal1 = document.getElementById('v-val1');
const vVal2 = document.getElementById('v-val2');
const vNotes = document.getElementById('v-notes');
const vitalCancelBtn = document.getElementById('vital-cancel-btn');
const closeVitalX = document.getElementById('close-vital-x');

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
    loadFallbackData();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', HEALTH_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${HEALTH_DIR}/${HEALTH_FILE}`;
      await loadBoxData();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackData();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackData();
  }
}

async function loadBoxData() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, HEALTH_DIR, HEALTH_FILE);
    const text = await (await handle.blob()).text();
    healthData = JSON.parse(text);
  } catch (_) {
    createDefaultData();
    await saveBoxData();
  }
  renderAll();
}

async function saveBoxData() {
  localStorage.setItem(`pillclock_${user}`, JSON.stringify(healthData));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, HEALTH_DIR, HEALTH_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(healthData, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${HEALTH_DIR}/${HEALTH_FILE}`, name: HEALTH_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackData() {
  const raw = localStorage.getItem(`pillclock_${user}`);
  if (raw) {
    try { healthData = JSON.parse(raw); } catch (_) {}
  }
  if (!healthData || (!healthData.medications && !healthData.vitals)) {
    createDefaultData();
  }
  renderAll();
}

function createDefaultData() {
  const todayStr = new Date().toISOString().slice(0, 10);
  healthData = {
    medications: [
      { id: 1, name: 'Vitamin D3', dose: '1.000 IE', time: '08:00', frequency: 'daily', notes: 'Zum Frühstück', history: { [todayStr]: true } },
      { id: 2, name: 'Magnesium', dose: '400 mg', time: '20:00', frequency: 'evening', notes: 'Vor dem Schlafen', history: {} }
    ],
    vitals: [
      { id: 101, type: 'blood_pressure', date: new Date().toISOString().slice(0, 16), val1: 122, val2: 80, notes: 'Morgens nüchtern' },
      { id: 102, type: 'weight', date: new Date().toISOString().slice(0, 16), val1: 76.5, val2: 0, notes: 'Wiegemessung' }
    ]
  };
}

// 2. Rendering
function renderAll() {
  renderMeds();
  renderVitals();
}

function renderMeds() {
  medsGrid.innerHTML = '';
  const meds = healthData.medications || [];
  countMeds.textContent = meds.length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const takenCount = meds.filter(m => m.history && m.history[todayStr]).length;
  medsStats.textContent = `${takenCount} von ${meds.length} eingenommen`;

  if (!meds.length) {
    emptyMedsEmpty.classList.remove('hidden');
    return;
  }
  emptyMedsEmpty.classList.add('hidden');

  meds.forEach(med => {
    const isTaken = Boolean(med.history && med.history[todayStr]);
    const card = document.createElement('div');
    card.className = `med-card ${isTaken ? 'taken' : ''}`;

    card.innerHTML = `
      <div class="med-top">
        <div class="med-title-box">
          <span class="med-name">${escapeHTML(med.name)}</span>
          <span class="med-sub">${escapeHTML(med.dose)} • ${escapeHTML(med.frequency)} ${med.notes ? '• ' + escapeHTML(med.notes) : ''}</span>
        </div>
        <span class="time-badge">⏰ ${med.time}</span>
      </div>
      <div class="med-bottom">
        <button class="take-btn">${isTaken ? '✓ Eingenommen' : 'Als eingenommen markieren'}</button>
        <div class="med-actions">
          <button class="action-icon-btn edit-med-btn" title="Bearbeiten">✏️</button>
        </div>
      </div>
    `;

    card.querySelector('.take-btn').addEventListener('click', async () => {
      if (!med.history) med.history = {};
      med.history[todayStr] = !med.history[todayStr];
      await saveBoxData();
      renderAll();
      showToast(med.history[todayStr] ? `'${med.name}' als eingenommen markiert.` : 'Status zurückgesetzt.');
    });

    card.querySelector('.edit-med-btn').addEventListener('click', () => openMedModal(med));

    medsGrid.appendChild(card);
  });
}

function renderVitals() {
  vitalsTbody.innerHTML = '';
  const vitals = healthData.vitals || [];
  countVitals.textContent = vitals.length;
  vitalsStats.textContent = `${vitals.length} Messungen`;

  if (!vitals.length) {
    emptyVitalsEmpty.classList.add('hidden'); // Table has wrap
    // We can show empty message or table. Let's toggle table wrap vs empty
  }

  const sorted = [...vitals].sort((a,b) => new Date(b.date) - new Date(a.date));

  sorted.forEach(v => {
    const tr = document.createElement('tr');
    let typeLabel = 'Vitalwert';
    let valStr = '';

    if (v.type === 'blood_pressure') {
      typeLabel = '🩸 Blutdruck & Puls';
      valStr = `<span class="val-badge">${v.val1} / ${v.val2}</span> mmHg`;
    } else if (v.type === 'weight') {
      typeLabel = '⚖️ Gewicht';
      valStr = `<span class="val-badge">${v.val1}</span> kg`;
    } else if (v.type === 'glucose') {
      typeLabel = '🍬 Blutzucker';
      valStr = `<span class="val-badge">${v.val1}</span> mg/dl`;
    } else if (v.type === 'temperature') {
      typeLabel = '🌡️ Temperatur';
      valStr = `<span class="val-badge">${v.val1}</span> °C`;
    }

    const dateFormatted = v.date ? v.date.replace('T', ' ') : '';

    tr.innerHTML = `
      <td style="font-family:monospace; font-size:12px;">${dateFormatted}</td>
      <td>${typeLabel}</td>
      <td>${valStr}</td>
      <td>${escapeHTML(v.notes || '-')}</td>
      <td>
        <button class="del-vital-btn" data-id="${v.id}">Löschen</button>
      </td>
    `;

    tr.querySelector('.del-vital-btn').addEventListener('click', async () => {
      healthData.vitals = healthData.vitals.filter(x => x.id !== v.id);
      await saveBoxData();
      renderAll();
      showToast('Messung gelöscht.');
    });

    vitalsTbody.appendChild(tr);
  });
}

// 3. Med Modal Logik
function openMedModal(med = null) {
  editingMedId = med ? med.id : null;
  medModalHeading.textContent = med ? 'Medikament bearbeiten' : 'Medikament hinzufügen';

  mName.value = med ? med.name : '';
  mDose.value = med ? med.dose : '';
  mTime.value = med ? med.time : '08:00';
  mFrequency.value = med ? med.frequency : 'daily';
  mNotes.value = med ? (med.notes || '') : '';

  medDeleteBtn.classList.toggle('hidden', !med);
  medModal.classList.remove('hidden');
  mName.focus();
}

function closeMedModal() {
  medModal.classList.add('hidden');
  editingMedId = null;
  medForm.reset();
}

openAddMedBtn.addEventListener('click', () => openMedModal());
closeMedX.addEventListener('click', closeMedModal);
medCancelBtn.addEventListener('click', closeMedModal);
medModal.addEventListener('click', (e) => {
  if (e.target === medModal) closeMedModal();
});

medForm.addEventListener('submit', async () => {
  const name = mName.value.trim();
  const dose = mDose.value.trim();
  const time = mTime.value;
  const frequency = mFrequency.value;
  const notes = mNotes.value.trim();

  if (!name || !dose) return;

  if (!healthData.medications) healthData.medications = [];

  if (editingMedId) {
    const item = healthData.medications.find(m => m.id === editingMedId);
    if (item) {
      item.name = name;
      item.dose = dose;
      item.time = time;
      item.frequency = frequency;
      item.notes = notes;
    }
    showToast('Medikament aktualisiert.');
  } else {
    healthData.medications.push({
      id: Date.now(),
      name,
      dose,
      time,
      frequency,
      notes,
      history: {}
    });
    showToast('Medikament hinzugefügt!');
  }

  closeMedModal();
  renderAll();
  await saveBoxData();
});

medDeleteBtn.addEventListener('click', async () => {
  if (!editingMedId) return;
  if (!confirm('Dieses Medikament wirklich löschen?')) return;

  healthData.medications = healthData.medications.filter(m => m.id !== editingMedId);
  closeMedModal();
  renderAll();
  await saveBoxData();
  showToast('Medikament gelöscht.');
});

// 4. Vital Modal Logik
function openVitalModal() {
  vDate.value = new Date().toISOString().slice(0, 16);
  vType.value = 'blood_pressure';
  vVal1.value = '';
  vVal2.value = '';
  vNotes.value = '';
  updateVitalInputs();
  vitalModal.classList.remove('hidden');
  vVal1.focus();
}

function closeVitalModal() {
  vitalModal.classList.add('hidden');
  vitalForm.reset();
}

function updateVitalInputs() {
  const type = vType.value;
  if (type === 'blood_pressure') {
    groupV2.style.display = 'flex';
    labelV1.textContent = 'Systole (mmHg)';
    labelV2.textContent = 'Diastole (mmHg)';
    vVal1.placeholder = 'z. B. 120';
    vVal2.placeholder = 'z. B. 80';
  } else if (type === 'weight') {
    groupV2.style.display = 'none';
    labelV1.textContent = 'Gewicht (kg)';
    vVal1.placeholder = 'z. B. 75.2';
  } else if (type === 'glucose') {
    groupV2.style.display = 'none';
    labelV1.textContent = 'Blutzucker (mg/dl)';
    vVal1.placeholder = 'z. B. 95';
  } else if (type === 'temperature') {
    groupV2.style.display = 'none';
    labelV1.textContent = 'Temperatur (°C)';
    vVal1.placeholder = 'z. B. 36.6';
  }
}

vType.addEventListener('change', updateVitalInputs);
openAddVitalBtn.addEventListener('click', openVitalModal);
closeVitalX.addEventListener('click', closeVitalModal);
vitalCancelBtn.addEventListener('click', closeVitalModal);
vitalModal.addEventListener('click', (e) => {
  if (e.target === vitalModal) closeVitalModal();
});

vitalForm.addEventListener('submit', async () => {
  const type = vType.value;
  const date = vDate.value;
  const val1 = parseFloat(vVal1.value);
  const val2 = parseFloat(vVal2.value) || 0;
  const notes = vNotes.value.trim();

  if (!date || isNaN(val1)) return;

  if (!healthData.vitals) healthData.vitals = [];

  healthData.vitals.unshift({
    id: Date.now(),
    type,
    date,
    val1,
    val2,
    notes
  });

  closeVitalModal();
  renderAll();
  await saveBoxData();
  showToast('Vitalwert eingetragen!');
});

// 5. View Switcher (Sub-Header)
document.querySelectorAll('#view-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#view-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeView = btn.dataset.view;

    if (activeView === 'meds') {
      sectionMeds.classList.remove('hidden');
      sectionVitals.classList.add('hidden');
    } else {
      sectionMeds.classList.add('hidden');
      sectionVitals.classList.remove('hidden');
    }
  });
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
