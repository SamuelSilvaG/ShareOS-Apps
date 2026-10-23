'use strict';

/**
 * DailyLog - Persönliches Tagebuch & Bullet Journal
 * Speichert Tageseinträge als Markdown-Dateien unter daily_notes/YYYY-MM-DD.md via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const DIARY_DIR = 'daily_notes';
let boxRootName = null;

let selectedDate = new Date();
let calCurrentMonth = new Date();
let saveTimeout = null;
let currentDayMood = '';

const currentDateDisplay = document.getElementById('current-date-display');
const entryEditor = document.getElementById('entry-editor');
const saveIndicator = document.getElementById('save-indicator');
const storageStatus = document.getElementById('storage-status');
const wordCountEl = document.getElementById('word-count');

const prevDayBtn = document.getElementById('prev-day-btn');
const nextDayBtn = document.getElementById('next-day-btn');
const todayBtn = document.getElementById('today-btn');

const calMonthTitle = document.getElementById('cal-month-title');
const calDaysGrid = document.getElementById('cal-days-grid');
const calPrevMonth = document.getElementById('cal-prev-month');
const calNextMonth = document.getElementById('cal-next-month');
const historyList = document.getElementById('history-list');

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

function formatDateISO(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

function formatDateDisplay(d) {
  const days = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const todayISO = formatDateISO(new Date());
  const curISO = formatDateISO(d);

  const prefix = todayISO === curISO ? 'Heute, ' : '';
  return `${prefix}${days[d.getDay()]}, ${d.getDate()}. ${months[d.getMonth()]} ${d.getFullYear()}`;
}

// 1. Initialisierung von Box-Dateisystem
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box. Administrator kann „Dateien“ unter Benutzer aktivieren.');
    }
    loadEntry();
    renderCalendar();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', DIARY_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${DIARY_DIR}/`;
      await loadEntry();
      renderCalendar();
      updateHistory();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadEntry();
      renderCalendar();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadEntry();
    renderCalendar();
  }
}

// 2. Eintrag laden
async function loadEntry() {
  const fileName = `${formatDateISO(selectedDate)}.md`;
  currentDateDisplay.textContent = formatDateDisplay(selectedDate);

  saveIndicator.textContent = 'Lade...';
  saveIndicator.style.color = 'var(--sos-muted)';

  let content = '';

  if (FS && boxRootName) {
    try {
      const fileHandle = await FS.open(boxRootName, DIARY_DIR, fileName);
      content = await (await fileHandle.blob()).text();
    } catch (_) {
      content = '';
    }
  } else {
    content = localStorage.getItem(`dailylog_${user}_${formatDateISO(selectedDate)}`) || '';
  }

  // Parse Mood if present on first line
  currentDayMood = '';
  document.querySelectorAll('.mood-btn').forEach(btn => btn.classList.remove('active'));

  if (content.startsWith('<!-- MOOD:')) {
    const endIdx = content.indexOf('-->');
    if (endIdx > 0) {
      currentDayMood = content.slice(10, endIdx).trim();
      content = content.slice(endIdx + 3).trimStart();
      const matchBtn = document.querySelector(`.mood-btn[data-mood="${currentDayMood}"]`);
      if (matchBtn) matchBtn.classList.add('active');
    }
  }

  entryEditor.value = content;
  saveIndicator.textContent = 'Gespeichert';
  saveIndicator.style.color = 'var(--sos-success)';
  updateStats();
}

// 3. Eintrag speichern (mit Debounce)
function triggerAutoSave() {
  saveIndicator.textContent = 'Speichere...';
  saveIndicator.style.color = '#f59e0b';
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveCurrentEntry, 800);
  updateStats();
}

async function saveCurrentEntry() {
  const fileName = `${formatDateISO(selectedDate)}.md`;
  let text = entryEditor.value;

  if (currentDayMood) {
    text = `<!-- MOOD: ${currentDayMood} -->\n` + text;
  }

  if (FS && boxRootName) {
    try {
      const fileHandle = await FS.open(boxRootName, DIARY_DIR, fileName, { write: true, create: true });
      await fileHandle.save(new Blob([text], { type: 'text/markdown' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${DIARY_DIR}/${fileName}`, name: fileName });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  } else {
    localStorage.setItem(`dailylog_${user}_${formatDateISO(selectedDate)}`, text);
  }

  saveIndicator.textContent = 'Gespeichert';
  saveIndicator.style.color = 'var(--sos-success)';
  renderCalendar();
  updateHistory();
}

// 4. Statistiken
function updateStats() {
  const text = entryEditor.value.trim();
  const chars = text.length;
  const words = text ? text.split(/\s+/).length : 0;
  wordCountEl.textContent = `${words} Wörter • ${chars} Zeichen`;
}

entryEditor.addEventListener('input', triggerAutoSave);

// 5. Navigation
prevDayBtn.addEventListener('click', () => {
  selectedDate.setDate(selectedDate.getDate() - 1);
  loadEntry();
  renderCalendar();
});

nextDayBtn.addEventListener('click', () => {
  selectedDate.setDate(selectedDate.getDate() + 1);
  loadEntry();
  renderCalendar();
});

todayBtn.addEventListener('click', () => {
  selectedDate = new Date();
  calCurrentMonth = new Date();
  loadEntry();
  renderCalendar();
});

// 6. Kalender Logik
function renderCalendar() {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  calMonthTitle.textContent = `${months[calCurrentMonth.getMonth()]} ${calCurrentMonth.getFullYear()}`;

  calDaysGrid.innerHTML = '';

  const y = calCurrentMonth.getFullYear();
  const m = calCurrentMonth.getMonth();

  const firstDayIndex = (new Date(y, m, 1).getDay() + 6) % 7; // Monday = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'cal-day empty';
    calDaysGrid.appendChild(emptyDiv);
  }

  const selectedISO = formatDateISO(selectedDate);

  for (let d = 1; d <= daysInMonth; d++) {
    const dayBtn = document.createElement('div');
    dayBtn.className = 'cal-day';
    dayBtn.textContent = d;

    const dayDate = new Date(y, m, d);
    const dayISO = formatDateISO(dayDate);

    if (dayISO === selectedISO) {
      dayBtn.classList.add('active');
    }

    dayBtn.addEventListener('click', () => {
      selectedDate = dayDate;
      loadEntry();
      renderCalendar();
    });

    calDaysGrid.appendChild(dayBtn);
  }
}

calPrevMonth.addEventListener('click', () => {
  calCurrentMonth.setMonth(calCurrentMonth.getMonth() - 1);
  renderCalendar();
});

calNextMonth.addEventListener('click', () => {
  calCurrentMonth.setMonth(calCurrentMonth.getMonth() + 1);
  renderCalendar();
});

// 7. Letzte Einträge History
async function updateHistory() {
  if (FS && boxRootName) {
    try {
      const res = await FS.list(boxRootName, DIARY_DIR);
      const entries = (res.entries || [])
        .filter(e => e.type === 'file' && /^\d{4}-\d{2}-\d{2}\.md$/.test(e.name))
        .map(e => e.name.replace('.md', ''))
        .sort((a,b) => b.localeCompare(a))
        .slice(0, 7);

      renderHistoryList(entries);
    } catch (_) {}
  }
}

function renderHistoryList(days) {
  historyList.innerHTML = '';
  days.forEach(iso => {
    const item = document.createElement('div');
    item.className = `hist-item ${iso === formatDateISO(selectedDate) ? 'active' : ''}`;
    item.textContent = `📅 ${iso}`;
    item.addEventListener('click', () => {
      const [y, m, d] = iso.split('-').map(Number);
      selectedDate = new Date(y, m - 1, d);
      calCurrentMonth = new Date(y, m - 1, 1);
      loadEntry();
      renderCalendar();
    });
    historyList.appendChild(item);
  });
}

// 8. Mood Picker & Snippets
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDayMood = btn.dataset.mood;
    triggerAutoSave();
    showToast(`Stimmung gesetzt: ${currentDayMood}`);
  });
});

document.querySelectorAll('.snippet-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const snippet = btn.dataset.snippet;
    const start = entryEditor.selectionStart;
    const val = entryEditor.value;
    entryEditor.value = val.slice(0, start) + snippet + val.slice(start);
    entryEditor.selectionStart = entryEditor.selectionEnd = start + snippet.length;
    entryEditor.focus();
    triggerAutoSave();
  });
});

// 9. Format Toolbar
document.querySelectorAll('.tb-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const fmt = btn.dataset.format;
    const start = entryEditor.selectionStart;
    const end = entryEditor.selectionEnd;
    const val = entryEditor.value;
    const sel = val.slice(start, end);

    let insert = '';
    if (fmt === 'h1') insert = `\n# ${sel || 'Überschrift'}\n`;
    if (fmt === 'h2') insert = `\n## ${sel || 'Unterüberschrift'}\n`;
    if (fmt === 'bold') insert = `**${sel || 'fett'}**`;
    if (fmt === 'italic') insert = `*${sel || 'kursiv'}*`;
    if (fmt === 'task') insert = `\n- [ ] ${sel || 'Aufgabe'}\n`;
    if (fmt === 'bullet') insert = `\n- ${sel || 'Listenpunkt'}\n`;
    if (fmt === 'quote') insert = `\n> ${sel || 'Zitat'}\n`;

    entryEditor.value = val.slice(0, start) + insert + val.slice(end);
    entryEditor.focus();
    triggerAutoSave();
  });
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
