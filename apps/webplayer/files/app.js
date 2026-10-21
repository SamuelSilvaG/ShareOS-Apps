'use strict';
// --- ShareOS app bridge ---------------------------------------------------------
// Inside ShareOS the app SDK (/_shareos/app.js) is loaded: messages go through
// ShareOS.emit/on (BroadcastChannel "shareos", every app on the box hears them).
// Outside ShareOS the same channel is used directly.
const APP = 'webplayer';
const SOS = window.ShareOS || null;
const chan = !SOS && 'BroadcastChannel' in window ? new BroadcastChannel('shareos') : null;
const handlers = {};
function emit(type, data) {
  if (SOS) SOS.emit(type, data);
  else if (chan) chan.postMessage({ type, data, from: APP });
}
function on(type, fn) {
  if (SOS) SOS.on(type, fn);
  else (handlers[type] = handlers[type] || []).push(fn);
}
if (chan) chan.onmessage = (ev) => {
  const m = ev.data || {};
  (handlers[m.type] || []).forEach((fn) => { try { fn(m.data, m.from); } catch (e) { } });
};
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

// another app (e.g. ShareCommander) sends a medium: {to: 'webplayer', name, blob | url}
on('open-media', (d, from) => {
  if (!d || d.to !== APP) return;
  const name = String(d.name || 'ShareOS Media').slice(0, 200);
  if (d.blob instanceof Blob) {
    addTrackToPlaylist({ name, url: URL.createObjectURL(d.blob), type: d.blob.type || typeOf(name), own: true }, true);
  } else if (typeof d.url === 'string' && /^(https?:|blob:|\/)/.test(d.url)) {
    addTrackToPlaylist({ name, url: d.url, type: typeOf(name) }, true);
  } else return;
  try { window.focus(); } catch (e) { }
  flash(`*** ${name.toUpperCase()} – VON ${String(from || '?').toUpperCase()} ***`);
});
on('ping', () => emit('pong', {}));
emit('app-ready', {});

const MEDIA_TYPES = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska', mov: 'video/quicktime' };
function typeOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return (m && MEDIA_TYPES[m[1].toLowerCase()]) || 'audio';
}

// --- DOM Elements ---
const mediaEl = document.getElementById('media-element');
const videoContainer = document.getElementById('video-container');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const stateIndicator = document.getElementById('state-indicator');
const timeDisplay = document.getElementById('time-display');
const durationDisplay = document.getElementById('duration-display');
const trackMarquee = document.getElementById('track-marquee');
const seekSlider = document.getElementById('seek-slider');
const volumeSlider = document.getElementById('volume-slider');
const panSlider = document.getElementById('pan-slider');

const playBtn = document.getElementById('play-btn');
const pauseBtn = document.getElementById('pause-btn');
const stopBtn = document.getElementById('stop-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');

const visCanvas = document.getElementById('visualizer-canvas');
const visCtx = visCanvas.getContext('2d');
const visModeLabel = document.getElementById('vis-mode-label');

const eqBandsContainer = document.getElementById('eq-bands-container');
const eqPowerBtn = document.getElementById('eq-power-btn');
const eqPresetSelect = document.getElementById('eq-preset-select');
const eqResetBtn = document.getElementById('eq-reset-btn');

const fileInput = document.getElementById('file-input');
const addUrlBtn = document.getElementById('add-url-btn');
const clearPlaylistBtn = document.getElementById('clear-playlist-btn');
const playlistSearch = document.getElementById('playlist-search');
const playlistBody = document.getElementById('playlist-body');
const playlistStats = document.getElementById('playlist-stats');
const emptyDropHint = document.getElementById('empty-drop-hint');
const dropZone = document.getElementById('drop-zone');

const skinToggleBtn = document.getElementById('skin-toggle-btn');
const demoSynthBtn = document.getElementById('demo-synth-btn');

