'use strict';

/**
 * SmartBudget - Energie- & Zählerstandserfassung (Strom, Gas, Wasser)
 * Speichert Daten unter energy/meter_readings.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const ENERGY_DIR = 'energy';
const READINGS_FILE = 'meter_readings.json';
let boxRootName = null;

let readings = [];
let activeType = 'all';
let editingReadingId = null;

// UI Elements
const entrySearch = document.getElementById('entry-search');
const openAddBtn = document.getElementById('open-add-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const refreshBtn = document.getElementById('refresh-btn');
const readingsList = document.getElementById('readings-list');
const emptyState = document.getElementById('empty-state');
const readingsCountLabel = document.getElementById('readings-count-label');
const storageStatus = document.getElementById('storage-status');

// Dashboard Elements
const valTotalCost = document.getElementById('val-total-cost');
const valElecKwh = document.getElementById('val-elec-kwh');
const subElecCost = document.getElementById('sub-elec-cost');
const valGasM3 = document.getElementById('val-gas-m3');
const subGasCost = document.getElementById('sub-gas-cost');
const valWaterM3 = document.getElementById('val-water-m3');
const subWaterCost = document.getElementById('sub-water-cost');

const countAll = document.getElementById('count-all');
const countElec = document.getElementById('count-elec');
const countGas = document.getElementById('count-gas');
const countWater = document.getElementById('count-water');

// Modal Elements
const readingModal = document.getElementById('reading-modal');
const modalHeading = document.getElementById('modal-heading');
const readingForm = document.getElementById('reading-form');
const fType = document.getElementById('f-type');
const fDate = document.getElementById('f-date');
const fReading = document.getElementById('f-reading');
const labelReading = document.getElementById('label-reading');
const fPrice = document.getElementById('f-price');
const fNotes = document.getElementById('f-notes');
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
    loadFallbackReadings();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', ENERGY_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${ENERGY_DIR}/${READINGS_FILE}`;
      await loadBoxReadings();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackReadings();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackReadings();
  }
}

async function loadBoxReadings() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, ENERGY_DIR, READINGS_FILE);
    const text = await (await handle.blob()).text();
    readings = JSON.parse(text);
  } catch (_) {
    createDefaultReadings();
    await saveBoxReadings();
  }
  renderAll();
}

async function saveBoxReadings() {
  localStorage.setItem(`smartbudget_${user}`, JSON.stringify(readings));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, ENERGY_DIR, READINGS_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(readings, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${ENERGY_DIR}/${READINGS_FILE}`, name: READINGS_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackReadings() {
  const raw = localStorage.getItem(`smartbudget_${user}`);
  if (raw) {
    try { readings = JSON.parse(raw); } catch (_) {}
  }
  if (!readings || !readings.length) {
    createDefaultReadings();
  }
  renderAll();
}

function createDefaultReadings() {
  readings = [
    { id: 1, type: 'electricity', date: '2026-01-01', reading: 24200, price: 0.34, notes: 'Jahresbeginn' },
    { id: 2, type: 'electricity', date: '2026-06-01', reading: 25650, price: 0.34, notes: 'Zwischenstand Sommer' },
    { id: 3, type: 'gas', date: '2026-01-01', reading: 12400, price: 0.11, notes: 'Gaszähler Start' },
    { id: 4, type: 'water', date: '2026-01-01', reading: 450.5, price: 4.20, notes: 'Wasser Hauptzähler' }
  ];
}

// 2. Berechnungen & Statistiken
function updateStats() {
  if (!readings.length) {
    valTotalCost.textContent = '0,00 €';
    valElecKwh.textContent = '0 kWh';
    subElecCost.textContent = '0,00 €';
    valGasM3.textContent = '0 m³';
    subGasCost.textContent = '0,00 €';
    valWaterM3.textContent = '0 m³';
    subWaterCost.textContent = '0,00 €';
    return;
  }

  let totalCostSum = 0;
  let elecDiff = 0, elecCostSum = 0;
  let gasDiff = 0, gasCostSum = 0;
  let waterDiff = 0, waterCostSum = 0;

  ['electricity', 'gas', 'water'].forEach(type => {
    const list = readings.filter(r => r.type === type).sort((a,b) => new Date(a.date) - new Date(b.date));
    if (list.length >= 2) {
      const diff = list[list.length - 1].reading - list[0].reading;
      const avgPrice = list[list.length - 1].price || 0.30;
      const cost = diff * avgPrice;
      totalCostSum += cost;

      if (type === 'electricity') { elecDiff = diff; elecCostSum = cost; }
      else if (type === 'gas') { gasDiff = diff; gasCostSum = cost; }
      else if (type === 'water') { waterDiff = diff; waterCostSum = cost; }
    } else if (list.length === 1) {
      const cost = list[0].reading * (list[0].price || 0);
      totalCostSum += cost;
      if (type === 'electricity') { elecDiff = list[0].reading; elecCostSum = cost; }
      else if (type === 'gas') { gasDiff = list[0].reading; gasCostSum = cost; }
      else if (type === 'water') { waterDiff = list[0].reading; waterCostSum = cost; }
    }
  });

  valTotalCost.textContent = `${totalCostSum.toFixed(2).replace('.', ',')} €`;
  valElecKwh.textContent = `${elecDiff.toLocaleString()} kWh`;
  subElecCost.textContent = `${elecCostSum.toFixed(2).replace('.', ',')} €`;
  valGasM3.textContent = `${gasDiff.toLocaleString()} m³`;
  subGasCost.textContent = `${gasCostSum.toFixed(2).replace('.', ',')} €`;
  valWaterM3.textContent = `${waterDiff.toLocaleString()} m³`;
  subWaterCost.textContent = `${waterCostSum.toFixed(2).replace('.', ',')} €`;
}

// 3. Rendering
function renderAll() {
  updateStats();
  renderCounts();
  renderReadings();
}

function renderCounts() {
  countAll.textContent = readings.length;
  countElec.textContent = readings.filter(r => r.type === 'electricity').length;
  countGas.textContent = readings.filter(r => r.type === 'gas').length;
  countWater.textContent = readings.filter(r => r.type === 'water').length;
  readingsCountLabel.textContent = `${readings.length} Ablesungen gesamt`;
}

function renderReadings() {
  const query = entrySearch.value.trim().toLowerCase();
  readingsList.innerHTML = '';

  const sorted = [...readings].sort((a,b) => new Date(b.date) - new Date(a.date));

  const filtered = sorted.filter(r => {
    if (activeType !== 'all' && r.type !== activeType) return false;
    if (query) {
      return r.date.includes(query) ||
             (r.notes || '').toLowerCase().includes(query) ||
             String(r.reading).includes(query);
    }
    return true;
  });

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(item => {
    const row = document.createElement('div');
    row.className = 'reading-row';

    let icon = '⚡';
    let unit = 'kWh';
    let typeName = 'Stromzähler';
    if (item.type === 'gas') { icon = '🔥'; unit = 'm³'; typeName = 'Gaszähler'; }
    else if (item.type === 'water') { icon = '💧'; unit = 'm³'; typeName = 'Wasserzähler'; }

    const estCost = (item.reading * (item.price || 0)).toFixed(2).replace('.', ',');

    row.innerHTML = `
      <div class="reading-left">
        <div class="reading-icon-badge">${icon}</div>
        <div class="reading-info">
          <span class="reading-title">${typeName} (${item.reading.toLocaleString()} ${unit})</span>
          <span class="reading-subtext">${item.date} • Preis: ${item.price} €/${unit} ${item.notes ? '• ' + escapeHTML(item.notes) : ''}</span>
        </div>
      </div>
      <div class="reading-right">
        <span class="reading-cost">${item.reading.toLocaleString()} ${unit}</span>
        <span class="reading-stat-tag">Tarif: ${item.price} €</span>
      </div>
    `;

    row.addEventListener('click', () => openModal(item));
    readingsList.appendChild(row);
  });
}

// 4. Modal Logik
function openModal(item = null) {
  editingReadingId = item ? item.id : null;
  modalHeading.textContent = item ? 'Zählerstand bearbeiten' : 'Zählerstand erfassen';

  fType.value = item ? item.type : 'electricity';
  fDate.value = item ? item.date : new Date().toISOString().slice(0, 10);
  fReading.value = item ? item.reading : '';
  fPrice.value = item ? item.price : 0.32;
  fNotes.value = item ? (item.notes || '') : '';

  updateModalFields();

  modalDeleteBtn.classList.toggle('hidden', !item);
  readingModal.classList.remove('hidden');
  fReading.focus();
}

function updateModalFields() {
  const type = fType.value;
  if (type === 'electricity') {
    labelReading.textContent = 'Zählerstand (kWh)';
    fPrice.value = '0.32';
  } else if (type === 'gas') {
    labelReading.textContent = 'Zählerstand (m³)';
    fPrice.value = '0.12';
  } else {
    labelReading.textContent = 'Zählerstand (m³)';
    fPrice.value = '4.10';
  }
}

fType.addEventListener('change', updateModalFields);

function closeModal() {
  readingModal.classList.add('hidden');
  editingReadingId = null;
  readingForm.reset();
}

openAddBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
readingModal.addEventListener('click', (e) => {
  if (e.target === readingModal) closeModal();
});

readingForm.addEventListener('submit', async () => {
  const type = fType.value;
  const date = fDate.value;
  const reading = parseFloat(fReading.value);
  const price = parseFloat(fPrice.value) || 0;
  const notes = fNotes.value.trim();

  if (!date || isNaN(reading)) return;

  if (editingReadingId) {
    const itm = readings.find(r => r.id === editingReadingId);
    if (itm) {
      itm.type = type;
      itm.date = date;
      itm.reading = reading;
      itm.price = price;
      itm.notes = notes;
    }
    showToast('Zählerstand aktualisiert.');
  } else {
    readings.push({
      id: Date.now(),
      type,
      date,
      reading,
      price,
      notes
    });
    showToast('Zählerstand gespeichert!');
  }

    closeModal();
  renderAll();
  await saveBoxReadings();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingReadingId) return;
  if (!confirm('Diesen Zählerstand wirklich löschen?')) return;

  readings = readings.filter(r => r.id !== editingReadingId);
  closeModal();
  renderAll();
  await saveBoxReadings();
  showToast('Zählerstand gelöscht.');
});

// 5. CSV Export
exportCsvBtn.addEventListener('click', () => {
  if (!readings.length) {
    showToast('Keine Einträge für den Export vorhanden.');
    return;
  }

  const sorted = [...readings].sort((a,b) => new Date(a.date) - new Date(b.date));
  let csv = 'ID;Datum;Typ;Zaehlerstand;Arbeitspreis_EUR;Notizen\n';

  sorted.forEach(r => {
    csv += `"${r.id}";"${r.date}";"${r.type}";"${r.reading}";"${r.price}";"${(r.notes || '').replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SmartBudget_Energy_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('CSV-Export heruntergeladen!');
});

// 6. Sub-Header Filter
document.querySelectorAll('#type-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#type-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeType = btn.dataset.type;
    renderReadings();
  });
});

entrySearch.addEventListener('input', renderReadings);
refreshBtn?.addEventListener('click', () => {
  initStorage();
  showToast('Aktualisiert.');
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
