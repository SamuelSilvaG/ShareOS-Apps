/**
 * TinyPDF 2.0 – PDF viewer with pdf.js and a hand-drawn signature that is
 * put into the PDF with pdf-lib. Opens PDFs from the box (ShareOS.fs.pick),
 * from the device or from the ShareOS file browser (ShareOS.file); the signed
 * copy is saved on the box (file dialog of the box) or downloaded.
 */
import * as pdfjsLib from './vendor/pdfjs/pdf.min.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.js', import.meta.url).href;

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';
const $ = (id) => document.getElementById(id);
$('user-display').textContent = `Account: ${user}`;

let pdfBytes = null;        // the original file
let pdfDoc = null;          // pdf.js document
let fileName = '';
let pageNum = 1;
let zoom = 1;               // 1 = 100 %
let fitWidth = true;
let renderTask = null;
let viewport = null;
let signature = null;       // {png (data URL), w, h, page, x, y, width} – x/y/width in PDF points

const canvas = $('pdf-canvas');
const ctx = canvas.getContext('2d');
const overlay = $('sig-overlay');

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

// 1. opening
async function openBytes(bytes, name) {
  try {
    pdfBytes = new Uint8Array(bytes);
    pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  } catch (err) {
    pdfDoc = null;
    showToast('Das ist kein lesbares PDF: ' + err.message);
    return;
  }
  fileName = name || 'Dokument.pdf';
  pageNum = 1;
  signature = null;
  fitWidth = true;
  $('pdf-empty').classList.add('hidden');
  $('pdf-stage').classList.remove('hidden');
  $('open-sign-modal-btn').disabled = false;
  $('download-pdf-btn').disabled = false;
  $('storage-status').textContent = `📄 ${fileName} · ${pdfDoc.numPages} ${pdfDoc.numPages === 1 ? 'Seite' : 'Seiten'}`;
  document.title = `${fileName} – TinyPDF`;
  await renderPage();
}

$('upload-pdf-btn').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf,application/pdf';
  input.onchange = async () => {
    const f = input.files[0];
    if (f) await openBytes(await f.arrayBuffer(), f.name);
  };
  input.click();
});

$('box-pdf-btn').addEventListener('click', async () => {
  if (!FS || !FS.pick) { showToast('Der Dateidialog der Box braucht ShareOS 0.2.0-beta.1 und die Berechtigung „Dateien“.'); return; }
  try {
    const sel = await FS.pick({ title: 'PDF öffnen', ext: ['.pdf'] });
    if (!sel || !sel.length) return;
    const h = await FS.open(sel[0].root, sel[0].path, sel[0].name);
    await openBytes(await (await h.blob()).arrayBuffer(), sel[0].name);
  } catch (err) {
    showToast('Öffnen fehlgeschlagen: ' + err.message);
  }
});
if (!FS || !FS.pick) $('box-pdf-btn').disabled = true;

