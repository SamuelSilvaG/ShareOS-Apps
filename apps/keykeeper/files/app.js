'use strict';

/**
 * KeyKeeper - SSH Keys, API Tokens & SSL Certificate Manager
 * Speichert Daten unter security/credentials.json via ShareOS.fs
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

// 1. Storage & ShareOS.fs Setup
async function initStorage() {
  if (!FS) {
    storageStatus.textContent = `Speicher: Browser (LocalStorage: ${user})`;
    loadFallbackCredentials();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', SECURITY_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${SECURITY_DIR}/${CREDENTIALS_FILE}`;
      await loadBoxCredentials();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadFallbackCredentials();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadFallbackCredentials();
  }
}

async function loadBoxCredentials() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, SECURITY_DIR, CREDENTIALS_FILE);
    const text = await (await handle.blob()).text();
    credentials = JSON.parse(text);
  } catch (_) {
    createDefaultCredentials();
    await saveBoxCredentials();
  }
  renderAll();
}

async function saveBoxCredentials() {
  localStorage.setItem(`keykeeper_${user}`, JSON.stringify(credentials));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, SECURITY_DIR, CREDENTIALS_FILE, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(credentials, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${SECURITY_DIR}/${CREDENTIALS_FILE}`, name: CREDENTIALS_FILE });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadFallbackCredentials() {
  const raw = localStorage.getItem(`keykeeper_${user}`);
  if (raw) {
    try { credentials = JSON.parse(raw); } catch (_) {}
  }
  if (!credentials || !credentials.length) {
    createDefaultCredentials();
  }
  renderAll();
}

function createDefaultCredentials() {
  credentials = [
    {
      id: 1,
      title: 'Proxmox VE Root SSH Key',
      type: 'ssh',
      secret: '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAABlw==\n-----END OPENSSH PRIVATE KEY-----',
      expiry: '',
      target: '192.168.1.10'
    },
    {
      id: 2,
      title: 'Cloudflare Wildcard SSL Cert',
      type: 'ssl',
      secret: '-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJAJCV\n-----END CERTIFICATE-----',
      expiry: '2027-11-15',
      target: '*.homelab.local'
    },
    {
      id: 3,
      title: 'GitHub Personal Access Token',
      type: 'token',
      secret: 'ghp_secret_homelab_automation_token_xyz987',
      expiry: '2026-12-31',
      target: 'github.com'
    }
  ];
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
