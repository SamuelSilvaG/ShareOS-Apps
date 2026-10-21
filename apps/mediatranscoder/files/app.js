'use strict';
// MediaTranscoder – media jobs on the box through the ShareOS app SDK:
//   ShareOS.fs     choose the file and the target folder (permission "files")
//   ShareOS.media  probe the file, start/watch/cancel jobs (permission "media",
//                  ShareOS 0.2.0-beta.5+, system app "ffmpeg")
// The box runs FFmpeg itself, one job after another, with the user's rights.
// Video is never re-encoded (the box's ARM CPU has no FPU – far too slow):
// "remux" copies the streams into another container, "audio" converts or
// copies one audio track. The preview shows what the box will run.

const APP = 'mediatranscoder';
const SOS = window.ShareOS || null;
const $ = (id) => document.getElementById(id);

const AUDIO = {
  mp3: { label: 'MP3', ext: 'mp3', lossy: true, codec: 'libmp3lame' },
  m4a: { label: 'M4A (AAC)', ext: 'm4a', lossy: true, codec: 'aac' },
  opus: { label: 'Opus', ext: 'opus', lossy: true, codec: 'libopus' },
  flac: { label: 'FLAC (verlustfrei)', ext: 'flac', lossy: false, codec: 'flac' },
  wav: { label: 'WAV (unkomprimiert)', ext: 'wav', lossy: false, codec: 'pcm_s16le' },
  copy: { label: 'Original-Spur, ohne Umwandlung', ext: null, lossy: false, codec: 'copy' }
};
const REMUX = {
  mp4: { label: 'MP4', ext: 'mp4' },
  mkv: { label: 'MKV (Matroska)', ext: 'mkv' },
  mov: { label: 'MOV (QuickTime)', ext: 'mov' },
  ts: { label: 'TS (MPEG-Transportstrom)', ext: 'ts' },
  webm: { label: 'WebM (nur VP8/VP9/AV1 + Opus/Vorbis)', ext: 'webm' }
};
// extension of a copied audio track (same table as the box)
const COPY_EXT = { aac: 'm4a', alac: 'm4a', mp3: 'mp3', mp2: 'mp2', opus: 'opus', vorbis: 'ogg', flac: 'flac', ac3: 'mka', eac3: 'mka' };
const MEDIA_EXT = ['.mp3', '.m4a', '.aac', '.ogg', '.oga', '.opus', '.flac', '.wav', '.wma', '.mka', '.ac3',
  '.mp4', '.m4v', '.mkv', '.mov', '.webm', '.avi', '.ts', '.m2ts', '.mts', '.mpg', '.mpeg', '.wmv', '.flv', '.3gp'];
const HINT = {
  audio: 'Wandelt eine Tonspur in ein anderes Audioformat oder holt sie unverändert aus einem Video heraus. Ein Video wird dabei nicht mitgenommen.',
  remux: 'Packt Bild, Ton und Untertitel ohne Neukodierung in einen anderen Container – schnell und ohne Qualitätsverlust. Videos neu kodieren kann die Box nicht (dafür ist ihr Prozessor zu langsam).'
};
// messages of the box -> German
const ERRORS = [
  [/not installed/, 'FFmpeg ist nicht installiert – System-App „ffmpeg“ im Store installieren.'],
  [/^not a media file/, 'Das ist keine Mediendatei, die FFmpeg lesen kann.'],
  [/^output file exists/, 'Eine Datei mit diesem Namen gibt es im Zielordner schon.'],
  [/^too many jobs/, 'Es warten schon zu viele Aufträge – erst einige fertig werden lassen.'],
  [/^invalid time/, 'Zeitangabe ungültig – z. B. 90, 01:30 oder 00:01:30.'],
  [/^invalid name/, 'Ungültiger Dateiname.'],
  [/^no such audio track/, 'Diese Audiospur gibt es nicht.'],
  [/^invalid format/, 'Dieses Format geht hier nicht.'],
  [/^(unknown folder|not allowed|no access)/, 'Kein Zugriff – die App bitte neu öffnen.'],
  [/^not a file/, 'Die Datei gibt es nicht mehr.'],
  [/^cannot start ffmpeg/, 'FFmpeg ließ sich nicht starten.']
];
function de(msg) {
  msg = String(msg || '');
  for (const [re, t] of ERRORS) if (re.test(msg)) return t;
  return msg;
}

