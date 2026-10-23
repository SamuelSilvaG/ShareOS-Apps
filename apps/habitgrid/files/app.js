'use strict';

/**
 * HabitGrid - Gewohnheiten & Routine Tracker
 * Speichert Daten unter habits/habits.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const HABITS_DIR = 'habits';
const HABITS_FILE = 'habits.json';
let boxRootName = null;

let currentDate = new Date();
let habits = [];
let activeCategory = 'all';
let editingHabitId = null;

// UI Elements
const monthDisplay = document.getElementById('month-display');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const openAddBtn = document.getElementById('open-add-btn');
const refreshBtn = document.getElementById('refresh-btn');
const habitsList = document.getElementById('habits-list');
const emptyState = document.getElementById('empty-state');
const storageStatus = document.getElementById('storage-status');
const globalStats = document.getElementById('global-stats');

const countAll = document.getElementById('count-all');
const countHealth = document.getElementById('count-health');
const countProd = document.getElementById('count-prod');
const countMind = document.getElementById('count-mind');

// Modal Elements
const habitModal = document.getElementById('habit-modal');
const modalHeading = document.getElementById('modal-heading');
const habitForm = document.getElementById('habit-form');
const fName = document.getElementById('f-name');
const fIcon = document.getElementById('f-icon');
const fCat = document.getElementById('f-cat');
const fColor = document.getElementById('f-color');
const fTarget = document.getElementById('f-target');
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

// 1. Initialisierung von ShareOS.fs
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadFallbackHabits();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', HABITS_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${HABITS_DIR}/${HABITS_FILE}`;
      await loadBoxHabits();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackHabits();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackHabits();
  }
}

async function loadBoxHabits() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, HABITS_DIR, HABITS_FILE);
    const text = await (await handle.blob()).text();
    habits = JSON.parse(text);
  } catch (_) {
    createDefaultHabits();
    await saveBoxHabits();
  }
  renderAll();
}

async function saveBoxHabits() {
  localStorage.setItem(`habits_${user}`, JSON.stringify(habits));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, HABITS_DIR, HABITS_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(habits, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${HABITS_DIR}/${HABITS_FILE}`, name: HABITS_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackHabits() {
  const raw = localStorage.getItem(`habits_${user}`);
  if (raw) {
    try { habits = JSON.parse(raw); } catch (_) {}
  }
  if (!habits || !habits.length) {
    createDefaultHabits();
  }
  renderAll();
}

function createDefaultHabits() {
  const todayStr = new Date().toISOString().slice(0, 10);
  habits = [
    {
      id: 1,
      name: '2 Liter Wasser trinken',
      icon: '💧',
      category: 'Gesundheit',
      color: '#0ea5e9',
      targetDays: 7,
      history: { [todayStr]: true }
    },
    {
      id: 2,
      name: '30 Minuten Fokus & Lesen',
      icon: '📚',
      category: 'Produktivität',
      color: '#10b981',
      targetDays: 5,
      history: { [todayStr]: true }
    },
    {
      id: 3,
      name: 'Abendliche Meditation & Dehnen',
      icon: '🧘',
      category: 'Achtsamkeit',
      color: '#8b5cf6',
      targetDays: 7,
      history: {}
    }
  ];
}

// 2. Streaks berechnen
function calculateStreak(history) {
  let streak = 0;
  let checkDate = new Date();

  // Falls heute noch nicht erledigt ist, ab gestern prüfen
  const todayKey = checkDate.toISOString().slice(0, 10);
  if (!history[todayKey]) {
    checkDate.setDate(checkDate.getDate() - 1);
  }

  while (true) {
    const key = checkDate.toISOString().slice(0, 10);
    if (history[key]) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// 3. Rendering
function renderAll() {
  updateMonthHeader();
  renderCounts();
  renderHabits();
}

function updateMonthHeader() {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  monthDisplay.textContent = `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
}

function renderCounts() {
  countAll.textContent = habits.length;
  countHealth.textContent = habits.filter(h => h.category === 'Gesundheit').length;
  countProd.textContent = habits.filter(h => h.category === 'Produktivität').length;
  countMind.textContent = habits.filter(h => h.category === 'Achtsamkeit').length;
  globalStats.textContent = `${habits.length} Gewohnheit(en) aktiv`;
}

function renderHabits() {
  habitsList.innerHTML = '';

  const filtered = habits.filter(h => {
    if (activeCategory !== 'all' && h.category !== activeCategory) return false;
    return true;
  });

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = new Date().toISOString().slice(0, 10);

  filtered.forEach(habit => {
    const streak = calculateStreak(habit.history || {});
    const card = document.createElement('div');
    card.className = 'habit-card';

    card.innerHTML = `
      <div class="card-header-row">
        <div class="habit-meta">
          <div class="habit-icon-badge">${escapeHTML(habit.icon || '🌱')}</div>
          <div class="habit-title-box">
            <span class="habit-title">${escapeHTML(habit.name)}</span>
            <span class="habit-category-tag">${escapeHTML(habit.category)} • ${habit.targetDays || 7}x / Woche</span>
          </div>
        </div>
        <div class="habit-streak-box">
          <span class="streak-pill">🔥 ${streak} Tage</span>
          <button class="habit-action-btn edit-btn" title="Bearbeiten">✏️</button>
        </div>
      </div>

      <div class="heatmap-container">
        <div class="heatmap-grid" id="grid-${habit.id}"></div>
      </div>
    `;

    const gridEl = card.querySelector(`#grid-${habit.id}`);

    // Zellen für den Monat generieren (1..Tage im Monat)
    for (let day = 1; day <= daysInMonth; day++) {
      const pad = n => String(n).padStart(2, '0');
      const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
      const isDone = Boolean(habit.history && habit.history[dateKey]);

      const cell = document.createElement('div');
      cell.className = `day-cell ${dateKey === todayKey ? 'today' : ''}`;
      cell.title = `${dateKey}: ${isDone ? 'Erledigt' : 'Offen'}`;

      if (isDone) {
        cell.style.background = habit.color || 'var(--sos-accent)';
      }

      cell.addEventListener('click', async () => {
        if (!habit.history) habit.history = {};
        if (habit.history[dateKey]) {
          delete habit.history[dateKey];
        } else {
          habit.history[dateKey] = true;
        }
        await saveBoxHabits();
        renderAll();
      });

      gridEl.appendChild(cell);
    }

    card.querySelector('.edit-btn').addEventListener('click', () => {
      openModal(habit);
    });

    habitsList.appendChild(card);
  });
}

// 4. Modal Logik
function openModal(habit = null) {
  editingHabitId = habit ? habit.id : null;
  modalHeading.textContent = habit ? 'Gewohnheit bearbeiten' : 'Neue Gewohnheit anlegen';

  fName.value = habit ? habit.name : '';
  fIcon.value = habit ? habit.icon : '🌱';
  fCat.value = habit ? habit.category : 'Gesundheit';
  fColor.value = habit ? habit.color : '#10b981';
  fTarget.value = habit ? habit.targetDays : 7;

  modalDeleteBtn.classList.toggle('hidden', !habit);
  habitModal.classList.remove('hidden');
  fName.focus();
}

function closeModal() {
  habitModal.classList.add('hidden');
  editingHabitId = null;
  habitForm.reset();
}

openAddBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
habitModal.addEventListener('click', (e) => {
  if (e.target === habitModal) closeModal();
});

habitForm.addEventListener('submit', async () => {
  const name = fName.value.trim();
  const icon = fIcon.value.trim() || '🌱';
  const category = fCat.value;
  const color = fColor.value;
  const targetDays = parseInt(fTarget.value, 10) || 7;

  if (!name) return;

  if (editingHabitId) {
    const h = habits.find(x => x.id === editingHabitId);
    if (h) {
      h.name = name;
      h.icon = icon;
      h.category = category;
      h.color = color;
      h.targetDays = targetDays;
    }
    showToast('Gewohnheit aktualisiert.');
  } else {
    habits.push({
      id: Date.now(),
      name,
      icon,
      category,
      color,
      targetDays,
      history: {}
    });
    showToast('Gewohnheit hinzugefügt!');
  }

  closeModal();
  renderAll();
  await saveBoxHabits();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingHabitId) return;
  if (!confirm('Diese Gewohnheit wirklich löschen?')) return;

  habits = habits.filter(h => h.id !== editingHabitId);
  closeModal();
  renderAll();
  await saveBoxHabits();
  showToast('Gewohnheit gelöscht.');
});

// 5. Navigation & Filter
prevMonthBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  renderAll();
});

nextMonthBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  renderAll();
});

document.querySelectorAll('#category-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#category-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeCategory = btn.dataset.cat;
    renderHabits();
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
