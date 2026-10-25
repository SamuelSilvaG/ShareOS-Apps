'use strict';

/**
 * ShareFeed - Minimalistischer RSS & News Reader
 * Speichert Feeds & Cache auf der Box unter feeds/ via ShareOS.fs
 */

const SOS = window.ShareOS || null;
const FS = SOS && SOS.fs ? SOS.fs : null;
const user = (SOS && SOS.user) || (new URLSearchParams(window.location.search).get('user')) || 'default';

document.getElementById('user-display').textContent = `Account: ${user}`;

const FEEDS_DIR = 'feeds';
const FEEDS_CONFIG = 'feeds.json';
let boxRootName = null;

let feeds = [
  { id: 1, name: 'Tagesschau', url: 'https://www.tagesschau.de/infoservices/alle-meldungen-100~rss2.xml' },
  { id: 2, name: 'Heise Online', url: 'https://www.heise.de/rss/heise-atom.xml' }
];

let articles = [];
let activeChannel = 'all'; // all, starred, or feedId
let activeArticleId = null;

const feedsList = document.getElementById('feeds-list');
const articlesList = document.getElementById('articles-list');
const emptyState = document.getElementById('empty-state');
const articlesCount = document.getElementById('articles-count');
const storageStatus = document.getElementById('storage-status');
const badgeAll = document.getElementById('badge-all');
const badgeStarred = document.getElementById('badge-starred');

const readerEmpty = document.getElementById('reader-empty');
const readerContent = document.getElementById('reader-content');
const rTitle = document.getElementById('r-title');
const rSource = document.getElementById('r-source');
const rDate = document.getElementById('r-date');
const rBody = document.getElementById('r-body');
const rLinkBtn = document.getElementById('r-link-btn');
const rStarBtn = document.getElementById('r-star-btn');

const addModal = document.getElementById('add-modal');
const openAddModalBtn = document.getElementById('open-add-modal-btn');
const closeModalX = document.getElementById('close-modal-x');
const modalCancelBtn = document.getElementById('modal-cancel-btn');
const addFeedForm = document.getElementById('add-feed-form');
const feedUrlInput = document.getElementById('feed-url');
const feedNameInput = document.getElementById('feed-name');
const refreshAllBtn = document.getElementById('refresh-all-btn');

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
    loadLocalFeeds();
    return;
  }

  try {
    const roots = await FS.roots();
    if (roots && roots.length > 0) {
      const homeRoot = roots.find(r => r.home) || roots[0];
      boxRootName = homeRoot.name;

      await FS.mkdir(boxRootName, '', FEEDS_DIR).catch(() => {});
      storageStatus.textContent = `Box: 🏠 ${boxRootName}/${FEEDS_DIR}/${FEEDS_CONFIG}`;
      await loadBoxFeeds();
    } else {
      showBanner('Kein persönlicher Ordner auf der Box gefunden.');
      loadLocalFeeds();
    }
  } catch (err) {
    console.warn('FS error:', err);
    loadLocalFeeds();
  }
}

async function loadBoxFeeds() {
  if (!FS || !boxRootName) return;

  try {
    const handle = await FS.open(boxRootName, FEEDS_DIR, FEEDS_CONFIG);
    const text = await (await handle.blob()).text();
    const data = JSON.parse(text);
    if (data.feeds) feeds = data.feeds;
    if (data.articles) articles = data.articles;
  } catch (_) {
    await saveBoxFeeds();
  }

  renderSidebar();
  renderArticles();
  if (!articles.length) fetchAllFeeds();
}

