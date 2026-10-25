'use strict';

/**
 * VehicleLog - Fahrtenbuch, Tank- & Lade-Tracker
 * Speichert Daten unter vehicle/logbook.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const VEHICLE_DIR = 'vehicle';
const LOGBOOK_FILE = 'logbook.json';
let boxRootName = null;

let entries = [];
let activeType = 'all';
let editingEntryId = null;

// UI Elements
const entrySearch = document.getElementById('entry-search');
const openAddBtn = document.getElementById('open-add-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const entriesList = document.getElementById('entries-list');
const emptyState = document.getElementById('empty-state');
const entriesCountLabel = document.getElementById('entries-count-label');
const storageStatus = document.getElementById('storage-status');

// Stat Elements
const valTotalKm = document.getElementById('val-total-km');
const subLastOdo = document.getElementById('sub-last-odo');
const valAvgConsumption = document.getElementById('val-avg-consumption');
const valTotalCost = document.getElementById('val-total-cost');
const valCostKm = document.getElementById('val-cost-km');

// Count Pills
const countAll = document.getElementById('count-all');
const countTrips = document.getElementById('count-trips');
const countFuel = document.getElementById('count-fuel');
const countService = document.getElementById('count-service');

// Modal Elements
const entryModal = document.getElementById('entry-modal');
const modalHeading = document.getElementById('modal-heading');
const entryForm = document.getElementById('entry-form');
const fType = document.getElementById('f-type');
const fDate = document.getElementById('f-date');
const fOdometer = document.getElementById('f-odometer');
const fAmount = document.getElementById('f-amount');
const labelAmount = document.getElementById('label-amount');
const fCost = document.getElementById('f-cost');
const fPurpose = document.getElementById('f-purpose');
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

// 1. Initialisierung ShareOS.fs
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadFallbackEntries();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', VEHICLE_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${VEHICLE_DIR}/${LOGBOOK_FILE}`;
      await loadBoxEntries();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackEntries();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackEntries();
  }
}

async function loadBoxEntries() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, VEHICLE_DIR, LOGBOOK_FILE);
    const text = await (await handle.blob()).text();
    entries = JSON.parse(text);
  } catch (_) {
    createDefaultEntries();
    await saveBoxEntries();
  }
  renderAll();
}

async function saveBoxEntries() {
  localStorage.setItem(`vehiclelog_${user}`, JSON.stringify(entries));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, VEHICLE_DIR, LOGBOOK_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${VEHICLE_DIR}/${LOGBOOK_FILE}`, name: LOGBOOK_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackEntries() {
  const raw = localStorage.getItem(`vehiclelog_${user}`);
  if (raw) {
    try { entries = JSON.parse(raw); } catch (_) {}
  }
  if (!entries || !entries.length) {
    createDefaultEntries();
  }
  renderAll();
}

function createDefaultEntries() {
  entries = [
    {
      id: 1,
      type: 'fuel',
      date: '2026-10-10',
      odometer: 48200,
      amount: 46.5,
      cost: 78.50,
      purpose: 'Vollbetankung',
      notes: 'Super E10, Tankstelle Nord'
    },
    {
      id: 2,
      type: 'trip',
      date: '2026-10-15',
      odometer: 48580,
      amount: 0,
      cost: 0,
      purpose: 'Dienstfahrt Berlin Kundenmeeting',
      notes: 'Hin- und Rückfahrt Autobahn A12'
    },
    {
      id: 3,
      type: 'fuel',
      date: '2026-10-22',
      odometer: 48950,
      amount: 47.2,
      cost: 79.90,
      purpose: 'Vollbetankung',
      notes: 'Super E10'
    }
  ];
}

// 2. Berechnungen & Statistiken
function updateStats() {
  if (!entries.length) {
    valTotalKm.textContent = '0 km';
    valAvgConsumption.textContent = '--';
    valTotalCost.textContent = '0,00 €';
    valCostKm.textContent = '-- €/km';
    return;
  }

  // Nach Kilometerstand sortieren
  const sorted = [...entries].sort((a,b) => a.odometer - b.odometer);
  const minOdo = sorted[0].odometer;
  const maxOdo = sorted[sorted.length - 1].odometer;
  const totalKmDriven = Math.max(0, maxOdo - minOdo);

  valTotalKm.textContent = `${maxOdo.toLocaleString()} km`;
  subLastOdo.textContent = `${totalKmDriven.toLocaleString()} km im Log erfasst`;

  // Gesamtkosten
  const totalCost = entries.reduce((sum, e) => sum + (parseFloat(e.cost) || 0), 0);
  valTotalCost.textContent = `${totalCost.toFixed(2).replace('.', ',')} €`;

  if (totalKmDriven > 0 && totalCost > 0) {
    const costPerKm = (totalCost / totalKmDriven).toFixed(2).replace('.', ',');
    valCostKm.textContent = `${costPerKm} €/km`;
  } else {
    valCostKm.textContent = '-- €/km';
  }

  // Durchschnittsverbrauch berechnen (anhand der Fuel-Einträge)
  const fuelEntries = sorted.filter(e => e.type === 'fuel' && e.amount > 0);
  if (fuelEntries.length >= 2) {
    let totalLiters = 0;
    for (let i = 1; i < fuelEntries.length; i++) {
      totalLiters += parseFloat(fuelEntries[i].amount) || 0;
    }
    const fuelDist = fuelEntries[fuelEntries.length - 1].odometer - fuelEntries[0].odometer;
    if (fuelDist > 0 && totalLiters > 0) {
      const avg = ((totalLiters / fuelDist) * 100).toFixed(2).replace('.', ',');
      valAvgConsumption.textContent = `${avg} l/100km`;
    } else {
      valAvgConsumption.textContent = '--';
    }
  } else {
    valAvgConsumption.textContent = '--';
  }
}

// 3. Rendering
function renderAll() {
  updateStats();
  renderCounts();
  renderEntries();
}

function renderCounts() {
  countAll.textContent = entries.length;
  countTrips.textContent = entries.filter(e => e.type === 'trip').length;
  countFuel.textContent = entries.filter(e => e.type === 'fuel').length;
  countService.textContent = entries.filter(e => e.type === 'service').length;
  entriesCountLabel.textContent = `${entries.length} Einträge gesamt`;
}

function renderEntries() {
  const query = entrySearch.value.trim().toLowerCase();
  entriesList.innerHTML = '';

  const sorted = [...entries].sort((a,b) => new Date(b.date) - new Date(a.date) || b.odometer - a.odometer);

  const filtered = sorted.filter(e => {
    if (activeType !== 'all' && e.type !== activeType) return false;
    if (query) {
      const matchPurpose = (e.purpose || '').toLowerCase().includes(query);
      const matchNotes = (e.notes || '').toLowerCase().includes(query);
      const matchDate = (e.date || '').includes(query);
      const matchOdo = String(e.odometer || '').includes(query);
      if (!matchPurpose && !matchNotes && !matchDate && !matchOdo) return false;
    }
    return true;
  });

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'entry-row';

    let icon = '🗺️';
    let typeName = 'Fahrt';
    if (entry.type === 'fuel') { icon = '⛽'; typeName = 'Tanken / Laden'; }
    else if (entry.type === 'service') { icon = '🔧'; typeName = 'Wartung / Service'; }

    const costStr = entry.cost > 0 ? `${parseFloat(entry.cost).toFixed(2).replace('.', ',')} €` : '--';
    const amountStr = entry.amount > 0 ? `${entry.amount} l/kWh` : '';

    row.innerHTML = `
      <div class="entry-left">
        <div class="entry-icon-badge">${icon}</div>
        <div class="entry-info">
          <span class="entry-title">${escapeHTML(entry.purpose || typeName)}</span>
          <span class="entry-subtext">${entry.date} • Stand: ${entry.odometer.toLocaleString()} km ${entry.notes ? '• ' + escapeHTML(entry.notes) : ''}</span>
        </div>
      </div>
      <div class="entry-right">
        <span class="entry-cost">${costStr}</span>
        ${amountStr ? `<span class="entry-stat-tag">${amountStr}</span>` : ''}
      </div>
    `;

    row.addEventListener('click', () => openModal(entry));
    entriesList.appendChild(row);
  });
}

// 4. Modal Logik
function openModal(entry = null) {
  editingEntryId = entry ? entry.id : null;
  modalHeading.textContent = entry ? 'Eintrag bearbeiten' : 'Neuen Eintrag erfassen';

  fType.value = entry ? entry.type : 'fuel';
  fDate.value = entry ? entry.date : new Date().toISOString().slice(0, 10);
  fOdometer.value = entry ? entry.odometer : (entries.length ? Math.max(...entries.map(e => e.odometer)) : '');
  fAmount.value = entry ? (entry.amount || '') : '';
  fCost.value = entry ? (entry.cost || '') : '';
  fPurpose.value = entry ? (entry.purpose || '') : '';
  fNotes.value = entry ? (entry.notes || '') : '';

  updateModalFields();

  modalDeleteBtn.classList.toggle('hidden', !entry);
  entryModal.classList.remove('hidden');
}

function updateModalFields() {
  const type = fType.value;
  if (type === 'trip') {
    labelAmount.textContent = 'Gefahrene km (optional)';
    fPurpose.placeholder = 'z. B. Kundenbesuch Frankfurt, Ausflug Ostsee';
  } else if (type === 'fuel') {
    labelAmount.textContent = 'Getankt (Liter / kWh)';
    fPurpose.placeholder = 'z. B. Vollbetankung, Zwischenladung';
  } else {
    labelAmount.textContent = 'Teile / Menge';
    fPurpose.placeholder = 'z. B. Inspektion, Ölwechsel, TÜV';
  }
}

fType.addEventListener('change', updateModalFields);

function closeModal() {
  entryModal.classList.add('hidden');
  editingEntryId = null;
  entryForm.reset();
}

openAddBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
entryModal.addEventListener('click', (e) => {
  if (e.target === entryModal) closeModal();
});

entryForm.addEventListener('submit', async () => {
  const type = fType.value;
  const date = fDate.value;
  const odometer = parseInt(fOdometer.value, 10);
  const amount = parseFloat(fAmount.value) || 0;
  const cost = parseFloat(fCost.value) || 0;
  const purpose = fPurpose.value.trim();
  const notes = fNotes.value.trim();

  if (!date || isNaN(odometer)) return;

  if (editingEntryId) {
    const item = entries.find(e => e.id === editingEntryId);
    if (item) {
      item.type = type;
      item.date = date;
      item.odometer = odometer;
      item.amount = amount;
      item.cost = cost;
      item.purpose = purpose;
      item.notes = notes;
    }
    showToast('Eintrag aktualisiert.');
  } else {
    entries.push({
      id: Date.now(),
      type,
      date,
      odometer,
      amount,
      cost,
      purpose,
      notes
    });
    showToast('Eintrag gespeichert!');
  }

  closeModal();
  renderAll();
  await saveBoxEntries();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingEntryId) return;
  if (!confirm('Diesen Eintrag wirklich löschen?')) return;

  entries = entries.filter(e => e.id !== editingEntryId);
  closeModal();
  renderAll();
  await saveBoxEntries();
  showToast('Eintrag gelöscht.');
});

// 5. CSV Export
exportCsvBtn.addEventListener('click', () => {
  if (!entries.length) {
    showToast('Keine Einträge für den Export vorhanden.');
    return;
  }

  const sorted = [...entries].sort((a,b) => a.odometer - b.odometer);
  let csv = 'ID;Datum;Typ;Kilometerstand;Menge_Liter_kWh;Kosten_EUR;Zweck;Notizen\n';

  sorted.forEach(e => {
    csv += `"${e.id}";"${e.date}";"${e.type}";"${e.odometer}";"${e.amount || 0}";"${(e.cost || 0).toFixed(2)}";"${(e.purpose || '').replace(/"/g, '""')}";"${(e.notes || '').replace(/"/g, '""')}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VehicleLog_Export_${new Date().toISOString().slice(0, 10)}.csv`;
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
    renderEntries();
  });
});

entrySearch.addEventListener('input', renderEntries);

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
