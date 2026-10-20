'use strict';
// BeatBox Studio – 16-step drum sequencer and synthesizer (Web Audio).
// One sound engine for playing and for the WAV export: the export renders the
// pattern with an OfflineAudioContext, so the file sounds like what you hear.
// Projects are small JSON files (.beatbox); with the permission "files" they
// and the WAV go onto the box (ShareOS.fs), and WinWeb Player plays the loop.

const APP = 'beatbox';
const SOS = window.ShareOS || null;
if (SOS) document.documentElement.setAttribute('data-look', 'shareos');
const $ = (id) => document.getElementById(id);

// --- ShareOS app bridge (same as ShareCommander) ----------------------------
const APP_SIZE = { webplayer: { width: 940, height: 600 } };
function openApp(app) {
  const size = APP_SIZE[app] || { width: 1000, height: 700 };
  if (SOS && SOS.openApp) return SOS.openApp(app, size);
  return window.open(new URL('/' + app + '/index.html', location.href).href, 'sosapp-' + app, `popup,width=${size.width},height=${size.height}`);
}
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
const seen = {}, pending = {};
on('pong', (d, from) => { if (from) seen[from] = Date.now(); });
on('app-ready', (d, from) => {
  if (!from) return;
  seen[from] = Date.now();
  const q = pending[from]; delete pending[from];
  (q || []).forEach((m) => emit(m.type, m.data));
});
on('ping', () => emit('pong', {}));
const alive = (app) => Date.now() - (seen[app] || 0) < 8000;
setInterval(() => emit('ping', {}), 3000);
emit('ping', {});
emit('app-ready', {});
function sendTo(app, type, data, label) {
  if (alive(app)) { emit(type, data); return; }
  (pending[app] = pending[app] || []).push({ type, data });
  if (!openApp(app)) status(`${label}: Fenster blockiert – Pop-ups für diese Seite erlauben.`, true);
  setTimeout(() => {
    if (pending[app]) { delete pending[app]; status(`${label} meldet sich nicht – ist die App installiert?`, true); }
  }, 20000);
}

function status(text, bad) {
  const el = $('bb-status');
  el.textContent = text;
  el.style.color = bad ? 'var(--accent)' : '';
}

// --- pattern and settings --------------------------------------------------------------
const TRACKS = [
  { name: 'KICK 808', id: 'kick' },
  { name: 'SNARE', id: 'snare' },
  { name: 'HI-HAT', id: 'hihat' },
  { name: 'CLAP', id: 'clap' },
  { name: 'SYNTH BASS', id: 'bass' }
];
const PRESETS = {
  cyber: [
    [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,1,0],
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1],
    [0,0,0,0, 1,0,0,1, 0,0,0,0, 1,0,0,0],
    [1,0,1,0, 0,1,1,0, 1,0,1,0, 0,1,0,1]
  ],
  house: [
    [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0],
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0],
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    [1,0,0,1, 0,0,1,0, 1,0,0,1, 0,1,0,0]
  ],
  hiphop: [
    [1,0,0,1, 0,0,0,0, 1,0,1,0, 0,0,0,0],
    [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0],
    [1,0,1,0, 1,0,1,0, 1,0,1,0, 1,0,1,1],
    [0,0,0,0, 0,0,0,0, 0,0,0,0, 1,0,0,0],
    [1,0,0,0, 0,0,1,0, 1,0,0,0, 0,0,0,0]
  ],
  clear: TRACKS.map(() => new Array(16).fill(0))
};
const BASS_NOTES = [110, 110, 130.81, 110, 146.83, 130.81, 110, 98, 110, 110, 130.81, 110, 164.81, 146.83, 130.81, 98];

let pattern = PRESETS.cyber.map((r) => r.slice());
let mute = TRACKS.map(() => false);

const P = {
  bpm: $('bpm-input'), vol: $('vol-input'), osc: $('osc-type'),
  cutoff: $('cutoff-slider'), attack: $('attack-slider'), release: $('release-slider')
};
const bpm = () => Math.min(200, Math.max(60, parseInt(P.bpm.value, 10) || 124));
const stepSec = () => 60 / bpm() / 4;
const synthParams = () => ({
  type: P.osc.value,
  cutoff: parseFloat(P.cutoff.value),
  attack: parseFloat(P.attack.value),
  release: parseFloat(P.release.value)
});