// --- Player State ---
let playlist = [];
let currentIndex = -1;
let isShuffle = false;
let isRepeat = false;
let eqEnabled = true;
let visMode = 0; // 0: Spectrum, 1: Oscilloscope, 2: Bars + Peak
const visModes = ['SPECTRUM', 'OSCILLOSCOPE', 'MIRROR WAVE'];
const skins = ['shareos', 'classic', 'cyber', 'foobar'];
let currentSkinIndex = 0;

// --- Web Audio API Graph ---
let audioCtx = null;
let sourceNode = null;
let preampNode = null;
let pannerNode = null;
let analyserNode = null;
let eqFilters = [];
const eqFrequencies = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
let eqGains = new Array(10).fill(0);
let preampGain = 0; // dB

const eqPresets = {
  flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  bass: [7, 6, 5, 2, 0, 0, 0, 0, 1, 1],
  rock: [5, 4, 2, -2, -3, -1, 2, 4, 5, 5],
  electronic: [6, 5, 1, -2, -1, 1, 0, 3, 5, 6],
  vocal: [-3, -2, -1, 2, 5, 5, 4, 2, 0, -1],
  classic: [4, 3, 2, 1, -1, -1, 0, 2, 3, 4]
};

function initAudioGraph() {
  if (audioCtx) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  audioCtx = new AudioContextClass();

  sourceNode = audioCtx.createMediaElementSource(mediaEl);
  preampNode = audioCtx.createGain();
  pannerNode = audioCtx.createStereoPanner();
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 512;
  analyserNode.smoothingTimeConstant = 0.82;

  // Create 10 BiquadFilterNodes
  eqFilters = eqFrequencies.map((freq, idx) => {
    const filter = audioCtx.createBiquadFilter();
    filter.type = idx === 0 ? 'lowshelf' : idx === eqFrequencies.length - 1 ? 'highshelf' : 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.2;
    filter.gain.value = eqEnabled ? eqGains[idx] : 0;
    return filter;
  });

  // Connect Chain: Source -> Preamp -> EQ[0..9] -> Panner -> Analyser -> Destination
  sourceNode.connect(preampNode);
  let prev = preampNode;
  eqFilters.forEach(f => {
    prev.connect(f);
    prev = f;
  });
  prev.connect(pannerNode);
  pannerNode.connect(analyserNode);
  analyserNode.connect(audioCtx.destination);
}

// --- Build Equalizer UI ---
function buildEqualizerUI() {
  eqBandsContainer.innerHTML = '';

  // Preamp Band
  const preBand = document.createElement('div');
  preBand.className = 'eq-band preamp-band';
  preBand.innerHTML = `
    <span class="eq-val-label" id="preamp-val">0dB</span>
    <div class="vertical-slider-wrap">
      <input type="range" class="eq-slider" id="preamp-slider" min="-12" max="12" step="0.5" value="0">
    </div>
    <span class="eq-freq-label">PRE</span>
  `;
  eqBandsContainer.appendChild(preBand);

  const preampSlider = preBand.querySelector('#preamp-slider');
  const preampVal = preBand.querySelector('#preamp-val');
  preampSlider.addEventListener('input', (e) => {
    preampGain = parseFloat(e.target.value);
    preampVal.textContent = `${preampGain > 0 ? '+' : ''}${preampGain}dB`;
    saveState();
    if (preampNode) {
      preampNode.gain.value = Math.pow(10, preampGain / 20);
    }
  });

  // 10 Frequency Bands
  eqFrequencies.forEach((freq, idx) => {
    const label = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
    const band = document.createElement('div');
    band.className = 'eq-band';
    band.innerHTML = `
      <span class="eq-val-label" id="eq-val-${idx}">0dB</span>
      <div class="vertical-slider-wrap">
        <input type="range" class="eq-slider" data-idx="${idx}" min="-12" max="12" step="0.5" value="0">
      </div>
      <span class="eq-freq-label">${label}</span>
    `;
    eqBandsContainer.appendChild(band);

    const slider = band.querySelector('.eq-slider');
    slider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      setBandGain(idx, val);
    });
  });
}

