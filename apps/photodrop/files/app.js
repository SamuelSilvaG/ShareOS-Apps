'use strict';

/**
 * PhotoDrop - Mobiler Foto-Upload und Galerie auf die Box via ShareOS.fs
 * - Ordner: photos/YYYY-MM/
 * - Direkter Upload von Bildern (JPEG, PNG, WebP)
 * - Lightbox-Vorschau und Löschfunktion
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

let boxRootName = null;
let currentPhotos = [];
let activeLightboxPhoto = null;

const galleryGrid = document.getElementById('gallery-grid');
const emptyGallery = document.getElementById('empty-gallery');
const photoCount = document.getElementById('photo-count');
const storageStatus = document.getElementById('storage-status');
const dropzone = document.getElementById('dropzone');
const filePicker = document.getElementById('file-picker');
const refreshBtn = document.getElementById('refresh-btn');

const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxFilename = document.getElementById('lightbox-filename');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxDelBtn = document.getElementById('lightbox-del-btn');

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

function getMonthFolder() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `photos/${year}-${month}`;
}

// 1. Storage & Box Initialisierung
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser-Cache (Fallback)`;
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box. Administrator kann „Dateien“ unter Benutzer aktivieren.');
    }
    loadFallbackPhotos();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      // Ensure 'photos' and 'photos/YYYY-MM' exist
      await FS.mkdir(boxRootName, '', 'photos').catch(() => {});
      const monthRel = getMonthFolder();
      const parts = monthRel.split('/');
      await FS.mkdir(boxRootName, parts[0], parts[1]).catch(() => {});

      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${monthRel}/`;
      await loadBoxPhotos();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackPhotos();
    }
  } catch (err) {
    console.error('FS init error:', err);
    loadFallbackPhotos();
  }
}

// 2. Fotos von der Box laden
async function loadBoxPhotos() {
  if (!FS || !boxRootName) return;

  const monthFolder = getMonthFolder();
  try {
    const res = await FS.list(boxRootName, monthFolder);
    const entries = res.entries || [];
    const imageFiles = entries.filter(e => e.type === 'file' && /\.(jpe?g|png|webp|gif)$/i.test(e.name));

    currentPhotos = [];
    for (const img of imageFiles) {
      try {
        const fileHandle = await FS.open(boxRootName, monthFolder, img.name);
        const url = fileHandle.url || URL.createObjectURL(await fileHandle.blob());
        currentPhotos.push({
          name: img.name,
          url: url,
          rel: monthFolder
        });
      } catch (e) {
        console.warn(`Konnte Bild ${img.name} nicht öffnen:`, e);
      }
    }

    renderGallery();
  } catch (e) {
    console.warn('Fehler beim Auflisten der Fotos:', e);
    renderGallery();
  }
}

// 3. Datei-Upload auf die Box
async function uploadFiles(files) {
  if (!files || !files.length) return;
  const monthFolder = getMonthFolder();

  showToast(`${files.length} Foto(s) werden hochgeladen...`);

  let count = 0;
  for (const file of files) {
    if (!/\.(jpe?g|png|webp|gif)$/i.test(file.name)) continue;

    if (FS && boxRootName) {
      try {
        const handle = await FS.open(boxRootName, monthFolder, file.name, { write: true, create: true });
        await handle.save(file);
        count++;
      } catch (err) {
        showToast(`Fehler bei ${file.name}: ${err.message}`);
      }
    } else {
      // Fallback in Memory
      const reader = new FileReader();
      reader.onload = () => {
        currentPhotos.unshift({ name: file.name, url: reader.result, rel: 'local' });
        renderGallery();
      };
      reader.readAsDataURL(file);
      count++;
    }
  }

  if (FS && boxRootName) {
    await loadBoxPhotos();
    if (SOS && SOS.emit) {
      SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${monthFolder}/` });
    }
  }

  showToast(`${count} Foto(s) erfolgreich gespeichert!`);
}

// 4. Galerie Rendern
function renderGallery() {
  galleryGrid.innerHTML = '';
  photoCount.textContent = `${currentPhotos.length} Foto(s)`;

  if (!currentPhotos.length) {
    emptyGallery.classList.remove('hidden');
    return;
  }
  emptyGallery.classList.add('hidden');

  currentPhotos.forEach(p => {
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="${p.url}" alt="${escapeHTML(p.name)}" loading="lazy">
      <div class="photo-meta-overlay">
        <span class="photo-name">${escapeHTML(p.name)}</span>
      </div>
    `;

    card.addEventListener('click', () => openLightbox(p));
    galleryGrid.appendChild(card);
  });
}

// 5. Lightbox
function openLightbox(photo) {
  activeLightboxPhoto = photo;
  lightboxImg.src = photo.url;
  lightboxFilename.textContent = photo.name;
  lightbox.classList.remove('hidden');
}

lightboxClose.addEventListener('click', () => {
  lightbox.classList.add('hidden');
  activeLightboxPhoto = null;
});

lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) {
    lightbox.classList.add('hidden');
    activeLightboxPhoto = null;
  }
});

lightboxDelBtn.addEventListener('click', async () => {
  if (!activeLightboxPhoto) return;
  if (!confirm(`Soll '${activeLightboxPhoto.name}' wirklich gelöscht werden?`)) return;

  const target = activeLightboxPhoto;
  lightbox.classList.add('hidden');

  if (FS && boxRootName && target.rel !== 'local') {
    try {
      await FS.remove(boxRootName, target.rel, [target.name]);
      showToast('Foto auf der Box gelöscht.');
      await loadBoxPhotos();
    } catch (e) {
      showToast(`Löschen fehlgeschlagen: ${e.message}`);
    }
  } else {
    currentPhotos = currentPhotos.filter(p => p !== target);
    renderGallery();
    showToast('Foto entfernt.');
  }
});

// Fallback Demo
function loadFallbackPhotos() {
  currentPhotos = [];
  renderGallery();
}

// Events
dropzone.addEventListener('click', () => filePicker.click());
filePicker.addEventListener('change', (e) => {
  uploadFiles(Array.from(e.target.files));
  e.target.value = '';
});

dropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropzone.classList.add('dragover');
});
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
dropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropzone.classList.remove('dragover');
  if (e.dataTransfer.files) {
    uploadFiles(Array.from(e.dataTransfer.files));
  }
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