// --- small helpers -----------------------------------------------------------------
let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4000);
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function fmtTime(s) {
  s = Math.max(0, Math.round(+s || 0));
  const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0');
}
function fmtSize(b) {
  b = +b || 0;
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB', 'TB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return b.toFixed(b < 10 ? 1 : 0).replace('.', ',') + ' ' + u[i];
}
const TIME_RE = /^(?:(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d{1,3})?|\d{1,6}(?:\.\d{1,3})?)$/;
function shq(s) { return /^[\w.\/:+-]+$/.test(s) ? s : "'" + String(s).replace(/'/g, "'\\''") + "'"; }

// root names -> what the user sees
let roots = [];
function rootLabel(name) {
  const r = roots.find((x) => x.name === name);
  if (r && r.home) return 'Mein Ordner';
  return name;
}
function where(f) { return rootLabel(f.root) + (f.path ? '/' + f.path : ''); }

// --- other apps: WinWeb Player gets the result ("open-media", as ShareCommander does)
const seen = {}, pending = {};
if (SOS) {
  SOS.on('pong', (d, from) => { if (from) seen[from] = Date.now(); });
  SOS.on('app-ready', (d, from) => {
    if (!from) return;
    seen[from] = Date.now();
    const q = pending[from]; delete pending[from];
    (q || []).forEach((m) => SOS.emit(m.type, m.data));
  });
  SOS.on('ping', () => SOS.emit('pong', {}));
  setInterval(() => SOS.emit('ping', {}), 3000);
  SOS.emit('ping', {});
  SOS.emit('app-ready', {});
}
function sendTo(app, type, data, label) {
  if (Date.now() - (seen[app] || 0) < 8000) { SOS.emit(type, data); return; }
  (pending[app] = pending[app] || []).push({ type, data });
  try { SOS.openApp(app); } catch (e) { toast(label + ': Fenster blockiert – Pop-ups für diese Seite erlauben.'); }
  setTimeout(() => {
    if (pending[app]) { delete pending[app]; toast(label + ' meldet sich nicht – ist die App installiert?'); }
  }, 20000);
}

// --- state ---------------------------------------------------------------------------
const st = {
  src: null,        // {root, path, name}
  info: null,       // probe result
  dest: null,       // {root, path} or null = folder of the source
  nameTouched: false,
  installed: null
};
const action = () => document.querySelector('input[name="action"]:checked').value;
const audioStreams = () => (st.info ? st.info.streams.filter((s) => s.type === 'audio') : []);
const hasVideo = () => !!(st.info && st.info.streams.some((s) => s.type === 'video'));

function outExt() {
  const f = $('format').value;
  if (action() === 'remux') return REMUX[f] ? REMUX[f].ext : '';
  if (f === 'copy') {
    const a = audioStreams()[+$('stream').value || 0];
    if (!a) return '';
    return COPY_EXT[a.codec] || (/^pcm_/.test(a.codec || '') ? 'wav' : 'mka');
  }
  return AUDIO[f] ? AUDIO[f].ext : '';
}
function baseName(n) { return String(n || '').replace(/\.[A-Za-z0-9]{1,5}$/, ''); }
function suggestName() {
  if (!st.src || st.nameTouched) return;
  const base = baseName(st.src.name), ext = outExt();
  const same = !st.dest && st.src.name.toLowerCase() === (base + '.' + ext).toLowerCase();
  $('outname').value = same ? base + '-neu' : base;
}

function fillFormats() {
  const a = action(), sel = $('format'), prev = sel.value;
  sel.textContent = '';
  for (const [k, v] of Object.entries(a === 'remux' ? REMUX : AUDIO)) {
    const o = el('option', null, v.label); o.value = k; sel.appendChild(o);
  }
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  $('action-hint').textContent = HINT[a];
}
function fillStreams() {
  const sel = $('stream'); sel.textContent = '';
  const auds = audioStreams();
  if (!auds.length) { const o = el('option', null, st.info ? 'keine Tonspur' : '–'); o.value = '0'; sel.appendChild(o); return; }
  auds.forEach((s, i) => {
    const bits = [s.codec, s.channels ? (s.channels === 1 ? 'mono' : s.channels === 2 ? 'stereo' : s.channels + ' Kanäle') : null,
      s.language && s.language !== 'und' ? s.language : null, s.title].filter(Boolean);
    const o = el('option', null, (i + 1) + ': ' + bits.join(' · ')); o.value = String(i); sel.appendChild(o);
  });
}

// what the box will run (the same rules as the box; for reading only)
function preview() {
  const p = $('preview');
  if (!st.src) { p.textContent = 'ffmpeg -i …'; return; }
  const args = ['ffmpeg', '-n'];
  const ss = $('trim').checked ? $('t-start').value.trim() : '', t = $('trim').checked ? $('t-dur').value.trim() : '';
  const f = $('format').value, a = action();
  const auds = audioStreams(), n = +$('stream').value || 0;
  if (a === 'audio' && f !== 'copy' && auds[n]) {
    if (auds[n].codec === 'aac') args.push('-c:a', 'aac_fixed');
    else if (auds[n].codec === 'ac3') args.push('-c:a', 'ac3_fixed');
  }
  if (ss && ss !== '0' && !/^0+:0+(:0+)?(\.0+)?$/.test(ss)) args.push('-ss', ss);
  if (t) args.push('-t', t);
  args.push('-i', where(st.src) + '/' + st.src.name);
  if (a === 'remux') {
    args.push('-map', '0:v?', '-map', '0:a?');
    if (f === 'mkv') args.push('-map', '0:s?');
    args.push('-c', 'copy');
    if (f === 'mp4' || f === 'mov') args.push('-movflags', '+faststart');
  } else {
    args.push('-map', '0:a:' + n, '-vn', '-sn', '-c:a', AUDIO[f].codec);
    if (AUDIO[f].lossy) args.push('-b:a', $('bitrate').value);
  }
  const dest = st.dest || st.src;
  args.push(where(dest) + '/' + ($('outname').value.trim() || '…') + '.' + outExt());
  p.textContent = args.map(shq).join(' ');
}

function refresh() {
  const a = action(), f = $('format').value;
  $('row-bitrate').classList.toggle('hidden', !(a === 'audio' && AUDIO[f] && AUDIO[f].lossy));
  $('row-stream').classList.toggle('hidden', a !== 'audio');
  $('t-start').disabled = $('t-dur').disabled = !$('trim').checked;
  $('outext').textContent = outExt() ? '.' + outExt() : '';
  $('dest').textContent = st.dest ? where(st.dest) : (st.src ? where(st.src) + ' (wie die Quelle)' : 'wie die Quelldatei');
  $('dest').classList.toggle('muted', !st.dest);
  let why = '';
  if (!st.info) why = 'x';
  else if (a === 'audio' && !audioStreams().length) why = 'Die Datei hat keine Tonspur.';
  if ($('trim').checked) {
    const s = $('t-start').value.trim(), d = $('t-dur').value.trim();
    if ((s && !TIME_RE.test(s)) || (d && !TIME_RE.test(d))) why = 'Zeitangabe ungültig – z. B. 90, 01:30 oder 00:01:30.';
  }
  if (!$('outname').value.trim()) why = why || 'x';
  $('start').disabled = !!why || st.installed === false;
  $('start').title = why && why !== 'x' ? why : '';
  preview();
}

// --- source --------------------------------------------------------------------------
async function setSource(f) {
  st.src = f; st.info = null; st.nameTouched = false;
  const box = $('src-info');
  box.className = 'src-info muted';
  box.textContent = 'Lese ' + f.name + ' …';
  refresh();
  try {
    const info = await SOS.media.probe(f.root, f.path, f.name);
    if (st.src !== f) return;
    st.info = info;
    box.className = 'src-info';
    box.textContent = '';
    box.appendChild(el('div', 'name', f.name));
    box.appendChild(el('div', 'muted', [where(f), info.format, info.duration ? fmtTime(info.duration) : null, info.size ? fmtSize(info.size) : null].filter(Boolean).join(' · ')));
    const ul = el('ul', 'streams');
    for (const s of info.streams) {
      const li = el('li');
      li.appendChild(el('span', 'st', s.type === 'video' ? 'Video' : s.type === 'audio' ? 'Audio' : s.type === 'subtitle' ? 'Untertitel' : (s.type || '?')));
      const bits = [s.codec];
      if (s.width && s.height) bits.push(s.width + '×' + s.height);
      if (s.channels) bits.push(s.channels === 1 ? 'mono' : s.channels === 2 ? 'stereo' : s.channels + ' Kanäle');
      if (s.sample_rate) bits.push((s.sample_rate / 1000).toString().replace('.', ',') + ' kHz');
      if (s.bit_rate) bits.push(Math.round(s.bit_rate / 1000) + ' kbit/s');
      if (s.language && s.language !== 'und') bits.push(s.language);
      li.appendChild(el('span', null, bits.filter(Boolean).join(' · ')));
      ul.appendChild(li);
    }
    box.appendChild(ul);
    // a sensible default: videos -> remux to mp4, audio -> mp3
    const want = hasVideo() ? 'remux' : 'audio';
    document.querySelector('input[name="action"][value="' + want + '"]').checked = true;
    fillFormats();
    if (want === 'remux' && !/mp4|mov/.test(info.format)) $('format').value = 'mp4';
    if (want === 'remux' && /mp4|mov/.test(info.format)) $('format').value = 'mkv';
    fillStreams();
  } catch (e) {
    if (st.src !== f) return;
    box.className = 'src-info';
    box.textContent = '';
    box.appendChild(el('div', 'name', f.name));
    box.appendChild(el('div', 'job err', de(e.message)));
  }
  suggestName();
  refresh();
}

$('pick-src').addEventListener('click', async () => {
  const r = await SOS.fs.pick({ title: 'Mediendatei wählen', ext: MEDIA_EXT }).catch((e) => { toast(de(e.message)); return null; });
  if (r && r[0]) setSource({ root: r[0].root, path: r[0].path || '', name: r[0].name });
});
$('pick-dest').addEventListener('click', async () => {
  const r = await SOS.fs.pick({ folder: true }).catch((e) => { toast(de(e.message)); return null; });
  if (r && r[0]) { st.dest = { root: r[0].root, path: r[0].path || '' }; suggestName(); refresh(); }
});

document.querySelectorAll('input[name="action"]').forEach((r) => r.addEventListener('change', () => { fillFormats(); suggestName(); refresh(); }));
['format', 'bitrate', 'stream'].forEach((id) => $(id).addEventListener('change', () => { suggestName(); refresh(); }));
['t-start', 't-dur'].forEach((id) => $(id).addEventListener('input', refresh));
$('trim').addEventListener('change', refresh);
$('outname').addEventListener('input', () => { st.nameTouched = true; refresh(); });

$('start').addEventListener('click', async () => {
  if (!st.src) return;
  const a = action(), f = $('format').value;
  const job = {
    input: st.src,
    output: { root: (st.dest || st.src).root, path: (st.dest || st.src).path, name: $('outname').value.trim() + '.' + outExt() },
    action: a, format: f
  };
  if (a === 'audio') { job.stream = +$('stream').value || 0; if (AUDIO[f].lossy) job.bitrate = $('bitrate').value; }
  if ($('trim').checked) {
    if ($('t-start').value.trim()) job.start = $('t-start').value.trim();
    if ($('t-dur').value.trim()) job.duration = $('t-dur').value.trim();
  }
  $('start').disabled = true;
  try {
    const r = await SOS.media.start(job);
    toast('Auftrag gestartet: ' + r.output.name);
    st.nameTouched = false;
    loadJobs();
  } catch (e) {
    toast(de(e.message));
  }
  refresh();
});

// --- jobs ----------------------------------------------------------------------------
const STATE = { queued: 'wartet', running: 'läuft', stopping: 'bricht ab …', done: 'fertig', error: 'Fehler', cancelled: 'abgebrochen' };
let pollTimer = 0, lastJobs = [];

function jobView(j) {
  const d = el('div', 'job');
  const top = el('div', 'top');
  top.appendChild(el('span', 'what', j.output ? j.output.name : '?'));
  const s = el('span', 'state ' + j.state, STATE[j.state] || j.state);
  if (j.state === 'running' && j.duration > 0) s.textContent = 'läuft · ' + Math.floor((j.progress || 0) * 100) + ' %';
  top.appendChild(s);
  d.appendChild(top);
  const kind = j.action === 'remux' ? 'Container → ' + String(j.format).toUpperCase() : 'Audio → ' + (j.format === 'copy' ? 'Original' : String(j.format).toUpperCase());
  const sub = [kind, 'aus ' + (j.input ? j.input.name : '?')];
  if (j.state === 'done' && j.size != null) sub.push(fmtSize(j.size));
  if (j.state === 'done' && j.started && j.finished) sub.push('in ' + fmtTime(j.finished - j.started));
  d.appendChild(el('div', 'sub', sub.join(' · ')));
  if (['running', 'queued', 'stopping'].includes(j.state)) {
    const bar = el('div', 'bar' + (j.state === 'queued' || !(j.duration > 0) ? ' wait' : ''));
    const fill = el('div');
    if (j.state === 'running' && j.duration > 0) fill.style.width = Math.max(1, Math.min(100, (j.progress || 0) * 100)) + '%';
    bar.appendChild(fill);
    d.appendChild(bar);
  }
  if (j.state === 'error' && j.error) d.appendChild(el('div', 'err', de(j.error)));
  const acts = el('div', 'acts');
  const btn = (label, fn, primary) => { const b = el('button', 'sos-btn small' + (primary ? ' primary' : ''), label); b.addEventListener('click', fn); acts.appendChild(b); };
  if (['running', 'queued', 'stopping'].includes(j.state)) {
    btn('Abbrechen', () => SOS.media.cancel(j.id).then(loadJobs).catch((e) => toast(de(e.message))));
  } else {
    if (j.state === 'done' && j.output) {
      btn('Im WinWeb Player abspielen', () => play(j.output), true);
      btn('Als Quelle verwenden', () => setSource({ root: j.output.root, path: j.output.path || '', name: j.output.name }));
    }
    btn('Aus der Liste', () => SOS.media.remove(j.id).then(loadJobs).catch((e) => toast(de(e.message))));
  }
  d.appendChild(acts);
  return d;
}

async function play(o) {
  try {
    const f = await SOS.fs.open(o.root, o.path || '', o.name);
    sendTo('webplayer', 'open-media', { to: 'webplayer', name: o.name, url: new URL(f.url, location.href).href }, 'WinWeb Player');
  } catch (e) { toast(de(e.message)); }
}

function renderJobs(list) {
  const box = $('jobs');
  box.textContent = '';
  if (!list.length) box.appendChild(el('div', 'empty muted', 'Noch keine Aufträge.'));
  for (const j of list) box.appendChild(jobView(j));
  $('clear-done').disabled = !list.some((j) => !['running', 'queued', 'stopping'].includes(j.state));
  const busy = list.filter((j) => ['running', 'queued', 'stopping'].includes(j.state)).length;
  setStatus(busy ? 'busy' : 'ok', busy ? busy + (busy === 1 ? ' Auftrag läuft' : ' Aufträge laufen') : 'FFmpeg bereit');
}

async function loadJobs() {
  clearTimeout(pollTimer);
  let busy = false;
  try {
    const r = await SOS.media.jobs();
    st.installed = r.installed;
    $('banner').classList.toggle('hidden', !!r.installed);
    if (!r.installed) $('banner').textContent = 'FFmpeg fehlt: Bitte im ShareOS-Store die System-App „ffmpeg“ installieren (ein Administrator). Danach diese App neu öffnen.';
    // a job finished since the last look: say so
    for (const j of r.jobs) {
      const old = lastJobs.find((x) => x.id === j.id);
      if (old && old.state !== j.state && j.state === 'done') toast('Fertig: ' + j.output.name);
      if (old && old.state !== j.state && j.state === 'error') toast('Fehlgeschlagen: ' + j.output.name);
    }
    lastJobs = r.jobs;
    renderJobs(r.jobs);
    if (!r.installed) setStatus('bad', 'FFmpeg fehlt');
    busy = r.jobs.some((j) => ['running', 'queued', 'stopping'].includes(j.state));
  } catch (e) {
    setStatus('bad', 'Keine Verbindung');
  }
  refresh();
  pollTimer = setTimeout(loadJobs, busy ? 1500 : 8000);
}

$('clear-done').addEventListener('click', async () => {
  for (const j of lastJobs) if (!['running', 'queued', 'stopping'].includes(j.state)) await SOS.media.remove(j.id).catch(() => { });
  loadJobs();
});

function setStatus(kind, text) { const s = $('status'); s.className = 'status ' + kind; s.textContent = text; }

// --- start ---------------------------------------------------------------------------
fillFormats();
fillStreams();
refresh();
if (!SOS || !SOS.fs || !SOS.media) {
  setStatus('bad', 'Nicht verfügbar');
  $('banner').classList.remove('hidden');
  $('banner').textContent = !SOS || !SOS.fs
    ? 'Diese App läuft nur auf einer ShareOS-Box, geöffnet aus der ShareOS-Oberfläche.'
    : 'Diese App braucht ShareOS 0.2.0-beta.5 oder neuer.';
  $('pick-src').disabled = $('pick-dest').disabled = true;
} else {
  SOS.fs.roots().then((r) => { roots = r || []; refresh(); }).catch(() => { });
  loadJobs();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadJobs(); });
}