function setBandGain(idx, dbValue) {
  eqGains[idx] = dbValue;
  const valEl = document.getElementById(`eq-val-${idx}`);
  if (valEl) valEl.textContent = `${dbValue > 0 ? '+' : ''}${Math.round(dbValue)}dB`;
  const slider = eqBandsContainer.querySelector(`.eq-slider[data-idx="${idx}"]`);
  if (slider) slider.value = dbValue;
  if (eqFilters[idx]) {
    eqFilters[idx].gain.value = eqEnabled ? dbValue : 0;
  }
  saveState();
}

function applyPreset(presetName) {
  const values = eqPresets[presetName] || eqPresets.flat;
  values.forEach((v, idx) => setBandGain(idx, v));
}

eqPowerBtn.addEventListener('click', () => {
  eqEnabled = !eqEnabled;
  eqPowerBtn.classList.toggle('active', eqEnabled);
  eqPowerBtn.textContent = eqEnabled ? 'ON' : 'OFF';
  eqFilters.forEach((f, idx) => {
    f.gain.value = eqEnabled ? eqGains[idx] : 0;
  });
  saveState();
});

eqPresetSelect.addEventListener('change', (e) => { applyPreset(e.target.value); saveState(); });
eqResetBtn.addEventListener('click', () => {
  eqPresetSelect.value = 'flat';
  applyPreset('flat');
});

// --- Visualizer Loop ---
const peakArray = new Array(64).fill(0);

function renderVisualizer() {
  requestAnimationFrame(renderVisualizer);

  const w = visCanvas.width;
  const h = visCanvas.height;
  visCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--lcd-bg').trim() || '#040604';
  visCtx.fillRect(0, 0, w, h);

  // Subtle Grid
  visCtx.strokeStyle = 'rgba(255,255,255,0.04)';
  visCtx.lineWidth = 1;
  for (let x = 0; x < w; x += 20) {
    visCtx.beginPath(); visCtx.moveTo(x, 0); visCtx.lineTo(x, h); visCtx.stroke();
  }
  for (let y = 0; y < h; y += 16) {
    visCtx.beginPath(); visCtx.moveTo(0, y); visCtx.lineTo(w, y); visCtx.stroke();
  }

  if (!analyserNode) return;

  const accentColor = getComputedStyle(document.documentElement).getPropertyValue('--lcd-text').trim() || '#00ff66';
  const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--lcd-accent').trim() || '#ffaa00';

  if (visMode === 0) {
    // Classic Winamp Spectrum Analyzer with Peak Dots
    const bufferLen = analyserNode.frequencyBinCount;
    const data = new Uint8Array(bufferLen);
    analyserNode.getByteFrequencyData(data);

    const bars = 40;
    const barWidth = Math.floor((w - bars * 2) / bars);

    for (let i = 0; i < bars; i++) {
      const val = data[i * 2] || 0;
      const barHeight = (val / 255) * (h - 6);
      const x = i * (barWidth + 2) + 2;
      const y = h - barHeight;

      const grad = visCtx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, accentColor);
      grad.addColorStop(0.7, secondaryColor);
      grad.addColorStop(1, '#ff3344');

      visCtx.fillStyle = grad;
      visCtx.fillRect(x, y, barWidth, barHeight);

      // Peak hold
      if (barHeight >= peakArray[i]) {
        peakArray[i] = barHeight;
      } else {
        peakArray[i] = Math.max(0, peakArray[i] - 0.6);
      }

      visCtx.fillStyle = '#ffffff';
      visCtx.fillRect(x, h - peakArray[i] - 2, barWidth, 2);
    }
  } else if (visMode === 1) {
    // Oscilloscope Waveform
    const bufferLen = analyserNode.fftSize;
    const data = new Uint8Array(bufferLen);
    analyserNode.getByteTimeDomainData(data);

    visCtx.lineWidth = 2;
    visCtx.strokeStyle = accentColor;
    visCtx.beginPath();

    const sliceWidth = w / bufferLen;
    let x = 0;
    for (let i = 0; i < bufferLen; i++) {
      const v = data[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) visCtx.moveTo(x, y);
      else visCtx.lineTo(x, y);
      x += sliceWidth;
    }
    visCtx.stroke();
  } else {
    // Mirror Symmetrical Frequency Wave
    const bufferLen = analyserNode.frequencyBinCount;
    const data = new Uint8Array(bufferLen);
    analyserNode.getByteFrequencyData(data);

    visCtx.fillStyle = accentColor;
    const midY = h / 2;
    const bars = 56;
    const step = w / bars;
    for (let i = 0; i < bars; i++) {
      const amp = (data[i] / 255) * (h / 2);
      visCtx.fillRect(i * step, midY - amp, step - 1, amp * 2);
    }
  }
}