async function saveBoxFeeds() {
  const data = { feeds, articles };
  localStorage.setItem(`sharefeed_${user}`, JSON.stringify(data));

  if (FS && boxRootName) {
    try {
      const handle = await FS.open(boxRootName, FEEDS_DIR, FEEDS_CONFIG, { write: true, create: true });
      await handle.save(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      if (SOS && SOS.emit) {
        SOS.emit('file-saved', { to: 'all', path: `box:${boxRootName}/${FEEDS_DIR}/${FEEDS_CONFIG}`, name: FEEDS_CONFIG });
      }
    } catch (e) {
      showToast('Speichern fehlgeschlagen: ' + e.message);
    }
  }
}

function loadLocalFeeds() {
  const raw = localStorage.getItem(`sharefeed_${user}`);
  if (raw) {
    try {
      const d = JSON.parse(raw);
      if (d.feeds) feeds = d.feeds;
      if (d.articles) articles = d.articles;
    } catch (_) {}
  }
  renderSidebar();
  renderArticles();
  if (!articles.length) fetchAllFeeds();
}

// 2. RSS Fetcher (via Public CORS Proxy oder direkt)
async function fetchAllFeeds() {
  refreshAllBtn.disabled = true;
  refreshAllBtn.textContent = '⏳ Lade...';
  showToast('Aktualisiere Feeds...');

  let newItemsCount = 0;

  for (const f of feeds) {
    try {
      // Nutze AllOrigins oder direkten Aufruf
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(f.url)}`;
      const res = await fetch(proxyUrl);
      const json = await res.json();
      const parser = new DOMParser();
      const xml = parser.parseFromString(json.contents, 'text/xml');

      // RSS 2.0 or Atom
      const items = xml.querySelectorAll('item, entry');

      items.forEach(it => {
        const title = it.querySelector('title')?.textContent || 'Ohne Titel';
        const link = it.querySelector('link')?.textContent || it.querySelector('link')?.getAttribute('href') || '#';
        const pubDate = it.querySelector('pubDate, updated')?.textContent || new Date().toISOString();
        const desc = it.querySelector('description, content, summary')?.textContent || '';

        const id = 'art_' + Math.abs(hashCode(link + title));

        if (!articles.some(a => a.id === id)) {
          articles.push({
            id,
            feedId: f.id,
            feedName: f.name,
            title,
            link,
            date: new Date(pubDate).toLocaleDateString() || 'Heute',
            body: desc,
            starred: false
          });
          newItemsCount++;
        }
      });
    } catch (err) {
      console.warn(`Fehler bei Feed ${f.name}:`, err);
    }
  }

  // Sortieren nach ID / Zeit
  articles.sort((a,b) => b.id.localeCompare(a.id));

  refreshAllBtn.disabled = false;
  refreshAllBtn.textContent = '🔄 Abrufen';
  showToast(newItemsCount > 0 ? `${newItemsCount} neue(r) Artikel geladen!` : 'Keine neuen Artikel.');

  await saveBoxFeeds();
  renderSidebar();
  renderArticles();
}

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
  return hash | 0;
}

// 3. UI Rendering
function renderSidebar() {
  badgeAll.textContent = articles.length;
  badgeStarred.textContent = articles.filter(a => a.starred).length;

  feedsList.innerHTML = '';
  feeds.forEach(f => {
    const count = articles.filter(a => a.feedId === f.id).length;
    const btn = document.createElement('button');
    btn.className = `channel-item ${activeChannel === f.id ? 'active' : ''}`;
    btn.innerHTML = `
      <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:140px;">📡 ${escapeHTML(f.name)}</span>
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="channel-badge">${count}</span>
        <span class="feed-del-btn" data-del="${f.id}" title="Feed entfernen">✕</span>
      </div>
    `;

    btn.addEventListener('click', (e) => {
      if (e.target.dataset.del) {
        deleteFeed(f.id);
        return;
      }
      document.querySelectorAll('.channel-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeChannel = f.id;
      renderArticles();
    });

    feedsList.appendChild(btn);
  });
}

function renderArticles() {
  articlesList.innerHTML = '';

  let filtered = articles;
  if (activeChannel === 'starred') filtered = articles.filter(a => a.starred);
  else if (activeChannel !== 'all') filtered = articles.filter(a => a.feedId === activeChannel);

  articlesCount.textContent = `${filtered.length} Artikel`;

  if (!filtered.length) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(art => {
    const item = document.createElement('div');
    item.className = `article-item ${art.id === activeArticleId ? 'active' : ''}`;
    item.innerHTML = `
      <div class="article-item-title">${escapeHTML(art.title)}</div>
      <div class="article-item-meta">
        <span>${escapeHTML(art.feedName)}</span>
        <span>${art.starred ? '⭐ ' : ''}${art.date}</span>
      </div>
    `;

    item.addEventListener('click', () => selectArticle(art));
    articlesList.appendChild(item);
  });
}

function selectArticle(art) {
  activeArticleId = art.id;
  renderArticles();

  readerEmpty.classList.add('hidden');
  readerContent.classList.remove('hidden');

  rTitle.textContent = art.title;
  rSource.textContent = art.feedName;
  rDate.textContent = art.date;
  rBody.innerHTML = art.body || '<p>Keine Vorschau verfügbar. Nutze den Link unten, um den ganzen Artikel zu lesen.</p>';
  rLinkBtn.href = art.link;

  rStarBtn.textContent = art.starred ? '⭐ Favorisiert' : '☆ Zu Favoriten';
  rStarBtn.onclick = async () => {
    art.starred = !art.starred;
    rStarBtn.textContent = art.starred ? '⭐ Favorisiert' : '☆ Zu Favoriten';
    await saveBoxFeeds();
    renderSidebar();
    renderArticles();
  };
}

// Feeds verwalten
async function deleteFeed(feedId) {
  if (!confirm('Diesen Feed und dessen Artikel wirklich entfernen?')) return;
  feeds = feeds.filter(f => f.id !== feedId);
  articles = articles.filter(a => a.feedId !== feedId);
  if (activeChannel === feedId) activeChannel = 'all';
  await saveBoxFeeds();
  renderSidebar();
  renderArticles();
  showToast('Feed entfernt.');
}

// Modal
openAddModalBtn.addEventListener('click', () => addModal.classList.remove('hidden'));
closeModalX.addEventListener('click', () => addModal.classList.add('hidden'));
modalCancelBtn.addEventListener('click', () => addModal.classList.add('hidden'));

addFeedForm.addEventListener('submit', async () => {
  const url = feedUrlInput.value.trim();
  let name = feedNameInput.value.trim();
  if (!url) return;

  if (!name) {
    try { name = new URL(url).hostname.replace(/^www\./, ''); } catch (_) { name = 'RSS Feed'; }
  }

  feeds.push({ id: Date.now(), name, url });
  addModal.classList.add('hidden');
  addFeedForm.reset();

  await saveBoxFeeds();
  renderSidebar();
  showToast(`Feed '${name}' hinzugefügt!`);
  fetchAllFeeds();
});

refreshAllBtn.addEventListener('click', fetchAllFeeds);

// Sidebar Filter
document.querySelectorAll('.channel-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.channel-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeChannel = btn.dataset.channel;
    renderArticles();
  });
});

function escapeHTML(str) {
  return String(str).replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[tag]));
}

initStorage();
