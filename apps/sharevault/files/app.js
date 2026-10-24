'use strict';

/**
 * ShareVault v1.0.5 - Modernes Grid-Layout in der Mitte mit originalem Login & Farben
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const VAULT_FOLDER = 'vault';
const VAULT_FILE = 'vault.enc';
let boxRootName = null;

let vaultKey = null;
let vaultEntries = [];
let editingEntryId = null;
let totpInterval = null;

// UI Elements
const lockView = document.getElementById('lock-view');
const vaultView = document.getElementById('vault-view');
const masterPwInput = document.getElementById('master-pw');
const unlockForm = document.getElementById('unlock-form');
const lockSub = document.getElementById('lock-sub');
const lockVaultBtn = document.getElementById('lock-vault-btn');

const vaultGrid = document.getElementById('vault-grid');
const entriesCount = document.getElementById('entries-count');
const searchInput = document.getElementById('search-input');
const addEntryBtn = document.getElementById('add-entry-btn');
const emptyState = document.getElementById('empty-state');

// Modal Elements
const entryModal = document.getElementById('entry-modal');
const modalHeading = document.getElementById('modal-heading');
const entryForm = document.getElementById('entry-form');
const fTitle = document.getElementById('f-title');
const fUsername = document.getElementById('f-username');
const fPassword = document.getElementById('f-password');
const fUrl = document.getElementById('f-url');
const fTotp = document.getElementById('f-totp');
const fNotes = document.getElementById('f-notes');

const togglePwBtn = document.getElementById('toggle-pw-btn');
const genPwBtn = document.getElementById('gen-pw-btn');
const deleteEntryBtn = document.getElementById('delete-entry-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const closeModalX = document.getElementById('close-modal-x');

const totpContainer = document.getElementById('totp-container');
const totpCodeDisplay = document.getElementById('totp-code-display');
const totpTimerDisplay = document.getElementById('totp-timer');

const storageStatus = document.getElementById('storage-status');

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

// ==================== CRYPTOGRAPHY ====================
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 150000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptVault(dataObj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  vaultKey = key;

  const enc = new TextEncoder();
  const plainBytes = enc.encode(JSON.stringify(dataObj));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    plainBytes
  );

  return JSON.stringify({
    salt: Array.from(salt),
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipherBuffer)),
    version: 1,
    mtime: new Date().toISOString()
  });
}

async function decryptVault(cipherJsonStr, password) {
  const payload = JSON.parse(cipherJsonStr);
  const salt = new Uint8Array(payload.salt);
  const iv = new Uint8Array(payload.iv);
  const cipherBytes = new Uint8Array(payload.data);

  const key = await deriveKey(password, salt);
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    cipherBytes
  );

  vaultKey = key;
  const dec = new TextDecoder();
  return JSON.parse(dec.decode(decryptedBuffer));
}

// ==================== STORAGE ====================
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    checkLocalVault();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;
      await FS.mkdir(boxRootName, '', VAULT_FOLDER).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${VAULT_FOLDER}/${VAULT_FILE}`;
      checkBoxVault();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      checkLocalVault();
    }
  } catch (err) {
    console.warn('ShareOS.fs Fehler:', err);
    checkLocalVault();
  }
}

async function checkBoxVault() {
  try {
    const res = await FS.list(boxRootName, VAULT_FOLDER);
    const exists = (res.entries || []).some(e => e.name === VAULT_FILE);
    if (!exists) {
      lockSub.textContent = 'Neuen Tresor erstellen: Wähle ein sicheres Master-Passwort!';
      document.getElementById('unlock-btn').textContent = 'Tresor anlegen';
    } else {
      lockSub.textContent = 'Gib dein Master-Passwort ein, um den Tresor zu entschlüsseln.';
      document.getElementById('unlock-btn').textContent = 'Entschlüsseln';
    }
  } catch (_) {
    checkLocalVault();
  }
}

function checkLocalVault() {
  const raw = localStorage.getItem(`sharevault_${user}`);
  if (!raw) {
    lockSub.textContent = 'Neuen Tresor erstellen: Wähle ein sicheres Master-Passwort!';
    document.getElementById('unlock-btn').textContent = 'Tresor anlegen';
  }
}

async function loadEncryptedData() {
  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, VAULT_FOLDER, VAULT_FILE);
      return await (await handle.blob()).text();
    } catch (_) {
      return null;
    }
  }
  return localStorage.getItem(`sharevault_${user}`);
}

async function saveEncryptedData(cipherStr) {
  localStorage.setItem(`sharevault_${user}`, cipherStr);

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, VAULT_FOLDER, VAULT_FILE, { write: true, create: true });
      await handle.save(new Blob([cipherStr], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${VAULT_FOLDER}/${VAULT_FILE}`, name: VAULT_FILE });
      }
    } catch (e) {
      showToast('Box-Speicherfehler: ' + e.message);
    }
  }
}

// ==================== UNLOCK / LOCK ====================
unlockForm.addEventListener('submit', async () => {
  const pw = masterPwInput.value.trim();
  if (!pw) return;

  const btn = document.getElementById('unlock-btn');
  btn.disabled = true;
  btn.textContent = 'Berechne Schlüssel...';

  try {
    const rawCipher = await loadEncryptedData();
    if (!rawCipher) {
      vaultEntries = [
        {
          id: Date.now(),
          title: 'ShareOS Box Web-Login',
          username: user,
          password: 'GeheimesPasswort123!',
          url: window.location.origin,
          totp: '',
          notes: 'Standard-Eintrag für dein ShareOS Konto auf der Box.'
        }
      ];
      const cipher = await encryptVault(vaultEntries, pw);
      await saveEncryptedData(cipher);
      showToast('Neuer Tresor erfolgreich angelegt!');
    } else {
      vaultEntries = await decryptVault(rawCipher, pw);
      showToast('Tresor erfolgreich entschlüsselt!');
    }

    lockView.classList.add('hidden');
    vaultView.classList.remove('hidden');
    masterPwInput.value = '';
    renderGrid();
  } catch (err) {
    console.error(err);
    showToast('Falsches Master-Passwort oder beschädigte Datei!');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entschlüsseln';
  }
});

lockVaultBtn.addEventListener('click', () => {
  vaultKey = null;
  vaultEntries = [];
  editingEntryId = null;
  stopTotp();
  vaultView.classList.add('hidden');
  lockView.classList.remove('hidden');
  masterPwInput.value = '';
  masterPwInput.focus();
  showToast('Tresor gesperrt.');
});

// ==================== GRID RENDERING ====================
function renderGrid() {
  const query = searchInput.value.trim().toLowerCase();
  vaultGrid.innerHTML = '';

  const filtered = vaultEntries.filter(e =>
    (e.title || '').toLowerCase().includes(query) ||
    (e.username || '').toLowerCase().includes(query) ||
    (e.url || '').toLowerCase().includes(query) ||
    (e.notes || '').toLowerCase().includes(query)
  );

  entriesCount.textContent = `${vaultEntries.length} Einträge`;

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(entry => {
    const card = document.createElement('div');
    card.className = 'vault-card';

    card.innerHTML = `
      <div class="card-top">
        <div class="card-meta">
          <div class="card-icon">🔑</div>
          <div class="card-title-box">
            <span class="card-title">${escapeHTML(entry.title || 'Unbenannt')}</span>
            <span class="card-user">${escapeHTML(entry.username || '–')}</span>
          </div>
        </div>
      </div>
      <div class="card-secret-row">
        <span class="secret-masked">••••••••••••</span>
        <div class="card-quick-actions">
          <button class="touch-copy-btn">📋 Kopieren</button>
        </div>
      </div>
    `;

    card.querySelector('.touch-copy-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard.writeText(entry.password);
      showToast(`Passwort für '${entry.title}' kopiert!`);
    });

    card.addEventListener('click', () => openModal(entry));

    vaultGrid.appendChild(card);
  });
}

// ==================== MODAL (NEU / BEARBEITEN) ====================
function openModal(entry = null) {
  editingEntryId = entry ? entry.id : null;
  modalHeading.textContent = entry ? 'Eintrag bearbeiten' : 'Neuen Eintrag erfassen';

  fTitle.value = entry ? entry.title : '';
  fUsername.value = entry ? (entry.username || '') : '';
  fPassword.value = entry ? entry.password : '';
  fUrl.value = entry ? (entry.url || '') : '';
  fTotp.value = entry ? (entry.totp || '') : '';
  fNotes.value = entry ? (entry.notes || '') : '';

  fPassword.type = 'password';
  togglePwBtn.textContent = '👁️';

  startTotp(entry ? entry.totp : '');

  deleteEntryBtn.classList.toggle('hidden', !entry);
  entryModal.classList.remove('hidden');
  fTitle.focus();
}

function closeModal() {
  entryModal.classList.add('hidden');
  editingEntryId = null;
  stopTotp();
  entryForm.reset();
}

addEntryBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
entryModal.addEventListener('click', (e) => {
  if (e.target === entryModal) closeModal();
});

togglePwBtn.addEventListener('click', () => {
  if (fPassword.type === 'password') {
    fPassword.type = 'text';
    togglePwBtn.textContent = '🔒';
  } else {
    fPassword.type = 'password';
    togglePwBtn.textContent = '👁️';
  }
});

genPwBtn.addEventListener('click', () => {
  fPassword.value = generateSecurePassword(18);
  fPassword.type = 'text';
  togglePwBtn.textContent = '🔒';
  showToast('Sicheres Passwort generiert!');
});

entryForm.addEventListener('submit', async () => {
  const title = fTitle.value.trim() || 'Unbenannt';
  const username = fUsername.value.trim();
  const password = fPassword.value;
  const url = fUrl.value.trim();
  const totp = fTotp.value.trim().replace(/\s+/g, '');
  const notes = fNotes.value;

  if (!password) return;

  if (editingEntryId) {
    const entry = vaultEntries.find(e => e.id === editingEntryId);
    if (entry) {
      entry.title = title;
      entry.username = username;
      entry.password = password;
      entry.url = url;
      entry.totp = totp;
      entry.notes = notes;
    }
    showToast('Eintrag aktualisiert.');
  } else {
    const newEntry = {
      id: Date.now(),
      title,
      username,
      password,
      url,
      totp,
      notes
    };
    vaultEntries.unshift(newEntry);
    showToast('Neuer Eintrag gespeichert!');
  }

  closeModal();
  renderGrid();
  await persistVault();
});

deleteEntryBtn.addEventListener('click', async () => {
  if (!editingEntryId) return;
  if (!confirm('Diesen Eintrag wirklich unwiderruflich löschen?')) return;

  vaultEntries = vaultEntries.filter(e => e.id !== editingEntryId);
  closeModal();
  renderGrid();
  await persistVault();
  showToast('Eintrag gelöscht.');
});

async function persistVault() {
  if (!vaultKey) return;
  const enc = new TextEncoder();
  const plainBytes = enc.encode(JSON.stringify(vaultEntries));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    vaultKey,
    plainBytes
  );

  const oldRaw = await loadEncryptedData();
  const oldSalt = oldRaw ? JSON.parse(oldRaw).salt : Array.from(crypto.getRandomValues(new Uint8Array(16)));

  const payload = {
    salt: oldSalt,
    iv: Array.from(iv),
    data: Array.from(new Uint8Array(cipherBuffer)),
    version: 1,
    mtime: new Date().toISOString()
  };

  await saveEncryptedData(JSON.stringify(payload));
}

function generateSecurePassword(length = 16) {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*-_+=';
  const array = new Uint32Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, x => chars[x % chars.length]).join('');
}

searchInput.addEventListener('input', renderGrid);

// ==================== TOTP ENGINE ====================
function base32ToBytes(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0;
  const bytes = [];
  const clean = base32.toUpperCase().replace(/=+$/, '');
  for (let i = 0; i < clean.length; i++) {
    const idx = alphabet.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(bytes);
}

async function generateTOTP(secretBase32) {
  try {
    const keyBytes = base32ToBytes(secretBase32);
    if (!keyBytes.length) return null;
    const epochSeconds = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epochSeconds / 30);
    const counterBuffer = new ArrayBuffer(8);
    const counterView = new DataView(counterBuffer);
    counterView.setUint32(4, counter, false);

    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, counterBuffer);
    const hmac = new Uint8Array(signature);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
    return String(binary % 1000000).padStart(6, '0');
  } catch (_) {
    return null;
  }
}

function startTotp(secret) {
  stopTotp();
  if (!secret) {
    totpContainer.classList.add('hidden');
    return;
  }
  totpContainer.classList.remove('hidden');
  const update = async () => {
    const code = await generateTOTP(secret);
    if (code) totpCodeDisplay.textContent = `${code.slice(0, 3)} ${code.slice(3)}`;
    else totpCodeDisplay.textContent = 'UNGÜLTIG';
    const rem = 30 - (Math.floor(Date.now() / 1000) % 30);
    totpTimerDisplay.textContent = `${rem}s`;
  };
  update();
  totpInterval = setInterval(update, 1000);
}

function stopTotp() {
  if (totpInterval) { clearInterval(totpInterval); totpInterval = null; }
}

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