visCanvas.parentElement.addEventListener('click', () => {
  visMode = (visMode + 1) % visModes.length;
  visModeLabel.textContent = visModes[visMode];
});

// --- Playlist & Media Management ---
function formatTime(sec) {
  if (!sec || !isFinite(sec)) return '00:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function addTrackToPlaylist(trackObj, autoPlay = false) {
  const item = {
    id: Date.now() + Math.random(),
    name: trackObj.name,
    url: trackObj.url,
    type: trackObj.type || 'audio',
    own: !!trackObj.own,          // our object URL: released when removed
    box: trackObj.box || null,    // {root, path, name}: a file of the box, kept in the playlist
    duration: trackObj.duration || '--:--'
  };
  playlist.push(item);
  saveState();
  if (!item.url) { renderPlaylist(); return; }   // restored: the address is fetched when it plays

  // Probe duration in background (streams have none)
  const tempMedia = document.createElement('audio');
  tempMedia.preload = 'metadata';
  const done = () => { tempMedia.removeAttribute('src'); tempMedia.load(); };
  tempMedia.onloadedmetadata = () => {
    if (isFinite(tempMedia.duration)) item.duration = formatTime(tempMedia.duration);
    done();
    renderPlaylist();
  };
  tempMedia.onerror = done;
  tempMedia.src = item.url;

  renderPlaylist();
  if (autoPlay || currentIndex === -1) {
    playTrack(playlist.length - 1);
  }
}

function renderPlaylist() {
  const filter = playlistSearch.value.trim().toLowerCase();
  playlistBody.innerHTML = '';

  const filtered = playlist.map((t, index) => ({ ...t, index }))
    .filter(t => t.name.toLowerCase().includes(filter));

  emptyDropHint.style.display = playlist.length === 0 ? 'block' : 'none';
  playlistStats.textContent = `${playlist.length} Track${playlist.length === 1 ? '' : 's'}`;

  filtered.forEach(item => {
    const tr = document.createElement('tr');
    if (item.index === currentIndex) tr.className = 'active-track';

    const isVideo = item.type.startsWith('video') || /\.(mp4|webm|mkv)$/i.test(item.name);
    const badge = isVideo ? '🎬 VID' : '🎵 AUD';

    tr.innerHTML = `
      <td>${item.index + 1}</td>
      <td>${escapeHTML(item.name)}</td>
      <td>${badge}</td>
      <td style="text-align: right;">${item.duration}</td>
      <td style="text-align: center;"><button class="remove-track-btn" title="Entfernen">×</button></td>
    `;

    tr.addEventListener('dblclick', () => playTrack(item.index));
    tr.addEventListener('click', (e) => {
      if (e.target.classList.contains('remove-track-btn')) return;
      if (currentIndex === -1) playTrack(item.index);
    });
    tr.querySelector('.remove-track-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      removeTrack(item.index);
    });

    playlistBody.appendChild(tr);
  });
}

function removeTrack(idx) {
  const [gone] = playlist.splice(idx, 1);
  saveState();
  if (gone && gone.own) setTimeout(() => URL.revokeObjectURL(gone.url), 1000);
  if (idx === currentIndex) {
    stopPlayback();
    currentIndex = -1;
  } else if (idx < currentIndex) {
    currentIndex--;
  }
  renderPlaylist();
}

