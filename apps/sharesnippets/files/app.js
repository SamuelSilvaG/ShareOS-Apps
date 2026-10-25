'use strict';

/**
 * ShareSnippets - Code- & Textbaustein-Manager
 * Speichert Snippets unter snippets/snippets.json via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const SNIPPETS_DIR = 'snippets';
const SNIPPETS_FILE = 'snippets.json';
let boxRootName = null;

let snippets = [];
let activeLang = 'all';
let editingSnippetId = null;

// UI Elements
const searchInput = document.getElementById('search-input');
const openAddBtn = document.getElementById('open-add-btn');
const refreshBtn = document.getElementById('refresh-btn');
const snippetsGrid = document.getElementById('snippets-grid');
const emptyState = document.getElementById('empty-state');
const storageStatus = document.getElementById('storage-status');
const snippetsCount = document.getElementById('snippets-count');

// Modal Elements
const snippetModal = document.getElementById('snippet-modal');
const modalHeading = document.getElementById('modal-heading');
const snippetForm = document.getElementById('snippet-form');
const fTitle = document.getElementById('f-title');
const fLang = document.getElementById('f-lang');
const fTags = document.getElementById('f-tags');
const fCode = document.getElementById('f-code');
const fDesc = document.getElementById('f-desc');
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
    loadFallbackSnippets();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', SNIPPETS_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${SNIPPETS_DIR}/${SNIPPETS_FILE}`;
      await loadBoxSnippets();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackSnippets();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackSnippets();
  }
}

async function loadBoxSnippets() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, SNIPPETS_DIR, SNIPPETS_FILE);
    const text = await (await handle.blob()).text();
    snippets = JSON.parse(text);
  } catch (_) {
    createDefaultSnippets();
    await saveBoxSnippets();
  }
  renderSnippets();
}

async function saveBoxSnippets() {
  localStorage.setItem(`sharesnippets_${user}`, JSON.stringify(snippets));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, SNIPPETS_DIR, SNIPPETS_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(snippets, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${SNIPPETS_DIR}/${SNIPPETS_FILE}`, name: SNIPPETS_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackSnippets() {
  const raw = localStorage.getItem(`sharesnippets_${user}`);
  if (raw) {
    try { snippets = JSON.parse(raw); } catch (_) {}
  }
  if (!snippets || !snippets.length) {
    createDefaultSnippets();
  }
  renderSnippets();
}

function createDefaultSnippets() {
  snippets = [
    {
      id: 1,
      title: 'Docker System Prune',
      lang: 'docker',
      code: 'docker system prune -af --volumes',
      desc: 'Bereinigt alle unbenutzten Container, Images und Volumes auf dem Server.',
      tags: ['docker', 'clean', 'disk']
    },
    {
      id: 2,
      title: 'Git Letzten Commit widerrufen (Soft)',
      lang: 'git',
      code: 'git reset --soft HEAD~1',
      desc: 'Nimmt den Commit zurück, behält alle Dateiänderungen in der Staging-Area.',
      tags: ['git', 'undo', 'commit']
    },
    {
      id: 3,
      title: 'SSH Tunnel & Port-Forwarding',
      lang: 'bash',
      code: 'ssh -N -L 8080:localhost:80 user@shareos.box',
      desc: 'Leitet den Remote-Port 80 sicher auf den lokalen Port 8080 weiter.',
      tags: ['ssh', 'vpn', 'network']
    },
    {
      id: 4,
      title: 'Docker Compose Traefik & Nextcloud',
      lang: 'yaml',
      code: 'version: "3.8"\nservices:\n  app:\n    image: nextcloud:latest\n    restart: unless-stopped\n    environment:\n      - PUID=1000',
      desc: 'Basis-Vorlage für Self-Hosting Stacks.',
      tags: ['docker', 'compose', 'yaml']
    }
  ];
}

// 2. Rendering
function renderSnippets() {
  const query = searchInput.value.trim().toLowerCase();
  snippetsGrid.innerHTML = '';

  const filtered = snippets.filter(s => {
    if (activeLang !== 'all' && s.lang !== activeLang) return false;
    if (query) {
      const matchTitle = (s.title || '').toLowerCase().includes(query);
      const matchDesc = (s.desc || '').toLowerCase().includes(query);
      const matchCode = (s.code || '').toLowerCase().includes(query);
      const matchTags = (s.tags || []).some(t => t.toLowerCase().includes(query));
      if (!matchTitle && !matchDesc && !matchCode && !matchTags) return false;
    }
    return true;
  });

  snippetsCount.textContent = `${filtered.length} von ${snippets.length} Bausteine`;

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(s => {
    const card = document.createElement('div');
    card.className = 'snippet-card';

    const tagsHtml = (s.tags || []).map(t => `<span class="tag-pill">#${escapeHTML(t)}</span>`).join('');

    card.innerHTML = `
      <div class="snip-top">
        <div class="snip-title-area">
          <span class="snip-title">${escapeHTML(s.title)}</span>
          ${s.desc ? `<span class="snip-desc">${escapeHTML(s.desc)}</span>` : ''}
        </div>
        <span class="lang-badge">${escapeHTML(s.lang)}</span>
      </div>

      <div class="code-container">
        <pre class="code-block"><code>${escapeHTML(s.code)}</code></pre>
      </div>

      <div class="snip-bottom">
        <div class="snip-tags">${tagsHtml}</div>
        <div class="snip-actions">
          <button class="action-btn edit-snip-btn" title="Bearbeiten">✏️</button>
          <button class="action-btn copy-snip-btn" title="In Zwischenablage kopieren">📋 Kopieren</button>
        </div>
      </div>
    `;

    // Kopieren
    card.querySelector('.copy-snip-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(s.code);
      showToast(`'${s.title}' kopiert!`);
    });

    // Bearbeiten
    card.querySelector('.edit-snip-btn').addEventListener('click', () => {
      openModal(s);
    });

    snippetsGrid.appendChild(card);
  });
}

// 3. Modal Logik
function openModal(snippet = null) {
  editingSnippetId = snippet ? snippet.id : null;
  modalHeading.textContent = snippet ? 'Snippet bearbeiten' : 'Neues Snippet erstellen';

  fTitle.value = snippet ? snippet.title : '';
  fLang.value = snippet ? snippet.lang : 'bash';
  fTags.value = snippet ? (snippet.tags || []).join(', ') : '';
  fCode.value = snippet ? snippet.code : '';
  fDesc.value = snippet ? snippet.desc : '';

  modalDeleteBtn.classList.toggle('hidden', !snippet);
  snippetModal.classList.remove('hidden');
  fTitle.focus();
}

function closeModal() {
  snippetModal.classList.add('hidden');
  editingSnippetId = null;
  snippetForm.reset();
}

openAddBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);

snippetModal.addEventListener('click', (e) => {
  if (e.target === snippetModal) closeModal();
});

snippetForm.addEventListener('submit', async () => {
  const title = fTitle.value.trim();
  const lang = fLang.value;
  const tags = fTags.value.split(',').map(s => s.trim().replace(/^#/, '')).filter(Boolean);
  const code = fCode.value.trim();
  const desc = fDesc.value.trim();

  if (!title || !code) return;

  if (editingSnippetId) {
    const s = snippets.find(x => x.id === editingSnippetId);
    if (s) {
      s.title = title;
      s.lang = lang;
      s.tags = tags;
      s.code = code;
      s.desc = desc;
    }
    showToast('Snippet aktualisiert.');
  } else {
    snippets.unshift({
      id: Date.now(),
      title,
      lang,
      tags,
      code,
      desc
    });
    showToast('Snippet gespeichert!');
  }

  closeModal();
  renderSnippets();
  await saveBoxSnippets();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingSnippetId) return;
  if (!confirm('Dieses Snippet wirklich unwiderruflich löschen?')) return;

  snippets = snippets.filter(s => s.id !== editingSnippetId);
  closeModal();
  renderSnippets();
  await saveBoxSnippets();
  showToast('Snippet gelöscht.');
});

// 4. Filter Klicks
document.querySelectorAll('#lang-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#lang-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeLang = btn.dataset.lang;
    renderSnippets();
  });
});

searchInput.addEventListener('input', renderSnippets);
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
