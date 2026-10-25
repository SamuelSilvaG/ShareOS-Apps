'use strict';

/**
 * PackList - Smarte Reise- & Checklisten
 * Speichert Checklisten unter checklists/lists.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const CHECKLIST_DIR = 'checklists';
const LIST_FILE = 'lists.json';
let boxRootName = null;

let allLists = [];
let activeListId = null;

// UI Elements
const listSelector = document.getElementById('list-selector');
const newListBtn = document.getElementById('new-list-btn');
const resetChecksBtn = document.getElementById('reset-checks-btn');

const activeListTitle = document.getElementById('active-list-title');
const progressStats = document.getElementById('progress-stats');
const progressFill = document.getElementById('progress-fill');

const quickAddForm = document.getElementById('quick-add-form');
const newItemInput = document.getElementById('new-item-input');
const newItemCategory = document.getElementById('new-item-category');

const categoriesContainer = document.getElementById('categories-container');
const emptyState = document.getElementById('empty-state');
const storageStatus = document.getElementById('storage-status');
const listCounterStats = document.getElementById('list-counter-stats');

// Modal Elements
const listModal = document.getElementById('list-modal');
const closeModalX = document.getElementById('close-modal-x');
const cancelListBtn = document.getElementById('cancel-list-btn');
const createListForm = document.getElementById('create-list-form');
const fListName = document.getElementById('f-list-name');
const fListTemplate = document.getElementById('f-list-template');

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

// 1. Initialisierung von ShareOS.fs
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadFallbackLists();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', CHECKLIST_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${CHECKLIST_DIR}/${LIST_FILE}`;
      await loadBoxLists();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackLists();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackLists();
  }
}

async function loadBoxLists() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, CHECKLIST_DIR, LIST_FILE);
    const text = await (await handle.blob()).text();
    allLists = JSON.parse(text);
  } catch (_) {
    createDefaultTravelList();
    await saveBoxLists();
  }

  renderListSelector();
  renderActiveList();
}

async function saveBoxLists() {
  localStorage.setItem(`packlist_${user}`, JSON.stringify(allLists));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, CHECKLIST_DIR, LIST_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(allLists, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${CHECKLIST_DIR}/${LIST_FILE}`, name: LIST_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackLists() {
  const raw = localStorage.getItem(`packlist_${user}`);
  if (raw) {
    try { allLists = JSON.parse(raw); } catch (_) {}
  }
  if (!allLists || !allLists.length) {
    createDefaultTravelList();
  }
  renderListSelector();
  renderActiveList();
}

function createDefaultTravelList() {
  allLists = [
    {
      id: 'travel-default',
      name: '✈️ Sommerurlaub & Reisen',
      items: [
        { id: 1, text: 'Reisepass / Personalausweis', category: 'Dokumente & Geld', done: true },
        { id: 2, text: 'Krankenversicherungskarte & Auslandsschutz', category: 'Dokumente & Geld', done: false },
        { id: 3, text: 'Kreditkarte / Notfall-Bargeld', category: 'Dokumente & Geld', done: false },
        { id: 4, text: 'Smartphone & USB-C Ladekabel', category: 'Elektronik & Kabel', done: true },
        { id: 5, text: 'Powerbank (im Handgepäck)', category: 'Elektronik & Kabel', done: false },
        { id: 6, text: 'Reiseadapter / Steckdosenleiste', category: 'Elektronik & Kabel', done: false },
        { id: 7, text: 'T-Shirts & kurze Hosen', category: 'Kleidung', done: false },
        { id: 8, text: 'Badesachen & Strandtuch', category: 'Kleidung', done: false },
        { id: 9, text: 'Zahnbürste & Zahnpasta', category: 'Hygiene & Apotheke', done: false },
        { id: 10, text: 'Sonnencreme & Mückenschutz', category: 'Hygiene & Apotheke', done: false },
        { id: 11, text: 'Erste-Hilfe-Set & Schmerzmittel', category: 'Hygiene & Apotheke', done: false }
      ]
    }
  ];
  activeListId = 'travel-default';
}

// 2. Rendering
function renderListSelector() {
  listSelector.innerHTML = '';
  if (!allLists.length) return;

  if (!activeListId || !allLists.find(l => l.id === activeListId)) {
    activeListId = allLists[0].id;
  }

  allLists.forEach(l => {
    const opt = document.createElement('option');
    opt.value = l.id;
    opt.textContent = l.name;
    opt.selected = (l.id === activeListId);
    listSelector.appendChild(opt);
  });

  listCounterStats.textContent = `${allLists.length} Liste(n) verfügbar`;
}

function renderActiveList() {
  const list = allLists.find(l => l.id === activeListId);
  categoriesContainer.innerHTML = '';

  if (!list || !list.items.length) {
    emptyState.classList.remove('hidden');
    activeListTitle.textContent = list ? list.name : 'Keine Liste';
    updateProgress(0, 0);
    return;
  }
  emptyState.classList.add('hidden');
  activeListTitle.textContent = list.name;

  // Items nach Kategorien gruppieren
  const groups = {};
  list.items.forEach(item => {
    const cat = item.category || 'Sonstiges';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(item);
  });

  let totalItems = list.items.length;
  let doneItems = list.items.filter(i => i.done).length;
  updateProgress(doneItems, totalItems);

  Object.keys(groups).forEach(catName => {
    const items = groups[catName];
    const catDone = items.filter(i => i.done).length;

    const groupEl = document.createElement('div');
    groupEl.className = 'category-group';
    groupEl.innerHTML = `
      <div class="category-header">
        <span class="category-name">${escapeHTML(catName)}</span>
        <span class="category-badge">${catDone} / ${items.length}</span>
      </div>
      <div class="items-list"></div>
    `;

    const itemsListEl = groupEl.querySelector('.items-list');
    items.forEach(item => {
      const row = document.createElement('div');
      row.className = `item-row ${item.done ? 'checked' : ''}`;
      row.innerHTML = `
        <div class="item-left">
          <input type="checkbox" class="item-checkbox" ${item.done ? 'checked' : ''}>
          <span class="item-text">${escapeHTML(item.text)}</span>
        </div>
        <button class="item-del-btn" title="Löschen">✕</button>
      `;

      // Checkbox Toggle
      const cb = row.querySelector('.item-checkbox');
      const toggleDone = async () => {
        item.done = !item.done;
        cb.checked = item.done;
        row.classList.toggle('checked', item.done);
        await saveBoxLists();
        renderActiveList();
      };

      row.addEventListener('click', (e) => {
        if (e.target.closest('.item-del-btn')) return;
        toggleDone();
      });

      // Löschen
      row.querySelector('.item-del-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        list.items = list.items.filter(i => i.id !== item.id);
        await saveBoxLists();
        renderActiveList();
        showToast('Eintrag gelöscht.');
      });

      itemsListEl.appendChild(row);
    });

    categoriesContainer.appendChild(groupEl);
  });
}

function updateProgress(done, total) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  progressStats.textContent = `${done} von ${total} eingepackt (${pct}%)`;
  progressFill.style.width = `${pct}%`;
  progressFill.style.background = pct === 100 ? '#10b981' : (pct > 50 ? '#f59e0b' : '#38bdf8');
}

// 3. Neue Items hinzufügen
quickAddForm.addEventListener('submit', async () => {
  const text = newItemInput.value.trim();
  const category = newItemCategory.value;
  if (!text) return;

  const list = allLists.find(l => l.id === activeListId);
  if (!list) return;

  list.items.push({
    id: Date.now(),
    text,
    category,
    done: false
  });

  newItemInput.value = '';
  await saveBoxLists();
  renderActiveList();
  showToast('Gegenstand hinzugefügt!');
});

// 4. Liste wechseln
listSelector.addEventListener('change', () => {
  activeListId = listSelector.value;
  renderActiveList();
});

// 5. Reset Checkmarks
resetChecksBtn.addEventListener('click', async () => {
  const list = allLists.find(l => l.id === activeListId);
  if (!list || !list.items.length) return;

  if (!confirm(`Möchtest du alle Haken bei '${list.name}' für die nächste Reise zurücksetzen?`)) return;

  list.items.forEach(i => i.done = false);
  await saveBoxLists();
  renderActiveList();
  showToast('Liste erfolgreich zurückgesetzt!');
});

// 6. Neue Liste Modal & Vorlagen
newListBtn.addEventListener('click', () => {
  fListName.value = '';
  listModal.classList.remove('hidden');
  fListName.focus();
});

function closeModal() {
  listModal.classList.add('hidden');
}

closeModalX.addEventListener('click', closeModal);
cancelListBtn.addEventListener('click', closeModal);
listModal.addEventListener('click', (e) => {
  if (e.target === listModal) closeModal();
});

createListForm.addEventListener('submit', async () => {
  const name = fListName.value.trim();
  const tmpl = fListTemplate.value;
  if (!name) return;

  let items = [];
  if (tmpl === 'travel') {
    items = [
      { id: 1, text: 'Reisepass / Ausweis', category: 'Dokumente & Geld', done: false },
      { id: 2, text: 'Flug-/Bahntickets', category: 'Dokumente & Geld', done: false },
      { id: 3, text: 'Smartphone & Ladekabel', category: 'Elektronik & Kabel', done: false },
      { id: 4, text: 'Kopfhörer', category: 'Elektronik & Kabel', done: false },
      { id: 5, text: 'Kleidung für Reisezeitraum', category: 'Kleidung', done: false },
      { id: 6, text: 'Kulturbeutel & Zahnbürste', category: 'Hygiene & Apotheke', done: false }
    ];
  } else if (tmpl === 'camping') {
    items = [
      { id: 1, text: 'Zelt, Heringe & Gummihammer', category: 'Outdoor & Sonstiges', done: false },
      { id: 2, text: 'Schlafsack & Isomatte', category: 'Outdoor & Sonstiges', done: false },
      { id: 3, text: 'Gaskocher & Geschirr', category: 'Outdoor & Sonstiges', done: false },
      { id: 4, text: 'Taschenlampe / Stirnlampe', category: 'Elektronik & Kabel', done: false },
      { id: 5, text: 'Taschenmesser / Multi-Tool', category: 'Outdoor & Sonstiges', done: false },
      { id: 6, text: 'Wanderschuhe & Regenjacke', category: 'Kleidung', done: false }
    ];
  } else if (tmpl === 'tech') {
    items = [
      { id: 1, text: 'Laptop & Netzteil', category: 'Elektronik & Kabel', done: false },
      { id: 2, text: 'Maus & USB-Hub', category: 'Elektronik & Kabel', done: false },
      { id: 3, text: 'Powerbank & Ladekabel', category: 'Elektronik & Kabel', done: false },
      { id: 4, text: 'YubiKey / 2FA-Token', category: 'Dokumente & Geld', done: false },
      { id: 5, text: 'VPN-Zugangsdaten bereit', category: 'Dokumente & Geld', done: false }
    ];
  }

  const newList = {
    id: 'list_' + Date.now(),
    name,
    items
  };

  allLists.push(newList);
  activeListId = newList.id;

  closeModal();
  await saveBoxLists();
  renderListSelector();
  renderActiveList();
  showToast(`Liste '${name}' angelegt!`);
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