async function playTrack(idx) {
  if (idx < 0 || idx >= playlist.length) return;
  const t = playlist[idx];
  // a file of the box from the saved playlist: a fresh ticket (they expire)
  if (t.box && (!t.url || t.stale)) {
    try { t.url = (await SOS.fs.open(t.box.root, t.box.path, t.box.name)).url; t.stale = false; }
    catch (e) { flash('*** ' + t.name.toUpperCase() + ': ' + String(e.message).toUpperCase() + ' ***'); return; }
  }
  initAudioGraph();
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  currentIndex = idx;
  saveState();
  const track = playlist[currentIndex];
  // other web servers: only with CORS, otherwise equalizer and visualizer get silence
  const foreign = /^https?:/i.test(track.url) && new URL(track.url).origin !== location.origin;
  if (foreign) mediaEl.crossOrigin = 'anonymous'; else mediaEl.removeAttribute('crossorigin');
  mediaEl.src = track.url;

  const isVideo = track.type.startsWith('video') || /\.(mp4|m4v|webm|mkv|mov)$/i.test(track.name);
  videoContainer.classList.toggle('hidden', !isVideo);
  trackMarquee.textContent = `*** ${currentIndex + 1}. ${track.name.toUpperCase()} ***`;
  const ext = (/\.([a-z0-9]+)$/i.exec(track.name) || [, ''])[1].toUpperCase();
  document.getElementById('kbps-badge').textContent = ext || (foreign ? 'STREAM' : '—');
  document.getElementById('khz-badge').textContent = audioCtx ? (audioCtx.sampleRate / 1000).toFixed(1) + ' kHz' : '— kHz';
  renderPlaylist();

  mediaEl.play().then(() => {
    stateIndicator.textContent = 'PLAY';
  }).catch(err => {
    // a page that just opened may not start sound on its own (autoplay rules)
    stateIndicator.textContent = err && err.name === 'NotAllowedError' ? 'READY' : 'ERR';
    if (err && err.name === 'NotAllowedError') flash('*** ▶ DRÜCKEN ZUM ABSPIELEN ***');
    console.warn('Playback error:', err);
  });
}

mediaEl.addEventListener('error', () => {
  if (currentIndex < 0 || !playlist[currentIndex]) return;
  const t = playlist[currentIndex];
  stateIndicator.textContent = 'ERR';
  flash(/^https?:/i.test(t.url) && mediaEl.crossOrigin
    ? '*** STREAM NICHT ABSPIELBAR – DER SERVER ERLAUBT KEINEN ZUGRIFF (CORS) ODER DAS FORMAT FEHLT ***'
    : '*** FORMAT VOM BROWSER NICHT UNTERSTÜTZT ***');
});

function flash(text) { trackMarquee.textContent = text; }

function stopPlayback() {
  mediaEl.pause();
  mediaEl.currentTime = 0;
  stateIndicator.textContent = 'STOP';
}

function nextTrack() {
  if (!playlist.length) return;
  if (isShuffle) {
    playTrack(Math.floor(Math.random() * playlist.length));
  } else if (currentIndex + 1 < playlist.length) {
    playTrack(currentIndex + 1);
  } else if (isRepeat) {
    playTrack(0);
  } else {
    stopPlayback();
  }
}

function prevTrack() {
  if (!playlist.length) return;
  if (mediaEl.currentTime > 3) {
    mediaEl.currentTime = 0;
  } else {
    const target = currentIndex > 0 ? currentIndex - 1 : playlist.length - 1;
    playTrack(target);
  }
}

// --- Transport Events ---
playBtn.addEventListener('click', () => {
  initAudioGraph();
  if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  if (currentIndex === -1 && playlist.length > 0) {
    playTrack(restoredIndex >= 0 && restoredIndex < playlist.length ? restoredIndex : 0);
    restoredIndex = -1;
  } else if (mediaEl.src) {
    mediaEl.play();
    stateIndicator.textContent = 'PLAY';
  }
});

