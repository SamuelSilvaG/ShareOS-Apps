'use strict';

/**
 * ExpenseTracker - Mobiles Haushaltsbuch & Budget-Manager
 * Speichert Buchungen monatsweise unter finances/YYYY-MM.json via ShareOS.fs
 * Mit praktischem CSV-Export für SheetOS / Excel.
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const FINANCES_DIR = 'finances';
let boxRootName = null;

let currentMonthDate = new Date();
let transactions = [];
let activeCategory = 'all';
let currentType = 'expense'; // 'expense' or 'income'
let editingTxId = null;

const catIcons = {
  'Lebensmittel': '🛒',
  'Restaurant': '☕',
  'Transport': '🚆',
  'Wohnen': '🏠',
  'Freizeit': '🎮',
  'Gehalt': '💼',
  'Sonstiges': '📦'
};

// UI Elements
const currentMonthLabel = document.getElementById('current-month-label');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');

const sumIncome = document.getElementById('sum-income');
const sumExpense = document.getElementById('sum-expense');
const sumBalance = document.getElementById('sum-balance');

const transactionsList = document.getElementById('transactions-list');
const emptyState = document.getElementById('empty-state');
const expenseSearch = document.getElementById('expense-search');
const storageStatus = document.getElementById('storage-status');
const entryStats = document.getElementById('entry-stats');

const openAddBtn = document.getElementById('open-add-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');

// Modal Elements
const entryModal = document.getElementById('entry-modal');
const modalHeading = document.getElementById('modal-heading');
const entryForm = document.getElementById('entry-form');
const typeExpBtn = document.getElementById('type-exp-btn');
const typeIncBtn = document.getElementById('type-inc-btn');
const fAmount = document.getElementById('f-amount');
const fDate = document.getElementById('f-date');
const fDesc = document.getElementById('f-desc');
const fCategory = document.getElementById('f-category');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const closeModalX = document.getElementById('close-modal-x');

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function showBanner(text) {
  const b = document.getElementById('banner');
  b.textContent = text;
  b.classList.remove('hidden');
}

function getMonthKey(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function formatCurrency(val) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(val);
}

// 1. Storage & ShareOS.fs Setup
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box. Administrator kann „Dateien“ unter Benutzer aktivieren.');
    }
    loadLocalTransactions();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', FINANCES_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${FINANCES_DIR}/`;
      await loadBoxTransactions();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadLocalTransactions();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadLocalTransactions();
  }
}

async function loadBoxTransactions() {
  if (!FS || !boxRootName) return;

  const monthKey = getMonthKey(currentMonthDate);
  const fileName = `${monthKey}.json`;

  try {
    const handle = await FS.open(boxRootName, FINANCES_DIR, fileName);
    const text = await (await handle.blob()).text();
    transactions = JSON.parse(text);
  } catch (_) {
    transactions = [];
  }
  renderDashboard();
}

async function saveBoxTransactions() {
  const monthKey = getMonthKey(currentMonthDate);
  const fileName = `${monthKey}.json`;

  localStorage.setItem(`expenses_${user}_${monthKey}`, JSON.stringify(transactions));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, FINANCES_DIR, fileName, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(transactions, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${FINANCES_DIR}/${fileName}`, name: fileName });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadLocalTransactions() {
  const monthKey = getMonthKey(currentMonthDate);
  const raw = localStorage.getItem(`expenses_${user}_${monthKey}`);
  transactions = raw ? JSON.parse(raw) : [];
  renderDashboard();
}

// 2. Rendering
function renderDashboard() {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  currentMonthLabel.textContent = `${months[currentMonthDate.getMonth()]} ${currentMonthDate.getFullYear()}`;

  // Berechne Summen
  let inc = 0;
  let exp = 0;

  transactions.forEach(t => {
    if (t.type === 'income') inc += t.amount;
    else exp += t.amount;
  });

  const bal = inc - exp;
  sumIncome.textContent = `+${formatCurrency(inc)}`;
  sumExpense.textContent = `-${formatCurrency(exp)}`;
  sumBalance.textContent = formatCurrency(bal);

  renderList();
}

function renderList() {
  const query = expenseSearch.value.trim().toLowerCase();
  transactionsList.innerHTML = '';

  let filtered = transactions.filter(t => {
    if (activeCategory !== 'all' && t.category !== activeCategory) return false;
    if (query) {
      return (t.desc || '').toLowerCase().includes(query) ||
             (t.category || '').toLowerCase().includes(query);
    }
    return true;
  });

  entryStats.textContent = `${filtered.length} von ${transactions.length} Buchungen`;

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  // Sortiere nach Datum absteigend
  filtered.sort((a,b) => b.date.localeCompare(a.date));

  filtered.forEach(t => {
    const row = document.createElement('div');
    row.className = 'trans-row';

    const icon = catIcons[t.category] || '📦';
    const isExp = t.type === 'expense';
    const amountStr = `${isExp ? '-' : '+'}${formatCurrency(t.amount)}`;

    row.innerHTML = `
      <div class="trans-left">
        <div class="cat-icon-badge">${icon}</div>
        <div class="trans-details">
          <span class="trans-desc">${escapeHTML(t.desc)}</span>
          <span class="trans-meta">${escapeHTML(t.category)} • ${t.date}</span>
        </div>
      </div>
      <div class="trans-right">
        <span class="trans-amount ${isExp ? 'expense' : 'income'}">${amountStr}</span>
        <button class="del-inline-btn" title="Löschen">🗑</button>
      </div>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.del-inline-btn')) return;
      openModal(t);
    });

    row.querySelector('.del-inline-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      transactions = transactions.filter(x => x.id !== t.id);
      await saveBoxTransactions();
      renderDashboard();
      showToast('Buchung gelöscht.');
    });

    transactionsList.appendChild(row);
  });
}

// 3. Modal Handhabung
function openModal(item = null) {
  editingTxId = item ? item.id : null;
  modalHeading.textContent = item ? 'Buchung bearbeiten' : 'Neue Buchung erfassen';

  currentType = item ? item.type : 'expense';
  updateTypeToggle();

  fAmount.value = item ? item.amount : '';
  fDate.value = item ? item.date : new Date().toISOString().slice(0, 10);
  fDesc.value = item ? item.desc : '';
  fCategory.value = item ? item.category : (currentType === 'income' ? 'Gehalt' : 'Lebensmittel');

  modalDeleteBtn.classList.toggle('hidden', !item);
  entryModal.classList.remove('hidden');
  fAmount.focus();
}

function closeModal() {
  entryModal.classList.add('hidden');
  editingTxId = null;
  entryForm.reset();
}

function updateTypeToggle() {
  typeExpBtn.classList.toggle('active', currentType === 'expense');
  typeIncBtn.classList.toggle('active', currentType === 'income');
}

typeExpBtn.addEventListener('click', () => {
  currentType = 'expense';
  updateTypeToggle();
  if (fCategory.value === 'Gehalt') fCategory.value = 'Lebensmittel';
});

typeIncBtn.addEventListener('click', () => {
  currentType = 'income';
  updateTypeToggle();
  fCategory.value = 'Gehalt';
});

openAddBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

entryModal.addEventListener('click', (e) => {
  if (e.target === entryModal) closeModal();
});

entryForm.addEventListener('submit', async () => {
  const amount = parseFloat(fAmount.value);
  const date = fDate.value;
  const desc = fDesc.value.trim();
  const category = fCategory.value;

  if (isNaN(amount) || amount <= 0 || !date || !desc) {
    showToast('Bitte alle Felder korrekt ausfüllen.');
    return;
  }

  if (editingTxId) {
    const item = transactions.find(x => x.id === editingTxId);
    if (item) {
      item.type = currentType;
      item.amount = amount;
      item.date = date;
      item.desc = desc;
      item.category = category;
    }
    showToast('Buchung aktualisiert.');
  } else {
    transactions.push({
      id: Date.now(),
      type: currentType,
      amount,
      date,
      desc,
      category
    });
    showToast('Buchung gespeichert!');
  }

  closeModal();
  await saveBoxTransactions();
  renderDashboard();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingTxId) return;
  transactions = transactions.filter(x => x.id !== editingTxId);
  closeModal();
  await saveBoxTransactions();
  renderDashboard();
  showToast('Buchung gelöscht.');
});

// Monats-Navigation
prevMonthBtn.addEventListener('click', () => {
  currentMonthDate.setMonth(currentMonthDate.getMonth() - 1);
  if (FS && boxRootName) loadBoxTransactions();
  else loadLocalTransactions();
});

nextMonthBtn.addEventListener('click', () => {
  currentMonthDate.setMonth(currentMonthDate.getMonth() + 1);
  if (FS && boxRootName) loadBoxTransactions();
  else loadLocalTransactions();
});

// Kategorien-Filter Klicks
document.querySelectorAll('.cat-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    renderList();
  });
});

expenseSearch.addEventListener('input', renderList);

// 4. CSV Export für SheetOS / Excel
exportCsvBtn.addEventListener('click', () => {
  if (!transactions.length) {
    showToast('Keine Buchungen zum Exportieren vorhanden.');
    return;
  }

  let csv = 'Datum;Typ;Kategorie;Beschreibung;Betrag\r\n';
  transactions.forEach(t => {
    const typLabel = t.type === 'income' ? 'Einnahme' : 'Ausgabe';
    const betragStr = t.amount.toFixed(2).replace('.', ',');
    csv += `${t.date};${typLabel};"${t.category}";"${t.desc.replace(/"/g, '""')}";${betragStr}\r\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ausgaben_${getMonthKey(currentMonthDate)}.csv`;
  a.click();
  showToast('CSV-Datei erfolgreich heruntergeladen!');
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