// 2. drawing a page
async function renderPage() {
  if (!pdfDoc) return;
  const page = await pdfDoc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  if (fitWidth) {
    // the whole page in view (on phones: the width)
    const c = $('pdf-workspace');
    const fw = (c.clientWidth - 56) / base.width, fh = (c.clientHeight - 56) / base.height;
    zoom = Math.max(0.3, Math.min(3, c.clientWidth < 700 ? fw : Math.min(fw, fh)));
  }
  viewport = page.getViewport({ scale: zoom });
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * dpr);
  canvas.height = Math.floor(viewport.height * dpr);
  canvas.style.width = `${Math.floor(viewport.width)}px`;
  canvas.style.height = `${Math.floor(viewport.height)}px`;
  $('pdf-stage').style.width = `${Math.floor(viewport.width)}px`;
  if (renderTask) renderTask.cancel();
  renderTask = page.render({ canvasContext: ctx, viewport, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
  try { await renderTask.promise; } catch (e) { if (e && e.name !== 'RenderingCancelledException') throw e; }
  renderTask = null;
  $('page-indicator').textContent = `Seite ${pageNum} von ${pdfDoc.numPages}`;
  $('zoom-indicator').textContent = `${Math.round(zoom * 100)}%`;
  $('prev-page-btn').disabled = pageNum <= 1;
  $('next-page-btn').disabled = pageNum >= pdfDoc.numPages;
  placeOverlay();
}

$('prev-page-btn').addEventListener('click', () => { if (pageNum > 1) { pageNum--; renderPage(); } });
$('next-page-btn').addEventListener('click', () => { if (pdfDoc && pageNum < pdfDoc.numPages) { pageNum++; renderPage(); } });
$('zoom-in-btn').addEventListener('click', () => { fitWidth = false; zoom = Math.min(3, zoom * 1.2); renderPage(); });
$('zoom-out-btn').addEventListener('click', () => { fitWidth = false; zoom = Math.max(0.3, zoom / 1.2); renderPage(); });
$('fit-btn').addEventListener('click', () => { fitWidth = true; renderPage(); });
window.addEventListener('resize', () => { if (fitWidth) renderPage(); });
document.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') $('next-page-btn').click();
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') $('prev-page-btn').click();
});

// 3. signature: drawn in the dialog, placed on the page, PDF points stored
function placeOverlay() {
  const on = signature && viewport && signature.page === pageNum;
  overlay.classList.toggle('hidden', !on);
  $('sig-tools').classList.toggle('hidden', !signature);
  if (!on) return;
  const s = viewport.scale;
  const h = signature.width * signature.h / signature.w;
  overlay.style.left = `${signature.x * s}px`;
  overlay.style.top = `${(viewport.viewBox[3] - signature.y - h) * s}px`;
  overlay.style.width = `${signature.width * s}px`;
}

let drag = null;
overlay.addEventListener('pointerdown', (e) => {
  drag = { x: e.clientX, y: e.clientY, sx: signature.x, sy: signature.y };
  overlay.setPointerCapture(e.pointerId);
  e.preventDefault();
});
overlay.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const s = viewport.scale;
  const h = signature.width * signature.h / signature.w;
  signature.x = Math.max(0, Math.min(viewport.viewBox[2] - signature.width, drag.sx + (e.clientX - drag.x) / s));
  signature.y = Math.max(0, Math.min(viewport.viewBox[3] - h, drag.sy - (e.clientY - drag.y) / s));
  placeOverlay();
});
overlay.addEventListener('pointerup', () => { drag = null; });
const resizeSig = (f) => { if (!signature) return; signature.width = Math.max(40, Math.min(400, signature.width * f)); placeOverlay(); };
$('sig-bigger').addEventListener('click', () => resizeSig(1.15));
$('sig-smaller').addEventListener('click', () => resizeSig(1 / 1.15));
$('sig-remove').addEventListener('click', () => { signature = null; placeOverlay(); });

// the signature pad
const sigCanvas = $('sig-canvas');
const sigCtx = sigCanvas.getContext('2d');
let drawing = false, last = null, inked = false;
function padPos(e) {
  const r = sigCanvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) * sigCanvas.width / r.width, y: (e.clientY - r.top) * sigCanvas.height / r.height };
}
sigCanvas.style.touchAction = 'none';
sigCanvas.addEventListener('pointerdown', (e) => { drawing = true; last = padPos(e); sigCanvas.setPointerCapture(e.pointerId); });
sigCanvas.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = padPos(e);
  sigCtx.strokeStyle = '#0b2a6f';
  sigCtx.lineWidth = 2.6;
  sigCtx.lineCap = 'round';
  sigCtx.lineJoin = 'round';
  sigCtx.beginPath(); sigCtx.moveTo(last.x, last.y); sigCtx.lineTo(p.x, p.y); sigCtx.stroke();
  last = p; inked = true;
});
sigCanvas.addEventListener('pointerup', () => { drawing = false; });
const clearPad = () => { sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height); inked = false; };
$('clear-sig-btn').addEventListener('click', clearPad);

