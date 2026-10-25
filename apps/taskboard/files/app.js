'use strict';

/**
 * TaskBoard - Kanban Board für Projekte & To-Dos
 * Unterstützt HTML5 Drag & Drop und Speicherung unter kanban/board.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const KANBAN_DIR = 'kanban';
const KANBAN_FILE = 'board.json';
let boxRootName = null;

let tasks = [
  { id: 1, title: 'OpenVPN Daemon auf NAS einrichten', desc: 'Tunnel-Interface prüfen und Profile erzeugen.', status: 'done', priority: 'high', tags: ['vpn', 'network'] },
  { id: 2, title: 'PhotoDrop testen', desc: 'Urlaubsfotos von unterwegs hochladen und Monatsordner kontrollieren.', status: 'inprogress', priority: 'medium', tags: ['fotos', 'cloud'] },
  { id: 3, title: 'Passwörter in ShareVault migrieren', desc: 'Alte KeePass/Bitwarden Zugangsdaten importieren.', status: 'todo', priority: 'high', tags: ['security'] },
  { id: 4, title: 'DailyLog Journal ausprobieren', desc: 'Erkenntnisse und Ziele für den Tag aufschreiben.', status: 'backlog', priority: 'low', tags: ['journal'] }
];

let editingTaskId = null;
let draggedTaskId = null;

// UI Elements
const searchInput = document.getElementById('board-search');
const openNewTaskBtn = document.getElementById('open-new-task-btn');
const refreshBoardBtn = document.getElementById('refresh-board-btn');
const storageStatus = document.getElementById('storage-status');
const boardStats = document.getElementById('board-stats');

const countBacklog = document.getElementById('count-backlog');
const countTodo = document.getElementById('count-todo');
const countInprogress = document.getElementById('count-inprogress');
const countDone = document.getElementById('count-done');

const colBacklog = document.getElementById('col-backlog');
const colTodo = document.getElementById('col-todo');
const colInprogress = document.getElementById('col-inprogress');
const colDone = document.getElementById('col-done');

const taskModal = document.getElementById('task-modal');
const modalHeading = document.getElementById('modal-heading');
const taskForm = document.getElementById('task-form');
const tTitle = document.getElementById('t-title');
const tStatus = document.getElementById('t-status');
const tPriority = document.getElementById('t-priority');
const tTags = document.getElementById('t-tags');
const tDesc = document.getElementById('t-desc');
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

// 1. Storage & ShareOS.fs Setup
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box. Administrator kann „Dateien“ unter Benutzer aktivieren.');
    }
    loadLocalBoard();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', KANBAN_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${KANBAN_DIR}/${KANBAN_FILE}`;
      await loadBoxBoard();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadLocalBoard();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadLocalBoard();
  }
}

async function loadBoxBoard() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, KANBAN_DIR, KANBAN_FILE);
    const text = await (await handle.blob()).text();
    tasks = JSON.parse(text);
  } catch (_) {
    await saveBoxBoard();
  }
  renderBoard();
}

async function saveBoxBoard() {
  localStorage.setItem(`taskboard_${user}`, JSON.stringify(tasks));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, KANBAN_DIR, KANBAN_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${KANBAN_DIR}/${KANBAN_FILE}`, name: KANBAN_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadLocalBoard() {
  const raw = localStorage.getItem(`taskboard_${user}`);
  if (raw) {
    try { tasks = JSON.parse(raw); } catch (_) {}
  }
  renderBoard();
}

// 2. Board Rendern
function renderBoard() {
  const query = searchInput.value.trim().toLowerCase();

  colBacklog.innerHTML = '';
  colTodo.innerHTML = '';
  colInprogress.innerHTML = '';
  colDone.innerHTML = '';

  let filtered = tasks.filter(t => {
    if (!query) return true;
    return (t.title || '').toLowerCase().includes(query) ||
           (t.desc || '').toLowerCase().includes(query) ||
           (t.tags || []).some(tag => tag.toLowerCase().includes(query));
  });

  const counts = { backlog: 0, todo: 0, inprogress: 0, done: 0 };

  filtered.forEach(task => {
    counts[task.status] = (counts[task.status] || 0) + 1;
    const card = createTaskCard(task);

    if (task.status === 'backlog') colBacklog.appendChild(card);
    else if (task.status === 'todo') colTodo.appendChild(card);
    else if (task.status === 'inprogress') colInprogress.appendChild(card);
    else if (task.status === 'done') colDone.appendChild(card);
  });

  countBacklog.textContent = counts.backlog;
  countTodo.textContent = counts.todo;
  countInprogress.textContent = counts.inprogress;
  countDone.textContent = counts.done;

  boardStats.textContent = `${tasks.length} Aufgaben insgesamt`;
}

function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  card.draggable = true;
  card.dataset.id = task.id;

  const priorityLabel = task.priority === 'high' ? 'Hoch' : (task.priority === 'low' ? 'Niedrig' : 'Normal');
  const priorityClass = `p-${task.priority || 'medium'}`;

  const tagsHtml = (task.tags || []).map(t => `<span class="tag-badge">#${escapeHTML(t)}</span>`).join('');

  card.innerHTML = `
    <div class="card-top">
      <span class="card-title">${escapeHTML(task.title)}</span>
      <span class="priority-pill ${priorityClass}">${priorityLabel}</span>
    </div>
    ${task.desc ? `<div class="card-desc">${escapeHTML(task.desc)}</div>` : ''}
    <div class="card-bottom">
      <div class="card-tags">${tagsHtml}</div>
    </div>
  `;

  // Drag Events
  card.addEventListener('dragstart', (e) => {
    draggedTaskId = task.id;
    card.classList.add('dragging');
    e.dataTransfer.setData('text/plain', String(task.id));
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    draggedTaskId = null;
    document.querySelectorAll('.cards-container').forEach(c => c.classList.remove('drag-over'));
  });

  // Edit on Click
  card.addEventListener('click', () => openModal(task));

  return card;
}

// 3. Drag & Drop Listener auf Spalten
document.querySelectorAll('.kanban-column').forEach(col => {
  const container = col.querySelector('.cards-container');
  const status = col.dataset.status;

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    container.classList.add('drag-over');
  });

  container.addEventListener('dragleave', () => {
    container.classList.remove('drag-over');
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('drag-over');

    const idStr = e.dataTransfer.getData('text/plain') || draggedTaskId;
    const task = tasks.find(t => String(t.id) === String(idStr));
    if (task && task.status !== status) {
      task.status = status;
      renderBoard();
      await saveBoxBoard();
      showToast(`Aufgabe nach '${col.querySelector('.col-title').textContent}' verschoben.`);
    }
  });
});

// Quick Add Knöpfe
document.querySelectorAll('.quick-add-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    openModal(null, btn.dataset.target);
  });
});

// 4. Modal Logik
function openModal(task = null, defaultStatus = 'todo') {
  editingTaskId = task ? task.id : null;
  modalHeading.textContent = task ? 'Aufgabe bearbeiten' : 'Neue Aufgabe erstellen';

  tTitle.value = task ? task.title : '';
  tStatus.value = task ? task.status : defaultStatus;
  tPriority.value = task ? (task.priority || 'medium') : 'medium';
  tTags.value = task ? (task.tags || []).join(', ') : '';
  tDesc.value = task ? task.desc : '';

  modalDeleteBtn.classList.toggle('hidden', !task);
  taskModal.classList.remove('hidden');
  tTitle.focus();
}

function closeModal() {
  taskModal.classList.add('hidden');
  editingTaskId = null;
  taskForm.reset();
}

openNewTaskBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

taskModal.addEventListener('click', (e) => {
  if (e.target === taskModal) closeModal();
});

taskForm.addEventListener('submit', async () => {
  const title = tTitle.value.trim();
  if (!title) return;

  const status = tStatus.value;
  const priority = tPriority.value;
  const tags = tTags.value.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);
  const desc = tDesc.value.trim();

  if (editingTaskId) {
    const t = tasks.find(x => x.id === editingTaskId);
    if (t) {
      t.title = title;
      t.status = status;
      t.priority = priority;
      t.tags = tags;
      t.desc = desc;
    }
    showToast('Aufgabe aktualisiert.');
  } else {
    tasks.push({
      id: Date.now(),
      title,
      status,
      priority,
      tags,
      desc
    });
    showToast('Aufgabe hinzugefügt!');
  }

  closeModal();
  renderBoard();
  await saveBoxBoard();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingTaskId) return;
  if (!confirm('Diese Aufgabe wirklich löschen?')) return;

  tasks = tasks.filter(t => t.id !== editingTaskId);
  closeModal();
  renderBoard();
  await saveBoxBoard();
  showToast('Aufgabe gelöscht.');
});

searchInput.addEventListener('input', renderBoard);
refreshBoardBtn.addEventListener('click', () => {
  initStorage();
  showToast('Aktualisiert.');
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