pauseBtn.addEventListener('click', () => {
  if (!mediaEl.paused) {
    mediaEl.pause();
    stateIndicator.textContent = 'PAUSE';
  } else if (mediaEl.src) {
    mediaEl.play();
    stateIndicator.textContent = 'PLAY';
  }
});

stopBtn.addEventListener('click', stopPlayback);
prevBtn.addEventListener('click', prevTrack);
nextBtn.addEventListener('click', nextTrack);

shuffleBtn.addEventListener('click', () => {
  isShuffle = !isShuffle;
  shuffleBtn.classList.toggle('active', isShuffle);
  saveState();
});

repeatBtn.addEventListener('click', () => {
  isRepeat = !isRepeat;
  repeatBtn.classList.toggle('active', isRepeat);
  saveState();
});

volumeSlider.addEventListener('input', (e) => {
  mediaEl.volume = parseFloat(e.target.value);
  saveState();
});

panSlider.addEventListener('input', (e) => {
  if (pannerNode) pannerNode.pan.value = parseFloat(e.target.value);
});

mediaEl.addEventListener('timeupdate', () => {
  timeDisplay.textContent = formatTime(mediaEl.currentTime);
  if (mediaEl.duration) {
    seekSlider.value = (mediaEl.currentTime / mediaEl.duration) * 100;
    durationDisplay.textContent = formatTime(mediaEl.duration);
  }
});

mediaEl.addEventListener('ended', nextTrack);

seekSlider.addEventListener('input', (e) => {
  if (mediaEl.duration) {
    mediaEl.currentTime = (parseFloat(e.target.value) / 100) * mediaEl.duration;
  }
});

fullscreenBtn.addEventListener('click', () => {
  if (mediaEl.requestFullscreen) mediaEl.requestFullscreen();
});

// --- File Inputs & Drag-and-Drop ---
function handleFiles(fileList) {
  Array.from(fileList).forEach((file, idx) => {
    const url = URL.createObjectURL(file);
    addTrackToPlaylist({
      name: file.name,
      url,
      type: file.type || typeOf(file.name),
      own: true
    }, idx === 0 && currentIndex === -1);
  });
}

fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// --- music and videos of the box (permission "files", ShareOS 0.2.0-beta.1+) ---
// streamed with a ticket of the box: starts at once, seeking works
const MEDIA_EXT = ['.mp3', '.wav', '.ogg', '.oga', '.opus', '.flac', '.m4a', '.aac', '.mp4', '.m4v', '.webm'];
const boxBtn = document.getElementById('box-btn'), boxDirBtn = document.getElementById('box-dir-btn');
const isMedia = (n) => MEDIA_EXT.some((x) => n.toLowerCase().endsWith(x));
async function addFromBox(files) {
  let first = currentIndex === -1;
  for (const p of files) {
    try {
      const f = await SOS.fs.open(p.root, p.path || '', p.name);
      addTrackToPlaylist({ name: p.name, url: f.url, type: typeOf(p.name), box: { root: p.root, path: p.path || '', name: p.name } }, first);
      first = false;
    } catch (e) { flash('*** ' + p.name + ': ' + String(e.message).toUpperCase() + ' ***'); }
  }
}
if (SOS && SOS.fs && SOS.fs.pick) {
  boxBtn.hidden = false; boxDirBtn.hidden = false;
  boxBtn.addEventListener('click', async () => {
    const picked = await SOS.fs.pick({ title: 'Musik & Videos von der Box', ext: MEDIA_EXT, multiple: true }).catch(() => null);
    if (picked) addFromBox(picked);
  });
  // a whole folder (an album, a series): its music and videos in name order
  boxDirBtn.addEventListener('click', async () => {
    const picked = await SOS.fs.pick({ title: 'Ordner von der Box abspielen', folder: true }).catch(() => null);
    if (!picked || !picked[0]) return;
    const { root, path } = picked[0];
    try {
      const l = await SOS.fs.list(root, path || '');
      const names = l.entries.filter((e) => e.type === 'file' && isMedia(e.name)).map((e) => e.name)
        .sort((a, b) => a.localeCompare(b, 'de', { numeric: true }));
      if (!names.length) { flash('*** KEINE MUSIK ODER VIDEOS IN DIESEM ORDNER ***'); return; }
      addFromBox(names.map((name) => ({ root, path: path || '', name })));
    } catch (e) { flash('*** ' + String(e.message).toUpperCase() + ' ***'); }
  });
} else if (SOS && SOS.user && SOS.user !== 'guest') {
  // opened from ShareOS, but the account may not use the folders of the box
  const h = document.getElementById('box-hint');
  h.textContent = 'Kein Zugriff auf die Ordner der Box – der Administrator kann ihn unter Benutzer → „Dateien“ einschalten.';
  h.hidden = false;
}