function project() {
  return {
    app: 'beatbox', format: 1, bpm: bpm(), volume: parseFloat(P.vol.value),
    tracks: TRACKS.map((t) => t.id), pattern, mute, synth: synthParams()
  };
}
function applyProject(p) {
  if (!p || p.app !== 'beatbox' || !Array.isArray(p.pattern)) throw new Error('keine BeatBox-Datei');
  pattern = TRACKS.map((t, i) => {
    const row = Array.isArray(p.pattern[i]) ? p.pattern[i] : [];
    return Array.from({ length: 16 }, (_, s) => (row[s] ? 1 : 0));
  });
  mute = TRACKS.map((t, i) => !!(Array.isArray(p.mute) && p.mute[i]));
  if (p.bpm) P.bpm.value = Math.min(200, Math.max(60, +p.bpm || 124));
  if (typeof p.volume === 'number') P.vol.value = Math.min(1, Math.max(0, p.volume));
  const s = p.synth || {};
  if (['sawtooth', 'square', 'triangle', 'sine'].includes(s.type)) P.osc.value = s.type;
  if (s.cutoff) P.cutoff.value = s.cutoff;
  if (s.attack) P.attack.value = s.attack;
  if (s.release) P.release.value = s.release;
  showParams();
  renderRack();
  if (master) master.gain.value = parseFloat(P.vol.value);
}

// remember the work between visits (per account inside ShareOS)
const SKEY = 'beatbox.project';
let saveTimer = null;
function remember() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(SKEY, JSON.stringify(project())); } catch (e) { } }, 300);
}

// --- sound engine (works with AudioContext and OfflineAudioContext) -----------------------
const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, b);
  }
  return b;
}
function noiseHit(ctx, out, t, len, filterType, freq, level) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = filterType;
  f.frequency.setValueAtTime(freq, t);
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + len);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + len + 0.02);
}
function kick(ctx, out, t) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(140, t);
  osc.frequency.exponentialRampToValueAtTime(35, t + 0.12);
  g.gain.setValueAtTime(0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
  osc.connect(g); g.connect(out);
  osc.start(t); osc.stop(t + 0.26);
}
const snare = (ctx, out, t) => noiseHit(ctx, out, t, 0.15, 'highpass', 600, 0.5);
const hihat = (ctx, out, t) => noiseHit(ctx, out, t, 0.05, 'highpass', 6000, 0.28);
function clap(ctx, out, t) {
  // three short bursts and a tail, like hands that do not hit at the same time
  [0, 0.012, 0.024].forEach((d) => noiseHit(ctx, out, t + d, 0.03, 'bandpass', 1200, 0.45));
  noiseHit(ctx, out, t + 0.03, 0.16, 'bandpass', 1100, 0.35);
}
function synth(ctx, out, t, freq, dur, p) {
  const osc = ctx.createOscillator();
  const f = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = p.type;
  osc.frequency.setValueAtTime(freq, t);
  f.type = 'lowpass';
  f.frequency.setValueAtTime(p.cutoff, t);
  g.gain.setValueAtTime(0.001, t);
  g.gain.linearRampToValueAtTime(0.35, t + p.attack);
  g.gain.exponentialRampToValueAtTime(0.001, t + p.attack + dur + p.release);
  osc.connect(f); f.connect(g); g.connect(out);
  osc.start(t);
  osc.stop(t + p.attack + dur + p.release + 0.02);
}
const VOICES = [kick, snare, hihat, clap];
function playStep(ctx, out, step, t, p) {
  VOICES.forEach((v, i) => { if (pattern[i][step] && !mute[i]) v(ctx, out, t); });
  if (pattern[4][step] && !mute[4]) synth(ctx, out, t, BASS_NOTES[step], 0.1, p);
}

// --- live playback with a look-ahead scheduler (exact timing, no drift) ----------------------
let ctx = null, master = null, analyser = null;
function initAudio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = parseFloat(P.vol.value);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    master.connect(analyser);
    analyser.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

