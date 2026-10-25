'use strict';

/**
 * ShareNotes – sticky notes with an edit dialog. With the permission "files"
 * every note is a JSON file in "notes" of the user's personal folder on the
 * box (ShareOS.fs); without it they stay in the browser (localStorage).
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const NOTES_FOLDER = 'notes';
let boxRootName = null;
let notes = [];
let activeCreatorColor = '#202124';
let currentEditingNote = null;

const creator = document.getElementById('note-creator');
const titleInput = document.getElementById('new-title');
const contentInput = document.getElementById('new-content');
const creatorFooter = document.getElementById('creator-footer');
const notesGrid = document.getElementById('notes-grid');
const searchInput = document.getElementById('search-input');
const storageStatus = document.getElementById('storage-status');

// edit dialog
const editModal = document.getElementById('edit-modal');
const modalDialog = document.getElementById('modal-dialog');
const editTitleInput = document.getElementById('edit-title');
const editContentInput = document.getElementById('edit-content');
const modalSaveBtn = document.getElementById('modal-save-btn');
const modalDeleteBtn = document.getElementById('modal-delete-btn');

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

function showBanner(text) {
  const b = document.getElementById('banner');
  b.textContent = text;
  b.classList.remove('hidden');
}

// 1. ShareOS.fs: the personal folder and its "notes" folder
async function initBoxFS() {
  if (!FS) {
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box: Der Administrator kann ihn unter Benutzer → „Dateien“ für dein Konto einschalten. Notizen werden im Browser gespeichert.');
    }
    loadFallbackNotes();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', NOTES_FOLDER).catch(err => {
        if (err.message !== 'already exists') console.warn('mkdir notes:', err.message);
      });

      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${NOTES_FOLDER}/`;
      await loadBoxNotes();
    } else {
      showBanner('Für dein Konto gibt es auf der Box weder einen persönlichen Ordner noch eine Freigabe. Notizen werden im Browser-Speicher abgelegt.');
      loadFallbackNotes();
    }
  } catch (e) {
    console.error('ShareNotes: FS.roots() failed:', e);
    showToast(`Box-Fehler: ${e.message}`);
    loadFallbackNotes();
  }
}

// 2. load the notes from the box
async function loadBoxNotes() {
  try {
    const res = await FS.list(boxRootName, NOTES_FOLDER);
    const entries = res.entries || [];
    const jsonFiles = entries.filter(e => e.type === 'file' && e.name.endsWith('.json'));

    notes = [];
    for (const file of jsonFiles) {
      try {
        const fileHandle = await FS.open(boxRootName, NOTES_FOLDER, file.name);
        const text = await (await fileHandle.blob()).text();
        const parsed = JSON.parse(text);
        parsed._fileName = file.name;
        notes.push(parsed);
      } catch (err) {
        console.warn(`ShareNotes: cannot read ${file.name}:`, err);
      }
    }

    notes.sort((a, b) => (b.id || 0) - (a.id || 0));
    renderNotes();
  } catch (e) {
    showToast(`Fehler beim Laden von der Box: ${e.message}`);
    loadFallbackNotes();
  }
}

// 3. save / update a note on the box
async function saveNoteToBox(note) {
  if (!FS || !boxRootName) {
    saveFallbackNotes();
    return;
  }

  const fileName = note._fileName || `note_${note.id}.json`;
  note._fileName = fileName;

  try {
    const fileHandle = await FS.open(boxRootName, NOTES_FOLDER, fileName, { write: true, create: true });
    const blob = new Blob([JSON.stringify(note, null, 2)], { type: 'application/json' });
    await fileHandle.save(blob);

    if (SOS && SOS.emit) {
      SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${NOTES_FOLDER}/${fileName}`, name: fileName });
    }
  } catch (e) {
    showToast(`Speichern fehlgeschlagen: ${e.message}`);
  }
}

// 4. delete a note on the box
async function deleteNoteFromBox(note) {
  if (!FS || !boxRootName) {
    saveFallbackNotes();
    return;
  }

  const fileName = note._fileName || `note_${note.id}.json`;
  try {
    await FS.remove(boxRootName, NOTES_FOLDER, [fileName]);
    showToast('Notiz gelöscht.');
  } catch (e) {
    showToast(`Löschen fehlgeschlagen: ${e.message}`);
  }
}

// fallback: browser storage
function loadFallbackNotes() {
  storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
  const key = `shareos_notes_${user}`;
  notes = JSON.parse(localStorage.getItem(key)) || [
    {
      id: 1,
      title: 'Willkommen bei ShareNotes!',
      content: 'Klicke auf mich! Jetzt öffnet sich das Google-Keep-Fenster, in dem du mich bearbeiten oder umfärben kannst.',
      color: '#614a19',
      date: new Date().toISOString().slice(0, 10)
    }
  ];
  renderNotes();
}

function saveFallbackNotes() {
  const key = `shareos_notes_${user}`;
  localStorage.setItem(key, JSON.stringify(notes));
}

// --- new note ---
contentInput.addEventListener('focus', () => {
  titleInput.classList.remove('hidden');
  creatorFooter.classList.remove('hidden');
  creator.classList.add('expanded');
});

document.querySelectorAll('#creator-palette .palette-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    document.querySelectorAll('#creator-palette .palette-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    activeCreatorColor = dot.dataset.color;
    creator.style.background = activeCreatorColor;
  });
});

document.getElementById('add-note-btn').addEventListener('click', async () => {
  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  if (!title && !content) {
    resetCreator();
    return;
  }

  const newNote = {
    id: Date.now(),
    title,
    content,
    color: activeCreatorColor,
    date: new Date().toISOString().slice(0, 10)
  };

  notes.unshift(newNote);
  renderNotes();
  resetCreator();

  await saveNoteToBox(newNote);
  showToast('Notiz erstellt.');
});

function resetCreator() {
  titleInput.value = '';
  contentInput.value = '';
  titleInput.classList.add('hidden');
  creatorFooter.classList.add('hidden');
  creator.classList.remove('expanded');
  activeCreatorColor = '#202124';
  creator.style.background = 'var(--sos-panel)';
  document.querySelectorAll('#creator-palette .palette-dot').forEach(d => d.classList.remove('active'));
  document.querySelector('#creator-palette .palette-dot[data-color="#202124"]').classList.add('active');
}

// --- open and edit a note (dialog) ---
function openNoteInModal(note) {
  currentEditingNote = note;
  editTitleInput.value = note.title || '';
  editContentInput.value = note.content || '';
  modalDialog.style.background = note.color || '#202124';

  // mark the note's colour in the palette
  document.querySelectorAll('#edit-palette .palette-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.color === (note.color || '#202124'));
  });

  editModal.classList.remove('hidden');
  editContentInput.focus();
}

async function closeAndSaveModal() {
  if (!currentEditingNote) return;

  const newTitle = editTitleInput.value.trim();
  const newContent = editContentInput.value.trim();

  currentEditingNote.title = newTitle;
  currentEditingNote.content = newContent;
  currentEditingNote.date = new Date().toISOString().slice(0, 10);

  editModal.classList.add('hidden');
  renderNotes();

  await saveNoteToBox(currentEditingNote);
  currentEditingNote = null;
  showToast('Änderungen gespeichert.');
}

// palette in the dialog
document.querySelectorAll('#edit-palette .palette-dot').forEach(dot => {
  dot.addEventListener('click', () => {
    if (!currentEditingNote) return;
    document.querySelectorAll('#edit-palette .palette-dot').forEach(d => d.classList.remove('active'));
    dot.classList.add('active');
    currentEditingNote.color = dot.dataset.color;
    modalDialog.style.background = currentEditingNote.color;
  });
});

modalSaveBtn.addEventListener('click', closeAndSaveModal);

modalDeleteBtn.addEventListener('click', async () => {
  if (!currentEditingNote) return;
  const toDelete = currentEditingNote;
  notes = notes.filter(x => x.id !== toDelete.id);
  editModal.classList.add('hidden');
  currentEditingNote = null;
  renderNotes();
  await deleteNoteFromBox(toDelete);
});

// a click on the dimmed background closes the dialog too
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeAndSaveModal();
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !editModal.classList.contains('hidden')) {
    closeAndSaveModal();
  }
});

// --- cards and search ---
function renderNotes() {
  const query = searchInput.value.trim().toLowerCase();
  notesGrid.innerHTML = '';

  const filtered = notes.filter(n =>
    (n.title || '').toLowerCase().includes(query) || (n.content || '').toLowerCase().includes(query)
  );

  document.getElementById('notes-count').textContent = `${notes.length} Notiz(en)`;

  filtered.forEach(n => {
    const card = document.createElement('div');
    card.className = 'note-card';
    if (n.color) card.style.background = n.color;

    card.innerHTML = `
      ${n.title ? `<div class="note-card-title">${escapeHTML(n.title)}</div>` : ''}
      <div class="note-card-content">${escapeHTML(n.content)}</div>
      <div class="note-card-footer">
        <span>${n.date}</span>
        <button class="del-note-btn" title="Löschen" data-id="${n.id}">🗑</button>
      </div>
    `;

    // a click on the card opens the note in the dialog
    card.addEventListener('click', (e) => {
      if (e.target.closest('.del-note-btn')) return; // not when the bin was clicked
      openNoteInModal(n);
    });

    card.querySelector('.del-note-btn').addEventListener('click', async (e) => {
      e.stopPropagation();
      notes = notes.filter(x => x.id !== n.id);
      renderNotes();
      await deleteNoteFromBox(n);
    });

    notesGrid.appendChild(card);
  });
}

searchInput.addEventListener('input', renderNotes);

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initBoxFS();