// --- kept for the next time (per account: ShareOS keeps the browser storage of
// the accounts apart): volume, equalizer, shuffle/repeat, the playlist of box files
let restoring = true;
function saveState() {
  if (restoring) return;
  store('webplayer.state', JSON.stringify({
    volume: mediaEl.volume, shuffle: isShuffle, repeat: isRepeat,
    eq: { on: eqEnabled, gains: eqGains, preamp: preampGain, preset: eqPresetSelect.value },
    current: currentIndex >= 0 && playlist[currentIndex] && playlist[currentIndex].box ? playlist.filter((t) => t.box).indexOf(playlist[currentIndex]) : -1,
    tracks: playlist.filter((t) => t.box).slice(0, 500).map((t) => ({ name: t.name, type: t.type, box: t.box, duration: t.duration }))
  }));
}
function restoreState() {
  let st = null;
  try { st = JSON.parse(store('webplayer.state') || 'null'); } catch (e) { st = null; }
  if (st && typeof st === 'object') {
    if (typeof st.volume === 'number') { mediaEl.volume = Math.min(1, Math.max(0, st.volume)); volumeSlider.value = mediaEl.volume; }
    if (st.shuffle) { isShuffle = true; shuffleBtn.classList.add('active'); }
    if (st.repeat) { isRepeat = true; repeatBtn.classList.add('active'); }
    const eq = st.eq || {};
    if (Array.isArray(eq.gains)) eq.gains.slice(0, eqGains.length).forEach((v, i) => setBandGain(i, +v || 0));
    if (typeof eq.preamp === 'number') {
      preampGain = eq.preamp;
      const ps = document.getElementById('preamp-slider'); if (ps) { ps.value = preampGain; ps.dispatchEvent(new Event('input')); }
    }
    if (eq.preset && [...eqPresetSelect.options].some((o) => o.value === eq.preset)) eqPresetSelect.value = eq.preset;
    if (eq.on === false && eqEnabled) eqPowerBtn.click();
    // box files only where the account still has the box (the tickets are fetched when a track plays)
    if (SOS && SOS.fs && Array.isArray(st.tracks)) {
      st.tracks.forEach((t) => { if (t && t.box && t.name) addTrackToPlaylist({ name: t.name, url: null, type: t.type, box: t.box, duration: t.duration }); });
      if (playlist.length) {
        const c = st.current >= 0 && st.current < playlist.length ? st.current : 0;
        trackMarquee.textContent = `*** ${playlist.length} TITEL AUS DER LETZTEN SITZUNG – ▶ ZUM ABSPIELEN ***`;
        currentIndex = -1; restoredIndex = c;
      }
    }
  }
  restoring = false;
}
let restoredIndex = -1;

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length) {
    handleFiles(e.dataTransfer.files);
  }
});

addUrlBtn.addEventListener('click', () => {
  const url = prompt('Gib eine direkte Audio-/Video-Stream-URL ein (z.B. MP3/OGG/WebM):');
  if (url && url.trim()) {
    const clean = url.trim();
    addTrackToPlaylist({
      name: clean.split('/').pop() || 'Web Stream',
      url: clean,
      type: 'audio/stream'
    }, true);
  }
});

