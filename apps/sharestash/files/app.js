'use strict';

/**
 * ShareStash - Pocket / Raindrop Bookmark- & Read-Later Manager
 * Persistiert Lesezeichen auf der Box unter bookmarks/ via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const BOOKMARKS_DIR = 'bookmarks';
const MAIN_FILE = 'bookmarks.json';
let boxRootName = null;

let bookmarks = [];
let activeFilter = 'all'; // all, unread, archive
let activeTag = null;
let editingId = null;

// Elements
const linksList = document.getElementById('links-list');
const emptyState = document.getElementById('empty-state');
const searchInput = document.getElementById('search-input');
const tagsCloud = document.getElementById('tags-cloud');
const storageStatus = document.getElementById('storage-status');

const countAll = document.getElementById('count-all');
const countUnread = document.getElementById('count-unread');
const countArchive = document.getElementById('count-archive');

const modalBackdrop = document.getElementById('modal-backdrop');
const modalTitle = document.getElementById('modal-title');
const linkForm = document.getElementById('link-form');
const fUrl = document.getElementById('f-url');
const fTitle = document.getElementById('f-title');
const fTags = document.getElementById('f-tags');
const fNotes = document.getElementById('f-notes');
const modalDeleteBtn = document.getElementById('modal-delete-btn');

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

function extractDomain(urlStr) {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch (_) {
    return 'link';
  }
}

// 1. Storage & ShareOS.fs Setup
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box: Der Administrator kann ihn unter Benutzer → „Dateien“ für dein Konto aktivieren.');
    }
    loadFallbackBookmarks();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', BOOKMARKS_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${BOOKMARKS_DIR}/${MAIN_FILE}`;
      await loadBoxBookmarks();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackBookmarks();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackBookmarks();
  }
}

// 2. Lesezeichen von der Box laden
async function loadBoxBookmarks() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, BOOKMARKS_DIR, MAIN_FILE);
    const text = await (await handle.blob()).text();
    bookmarks = JSON.parse(text);
  } catch (_) {
    // Noch keine Datei vorhanden -> Default-Einträge
    bookmarks = [
      {
        id: Date.now(),
        url: 'https://github.com/UniqueDroid/ShareOS-Apps',
        title: 'ShareOS Apps Repository auf GitHub',
        tags: ['shareos', 'dev', 'opensource'],
        notes: 'Offizielles App-Repository mit allen Web-Apps und System-Tools für die Box.',
        unread: false,
        archived: false,
        date: new Date().toISOString().slice(0, 10)
      }
    ];
    await saveBoxBookmarks();
  }

  renderAll();
}

async function saveBoxBookmarks() {
  localStorage.setItem(`sharestash_${user}`, JSON.stringify(bookmarks));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, BOOKMARKS_DIR, MAIN_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(bookmarks, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${BOOKMARKS_DIR}/${MAIN_FILE}`, name: MAIN_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackBookmarks() {
  const raw = localStorage.getItem(`sharestash_${user}`);
  if (raw) {
    try { bookmarks = JSON.parse(raw); } catch (_) { bookmarks = []; }
  } else {
    bookmarks = [
      {
        id: Date.now(),
        url: 'https://github.com/UniqueDroid/ShareOS-Apps',
        title: 'ShareOS Apps Repository auf GitHub',
        tags: ['shareos', 'dev'],
        notes: 'Offizielles App-Repository.',
        unread: false,
        archived: false,
        date: new Date().toISOString().slice(0, 10)
      }
    ];
  }
  renderAll();
}

// 3. UI Rendern
function renderAll() {
  renderCounts();
  renderTags();
  renderLinks();
}

function renderCounts() {
  countAll.textContent = bookmarks.filter(b => !b.archived).length;
  countUnread.textContent = bookmarks.filter(b => b.unread && !b.archived).length;
  countArchive.textContent = bookmarks.filter(b => b.archived).length;
}

function renderTags() {
  const tagsMap = new Map();
  bookmarks.filter(b => !b.archived).forEach(b => {
    (b.tags || []).forEach(t => {
      const clean = t.trim().toLowerCase();
      if (clean) tagsMap.set(clean, (tagsMap.get(clean) || 0) + 1);
    });
  });

  tagsCloud.innerHTML = '';
  if (!tagsMap.size) {
    tagsCloud.innerHTML = '<span style="font-size:11px; color:var(--sos-muted);">Keine Tags vergeben</span>';
    return;
  }

  Array.from(tagsMap.entries()).sort((a,b) => b[1] - a[1]).forEach(([tag, count]) => {
    const badge = document.createElement('span');
    badge.className = `tag-badge ${activeTag === tag ? 'active' : ''}`;
    badge.textContent = `#${tag} (${count})`;
    badge.addEventListener('click', () => {
      activeTag = activeTag === tag ? null : tag;
      renderAll();
    });
    tagsCloud.appendChild(badge);
  });
}

function renderLinks() {
  const query = searchInput.value.trim().toLowerCase();
  linksList.innerHTML = '';

  const filtered = bookmarks.filter(b => {
    // Status Filter
    if (activeFilter === 'unread' && (!b.unread || b.archived)) return false;
    if (activeFilter === 'archive' && !b.archived) return false;
    if (activeFilter === 'all' && b.archived) return false;

    // Tag Filter
    if (activeTag && !(b.tags || []).map(t => t.toLowerCase()).includes(activeTag)) return false;

    // Textsuche
    if (query) {
      const matchTitle = (b.title || '').toLowerCase().includes(query);
      const matchUrl = (b.url || '').toLowerCase().includes(query);
      const matchNotes = (b.notes || '').toLowerCase().includes(query);
      const matchTags = (b.tags || []).some(t => t.toLowerCase().includes(query));
      if (!matchTitle && !matchUrl && !matchNotes && !matchTags) return false;
    }

    return true;
  });

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(b => {
    const card = document.createElement('div');
    card.className = 'link-card';

    const tagsHtml = (b.tags || []).map(t => `<span class="tag-badge">#${escapeHTML(t)}</span>`).join('');
    const domain = extractDomain(b.url);

    card.innerHTML = `
      <div class="link-card-top">
        <div>
          <a href="${escapeHTML(b.url)}" target="_blank" rel="noopener noreferrer" class="link-card-title">
            <span>🔗</span>
            <span>${escapeHTML(b.title || b.url)}</span>
          </a>
          <span class="link-domain">${escapeHTML(domain)} • ${b.date}</span>
        </div>
      </div>
      ${b.notes ? `<div class="link-notes">${escapeHTML(b.notes)}</div>` : ''}
      <div class="link-card-bottom">
        <div class="link-tags">${tagsHtml}</div>
        <div class="link-actions">
          <button class="icon-action-btn toggle-read-btn">${b.unread ? '📖 Als gelesen markieren' : '👓 Ungelesen'}</button>
          <button class="icon-action-btn archive-btn">${b.archived ? '↩️ Wiederherstellen' : '📦 Archiv'}</button>
          <button class="icon-action-btn edit-btn">✏️</button>
        </div>
      </div>
    `;

    // Aktionen
    card.querySelector('.toggle-read-btn').addEventListener('click', async () => {
      b.unread = !b.unread;
      await saveBoxBookmarks();
      renderAll();
    });

    card.querySelector('.archive-btn').addEventListener('click', async () => {
      b.archived = !b.archived;
      await saveBoxBookmarks();
      renderAll();
      showToast(b.archived ? 'Archiviert.' : 'Wiederhergestellt.');
    });

    card.querySelector('.edit-btn').addEventListener('click', () => {
      openModal(b);
    });

    linksList.appendChild(card);
  });
}

// 4. Modal Handhabung
function openModal(item = null) {
  editingId = item ? item.id : null;
  modalTitle.textContent = item ? 'Lesezeichen bearbeiten' : 'Neues Lesezeichen';

  fUrl.value = item ? item.url : '';
  fTitle.value = item ? item.title : '';
  fTags.value = item ? (item.tags || []).join(', ') : '';
  fNotes.value = item ? item.notes : '';

  modalDeleteBtn.classList.toggle('hidden', !item);
  modalBackdrop.classList.remove('hidden');
  if (!item) fUrl.focus();
}

function closeModal() {
  modalBackdrop.classList.add('hidden');
  editingId = null;
  linkForm.reset();
}

document.getElementById('open-add-modal-btn').addEventListener('click', () => openModal());
document.getElementById('close-modal-x').addEventListener('click', closeModal);
document.getElementById('modal-cancel-btn').addEventListener('click', closeModal);

modalBackdrop.addEventListener('click', (e) => {
  if (e.target === modalBackdrop) closeModal();
});

linkForm.addEventListener('submit', async () => {
  let url = fUrl.value.trim();
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  let title = fTitle.value.trim();
  if (!title) title = extractDomain(url);

  const tags = fTags.value
    .split(',')
    .map(t => t.trim().replace(/^#/, ''))
    .filter(Boolean);

  const notes = fNotes.value.trim();

  if (editingId) {
    const item = bookmarks.find(b => b.id === editingId);
    if (item) {
      item.url = url;
      item.title = title;
      item.tags = tags;
      item.notes = notes;
    }
    showToast('Lesezeichen aktualisiert.');
  } else {
    bookmarks.unshift({
      id: Date.now(),
      url,
      title,
      tags,
      notes,
      unread: true,
      archived: false,
      date: new Date().toISOString().slice(0, 10)
    });
    showToast('Link gespeichert!');
  }

  closeModal();
  await saveBoxBookmarks();
  renderAll();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingId) return;
  if (!confirm('Dieses Lesezeichen wirklich löschen?')) return;

  bookmarks = bookmarks.filter(b => b.id !== editingId);
  closeModal();
  await saveBoxBookmarks();
  renderAll();
  showToast('Gelöscht.');
});

// Sidebar Filter Klicks
document.querySelectorAll('.filter-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeFilter = btn.dataset.filter;
    renderLinks();
  });
});

searchInput.addEventListener('input', renderLinks);

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
