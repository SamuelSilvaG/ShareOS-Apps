// autobrr ShareOS Web Client
// Fully integrated with ShareOS.autobrr (ShareOS 0.2.0-beta.9+)
'use strict';

(function () {
  const SOS = window.ShareOS || null;
  const AB = SOS && SOS.autobrr;
  const TOR = SOS && SOS.torrent;

  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);

  // App State
  let serviceStatus = null;
  let releases = [];
  let filters = [];
  let ircNetworks = [];
  let indexers = [];
  let accounts = [];
  let editingFilterId = null;
  let pollTimer = null;

  // Fallback demo data for standalone / preview outside ShareOS
  const DEMO_RELEASES = [
    {
      id: 1,
      timestamp: '14:20',
      indexer: 'TorrentLeech',
      channel: '#tl-announces',
      name: 'Cyberpunk.Edgerunners.S01.1080p.NF.WEB-DL.DDP5.1.Atmos.x264-FLUX',
      status: 'PUSH_APPROVED',
      action: 'Watch dir (.torrent)',
      size: '14.2 GB',
      downloadUrl: 'https://example.com/torrent/1'
    },
    {
      id: 2,
      timestamp: '14:05',
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
      timestamp: '13:41',
      indexer: 'Nebulance',
      channel: '#nbl-announces',
      name: 'Severance.S01E09.1080p.ATVP.WEB-DL.DDP5.1.Atmos.H.264-NTb',
      status: 'PUSH_APPROVED',
      action: 'Watch dir (.torrent)',
      size: '2.8 GB',
      downloadUrl: 'https://example.com/torrent/3'
    },
    {
      id: 4,
      timestamp: '12:15',
      indexer: 'Redacted',
      channel: '#red-announces',
      name: 'Daft_Punk-Discovery-REMASTERED-CD-FLAC-2001-PERFECT',
      status: 'APPROVED',
      action: 'Pending Transmission',
      size: '412 MB',
      downloadUrl: 'https://example.com/torrent/4'
    }
  ];

  const DEMO_FILTERS = [
    {
      id: 1,
      name: 'Series-1080p-HighQuality',
      indexers: ['TorrentLeech', 'Nebulance'],
      match_releases: '*1080p*, *WEB-DL*, *BluRay*',
      except_releases: '*CAM*, *TS*, *HDCAM*',
      min_size: '500MB',
      max_size: '18GB',
      freeleech: false,
      enabled: true
    },
    {
      id: 2,
      name: 'Movies-4K-Freeleech',
      indexers: ['TorrentLeech'],
      match_releases: '*2160p*, *UHD*',
      except_releases: '',
      min_size: '10GB',
      max_size: '65GB',
      freeleech: true,
      enabled: true
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

  const DEMO_INDEXERS = [
    { name: 'TorrentLeech', identifier: 'torrentleech', type: 'Torznab / IRC', status: 'active' },
    { name: 'Nebulance', identifier: 'nebulance', type: 'IRC Announce', status: 'active' },
    { name: 'Redacted', identifier: 'redacted', type: 'Gazelle / IRC', status: 'active' }
  ];

  // Toast feedback
  function toast(msg, isError = false) {
    const c = $('toast-container');
    if (!c) return;
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, 3500);
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Update top banner depending on system conditions
  function updateBanner(type, title, desc, actionLabel, actionFn) {
    const banner = $('system-banner');
    if (!banner) return;
    if (!type) {
      banner.style.display = 'none';
      return;
    }
    banner.style.display = 'flex';
    $('banner-title').textContent = title;
    $('banner-desc').textContent = desc;
    const actionBtn = $('btn-banner-action');
    if (actionLabel && actionFn) {
      actionBtn.style.display = 'inline-block';
      actionBtn.textContent = actionLabel;
      actionBtn.onclick = actionFn;
    } else {
      actionBtn.style.display = 'none';
    }
  }

  function updateConnBadge(kind, label) {
    const badge = $('conn-badge');
    if (!badge) return;
    badge.className = 'conn-badge ' + kind;
    badge.textContent = label || t('conn.' + kind);
  }

  // Fetch daemon status from ShareOS.autobrr
  async function refreshStatus() {
    if (!AB) {
      if (SOS) {
        updateConnBadge('offline', t('conn.no_access'));
        updateBanner('no_access', t('banner.no_access_title'), t('banner.no_access_desc'));
      } else {
        updateConnBadge('standalone');
        updateBanner('standalone', t('banner.standalone_title'), t('banner.standalone_desc'));
      }
      return false;
    }

    try {
      const st = await AB.status();
      serviceStatus = st;

      // Update badge and banner based on state
      if (!st.installed) {
        updateConnBadge('offline', t('conn.not_installed'));
        updateBanner('not_installed', t('banner.not_installed_title'), t('banner.not_installed_desc'));
      } else if (!st.drive) {
        updateConnBadge('offline', t('conn.no_drive'));
        updateBanner('no_drive', t('banner.no_drive_title'), t('banner.no_drive_desc'));
      } else if (!st.running) {
        updateConnBadge('offline', t('conn.offline'));
        updateBanner('offline', t('banner.offline_title'), t('banner.offline_desc'), t('btn.start_service'), startService);
      } else if (st.ready) {
        updateConnBadge('online', t('conn.online'));
        updateBanner(null);
      } else {
        updateConnBadge('checking', t('conn.starting'));
        updateBanner(null);
      }

      // Update transmission drop card
      if ($('trans-drop-path')) $('trans-drop-path').textContent = st.drop || '–';
      if ($('trans-drop-account')) $('trans-drop-account').textContent = st.account || '–';
      if ($('drop-status-badge')) {
        $('drop-status-badge').textContent = st.drop ? t('status.active') : t('status.inactive');
        $('drop-status-badge').className = 'badge ' + (st.drop ? 'ok' : 'warn');
      }

      // Update settings controls
      if ($('cfg-autostart')) $('cfg-autostart').checked = !!st.enabled;
      if ($('cfg-webui-enable')) $('cfg-webui-enable').checked = !!st.ui;
      if ($('daemon-state-badge')) {
        $('daemon-state-badge').textContent = st.running ? (st.ready ? 'Online' : 'Starting...') : 'Stopped';
        $('daemon-state-badge').className = 'badge ' + (st.running ? 'ok' : 'err');
      }

      // Web UI link
      const linkContainer = $('webui-link-container');
      const linkBtn = $('btn-link-webui');
      if (linkContainer && linkBtn) {
        if (st.ui && st.running) {
          linkContainer.style.display = 'block';
          const host = st.host || window.location.hostname || 'shareos';
          linkBtn.href = `http://${host}:${st.port || 7474}`;
        } else {
          linkContainer.style.display = 'none';
        }
      }

      if ($('sb-account')) {
        $('sb-account').textContent = t('sb.account', { account: st.account || '–' });
      }

      return st.ready;
    } catch (err) {
      console.warn('Error querying autobrr status:', err);
      updateConnBadge('offline');
      return false;
    }
  }

  // Fetch accounts list for handover
  async function refreshAccounts() {
    if (!AB || !AB.accounts) {
      accounts = [{ name: 'root', fullname: 'Administrator' }];
    } else {
      try {
        accounts = await AB.accounts();
      } catch (_) {
        accounts = [{ name: 'root', fullname: 'Administrator' }];
      }
    }

    const sel = $('sel-handover-account');
    if (!sel) return;
    sel.innerHTML = '';
    const current = (serviceStatus && serviceStatus.account) || 'root';

    for (const acc of accounts) {
      const opt = document.createElement('option');
      opt.value = acc.name;
      opt.textContent = acc.name + (acc.fullname ? ` (${acc.fullname})` : '');
      if (acc.name === current) opt.selected = true;
      sel.appendChild(opt);
    }
  }

  // Fetch releases
  async function refreshReleases() {
    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        let resp = null;
        try {
          resp = await AB.api('GET', '/api/release?limit=50');
        } catch (_) {
          resp = await AB.api('GET', '/api/releases?limit=50');
        }
        if (Array.isArray(resp)) {
          releases = resp;
        } else if (resp && Array.isArray(resp.data)) {
          releases = resp.data;
        }
      } catch (err) {
        console.warn('Failed to fetch releases:', err);
      }
    } else if (!releases.length) {
      releases = [...DEMO_RELEASES];
    }
    renderReleases();
  }

  // Render releases table
  function renderReleases() {
    const tbody = $('releases-rows');
    if (!tbody) return;
    const query = ($('search-input') ? $('search-input').value : '').toLowerCase().trim();

    tbody.innerHTML = '';
    const filtered = releases.filter((r) => {
      const name = r.torrent_name || r.name || '';
      const idx = r.indexer || '';
      const st = r.filter_status || r.status || '';
      if (!query) return true;
      return name.toLowerCase().includes(query) || idx.toLowerCase().includes(query) || st.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="6" style="text-align: center; color: var(--sos-muted); padding: 24px;">No releases match the criteria.</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const item of filtered) {
      const tr = document.createElement('tr');
      const timeStr = item.timestamp ? (item.timestamp.includes('T') ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : item.timestamp) : '--:--';
      const nameStr = item.torrent_name || item.name || 'Unnamed Release';
      const idxStr = item.indexer || '–';
      const channelStr = item.protocol || item.channel || '';
      const sizeStr = item.size || '';
      const statusRaw = item.filter_status || item.status || 'PENDING';
      const statusKey = String(statusRaw).toUpperCase();
      const statusLabel = t('status.' + statusKey) || statusKey;
      const actionStr = item.action_status || item.action || 'Watch dir';

      tr.innerHTML = `
        <td style="color: var(--sos-muted); font-size: 11px;">${escapeHtml(timeStr)}</td>
        <td>
          <span style="font-weight: 500;">${escapeHtml(idxStr)}</span>
          ${channelStr ? `<div style="font-size: 10px; color: var(--sos-muted);">${escapeHtml(channelStr)}</div>` : ''}
        </td>
        <td>
          <div class="release-title">${escapeHtml(nameStr)}</div>
          ${sizeStr ? `<div class="release-meta"><span>📦 ${escapeHtml(sizeStr)}</span></div>` : ''}
        </td>
        <td>
          <span class="status-pill status-${statusKey}">${escapeHtml(statusLabel)}</span>
        </td>
        <td style="font-size: 12px; color: var(--sos-muted);">${escapeHtml(actionStr)}</td>
        <td>
          <button class="sos-btn sos-btn-sm btn-push-release" data-id="${item.id}" title="${t('btn.send_transmission')}">
            ⚡ Push
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('.btn-push-release').forEach((btn) => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        pushRelease(id);
      };
    });
  }

  // Push release to Transmission / drop
  async function pushRelease(releaseId) {
    const item = releases.find((r) => r.id === releaseId);
    if (!item) return;

    toast(`Sending ${item.torrent_name || item.name} to Transmission drop folder...`);

    // Call autobrr's action API (triggers configured Watch dir action)
    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        try {
          await AB.api('POST', `/api/release/${releaseId}/action`);
        } catch (_) {
          await AB.api('POST', `/api/releases/${releaseId}/action`);
        }
        toast(`Torrent dispatched to Transmission drop folder!`);
        item.status = 'PUSH_APPROVED';
        item.action = 'Watch dir (' + (serviceStatus.account || 'root') + ')';
        renderReleases();
        return;
      } catch (err) {
        toast(`autobrr action error: ${err.message}`, true);
        return;
      }
    }

    // Standalone fallback
    item.status = 'PUSH_APPROVED';
    item.action = 'Watch dir (Simulated)';
    toast(`[Demo] Release dispatched to drop folder!`);
    renderReleases();
  }

  // Fetch filters from autobrr
  async function refreshFilters() {
    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        const resp = await AB.api('GET', '/api/filters');
        if (Array.isArray(resp)) {
          filters = resp;
        }
      } catch (err) {
        console.warn('Failed to fetch filters:', err);
      }
    } else if (!filters.length) {
      try {
        const saved = localStorage.getItem('autobrr_filters_demo');
        filters = saved ? JSON.parse(saved) : [...DEMO_FILTERS];
      } catch (_) {
        filters = [...DEMO_FILTERS];
      }
    }
    renderFilters();
  }

  // Render filter cards
  function renderFilters() {
    const container = $('filters-container');
    if (!container) return;
    container.innerHTML = '';

    if (filters.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--sos-muted); padding: 24px; text-align: center;">${t('filters.empty')}</div>`;
      return;
    }

    filters.forEach((f) => {
      const card = document.createElement('div');
      card.className = 'card';
      const isActive = f.enabled !== false;
      const idxs = Array.isArray(f.indexers) ? f.indexers.join(', ') : (f.indexers || '');
      const minS = f.min_size ? `${f.min_size}` : '0 MB';
      const maxS = f.max_size ? `${f.max_size}` : 'Unlimited';

      card.innerHTML = `
        <div class="card-header">
          <div class="card-title">${escapeHtml(f.name)}</div>
          <span class="status-pill ${isActive ? 'status-APPROVED' : 'status-FILTER_REJECTED'}">
            ${isActive ? t('status.active') : t('status.inactive')}
          </span>
        </div>
        <div class="card-desc">
          ${f.match_releases ? `<div><strong>Match:</strong> <code>${escapeHtml(f.match_releases)}</code></div>` : ''}
          ${f.except_releases ? `<div><strong>Except:</strong> <code>${escapeHtml(f.except_releases)}</code></div>` : ''}
          <div><strong>Trackers:</strong> ${idxs ? escapeHtml(idxs) : '<em>All</em>'}</div>
          ${f.freeleech ? `<div><span class="badge ok">Freeleech Only</span></div>` : ''}
        </div>
        <div class="card-meta">
          <span>Min: ${escapeHtml(minS)}</span>
          <span>Max: ${escapeHtml(maxS)}</span>
        </div>
        <div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 6px;">
          <button class="sos-btn sos-btn-sm btn-toggle-filter" data-id="${f.id}">
            ${isActive ? '⏸️' : '▶️'}
          </button>
          <button class="sos-btn sos-btn-sm btn-edit-filter" data-id="${f.id}">
            ✏️ ${t('btn.edit')}
          </button>
          <button class="sos-btn sos-btn-sm sos-btn-danger btn-del-filter" data-id="${f.id}">
            🗑️ ${t('btn.delete')}
          </button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll('.btn-toggle-filter').forEach((btn) => {
      btn.onclick = () => toggleFilter(btn.dataset.id);
    });
    container.querySelectorAll('.btn-edit-filter').forEach((btn) => {
      btn.onclick = () => openFilterModal(btn.dataset.id);
    });
    container.querySelectorAll('.btn-del-filter').forEach((btn) => {
      btn.onclick = () => deleteFilter(btn.dataset.id);
    });
  }

  // Toggle filter enabled/disabled
  async function toggleFilter(idStr) {
    const filter = filters.find((f) => String(f.id) === String(idStr));
    if (!filter) return;
    const newState = !filter.enabled;

    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        await AB.api('PUT', `/api/filters/${filter.id}`, { ...filter, enabled: newState });
        filter.enabled = newState;
        toast(`Filter "${filter.name}" ${newState ? 'enabled' : 'disabled'}`);
        renderFilters();
        return;
      } catch (err) {
        toast(`Error updating filter: ${err.message}`, true);
        return;
      }
    }

    filter.enabled = newState;
    localStorage.setItem('autobrr_filters_demo', JSON.stringify(filters));
    toast(`[Demo] Filter ${newState ? 'enabled' : 'disabled'}`);
    renderFilters();
  }

  // Delete filter
  async function deleteFilter(idStr) {
    const filter = filters.find((f) => String(f.id) === String(idStr));
    if (!filter) return;
    if (!confirm(`Delete filter "${filter.name}"?`)) return;

    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        await AB.api('DELETE', `/api/filters/${filter.id}`);
        filters = filters.filter((f) => String(f.id) !== String(idStr));
        toast(`Filter deleted`);
        renderFilters();
        updateStatusbar();
        return;
      } catch (err) {
        toast(`Error deleting filter: ${err.message}`, true);
        return;
      }
    }

    filters = filters.filter((f) => String(f.id) !== String(idStr));
    localStorage.setItem('autobrr_filters_demo', JSON.stringify(filters));
    toast('Filter deleted');
    renderFilters();
    updateStatusbar();
  }

  // Filter modal logic
  function openFilterModal(idStr = null) {
    editingFilterId = idStr;
    const modal = $('filter-modal');
    if (!modal) return;

    if (idStr != null) {
      const f = filters.find((x) => String(x.id) === String(idStr));
      if (f) {
        $('modal-title').textContent = t('filters.edit_title');
        $('filter-name').value = f.name || '';
        $('filter-indexers').value = Array.isArray(f.indexers) ? f.indexers.join(', ') : (f.indexers || '');
        $('filter-match').value = f.match_releases || '';
        $('filter-except').value = f.except_releases || '';
        $('filter-min-size').value = parseInt(f.min_size, 10) || '';
        $('filter-max-size').value = parseInt(f.max_size, 10) || '';
        $('filter-freeleech').checked = !!f.freeleech;
        $('filter-enabled').checked = f.enabled !== false;
      }
    } else {
      $('modal-title').textContent = t('filters.new_title');
      $('filter-name').value = '';
      $('filter-indexers').value = '';
      $('filter-match').value = '';
      $('filter-except').value = '';
      $('filter-min-size').value = '';
      $('filter-max-size').value = '';
      $('filter-freeleech').checked = false;
      $('filter-enabled').checked = true;
    }

    modal.style.display = 'flex';
  }

  function closeFilterModal() {
    const modal = $('filter-modal');
    if (modal) modal.style.display = 'none';
    editingFilterId = null;
  }

  async function saveFilterFromModal() {
    const name = ($('filter-name').value || '').trim();
    if (!name) {
      toast('Please enter a filter name', true);
      return;
    }

    const idxStr = ($('filter-indexers').value || '').trim();
    const indexersArr = idxStr ? idxStr.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const minS = parseInt($('filter-min-size').value, 10) || 0;
    const maxS = parseInt($('filter-max-size').value, 10) || 0;

    const payload = {
      name,
      enabled: $('filter-enabled').checked,
      indexers: indexersArr,
      match_releases: ($('filter-match').value || '').trim(),
      except_releases: ($('filter-except').value || '').trim(),
      min_size: minS ? `${minS}MB` : '',
      max_size: maxS ? `${maxS}MB` : '',
      freeleech: $('filter-freeleech').checked,
      resolutions: [],
      codecs: [],
      sources: [],
      containers: []
    };

    // Use action type "Watch dir" with the drop folder status().drop for Transmission
    if (serviceStatus && serviceStatus.drop) {
      payload.actions = [
        {
          name: 'Transmission Watch Dir',
          type: 'watch_dir',
          enabled: true,
          watch_dir: serviceStatus.drop
        }
      ];
    }

    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        if (editingFilterId) {
          await AB.api('PUT', `/api/filters/${editingFilterId}`, payload);
          toast(t('btn.save'));
        } else {
          await AB.api('POST', '/api/filters', payload);
          toast('Filter created successfully');
        }
        closeFilterModal();
        await refreshFilters();
        updateStatusbar();
        return;
      } catch (err) {
        toast(`Error saving filter: ${err.message}`, true);
        return;
      }
    }

    // Standalone fallback
    if (editingFilterId) {
      const idx = filters.findIndex((f) => String(f.id) === String(editingFilterId));
      if (idx >= 0) filters[idx] = { id: editingFilterId, ...payload };
    } else {
      payload.id = Date.now();
      filters.push(payload);
    }
    localStorage.setItem('autobrr_filters_demo', JSON.stringify(filters));
    toast(t('btn.save'));
    closeFilterModal();
    renderFilters();
    updateStatusbar();
  }

  // Fetch IRC networks & indexers
  async function refreshIRCAndIndexers() {
    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        const fetchIrc = async () => {
          try { return await AB.api('GET', '/api/irc'); }
          catch (_) { return await AB.api('GET', '/api/irc/networks').catch(() => null); }
        };
        const [irc, idx] = await Promise.all([
          fetchIrc(),
          AB.api('GET', '/api/indexer').catch(() => null)
        ]);
        if (Array.isArray(irc)) ircNetworks = irc;
        if (Array.isArray(idx)) indexers = idx;
      } catch (_) {}
    } else {
      ircNetworks = [...DEMO_IRC];
      indexers = [...DEMO_INDEXERS];
    }

    renderIRC();
    renderIndexers();
  }

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
      const srvStr = net.server ? `${net.server}${net.port ? ':' + net.port : ''}` : (net.name || 'IRC Server');
      const chList = Array.isArray(net.channels) ? net.channels.map((c) => c.name || c).join(', ') : (net.channel || '–');
      const botStr = net.bot || (net.channels && net.channels[0] && net.channels[0].bot) || '–';
      const nickStr = net.nick || 'autobrr';
      const st = (net.status && net.status.state) || net.status || 'irc.connected';
      const isConn = st === 'connected' || st === 'irc.connected';

      tr.innerHTML = `
        <td><strong style="color: var(--sos-text);">${escapeHtml(srvStr)}</strong></td>
        <td><code>${escapeHtml(chList)}</code></td>
        <td>${escapeHtml(botStr)}</td>
        <td>${escapeHtml(nickStr)}</td>
        <td>
          <span class="badge ${isConn ? 'ok' : 'warn'}">
            ● ${isConn ? t('irc.connected') : t('irc.disconnected')}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  function renderIndexers() {
    const tbody = $('indexers-rows');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (indexers.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--sos-muted); padding: 20px;">${t('indexers.empty')}</td></tr>`;
      return;
    }

    for (const idx of indexers) {
      const tr = document.createElement('tr');
      const isEnabled = idx.enabled !== false;
      tr.innerHTML = `
        <td><strong>${escapeHtml(idx.name)}</strong></td>
        <td><code>${escapeHtml(idx.identifier || idx.name.toLowerCase())}</code></td>
        <td style="color: var(--sos-muted); font-size: 12px;">${escapeHtml(idx.type || 'Torznab / IRC')}</td>
        <td>
          <span class="badge ${isEnabled ? 'ok' : 'err'}">
            ${isEnabled ? t('status.active') : t('status.inactive')}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    }
  }

  // Fetch daemon log
  async function refreshLog() {
    const box = $('daemon-log-box');
    if (!box) return;

    if (!AB || !AB.log) {
      box.textContent = '[Standalone Demo] autobrr logs available when running on ShareOS with the autobrr system service.';
      return;
    }

    try {
      const res = await AB.log();
      box.textContent = res.log || '(Log is empty)';
      box.scrollTop = box.scrollHeight;
    } catch (err) {
      box.textContent = `Error reading log: ${err.message}`;
    }
  }

  // Service control actions
  async function startService() {
    if (!AB) {
      toast('ShareOS.autobrr SDK not available', true);
      return;
    }
    try {
      toast('Starting autobrr service...');
      await AB.start();
      toast('autobrr started successfully!');
      await refreshAll();
    } catch (err) {
      toast(`Failed to start: ${err.message}`, true);
    }
  }

  async function stopService() {
    if (!AB) return;
    try {
      toast('Stopping autobrr service...');
      await AB.set({ enabled: false });
      toast('autobrr stopped.');
      await refreshAll();
    } catch (err) {
      toast(`Failed to stop: ${err.message}`, true);
    }
  }

  async function saveHandoverAccount() {
    if (!AB) return;
    const sel = $('sel-handover-account');
    if (!sel) return;
    const acc = sel.value;
    try {
      toast(`Updating handover account to "${acc}"...`);
      await AB.set({ account: acc });
      toast(`Handover account set to "${acc}"! Transmission watch-dir updated.`);
      await refreshStatus();
    } catch (err) {
      toast(`Error updating account: ${err.message}`, true);
    }
  }

  async function toggleWebUI(enable) {
    if (!AB) return;
    try {
      await AB.set({ ui: enable });
      toast(enable ? 'Web UI enabled on 0.0.0.0:7474' : 'Web UI disabled (127.0.0.1 only)');
      await refreshStatus();
    } catch (err) {
      toast(`Error updating Web UI setting: ${err.message}`, true);
    }
  }

  async function toggleAutostart(enable) {
    if (!AB) return;
    try {
      await AB.set({ enabled: enable });
      toast(enable ? 'Autostart on boot enabled' : 'Autostart disabled');
      await refreshStatus();
    } catch (err) {
      toast(`Error: ${err.message}`, true);
    }
  }

  async function saveAdminPassword() {
    if (!AB) return;
    const inp = $('input-admin-pw');
    if (!inp) return;
    const pw = (inp.value || '').trim();
    if (pw.length < 8 || pw.length > 128) {
      toast('Password must be between 8 and 128 characters', true);
      return;
    }
    try {
      toast('Updating admin password...');
      await AB.password(pw);
      toast('Admin password updated successfully!');
      inp.value = '';
    } catch (err) {
      toast(`Error changing password: ${err.message}`, true);
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
      $('sb-updated').textContent = t('sb.updated', {
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    }
  }

  // Refresh everything
  async function refreshAll() {
    const isReady = await refreshStatus();
    await refreshAccounts();
    await refreshReleases();
    await refreshFilters();
    await refreshIRCAndIndexers();
    if ($('tab-settings') && $('tab-settings').classList.contains('active')) {
      await refreshLog();
    }
    updateStatusbar();
  }

  // Tab switching
  function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.onclick = () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));

        btn.classList.add('active');
        const targetId = btn.dataset.tab;
        const panel = $(targetId);
        if (panel) {
          panel.classList.add('active');
          if (targetId === 'tab-settings') refreshLog();
        }
      };
    });
  }

  function switchTab(tabId) {
    const btn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (btn) btn.click();
  }

  async function openAdvancedWebUI() {
    if (!AB) {
      toast('ShareOS.autobrr is not available (admin accounts only)', true);
      return;
    }
    const host = (serviceStatus && serviceStatus.host) || window.location.hostname || 'shareos';
    const port = (serviceStatus && serviceStatus.port) || 7474;
    const url = `http://${host}:${port}`;

    if (!serviceStatus || !serviceStatus.ui) {
      try {
        toast('Enabling native Web UI on 0.0.0.0:7474...');
        await AB.set({ ui: true });
        await refreshStatus();
      } catch (err) {
        toast(`Failed to enable Web UI: ${err.message}`, true);
        return;
      }
    }
    window.open(url, '_blank');
  }

  // ShareOS Desktop Menubar
  function setupMenu() {
    const menuEl = $('menu');
    if (!menuEl || !SOS || !SOS.menu) return;

    SOS.menu(menuEl, [
      {
        label: t('menu.file'),
        items: [
          { label: t('menu.refresh'), kbd: 'Ctrl+R', action: refreshAll },
          { label: t('menu.view_log'), action: () => { switchTab('tab-settings'); refreshLog(); } },
          '-',
          { label: t('menu.quit'), action: () => window.close() }
        ]
      },
      {
        label: t('menu.service'),
        items: [
          { label: t('menu.start'), action: startService },
          { label: t('menu.stop'), action: stopService },
          '-',
          { label: t('menu.open_ui'), action: openAdvancedWebUI }
        ]
      },
      {
        label: t('menu.view'),
        items: [
          { label: t('menu.tab.releases'), action: () => switchTab('tab-releases') },
          { label: t('menu.tab.filters'), action: () => switchTab('tab-filters') },
          { label: t('menu.tab.irc'), action: () => switchTab('tab-irc') },
          { label: t('menu.tab.transmission'), action: () => switchTab('tab-transmission') },
          { label: t('menu.tab.settings'), action: () => switchTab('tab-settings') },
          '-',
          { label: t('menu.transmission'), action: openTransmission }
        ]
      },
      {
        label: t('menu.help'),
        items: [
          { label: t('menu.docs'), action: () => window.open('https://autobrr.com/', '_blank') },
          { label: t('menu.about'), action: () => alert('autobrr for ShareOS v1.0.0\nIntegrated via ShareOS.autobrr\nPublisher: @SamuelSilvaG') }
        ]
      }
    ]);
  }

  function openTransmission() {
    if (SOS && SOS.openApp) {
      SOS.openApp('transmission', { width: 1050, height: 720 });
    } else {
      window.open('../transmission/index.html', 'transmission');
    }
  }

  // App Initialization
  document.addEventListener('DOMContentLoaded', () => {
    if (window.I18N) I18N.apply();
    setupTabs();
    setupMenu();

    // Toolbar buttons
    if ($('btn-refresh')) $('btn-refresh').onclick = refreshAll;
    if ($('btn-add-filter')) $('btn-add-filter').onclick = () => openFilterModal();
    if ($('btn-new-filter-panel')) $('btn-new-filter-panel').onclick = () => openFilterModal();
    if ($('btn-view-logs')) $('btn-view-logs').onclick = () => { switchTab('tab-settings'); refreshLog(); };
    if ($('btn-open-transmission')) $('btn-open-transmission').onclick = openTransmission;
    if ($('btn-open-trans-app')) $('btn-open-trans-app').onclick = openTransmission;
    if ($('btn-open-webui')) $('btn-open-webui').onclick = openAdvancedWebUI;

    // Service & settings buttons
    if ($('btn-start-svc')) $('btn-start-svc').onclick = startService;
    if ($('btn-stop-svc')) $('btn-stop-svc').onclick = stopService;
    if ($('btn-save-account')) $('btn-save-account').onclick = saveHandoverAccount;
    if ($('btn-save-admin-pw')) $('btn-save-admin-pw').onclick = saveAdminPassword;
    if ($('btn-refresh-log')) $('btn-refresh-log').onclick = refreshLog;
    if ($('btn-test-transmission')) $('btn-test-transmission').onclick = () => {
      if (serviceStatus && serviceStatus.drop) {
        toast(`Drop folder active: ${serviceStatus.drop} (account: ${serviceStatus.account || 'root'})`);
      } else {
        toast('Drop folder is not yet configured. Please select a user account in Settings.', true);
      }
    };

    // Checkboxes
    if ($('cfg-autostart')) {
      $('cfg-autostart').onchange = (e) => toggleAutostart(e.target.checked);
    }
    if ($('cfg-webui-enable')) {
      $('cfg-webui-enable').onchange = (e) => toggleWebUI(e.target.checked);
    }

    // Search filter
    if ($('search-input')) {
      $('search-input').oninput = renderReleases;
    }

    // Modal buttons
    if ($('modal-close-btn')) $('modal-close-btn').onclick = closeFilterModal;
    if ($('modal-cancel-btn')) $('modal-cancel-btn').onclick = closeFilterModal;
    if ($('modal-save-btn')) $('modal-save-btn').onclick = saveFilterFromModal;

    // Listen to theme changes from ShareOS
    if (SOS && SOS.onTheme) {
      SOS.onTheme(() => {
        // Automatically handled by ShareOS CSS variables
      });
    }

    // Initial load and periodic polling every 12 seconds
    refreshAll();
    pollTimer = setInterval(refreshAll, 12000);
  });
})();
