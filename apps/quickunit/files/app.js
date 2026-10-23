'use strict';

/**
 * QuickUnit - Offline Einheiten- & Währungsrechner
 * Unterstützt direkte 2-Wege-Umrechnung, Multi-Overview und ShareOS.fs Favoriten
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const UNITS_DIR = 'units';
const FAV_FILE = 'favorites.json';
let boxRootName = null;

let activeCategory = 'length';
let favorites = [];

// UI Elements
const selectFrom = document.getElementById('select-from');
const selectTo = document.getElementById('select-to');
const inputFrom = document.getElementById('input-from');
const inputTo = document.getElementById('input-to');
const formulaDisplay = document.getElementById('formula-display');
const swapBtn = document.getElementById('swap-btn');
const midSwapBtn = document.getElementById('mid-swap-btn');
const clearInputBtn = document.getElementById('clear-input-btn');
const copyResultBtn = document.getElementById('copy-result-btn');
const saveFavBtn = document.getElementById('save-fav-btn');
const refreshBtn = document.getElementById('refresh-btn');
const activeCatName = document.getElementById('active-cat-name');
const multiResultsGrid = document.getElementById('multi-results-grid');
const favsList = document.getElementById('favs-list');
const favsCountLabel = document.getElementById('favs-count-label');
const storageStatus = document.getElementById('storage-status');

// Einheiten-Definitionen & Umrechnungsbasen
const DEFINITIONS = {
  length: {
    label: 'Länge',
    base: 'm',
    units: {
      mm: { name: 'Millimeter (mm)', toBase: 0.001 },
      cm: { name: 'Zentimeter (cm)', toBase: 0.01 },
      m: { name: 'Meter (m)', toBase: 1 },
      km: { name: 'Kilometer (km)', toBase: 1000 },
      inch: { name: 'Zoll / Inch (in)', toBase: 0.0254 },
      ft: { name: 'Fuß / Feet (ft)', toBase: 0.3048 },
      yd: { name: 'Yard (yd)', toBase: 0.9144 },
      mi: { name: 'Meilen (mi)', toBase: 1609.344 },
      nm: { name: 'Seemeilen (NM)', toBase: 1852 }
    },
    defaultFrom: 'm',
    defaultTo: 'cm'
  },
  weight: {
    label: 'Masse & Gewicht',
    base: 'kg',
    units: {
      mg: { name: 'Milligramm (mg)', toBase: 0.000001 },
      g: { name: 'Gramm (g)', toBase: 0.001 },
      kg: { name: 'Kilogramm (kg)', toBase: 1 },
      t: { name: 'Tonne (t)', toBase: 1000 },
      oz: { name: 'Unzen (oz)', toBase: 0.0283495 },
      lb: { name: 'Pfund (lbs)', toBase: 0.45359237 }
    },
    defaultFrom: 'kg',
    defaultTo: 'lb'
  },
  data: {
    label: 'Daten & Speicher',
    base: 'B',
    units: {
      B: { name: 'Byte (B)', toBase: 1 },
      KB: { name: 'Kilobyte (KB - 1000)', toBase: 1e3 },
      MB: { name: 'Megabyte (MB - 1000²)', toBase: 1e6 },
      GB: { name: 'Gigabyte (GB - 1000³)', toBase: 1e9 },
      TB: { name: 'Terabyte (TB - 1000⁴)', toBase: 1e12 },
      KiB: { name: 'Kibibyte (KiB - 1024)', toBase: 1024 },
      MiB: { name: 'Mebibyte (MiB - 1024²)', toBase: 1048576 },
      GiB: { name: 'Gibibyte (GiB - 1024³)', toBase: 1073741824 },
      TiB: { name: 'Tebibyte (TiB - 1024⁴)', toBase: 1099511627776 }
    },
    defaultFrom: 'GB',
    defaultTo: 'GiB'
  },
  temp: {
    label: 'Temperatur',
    special: true,
    units: {
      C: { name: 'Grad Celsius (°C)' },
      F: { name: 'Grad Fahrenheit (°F)' },
      K: { name: 'Kelvin (K)' }
    },
    defaultFrom: 'C',
    defaultTo: 'F'
  },
  speed: {
    label: 'Geschwindigkeit',
    base: 'mps',
    units: {
      kmh: { name: 'km/h', toBase: 1 / 3.6 },
      mps: { name: 'm/s', toBase: 1 },
      mph: { name: 'Meilen/h (mph)', toBase: 0.44704 },
      knots: { name: 'Knoten (kn)', toBase: 0.514444 }
    },
    defaultFrom: 'kmh',
    defaultTo: 'mph'
  },
  pressure: {
    label: 'Druck & Reifen',
    base: 'bar',
    units: {
      bar: { name: 'Bar (bar)', toBase: 1 },
      psi: { name: 'PSI (lbs/in²)', toBase: 0.0689476 },
      kpa: { name: 'Kilopascal (kPa)', toBase: 0.01 },
      atm: { name: 'Phys. Atmosphäre (atm)', toBase: 1.01325 }
    },
    defaultFrom: 'bar',
    defaultTo: 'psi'
  },
  currency: {
    label: 'Währung (Offline Cache)',
    base: 'EUR',
    units: {
      EUR: { name: 'Euro (EUR €)', toBase: 1 },
      USD: { name: 'US Dollar (USD $)', toBase: 0.92 },
      CHF: { name: 'Schweizer Franken (CHF)', toBase: 1.05 },
      GBP: { name: 'Britisches Pfund (GBP £)', toBase: 1.17 },
      JPY: { name: 'Japanischer Yen (JPY ¥)', toBase: 0.0061 }
    },
    defaultFrom: 'EUR',
    defaultTo: 'USD'
  }
};

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
    loadFallbackFavs();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', UNITS_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${UNITS_DIR}/${FAV_FILE}`;
      await loadBoxFavs();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackFavs();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackFavs();
  }
}

async function loadBoxFavs() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, UNITS_DIR, FAV_FILE);
    const text = await (await handle.blob()).text();
    favorites = JSON.parse(text);
  } catch (_) {
    createDefaultFavs();
    await saveBoxFavs();
  }
  renderFavs();
}

async function saveBoxFavs() {
  localStorage.setItem(`quickunit_favs_${user}`, JSON.stringify(favorites));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, UNITS_DIR, FAV_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(favorites, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${UNITS_DIR}/${FAV_FILE}`, name: FAV_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackFavs() {
  const raw = localStorage.getItem(`quickunit_favs_${user}`);
  if (raw) {
    try { favorites = JSON.parse(raw); } catch (_) {}
  }
  if (!favorites || !favorites.length) {
    createDefaultFavs();
  }
  renderFavs();
}

function createDefaultFavs() {
  favorites = [
    { cat: 'pressure', from: 'bar', to: 'psi', name: 'Bar ➔ PSI (Reifendruck)' },
    { cat: 'data', from: 'GB', to: 'GiB', name: 'GB ➔ GiB (Dateigrößen)' },
    { cat: 'temp', from: 'C', to: 'F', name: '°C ➔ °F (US-Reisen)' }
  ];
}

// 2. Umrechnungslogik
function convert(val, fromKey, toKey, catKey) {
  if (isNaN(val)) return 0;
  const def = DEFINITIONS[catKey];
  if (!def) return 0;

  // Spezialfall Temperatur
  if (catKey === 'temp') {
    if (fromKey === toKey) return val;
    let celsius = val;
    if (fromKey === 'F') celsius = (val - 32) * (5 / 9);
    else if (fromKey === 'K') celsius = val - 273.15;

    if (toKey === 'C') return celsius;
    if (toKey === 'F') return (celsius * (9 / 5)) + 32;
    if (toKey === 'K') return celsius + 273.15;
    return 0;
  }

  // Reguläre Basiseinheiten
  const uFrom = def.units[fromKey];
  const uTo = def.units[toKey];
  if (!uFrom || !uTo) return 0;

  const baseVal = val * uFrom.toBase;
  return baseVal / uTo.toBase;
}

function formatResult(num) {
  if (Math.abs(num) >= 1e9 || (Math.abs(num) < 1e-4 && num !== 0)) {
    return num.toExponential(4);
  }
  // Max 6 Nachkommastellen ohne trailing zeros
  const rounded = parseFloat(num.toFixed(6));
  return String(rounded);
}

// 3. UI Updates
function populateSelects(catKey) {
  const def = DEFINITIONS[catKey];
  selectFrom.innerHTML = '';
  selectTo.innerHTML = '';

  Object.entries(def.units).forEach(([key, info]) => {
    const optFrom = document.createElement('option');
    optFrom.value = key;
    optFrom.textContent = info.name;
    selectFrom.appendChild(optFrom);

    const optTo = document.createElement('option');
    optTo.value = key;
    optTo.textContent = info.name;
    selectTo.appendChild(optTo);
  });

  selectFrom.value = def.defaultFrom;
  selectTo.value = def.defaultTo;
  activeCatName.textContent = def.label;
}

function calculate() {
  const val = parseFloat(inputFrom.value) || 0;
  const fromKey = selectFrom.value;
  const toKey = selectTo.value;

  const res = convert(val, fromKey, toKey, activeCategory);
  inputTo.value = formatResult(res);

  // Formelanzeige
  const single = convert(1, fromKey, toKey, activeCategory);
  formulaDisplay.textContent = `1 ${fromKey} = ${formatResult(single)} ${toKey}`;

  renderMultiOverview(val, fromKey);
}

function renderMultiOverview(val, fromKey) {
  multiResultsGrid.innerHTML = '';
  const def = DEFINITIONS[activeCategory];

  Object.keys(def.units).forEach(key => {
    if (key === fromKey) return;
    const res = convert(val, fromKey, key, activeCategory);

    const item = document.createElement('div');
    item.className = 'multi-item';
    item.innerHTML = `
      <span class="multi-unit">${escapeHTML(def.units[key].name)}</span>
      <span class="multi-val">${formatResult(res)}</span>
    `;

    item.addEventListener('click', () => {
      selectTo.value = key;
      calculate();
    });

    multiResultsGrid.appendChild(item);
  });
}

function renderFavs() {
  favsList.innerHTML = '';
  favsCountLabel.textContent = `${favorites.length} Favoriten`;

  favorites.forEach((fav, idx) => {
    const pill = document.createElement('div');
    pill.className = 'fav-pill';
    pill.innerHTML = `
      <span>⭐ ${escapeHTML(fav.name)}</span>
      <button class="fav-del-btn" title="Favorit entfernen">✕</button>
    `;

    pill.addEventListener('click', (e) => {
      if (e.target.closest('.fav-del-btn')) return;
      activeCategory = fav.cat;

      document.querySelectorAll('#category-filter-bar .filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === activeCategory);
      });

      populateSelects(activeCategory);
      selectFrom.value = fav.from;
      selectTo.value = fav.to;
      calculate();
      showToast(`'${fav.name}' aktiviert.`);
    });

    pill.querySelector('.fav-del-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      favorites.splice(idx, 1);
      await saveBoxFavs();
      renderFavs();
      showToast('Favorit entfernt.');
    });

    favsList.appendChild(pill);
  });
}

// 4. Events
function swap() {
  const tmp = selectFrom.value;
  selectFrom.value = selectTo.value;
  selectTo.value = tmp;
  calculate();
}

swapBtn.addEventListener('click', swap);
midSwapBtn.addEventListener('click', swap);

inputFrom.addEventListener('input', calculate);
selectFrom.addEventListener('change', calculate);
selectTo.addEventListener('change', calculate);

clearInputBtn.addEventListener('click', () => {
  inputFrom.value = '';
  inputTo.value = '0';
  inputFrom.focus();
});

copyResultBtn.addEventListener('click', () => {
  if (!inputTo.value) return;
  navigator.clipboard.writeText(inputTo.value);
  showToast(`Ergebnis '${inputTo.value}' kopiert!`);
});

saveFavBtn.addEventListener('click', async () => {
  const fromKey = selectFrom.value;
  const toKey = selectTo.value;
  const name = `${fromKey} ➔ ${toKey} (${DEFINITIONS[activeCategory].label})`;

  if (favorites.some(f => f.cat === activeCategory && f.from === fromKey && f.to === toKey)) {
    showToast('Dieser Favorit existiert bereits.');
    return;
  }

  favorites.push({ cat: activeCategory, from: fromKey, to: toKey, name });
  await saveBoxFavs();
  renderFavs();
  showToast('Zu Favoriten hinzugefügt!');
});

document.querySelectorAll('#category-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    populateSelects(activeCategory);
    calculate();
  });
});

refreshBtn.addEventListener('click', () => {
  initStorage();
  calculate();
  showToast('Aktualisiert.');
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

// Init
populateSelects(activeCategory);
calculate();
initStorage();