let playing = false, timer = null, nextStep = 0, nextTime = 0;
const shown = [];          // steps scheduled, shown when their time has come
function scheduler() {
  const p = synthParams();
  while (nextTime < ctx.currentTime + 0.12) {
    playStep(ctx, master, nextStep, nextTime, p);
    shown.push({ step: nextStep, time: nextTime });
    nextTime += stepSec();
    nextStep = (nextStep + 1) % 16;
  }
}
function start() {
  initAudio();
  if (playing) return;
  playing = true;
  nextStep = 0;
  nextTime = ctx.currentTime + 0.05;
  scheduler();
  timer = setInterval(scheduler, 25);
  $('play-btn').classList.add('playing');
  $('status-badge').textContent = 'PLAY';
}
function stop() {
  playing = false;
  clearInterval(timer);
  shown.length = 0;
  highlight(-1);
  $('play-btn').classList.remove('playing');
  $('status-badge').textContent = 'BEREIT';
}
$('play-btn').addEventListener('click', start);
$('stop-btn').addEventListener('click', stop);

let current = -1;
function highlight(step) {
  if (step === current) return;
  current = step;
  document.querySelectorAll('.step-btn.current-step').forEach((b) => b.classList.remove('current-step'));
  if (step >= 0) document.querySelectorAll(`.step-btn[data-step="${step}"]`).forEach((b) => b.classList.add('current-step'));
  $('step-counter').textContent = step >= 0 ? `STEP: ${String(step + 1).padStart(2, '0')} / 16` : 'STEP: -- / 16';
}

// --- the rack --------------------------------------------------------------------------------
function renderRack() {
  const rack = $('rack-container');
  rack.textContent = '';
  TRACKS.forEach((t, ti) => {
    const row = document.createElement('div');
    row.className = 'track-row';
    row.dataset.track = ti;
    const label = document.createElement('button');
    label.className = 'track-label' + (mute[ti] ? ' muted' : '');
    label.textContent = t.name;
    label.title = 'Klicken: stumm schalten';
    label.addEventListener('click', () => {
      mute[ti] = !mute[ti];
      label.classList.toggle('muted', mute[ti]);
      remember();
    });
    const grid = document.createElement('div');
    grid.className = 'steps-grid';
    for (let s = 0; s < 16; s++) {
      const b = document.createElement('button');
      b.className = 'step-btn' + (pattern[ti][s] ? ' active' : '');
      b.dataset.step = s;
      b.title = `${t.name} · Step ${s + 1}`;
      b.addEventListener('click', () => {
        pattern[ti][s] = pattern[ti][s] ? 0 : 1;
        b.classList.toggle('active', !!pattern[ti][s]);
        remember();
      });
      grid.appendChild(b);
    }
    row.append(label, grid);
    rack.appendChild(row);
  });
  current = -1;
}

$('preset-select').addEventListener('change', (e) => {
  const p = PRESETS[e.target.value];
  if (p) { pattern = p.map((r) => r.slice()); renderRack(); remember(); }
  e.target.value = '';
});

// --- parameters -------------------------------------------------------------------------------
function showParams() {
  $('cutoff-val').textContent = `${P.cutoff.value} Hz`;
  $('attack-val').textContent = `${(+P.attack.value).toFixed(3).replace(/0$/, '')} s`;
  $('release-val').textContent = `${(+P.release.value).toFixed(2)} s`;
}
[P.cutoff, P.attack, P.release, P.osc].forEach((el) => el.addEventListener('input', () => { showParams(); remember(); }));
P.bpm.addEventListener('change', () => { P.bpm.value = bpm(); remember(); });
P.vol.addEventListener('input', () => { if (master) master.gain.value = parseFloat(P.vol.value); remember(); });