clearPlaylistBtn.addEventListener('click', () => {
  stopPlayback();
  playlist.forEach(t => { if (t.own) URL.revokeObjectURL(t.url); });
  playlist = [];
  currentIndex = -1;
  saveState();
  trackMarquee.textContent = '*** PLAYLIST GELEERT ***';
  renderPlaylist();
});

playlistSearch.addEventListener('input', renderPlaylist);

// --- Skin Switcher ---
function setSkin(skin, keep) {
  currentSkinIndex = Math.max(0, skins.indexOf(skin));
  if (skin === 'classic') document.documentElement.removeAttribute('data-skin');
  else document.documentElement.setAttribute('data-skin', skin);
  if (keep) store('webplayer.skin', skin);
}
skinToggleBtn.addEventListener('click', () => setSkin(skins[(currentSkinIndex + 1) % skins.length], true));
// ShareOS look by default inside ShareOS; the theme (light/dark) follows on its own
setSkin(store('webplayer.skin') || (SOS ? 'shareos' : 'classic'));

// --- Built-in Chiptune / Synth WAV Generator (Instant Demo without external files) ---
function generateSynthDemoWav() {
  const sampleRate = 44100;
  const durationSeconds = 16;
  const numSamples = sampleRate * durationSeconds;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeStr(offset, str) {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  // Melody arpeggio notes (Hz)
  const bassNotes = [110, 110, 130.81, 146.83, 98, 98, 130.81, 164.81];
  const arpNotes = [220, 261.63, 329.63, 440, 329.63, 261.63, 293.66, 349.23, 440, 587.33, 440, 349.23];

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const beat = Math.floor(t * 8);
    const bar = Math.floor(t * 2);

    const leadFreq = arpNotes[beat % arpNotes.length];
    const bassFreq = bassNotes[bar % bassNotes.length];

    // Square + Sawtooth synth mix + Kick/Hi-Hat pulse
    const lead = (Math.sin(2 * Math.PI * leadFreq * t) >= 0 ? 0.25 : -0.25) * Math.exp(-((t * 8) % 1) * 2.5);
    const bass = ((2 * ((t * bassFreq) - Math.floor(0.5 + t * bassFreq))) * 0.35);
    const kickEnv = Math.exp(-((t * 2) % 1) * 14);
    const kick = Math.sin(2 * Math.PI * (55 + 110 * kickEnv) * t) * kickEnv * 0.4;

    const sample = Math.max(-1, Math.min(1, lead + bass + kick));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

demoSynthBtn.addEventListener('click', () => {
  const wavBlob = generateSynthDemoWav();
  const url = URL.createObjectURL(wavBlob);
  addTrackToPlaylist({
    name: 'ShareOS CyberSynth Demo (Generated 16s Loop).wav',
    url,
    type: 'audio/wav',
    own: true
  }, true);
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

// space: play/pause, arrows: seek 5 s (not while typing in the search field)
window.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'range') return;
  if (e.key === ' ') { e.preventDefault(); pauseBtn.click(); }
  else if (e.key === 'ArrowRight' && mediaEl.duration) mediaEl.currentTime = Math.min(mediaEl.duration, mediaEl.currentTime + 5);
  else if (e.key === 'ArrowLeft' && mediaEl.duration) mediaEl.currentTime = Math.max(0, mediaEl.currentTime - 5);
});

// --- Initialize ---
buildEqualizerUI();
restoreState();
renderPlaylist();
renderVisualizer();

// --- a medium of the box, opened from the ShareOS file browser ---
// streamed from the apps web server with the ticket (no copy in the browser)
if (SOS && SOS.file) {
  const ticket = new URLSearchParams(location.search).get('file');
  SOS.file.info().then((info) => {
    const name = SOS.file.name;
    document.title = name + ' – WinWeb Player';
    addTrackToPlaylist({ name, url: SOS.file.url || '/_shareos/cgi/file?t=' + encodeURIComponent(ticket), type: typeOf(name) }, true);
  }).catch((e) => flash('*** DATEI KONNTE NICHT GEÖFFNET WERDEN: ' + String(e.message).toUpperCase() + ' ***'));
}
