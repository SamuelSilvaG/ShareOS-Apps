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
  let accounts = [];
  let editingFilterId = null;
  let pollTimer = null;

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

    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
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

  function renderIRC() {
    const tbody = $('irc-rows');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (ircNetworks.length === 0) {
      const msg = (!AB && SOS) ? t('irc.no_access') : t('irc.empty');
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--sos-muted); padding: 20px;">${escapeHtml(msg)}</td></tr>`;
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
      const msg = (!AB && SOS) ? t('indexers.no_access') : t('indexers.empty');
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--sos-muted); padding: 20px;">${escapeHtml(msg)}</td></tr>`;
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
    await refreshStatus();
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

  // Determine correct Native Web UI URL reachable from the client browser
  function getWebUIUrl() {
    const port = (serviceStatus && serviceStatus.port) || 7474;
    let host = window.location.hostname;
    // If running in local loopback, 0.0.0.0 or unspecified, fallback safely
    if (!host || host === '0.0.0.0') {
      if (serviceStatus && serviceStatus.ip && serviceStatus.ip !== '0.0.0.0') {
        host = serviceStatus.ip;
      } else if (serviceStatus && serviceStatus.host && !['0.0.0.0', '127.0.0.1'].includes(serviceStatus.host)) {
        host = serviceStatus.host;
      } else {
        host = '127.0.0.1';
      }
    }
    return `http://${host}:${port}`;
  }

  // Open the Native autobrr Web UI (port 7474)
  async function openAdvancedWebUI() {
    const url = getWebUIUrl();
    if (!AB) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!serviceStatus || !serviceStatus.running) {
      toast('Starting autobrr service...', false);
      try {
        await AB.start();
        await refreshStatus();
      } catch (e) {
        toast(`Could not start autobrr service: ${e.message}`, true);
        return;
      }
    }

    if (!serviceStatus || !serviceStatus.ui) {
      try {
        toast('Enabling Web UI on 0.0.0.0:7474...');
        await AB.set({ ui: true });
        await refreshStatus();
      } catch (e) {
        console.warn('Could not set ui:true', e);
      }
    }

    const win = window.open(url, '_blank', 'noopener,noreferrer');
    if (!win) {
      switchTab('tab-settings');
      toast(`Please open Web UI: ${url}`, false);
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
      try {
        const w = SOS.openApp('transmission', size);
        if (w) return;
      } catch (err) {
        console.warn('SOS.openApp transmission failed:', err);
      }
    }
    // Fallback: direct web app paths
    const candidates = [
      new URL('/transmission/index.html', window.location.origin).href,
      new URL('../transmission/index.html', window.location.href).href,
      new URL('/transmission/', window.location.origin).href
    ];
    const targetUrl = candidates[0];
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
        if (res && (res.result === 'success' || res.arguments)) {
          const v = res.arguments && res.arguments.version ? `v${res.arguments.version}` : 'Active';
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
        if (res && (res.result === 'success' || res.arguments)) {
          const ver = res.arguments && res.arguments.version ? `v${res.arguments.version}` : '';
          const downDir = res.arguments && res.arguments['download-dir'] ? res.arguments['download-dir'] : '';
          toast(`Transmission Connected! ${ver} (Download Dir: ${downDir})`);
          if (badge) {
            badge.textContent = `Connected ${ver}`;
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
          { label: t('menu.about'), action: () => alert('autobrr for ShareOS v1.0.0\nIntegrated via ShareOS.autobrr\nPublisher: @SamuelSilvaG') }
        ]
      }
    ]);
  }

  // Safe App Initialization
  function init() {
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
    if ($('btn-test-transmission')) $('btn-test-transmission').onclick = testTransmissionRPC;
    if ($('webui-url-text')) {
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
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