// --- keyboard (piano and transport) ----------------------------------------------------------
// physical keys (e.code), so the row is the same on QWERTZ and QWERTY; labels for QWERTZ
const NOTES = [
  { note: 'C4', freq: 261.63, code: 'KeyA', label: 'A' },
  { note: 'C#4', freq: 277.18, code: 'KeyW', label: 'W', sharp: true },
  { note: 'D4', freq: 293.66, code: 'KeyS', label: 'S' },
  { note: 'D#4', freq: 311.13, code: 'KeyE', label: 'E', sharp: true },
  { note: 'E4', freq: 329.63, code: 'KeyD', label: 'D' },
  { note: 'F4', freq: 349.23, code: 'KeyF', label: 'F' },
  { note: 'F#4', freq: 369.99, code: 'KeyT', label: 'T', sharp: true },
  { note: 'G4', freq: 392.00, code: 'KeyG', label: 'G' },
  { note: 'G#4', freq: 415.30, code: 'KeyY', label: 'Z', sharp: true },
  { note: 'A4', freq: 440.00, code: 'KeyH', label: 'H' },
  { note: 'A#4', freq: 466.16, code: 'KeyU', label: 'U', sharp: true },
  { note: 'B4', freq: 493.88, code: 'KeyJ', label: 'J' },
  { note: 'C5', freq: 523.25, code: 'KeyK', label: 'K' }
];
function playNote(freq) {
  initAudio();
  synth(ctx, master, ctx.currentTime, freq, 0.25, synthParams());
}
const keysEl = $('piano-keys');
NOTES.forEach((n) => {
  const k = document.createElement('div');
  k.className = 'key' + (n.sharp ? ' sharp' : '');
  k.dataset.code = n.code;
  const a = document.createElement('span'); a.textContent = n.note;
  const b = document.createElement('span'); b.textContent = `[${n.label}]`; b.style.cssText = 'opacity:.5;font-size:9px';
  k.append(a, b);
  k.addEventListener('pointerdown', (e) => { e.preventDefault(); playNote(n.freq); });
  keysEl.appendChild(k);
});
const typing = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveProject(); return; }
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
  if (e.code === 'Space') { e.preventDefault(); playing ? stop() : start(); return; }
  const n = NOTES.find((x) => x.code === e.code);
  if (!n) return;
  playNote(n.freq);
  const el = keysEl.querySelector(`.key[data-code="${n.code}"]`);
  if (el) { el.classList.add('pressed'); setTimeout(() => el.classList.remove('pressed'), 180); }
});

// --- oscilloscope and step display --------------------------------------------------------------
const canvas = $('scope-canvas');
const g2 = canvas.getContext('2d');
let colors = null;
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  colors = { bg: cs.getPropertyValue('--scope-bg').trim() || '#090b0e', line: cs.getPropertyValue('--accent').trim() || '#f97316', grid: cs.getPropertyValue('--border').trim() || '#2e3442' };
}
if (SOS && SOS.onTheme) SOS.onTheme(() => setTimeout(readColors, 0));
let data = null;
function frame() {
  requestAnimationFrame(frame);
  if (ctx && playing) {
    let step = -1;
    while (shown.length && shown[0].time <= ctx.currentTime) step = shown.shift().step;
    if (step >= 0) highlight(step);
  }
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  if (!colors) readColors();
  g2.fillStyle = colors.bg;
  g2.fillRect(0, 0, w, h);
  g2.strokeStyle = colors.grid;
  g2.lineWidth = 1;
  g2.beginPath(); g2.moveTo(0, h / 2); g2.lineTo(w, h / 2); g2.stroke();
  if (!analyser) return;
  if (!data) data = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(data);
  g2.strokeStyle = colors.line;
  g2.lineWidth = 2 * dpr;
  g2.beginPath();
  for (let i = 0; i < data.length; i++) {
    const x = (i / (data.length - 1)) * w, y = (data[i] / 255) * h;
    if (i) g2.lineTo(x, y); else g2.moveTo(x, y);
  }
  g2.stroke();
}