// crop the drawing to its strokes (transparent PNG)
function croppedSignature() {
  const { width, height } = sigCanvas;
  const data = sigCtx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = -1, y1 = -1;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (data[(y * width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const pad = 6;
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(width - 1, x1 + pad); y1 = Math.min(height - 1, y1 + pad);
  const c = document.createElement('canvas');
  c.width = x1 - x0 + 1; c.height = y1 - y0 + 1;
  c.getContext('2d').drawImage(sigCanvas, x0, y0, c.width, c.height, 0, 0, c.width, c.height);
  return { png: c.toDataURL('image/png'), w: c.width, h: c.height };
}

$('open-sign-modal-btn').addEventListener('click', () => { clearPad(); $('sign-modal').classList.remove('hidden'); });
const closeSign = () => $('sign-modal').classList.add('hidden');
$('close-sign-x').addEventListener('click', closeSign);
$('cancel-sign-btn').addEventListener('click', closeSign);
$('sign-modal').addEventListener('click', (e) => { if (e.target === $('sign-modal')) closeSign(); });
$('apply-sign-btn').addEventListener('click', () => {
  const sig = inked ? croppedSignature() : null;
  if (!sig) { showToast('Bitte zuerst unterschreiben.'); return; }
  const pw = viewport.viewBox[2], ph = viewport.viewBox[3];
  const width = Math.min(180, pw * 0.35);
  // bottom right of the page to start with, then drag it into place
  signature = { ...sig, page: pageNum, width, x: pw - width - 50, y: 60 };
  overlay.src = sig.png;
  closeSign();
  placeOverlay();
  showToast('Unterschrift an die richtige Stelle ziehen, dann „Speichern“.');
});

// 4. saving: the original PDF with the signature drawn in (pdf-lib)
async function buildPdf() {
  if (!signature) return pdfBytes;
  const { PDFDocument } = window.PDFLib;
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const png = await doc.embedPng(signature.png);
  const page = doc.getPage(signature.page - 1);
  const box = page.getCropBox ? page.getCropBox() : { x: 0, y: 0 };
  const h = signature.width * signature.h / signature.w;
  page.drawImage(png, { x: box.x + signature.x, y: box.y + signature.y, width: signature.width, height: h });
  return await doc.save();
}

$('download-pdf-btn').addEventListener('click', async () => {
  if (!pdfBytes) return;
  let out;
  try { out = await buildPdf(); }
  catch (err) { showToast('PDF konnte nicht erzeugt werden: ' + err.message); return; }
  const name = signature ? fileName.replace(/(\.pdf)?$/i, '_unterschrieben.pdf') : fileName;
  const blob = new Blob([out], { type: 'application/pdf' });
  if (FS && FS.pick) {
    try {
      const sel = await FS.pick({ title: 'PDF speichern', save: true, name, ext: ['.pdf'] });
      if (sel && sel.length) {
        const h = await FS.open(sel[0].root, sel[0].path, sel[0].name, { write: true, create: true });
        await h.save(blob);
        showToast(`Gespeichert: ${sel[0].name}`);
        return;
      }
      if (sel === null) return;
    } catch (err) {
      showToast('Speichern auf der Box fehlgeschlagen – lade herunter: ' + err.message);
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  showToast('PDF heruntergeladen.');
});

// 5. opened from the ShareOS file browser
(async () => {
  if (SOS && SOS.file) {
    try {
      const info = await SOS.file.info();
      await openBytes(await (await SOS.file.blob()).arrayBuffer(), info.name);
    } catch (err) {
      showToast('Datei aus ShareOS: ' + err.message);
    }
  }
  if (!FS) $('storage-status').textContent = 'Ohne „Dateien“: PDFs vom Gerät öffnen, Ergebnis wird heruntergeladen';
  else if (!pdfDoc) $('storage-status').textContent = 'Bereit';
})();
