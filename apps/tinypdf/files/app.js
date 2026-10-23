'use strict';

/**
 * TinyPDF - Leichtgewichtiger PDF-Viewer & Touch-Signatur-Helfer
 * Findet PDFs im ShareOS.fs VFS oder erlaubt lokales Laden
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

let boxRootName = null;
let currentZoom = 100;
let currentFilename = 'Beleg_Vertrag_2026.pdf';
let signatureDataUrl = null;

// UI Elements
const pdfFileSelector = document.getElementById('pdf-file-selector');
const uploadPdfBtn = document.getElementById('upload-pdf-btn');
const openSignModalBtn = document.getElementById('open-sign-modal-btn');
const refreshBtn = document.getElementById('refresh-btn');
const zoomOutBtn = document.getElementById('zoom-out-btn');
const zoomInBtn = document.getElementById('zoom-in-btn');
const zoomIndicator = document.getElementById('zoom-indicator');
const downloadPdfBtn = document.getElementById('download-pdf-btn');

const docFilename = document.getElementById('doc-filename');
const docContentBody = document.getElementById('doc-content-body');
const docSignatureArea = document.getElementById('doc-signature-area');
const signaturePreviewImg = document.getElementById('signature-preview-img');
const pdfPageWrapper = document.getElementById('pdf-page-wrapper');
const storageStatus = document.getElementById('storage-status');

// Sign Modal
const signModal = document.getElementById('sign-modal');
const closeSignX = document.getElementById('close-sign-x');
const cancelSignBtn = document.getElementById('cancel-sign-btn');
const applySignBtn = document.getElementById('apply-sign-btn');
const clearSigBtn = document.getElementById('clear-sig-btn');
const sigCanvas = document.getElementById('sig-canvas');
const sigCtx = sigCanvas.getContext('2d');

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

// 1. VFS / ShareOS.fs PDF Suche
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadDefaultPdfContent('Mustervertrag_ShareOS_VPN.pdf', 'Dies ist ein sicheres Beispieldokument im ShareOS TinyPDF Viewer.

Paragraph 1: VPN-Verbindung und Netzzugriff
Alle Datenübertragungen erfolgen verschlüsselt über das virtuelle Heimnetz.

Paragraph 2: Unterschrift
Dieses Dokument kann direkt im Browser mittels Touch- oder Maus-Signatur digital abgezeichnet und gesichert werden.');
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      storageStatus.textContent = `Box: 🏠 ${boxRootName} (VFS verbunden)`;
      await scanForPdfs(boxRootName, '');
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadDefaultPdfContent('Mustervertrag.pdf', 'Lokales Beispieldokument.');
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadDefaultPdfContent('Mustervertrag.pdf', 'Lokales Beispieldokument.');
  }
}

async function scanForPdfs(rootName, folderPath) {
  try {
    const items = await FS.list(rootName, folderPath);
    items.forEach(item => {
      const fullPath = folderPath ? `${folderPath}/${item.name}` : item.name;
      if (item.type === 'file' && item.name.toLowerCase().endsWith('.pdf')) {
        const opt = document.createElement('option');
        opt.value = fullPath;
        opt.textContent = `📄 ${fullPath}`;
        pdfFileSelector.appendChild(opt);
      } else if (item.type === 'dir') {
        scanForPdfs(rootName, fullPath);
      }
    });

    if (pdfFileSelector.options.length <= 1) {
      // Wenn keine PDFs auf der Box, Default einfügen
      const opt = document.createElement('option');
      opt.value = 'demo.pdf';
      opt.textContent = '📄 Demo-Vertrag.pdf';
      pdfFileSelector.appendChild(opt);
    }
  } catch (e) {
    console.warn('Scan error:', e);
  }
}

function loadDefaultPdfContent(filename, textContent) {
  currentFilename = filename;
  docFilename.textContent = filename;
  docContentBody.innerHTML = `<p>${textContent.replace(/\n/g, '<br>')}</p>`;
}

// PDF Auswahl von Box
pdfFileSelector.addEventListener('change', async () => {
  const path = pdfFileSelector.value;
  if (!path) return;

  if (path === 'demo.pdf') {
    loadDefaultPdfContent('Demo-Vertrag.pdf', 'Dies ist ein Beispieldokument für den TinyPDF Viewer.');
    showToast('Demo-Dokument geladen.');
    return;
  }

  if (FS && boxRootName) {
    try {
      const parts = path.split('/');
      const filename = parts.pop();
      const dir = parts.join('/');
      const handle = await FS.open(boxRootName, dir, filename);
      const text = await (await handle.blob()).text();
      loadDefaultPdfContent(filename, text);
      showToast(`'${filename}' geladen.`);
    } catch (e) {
      showToast('Fehler beim Öffnen der PDF: ' + e.message);
    }
  }
});

// Lokale Datei öffnen
uploadPdfBtn.addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,.txt,.md';
  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    loadDefaultPdfContent(file.name, text);
    showToast(`Lokale Datei '${file.name}' geladen.`);
  };
  input.click();
});

// 2. Touch Signature Pad Logik
let isDrawing = false;
let lastX = 0;
let lastY = 0;

function initSigPad() {
  sigCtx.strokeStyle = '#0f172a';
  sigCtx.lineWidth = 2.5;
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';

  const getPos = (e) => {
    const rect = sigCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDraw = (e) => {
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
    e.preventDefault();
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const pos = getPos(e);
    sigCtx.beginPath();
    sigCtx.moveTo(lastX, lastY);
    sigCtx.lineTo(pos.x, pos.y);
    sigCtx.stroke();
    lastX = pos.x;
    lastY = pos.y;
    e.preventDefault();
  };

  const stopDraw = () => { isDrawing = false; };

  sigCanvas.addEventListener('mousedown', startDraw);
  sigCanvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDraw);

  sigCanvas.addEventListener('touchstart', startDraw, { passive: false });
  sigCanvas.addEventListener('touchmove', draw, { passive: false });
  window.addEventListener('touchend', stopDraw);
}

openSignModalBtn.addEventListener('click', () => {
  signModal.classList.remove('hidden');
  // Canvas löschen beim Öffnen
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
});

closeSignX.addEventListener('click', () => signModal.classList.add('hidden'));
cancelSignBtn.addEventListener('click', () => signModal.classList.add('hidden'));
signModal.addEventListener('click', (e) => {
  if (e.target === signModal) signModal.classList.add('hidden');
});

clearSigBtn.addEventListener('click', () => {
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
});

applySignBtn.addEventListener('click', () => {
  signatureDataUrl = sigCanvas.toDataURL('image/png');
  signaturePreviewImg.src = signatureDataUrl;
  signaturePreviewImg.classList.remove('hidden');
  docSignatureArea.classList.remove('hidden');
  signModal.classList.add('hidden');
  showToast('Unterschrift erfolgreich in das Dokument eingefügt!');
});

// 3. Zoom & Download
zoomInBtn.addEventListener('click', () => {
  if (currentZoom < 160) {
    currentZoom += 15;
    pdfPageWrapper.style.transform = `scale(${currentZoom / 100})`;
    zoomIndicator.textContent = `${currentZoom}%`;
  }
});

zoomOutBtn.addEventListener('click', () => {
  if (currentZoom > 70) {
    currentZoom -= 15;
    pdfPageWrapper.style.transform = `scale(${currentZoom / 100})`;
    zoomIndicator.textContent = `${currentZoom}%`;
  }
});

downloadPdfBtn.addEventListener('click', () => {
  const content = document.getElementById('pdf-virtual-doc').outerHTML;
  const blob = new Blob([content], { type: 'text/html;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Signed_${currentFilename}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Signiertes Dokument heruntergeladen!');
});

refreshBtn.addEventListener('click', () => {
  initStorage();
  showToast('Aktualisiert.');
});

initSigPad();
initStorage();
