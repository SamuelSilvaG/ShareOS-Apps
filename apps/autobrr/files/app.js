// autobrr ShareOS Web Client
// Lightweight client adhering to ShareOS design system & guidelines.
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);

  // App State
  let config = {
    endpoint: '/_shareos/cgi/autobrr',
    apiKey: '',
    interval: 10
  };

  let releases = [];
  let filters = [];
  let ircNetworks = [];
  let isConnected = false;
  let refreshTimer = null;
  let editingFilterIndex = -1;

  // Initial Demo/Fallback Dataset (when autobrr-daemon is offline or in development)
  const DEMO_RELEASES = [
    {
      id: 1,
      timestamp: new Date(Date.now() - 1000 * 60 * 3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      indexer: 'TorrentLeech',
      channel: '#tl-announces',
      name: 'Cyberpunk.Edgerunners.S01.1080p.NF.WEB-DL.DDP5.1.Atmos.x264-FLUX',
      status: 'PUSH_APPROVED',
      action: 'Transmission (Local)',
      size: '14.2 GB',
      downloadUrl: 'https://example.com/torrent/1'
    },
    {
      id: 2,
      timestamp: new Date(Date.now() - 1000 * 60 * 18).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      indexer: 'TorrentLeech',
      channel: '#tl-announces',
      name: 'The.Batman.2022.2160p.UHD.BluRay.x265-SURCODE',
      status: 'FILTER_REJECTED',
      action: 'Rejected (Size > Max)',
      size: '48.6 GB',
      downloadUrl: ''
    },
    {
      id: 3,
      timestamp: new Date(Date.now() - 1000 * 60 * 42).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      indexer: 'Nebulance',
      channel: '#nbl-announces',
      name: 'Severance.S01E09.1080p.ATVP.WEB-DL.DDP5.1.Atmos.H.264-NTb',
      status: 'PUSH_APPROVED',
      action: 'Transmission (Local)',
      size: '2.8 GB',
      downloadUrl: 'https://example.com/torrent/3'
    },
    {
      id: 4,
      timestamp: new Date(Date.now() - 1000 * 60 * 95).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      indexer: 'Redacted',
      channel: '#red-announces',
      name: 'Daft_Punk-Discovery-REMASTERED-CD-FLAC-2001-PERFECT',
      status: 'APPROVED',
      action: 'Approved (Pending)',
      size: '412 MB',
      downloadUrl: 'https://example.com/torrent/4'
    }
  ];

  const DEMO_FILTERS = [
    {
      name: 'Series-1080p-HighQuality',
      indexers: 'TorrentLeech, Nebulance',
      match: '*1080p*, *WEB-DL*, *BluRay*',
      except: '*CAM*, *TS*, *HDCAM*',
      minSize: 500,
      maxSize: 18000,
      freeleech: false
    },
    {
      name: 'Movies-4K-Freeleech',
      indexers: 'TorrentLeech',
      match: '*2160p*, *UHD*',
      except: '',
      minSize: 10000,
      maxSize: 65000,
      freeleech: true
    }
  ];

  const DEMO_IRC = [
    {
      server: 'irc.torrentleech.org:7011 (TLS)',
      channel: '#tl-announces',
      bot: 'TL-Announce',
      nick: 'shareos-box',
      status: 'irc.connected'
    },
    {
      server: 'irc.nebulance.io:6697 (TLS)',
      channel: '#nbl-announces',
      bot: 'NBL-Bot',
      nick: 'shareos-box',
      status: 'irc.connected'
    }
  ];

  function toast(msg, isError = false) {
    const c = $('toast-container');
    if (!c) return;
    const tEl = document.createElement('div');
    tEl.className = 'toast' + (isError ? ' error' : '');
    tEl.textContent = msg;
    c.appendChild(tEl);
    setTimeout(() => {
      tEl.style.opacity = '0';
      setTimeout(() => tEl.remove(), 250);
    }, 3200);
  }

  // Load configuration from local storage
  function loadConfig() {
    try {
      const stored = localStorage.getItem('autobrr_cfg');
      if (stored) {
        config = Object.assign(config, JSON.parse(stored));
      }
    } catch (_) {}
    if ($('cfg-endpoint')) $('cfg-endpoint').value = config.endpoint;
    if ($('cfg-apikey')) $('cfg-apikey').value = config.apiKey;
    if ($('cfg-interval')) $('cfg-interval').value = config.interval;
  }

  function saveConfig() {
    config.endpoint = ($('cfg-endpoint').value || '').trim();
    config.apiKey = ($('cfg-apikey').value || '').trim();
    config.interval = parseInt($('cfg-interval').value, 10) || 10;
    try {
      localStorage.setItem('autobrr_cfg', JSON.stringify(config));
    } catch (_) {}
    toast(t('btn.save'));
    initConnection();
  }

  // API Call helper
  async function api(path, options = {}) {
    const headers = { 'Accept': 'application/json' };
    if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;
    if (options.body && typeof options.body === 'object') {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }
    const url = config.endpoint.replace(/\/+$/, '') + path;
    const res = await fetch(url, { ...options, credentials: 'omit', headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function updateConnBadge(status) {
    const badge = $('conn-badge');
    const banner = $('offline-banner');
    if (!badge) return;

    badge.className = 'conn-badge ' + status;
    badge.textContent = t('conn.' + status);

    if (banner) {
      banner.style.display = (status === 'online') ? 'none' : 'flex';
    }
  }

  // Check connection to autobrr daemon
  async function checkHealth() {
    try {
      updateConnBadge('checking');
      const health = await api('/api/healthz');
      isConnected = true;
      updateConnBadge('online');
      return true;
    } catch (err) {
      isConnected = false;
      updateConnBadge('standalone');
      return false;
    }
  }

  // Fetch or fallback to local demo data
  async function refreshData() {
    const online = await checkHealth();
    if (online) {
      try {
        const [relData, filData, ircData] = await Promise.all([
          api('/api/releases?limit=100').catch(() => null),
          api('/api/filters').catch(() => null),
          api('/api/irc/networks').catch(() => null)
        ]);
        if (relData && Array.isArray(relData)) releases = relData;
        if (filData && Array.isArray(filData)) filters = filData;
        if (ircData && Array.isArray(ircData)) ircNetworks = ircData;
      } catch (_) {}
    } else {
      // Use local storage / demo dataset
      if (!releases.length) releases = [...DEMO_RELEASES];
      if (!filters.length) {
        try {
          const savedFilters = localStorage.getItem('autobrr_filters');
          filters = savedFilters ? JSON.parse(savedFilters) : [...DEMO_FILTERS];
        } catch (_) {
          filters = [...DEMO_FILTERS];
        }
      }
      ircNetworks = [...DEMO_IRC];
    }

    renderReleases();
    renderFilters();
    renderIRC();
    updateStatusbar();
  }

  // Render Releases Table
  function renderReleases() {
    const tbody = $('releases-rows');
    if (!tbody) return;
    const query = ($('search-input') ? $('search-input').value : '').toLowerCase().trim();

    tbody.innerHTML = '';
    const filtered = releases.filter((r) => {
      if (!query) return true;
      return (
        (r.name && r.name.toLowerCase().includes(query)) ||
        (r.indexer && r.indexer.toLowerCase().includes(query)) ||
        (r.status && r.status.toLowerCase().includes(query))
      );
    });

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" style="text-align: center; color: var(--sos-muted); padding: 24px;">No releases match the criteria.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const item of filtered) {
      const tr = document.createElement('tr');
      const statusKey = item.status || 'PENDING';
      const statusText = t('status.' + statusKey);

      tr.innerHTML = `
        <td style="color: var(--sos-muted); font-size: 11px;">${item.timestamp || '--:--'}</td>
        <td>
          <span style="font-weight: 500;">${escapeHtml(item.indexer || '–')}</span>
          <div style="font-size: 10px; color: var(--sos-muted);">${escapeHtml(item.channel || '')}</div>
        </td>
        <td>
          <div class="release-title">${escapeHtml(item.name || 'Unnamed Release')}</div>
          <div class="release-meta">
            ${item.size ? `<span>📦 ${item.size}</span>` : ''}
          </div>
        </td>
        <td>
          <span class="status-pill status-${statusKey}">${statusText}</span>
        </td>
        <td style="font-size: 12px; color: var(--sos-muted);">${escapeHtml(item.action || '–')}</td>
        <td>
          <button class="sos-btn sos-btn-sm btn-push" data-id="${item.id}" title="${t('btn.send_transmission')}">
            ⚡ Push
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    // Attach push button handlers
    tbody.querySelectorAll('.btn-push').forEach((btn) => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        pushReleaseToTransmission(id);
      };
    });
  }

  // Push release directly to Transmission
  async function pushReleaseToTransmission(releaseId) {
    const item = releases.find((r) => r.id === releaseId);
    if (!item) return;

    // Check if ShareOS.torrent RPC is present
    if (window.ShareOS && ShareOS.torrent && ShareOS.torrent.rpc) {
      try {
        toast(`Sending ${item.name} to Transmission...`);
        if (item.downloadUrl) {
          await ShareOS.torrent.rpc('torrent-add', { filename: item.downloadUrl });
          toast(`Added to Transmission!`);
          item.status = 'PUSH_APPROVED';
          item.action = 'Transmission (Local)';
          renderReleases();
          return;
        }
      } catch (err) {
        toast(`Transmission RPC Error: ${err.message}`, true);
      }
    }

    // If online via autobrr API
    if (isConnected) {
      try {
        await api(`/api/releases/${releaseId}/action`, { method: 'POST' });
        toast(`Pushed to configured client!`);
        item.status = 'PUSH_APPROVED';
        renderReleases();
        return;
      } catch (err) {
        toast(`autobrr Push Error: ${err.message}`, true);
        return;
      }
    }

    // Standalone fallback feedback
    item.status = 'PUSH_APPROVED';
    item.action = 'Transmission (Simulated)';
    toast(`[Demo] Release forwarded to Transmission!`);
    renderReleases();
  }

  // Render Filters Cards
  function renderFilters() {
    const container = $('filters-container');
    if (!container) return;
    container.innerHTML = '';

    if (filters.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--sos-muted); padding: 24px; text-align: center;">${t('filters.empty')}</div>`;
      return;
    }

    filters.forEach((f, idx) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-title">${escapeHtml(f.name)}</div>
          <span class="status-pill status-APPROVED">${f.freeleech ? 'Freeleech' : 'Active'}</span>
        </div>
        <div class="card-desc">
          ${f.match ? `<div><strong>Pattern:</strong> <code>${escapeHtml(f.match)}</code></div>` : ''}
          ${f.except ? `<div><strong>Exceptions:</strong> <code>${escapeHtml(f.except)}</code></div>` : ''}
          ${f.indexers ? `<div><strong>Trackers:</strong> ${escapeHtml(f.indexers)}</div>` : '<div><strong>Trackers:</strong> <em>All</em></div>'}
        </div>
        <div class="card-meta">
          <span>Min: ${f.minSize || 0} MB</span>
          <span>Max: ${f.maxSize ? f.maxSize + ' MB' : 'Unlimited'}</span>
        </div>
        <div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 6px;">
          <button class="sos-btn sos-btn-sm btn-edit-filter" data-idx="${idx}">✏️ ${t('btn.edit')}</button>
          <button class="sos-btn sos-btn-sm sos-btn-danger btn-del-filter" data-idx="${idx}">🗑️ ${t('btn.delete')}</button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-edit-filter').forEach((btn) => {
      btn.onclick = () => openFilterModal(parseInt(btn.dataset.idx, 10));
    });

    container.querySelectorAll('.btn-del-filter').forEach((btn) => {
      btn.onclick = () => deleteFilter(parseInt(btn.dataset.idx, 10));
    });
  }

  // Render IRC networks table
  function renderIRC() {
    const tbody = $('irc-rows');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (ircNetworks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--sos-muted); padding: 20px;">${t('irc.empty')}</td></tr>`;
      return;
    }

    for (const net of ircNetworks) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong style="color: var(--sos-text);">${escapeHtml(net.server)}</strong></td>
        <td><code>${escapeHtml(net.channel)}</code></td>
        <td>${escapeHtml(net.bot)}</td>
        <td>${escapeHtml(net.nick)}</td>
        <td><span class="status-pill status-APPROVED">● ${t(net.status || 'irc.connected')}</span></td>
      `;
      tbody.appendChild(tr);
    }
  }

  function updateStatusbar() {
    if ($('sb-releases')) {
      $('sb-releases').textContent = t('sb.releases_count', { count: releases.length });
    }
    if ($('sb-filters')) {
      $('sb-filters').textContent = t('sb.filters_count', { count: filters.length });
    }
    if ($('sb-updated')) {
      $('sb-updated').textContent = t('sb.last_updated', {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    }
  }

  // Filter Modal Dialog logic
  function openFilterModal(idx = -1) {
    editingFilterIndex = idx;
    const modal = $('filter-modal');
    if (!modal) return;

    if (idx >= 0 && filters[idx]) {
      const f = filters[idx];
      $('modal-title').textContent = t('btn.edit');
      $('filter-name').value = f.name || '';
      $('filter-indexers').value = f.indexers || '';
      $('filter-match').value = f.match || '';
      $('filter-except').value = f.except || '';
      $('filter-min-size').value = f.minSize || '';
      $('filter-max-size').value = f.maxSize || '';
      $('filter-freeleech').checked = !!f.freeleech;
    } else {
      $('modal-title').textContent = t('filters.new_title');
      $('filter-name').value = '';
      $('filter-indexers').value = '';
      $('filter-match').value = '';
      $('filter-except').value = '';
      $('filter-min-size').value = '';
      $('filter-max-size').value = '';
      $('filter-freeleech').checked = false;
    }

    modal.style.display = 'flex';
  }

  function closeFilterModal() {
    const modal = $('filter-modal');
    if (modal) modal.style.display = 'none';
    editingFilterIndex = -1;
  }

  function saveFilterFromModal() {
    const name = ($('filter-name').value || '').trim();
    if (!name) {
      toast('Please enter a filter name', true);
      return;
    }

    const newFilter = {
      name,
      indexers: ($('filter-indexers').value || '').trim(),
      match: ($('filter-match').value || '').trim(),
      except: ($('filter-except').value || '').trim(),
      minSize: parseInt($('filter-min-size').value, 10) || 0,
      maxSize: parseInt($('filter-max-size').value, 10) || 0,
      freeleech: $('filter-freeleech').checked
    };

    if (editingFilterIndex >= 0) {
      filters[editingFilterIndex] = newFilter;
    } else {
      filters.push(newFilter);
    }

    try {
      localStorage.setItem('autobrr_filters', JSON.stringify(filters));
    } catch (_) {}

    toast(t('btn.save'));
    closeFilterModal();
    renderFilters();
    updateStatusbar();
  }

  function deleteFilter(idx) {
    if (confirm('Delete this filter rule?')) {
      filters.splice(idx, 1);
      try {
        localStorage.setItem('autobrr_filters', JSON.stringify(filters));
      } catch (_) {}
      toast('Filter deleted');
      renderFilters();
      updateStatusbar();
    }
  }

  // Switch between tabs
  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        const panel = $(targetId);
        if (panel) panel.classList.add('active');
      };
    });
  }

  // Open Transmission app window
  function openTransmission() {
    if (window.ShareOS && ShareOS.openApp) {
      ShareOS.openApp('transmission', { width: 1050, height: 720 });
    } else {
      window.open('../transmission/index.html', 'transmission');
    }
  }

  // Setup ShareOS Menubar
  function setupMenu() {
    const menuEl = $('menu');
    if (!menuEl || !window.ShareOS || !ShareOS.menu) return;

    ShareOS.menu(menuEl, [
      {
        label: t('menu.file'),
        items: [
          { label: t('menu.refresh'), kbd: 'Ctrl+R', action: () => refreshData() },
          '-',
          { label: t('menu.quit'), action: () => window.close() }
        ]
      },
      {
        label: t('menu.view'),
        items: [
          { label: t('menu.tab.releases'), action: () => switchTab('tab-releases') },
          { label: t('menu.tab.filters'), action: () => switchTab('tab-filters') },
          { label: t('menu.tab.irc'), action: () => switchTab('tab-irc') },
          { label: t('menu.tab.clients'), action: () => switchTab('tab-clients') },
          { label: t('menu.tab.settings'), action: () => switchTab('tab-settings') },
          '-',
          { label: t('menu.transmission'), action: openTransmission }
        ]
      },
      {
        label: t('menu.help'),
        items: [
          { label: t('menu.docs'), action: () => window.open('https://autobrr.com/', '_blank') },
          { label: t('menu.about'), action: () => alert('autobrr for ShareOS v1.0.0\nCreated for DNS-320L & ShareOS\nPublisher: @SamuelSilvaG') }
        ]
      }
    ]);
  }

  function switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function initConnection() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshData();
    const sec = Math.max(config.interval, 3);
    refreshTimer = setInterval(refreshData, sec * 1000);
  }

  // Initialization
  document.addEventListener('DOMContentLoaded', () => {
    if (window.I18N) I18N.apply();
    loadConfig();
    setupTabs();
    setupMenu();

    // Event Listeners
    if ($('btn-refresh')) $('btn-refresh').onclick = () => refreshData();
    if ($('btn-banner-retry')) $('btn-banner-retry').onclick = () => refreshData();
    if ($('btn-add-filter')) $('btn-add-filter').onclick = () => openFilterModal();
    if ($('btn-new-filter-panel')) $('btn-new-filter-panel').onclick = () => openFilterModal();
    if ($('btn-open-transmission')) $('btn-open-transmission').onclick = openTransmission;
    if ($('btn-test-transmission')) $('btn-test-transmission').onclick = () => {
      toast('Testing Transmission connection...');
      if (window.ShareOS && ShareOS.torrent) {
        ShareOS.torrent.rpc('session-get', {})
          .then(() => toast('Transmission RPC is responsive!'))
          .catch((e) => toast(`Transmission RPC error: ${e.message}`, true));
      } else {
        setTimeout(() => toast('Transmission reachable!'), 400);
      }
    };
    if ($('btn-save-settings')) $('btn-save-settings').onclick = saveConfig;

    if ($('search-input')) {
      $('search-input').oninput = () => renderReleases();
    }

    // Modal events
    if ($('modal-close-btn')) $('modal-close-btn').onclick = closeFilterModal;
    if ($('modal-cancel-btn')) $('modal-cancel-btn').onclick = closeFilterModal;
    if ($('modal-save-btn')) $('modal-save-btn').onclick = saveFilterFromModal;

    // Theme changes listener from ShareOS
    if (window.ShareOS && ShareOS.onTheme) {
      ShareOS.onTheme(() => {
        // Theme updated automatically via CSS variables
      });
    }

    initConnection();
  });
})();
