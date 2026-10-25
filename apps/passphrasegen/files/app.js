'use strict';

/**
 * PassphraseGen - Kryptografisch sichere Diceware-Passphrasen
 * Nutzt crypto.getRandomValues (CSPRNG) & persistiert Verlauf via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const SETTINGS_DIR = 'passwords';
const HISTORY_FILE = 'passphrases.json';
let boxRootName = null;

// Effiziente, deutsche Wortliste für Diceware (ca. 150 häufige, einprägsame Substantive)
const WORDLIST = [
  'apfel', 'anker', 'adler', 'ampel', 'bruecke', 'burg', 'blume', 'berg', 'boot', 'brot',
  'baum', 'buch', 'brief', 'bahn', 'birne', 'cloud', 'dach', 'dorf', 'diamant', 'drache',
  'insel', 'igel', 'komet', 'keks', 'kerze', 'kater', 'koffer', 'kuchen', 'kissen', 'kreis',
  'lampe', 'leiter', 'loewe', 'luchs', 'mond', 'mauer', 'mosaik', 'motor', 'mutter', 'museum',
  'nacht', 'nadel', 'nelke', 'nord', 'ozean', 'ofen', 'onkel', 'palme', 'papier', 'planet',
  'post', 'rakete', 'regen', 'ring', 'rose', 'ritter', 'schiff', 'schloss', 'sonne', 'stern',
  'sand', 'spiegel', 'stein', 'strasse', 'strand', 'tisch', 'turm', 'traum', 'tiger', 'tasche',
  'uhr', 'vogel', 'vulkan', 'wald', 'wolke', 'welle', 'wind', 'wasser', 'wiese', 'wolf',
  'zaun', 'zebra', 'zelt', 'zucker', 'zweig', 'falke', 'fenster', 'feuer', 'flamme', 'flur',
  'fluss', 'funk', 'garten', 'gitarre', 'glocke', 'gold', 'graf', 'halle', 'hammer', 'hafen',
  'herz', 'himmel', 'honig', 'hotel', 'huette', 'jacke', 'joker', 'kabel', 'kaffee', 'kamm',
  'kanal', 'karte', 'kiste', 'klaue', 'klima', 'knopf', 'knoten', 'kohle', 'koenig', 'korb',
  'krone', 'kugel', 'kurve', 'labor', 'lager', 'laser', 'laub', 'leder', 'licht', 'linie',
  'maske', 'meier', 'milch', 'moewe', 'muenze', 'muehle', 'musik', 'myster', 'nabel', 'natter',
  'nebel', 'nest', 'netz', 'notiz', 'nuance', 'palast', 'pause', 'pfeil', 'pferd', 'pilot'
];

let history = [];

// Elements
const phraseDisplay = document.getElementById('phrase-display');
const generateBtn = document.getElementById('generate-btn');
const copyBtn = document.getElementById('copy-btn');
const entropyBar = document.getElementById('entropy-bar');
const entropyLabel = document.getElementById('entropy-label');

const wordCountSlider = document.getElementById('word-count-slider');
const wordCountVal = document.getElementById('word-count-val');
const separatorSelect = document.getElementById('separator-select');
const caseSelect = document.getElementById('case-select');
const addNumberCheck = document.getElementById('add-number-check');

const historyList = document.getElementById('history-list');
const clearHistBtn = document.getElementById('clear-hist-btn');
const saveHistoryBtn = document.getElementById('save-history-btn');
const storageStatus = document.getElementById('storage-status');

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
}

// 1. CSPRNG Zufallsgenerator (kryptografisch sicher)
function getRandomInt(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

function generatePassphrase() {
  const count = parseInt(wordCountSlider.value, 10);
  const sep = separatorSelect.value;
  const cMode = caseSelect.value;
  const addNum = addNumberCheck.checked;

  const chosenWords = [];
  for (let i = 0; i < count; i++) {
    let word = WORDLIST[getRandomInt(WORDLIST.length)];
    if (cMode === 'title') word = word.charAt(0).toUpperCase() + word.slice(1);
    else if (cMode === 'upper') word = word.toUpperCase();
    chosenWords.push(word);
  }

  let phrase = chosenWords.join(sep);
  if (addNum) {
    const num = getRandomInt(100);
    phrase += (sep ? sep : '') + num;
  }

  phraseDisplay.textContent = phrase;
  calculateEntropy(count, addNum);

  // In Verlauf aufnehmen
  addHistory(phrase);
}

function calculateEntropy(wordsCount, hasNum) {
  // Bits of entropy: log2(150^wordsCount) + (hasNum ? log2(100) : 0)
  const bitsPerWord = Math.log2(WORDLIST.length); // ca. 7.23 Bits pro Wort
  let totalBits = wordsCount * bitsPerWord;
  if (hasNum) totalBits += Math.log2(100); // + 6.64 Bits

  const rounded = Math.round(totalBits);
  let pct = Math.min(100, Math.round((rounded / 70) * 100));
  entropyBar.style.width = `${pct}%`;

  let quality = 'Sehr sicher (Empfohlen)';
  let color = '#10b981';

  if (rounded < 35) { quality = 'Schwach'; color = '#ef4444'; }
  else if (rounded < 45) { quality = 'Mittel'; color = '#f59e0b'; }
  else if (rounded < 55) { quality = 'Gut'; color = '#38bdf8'; }

  entropyBar.style.background = color;
  entropyLabel.textContent = `Entropie: ~${rounded} Bit (${quality})`;
}

function addHistory(phrase) {
  const item = {
    phrase,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  };
  history.unshift(item);
  if (history.length > 15) history.pop();
  renderHistory();
}

function renderHistory() {
  historyList.innerHTML = '';
  history.forEach(item => {
    const row = document.createElement('div');
    row.className = 'hist-item';
    row.innerHTML = `
      <span>${escapeHTML(item.phrase)}</span>
      <span class="hist-time">${item.time}</span>
    `;
    row.addEventListener('click', () => {
      navigator.clipboard.writeText(item.phrase);
      showToast('Aus Verlauf kopiert!');
    });
    historyList.appendChild(row);
  });
}

// 2. ShareOS.fs Anbindung
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadLocalHistory();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', SETTINGS_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${SETTINGS_DIR}/${HISTORY_FILE}`;
      await loadBoxHistory();
    } else {
      loadLocalHistory();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadLocalHistory();
  }
}

async function loadBoxHistory() {
  if (!FS || !boxRootName) return;
  try {
    const handle = await FS.open(boxRootName, SETTINGS_DIR, HISTORY_FILE);
    const text = await (await handle.blob()).text();
    history = JSON.parse(text);
    renderHistory();
  } catch (_) {}
}

async function saveBoxHistory() {
  localStorage.setItem(`passphrases_${user}`, JSON.stringify(history));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, SETTINGS_DIR, HISTORY_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' }));
      showToast('Verlauf auf der Box gesichert.');
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  } else {
    showToast('Lokal im Browser gesichert.');
  }
}

function loadLocalHistory() {
  const raw = localStorage.getItem(`passphrases_${user}`);
  if (raw) {
    try { history = JSON.parse(raw); renderHistory(); } catch (_) {}
  }
}

// Events
generateBtn.addEventListener('click', generatePassphrase);

copyBtn.addEventListener('click', () => {
  const p = phraseDisplay.textContent;
  if (p && !p.startsWith('klicke')) {
    navigator.clipboard.writeText(p);
    showToast('Passphrase in Zwischenablage kopiert!');
  }
});

wordCountSlider.addEventListener('input', () => {
  wordCountVal.textContent = wordCountSlider.value;
  generatePassphrase();
});
separatorSelect.addEventListener('change', generatePassphrase);
caseSelect.addEventListener('change', generatePassphrase);
addNumberCheck.addEventListener('change', generatePassphrase);

clearHistBtn.addEventListener('click', () => {
  history = [];
  renderHistory();
  saveBoxHistory();
});
saveHistoryBtn.addEventListener('click', saveBoxHistory);

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
generatePassphrase();
