'use strict';

/**
 * ShareAudio - Mobiles Diktiergerät & Sprachnotizen
 * Speichert Audioaufnahmen direkt über ShareOS.fs im Ordner voice_memos/
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const AUDIO_DIR = 'voice_memos';
let boxRootName = null;
let recordings = [];

// Audio & Recorder State
let mediaRecorder = null;
let audioChunks = [];
let recordTimerInterval = null;
let recordSeconds = 0;
let isRecording = false;

// Audio Visualization
let audioContext = null;
let analyser = null;
let visualizerAnimId = null;

// UI Elements
const recordToggleBtn = document.getElementById('record-toggle-btn');
const recordDot = document.getElementById('record-dot');
const recordTimer = document.getElementById('record-timer');
const recordStatus = document.getElementById('record-status');
const recordingsList = document.getElementById('recordings-list');
const recordingsCount = document.getElementById('recordings-count');
const storageStatus = document.getElementById('storage-status');
const visualizerCanvas = document.getElementById('visualizer');
const canvasCtx = visualizerCanvas.getContext('2d');
const refreshBtn = document.getElementById('refresh-btn');

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

// 1. Initialisierung von Storage & Box
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (Fallback)`;
    if (SOS && SOS.user && SOS.user !== 'guest') {
      showBanner('Kein Zugriff auf die Ordner der Box. Administrator kann „Dateien“ unter Benutzer aktivieren.');
    }
    loadFallbackRecordings();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', AUDIO_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${AUDIO_DIR}/`;
      await loadBoxRecordings();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackRecordings();
    }
  } catch (err) {
    console.error('FS error:', err);
    loadFallbackRecordings();
  }
}

// 2. Sprachaufnahmen von der Box laden
async function loadBoxRecordings() {
  if (!FS || !boxRootName) return;

  try {
    const res = await FS.list(boxRootName, AUDIO_DIR);
    const entries = res.entries || [];
    const audioFiles = entries.filter(e => e.type === 'file' && /\.(webm|ogg|wav|mp3|m4a)$/i.test(e.name));

    recordings = [];
    for (const rec of audioFiles) {
      try {
        const fileHandle = await FS.open(boxRootName, AUDIO_DIR, rec.name);
        const url = fileHandle.url || URL.createObjectURL(await fileHandle.blob());
        recordings.push({
          name: rec.name,
          url: url,
          size: rec.size,
          mtime: rec.mtime
        });
      } catch (e) {
        console.warn(`Fehler bei Audio ${rec.name}:`, e);
      }
    }

    // Sortierung nach Datum absteigend
    recordings.sort((a,b) => b.name.localeCompare(a.name));
    renderRecordings();
  } catch (err) {
    console.warn('Fehler beim Laden von der Box:', err);
    renderRecordings();
  }
}

function renderRecordings() {
  recordingsList.innerHTML = '';
  recordingsCount.textContent = `${recordings.length} Memos`;

  if (!recordings.length) {
    recordingsList.innerHTML = '<div class="empty-state">Noch keine Aufnahmen vorhanden. Starte links die Aufnahme!</div>';
    return;
  }

  recordings.forEach(rec => {
    const card = document.createElement('div');
    card.className = 'rec-card';

    card.innerHTML = `
      <div class="rec-header">
        <span class="rec-title">🎙️ ${escapeHTML(rec.name)}</span>
        <span class="rec-date">${rec.mtime ? new Date(rec.mtime * 1000).toLocaleString() : ''}</span>
      </div>
      <audio controls src="${rec.url}" preload="metadata"></audio>
      <div class="rec-actions">
        <a href="${rec.url}" download="${escapeHTML(rec.name)}" class="action-link">💾 Download</a>
        <button class="action-link del-btn">🗑 Löschen</button>
      </div>
    `;

    card.querySelector('.del-btn').addEventListener('click', async () => {
      if (!confirm(`Soll '${rec.name}' wirklich gelöscht werden?`)) return;

      if (FS && boxRootName) {
        try {
          await FS.remove(boxRootName, AUDIO_DIR, [rec.name]);
          showToast('Sprachaufnahme auf der Box gelöscht.');
          await loadBoxRecordings();
        } catch (e) {
          showToast('Löschen fehlgeschlagen: ' + e.message);
        }
      } else {
        recordings = recordings.filter(r => r !== rec);
        renderRecordings();
      }
    });

    recordingsList.appendChild(card);
  });
}

function loadFallbackRecordings() {
  recordings = [];
  renderRecordings();
}

// 3. Audio Recorder Steuerung
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];

    // Audio Analyzer Setup for Visualizer
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 64;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : (MediaRecorder.isTypeSupported('audio/ogg') ? 'audio/ogg' : 'audio/webm');

    mediaRecorder = new MediaRecorder(stream, { mimeType });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      await saveAudioBlob(audioBlob);
      stream.getTracks().forEach(t => t.stop());
      if (audioContext) audioContext.close();
    };

    mediaRecorder.start(250);
    isRecording = true;
    recordToggleBtn.classList.add('recording');
    recordStatus.textContent = 'Aufnahme läuft... (Tippe erneut zum Beenden)';
    startTimer();
    drawVisualizer();
  } catch (err) {
    showToast('Mikrofon-Zugriff verweigert oder nicht unterstützt: ' + err.message);
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording) {
    mediaRecorder.stop();
    isRecording = false;
    recordToggleBtn.classList.remove('recording');
    recordStatus.textContent = 'Verarbeite & speichere...';
    stopTimer();
    cancelAnimationFrame(visualizerAnimId);
    clearVisualizer();
  }
}

recordToggleBtn.addEventListener('click', () => {
  if (!isRecording) startRecording();
  else stopRecording();
});

function startTimer() {
  recordSeconds = 0;
  recordTimer.textContent = '00:00';
  recordTimerInterval = setInterval(() => {
    recordSeconds++;
    const m = String(Math.floor(recordSeconds / 60)).padStart(2, '0');
    const s = String(recordSeconds % 60).padStart(2, '0');
    recordTimer.textContent = `${m}:${s}`;
  }, 1000);
}

function stopTimer() {
  clearInterval(recordTimerInterval);
}

function drawVisualizer() {
  if (!analyser) return;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const draw = () => {
    visualizerAnimId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    canvasCtx.fillStyle = '#090a10';
    canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

    const barWidth = (visualizerCanvas.width / bufferLength) * 1.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * visualizerCanvas.height;
      canvasCtx.fillStyle = '#8b5cf6';
      canvasCtx.fillRect(x, visualizerCanvas.height - barHeight, barWidth - 2, barHeight);
      x += barWidth;
    }
  };
  draw();
}

function clearVisualizer() {
  canvasCtx.fillStyle = '#090a10';
  canvasCtx.fillRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
}

async function saveAudioBlob(blob) {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const fileName = `memo_${timestamp}.webm`;

  showToast(`Speichere '${fileName}' auf der Box...`);

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, AUDIO_DIR, fileName, { write: true, create: true });
      await handle.save(blob);
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${AUDIO_DIR}/${fileName}`, name: fileName });
      }
      showToast('Sprachnotiz erfolgreich gesichert!');
      await loadBoxRecordings();
    } catch (err) {
      showToast('Fehler beim Speichern: ' + err.message);
    }
  } else {
    recordings.unshift({
      name: fileName,
      url: URL.createObjectURL(blob),
      size: blob.size,
      mtime: Math.floor(Date.now() / 1000)
    });
    renderRecordings();
    showToast('Sprachnotiz lokal gespeichert.');
  }

  recordStatus.textContent = 'Bereit zur Aufnahme';
}

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
clearVisualizer();
