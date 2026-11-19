// autobrr ShareOS Web Client
// Fully integrated with ShareOS.autobrr (ShareOS 0.2.0-beta.9+)
'use strict';

(function () {
  const SOS = window.ShareOS || null;
  const AB = SOS && SOS.autobrr;

  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);

  // App State
  let serviceStatus = null;
  let releases = [];
  let filters = [];
  let ircNetworks = [];
  let indexers = [];
  let indexerSchemas = [];
  let accounts = [];
  let editingFilterId = null;
  let editingIndexerId = null;
  let editingIrcId = null;
  let editingIndexerData = null;
  let pollTimer = null;
  let isRefreshing = false;
  let refreshQueued = false;

  function applyTheme(tObj) {
    if (!tObj) return;
    const theme = typeof tObj === 'string' ? tObj : tObj.theme;
    const accent = typeof tObj === 'object' ? tObj.accent : null;
    if (theme) document.documentElement.dataset.theme = theme;
    if (accent) document.documentElement.dataset.accent = accent;
  }

  function initTheme() {
    if (!SOS) return;
    if (SOS.theme) applyTheme(SOS.theme);
    if (SOS.onTheme) SOS.onTheme(applyTheme);
  }

  function parseCsvList(str) {
    return String(str || '').split(',').map((s) => s.trim()).filter(Boolean);
  }

  function formatFilterIndexers(list) {
    if (Array.isArray(list)) {
      return list.map((x) => (typeof x === 'object' && x ? (x.name || x.identifier || '') : String(x || ''))).filter(Boolean).join(', ');
    }
    return list || '';
  }

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
      serviceStatus = null;
      if (SOS) {
        updateConnBadge('offline', t('conn.no_access'));
        updateBanner('no_access', t('banner.no_access_title'), t('banner.no_access_desc'));
      } else {
        updateConnBadge('offline', t('conn.offline'));
        updateBanner('offline', t('banner.offline_title'), t('banner.offline_desc'));
      }

      if ($('trans-drop-path')) $('trans-drop-path').textContent = '–';
      if ($('trans-drop-account')) $('trans-drop-account').textContent = '–';
      if ($('drop-status-badge')) {
        $('drop-status-badge').textContent = t('status.inactive');
        $('drop-status-badge').className = 'badge warn';
      }
      if ($('daemon-state-badge')) {
        $('daemon-state-badge').textContent = t('status.stopped');
        $('daemon-state-badge').className = 'badge err';
      }
      if ($('btn-webui-exposed')) $('btn-webui-exposed').style.display = 'none';
      if ($('webui-link-container')) $('webui-link-container').style.display = 'none';
      if ($('sb-account')) $('sb-account').textContent = t('sb.account', { account: '–' });

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
      if ($('btn-webui-exposed')) $('btn-webui-exposed').style.display = (st.running && st.ui) ? 'inline-flex' : 'none';
      if ($('daemon-state-badge')) {
        $('daemon-state-badge').textContent = st.running ? (st.ready ? 'Online' : 'Starting...') : t('status.stopped');
        $('daemon-state-badge').className = 'badge ' + (st.running ? 'ok' : 'err');
      }

      // Web UI link
      const webuiUrl = getWebUIUrl();
      const linkBtn = $('btn-link-webui');
      const urlText = $('webui-url-text');
      if (linkBtn) linkBtn.href = webuiUrl;
      if (urlText) urlText.textContent = webuiUrl;

      // Check Transmission status
      checkTransmissionStatus();

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
      accounts = [];
    } else {
      try {
        accounts = await AB.accounts();
      } catch (_) {
        accounts = [];
      }
    }

    const sel = $('sel-handover-account');
    if (!sel) return;
    sel.innerHTML = '';
    const current = (serviceStatus && serviceStatus.account) || 'root';

    if (!accounts.length) {
      const opt = document.createElement('option');
      opt.value = current;
      opt.textContent = current;
      sel.appendChild(opt);
      return;
    }

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
        } else {
          releases = [];
        }
      } catch (err) {
        console.warn('Failed to fetch releases:', err);
        releases = [];
      }
    } else {
      releases = [];
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
      let msg = t('releases.empty');
      if (query) {
        msg = t('releases.no_match');
      } else if (!AB && SOS) {
        msg = t('releases.no_access');
      }
      tr.innerHTML = `<td colspan="6" style="text-align: center; color: var(--sos-muted); padding: 24px;">${escapeHtml(msg)}</td>`;
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
      const statusClass = /^[A-Z_]+$/.test(statusKey) ? statusKey : 'UNKNOWN';
      const statusI18nKey = 'status.' + statusKey;
      const trStatus = t(statusI18nKey);
      const statusLabel = trStatus !== statusI18nKey ? trStatus : statusKey;
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
          <span class="status-pill status-${statusClass}">${escapeHtml(statusLabel)}</span>
        </td>
        <td style="font-size: 12px; color: var(--sos-muted);">${escapeHtml(actionStr)}</td>
        <td>
          <button class="sos-btn sos-btn-sm btn-push-release" data-id="${item.id}" title="${escapeHtml(t('btn.send_transmission'))}">
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

    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }

    toast(`Sending ${item.torrent_name || item.name} to Transmission drop folder...`);

    // Call autobrr's action API (triggers configured Watch dir action)
    try {
      try {
        await AB.api('POST', `/api/release/${releaseId}/action`);
      } catch (_) {
        await AB.api('POST', `/api/releases/${releaseId}/action`);
      }
      toast(t('toast.torrent_dispatched'));
      item.status = 'PUSH_APPROVED';
      item.action = 'Watch dir (' + (serviceStatus.account || 'root') + ')';
      renderReleases();
    } catch (err) {
      toast(`autobrr action error: ${err.message}`, true);
    }
  }

  // Fetch filters from autobrr
  async function refreshFilters() {
    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        const resp = await AB.api('GET', '/api/filters');
        if (Array.isArray(resp)) {
          filters = resp;
        } else {
          filters = [];
        }
      } catch (err) {
        console.warn('Failed to fetch filters:', err);
        filters = [];
      }
    } else {
      filters = [];
    }
    renderFilters();
  }

  // Render filter cards
  function renderFilters() {
    const container = $('filters-container');
    if (!container) return;
    container.innerHTML = '';

    if (filters.length === 0) {
      const msg = (!AB && SOS) ? t('filters.no_access') : t('filters.empty');
      container.innerHTML = `<div style="grid-column: 1 / -1; color: var(--sos-muted); padding: 24px; text-align: center;">${escapeHtml(msg)}</div>`;
      return;
    }

    filters.forEach((f) => {
      const card = document.createElement('div');
      card.className = 'card';
      const isActive = f.enabled !== false;
      const idxs = formatFilterIndexers(f.indexers);
      const minS = f.min_size ? `${f.min_size}` : '0 MB';
      const maxS = f.max_size ? `${f.max_size}` : t('filters.card_unlimited');
      const resArr = Array.isArray(f.resolutions) ? f.resolutions : [];
      const srcArr = Array.isArray(f.sources) ? f.sources : [];
      const codArr = Array.isArray(f.codecs) ? f.codecs : [];
      const tagPills = [...resArr, ...srcArr, ...codArr]
        .filter(Boolean)
        .map((tag) => `<span class="filter-tag">${escapeHtml(tag)}</span>`)
        .join('');

      card.innerHTML = `
        <div class="card-header">
          <div class="card-title">${escapeHtml(f.name)}</div>
          <span class="status-pill ${isActive ? 'status-APPROVED' : 'status-FILTER_REJECTED'}">
            ${escapeHtml(isActive ? t('status.active') : t('status.inactive'))}
          </span>
        </div>
        <div class="card-desc">
          ${f.match_releases ? `<div><strong>${escapeHtml(t('filters.card_match'))}</strong> <code>${escapeHtml(f.match_releases)}</code></div>` : ''}
          ${f.except_releases ? `<div><strong>${escapeHtml(t('filters.card_except'))}</strong> <code>${escapeHtml(f.except_releases)}</code></div>` : ''}
          <div><strong>${escapeHtml(t('filters.card_trackers'))}</strong> ${idxs ? escapeHtml(idxs) : `<em>${escapeHtml(t('filters.card_all'))}</em>`}</div>
          ${tagPills ? `<div class="filter-tags">${tagPills}</div>` : ''}
          ${f.freeleech ? `<div style="margin-top:4px;"><span class="badge ok">${escapeHtml(t('filters.freeleech'))}</span></div>` : ''}
        </div>
        <div class="card-meta">
          <span>${escapeHtml(t('filters.card_min'))} ${escapeHtml(minS)}</span>
          <span>${escapeHtml(t('filters.card_max'))} ${escapeHtml(maxS)}</span>
        </div>
        <div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 6px;">
          <button class="sos-btn sos-btn-sm btn-toggle-filter" data-id="${f.id}">
            ${isActive ? '⏸️' : '▶️'}
          </button>
          <button class="sos-btn sos-btn-sm btn-edit-filter" data-id="${f.id}">
            ✏️ ${escapeHtml(t('btn.edit'))}
          </button>
          <button class="sos-btn sos-btn-sm sos-btn-danger btn-del-filter" data-id="${f.id}">
            🗑️ ${escapeHtml(t('btn.delete'))}
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

    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }

    const newState = !filter.enabled;
    try {
      await AB.api('PUT', `/api/filters/${filter.id}`, { ...filter, enabled: newState });
      filter.enabled = newState;
      toast(`Filter "${filter.name}" ${newState ? 'enabled' : 'disabled'}`);
      renderFilters();
    } catch (err) {
      toast(`Error updating filter: ${err.message}`, true);
    }
  }

  // Delete filter
  async function deleteFilter(idStr) {
    const filter = filters.find((f) => String(f.id) === String(idStr));
    if (!filter) return;
    if (!confirm(`Delete filter "${filter.name}"?`)) return;

    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }

    try {
      await AB.api('DELETE', `/api/filters/${filter.id}`);
      filters = filters.filter((f) => String(f.id) !== String(idStr));
      toast(t('toast.filter_deleted'));
      renderFilters();
      updateStatusbar();
    } catch (err) {
      toast(`Error deleting filter: ${err.message}`, true);
    }
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
        $('filter-indexers').value = formatFilterIndexers(f.indexers);
        $('filter-match').value = f.match_releases || '';
        $('filter-except').value = f.except_releases || '';
        $('filter-min-size').value = parseInt(f.min_size, 10) || '';
        $('filter-max-size').value = parseInt(f.max_size, 10) || '';
        if ($('filter-resolutions')) $('filter-resolutions').value = Array.isArray(f.resolutions) ? f.resolutions.join(', ') : '';
        if ($('filter-sources')) $('filter-sources').value = Array.isArray(f.sources) ? f.sources.join(', ') : '';
        if ($('filter-codecs')) $('filter-codecs').value = Array.isArray(f.codecs) ? f.codecs.join(', ') : '';
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
      if ($('filter-resolutions')) $('filter-resolutions').value = '';
      if ($('filter-sources')) $('filter-sources').value = '';
      if ($('filter-codecs')) $('filter-codecs').value = '';
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

    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }

    const baseFilter = editingFilterId
      ? (filters.find((x) => String(x.id) === String(editingFilterId)) || {})
      : {};
    const idxNames = parseCsvList($('filter-indexers').value);
    let indexersPayload = idxNames;
    if (Array.isArray(baseFilter.indexers) && baseFilter.indexers.some((x) => x && typeof x === 'object')) {
      indexersPayload = idxNames.map((entry) => {
        const low = entry.toLowerCase();
        const existingObj = baseFilter.indexers.find((x) =>
          x && typeof x === 'object' &&
          (String(x.name || '').toLowerCase() === low || String(x.identifier || '').toLowerCase() === low)
        );
        if (existingObj) return existingObj;
        const known = indexers.find((x) =>
          String(x.name || '').toLowerCase() === low || String(x.identifier || '').toLowerCase() === low
        );
        return known ? { id: known.id, name: known.name, identifier: known.identifier } : entry;
      });
    }
    const minS = parseInt($('filter-min-size').value, 10) || 0;
    const maxS = parseInt($('filter-max-size').value, 10) || 0;

    const payload = Object.assign({}, baseFilter, {
      name,
      enabled: $('filter-enabled').checked,
      indexers: indexersPayload,
      match_releases: ($('filter-match').value || '').trim(),
      except_releases: ($('filter-except').value || '').trim(),
      min_size: minS ? `${minS}MB` : '',
      max_size: maxS ? `${maxS}MB` : '',
      freeleech: $('filter-freeleech').checked,
      resolutions: $('filter-resolutions') ? parseCsvList($('filter-resolutions').value) : (baseFilter.resolutions || []),
      sources: $('filter-sources') ? parseCsvList($('filter-sources').value) : (baseFilter.sources || []),
      codecs: $('filter-codecs') ? parseCsvList($('filter-codecs').value) : (baseFilter.codecs || []),
      containers: Array.isArray(baseFilter.containers) ? baseFilter.containers : []
    });

    // Preserve existing actions when editing; attach Transmission watch_dir for new filters
    if (!Array.isArray(payload.actions) || payload.actions.length === 0) {
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
    }

    try {
      if (editingFilterId) {
        await AB.api('PUT', `/api/filters/${editingFilterId}`, payload);
        toast(t('btn.save'));
      } else {
        await AB.api('POST', '/api/filters', payload);
        toast(t('toast.filter_created'));
      }
      closeFilterModal();
      await refreshFilters();
      updateStatusbar();
    } catch (err) {
      toast(`Error saving filter: ${err.message}`, true);
    }
  }

  function normalizeIndexerSettingsMap(rawSettings) {
    const map = {};
    if (Array.isArray(rawSettings)) {
      for (const s of rawSettings) {
        if (s && s.name && s.value != null && s.value !== '') {
          map[s.name] = String(s.value);
        }
      }
    } else if (rawSettings && typeof rawSettings === 'object') {
      for (const [k, v] of Object.entries(rawSettings)) {
        if (v != null) map[k] = String(v);
      }
    }
    return map;
  }

  async function fetchAllIndexers() {
    const [mappedResp, optionsResp] = await Promise.all([
      AB.api('GET', '/api/indexer').catch(() => null),
      AB.api('GET', '/api/indexer/options').catch(() => null)
    ]);
    const mapped = Array.isArray(mappedResp) ? mappedResp : [];
    const options = Array.isArray(optionsResp) ? optionsResp : [];
    const byKey = new Map();

    for (const item of mapped) {
      if (!item) continue;
      const key = item.id != null ? `id:${item.id}` : `ident:${String(item.identifier || '').toLowerCase()}`;
      byKey.set(key, Object.assign({}, item, {
        settings: normalizeIndexerSettingsMap(item.settings)
      }));
    }

    for (const opt of options) {
      if (!opt) continue;
      const idKey = opt.id != null ? `id:${opt.id}` : null;
      const identKey = `ident:${String(opt.identifier || '').toLowerCase()}`;
      let matchKey = (idKey && byKey.has(idKey)) ? idKey : null;
      if (!matchKey) {
        for (const [k, v] of byKey.entries()) {
          if (String(v.identifier || '').toLowerCase() === String(opt.identifier || '').toLowerCase()) {
            matchKey = k;
            break;
          }
        }
      }
      const prev = matchKey ? byKey.get(matchKey) : {};
      const mergedSettings = Object.assign({}, prev.settings || {}, normalizeIndexerSettingsMap(opt.settings));
      byKey.set(matchKey || idKey || identKey, Object.assign({}, prev, opt, {
        type: prev.type || opt.implementation || 'Torznab / IRC',
        settings: mergedSettings
      }));
    }

    return Array.from(byKey.values());
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
          fetchAllIndexers()
        ]);
        ircNetworks = Array.isArray(irc) ? irc : [];
        indexers = Array.isArray(idx) ? idx : [];
      } catch (_) {
        ircNetworks = [];
        indexers = [];
      }
    } else {
      ircNetworks = [];
      indexers = [];
    }

    renderIRC();
    renderIndexers();
  }

  // Load indexer schemas/presets from autobrr
  async function fetchIndexerSchemas() {
    if (!AB || !serviceStatus || !serviceStatus.ready) return;
    if (indexerSchemas.length > 0) return;
    try {
      const data = await AB.api('GET', '/api/indexer/schema');
      if (Array.isArray(data)) {
        indexerSchemas = data;
        populateIndexerPresets();
        const modal = $('indexer-modal');
        if (modal && modal.style.display !== 'none') {
          updateIndexerSchemaUI();
        }
      }
    } catch (e) {
      console.warn('Could not load indexer schemas:', e);
    }
  }

  function populateIndexerPresets() {
    const sel = $('indexer-preset');
    if (!sel) return;
    const currentVal = sel.value || (editingIndexerData && editingIndexerData.identifier) || '';
    sel.innerHTML = `<option value="">${escapeHtml(t('indexers.custom_preset'))}</option>`;
    const sorted = [...indexerSchemas].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    for (const schema of sorted) {
      const opt = document.createElement('option');
      opt.value = schema.identifier;
      opt.textContent = schema.name || schema.identifier;
      sel.appendChild(opt);
    }
    if (currentVal) sel.value = currentVal;
  }

  function findIndexerSchema(identifier, indexerObj) {
    const presetVal = ($('indexer-preset') ? $('indexer-preset').value : '').trim().toLowerCase();
    const rawId = String(identifier || '').trim().toLowerCase();
    const impl = String((indexerObj && indexerObj.implementation) || '').trim().toLowerCase();
    const baseId = rawId.replace(/-\d+$/, '');
    const candidates = [presetVal, rawId, impl, baseId].filter(Boolean);
    for (const cand of candidates) {
      const hit = indexerSchemas.find((s) => String(s.identifier || '').toLowerCase() === cand);
      if (hit) return hit;
    }
    return null;
  }

  function isSecretSetting(s) {
    const type = String((s && s.type) || '').toLowerCase();
    const name = String((s && s.name) || '').toLowerCase();
    return type === 'secret' || type === 'password' ||
      name.includes('key') || name.includes('pass') || name.includes('secret') ||
      name.includes('token') || name.includes('cookie');
  }

  function renderIndexerSchemaFields(schema, existingSettings, isEdit) {
    const dyn = $('indexer-dynamic-fields');
    const def = $('indexer-default-fields');
    if (!dyn || !def) return false;

    const editable = (schema && Array.isArray(schema.settings))
      ? schema.settings.filter((s) => s && s.name && String(s.type || '').toLowerCase() !== 'info')
      : [];

    dyn.innerHTML = '';
    if (!editable.length) {
      dyn.style.display = 'none';
      def.style.display = 'block';
      return false;
    }

    def.style.display = 'none';
    dyn.style.display = 'block';
    const settingsObj = (existingSettings && typeof existingSettings === 'object') ? existingSettings : {};

    for (const s of editable) {
      const wrap = document.createElement('div');
      wrap.className = 'form-group';
      const type = String(s.type || 'text').toLowerCase();
      const inputId = `idx-dyn-${String(s.name).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      if (type === 'checkbox' || type === 'bool') {
        const lbl = document.createElement('label');
        lbl.className = 'form-check-row';
        const inp = document.createElement('input');
        inp.type = 'checkbox';
        inp.id = inputId;
        inp.dataset.settingKey = s.name;
        const curCheck = settingsObj[s.name] !== undefined ? settingsObj[s.name] : (s.value ?? s.default);
        inp.checked = curCheck === true || curCheck === 'true' || curCheck === '1' || curCheck === 1;
        const span = document.createElement('span');
        span.textContent = s.label || s.name;
        lbl.appendChild(inp);
        lbl.appendChild(span);
        wrap.appendChild(lbl);
      } else {
        const lbl = document.createElement('label');
        lbl.htmlFor = inputId;
        lbl.textContent = s.label || s.name;
        wrap.appendChild(lbl);

        if (Array.isArray(s.options) && s.options.length > 0) {
          const sel = document.createElement('select');
          sel.id = inputId;
          sel.className = 'sos-input';
          sel.dataset.settingKey = s.name;
          for (const optDef of s.options) {
            const opt = document.createElement('option');
            if (optDef && typeof optDef === 'object') {
              opt.value = optDef.value != null ? String(optDef.value) : '';
              opt.textContent = optDef.label || optDef.name || opt.value;
            } else {
              opt.value = String(optDef);
              opt.textContent = String(optDef);
            }
            sel.appendChild(opt);
          }
          const curVal = settingsObj[s.name] !== undefined ? settingsObj[s.name] : (s.value ?? s.default);
          if (curVal !== undefined) sel.value = String(curVal);
          wrap.appendChild(sel);
        } else {
          const inp = document.createElement('input');
          inp.id = inputId;
          inp.className = 'sos-input';
          inp.dataset.settingKey = s.name;
          if (isSecretSetting(s)) {
            inp.type = 'password';
            inp.dataset.settingSecret = '1';
            inp.value = '';
            inp.placeholder = isEdit
              ? t('indexers.apikey_edit_placeholder')
              : (s.placeholder || s.label || t('indexers.apikey_placeholder'));
          } else {
            inp.type = type === 'number' ? 'number' : 'text';
            const fallbackUrl = (s.name === 'base_url' && schema.urls && schema.urls[0]) ? schema.urls[0] : '';
            const val = settingsObj[s.name] !== undefined ? settingsObj[s.name] : (s.value ?? s.default ?? fallbackUrl);
            inp.value = val != null ? String(val) : '';
            if (s.placeholder) inp.placeholder = s.placeholder;
          }
          wrap.appendChild(inp);
        }
      }

      if (s.help || s.description) {
        const hint = document.createElement('div');
        hint.className = 'form-hint';
        hint.textContent = s.help || s.description;
        wrap.appendChild(hint);
      }

      dyn.appendChild(wrap);
    }

    return true;
  }

  function updateIndexerSchemaUI() {
    const ident = $('indexer-identifier') ? $('indexer-identifier').value : '';
    const schema = findIndexerSchema(ident, editingIndexerData);
    const settings = editingIndexerData ? editingIndexerData.settings : {};
    renderIndexerSchemaFields(schema, settings, !!editingIndexerId);
  }

  // Helper to suggest a unique identifier when one already exists
  function getSuggestedIdentifier(baseIdentifier, list, currentEditId) {
    const raw = (baseIdentifier || 'indexer').trim().toLowerCase();
    const cleanBase = raw.replace(/-\d+$/, '');
    let counter = 2;
    let candidate = `${cleanBase}-${counter}`;
    const isTaken = (cand) => (list || []).some((idx) =>
      idx.id !== currentEditId && String(idx.identifier || '').toLowerCase() === cand.toLowerCase()
    );
    while (isTaken(candidate)) {
      counter++;
      candidate = `${cleanBase}-${counter}`;
    }
    return candidate;
  }

  // Helper to check if an indexer/schema is a generic feed (Torznab, Newznab, RSS).
  // Tracker definitions in autobrr map IRC announcements strictly by their definition identifier,
  // so definition-based trackers must not use suffixed identifiers (e.g. torrentleech-2).
  function isGenericFeed(identifierOrSchema) {
    if (!identifierOrSchema) return true;
    let id = '';
    let type = '';
    if (typeof identifierOrSchema === 'string') {
      id = identifierOrSchema.toLowerCase();
      const schema = indexerSchemas.find((s) => (s.identifier || '').toLowerCase() === id);
      if (schema) type = String(schema.implementation || schema.type || '').toLowerCase();
    } else if (typeof identifierOrSchema === 'object') {
      id = String(identifierOrSchema.identifier || '').toLowerCase();
      type = String(identifierOrSchema.implementation || identifierOrSchema.type || '').toLowerCase();
    }
    const cleanId = id.replace(/-\d+$/, '');
    const generic = ['torznab', 'newznab', 'rss'];
    if (generic.includes(cleanId) || generic.includes(type)) return true;
    if (indexerSchemas.length > 0 && !indexerSchemas.some((s) => (s.identifier || '').toLowerCase() === cleanId)) {
      return true; // custom/user-defined feed
    }
    return false;
  }

  // Indexer Modal handlers
  function openIndexerModal(indexer = null) {
    editingIndexerId = indexer ? indexer.id : null;
    editingIndexerData = indexer || null;
    const modal = $('indexer-modal');
    if (!modal) return;

    fetchIndexerSchemas();

    const matchedSchema = indexer ? findIndexerSchema(indexer.identifier, indexer) : null;
    if ($('indexer-modal-title')) {
      $('indexer-modal-title').textContent = editingIndexerId ? t('indexers.edit_title') : t('indexers.new_title');
    }
    if ($('indexer-preset')) $('indexer-preset').value = (matchedSchema && matchedSchema.identifier) || (indexer && indexer.identifier) || '';
    if ($('indexer-name')) $('indexer-name').value = (indexer && indexer.name) || '';
    if ($('indexer-identifier')) $('indexer-identifier').value = (matchedSchema && !isGenericFeed(matchedSchema) ? matchedSchema.identifier : (indexer && indexer.identifier)) || '';
    if ($('indexer-url')) $('indexer-url').value = (indexer && (indexer.base_url || (indexer.settings && indexer.settings.base_url))) || '';
    if ($('indexer-apikey')) {
      $('indexer-apikey').value = '';
      $('indexer-apikey').placeholder = editingIndexerId
        ? t('indexers.apikey_edit_placeholder')
        : t('indexers.apikey_placeholder');
    }
    if ($('indexer-enabled')) $('indexer-enabled').checked = indexer ? (indexer.enabled !== false) : true;

    updateIndexerSchemaUI();

    modal.style.display = 'flex';
    setTimeout(() => {
      if ($('indexer-name')) $('indexer-name').focus();
    }, 50);
  }

  function closeIndexerModal() {
    const modal = $('indexer-modal');
    if (modal) modal.style.display = 'none';
    if ($('indexer-apikey')) {
      $('indexer-apikey').placeholder = t('indexers.apikey_placeholder');
    }
    if ($('indexer-dynamic-fields')) {
      $('indexer-dynamic-fields').innerHTML = '';
      $('indexer-dynamic-fields').style.display = 'none';
    }
    if ($('indexer-default-fields')) {
      $('indexer-default-fields').style.display = 'block';
    }
    editingIndexerId = null;
    editingIndexerData = null;
  }

  async function saveIndexerFromModal() {
    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }

    const name = ($('indexer-name') ? $('indexer-name').value : '').trim();
    const rawIdentifier = ($('indexer-identifier') ? $('indexer-identifier').value : '').trim();
    const url = ($('indexer-url') ? $('indexer-url').value : '').trim();
    const apikey = ($('indexer-apikey') ? $('indexer-apikey').value : '').trim();
    const enabled = $('indexer-enabled') ? $('indexer-enabled').checked : true;

    if (!name || !rawIdentifier) {
      toast('Name and Identifier are required', true);
      return;
    }

    const matchedSchema = findIndexerSchema(rawIdentifier, editingIndexerData);
    let identifier = (matchedSchema && !isGenericFeed(matchedSchema))
      ? matchedSchema.identifier
      : rawIdentifier.toLowerCase();

    // Always fetch all SQLite indexers (including any unmapped/wrong-case rows) before checking duplicates
    try {
      const fresh = await fetchAllIndexers();
      if (Array.isArray(fresh)) {
        indexers = fresh;
      }
    } catch (_) {}

    // Check for duplicate identifier (case-insensitive to catch broken wrong-case SQLite rows like "bj-share")
    const existing = indexers.find((idx) => String(idx.identifier || '').toLowerCase() === identifier.toLowerCase());
    if (existing) {
      if (existing.identifier !== identifier && matchedSchema && !isGenericFeed(matchedSchema)) {
        // Broken wrong-case row in SQLite (autobrr UPDATE cannot change identifier column):
        // remove the orphaned row so we can store it cleanly with canonical casing.
        const dynSecretMissing = $('indexer-dynamic-fields') &&
          Array.from($('indexer-dynamic-fields').querySelectorAll('input[data-setting-secret="1"]'))
            .some((el) => !(el.value || '').trim());
        const defSecretMissing = (!dynSecretMissing && (!$('indexer-dynamic-fields') || $('indexer-dynamic-fields').style.display === 'none')) && !apikey;
        if (!editingIndexerId || (!dynSecretMissing && !defSecretMissing)) {
          try {
            await AB.api('DELETE', `/api/indexer/${existing.id}`);
            editingIndexerId = null;
            editingIndexerData = null;
            indexers = indexers.filter((i) => i.id !== existing.id);
          } catch (delErr) {
            toast(`Error replacing broken indexer "${existing.identifier}": ${delErr.message}`, true);
            return;
          }
        }
      } else if (existing.id !== editingIndexerId) {
        const ok = confirm(t('indexers.confirm_update', { name: existing.name || identifier }));
        if (!ok) {
          return;
        }
        editingIndexerId = existing.id;
        editingIndexerData = existing;
        if ($('indexer-modal-title')) {
          $('indexer-modal-title').textContent = t('indexers.edit_title');
        }
        if ($('indexer-apikey')) {
          $('indexer-apikey').placeholder = t('indexers.apikey_edit_placeholder');
        }
      }
    }

    const base = editingIndexerId ? (indexers.find((i) => i.id === editingIndexerId) || {}) : {};
    const schema = findIndexerSchema(identifier, base);
    const settingsMap = normalizeIndexerSettingsMap(base.settings);

    const dynFields = $('indexer-dynamic-fields')
      ? Array.from($('indexer-dynamic-fields').querySelectorAll('[data-setting-key]'))
      : [];

    if (dynFields.length > 0) {
      for (const el of dynFields) {
        const key = el.dataset.settingKey;
        if (el.type === 'checkbox') {
          settingsMap[key] = el.checked ? 'true' : 'false';
        } else {
          const val = (el.value || '').trim();
          if (el.dataset.settingSecret === '1') {
            if (val) settingsMap[key] = val;
          } else if (val) {
            settingsMap[key] = val;
          } else if (editingIndexerId) {
            settingsMap[key] = '';
          } else {
            delete settingsMap[key];
          }
        }
      }
    } else {
      if (url) {
        settingsMap.base_url = url;
      }
      if (apikey) {
        settingsMap.api_key = apikey;
        settingsMap.passkey = apikey;
        settingsMap.apikey = apikey;
      }
    }

    const baseUrl = url || settingsMap.base_url || base.base_url ||
      (schema && Array.isArray(schema.urls) && schema.urls[0]) || '';
    const impl = (schema && schema.implementation) || base.implementation ||
      ((schema && !isGenericFeed(schema)) ? 'irc' : '');

    const payload = {
      name,
      identifier,
      identifier_external: base.identifier_external || name,
      enabled,
      implementation: impl,
      base_url: baseUrl,
      use_proxy: !!base.use_proxy,
      proxy_id: base.proxy_id || 0,
      settings: settingsMap
    };

    try {
      if (editingIndexerId) {
        payload.id = editingIndexerId;
        await AB.api('PUT', `/api/indexer/${editingIndexerId}`, payload);
        toast(t('toast.indexer_updated'));
      } else {
        await AB.api('POST', '/api/indexer', payload);
        toast(t('toast.indexer_created'));
      }
      closeIndexerModal();
      await refreshIRCAndIndexers();
    } catch (err) {
      const isUniqueErr = err && err.message && err.message.includes('UNIQUE constraint failed');
      if (isUniqueErr) {
        // Refresh indexer cache including unmapped SQLite rows
        try {
          const fresh = await fetchAllIndexers();
          if (Array.isArray(fresh)) indexers = fresh;
        } catch (_) {}

        if (isGenericFeed(identifier)) {
          const suggested = getSuggestedIdentifier(identifier, indexers, editingIndexerId);
          if ($('indexer-identifier')) {
            $('indexer-identifier').value = suggested;
            $('indexer-identifier').focus();
          }
          const retry = confirm(t('indexers.confirm_use_suggested', { id: identifier, suggested }));
          if (retry) {
            return saveIndexerFromModal();
          }
          toast(t('indexers.err_unique_identifier', { id: identifier, suggested }), true);
        } else {
          const dup = (indexers || []).find((i) => String(i.identifier || '').toLowerCase() === identifier.toLowerCase());
          if (dup && confirm(t('indexers.confirm_update', { name: dup.name || identifier }))) {
            try {
              await AB.api('DELETE', `/api/indexer/${dup.id}`);
              indexers = indexers.filter((i) => i.id !== dup.id);
              return saveIndexerFromModal();
            } catch (delErr) {
              toast(`Error resolving duplicate indexer: ${delErr.message}`, true);
              return;
            }
          }
          toast(t('indexers.err_tracker_exists', { id: identifier }), true);
        }
      } else {
        toast(`Error saving indexer: ${err.message}`, true);
      }
    }
  }

  async function deleteIndexer(id, name) {
    if (!AB) return;
    if (!confirm(t('indexers.confirm_delete', { name: name || id }))) return;
    try {
      await AB.api('DELETE', `/api/indexer/${id}`);
      toast(t('toast.indexer_deleted'));
      await refreshIRCAndIndexers();
    } catch (err) {
      toast(`Error deleting indexer: ${err.message}`, true);
    }
  }

  async function testIndexer(id) {
    if (!AB) return;
    try {
      toast('Testing indexer API connection...');
      await AB.api('POST', `/api/indexer/${id}/api/test`, { id });
      toast(t('toast.indexer_tested'));
    } catch (err) {
      toast(`Indexer test failed: ${err.message}`, true);
    }
  }

  // IRC Modal handlers
  function openIRCModal(net = null) {
    editingIrcId = net ? net.id : null;
    const modal = $('irc-modal');
    if (!modal) return;

    if ($('irc-modal-title')) {
      $('irc-modal-title').textContent = editingIrcId ? t('irc.edit_title') : t('irc.new_title');
    }
    if ($('irc-name')) $('irc-name').value = (net && net.name) || '';
    if ($('irc-server')) $('irc-server').value = (net && net.server) || '';
    if ($('irc-port')) $('irc-port').value = (net && net.port) || 6697;
    if ($('irc-tls')) $('irc-tls').checked = net ? !!net.tls : true;
    if ($('irc-tls-skip')) $('irc-tls-skip').checked = net ? !!net.tls_skip_verify : false;
    if ($('irc-enabled')) $('irc-enabled').checked = net ? (net.enabled !== false) : true;
    if ($('irc-nick')) $('irc-nick').value = (net && net.nick) || '';

    const authMech = (net && net.auth && net.auth.mechanism) || 'SASL_PLAIN';
    const editPwPlaceholder = editingIrcId ? t('irc.pass_edit_placeholder') : '';
    if ($('irc-auth-mech')) $('irc-auth-mech').value = authMech;
    if ($('irc-auth-user')) $('irc-auth-user').value = (net && net.auth && net.auth.account) || '';
    if ($('irc-auth-pass')) {
      $('irc-auth-pass').value = '';
      $('irc-auth-pass').placeholder = editPwPlaceholder || 'Password';
    }
    if ($('irc-server-pass')) {
      $('irc-server-pass').value = '';
      $('irc-server-pass').placeholder = editPwPlaceholder || 'Server connection password';
    }

    const firstChannel = (net && net.channels && net.channels[0]) || null;
    if ($('irc-channel-name')) $('irc-channel-name').value = (firstChannel && (firstChannel.name || firstChannel)) || '';
    if ($('irc-channel-pass')) {
      $('irc-channel-pass').value = '';
      $('irc-channel-pass').placeholder = editPwPlaceholder || 'Optional';
    }

    modal.style.display = 'flex';
    setTimeout(() => {
      if ($('irc-name')) $('irc-name').focus();
    }, 50);
  }

  function closeIRCModal() {
    const modal = $('irc-modal');
    if (modal) modal.style.display = 'none';
    editingIrcId = null;
  }

  async function saveIRCFromModal() {
    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }

    const name = ($('irc-name') ? $('irc-name').value : '').trim();
    const server = ($('irc-server') ? $('irc-server').value : '').trim();
    const port = parseInt($('irc-port') ? $('irc-port').value : '6697', 10) || 6697;
    const nick = ($('irc-nick') ? $('irc-nick').value : '').trim();
    const tls = $('irc-tls') ? $('irc-tls').checked : true;
    const tlsSkip = $('irc-tls-skip') ? $('irc-tls-skip').checked : false;
    const enabled = $('irc-enabled') ? $('irc-enabled').checked : true;
    const authMech = $('irc-auth-mech') ? $('irc-auth-mech').value : 'NONE';
    const authUser = ($('irc-auth-user') ? $('irc-auth-user').value : '').trim();
    const authPass = ($('irc-auth-pass') ? $('irc-auth-pass').value : '').trim();
    const serverPass = ($('irc-server-pass') ? $('irc-server-pass').value : '').trim();
    const channelName = ($('irc-channel-name') ? $('irc-channel-name').value : '').trim();
    const channelPass = ($('irc-channel-pass') ? $('irc-channel-pass').value : '').trim();

    if (!name || !server) {
      toast('Network name and server are required', true);
      return;
    }

    const base = editingIrcId ? (ircNetworks.find((n) => n.id === editingIrcId) || {}) : {};
    const existingChannels = Array.isArray(base.channels) ? base.channels.map((ch) => (ch && typeof ch === 'object' ? Object.assign({}, ch) : { name: String(ch) })) : [];
    let channels = existingChannels;
    if (channelName) {
      const firstBase = existingChannels[0] || {};
      const updatedFirst = Object.assign({}, firstBase, {
        name: channelName,
        password: channelPass || (editingIrcId ? (firstBase.password || '') : ''),
        enabled: firstBase.enabled !== undefined ? firstBase.enabled : true
      });
      channels = [updatedFirst, ...existingChannels.slice(1)];
    } else if (!editingIrcId) {
      channels = [];
    }

    const baseAuth = (base.auth && typeof base.auth === 'object') ? base.auth : {};
    const payload = Object.assign({}, base, {
      name,
      server,
      port,
      tls,
      tls_skip_verify: tlsSkip,
      nick: nick || base.nick || 'autobrr',
      pass: serverPass || (editingIrcId ? (base.pass || '') : ''),
      enabled,
      auth: Object.assign({}, baseAuth, {
        mechanism: authMech,
        account: authUser || '',
        password: authPass || (editingIrcId ? (baseAuth.password || '') : '')
      }),
      channels
    });

    try {
      if (editingIrcId) {
        payload.id = editingIrcId;
        await AB.api('PUT', `/api/irc/network/${editingIrcId}`, payload);
        toast(t('btn.save'));
      } else {
        await AB.api('POST', '/api/irc', payload);
        toast(t('toast.irc_created'));
      }
      closeIRCModal();
      await refreshIRCAndIndexers();
    } catch (err) {
      toast(`Error saving IRC network: ${err.message}`, true);
    }
  }

  async function deleteIRCNetwork(id, name) {
    if (!AB) return;
    if (!confirm(t('irc.confirm_delete', { name: name || id }))) return;
    try {
      await AB.api('DELETE', `/api/irc/network/${id}`);
      toast(t('toast.irc_deleted'));
      await refreshIRCAndIndexers();
    } catch (err) {
      toast(`Error deleting IRC network: ${err.message}`, true);
    }
  }

  async function restartIRCNetwork(id, name) {
    if (!AB) return;
    if (!confirm(t('irc.confirm_restart', { name: name || id }))) return;
    try {
      toast(t('toast.irc_restarted'));
      await AB.api('POST', `/api/irc/network/${id}/restart`);
      await refreshIRCAndIndexers();
    } catch (err) {
      toast(`Error restarting IRC network: ${err.message}`, true);
    }
  }

  function renderIRC() {
    const tbody = $('irc-rows');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (ircNetworks.length === 0) {
      const msg = (!AB && SOS) ? t('irc.no_access') : t('irc.empty');
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--sos-muted); padding: 20px;">${escapeHtml(msg)}</td></tr>`;
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
        <td style="white-space: nowrap;">
          <button class="sos-btn sos-btn-sm btn-edit-irc" data-id="${net.id}" title="${escapeHtml(t('btn.edit'))}">✏️</button>
          <button class="sos-btn sos-btn-sm btn-restart-irc" data-id="${net.id}" data-name="${escapeHtml(net.name || '')}" title="${escapeHtml(t('irc.restart'))}">↻</button>
          <button class="sos-btn sos-btn-sm sos-btn-danger btn-del-irc" data-id="${net.id}" data-name="${escapeHtml(net.name || '')}" title="${escapeHtml(t('btn.delete'))}">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('.btn-edit-irc').forEach((btn) => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        const net = ircNetworks.find((item) => item.id === id);
        if (net) openIRCModal(net);
      };
    });

    tbody.querySelectorAll('.btn-restart-irc').forEach((btn) => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        restartIRCNetwork(id, btn.dataset.name);
      };
    });

    tbody.querySelectorAll('.btn-del-irc').forEach((btn) => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        deleteIRCNetwork(id, btn.dataset.name);
      };
    });
  }

  function renderIndexers() {
    const tbody = $('indexers-rows');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (indexers.length === 0) {
      const msg = (!AB && SOS) ? t('indexers.no_access') : t('indexers.empty');
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--sos-muted); padding: 20px;">${escapeHtml(msg)}</td></tr>`;
      return;
    }

    for (const idx of indexers) {
      const tr = document.createElement('tr');
      const isEnabled = idx.enabled !== false;
      tr.innerHTML = `
        <td><strong>${escapeHtml(idx.name || idx.identifier || '')}</strong></td>
        <td><code>${escapeHtml(idx.identifier || String(idx.name || '').toLowerCase())}</code></td>
        <td style="color: var(--sos-muted); font-size: 12px;">${escapeHtml(idx.type || 'Torznab / IRC')}</td>
        <td>
          <span class="badge ${isEnabled ? 'ok' : 'err'}">
            ${escapeHtml(isEnabled ? t('status.active') : t('status.inactive'))}
          </span>
        </td>
        <td style="white-space: nowrap;">
          <button class="sos-btn sos-btn-sm btn-edit-indexer" data-id="${idx.id}" title="${escapeHtml(t('btn.edit'))}">✏️</button>
          <button class="sos-btn sos-btn-sm btn-test-indexer" data-id="${idx.id}" title="${escapeHtml(t('indexers.test'))}">⚡</button>
          <button class="sos-btn sos-btn-sm sos-btn-danger btn-del-indexer" data-id="${idx.id}" data-name="${escapeHtml(idx.name || '')}" title="${escapeHtml(t('btn.delete'))}">✕</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('.btn-edit-indexer').forEach((btn) => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        const idx = indexers.find((item) => item.id === id);
        if (idx) openIndexerModal(idx);
      };
    });

    tbody.querySelectorAll('.btn-test-indexer').forEach((btn) => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        testIndexer(id);
      };
    });

    tbody.querySelectorAll('.btn-del-indexer').forEach((btn) => {
      btn.onclick = () => {
        const id = parseInt(btn.dataset.id, 10);
        deleteIndexer(id, btn.dataset.name);
      };
    });
  }

  // Fetch daemon log
  async function refreshLog() {
    const box = $('daemon-log-box');
    if (!box) return;

    if (!AB || !AB.log) {
      box.textContent = (!AB && SOS) ? t('log.no_access') : t('log.offline');
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
      toast(t('conn.no_access'), true);
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
    } catch (err) {
      toast(`Error updating Web UI setting: ${err.message}`, true);
    } finally {
      await refreshStatus();
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

  function scheduleNextPoll() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = setTimeout(refreshAll, 12000);
  }

  // Refresh everything (guarded against overlapping polls)
  async function refreshAll() {
    if (isRefreshing) {
      refreshQueued = true;
      return;
    }
    isRefreshing = true;
    refreshQueued = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    try {
      await refreshStatus();
      await refreshAccounts();
      await refreshReleases();
      await refreshFilters();
      await refreshIRCAndIndexers();
      if ($('tab-settings') && $('tab-settings').classList.contains('active')) {
        await refreshLog();
      }
      updateStatusbar();
    } finally {
      isRefreshing = false;
      if (refreshQueued) {
        refreshQueued = false;
        setTimeout(refreshAll, 50);
      } else {
        scheduleNextPoll();
      }
    }
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

  function cleanHost(raw) {
    return String(raw || '').trim().replace(/^\[|\]$/g, '');
  }

  function isUsableIp(raw) {
    const h = cleanHost(raw);
    if (!h || h === '0.0.0.0' || h === '::' || h === '127.0.0.1' || h === '::1') return false;
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return true;
    return h.includes(':');
  }

  function isUsableHost(raw) {
    const h = cleanHost(raw);
    return !!h && h !== '0.0.0.0' && h !== '::';
  }

  // Determine correct Native Web UI URL reachable from the client browser
  function getWebUIUrl() {
    const port = (serviceStatus && serviceStatus.port) || 7474;

    let originHost = '';
    try {
      const originParam = new URLSearchParams(window.location.search).get('origin');
      if (originParam) {
        originHost = new URL(originParam).hostname;
      }
    } catch (_) { }

    const locHost = window.location.hostname || '';
    const statusIp = (serviceStatus && serviceStatus.ip) || '';

    // 1. Prefer an actual LAN/reachable IP (from ?origin= or location.hostname) so we never fail on "shareos" DNS
    let host = [originHost, locHost, statusIp].map(cleanHost).find(isUsableIp);

    // 2. Otherwise prefer a real domain/host over the generic "shareos" box hostname
    if (!host) {
      host = [originHost, locHost].map(cleanHost).find((h) => isUsableHost(h) && h.toLowerCase() !== 'shareos');
    }

    // 3. Fallback to any usable browser host, or loopback in local dev
    if (!host) {
      host = [originHost, locHost].map(cleanHost).find(isUsableHost) || '127.0.0.1';
    }

    const formattedHost = host.includes(':') ? `[${host}]` : host;
    return `http://${formattedHost}:${port}`;
  }

  // Open the Native autobrr Web UI (port 7474)
  async function openAdvancedWebUI() {
    if (!AB) {
      window.open(getWebUIUrl(), '_blank', 'noopener,noreferrer');
      return;
    }

    if (serviceStatus && !serviceStatus.installed) {
      toast(t('banner.not_installed_desc'), true);
      return;
    }
    if (serviceStatus && !serviceStatus.drive) {
      toast(t('banner.no_drive_desc'), true);
      return;
    }

    // Fast path: service is already running and exposed on 0.0.0.0:7474
    if (serviceStatus && serviceStatus.running && serviceStatus.ui) {
      const url = getWebUIUrl();
      const win = window.open(url, '_blank', 'noopener,noreferrer');
      if (!win) {
        switchTab('tab-settings');
        toast(t('err.popup_blocked'), true);
      }
      return;
    }

    if (!(serviceStatus && serviceStatus.ui)) {
      if (!confirm(t('webui.confirm_expose'))) return;
    }

    // Open blank tab synchronously during user gesture to avoid popup blockers while starting/rebinding
    const win = window.open('about:blank', '_blank');

    try {
      toast('Enabling Web UI on 0.0.0.0:7474...');
      await AB.set({ enabled: true, ui: true });
      await refreshStatus();
    } catch (e) {
      if (win && !win.closed) win.close();
      toast(`Could not open Web UI: ${e.message}`, true);
      return;
    }

    const url = getWebUIUrl();
    if (win && !win.closed) {
      try { win.opener = null; } catch (_) { }
      win.location.href = url;
    } else {
      switchTab('tab-settings');
      toast(t('err.popup_blocked'), true);
      const linkBtn = $('btn-link-webui');
      if (linkBtn) {
        linkBtn.scrollIntoView({ behavior: 'smooth' });
        linkBtn.focus();
      }
    }
  }

  // Open the Transmission web app
  function openTransmission(e) {
    if (e && e.preventDefault) e.preventDefault();
    const size = { width: 1050, height: 720 };
    if (SOS && SOS.openApp) {
      const w = SOS.openApp('transmission', size);
      if (!w) {
        toast(t('err.popup_blocked'), true);
      } else if (typeof w.focus === 'function') {
        w.focus();
      }
      return;
    }
    // Standalone preview outside ShareOS only (inside ShareOS, SOS.openApp is required for ?fs= grant)
    const targetUrl = new URL('../transmission/index.html', window.location.href).href;
    const w = window.open(targetUrl, 'sosapp-transmission', `popup,width=${size.width},height=${size.height}`);
    if (!w) {
      window.open(targetUrl, '_blank');
    }
  }

  // Background Transmission status check
  async function checkTransmissionStatus() {
    const badge = $('trans-daemon-badge');
    if (!badge) return;
    const TOR = SOS && SOS.torrent;
    if (TOR && TOR.rpc) {
      try {
        const res = await TOR.rpc('session-get');
        const session = (res && res.arguments) ? res.arguments : res;
        if (session && typeof session === 'object') {
          const v = session.version ? `v${session.version}` : 'Active';
          badge.textContent = `Online (${v})`;
          badge.className = 'badge ok';
          return;
        }
      } catch (e) {
        badge.textContent = 'Offline';
        badge.className = 'badge warn';
        return;
      }
    }
    if (serviceStatus && serviceStatus.drop) {
      badge.textContent = 'Handover Ready';
      badge.className = 'badge ok';
    } else {
      badge.textContent = 'Offline / Standby';
      badge.className = 'badge warn';
    }
  }

  // Explicit Transmission connection test via RPC
  async function testTransmissionRPC() {
    const badge = $('trans-daemon-badge');
    if (badge) {
      badge.textContent = 'Connecting...';
      badge.className = 'badge warn';
    }
    const TOR = SOS && SOS.torrent;
    if (TOR && TOR.rpc) {
      try {
        toast('Testing Transmission RPC connection...');
        const res = await TOR.rpc('session-get');
        const session = (res && res.arguments) ? res.arguments : res;
        if (session && typeof session === 'object') {
          const ver = session.version ? `v${session.version}` : '';
          const downDir = session['download-dir'] || '';
          toast(`Transmission Connected! ${ver}${downDir ? ` (Download Dir: ${downDir})` : ''}`);
          if (badge) {
            badge.textContent = ver ? `Connected (${ver})` : 'Connected';
            badge.className = 'badge ok';
          }
          return;
        }
      } catch (err) {
        console.warn('RPC test failed:', err);
      }
    }
    if (serviceStatus && serviceStatus.drop) {
      toast(`Handover drop folder active: ${serviceStatus.drop} (user: ${serviceStatus.account || 'root'})`);
      if (badge) {
        badge.textContent = 'Handover Ready';
        badge.className = 'badge ok';
      }
    } else {
      toast('Transmission daemon offline or drop folder unconfigured.', true);
      if (badge) {
        badge.textContent = 'Disconnected';
        badge.className = 'badge err';
      }
    }
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
          { label: t('menu.about'), action: () => alert('autobrr-ui for ShareOS v1.1.0\nIntegrated via ShareOS.autobrr\nPublisher: @SamuelSilvaG') }
        ]
      }
    ]);
  }

  // Safe App Initialization
  function init() {
    initTheme();
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
    if ($('btn-webui-exposed')) $('btn-webui-exposed').onclick = () => toggleWebUI(false);

    // Service & settings buttons
    if ($('btn-start-svc')) $('btn-start-svc').onclick = startService;
    if ($('btn-stop-svc')) $('btn-stop-svc').onclick = stopService;
    if ($('btn-save-account')) $('btn-save-account').onclick = saveHandoverAccount;
    if ($('btn-save-admin-pw')) $('btn-save-admin-pw').onclick = saveAdminPassword;
    if ($('btn-refresh-log')) $('btn-refresh-log').onclick = refreshLog;
    if ($('btn-test-transmission')) $('btn-test-transmission').onclick = testTransmissionRPC;
    if ($('btn-link-webui')) {
      $('btn-link-webui').href = getWebUIUrl();
      $('btn-link-webui').onclick = (e) => {
        if (AB && (!serviceStatus || !serviceStatus.running || !serviceStatus.ui)) {
          e.preventDefault();
          openAdvancedWebUI();
        } else {
          $('btn-link-webui').href = getWebUIUrl();
        }
      };
    }
    if ($('webui-url-text')) {
      $('webui-url-text').textContent = getWebUIUrl();
      $('webui-url-text').style.cursor = 'pointer';
      $('webui-url-text').title = 'Click to copy URL';
      $('webui-url-text').onclick = async () => {
        try {
          await navigator.clipboard.writeText(getWebUIUrl());
          toast('Web UI URL copied to clipboard!');
        } catch (e) {
          toast(getWebUIUrl());
        }
      };
    }

    // Checkboxes
    if ($('cfg-autostart')) {
      $('cfg-autostart').onchange = (e) => toggleAutostart(e.target.checked);
    }
    if ($('cfg-webui-enable')) {
      $('cfg-webui-enable').onchange = async (e) => {
        if (e.target.checked && !confirm(t('webui.confirm_expose'))) {
          e.target.checked = false;
          return;
        }
        await toggleWebUI(e.target.checked);
      };
    }

    // Search filter
    if ($('search-input')) {
      $('search-input').oninput = renderReleases;
    }

    // Modal buttons
    if ($('modal-close-btn')) $('modal-close-btn').onclick = closeFilterModal;
    if ($('modal-cancel-btn')) $('modal-cancel-btn').onclick = closeFilterModal;
    if ($('modal-save-btn')) $('modal-save-btn').onclick = saveFilterFromModal;

    // Indexer panel & modal
    if ($('btn-new-indexer-panel')) $('btn-new-indexer-panel').onclick = () => openIndexerModal();
    if ($('btn-indexer-open-webui')) $('btn-indexer-open-webui').onclick = openAdvancedWebUI;
    if ($('indexer-modal-close-btn')) $('indexer-modal-close-btn').onclick = closeIndexerModal;
    if ($('indexer-modal-cancel-btn')) $('indexer-modal-cancel-btn').onclick = closeIndexerModal;
    if ($('indexer-modal-save-btn')) $('indexer-modal-save-btn').onclick = saveIndexerFromModal;
    if ($('indexer-preset')) {
      $('indexer-preset').onchange = () => {
        const id = $('indexer-preset').value;
        const schema = indexerSchemas.find((s) => s.identifier === id);
        if (schema) {
          const rawIdentifier = schema.identifier || id;
          let targetIdentifier = rawIdentifier;
          let targetName = schema.name || schema.identifier;

          // Only suggest suffixed identifier for generic feeds (Torznab/Newznab/RSS).
          // Tracker definitions must keep their exact identifier to match autobrr definitions.
          if (!editingIndexerId && isGenericFeed(schema) && indexers.some((idx) => String(idx.identifier || '').toLowerCase() === rawIdentifier.toLowerCase())) {
            targetIdentifier = getSuggestedIdentifier(rawIdentifier, indexers, null);
            targetName = `${schema.name || schema.identifier} 2`;
          }

          const autoName = schema.name || schema.identifier;
          const cur = $('indexer-name') ? $('indexer-name').value : '';
          if (!cur || cur === ($('indexer-identifier') ? $('indexer-identifier').value : '') || cur === autoName || cur === `${autoName} 2`) {
            $('indexer-name').value = targetName;
          }
          $('indexer-identifier').value = targetIdentifier;
          if ($('indexer-url') && schema.urls && schema.urls[0] && !$('indexer-url').value) {
            $('indexer-url').value = schema.urls[0];
          }
        }
        updateIndexerSchemaUI();
      };
    }

    // IRC panel & modal
    if ($('btn-new-irc-panel')) $('btn-new-irc-panel').onclick = () => openIRCModal();
    if ($('irc-modal-close-btn')) $('irc-modal-close-btn').onclick = closeIRCModal;
    if ($('irc-modal-cancel-btn')) $('irc-modal-cancel-btn').onclick = closeIRCModal;
    if ($('irc-modal-save-btn')) $('irc-modal-save-btn').onclick = saveIRCFromModal;

    // Initial load (subsequent polls are self-scheduled in refreshAll)
    refreshAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
