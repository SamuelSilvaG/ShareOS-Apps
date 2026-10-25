'use strict';

/**
 * BoxScan - Mobiler Dokumenten-Scanner & Belegablage
 * Speichert Scans unter documents/YYYY/ via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const DOCS_BASE_DIR = 'documents';
let boxRootName = null;
let savedDocuments = [];

// Image processing state
let originalImage = null;
let rotationAngle = 0;
let currentFilter = 'bw'; // 'bw', 'gray', 'color'

// UI Elements
const cameraInput = document.getElementById('camera-input');
const fileInput = document.getElementById('file-input');
const editorSection = document.getElementById('editor-section');
const archiveSection = document.getElementById('archive-section');
const scanCanvas = document.getElementById('scan-canvas');
const ctx = scanCanvas.getContext('2d');
const docNameInput = document.getElementById('doc-name');
const cancelScanBtn = document.getElementById('cancel-scan-btn');
const saveDocBtn = document.getElementById('save-doc-btn');
const rotateLeftBtn = document.getElementById('rotate-left-btn');
const rotateRightBtn = document.getElementById('rotate-right-btn');

const docsGrid = document.getElementById('docs-grid');
const emptyState = document.getElementById('empty-state');
const docsCount = document.getElementById('docs-count');
const storageStatus = document.getElementById('storage-status');
const refreshDocsBtn = document.getElementById('refresh-docs-btn');

// Lightbox Elements
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxName = document.getElementById('lightbox-name');
const lightboxDownload = document.getElementById('lightbox-download');
const lightboxDelBtn = document.getElementById('lightbox-del-btn');
const lightboxClose = document.getElementById('lightbox-close');
let activeLightboxDoc = null;

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

function getYearFolder() {
  return `${DOCS_BASE_DIR}/${new Date().getFullYear()}`;
}

// 1. Initialisierung des Box-Dateisystems
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser-Cache (Fallback)`;
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box. Administrator kann „Dateien“ unter Benutzer aktivieren.');
    }
    loadFallbackDocs();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', DOCS_BASE_DIR).catch(() => {});
      const yFolder = getYearFolder().split('/')[1];
      await FS.mkdir(boxRootName, DOCS_BASE_DIR, yFolder).catch(() => {});

      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${getYearFolder()}/`;
      await loadBoxDocuments();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackDocs();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackDocs();
  }
}

// 2. Dokumente von der Box laden
async function loadBoxDocuments() {
  if (!FS || !boxRootName) return;

  const yFolder = getYearFolder();
  try {
    const res = await FS.list(boxRootName, yFolder);
    const entries = res.entries || [];
    const docFiles = entries.filter(e => e.type === 'file' && /\.(jpe?g|png|webp)$/i.test(e.name));

    savedDocuments = [];
    for (const f of docFiles) {
      try {
        const fileHandle = await FS.open(boxRootName, yFolder, f.name);
        const url = fileHandle.url || URL.createObjectURL(await fileHandle.blob());
        savedDocuments.push({
          name: f.name,
          url: url,
          rel: yFolder,
          mtime: f.mtime
        });
      } catch (e) {
        console.warn(`Fehler beim Öffnen von ${f.name}:`, e);
      }
    }

    savedDocuments.sort((a,b) => b.name.localeCompare(a.name));
    renderArchive();
  } catch (err) {
    console.warn('Dokumente auflisten fehlgeschlagen:', err);
    renderArchive();
  }
}

function renderArchive() {
  docsGrid.innerHTML = '';
  docsCount.textContent = `${savedDocuments.length} Dokument(e)`;

  if (!savedDocuments.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  savedDocuments.forEach(doc => {
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.innerHTML = `
      <img src="${doc.url}" alt="${escapeHTML(doc.name)}" class="doc-thumb" loading="lazy">
      <div class="doc-meta">
        <span class="doc-name">${escapeHTML(doc.name)}</span>
        <span class="doc-date">${doc.mtime ? new Date(doc.mtime * 1000).toLocaleDateString() : 'Gespeichert'}</span>
      </div>
    `;

    card.addEventListener('click', () => openLightbox(doc));
    docsGrid.appendChild(card);
  });
}

function loadFallbackDocs() {
  savedDocuments = [];
  renderArchive();
}

// 3. Bildverarbeitung & Scanner-Engine
function handleImageUpload(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      rotationAngle = 0;
      currentFilter = 'bw';

      const d = new Date();
      const pad = n => String(n).padStart(2, '0');
      docNameInput.value = `Scan_${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;

      document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'bw'));

      editorSection.classList.remove('hidden');
      archiveSection.classList.add('hidden');
      applyProcessing();
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

cameraInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
  e.target.value = '';
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files && e.target.files[0]) handleImageUpload(e.target.files[0]);
  e.target.value = '';
});

function applyProcessing() {
  if (!originalImage) return;

  // Canvas-Dimensionen an Rotation anpassen
  const isRotated = (rotationAngle % 180 !== 0);
  const width = isRotated ? originalImage.height : originalImage.width;
  const height = isRotated ? originalImage.width : originalImage.height;

  // Max Limit zur Performance
  const maxDim = 1600;
  let scale = 1;
  if (width > maxDim || height > maxDim) {
    scale = Math.min(maxDim / width, maxDim / height);
  }

  scanCanvas.width = width * scale;
  scanCanvas.height = height * scale;

  ctx.save();
  ctx.translate(scanCanvas.width / 2, scanCanvas.height / 2);
  ctx.rotate((rotationAngle * Math.PI) / 180);
  ctx.drawImage(
    originalImage,
    -((isRotated ? scanCanvas.height : scanCanvas.width) / 2),
    -((isRotated ? scanCanvas.width : scanCanvas.height) / 2),
    (isRotated ? scanCanvas.height : scanCanvas.width),
    (isRotated ? scanCanvas.width : scanCanvas.height)
  );
  ctx.restore();

  // Bildfilter anwenden
  if (currentFilter === 'color') return; // Unverändert

  const imgData = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    // Luminanz (Grauwert)
    const gray = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];

    if (currentFilter === 'gray') {
      d[i] = d[i+1] = d[i+2] = gray;
    } else if (currentFilter === 'bw') {
      // High-Contrast Adaptive B/W Thresholding für Belege
      const val = gray > 132 ? 255 : 0;
      d[i] = d[i+1] = d[i+2] = val;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// Rotation
rotateLeftBtn.addEventListener('click', () => {
  rotationAngle = (rotationAngle - 90 + 360) % 360;
  applyProcessing();
});
rotateRightBtn.addEventListener('click', () => {
  rotationAngle = (rotationAngle + 90) % 360;
  applyProcessing();
});

// Filter-Knöpfe
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    applyProcessing();
  });
});

cancelScanBtn.addEventListener('click', () => {
  originalImage = null;
  editorSection.classList.add('hidden');
  archiveSection.classList.remove('hidden');
});

// 4. Scan auf der Box speichern
saveDocBtn.addEventListener('click', () => {
  let name = docNameInput.value.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!name) name = 'Scan_' + Date.now();
  const filename = `${name}.jpg`;
  const yFolder = getYearFolder();

  scanCanvas.toBlob(async (blob) => {
    if (!blob) return;

    if (FS && boxRootName) {
      try {
        const handle = await FS.open(boxRootName, yFolder, filename, { write: true, create: true });
        await handle.save(blob);
        if (SOS && SOS.emit) {
          SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${yFolder}/${filename}`, name: filename });
        }
        showToast(`Beleg '${filename}' auf der Box gespeichert!`);
        await loadBoxDocuments();
      } catch (err) {
        showToast('Speichern fehlgeschlagen: ' + err.message);
      }
    } else {
      savedDocuments.unshift({
        name: filename,
        url: URL.createObjectURL(blob),
        rel: 'local',
        mtime: Math.floor(Date.now() / 1000)
      });
      renderArchive();
      showToast('Beleg im Cache gespeichert.');
    }

    editorSection.classList.add('hidden');
    archiveSection.classList.remove('hidden');
    originalImage = null;
  }, 'image/jpeg', 0.88);
});

// 5. Lightbox
function openLightbox(doc) {
  activeLightboxDoc = doc;
  lightboxImg.src = doc.url;
  lightboxName.textContent = doc.name;
  lightboxDownload.href = doc.url;
  lightboxDownload.download = doc.name;
  lightbox.classList.remove('hidden');
}

lightboxClose.addEventListener('click', () => lightbox.classList.add('hidden'));
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) lightbox.classList.add('hidden');
});

lightboxDelBtn.addEventListener('click', async () => {
  if (!activeLightboxDoc) return;
  if (!confirm(`Soll der Beleg '${activeLightboxDoc.name}' wirklich gelöscht werden?`)) return;

  const target = activeLightboxDoc;
  lightbox.classList.add('hidden');

  if (FS && boxRootName && target.rel !== 'local') {
    try {
      await FS.remove(boxRootName, target.rel, [target.name]);
      showToast('Dokument auf der Box gelöscht.');
      await loadBoxDocuments();
    } catch (e) {
      showToast('Löschen fehlgeschlagen: ' + e.message);
    }
  } else {
    savedDocuments = savedDocuments.filter(d => d !== target);
    renderArchive();
    showToast('Dokument entfernt.');
  }
});

refreshDocsBtn.addEventListener('click', () => {
  initStorage();
  showToast('Aktualisiert.');
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
