'use strict';
// ShareOS app SDK (/_shareos/app.js) – missing when DevBox runs on its own
const SOS = window.ShareOS || null;
if (SOS) document.documentElement.setAttribute('data-look', 'shareos');

// all apps of the box share one origin: own keys only
function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

// Tab Switching
function showTool(tool) {
  const btn = document.querySelector(`.tab-btn[data-tool="${tool}"]`);
  if (!btn) return;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tool-view').forEach(v => v.classList.add('hidden'));
  btn.classList.add('active');
  document.getElementById(`view-${tool}`).classList.remove('hidden');
  store('devbox.tool', tool);
}
document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => showTool(btn.dataset.tool)));
showTool(store('devbox.tool') || 'json');

// UTF-8 safe Base64 (also Base64url, missing padding allowed)
function b64encode(text) {
  let bin = '';
  new TextEncoder().encode(text).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function b64decode(s) {
  s = s.trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

// 1. JSON Formatter & Minifier
const jsonIn = document.getElementById('json-input');
const jsonOut = document.getElementById('json-output');
const jsonStatus = document.getElementById('json-status');

function processJSON(spaces) {
  try {
    const parsed = JSON.parse(jsonIn.value);
    jsonOut.value = JSON.stringify(parsed, null, spaces);
    jsonStatus.textContent = 'Valid JSON ✓';
    jsonStatus.className = 'status-ok';
  } catch (err) {
    jsonOut.value = 'Syntax Error: ' + err.message;
    jsonStatus.textContent = 'Invalid JSON ✕';
    jsonStatus.className = 'status-err';
  }
}
document.getElementById('json-format-btn').addEventListener('click', () => processJSON(2));
document.getElementById('json-minify-btn').addEventListener('click', () => processJSON(0));

// 2. Base64, URL & Hex Encoder
const b64In = document.getElementById('b64-input');
const b64Out = document.getElementById('b64-output');
document.getElementById('b64-enc').addEventListener('click', () => {
  try { b64Out.value = b64encode(b64In.value); } catch(e) { b64Out.value = e.message; }
});
document.getElementById('b64-dec').addEventListener('click', () => {
  try { b64Out.value = b64decode(b64In.value); } catch(e) { b64Out.value = 'Kein gültiges Base64 (oder kein UTF-8-Text): ' + e.message; }
});
document.getElementById('url-enc').addEventListener('click', () => { b64Out.value = encodeURIComponent(b64In.value); });
document.getElementById('url-dec').addEventListener('click', () => {
  try { b64Out.value = decodeURIComponent(b64In.value.replace(/\+/g, ' ')); } catch(e) { b64Out.value = 'Ungültige URL-Kodierung: ' + e.message; }
});
document.getElementById('html-enc').addEventListener('click', () => {
  b64Out.value = b64In.value.replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
});
document.getElementById('html-dec').addEventListener('click', () => {
  // DOMParser does not run scripts or load anything
  b64Out.value = new DOMParser().parseFromString('<!doctype html><body>' + b64In.value.replace(/</g, '&lt;'), 'text/html').body.textContent;
});
document.getElementById('hex-enc').addEventListener('click', () => {
  b64Out.value = Array.from(new TextEncoder().encode(b64In.value)).map(b => b.toString(16).padStart(2, '0')).join(' ');
});
document.getElementById('hex-dec').addEventListener('click', () => {
  const hex = b64In.value.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
  if (hex.length % 2) { b64Out.value = 'Ungerade Anzahl Hex-Ziffern.'; return; }
  try {
    b64Out.value = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(hex.match(/../g) || [], h => parseInt(h, 16)));
  } catch(e) { b64Out.value = 'Kein UTF-8-Text.'; }
});

// 3. Crypto & Hashes (Web Crypto API)
const cryptoIn = document.getElementById('crypto-input');
async function digestHex(alg, data) {
  const buf = await crypto.subtle.digest(alg, data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function showHashes(data) {
  // crypto.subtle only exists on secure pages (https or localhost)
  if (!crypto.subtle) {
    ['sha1', 'sha256', 'sha384', 'sha512'].forEach(a => { document.getElementById('hash-' + a).value = 'nur über HTTPS verfügbar'; });
    return;
  }
  const seq = ++showHashes.seq;
  const res = await Promise.all(['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'].map(a => digestHex(a, data)));
  if (seq !== showHashes.seq) return;   // a newer input is already being hashed
  ['sha1', 'sha256', 'sha384', 'sha512'].forEach((a, i) => { document.getElementById('hash-' + a).value = res[i]; });
  compareHash();
}
showHashes.seq = 0;
cryptoIn.addEventListener('input', () => showHashes(new TextEncoder().encode(cryptoIn.value)));

// compare with an expected checksum (a .sha256 file holds "<hash>  <name>")
const hashExpect = document.getElementById('hash-expect');
const hashMatch = document.getElementById('hash-match');
function compareHash() {
  const want = (hashExpect.value.trim().split(/\s+/)[0] || '').toLowerCase();
  if (!want) { hashMatch.textContent = ''; hashMatch.className = 'hint'; return; }
  const hit = ['sha1', 'sha256', 'sha384', 'sha512'].find(a => document.getElementById('hash-' + a).value === want);
  hashMatch.textContent = hit ? `✓ stimmt überein (${hit.toUpperCase().replace('SHA', 'SHA-')})` : '✕ stimmt nicht überein';
  hashMatch.className = hit ? 'status-ok' : 'status-err';
}
hashExpect.addEventListener('input', compareHash);

// a file of this computer
const HASH_FILE_MAX = 1024 * 1048576;
document.getElementById('hash-file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (f.size > HASH_FILE_MAX) { cryptoIn.value = ''; cryptoIn.placeholder = `${f.name} ist größer als 1 GB – für den Browser zu groß.`; return; }
  cryptoIn.value = '';
  cryptoIn.placeholder = `Prüfsummen von ${f.name} (${(f.size / 1048576).toFixed(1)} MB) …`;
  await showHashes(await f.arrayBuffer());
  cryptoIn.placeholder = `Prüfsummen von ${f.name} (${(f.size / 1048576).toFixed(1)} MB). Eigener Text ersetzt sie.`;
});

function generateUUID() {
  document.getElementById('hash-uuid').value = crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}
document.getElementById('gen-uuid-btn').addEventListener('click', generateUUID);
generateUUID();

// 4. Regex Tester
const regexPattern = document.getElementById('regex-pattern');
const flagG = document.getElementById('flag-g');
const flagI = document.getElementById('flag-i');
const flagM = document.getElementById('flag-m');
const regexTest = document.getElementById('regex-testtext');
const regexOut = document.getElementById('regex-output');

const MAX_MATCHES = 1000;
function runRegex() {
  const count = document.getElementById('regex-count');
  count.textContent = '';
  if (!regexPattern.value) { regexOut.value = 'Muster eingeben.'; return; }
  try {
    const flags = (flagG.checked ? 'g' : '') + (flagI.checked ? 'i' : '') + (flagM.checked ? 'm' : '');
    const rx = new RegExp(regexPattern.value, flags);
    let matches = [];
    if (flagG.checked) {
      for (const m of regexTest.value.matchAll(rx)) { matches.push(m); if (matches.length >= MAX_MATCHES) break; }
    } else {
      const m = rx.exec(regexTest.value);   // without "g": the first match only
      if (m) matches = [m];
    }
    regexOut.value = matches.length
      ? matches.map((m, i) => {
          let line = `Match #${i + 1}: "${m[0]}" (Position: ${m.index})`;
          m.slice(1).forEach((g, j) => { line += `\n    Gruppe ${j + 1}: ${g === undefined ? '–' : '"' + g + '"'}`; });
          if (m.groups) Object.entries(m.groups).forEach(([k, g]) => { line += `\n    ${k}: ${g === undefined ? '–' : '"' + g + '"'}`; });
          return line;
        }).join('\n')
      : 'Keine Treffer.';
    count.textContent = matches.length >= MAX_MATCHES ? `erste ${MAX_MATCHES} Treffer` : `${matches.length} Treffer`;
  } catch(e) { regexOut.value = 'Regex Fehler: ' + e.message; }
}
[regexPattern, flagG, flagI, flagM, regexTest].forEach(el => el.addEventListener('input', runRegex));
runRegex();

// 5. Diff-Viewer
const diffLeft = document.getElementById('diff-left');
const diffRight = document.getElementById('diff-right');
const diffOutput = document.getElementById('diff-output');

// line diff via the longest common subsequence: an inserted line does not
// mark every following line as changed
const DIFF_MAX = 4000;   // lines per side (the table grows with the product)
function diffLines(a, b) {
  let pre = 0;
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++;
  let suf = 0;
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++;
  const A = a.slice(pre, a.length - suf), B = b.slice(pre, b.length - suf);
  const out = a.slice(0, pre).map(l => [' ', l]);
  if (A.length * B.length > DIFF_MAX * DIFF_MAX / 4) {
    A.forEach(l => out.push(['-', l])); B.forEach(l => out.push(['+', l]));
  } else {
    const n = A.length, m = B.length, L = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    let i = 0, j = 0;
    while (i < n && j < m) {
      if (A[i] === B[j]) { out.push([' ', A[i]]); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) out.push(['-', A[i++]]);
      else out.push(['+', B[j++]]);
    }
    while (i < n) out.push(['-', A[i++]]);
    while (j < m) out.push(['+', B[j++]]);
  }
  a.slice(a.length - suf).forEach(l => out.push([' ', l]));
  return out;
}

function computeDiff() {
  const linesA = diffLeft.value.split('\n').slice(0, DIFF_MAX);
  const linesB = diffRight.value.split('\n').slice(0, DIFF_MAX);
  const cls = { ' ': 'diff-same', '-': 'diff-del', '+': 'diff-add' };
  const res = diffLines(linesA, linesB);
  diffOutput.innerHTML = res.map(([k, l]) => `<span class="${cls[k]}">${k} ${escapeHTML(l)}</span>`).join('');
  const add = res.filter(r => r[0] === '+').length, del = res.filter(r => r[0] === '-').length;
  document.getElementById('diff-stats').textContent = add || del ? `+${add} / −${del}` : 'gleich';
}
document.getElementById('run-diff-btn').addEventListener('click', computeDiff);
[diffLeft, diffRight].forEach(el => el.addEventListener('input', computeDiff));
computeDiff();

// 6. JWT Decoder
const jwtIn = document.getElementById('jwt-input');
const jwtOut = document.getElementById('jwt-output');
jwtIn.addEventListener('input', () => {
  try {
    const parts = jwtIn.value.trim().split('.');
    if (parts.length < 2) { jwtOut.value = 'Bitte ein gültiges JWT (Header.Payload.Signature) eingeben.'; return; }
    const header = JSON.parse(b64decode(parts[0]));
    const payload = JSON.parse(b64decode(parts[1]));
    const times = ['iat', 'nbf', 'exp'].filter(k => typeof payload[k] === 'number')
      .map(k => `${k}: ${new Date(payload[k] * 1000).toLocaleString()}${k === 'exp' && payload.exp * 1000 < Date.now() ? '  (abgelaufen)' : ''}`);
    jwtOut.value = `--- HEADER ---\n${JSON.stringify(header, null, 2)}\n\n--- PAYLOAD ---\n${JSON.stringify(payload, null, 2)}`
      + (times.length ? `\n\n--- ZEITEN ---\n${times.join('\n')}` : '')
      + '\n\n(Die Signatur wird nicht geprüft.)';
  } catch(e) { jwtOut.value = 'Dekodierungsfehler: ' + e.message; }
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag]));
}

// --- a file of the box, opened from the ShareOS file browser ---
// .json -> formatter, other files -> checksums (read-only either way)
const HASH_MAX = 256 * 1048576;
if (SOS && SOS.file) {
  SOS.file.info().then(async (info) => {
    const name = SOS.file.name;
    document.title = name + ' – DevBox';
    if (/\.json$/i.test(name)) {
      jsonIn.value = await SOS.file.text();
      showTool('json');
      processJSON(2);
      jsonStatus.textContent += ' · ' + name;
    } else {
      showTool('crypto');
      cryptoIn.value = '';
      cryptoIn.placeholder = `Prüfsummen von ${name} (${(info.size / 1048576).toFixed(1)} MB) …`;
      if (info.size > HASH_MAX) { cryptoIn.placeholder = `${name} ist größer als 256 MB – für den Browser zu groß.`; return; }
      const buf = await (await SOS.file.blob()).arrayBuffer();
      await showHashes(buf);
      cryptoIn.placeholder = `Prüfsummen von ${name} (${(info.size / 1048576).toFixed(1)} MB). Eigener Text ersetzt sie.`;
    }
  }).catch((e) => { jsonStatus.textContent = 'Datei: ' + e.message; jsonStatus.className = 'status-err'; });
}
