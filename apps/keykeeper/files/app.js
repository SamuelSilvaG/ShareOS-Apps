'use strict';

/**
 * KeyKeeper - SSH Keys, API Tokens & SSL Certificate Manager
 * 2.0: everything encrypted with a master password (security/keykeeper.enc)
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const SECURITY_DIR = 'security';
const CREDENTIALS_FILE = 'credentials.json';
let boxRootName = null;

let credentials = [];
let activeType = 'all';
let editingCredId = null;

// UI Elements
const $ = (id) => document.getElementById(id);
const lockView = $('lock-view');
const appView = $('app-view');
const credentialSearch = document.getElementById('credential-search');
const openAddBtn = document.getElementById('open-add-btn');
const refreshBtn = document.getElementById('refresh-btn');
const credentialsGrid = document.getElementById('credentials-grid');
const emptyState = document.getElementById('empty-state');
const credentialsCountLabel = document.getElementById('credentials-count-label');
const storageStatus = document.getElementById('storage-status');

const countAll = document.getElementById('count-all');
const countSsh = document.getElementById('count-ssh');
const countToken = document.getElementById('count-token');
const countSsl = document.getElementById('count-ssl');

// Modal Elements
const credentialModal = document.getElementById('credential-modal');
const modalHeading = document.getElementById('modal-heading');
const credentialForm = document.getElementById('credential-form');
const fTitle = document.getElementById('f-title');
const fType = document.getElementById('f-type');
const fSecret = document.getElementById('f-secret');
const labelSecret = document.getElementById('label-secret');
const fExpiry = document.getElementById('f-expiry');
const fTarget = document.getElementById('f-target');
const modalDeleteBtn = document.getElementById('modal-delete-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const closeModalX = document.getElementById('close-modal-x');

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

// 1. Storage: one encrypted file in the personal folder on the box
//    (security/keykeeper.enc, AES-GCM-256, key from the master password with
//    PBKDF2-SHA256, 250 000 rounds); a browser copy of the same encrypted
//    data when the box is not reachable. Nothing is stored in plain text.
const VAULT_FILE = 'keykeeper.enc';
const LS_KEY = 'keykeeper_vault';
const ITER = 250000;
let vaultKey = null;      // CryptoKey while unlocked
let vaultSalt = null;
let legacyPlain = null;   // credentials.json of 1.0 (plain text), moved into the vault

function b64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); }
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(pw, salt) {
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

async function readBoxText(name) {
  const h = await FS.open(boxRootName, SECURITY_DIR, name);
  return await (await h.blob()).text();
}

async function initStorage() {
  if (FS) {
    try {
      const roots = await FS.roots();
      if (roots && roots.length) {
        boxRootName = (roots.find(r => r.home) || roots[0]).name;
        await FS.mkdir(boxRootName, '', SECURITY_DIR).catch(() => {});
        storageStatus.textContent = `Box: 🏠 ${boxRootName}/${SECURITY_DIR}/${VAULT_FILE} (verschlüsselt)`;
      }
    } catch (err) { console.warn('FS error:', err); }
  }
  if (!boxRootName) storageStatus.textContent = 'Speicher: Browser (verschlüsselt)';
  let stored = null;
  if (boxRootName) {
    try { stored = await readBoxText(VAULT_FILE); } catch (_) { stored = null; }
    if (!stored) {
      try { legacyPlain = JSON.parse(await readBoxText(CREDENTIALS_FILE)); } catch (_) { legacyPlain = null; }
    }
  }
  if (!stored) { try { stored = localStorage.getItem(LS_KEY); } catch (_) {} }
  if (!legacyPlain) {
    try { const old = localStorage.getItem(`keykeeper_${user}`) || localStorage.getItem('keykeeper_' + 'default'); if (old) legacyPlain = JSON.parse(old); } catch (_) {}
  }
  // the sample entries of 1.0 are not taken over
  if (Array.isArray(legacyPlain)) legacyPlain = legacyPlain.filter(c => !(c.id <= 3 && /xyz987|AAABlw==|AJCV/.test(c.secret || '')));
  showLock(stored);
}

function showLock(stored) {
  lockView.dataset.mode = stored ? 'unlock' : 'create';
  lockView._stored = stored;
  $('lock-sub').textContent = stored ? 'Gib dein Master-Passwort ein, um deine Schlüssel zu entschlüsseln.'
    : 'Lege ein Master-Passwort fest. Damit werden alle Schlüssel, Tokens und Zertifikate verschlüsselt – ohne es kommt niemand an die Daten, auch du nicht.';
  $('master-pw2').classList.toggle('hidden', !!stored);
  $('unlock-btn').textContent = stored ? 'Entsperren' : 'Tresor anlegen';
  $('lock-legacy').classList.toggle('hidden', !(Array.isArray(legacyPlain) && legacyPlain.length && !stored));
  if (Array.isArray(legacyPlain) && legacyPlain.length) $('lock-legacy').textContent = `${legacyPlain.length} ${legacyPlain.length === 1 ? 'Eintrag' : 'Einträge'} aus der unverschlüsselten Datei von KeyKeeper 1.0 werden übernommen und die alte Datei danach gelöscht.`;
  lockView.classList.remove('hidden');
  appView.classList.add('hidden');
  $('master-pw').value = ''; $('master-pw2').value = '';
  $('master-pw').focus();
}

async function unlock() {
  const pw = $('master-pw').value;
  const stored = lockView._stored;
  const btn = $('unlock-btn');
  if (!stored) {
    if (pw.length < 8) { showToast('Das Master-Passwort braucht mindestens 8 Zeichen.'); return; }
    if (pw !== $('master-pw2').value) { showToast('Die Passwörter stimmen nicht überein.'); return; }
  }
  btn.disabled = true; btn.textContent = 'Berechne Schlüssel …';
  try {
    if (stored) {
      const p = JSON.parse(stored);
      vaultSalt = unb64(p.salt);
      vaultKey = await deriveKey(pw, vaultSalt);
      const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, vaultKey, unb64(p.data));
      credentials = JSON.parse(new TextDecoder().decode(plain));
    } else {
      vaultSalt = crypto.getRandomValues(new Uint8Array(16));
      vaultKey = await deriveKey(pw, vaultSalt);
      credentials = Array.isArray(legacyPlain) ? legacyPlain : [];
      await saveBoxCredentials();
      await dropLegacy();
    }
    lockView.classList.add('hidden');
    appView.classList.remove('hidden');
    renderAll();
  } catch (err) {
    vaultKey = null;
    showToast(stored ? 'Falsches Master-Passwort oder beschädigte Datei.' : 'Anlegen fehlgeschlagen: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = lockView._stored ? 'Entsperren' : 'Tresor anlegen';
  }
}

// the plain-text data of 1.0 go once they are in the vault
async function dropLegacy() {
  try { localStorage.removeItem(`keykeeper_${user}`); localStorage.removeItem('keykeeper_default'); } catch (_) {}
  if (legacyPlain && FS && boxRootName) {
    try { await FS.remove(boxRootName, SECURITY_DIR, [CREDENTIALS_FILE]); showToast('Alte unverschlüsselte Datei gelöscht.'); } catch (_) {}
  }
  legacyPlain = null;
}

async function saveBoxCredentials() {
  if (!vaultKey) return;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, new TextEncoder().encode(JSON.stringify(credentials))));
  const text = JSON.stringify({ app: 'keykeeper', v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(vaultSalt), iv: b64(iv), data: b64(data), mtime: new Date().toISOString() });
  try { localStorage.setItem(LS_KEY, text); } catch (_) {}
  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, SECURITY_DIR, VAULT_FILE, { write: true, create: true });
      await handle.save(new Blob([text], { type: 'application/json' }));
    } catch (e) {
      showToast('Speichern auf der Box fehlgeschlagen: ' + e.message);
    }
  }
}

function lock() {
  vaultKey = null;
  credentials = [];
  credentialsGrid.innerHTML = '';
  initStorage();
}

// 2. Rendering
function renderAll() {
  updateCounts();
  renderCredentials();
}

function updateCounts() {
  countAll.textContent = credentials.length;
  countSsh.textContent = credentials.filter(c => c.type === 'ssh').length;
  countToken.textContent = credentials.filter(c => c.type === 'token').length;
  countSsl.textContent = credentials.filter(c => c.type === 'ssl').length;
  credentialsCountLabel.textContent = `${credentials.length} Credentials gesamt`;
}

function renderCredentials() {
  const query = credentialSearch.value.trim().toLowerCase();
  credentialsGrid.innerHTML = '';

  const filtered = credentials.filter(c => {
    if (activeType !== 'all' && c.type !== activeType) return false;
    if (query) {
      return c.title.toLowerCase().includes(query) ||
             (c.target || '').toLowerCase().includes(query) ||
             c.type.toLowerCase().includes(query);
    }
    return true;
  });

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(cred => {
    const card = document.createElement('div');
    card.className = 'credential-card';

    let icon = '🔑';
    let typeName = 'SSH Key';
    if (cred.type === 'token') { icon = '🎫'; typeName = 'API Token'; }
    else if (cred.type === 'ssl') { icon = '📜'; typeName = 'SSL Cert'; }

    card.innerHTML = `
      <div class="cred-top">
        <div class="cred-meta">
          <div class="cred-icon-badge">${icon}</div>
          <div class="cred-title-box">
            <span class="cred-title">${escapeHTML(cred.title)}</span>
            <span class="cred-target">${escapeHTML(cred.target || typeName)}</span>
          </div>
        </div>
        <span class="type-badge">${typeName}</span>
      </div>

      <div class="cred-secret-box">
        ••••••••••••••••••••••••••••••••
      </div>

      <div class="cred-bottom">
        <span>${cred.expiry ? 'Ablauf: ' + cred.expiry : 'Kein Ablauf'}</span>
        <div class="cred-actions">
          <button class="action-btn copy-btn" title="In Zwischenablage kopieren">📋 Kopieren</button>
          <button class="action-btn edit-btn" title="Bearbeiten">⚙️ Edit</button>
        </div>
      </div>
    `;

    // Copy to clipboard
    card.querySelector('.copy-btn').addEventListener('click', () => {
      navigator.clipboard.writeText(cred.secret);
      showToast(`Secret '${cred.title}' in Zwischenablage kopiert!`);
    });

    // Edit
    card.querySelector('.edit-btn').addEventListener('click', () => openModal(cred));

    credentialsGrid.appendChild(card);
  });
}

// 3. Modal Logik
function openModal(cred = null) {
  editingCredId = cred ? cred.id : null;
  modalHeading.textContent = cred ? 'Credential bearbeiten' : 'Credential hinzufügen';

  fTitle.value = cred ? cred.title : '';
  fType.value = cred ? cred.type : 'ssh';
  fSecret.value = cred ? cred.secret : '';
  fExpiry.value = cred ? (cred.expiry || '') : '';
  fTarget.value = cred ? (cred.target || '') : '';

  updateModalFields();

  modalDeleteBtn.classList.toggle('hidden', !cred);
  credentialModal.classList.remove('hidden');
  fTitle.focus();
}

function updateModalFields() {
  const type = fType.value;
  if (type === 'ssh') {
    labelSecret.textContent = 'Privater SSH-Schlüssel (Private Key)';
    fSecret.placeholder = '-----BEGIN OPENSSH PRIVATE KEY-----...';
  } else if (type === 'token') {
    labelSecret.textContent = 'API Token / Secret Key';
    fSecret.placeholder = 'ghp_... oder Bearer Token';
  } else {
    labelSecret.textContent = 'SSL Zertifikat & Private Key PEM';
    fSecret.placeholder = '-----BEGIN CERTIFICATE-----...';
  }
}

fType.addEventListener('change', updateModalFields);

function closeModal() {
  credentialModal.classList.add('hidden');
  editingCredId = null;
  credentialForm.reset();
}

openAddBtn.addEventListener('click', () => openModal());
closeModalX.addEventListener('click', closeModal);
modalCancelBtn.addEventListener('click', closeModal);
credentialModal.addEventListener('click', (e) => {
  if (e.target === credentialModal) closeModal();
});

credentialForm.addEventListener('submit', async () => {
  const title = fTitle.value.trim();
  const type = fType.value;
  const secret = fSecret.value.trim();
  const expiry = fExpiry.value;
  const target = fTarget.value.trim();

  if (!title || !secret) return;

  if (editingCredId) {
    const item = credentials.find(c => c.id === editingCredId);
    if (item) {
      item.title = title;
      item.type = type;
      item.secret = secret;
      item.expiry = expiry;
      item.target = target;
    }
    showToast('Credential aktualisiert.');
  } else {
    credentials.push({
      id: Date.now(),
      title,
      type,
      secret,
      expiry,
      target
    });
    showToast('Credential sicher hinzugefügt!');
  }

  closeModal();
  renderAll();
  await saveBoxCredentials();
});

modalDeleteBtn.addEventListener('click', async () => {
  if (!editingCredId) return;
  if (!confirm('Dieses Credential wirklich löschen?')) return;

  credentials = credentials.filter(c => c.id !== editingCredId);
  closeModal();
  renderAll();
  await saveBoxCredentials();
  showToast('Credential gelöscht.');
});

// 4. Sub-Header Filter
document.querySelectorAll('#type-filter-bar .filter-pill').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#type-filter-bar .filter-pill').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeType = btn.dataset.type;
    renderCredentials();
  });
});

credentialSearch.addEventListener('input', renderCredentials);
refreshBtn.addEventListener('click', () => { lock(); showToast('Gesperrt.'); });
$('unlock-form').addEventListener('submit', (e) => { e.preventDefault(); unlock(); });
// lock again after 10 minutes without use
let idle = null;
const touch = () => { clearTimeout(idle); idle = setTimeout(() => { if (vaultKey) { lock(); showToast('Nach 10 Minuten automatisch gesperrt.'); } }, 600000); };
['click', 'keydown', 'pointermove'].forEach(ev => document.addEventListener(ev, touch, { passive: true }));

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