// --- WAV export: render with the same engine, offline ---------------------------------------------
async function renderWav() {
  const loops = parseInt($('loops-select').value, 10) || 2;
  const rate = 44100, step = stepSec(), p = synthParams();
  const len = Math.round(loops * 16 * step * rate);
  const tail = Math.round((p.attack + p.release + 0.4) * rate);
  const off = new OfflineAudioContext(2, len + tail, rate);
  const out = off.createGain();
  out.gain.value = parseFloat(P.vol.value);
  out.connect(off.destination);
  for (let i = 0; i < loops * 16; i++) playStep(off, out, i % 16, i * step, p);
  const buf = await off.startRendering();
  // fold the tail back onto the start: the file loops without a click or gap
  const ch = [buf.getChannelData(0), buf.getChannelData(1)];
  for (const c of ch) for (let i = 0; i < tail && len + i < c.length; i++) c[i % len] += c[len + i];
  // 16 bit PCM, stereo
  const ab = new ArrayBuffer(44 + len * 4), v = new DataView(ab);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + len * 4, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, len * 4, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    for (const c of ch) {
      const s = Math.max(-1, Math.min(1, c[i]));
      v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      o += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}
const wavName = () => `${baseName()}-${bpm()}bpm.wav`;
async function withWav(label, fn) {
  status(`${label}: Loop wird berechnet …`);
  try { await fn(await renderWav()); }
  catch (e) { status(`${label}: ${e.message}`, true); }
}
$('export-wav-btn').addEventListener('click', () => withWav('WAV', (blob) => {
  download(blob, wavName());
  status(`${wavName()} heruntergeladen.`);
}));
$('send-winweb-btn').addEventListener('click', () => withWav('WinWeb', (blob) => {
  sendTo('webplayer', 'open-media', { to: 'webplayer', name: `BeatBox – ${baseName()} (${bpm()} BPM).wav`, blob }, 'WinWeb Player');
  status('Loop an WinWeb Player geschickt.');
}));

// --- projects: on the box (permission "files"), opened from the file browser, or local -------------
let fileHandle = null, fileName = '';
function baseName() { return (fileName || 'beatbox-loop').replace(/\.(beatbox|json)$/i, ''); }
function setFile(name, handle) {
  fileName = name; fileHandle = handle;
  $('bb-file').textContent = name || 'Neues Projekt';
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const projectBlob = () => new Blob([JSON.stringify(project(), null, 1)], { type: 'application/json' });
const BOX = !!(SOS && SOS.fs && SOS.fs.pick);

async function saveProject() {
  try {
    if (fileHandle) {
      await fileHandle.save(projectBlob());
      status(`Gespeichert: ${fileName}`);
      return;
    }
    if (BOX) {
      const picked = await SOS.fs.pick({ title: 'Projekt auf der Box speichern', save: true, name: (fileName || 'mein-beat') .replace(/\.(beatbox|json)$/i, '') + '.beatbox' });
      if (!picked || !picked.length) return;
      const p = picked[0];
      const f = await SOS.fs.open(p.root, p.path, p.name, { write: true, create: true });
      await f.save(projectBlob());
      setFile(p.name, f);
      status(`Gespeichert: ${p.path ? p.path + '/' : ''}${p.name}`);
      return;
    }
    const name = (fileName || 'mein-beat.beatbox');
    download(projectBlob(), name);
    setFile(name, null);
    status(`${name} heruntergeladen.`);
  } catch (e) { status('Speichern: ' + e.message, true); }
}
$('save-btn').addEventListener('click', saveProject);

async function openProject() {
  if (!BOX) { $('file-input').click(); return; }
  const picked = await SOS.fs.pick({ title: 'Projekt öffnen', ext: ['.beatbox', '.json'] });
  if (!picked || !picked.length) return;
  const p = picked[0];
  try {
    // with write access when the user has it, so "Speichern" goes back into the same file
    let f, rw = true;
    try { f = await SOS.fs.open(p.root, p.path, p.name, { write: true }); }
    catch (e) { f = await SOS.fs.open(p.root, p.path, p.name); rw = false; }
    applyProject(JSON.parse(await f.text()));
    setFile(p.name, rw ? f : null);
    remember();
    status(`Geöffnet: ${p.name}`);
  } catch (e) { status(`${p.name}: ${e.message}`, true); }
}
$('open-btn').addEventListener('click', openProject);
$('file-input').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  try { applyProject(JSON.parse(await f.text())); setFile(f.name, null); remember(); status(`Geöffnet: ${f.name}`); }
  catch (err) { status(`${f.name}: ${err.message}`, true); }
});

if (BOX) {
  $('box-wav-btn').hidden = false;
  $('box-wav-btn').addEventListener('click', async () => {
    const picked = await SOS.fs.pick({ title: 'WAV auf der Box speichern', save: true, name: wavName() });
    if (!picked || !picked.length) return;
    const p = picked[0];
    await withWav('WAV', async (blob) => {
      const f = await SOS.fs.open(p.root, p.path, p.name, { write: true, create: true });
      await f.save(blob);
      status(`Gespeichert: ${p.path ? p.path + '/' : ''}${p.name}`);
    });
  });
}

// --- start ---------------------------------------------------------------------------------------
(async () => {
  try {
    const saved = localStorage.getItem(SKEY);
    if (saved) applyProject(JSON.parse(saved));
  } catch (e) { }
  // a .beatbox file opened from the ShareOS file browser
  if (SOS && SOS.file) {
    try {
      const info = await SOS.file.info();
      applyProject(JSON.parse(await SOS.file.text()));
      setFile(info.name, info.mode === 'edit' ? SOS.file : null);
      status(`Geöffnet: ${info.name}${info.mode === 'edit' ? '' : ' (nur lesen)'}`);
    } catch (e) { status('Datei: ' + e.message, true); }
  }
  showParams();
  renderRack();
  frame();
})();
