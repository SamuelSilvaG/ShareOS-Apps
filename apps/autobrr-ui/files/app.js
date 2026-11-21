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
  let downloaders = [];
  let transRemoteInfo = null;
  let editingFilterId = null;
  let editingFilterData = null;
  let editingIndexerId = null;
  let editingIrcId = null;
  let editingIndexerData = null;
  let pollTimer = null;
  let isRefreshing = false;
  let refreshQueued = false;
  let transRpcBusy = false;
  let lastGeneratedRemotePassword = '';

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

  async function copyTextToClipboard(text) {
    const val = String(text || '');
    if (!val) return false;
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(val);
        return true;
      }
    } catch (_) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = val;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, val.length);
      const ok = !!(document.execCommand && document.execCommand('copy'));
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
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

  function updateServiceControlButtons(st) {
    const startBtn = $('btn-start-svc');
    const stopBtn = $('btn-stop-svc');
    if (!AB || !st) {
      if (startBtn) startBtn.hidden = true;
      if (stopBtn) stopBtn.hidden = true;
      return;
    }
    if (st.running) {
      if (startBtn) startBtn.hidden = true;
      if (stopBtn) stopBtn.hidden = false;
    } else {
      if (startBtn) startBtn.hidden = !(st.installed && st.drive);
      if (stopBtn) stopBtn.hidden = true;
    }
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

      if ($('daemon-state-badge')) {
        $('daemon-state-badge').textContent = t('status.stopped');
        $('daemon-state-badge').className = 'badge err';
      }
      updateServiceControlButtons(null);
      if ($('btn-webui-exposed')) $('btn-webui-exposed').style.display = 'none';
      if ($('webui-link-container')) $('webui-link-container').style.display = 'none';
      renderLegacyDropNotice();
      if ($('sb-transmission')) $('sb-transmission').textContent = t('sb.transmission', { status: '–' });

      return false;
    }

    try {
      const st = await AB.status();
      serviceStatus = st;
      updateServiceControlButtons(st);

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

      // Update settings controls
      if ($('cfg-autostart')) $('cfg-autostart').checked = !!st.enabled;
      if ($('cfg-webui-enable')) $('cfg-webui-enable').checked = !!st.ui;
      if ($('btn-webui-exposed')) $('btn-webui-exposed').style.display = (st.running && st.ui) ? 'inline-flex' : 'none';
      if ($('daemon-state-badge')) {
        $('daemon-state-badge').textContent = st.running ? (st.ready ? t('status.online') : t('status.starting')) : t('status.stopped');
        $('daemon-state-badge').className = 'badge ' + (st.running ? 'ok' : 'err');
      }

      // Web UI link
      const webuiUrl = getWebUIUrl();
      const linkBtn = $('btn-link-webui');
      const urlText = $('webui-url-text');
      if (linkBtn) linkBtn.href = webuiUrl;
      if (urlText) urlText.textContent = webuiUrl;

      // Check Transmission status and legacy drop folder state
      checkTransmissionStatus();
      renderLegacyDropNotice();

      return st.ready;
    } catch (err) {
      console.warn('Error querying autobrr status:', err);
      updateConnBadge('offline');
      return false;
    }
  }

  function getReleaseIndexerName(r) {
    if (!r || r.indexer == null) return '';
    if (typeof r.indexer === 'object') {
      return r.indexer.name || r.indexer.identifier_external || r.indexer.identifier || '';
    }
    return String(r.indexer);
  }

  function formatBytes(bytes) {
    if (bytes == null || bytes === '') return '';
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return typeof bytes === 'string' ? bytes : '';
    const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
    let val = n;
    let idx = 0;
    while (val >= 1024 && idx < units.length - 1) {
      val /= 1024;
      idx++;
    }
    return idx === 0 ? `${Math.round(val)} B` : `${val.toFixed(2)} ${units[idx]}`;
  }

  function getReleaseActionInfo(item) {
    const actions = Array.isArray(item && item.action_status) ? item.action_status : [];
    const priority = ['PUSH_ERROR', 'PUSH_REJECTED', 'PUSH_APPROVED', 'PENDING'];
    let primary = null;
    for (const p of priority) {
      primary = actions.find((a) => a && String(a.status || '').toUpperCase() === p);
      if (primary) break;
    }
    if (!primary && actions.length > 0) primary = actions[0];

    const statusKey = String(
      (primary && primary.status) || (item && (item.filter_status || item.status)) || 'PENDING'
    ).toUpperCase();
    const actionLabel = primary
      ? (primary.action || primary.type || '–')
      : (typeof (item && item.action) === 'string' ? item.action : '–');
    const actionType = String((primary && primary.type) || '').toUpperCase();
    const actionClient = String((primary && primary.client) || '');
    const retryActionStatusId = (primary && primary.id != null) ? primary.id : null;

    const rejSet = [];
    for (const src of [item && item.rejections, primary && primary.rejections]) {
      if (Array.isArray(src)) {
        for (const r of src) {
          if (r && !rejSet.includes(r)) rejSet.push(r);
        }
      }
    }

    return { statusKey, actionLabel, actionType, actionClient, retryActionStatusId, rejections: rejSet };
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
      const name = (r && (r.name || r.torrent_name)) || '';
      const idx = getReleaseIndexerName(r);
      const filterName = (r && r.filter) || '';
      const info = getReleaseActionInfo(r);
      if (!query) return true;
      return name.toLowerCase().includes(query) ||
        idx.toLowerCase().includes(query) ||
        filterName.toLowerCase().includes(query) ||
        info.statusKey.toLowerCase().includes(query);
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
      const nameStr = item.name || item.torrent_name || 'Unnamed Release';
      const idxStr = getReleaseIndexerName(item) || '–';
      const channelStr = item.implementation || item.protocol || item.channel || '';
      const sizeStr = formatBytes(item.size);
      const info = getReleaseActionInfo(item);
      const statusKey = info.statusKey;
      const statusClass = /^[A-Z_]+$/.test(statusKey) ? statusKey : 'UNKNOWN';
      const statusI18nKey = 'status.' + statusKey;
      const trStatus = t(statusI18nKey);
      const statusLabel = trStatus !== statusI18nKey ? trStatus : statusKey;

      const metaParts = [];
      if (sizeStr) metaParts.push(`📦 ${escapeHtml(sizeStr)}`);
      if (item.filter) metaParts.push(`⚙️ ${escapeHtml(item.filter)}`);

      tr.innerHTML = `
        <td style="color: var(--sos-muted); font-size: 11px;">${escapeHtml(timeStr)}</td>
        <td>
          <span style="font-weight: 500;">${escapeHtml(idxStr)}</span>
          ${channelStr ? `<div style="font-size: 10px; color: var(--sos-muted);">${escapeHtml(channelStr)}</div>` : ''}
        </td>
        <td>
          <div class="release-title">${escapeHtml(nameStr)}</div>
          ${metaParts.length ? `<div class="release-meta">${metaParts.join(' · ')}</div>` : ''}
          ${info.rejections.length ? `<div class="release-rejections">${escapeHtml(info.rejections.join('; '))}</div>` : ''}
        </td>
        <td>
          <span class="status-pill status-${statusClass}">${escapeHtml(statusLabel)}</span>
        </td>
        <td style="font-size: 12px; color: var(--sos-muted);">${escapeHtml(info.actionLabel)}</td>
        <td>
          ${info.retryActionStatusId != null ? `
            <button class="sos-btn sos-btn-sm btn-retry-action" data-release-id="${item.id}" data-action-id="${info.retryActionStatusId}" data-action-type="${escapeHtml(info.actionType)}" data-action-client="${escapeHtml(info.actionClient)}" title="${escapeHtml(t('btn.retry_action'))}">
              ↻ ${escapeHtml(t('btn.retry_action'))}
            </button>
          ` : '<span style="color: var(--sos-muted);">–</span>'}
        </td>
      `;
      tbody.appendChild(tr);
    }

    tbody.querySelectorAll('.btn-retry-action').forEach((btn) => {
      btn.onclick = () => {
        const releaseId = parseInt(btn.dataset.releaseId, 10);
        const actionStatusId = parseInt(btn.dataset.actionId, 10);
        retryReleaseAction(
          releaseId,
          actionStatusId,
          btn.dataset.actionType || '',
          btn.dataset.actionClient || ''
        );
      };
    });
  }

  // Retry an existing release action via autobrr REST API
  async function retryReleaseAction(releaseId, actionStatusId, actionType = '', actionClient = '') {
    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }

    if (String(actionType || '').toUpperCase() === 'TRANSMISSION') {
      const localClients = (downloaders || []).filter((d) =>
        d && String(d.type || '').toUpperCase() === 'TRANSMISSION' && isShareOSTransmissionHost(d.host)
      );
      const clientTarget = String(actionClient || '').trim().toLowerCase();
      if (localClients.length > 0 && (!clientTarget || localClients.some((c) => String(c.name || '').trim().toLowerCase() === clientTarget))) {
        toast(t('toast.retry_local_trans_blocked'), true);
        return;
      }
    }

    try {
      await AB.api('POST', `/api/release/${releaseId}/actions/${actionStatusId}/retry`);
      toast(t('toast.action_retried'));
      await refreshReleases();
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
          <div><strong>${escapeHtml(t('filters.card_trackers'))}</strong> ${idxs ? escapeHtml(idxs) : `<span class="badge warn">${escapeHtml(t('filters.card_none'))}</span>`}</div>
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
      // The list endpoint returns a partial filter (no resolutions, sources, ...);
      // a full PUT with it violates NOT NULL constraints. Use the dedicated toggle route.
      await AB.api('PUT', `/api/filters/${filter.id}/enabled`, { enabled: newState });
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

  function renderFilterIndexerCheckboxes(selectedList, autoSelectAll) {
    const container = $('filter-indexers-list');
    if (!container) return;
    container.innerHTML = '';

    const selected = Array.isArray(selectedList) ? selectedList : [];
    const selectedIds = new Set(
      selected
        .map((x) => (x && typeof x === 'object' && x.id != null ? Number(x.id) : null))
        .filter((n) => n != null && !Number.isNaN(n))
    );
    const selectedIdents = new Set(
      selected
        .map((x) => {
          if (x && typeof x === 'object') return String(x.identifier || x.name || '').toLowerCase();
          return String(x || '').toLowerCase();
        })
        .filter(Boolean)
    );

    const candidates = (indexers || []).filter((idx) =>
      idx._mapped !== false ||
      selectedIds.has(Number(idx.id)) ||
      selectedIdents.has(String(idx.identifier || '').toLowerCase()) ||
      selectedIdents.has(String(idx.name || '').toLowerCase())
    );

    if (candidates.length === 0) {
      const hint = document.createElement('span');
      hint.className = 'form-hint';
      hint.textContent = t('filters.no_indexers_warning');
      container.appendChild(hint);
      return;
    }

    const useDefaultAll = autoSelectAll && selected.length === 0;
    for (const idx of candidates) {
      const chip = document.createElement('label');
      chip.className = 'checkbox-chip';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = String(idx.id);
      cb.dataset.idxName = idx.name || idx.identifier || '';
      cb.dataset.idxIdent = idx.identifier || idx.name || '';
      cb.checked = useDefaultAll
        ? (idx.enabled !== false && idx._mapped !== false)
        : (selectedIds.has(Number(idx.id)) ||
          selectedIdents.has(String(idx.identifier || '').toLowerCase()) ||
          selectedIdents.has(String(idx.name || '').toLowerCase()));
      const span = document.createElement('span');
      span.textContent = idx._mapped === false
        ? `${idx.name || idx.identifier} (${t('indexers.status_unmapped')})`
        : (idx.name || idx.identifier || String(idx.id));
      chip.appendChild(cb);
      chip.appendChild(span);
      container.appendChild(chip);
    }
  }

  function parseDownloaderHostUrl(rawHost, tls) {
    let raw = String(rawHost || '').trim();
    if (!raw) return null;
    if (!/^https?:\/\//i.test(raw)) {
      if ((raw.match(/:/g) || []).length >= 2 && !raw.startsWith('[')) {
        raw = `[${raw}]`;
      }
      raw = `${tls ? 'https' : 'http'}://${raw}`;
    }
    try {
      return new URL(raw);
    } catch (_) {
      return null;
    }
  }

  function formatDownloaderEndpoint(d) {
    if (!d || typeof d !== 'object') return '–';
    const u = parseDownloaderHostUrl(d.host || '127.0.0.1', !!d.tls);
    if (u) {
      if (d.tls && u.protocol === 'http:') u.protocol = 'https:';
      if (!u.port && d.port > 0 && d.port !== 80 && d.port !== 443) {
        u.port = String(d.port);
      }
      if (!u.pathname || u.pathname === '/') {
        u.pathname = '/transmission/rpc';
      }
      return u.toString();
    }
    const scheme = d.tls ? 'https' : 'http';
    const hostStr = String(d.host || '127.0.0.1').replace(/^https?:\/\//i, '');
    return `${scheme}://${hostStr}${d.port ? `:${d.port}` : ''}`;
  }

  function getKnownShareOSHosts() {
    let originHost = '';
    try {
      const originParam = new URLSearchParams(window.location.search).get('origin');
      if (originParam) originHost = new URL(originParam).hostname;
    } catch (_) {}
    const rawHosts = [
      transRemoteInfo && transRemoteInfo.host,
      serviceStatus && serviceStatus.ip,
      serviceStatus && serviceStatus.host,
      originHost,
      window.location && window.location.hostname
    ];
    return new Set(
      rawHosts
        .map((h) => cleanHost(h).toLowerCase())
        .filter((h) => h && h !== '0.0.0.0' && h !== '::')
    );
  }

  function isShareOSTransmissionHost(hostStr) {
    const u = parseDownloaderHostUrl(hostStr, false);
    const hostname = cleanHost(u ? u.hostname : hostStr).toLowerCase();
    if (!hostname) return false;
    if (hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1') return true;
    const path = u ? (u.pathname || '').replace(/\/+$/, '') : '';
    const pathOk = !path || path === '/' || path.includes('/transmission/rpc');
    return pathOk && getKnownShareOSHosts().has(hostname);
  }

  function findShareOSTransmissionClient() {
    const transClients = (downloaders || []).filter((d) => d && String(d.type || '').toUpperCase() === 'TRANSMISSION');
    const isLoopback = (d) => {
      const u = parseDownloaderHostUrl(d && d.host, d && d.tls);
      const h = cleanHost(u ? u.hostname : (d && d.host)).toLowerCase();
      return h === '127.0.0.1' || h === 'localhost' || h === '::1';
    };
    return transClients.find(isLoopback) ||
      transClients.find((d) => isShareOSTransmissionHost(d && d.host)) ||
      null;
  }

  function populateFilterActionModes(currentActions, isNew) {
    const sel = $('filter-action-mode');
    if (!sel) return;
    sel.innerHTML = '';

    const transClients = (downloaders || []).filter((d) =>
      d && String(d.type || '').toUpperCase() === 'TRANSMISSION' && d.enabled !== false && d.id != null
    );
    if (transClients.length === 0) {
      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = t('filters.no_trans_client');
      sel.appendChild(emptyOpt);
      sel.value = '';
      return;
    }

    for (const c of transClients) {
      const opt = document.createElement('option');
      opt.value = `client:${c.id}`;
      opt.textContent = t('filters.action_trans_rpc', { name: c.name || `ID ${c.id}` });
      sel.appendChild(opt);
    }

    const localPreferred = findShareOSTransmissionClient();
    const preferred = (localPreferred && localPreferred.enabled !== false && localPreferred.id != null)
      ? localPreferred
      : transClients[0];

    if (!isNew) {
      const actionsArr = Array.isArray(currentActions) ? currentActions : [];
      const transAct = actionsArr.find((a) => a && String(a.type || '').toUpperCase() === 'TRANSMISSION' && a.client_id);
      if (transAct && transClients.some((c) => Number(c.id) === Number(transAct.client_id))) {
        sel.value = `client:${transAct.client_id}`;
        return;
      }
    }

    sel.value = `client:${preferred.id}`;
  }

  // Filter modal logic
  async function openFilterModal(idStr = null) {
    editingFilterId = idStr;
    editingFilterData = null;
    const modal = $('filter-modal');
    if (!modal) return;

    if ((!downloaders || downloaders.length === 0) && AB && serviceStatus && serviceStatus.ready) {
      await refreshDownloaders();
    }

    if (idStr != null) {
      let f = filters.find((x) => String(x.id) === String(idStr)) || null;
      if (AB && serviceStatus && serviceStatus.ready) {
        try {
          const full = await AB.api('GET', `/api/filters/${idStr}`);
          if (full && typeof full === 'object') f = full;
        } catch (_) {}
      }
      editingFilterData = f;
      if (f) {
        $('modal-title').textContent = t('filters.edit_title');
        $('filter-name').value = f.name || '';
        renderFilterIndexerCheckboxes(f.indexers, false);
        populateFilterActionModes(f.actions, false);
        $('filter-match').value = f.match_releases || '';
        $('filter-except').value = f.except_releases || '';
        $('filter-min-size').value = parseInt(f.min_size, 10) || '';
        $('filter-max-size').value = parseInt(f.max_size, 10) || '';
        if ($('filter-resolutions')) $('filter-resolutions').value = Array.isArray(f.resolutions) ? f.resolutions.join(', ') : '';
        if ($('filter-sources')) $('filter-sources').value = Array.isArray(f.sources) ? f.sources.join(', ') : '';
        if ($('filter-codecs')) $('filter-codecs').value = Array.isArray(f.codecs) ? f.codecs.join(', ') : '';
        $('filter-freeleech').checked = !!f.freeleech;
        $('filter-enabled').checked = f.enabled !== false;
        const transAct = (Array.isArray(f.actions) ? f.actions : []).find((a) => a && String(a.type || '').toUpperCase() === 'TRANSMISSION');
        if ($('filter-save-path')) $('filter-save-path').value = (transAct && transAct.save_path) || '';
        if ($('filter-add-paused')) $('filter-add-paused').checked = !!(transAct && transAct.paused);
      }
    } else {
      $('modal-title').textContent = t('filters.new_title');
      $('filter-name').value = '';
      renderFilterIndexerCheckboxes([], true);
      populateFilterActionModes([], true);
      $('filter-match').value = '';
      $('filter-except').value = '';
      $('filter-min-size').value = '';
      $('filter-max-size').value = '';
      if ($('filter-resolutions')) $('filter-resolutions').value = '';
      if ($('filter-sources')) $('filter-sources').value = '';
      if ($('filter-codecs')) $('filter-codecs').value = '';
      $('filter-freeleech').checked = false;
      $('filter-enabled').checked = true;
      if ($('filter-save-path')) $('filter-save-path').value = '';
      if ($('filter-add-paused')) $('filter-add-paused').checked = false;
    }

    modal.style.display = 'flex';
  }

  function closeFilterModal() {
    const modal = $('filter-modal');
    if (modal) modal.style.display = 'none';
    editingFilterId = null;
    editingFilterData = null;
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
      ? (editingFilterData || filters.find((x) => String(x.id) === String(editingFilterId)) || {})
      : {};

    const checkedBoxes = $('filter-indexers-list')
      ? Array.from($('filter-indexers-list').querySelectorAll('input[type="checkbox"]:checked'))
      : [];
    const indexersPayload = checkedBoxes
      .map((cb) => ({
        id: parseInt(cb.value, 10),
        name: cb.dataset.idxName || '',
        identifier: cb.dataset.idxIdent || ''
      }))
      .filter((x) => !Number.isNaN(x.id));

    if (indexersPayload.length === 0) {
      toast(t('filters.err_no_indexer'), true);
      return;
    }

    const deliveryMode = $('filter-action-mode') ? $('filter-action-mode').value : '';
    const existingActions = Array.isArray(baseFilter.actions) ? baseFilter.actions : [];
    const nonDeliveryActions = existingActions.filter((act) => {
      const tp = String((act && act.type) || '').toUpperCase();
      return tp !== 'WATCH_FOLDER' && tp !== 'WATCH_DIR' && tp !== 'TRANSMISSION';
    });

    let deliveryAction = null;
    if (deliveryMode.startsWith('client:')) {
      const clientId = parseInt(deliveryMode.slice(7), 10);
      const client = (downloaders || []).find((d) => Number(d.id) === clientId) || null;
      const prevTrans = existingActions.find((a) =>
        a && String(a.type || '').toUpperCase() === 'TRANSMISSION' && Number(a.client_id) === clientId
      );
      const savePath = $('filter-save-path') ? ($('filter-save-path').value || '').trim() : ((prevTrans && prevTrans.save_path) || '');
      if (savePath && !savePath.startsWith('/')) {
        toast(t('filters.err_save_path'), true);
        return;
      }
      deliveryAction = Object.assign({}, prevTrans || {}, {
        name: (prevTrans && prevTrans.name) || (client && client.name) || 'ShareOS Transmission',
        type: 'TRANSMISSION',
        enabled: true,
        client_id: clientId,
        save_path: savePath,
        paused: $('filter-add-paused') ? $('filter-add-paused').checked : !!(prevTrans && prevTrans.paused)
      });
    } else if (nonDeliveryActions.length === 0) {
      toast(t('filters.err_no_trans_client'), true);
      return;
    }

    const actionsPayload = deliveryAction
      ? [deliveryAction, ...nonDeliveryActions]
      : nonDeliveryActions;

    const minS = parseInt($('filter-min-size').value, 10) || 0;
    const maxS = parseInt($('filter-max-size').value, 10) || 0;

    const payload = Object.assign({}, baseFilter, {
      name,
      enabled: $('filter-enabled').checked,
      announce_types: (Array.isArray(baseFilter.announce_types) && baseFilter.announce_types.length > 0) ? baseFilter.announce_types : ['NEW'],
      indexers: indexersPayload,
      actions: actionsPayload,
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

    try {
      if (editingFilterId) {
        payload.id = parseInt(editingFilterId, 10) || editingFilterId;
        await AB.api('PUT', `/api/filters/${editingFilterId}`, payload);
        toast(t('btn.save'));
      } else {
        // autobrr's POST /api/filters does not persist indexer links or actions;
        // follow immediately with PUT /api/filters/{id} so FilterService.Update stores both.
        const created = await AB.api('POST', '/api/filters', payload);
        if (created && created.id) {
          payload.id = created.id;
          await AB.api('PUT', `/api/filters/${created.id}`, payload);
        }
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
        _mapped: true,
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
        _mapped: matchKey ? prev._mapped === true : false,
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
    sel.innerHTML = `<option value="">${escapeHtml(t('indexers.select_preset'))}</option>`;
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

  function isFeedImplementation(impl) {
    const tImpl = String(impl || '').toLowerCase();
    return tImpl === 'torznab' || tImpl === 'newznab' || tImpl === 'rss';
  }

  function slugifyFeedIdentifier(impl, name) {
    const cleanImpl = String(impl || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
    const cleanName = String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    if (!cleanName) return cleanImpl;
    return cleanImpl ? `${cleanImpl}-${cleanName}` : cleanName;
  }

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
    if (isFeedImplementation(type) || isFeedImplementation(cleanId)) return true;
    if (indexerSchemas.length > 0 && !indexerSchemas.some((s) => (s.identifier || '').toLowerCase() === cleanId)) {
      return true;
    }
    return false;
  }

  function buildIndexerIRCAuth(definitionAuth, formAuth) {
    const mechanism = (definitionAuth && definitionAuth.mechanism) || 'SASL_PLAIN';
    const account = (formAuth && formAuth.account) || '';
    const password = (formAuth && formAuth.password) || '';
    if (mechanism === 'NICKSERV' && password !== '') {
      const out = { mechanism, password };
      if (account !== '') out.account = account;
      return out;
    }
    if (mechanism === 'SASL_PLAIN' && account !== '' && password !== '') {
      return { mechanism, account, password };
    }
    return { mechanism: 'NONE' };
  }

  function appendSchemaSettingInput(container, s, curVal, isEdit, idPrefix, dataAttrName) {
    const wrap = document.createElement('div');
    wrap.className = 'form-group';
    const type = String(s.type || 'text').toLowerCase();
    const inputId = `${idPrefix}-${String(s.name).replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const labelText = s.label || s.name;

    if (type === 'checkbox' || type === 'bool') {
      const lbl = document.createElement('label');
      lbl.className = 'form-check-row';
      const inp = document.createElement('input');
      inp.type = 'checkbox';
      inp.id = inputId;
      inp.dataset[dataAttrName] = s.name;
      inp.dataset.label = labelText;
      inp.checked = curVal === true || curVal === 'true' || curVal === '1' || curVal === 1;
      const span = document.createElement('span');
      span.textContent = labelText;
      lbl.appendChild(inp);
      lbl.appendChild(span);
      wrap.appendChild(lbl);
    } else {
      const lbl = document.createElement('label');
      lbl.htmlFor = inputId;
      lbl.textContent = labelText + (s.required ? ' *' : '');
      wrap.appendChild(lbl);

      if (Array.isArray(s.options) && s.options.length > 0) {
        const sel = document.createElement('select');
        sel.id = inputId;
        sel.className = 'sos-input';
        sel.dataset[dataAttrName] = s.name;
        sel.dataset.label = labelText;
        sel.dataset.required = s.required ? '1' : '0';
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
        if (curVal !== undefined) sel.value = String(curVal);
        wrap.appendChild(sel);
      } else {
        const inp = document.createElement('input');
        inp.id = inputId;
        inp.className = 'sos-input';
        inp.dataset[dataAttrName] = s.name;
        inp.dataset.label = labelText;
        inp.dataset.required = s.required ? '1' : '0';
        inp.dataset.defaultVal = s.default != null ? String(s.default) : '';
        if (isSecretSetting(s) && s.name !== 'invite_command') {
          inp.type = 'password';
          inp.dataset.settingSecret = '1';
          inp.value = s.default ? String(s.default) : '';
          inp.placeholder = isEdit
            ? t('indexers.apikey_edit_placeholder')
            : (s.placeholder || s.label || t('indexers.apikey_placeholder'));
        } else {
          inp.type = type === 'number' ? 'number' : 'text';
          inp.value = curVal != null ? String(curVal) : '';
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

    container.appendChild(wrap);
  }

  function renderIndexerSchemaFields(schema, existingSettings, isEdit) {
    const dyn = $('indexer-dynamic-fields');
    const ircBox = $('indexer-irc-fields');
    const feedBox = $('indexer-feed-fields');
    const def = $('indexer-default-fields');
    if (!dyn || !def) return false;

    const editable = (schema && Array.isArray(schema.settings))
      ? schema.settings.filter((s) => s && s.name && String(s.type || '').toLowerCase() !== 'info')
      : [];

    dyn.innerHTML = '';
    if (editable.length > 0) {
      def.style.display = 'none';
      dyn.style.display = 'block';
      const settingsObj = (existingSettings && typeof existingSettings === 'object') ? existingSettings : {};
      for (const s of editable) {
        const fallbackUrl = (s.name === 'base_url' && schema && schema.urls && schema.urls[0]) ? schema.urls[0] : '';
        const val = isSecretSetting(s)
          ? (isEdit ? '' : (s.default ?? ''))
          : (settingsObj[s.name] !== undefined ? settingsObj[s.name] : (s.value ?? s.default ?? fallbackUrl));
        appendSchemaSettingInput(dyn, s, val, isEdit, 'idx-dyn', 'settingKey');
      }
    } else {
      dyn.style.display = 'none';
      def.style.display = (isEdit && !schema) ? 'block' : 'none';
    }

    if (ircBox) {
      ircBox.innerHTML = '';
      if (!isEdit && schema && String(schema.implementation || '').toLowerCase() === 'irc' && schema.irc) {
        ircBox.className = 'modal-subsection';
        ircBox.style.display = 'block';
        const titleEl = document.createElement('div');
        titleEl.className = 'modal-subsection-title';
        titleEl.textContent = t('indexers.irc_section');
        ircBox.appendChild(titleEl);

        const chNames = Array.isArray(schema.irc.channels) ? schema.irc.channels.map((c) => c.name).filter(Boolean).join(', ') : '';
        const metaHint = document.createElement('div');
        metaHint.className = 'form-hint';
        metaHint.style.marginBottom = '10px';
        metaHint.textContent = [schema.irc.network, schema.irc.server ? `${schema.irc.server}:${schema.irc.port || 6697}` : '', chNames].filter(Boolean).join(' · ');
        ircBox.appendChild(metaHint);

        const ircSettings = Array.isArray(schema.irc.settings) ? schema.irc.settings : [];
        for (const s of ircSettings) {
          if (!s || !s.name) continue;
          appendSchemaSettingInput(ircBox, s, s.default ?? '', false, 'idx-irc', 'ircKey');
        }

        const enableWrap = document.createElement('div');
        enableWrap.className = 'form-group';
        const enableLbl = document.createElement('label');
        enableLbl.className = 'form-check-row';
        const enableCb = document.createElement('input');
        enableCb.type = 'checkbox';
        enableCb.id = 'indexer-irc-enable';
        enableCb.checked = true;
        const enableSpan = document.createElement('span');
        enableSpan.textContent = t('indexers.irc_enable');
        enableLbl.appendChild(enableCb);
        enableLbl.appendChild(enableSpan);
        enableWrap.appendChild(enableLbl);
        ircBox.appendChild(enableWrap);
      } else {
        ircBox.style.display = 'none';
      }
    }

    if (feedBox) {
      feedBox.innerHTML = '';
      const impl = schema ? String(schema.implementation || '').toLowerCase() : '';
      if (!isEdit && schema && isFeedImplementation(impl)) {
        feedBox.className = 'modal-subsection';
        feedBox.style.display = 'block';
        const titleEl = document.createElement('div');
        titleEl.className = 'modal-subsection-title';
        titleEl.textContent = t('indexers.feed_section');
        feedBox.appendChild(titleEl);

        appendSchemaSettingInput(feedBox, {
          name: 'url',
          type: 'text',
          required: true,
          label: t('indexers.feed_url'),
          placeholder: impl === 'rss' ? 'https://.../rss' : 'https://.../api'
        }, (schema.urls && schema.urls[0]) || '', false, 'idx-feed', 'feedKey');

        if (impl === 'torznab' || impl === 'newznab') {
          appendSchemaSettingInput(feedBox, {
            name: 'api_key',
            type: 'secret',
            required: false,
            label: t('indexers.feed_apikey'),
            placeholder: t('indexers.apikey_placeholder')
          }, '', false, 'idx-feed', 'feedKey');
        }

        const enWrap = document.createElement('div');
        enWrap.className = 'form-group';
        const enLbl = document.createElement('label');
        enLbl.className = 'form-check-row';
        const enCb = document.createElement('input');
        enCb.type = 'checkbox';
        enCb.id = 'indexer-feed-enable';
        enCb.checked = true;
        const enSpan = document.createElement('span');
        enSpan.textContent = t('indexers.feed_enable');
        enLbl.appendChild(enCb);
        enLbl.appendChild(enSpan);
        enWrap.appendChild(enLbl);
        feedBox.appendChild(enWrap);
      } else {
        feedBox.style.display = 'none';
      }
    }

    return editable.length > 0;
  }

  function updateIndexerSchemaUI() {
    const ident = $('indexer-identifier') ? $('indexer-identifier').value : '';
    const schema = findIndexerSchema(ident, editingIndexerData);
    const settings = editingIndexerData ? editingIndexerData.settings : {};
    renderIndexerSchemaFields(schema, settings, !!editingIndexerId);
  }

  // Indexer Modal handlers
  async function openIndexerModal(indexer = null) {
    editingIndexerId = indexer ? indexer.id : null;
    editingIndexerData = indexer || null;
    const modal = $('indexer-modal');
    if (!modal) return;

    await fetchIndexerSchemas();

    const matchedSchema = indexer ? findIndexerSchema(indexer.identifier, indexer) : null;
    if ($('indexer-modal-title')) {
      $('indexer-modal-title').textContent = editingIndexerId ? t('indexers.edit_title') : t('indexers.new_title');
    }
    if ($('indexer-preset')) {
      $('indexer-preset').disabled = !!editingIndexerId;
      $('indexer-preset').value = (matchedSchema && matchedSchema.identifier) || (indexer && indexer.identifier) || '';
    }
    if ($('indexer-name')) $('indexer-name').value = (indexer && indexer.name) || '';
    if ($('indexer-identifier')) {
      $('indexer-identifier').value = (matchedSchema && !isGenericFeed(matchedSchema)
        ? matchedSchema.identifier
        : (indexer && indexer.identifier)) || '';
    }
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
    if ($('indexer-preset')) $('indexer-preset').disabled = false;
    if ($('indexer-apikey')) {
      $('indexer-apikey').placeholder = t('indexers.apikey_placeholder');
    }
    if ($('indexer-dynamic-fields')) {
      $('indexer-dynamic-fields').innerHTML = '';
      $('indexer-dynamic-fields').style.display = 'none';
    }
    if ($('indexer-irc-fields')) {
      $('indexer-irc-fields').innerHTML = '';
      $('indexer-irc-fields').style.display = 'none';
    }
    if ($('indexer-feed-fields')) {
      $('indexer-feed-fields').innerHTML = '';
      $('indexer-feed-fields').style.display = 'none';
    }
    if ($('indexer-default-fields')) {
      $('indexer-default-fields').style.display = 'none';
    }
    editingIndexerId = null;
    editingIndexerData = null;
  }

  function buildIndexerBackupPayload(src, schema) {
    if (!src || typeof src !== 'object') return null;
    const settings = normalizeIndexerSettingsMap(src.settings);
    const baseUrl = src.base_url || settings.base_url ||
      (schema && Array.isArray(schema.urls) && schema.urls[0]) || '';
    const impl = src.implementation || (schema && schema.implementation) ||
      ((schema && !isGenericFeed(schema)) ? 'irc' : '');
    return {
      name: src.name || src.identifier || '',
      identifier: src.identifier || '',
      identifier_external: src.identifier_external || src.name || src.identifier || '',
      enabled: src.enabled !== false,
      implementation: impl,
      base_url: baseUrl,
      use_proxy: !!src.use_proxy,
      proxy_id: src.proxy_id || 0,
      settings
    };
  }

  async function restoreIndexerBackup(backupPayload, targetId, oldLabel, retryErr) {
    const retryMsg = (retryErr && retryErr.message) ? retryErr.message : String(retryErr || '');
    try {
      await AB.api('POST', '/api/indexer', backupPayload);
      await refreshIRCAndIndexers();
      toast(t('toast.indexer_heal_restored', {
        id: targetId,
        old: oldLabel || backupPayload.identifier,
        error: retryMsg
      }), true);
    } catch (restoreErr) {
      const restoreMsg = (restoreErr && restoreErr.message) ? restoreErr.message : String(restoreErr || '');
      await refreshIRCAndIndexers();
      toast(t('toast.indexer_heal_restore_failed', {
        id: targetId,
        old: oldLabel || backupPayload.identifier,
        error: retryMsg,
        restoreError: restoreMsg
      }), true);
    }
  }

  function validateSchemaFieldsContainer(containerSelector, allowExistingSecrets) {
    const container = document.getElementById(containerSelector);
    if (!container || container.style.display === 'none') return true;
    const inputs = Array.from(container.querySelectorAll('input, select'));
    for (const el of inputs) {
      if (el.type === 'checkbox') continue;
      if (el.dataset.required !== '1') continue;
      const val = (el.value || '').trim();
      const defVal = (el.dataset.defaultVal || '').trim();
      const isSecretEditKeep = allowExistingSecrets && el.dataset.settingSecret === '1';
      if ((!val && !isSecretEditKeep) || (defVal && val === defVal)) {
        toast(t('indexers.err_required_field', { field: el.dataset.label || el.id }), true);
        if (el.focus) el.focus();
        return false;
      }
    }
    return true;
  }

  async function createAssociatedNetworkOrFeed(schema, impl, name, createdIdx) {
    if (!schema) return;
    if (String(impl || '').toLowerCase() === 'irc' && schema.irc && $('indexer-irc-fields') && $('indexer-irc-fields').style.display !== 'none') {
      const ircMap = {};
      for (const el of Array.from($('indexer-irc-fields').querySelectorAll('[data-irc-key]'))) {
        ircMap[el.dataset.ircKey] = el.type === 'checkbox' ? (el.checked ? 'true' : 'false') : (el.value || '').trim();
      }
      const channels = Array.isArray(schema.irc.channels)
        ? schema.irc.channels.map((ch) => ({
            id: 0,
            enabled: true,
            name: ch.name,
            password: ircMap['channels.password'] || '',
            detached: false,
            monitoring: false
          }))
        : [];
      const ircPayload = {
        name: schema.irc.network || schema.name || name,
        pass: ircMap.pass || '',
        enabled: $('indexer-irc-enable') ? $('indexer-irc-enable').checked : true,
        connected: false,
        server: schema.irc.server || '',
        port: schema.irc.port || 6697,
        tls: schema.irc.tls !== false,
        tls_skip_verify: false,
        nick: ircMap.nick || 'autobrr',
        auth: buildIndexerIRCAuth(schema.irc.auth, {
          account: ircMap['auth.account'] || '',
          password: ircMap['auth.password'] || ''
        }),
        invite_command: ircMap.invite_command || '',
        channels
      };
      try {
        await AB.api('POST', '/api/irc', ircPayload);
      } catch (ircErr) {
        toast(t('toast.indexer_irc_failed', { error: (ircErr && ircErr.message) ? ircErr.message : String(ircErr || '') }), true);
      }
    } else if (isFeedImplementation(impl) && $('indexer-feed-fields') && $('indexer-feed-fields').style.display !== 'none') {
      const feedMap = {};
      for (const el of Array.from($('indexer-feed-fields').querySelectorAll('[data-feed-key]'))) {
        feedMap[el.dataset.feedKey] = (el.value || '').trim();
      }
      if (feedMap.url) {
        const feedPayload = {
          name,
          enabled: $('indexer-feed-enable') ? $('indexer-feed-enable').checked : true,
          type: String(impl).toUpperCase(),
          url: feedMap.url,
          api_key: feedMap.api_key || '',
          interval: 30,
          timeout: 60,
          indexer_id: (createdIdx && createdIdx.id) ? createdIdx.id : 0,
          settings: { download_type: 'TORRENT' }
        };
        try {
          await AB.api('POST', '/api/feeds', feedPayload);
        } catch (feedErr) {
          toast(t('toast.indexer_feed_failed', { error: (feedErr && feedErr.message) ? feedErr.message : String(feedErr || '') }), true);
        }
      }
    }
  }

  async function saveIndexerFromModal(retried = false) {
    const isRetry = retried === true;
    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }

    const name = ($('indexer-name') ? $('indexer-name').value : '').trim();
    const rawIdentifier = ($('indexer-identifier') ? $('indexer-identifier').value : '').trim();
    const url = ($('indexer-url') ? $('indexer-url').value : '').trim();
    const apikey = ($('indexer-apikey') ? $('indexer-apikey').value : '').trim();
    const enabled = $('indexer-enabled') ? $('indexer-enabled').checked : true;

    const matchedSchema = findIndexerSchema(rawIdentifier, editingIndexerData);
    if (!editingIndexerId && !matchedSchema) {
      toast(t('indexers.err_select_preset'), true);
      if ($('indexer-preset')) $('indexer-preset').focus();
      return;
    }

    if (!name || !rawIdentifier) {
      toast(t('indexers.err_required'), true);
      return;
    }

    const schemaImpl = (matchedSchema && matchedSchema.implementation) || (editingIndexerData && editingIndexerData.implementation) || '';
    const isFeed = isFeedImplementation(schemaImpl);
    let identifier;
    if (editingIndexerId) {
      identifier = (matchedSchema && !isFeed) ? matchedSchema.identifier : rawIdentifier;
    } else if (isFeed) {
      identifier = slugifyFeedIdentifier(schemaImpl, name) || matchedSchema.identifier;
    } else {
      identifier = matchedSchema.identifier;
    }

    // Always fetch all SQLite indexers (including any unmapped/wrong-case rows) before checking duplicates
    try {
      const fresh = await fetchAllIndexers();
      if (Array.isArray(fresh)) {
        indexers = fresh;
      }
    } catch (_) {}

    let healFromId = null;
    let healOldIdentifier = null;
    let healBackupPayload = null;

    // Check for duplicate identifier (case-insensitive to catch broken wrong-case SQLite rows like "bj-share")
    const existing = indexers.find((idx) => String(idx.identifier || '').toLowerCase() === identifier.toLowerCase());
    if (existing) {
      if (existing.identifier !== identifier && matchedSchema && !isFeed) {
        // Casing mismatch (e.g. "bj-share" in DB vs canonical "BJ-Share" in schema):
        // Confirm before replacing, carry old settings over, and delete old row only after new row exists.
        if (!confirm(t('indexers.confirm_heal', { old: existing.identifier, id: identifier }))) {
          return;
        }
        editingIndexerData = existing;
        healFromId = existing.id;
        healOldIdentifier = existing.identifier;
        healBackupPayload = buildIndexerBackupPayload(existing, matchedSchema);
        editingIndexerId = null;
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

    if (!validateSchemaFieldsContainer('indexer-dynamic-fields', !!editingIndexerId)) return;
    if (!validateSchemaFieldsContainer('indexer-irc-fields', false)) return;
    if (!validateSchemaFieldsContainer('indexer-feed-fields', false)) return;

    const base = editingIndexerId
      ? (indexers.find((i) => i.id === editingIndexerId) || editingIndexerData || {})
      : (editingIndexerData || {});
    const schema = matchedSchema || findIndexerSchema(identifier, base);
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
      ((schema && !isFeed) ? 'irc' : '');

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
        let createdIdx = null;
        try {
          createdIdx = await AB.api('POST', '/api/indexer', payload);
          let deleteOldFailed = false;
          if (healFromId) {
            try {
              await AB.api('DELETE', `/api/indexer/${healFromId}`);
            } catch (delErr) {
              deleteOldFailed = true;
              const delMsg = (delErr && delErr.message) ? delErr.message : String(delErr || '');
              toast(t('toast.indexer_heal_delete_failed', {
                old: healOldIdentifier || String(healFromId),
                error: delMsg
              }), true);
            }
          }
          await createAssociatedNetworkOrFeed(schema, impl, name, createdIdx);
          if (!deleteOldFailed) {
            toast(t('toast.indexer_created'));
          }
        } catch (postErr) {
          const isUniqueErr = postErr && postErr.message && postErr.message.includes('UNIQUE constraint failed');
          if (healFromId && isUniqueErr) {
            // Case-insensitive UNIQUE collision on existing row: delete old row and retry POST with preserved payload
            await AB.api('DELETE', `/api/indexer/${healFromId}`);
            indexers = indexers.filter((i) => i.id !== healFromId);
            healFromId = null;
            try {
              createdIdx = await AB.api('POST', '/api/indexer', payload);
              await createAssociatedNetworkOrFeed(schema, impl, name, createdIdx);
              toast(t('toast.indexer_created'));
            } catch (retryErr) {
              if (healBackupPayload) {
                await restoreIndexerBackup(healBackupPayload, identifier, healOldIdentifier, retryErr);
                return;
              }
              throw retryErr;
            }
          } else {
            throw postErr;
          }
        }
      }
      closeIndexerModal();
      await refreshIRCAndIndexers();
    } catch (err) {
      const isUniqueErr = err && err.message && err.message.includes('UNIQUE constraint failed');
      if (isUniqueErr) {
        try {
          const fresh = await fetchAllIndexers();
          if (Array.isArray(fresh)) indexers = fresh;
        } catch (_) {}

        const dup = (indexers || []).find((i) => String(i.identifier || '').toLowerCase() === identifier.toLowerCase());
        if (!isRetry && dup && confirm(t('indexers.confirm_replace', { name: dup.name || identifier }))) {
          const dupBackup = buildIndexerBackupPayload(dup, findIndexerSchema(dup.identifier, dup));
          try {
            await AB.api('DELETE', `/api/indexer/${dup.id}`);
            indexers = indexers.filter((i) => i.id !== dup.id);
            editingIndexerId = null;
            editingIndexerData = dup;
            const replacePayload = Object.assign({}, payload, {
              settings: Object.assign({}, (dupBackup && dupBackup.settings) || {}, payload.settings || {})
            });
            delete replacePayload.id;
            try {
              const createdIdx = await AB.api('POST', '/api/indexer', replacePayload);
              await createAssociatedNetworkOrFeed(schema, impl, name, createdIdx);
              toast(t('toast.indexer_created'));
              closeIndexerModal();
              await refreshIRCAndIndexers();
              return;
            } catch (retryErr) {
              if (dupBackup) {
                await restoreIndexerBackup(dupBackup, identifier, dup.identifier || dup.name || identifier, retryErr);
                return;
              }
              toast(`Error saving indexer: ${(retryErr && retryErr.message) ? retryErr.message : String(retryErr || '')}`, true);
              return;
            }
          } catch (delErr) {
            toast(`Error resolving duplicate indexer: ${delErr.message}`, true);
            return;
          }
        }
        toast(t('indexers.err_tracker_exists', { id: identifier }), true);
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
      $('irc-auth-pass').placeholder = editPwPlaceholder || t('irc.pass_placeholder');
    }
    if ($('irc-server-pass')) {
      $('irc-server-pass').value = '';
      $('irc-server-pass').placeholder = editPwPlaceholder || t('irc.server_pass_placeholder');
    }
    if ($('irc-invite-cmd')) {
      const inv = (net && net.invite_command) || '';
      const isRedacted = editingIrcId && (/^\*+$|^<redacted>$/i.test(inv));
      $('irc-invite-cmd').value = isRedacted ? '' : inv;
      $('irc-invite-cmd').placeholder = isRedacted ? t('irc.pass_edit_placeholder') : t('irc.invite_placeholder');
    }

    const firstChannel = (net && net.channels && net.channels[0]) || null;
    if ($('irc-channel-name')) $('irc-channel-name').value = (firstChannel && (firstChannel.name || firstChannel)) || '';
    if ($('irc-channel-pass')) {
      $('irc-channel-pass').value = '';
      $('irc-channel-pass').placeholder = editPwPlaceholder || t('irc.optional_placeholder');
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
    const inviteCmd = ($('irc-invite-cmd') ? $('irc-invite-cmd').value : '').trim();
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
      invite_command: inviteCmd || (editingIrcId ? (base.invite_command || '') : ''),
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
      const nickStr = net.current_nick || net.nick || 'autobrr';
      const isEnabled = net.enabled !== false;
      const isConn = isEnabled && (net.connected === true || (net.connected === undefined && net.status && (net.status === 'connected' || net.status.state === 'connected')));
      const badgeClass = !isEnabled ? 'warn' : (isConn ? 'ok' : 'err');
      const badgeLabel = !isEnabled ? t('status.inactive') : (isConn ? t('irc.connected') : t('irc.disconnected'));
      const connErrors = Array.isArray(net.connection_errors) ? net.connection_errors.filter(Boolean) : [];
      const errHint = (!isConn && isEnabled && connErrors.length > 0) ? connErrors[connErrors.length - 1] : '';

      tr.innerHTML = `
        <td><strong style="color: var(--sos-text);">${escapeHtml(srvStr)}</strong></td>
        <td><code>${escapeHtml(chList)}</code></td>
        <td>${net.invite_command ? `<span class="filter-tag">${escapeHtml(t('irc.invite_set'))}</span>` : escapeHtml(botStr)}</td>
        <td>${escapeHtml(nickStr)}</td>
        <td>
          <span class="badge ${badgeClass}">
            ● ${escapeHtml(badgeLabel)}
          </span>
          ${errHint ? `<div class="irc-error-hint">${escapeHtml(errHint)}</div>` : ''}
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
      const isUnmapped = idx._mapped === false;
      const statusBadgeClass = isUnmapped ? 'warn' : (isEnabled ? 'ok' : 'err');
      const statusLabel = isUnmapped
        ? t('indexers.status_unmapped')
        : (isEnabled ? t('status.active') : t('status.inactive'));
      tr.innerHTML = `
        <td><strong>${escapeHtml(idx.name || idx.identifier || '')}</strong></td>
        <td><code>${escapeHtml(idx.identifier || String(idx.name || '').toLowerCase())}</code></td>
        <td style="color: var(--sos-muted); font-size: 12px;">${escapeHtml(idx.implementation || idx.type || '–')}</td>
        <td>
          <span class="badge ${statusBadgeClass}">
            ${escapeHtml(statusLabel)}
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
    const startBtn = $('btn-start-svc');
    if (startBtn) startBtn.disabled = true;
    try {
      toast('Starting autobrr service...');
      await AB.start();
      toast('autobrr started successfully!');
      await refreshAll();
    } catch (err) {
      toast(`Failed to start: ${err.message}`, true);
    } finally {
      if (startBtn) startBtn.disabled = false;
    }
  }

  async function stopService() {
    if (!AB) return;
    const stopBtn = $('btn-stop-svc');
    if (stopBtn) stopBtn.disabled = true;
    try {
      toast('Stopping autobrr service...');
      await AB.set({ enabled: false });
      toast('autobrr stopped.');
      await refreshAll();
    } catch (err) {
      toast(`Failed to stop: ${err.message}`, true);
    } finally {
      if (stopBtn) stopBtn.disabled = false;
    }
  }

  async function toggleWebUI(enable) {
    if (!AB) return;
    try {
      await AB.set({ ui: enable });
      toast(t(enable ? 'toast.webui_enabled' : 'toast.webui_disabled'));
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
      toast(t(enable ? 'toast.autostart_enabled' : 'toast.autostart_disabled'));
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

  function getTransmissionStatusLabel() {
    if (!AB) return '–';
    const existing = findShareOSTransmissionClient();
    if (existing && existing.enabled !== false && (!transRemoteInfo || (transRemoteInfo.box_enabled && transRemoteInfo.on))) {
      return t('trans.rpc_connected');
    }
    if (transRemoteInfo && !transRemoteInfo.box_enabled) {
      return t('trans.rpc_remote_off');
    }
    if (existing && transRemoteInfo && transRemoteInfo.box_enabled && !transRemoteInfo.on) {
      return t('trans.rpc_no_password');
    }
    return t('trans.rpc_not_configured');
  }

  function updateStatusbar() {
    if ($('sb-releases')) {
      $('sb-releases').textContent = t('sb.releases_count', { count: releases.length });
    }
    if ($('sb-filters')) {
      $('sb-filters').textContent = t('sb.filters_count', { count: filters.length });
    }
    if ($('sb-transmission')) {
      $('sb-transmission').textContent = t('sb.transmission', { status: getTransmissionStatusLabel() });
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
      await refreshReleases();
      await refreshFilters();
      await refreshIRCAndIndexers();
      await refreshDownloaders();
      await refreshTransmissionRemote();
      renderTransmissionRpcSection();
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
    badge.textContent = 'Offline';
    badge.className = 'badge warn';
  }

  async function refreshDownloaders() {
    if (AB && serviceStatus && serviceStatus.ready) {
      try {
        const list = await AB.api('GET', '/api/downloaders');
        downloaders = Array.isArray(list) ? list : [];
      } catch (_) {
        downloaders = [];
      }
    } else {
      downloaders = [];
    }
  }

  async function refreshTransmissionRemote() {
    const TOR = SOS && SOS.torrent;
    if (TOR && TOR.rpc) {
      try {
        const res = await TOR.rpc('shareos-remote-get');
        transRemoteInfo = (res && typeof res === 'object') ? res : null;
        return;
      } catch (_) {}
    }
    transRemoteInfo = null;
  }

  function getExpectedShareOSTransmissionEndpoint(remoteInfo) {
    const useHttp = !!(remoteInfo && remoteInfo.port && remoteInfo.port > 0);
    const tls = !useHttp;
    const port = useHttp ? remoteInfo.port : ((remoteInfo && remoteInfo.https_port) || 9092);
    const rpcPath = (remoteInfo && remoteInfo.path) || '/transmission/rpc';
    return {
      useHttp,
      tls,
      port,
      rpcPath,
      url: `${tls ? 'https' : 'http'}://127.0.0.1:${port}${rpcPath}`
    };
  }

  function setTransRpcButtonsBusy(busy) {
    transRpcBusy = !!busy;
    const boxOn = !!(transRemoteInfo && transRemoteInfo.box_enabled);
    const ids = [
      'btn-connect-trans-rpc',
      'btn-gen-connect-trans-rpc',
      'btn-test-autobrr-trans',
      'btn-remove-autobrr-trans'
    ];
    for (const id of ids) {
      const btn = $(id);
      if (!btn) continue;
      btn.disabled = (id === 'btn-gen-connect-trans-rpc') ? (transRpcBusy || !boxOn) : transRpcBusy;
    }
  }

  function renderGeneratedRemotePasswordBox() {
    const box = $('trans-rpc-generated-box');
    const inp = $('trans-rpc-generated-pw');
    const toggleBtn = $('btn-toggle-trans-rpc-gen-pw');
    if (!box || !inp || !toggleBtn) return;
    if (!lastGeneratedRemotePassword) {
      box.hidden = true;
      inp.value = '';
      inp.type = 'password';
      toggleBtn.textContent = t('btn.show_pw');
      return;
    }
    box.hidden = false;
    if (inp.value !== lastGeneratedRemotePassword) {
      inp.value = lastGeneratedRemotePassword;
      inp.type = 'password';
      toggleBtn.textContent = t('btn.show_pw');
    }
  }

  function renderTransmissionRpcSection() {
    const badge = $('trans-rpc-client-badge');
    const infoBox = $('trans-rpc-info');
    const disabledHint = $('trans-rpc-disabled-hint');
    const setupBox = $('trans-rpc-setup-box');
    const connectForm = $('trans-rpc-connect-form');
    const existingActions = $('trans-rpc-existing-actions');
    const genBtn = $('btn-gen-connect-trans-rpc');
    if (!badge || !setupBox) return;

    const existing = findShareOSTransmissionClient();
    const boxOn = !!(transRemoteInfo && transRemoteInfo.box_enabled);
    const boxOffWithClient = !!(existing && transRemoteInfo && !transRemoteInfo.box_enabled);
    const needsPw = !!(existing && transRemoteInfo && transRemoteInfo.box_enabled && !transRemoteInfo.on && (!existing.username || existing.username === transRemoteInfo.user));
    const isConnected = !!(existing && existing.enabled !== false && boxOn && transRemoteInfo.on);
    if (transRemoteInfo && !transRemoteInfo.on) {
      lastGeneratedRemotePassword = '';
    }

    if (boxOffWithClient) {
      badge.textContent = t('trans.rpc_remote_off');
      badge.className = 'badge warn';
    } else if (needsPw) {
      badge.textContent = t('trans.rpc_no_password');
      badge.className = 'badge warn';
    } else if (existing && existing.enabled !== false) {
      badge.textContent = t('trans.rpc_connected');
      badge.className = 'badge ok';
    } else if (!boxOn) {
      badge.textContent = t('trans.rpc_remote_off');
      badge.className = 'badge warn';
    } else {
      badge.textContent = t('trans.rpc_not_configured');
      badge.className = 'badge warn';
    }

    if (infoBox) {
      const parts = [];
      if (existing) {
        const endpoint = formatDownloaderEndpoint(existing);
        parts.push(t('trans.rpc_info_configured', {
          name: existing.name || 'Transmission',
          endpoint,
          user: existing.username || (transRemoteInfo && transRemoteInfo.user) || '–'
        }));
        if (isShareOSTransmissionHost(existing.host)) {
          parts.push(t('trans.rpc_local_note'));
        }
      } else if (boxOn) {
        const ep = getExpectedShareOSTransmissionEndpoint(transRemoteInfo);
        parts.push(t('trans.rpc_info_ready', {
          endpoint: ep.url,
          user: transRemoteInfo.user || 'root'
        }));
      }
      if (needsPw) {
        parts.push(t('trans.rpc_no_password_hint', {
          user: (transRemoteInfo && transRemoteInfo.user) || (existing && existing.username) || 'root'
        }));
      }
      if (parts.length > 0) {
        infoBox.textContent = parts.join(' ');
        infoBox.style.display = 'block';
      } else {
        infoBox.style.display = 'none';
      }
    }

    if (disabledHint) {
      disabledHint.style.display = !boxOn ? 'block' : 'none';
    }
    setupBox.style.display = (boxOn || existing || lastGeneratedRemotePassword) ? 'block' : 'none';
    if (connectForm) connectForm.hidden = !boxOn || isConnected;
    if (genBtn) genBtn.disabled = transRpcBusy || !boxOn;
    if (existingActions) existingActions.hidden = !existing;
    if (transRpcBusy) setTransRpcButtonsBusy(true);
    renderGeneratedRemotePasswordBox();
    renderLegacyDropNotice();
  }

  function renderLegacyDropNotice() {
    const box = $('trans-legacy-drop-box');
    const txt = $('trans-legacy-drop-text');
    if (!box || !txt) return;
    if (AB && serviceStatus && (serviceStatus.drop || serviceStatus.account)) {
      txt.textContent = t('trans.legacy_drop_active', {
        path: serviceStatus.drop || '/mnt/.../.shareos/autobrr-drop',
        account: serviceStatus.account || '–'
      });
      box.style.display = 'flex';
    } else {
      box.style.display = 'none';
    }
  }

  async function disableLegacyDropFolder() {
    if (!AB) return;
    const btn = $('btn-disable-legacy-drop');
    if (btn) btn.disabled = true;
    try {
      await AB.set({ account: '' });
      await refreshStatus();
      renderLegacyDropNotice();
      renderTransmissionRpcSection();
      updateStatusbar();
      toast(t('toast.legacy_drop_disabled'));
    } catch (err) {
      toast(`Error disabling drop folder: ${err.message}`, true);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function saveTransmissionDownloaderCore(password) {
    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return false;
    }

    // Check remote proxy state and daemon health sequentially before calling
    // ShareOS.autobrr.api (rpcd is single-threaded: calling /api/downloaders/test
    // from inside shareos.appautobrr while tremote calls remote_session deadlocks).
    await refreshTransmissionRemote();
    if (!transRemoteInfo || !transRemoteInfo.box_enabled) {
      toast(t('trans.rpc_disabled_hint'), true);
      return false;
    }

    const user = transRemoteInfo.user || 'root';
    if (!transRemoteInfo.on) {
      toast(t('trans.rpc_no_password_hint', { user }), true);
      return false;
    }

    const TOR = SOS && SOS.torrent;
    if (TOR && TOR.rpc) {
      try {
        await TOR.rpc('session-get');
      } catch (rpcErr) {
        toast(t('trans.rpc_err_daemon_offline', {
          error: (rpcErr && rpcErr.message) ? rpcErr.message : String(rpcErr || '')
        }), true);
        return false;
      }
    }

    const existing = findShareOSTransmissionClient();
    const ep = getExpectedShareOSTransmissionEndpoint(transRemoteInfo);
    const payload = {
      name: (existing && existing.name) || `ShareOS Transmission (${user})`,
      type: 'TRANSMISSION',
      enabled: true,
      host: ep.url,
      port: 0,
      tls: ep.tls,
      tls_skip_verify: ep.tls,
      username: user,
      password,
      settings: (existing && existing.settings) || {}
    };
    if (existing && existing.id) {
      payload.id = existing.id;
    }

    try {
      if (existing && existing.id) {
        await AB.api('PUT', '/api/downloaders', payload);
      } else {
        await AB.api('POST', '/api/downloaders', payload);
      }
      if ($('trans-rpc-password')) $('trans-rpc-password').value = '';
      if (serviceStatus && serviceStatus.account) {
        try {
          await AB.set({ account: '' });
          await refreshStatus();
        } catch (clearErr) {
          console.warn('Could not clear legacy ShareOS drop folder:', clearErr);
        }
      }
      await refreshDownloaders();
      renderTransmissionRpcSection();
      renderLegacyDropNotice();
      updateStatusbar();
      toast(t('toast.trans_rpc_connected'));
      return true;
    } catch (err) {
      toast(`Error saving Transmission RPC client: ${err.message}`, true);
      return false;
    }
  }

  async function saveTransmissionDownloader(password) {
    if (transRpcBusy) return false;
    setTransRpcButtonsBusy(true);
    try {
      return await saveTransmissionDownloaderCore(password);
    } finally {
      setTransRpcButtonsBusy(false);
    }
  }

  async function connectTransmissionRpcWithInput() {
    const inp = $('trans-rpc-password');
    const pw = (inp ? inp.value : '').trim();
    if (!pw) {
      toast(t('trans.rpc_err_password'), true);
      if (inp) inp.focus();
      return;
    }
    await saveTransmissionDownloader(pw);
  }

  async function generateAndConnectTransmissionRpc() {
    if (transRpcBusy) return;
    const TOR = SOS && SOS.torrent;
    if (!TOR || !TOR.rpc || !transRemoteInfo || !transRemoteInfo.box_enabled) {
      toast(t('trans.rpc_disabled_hint'), true);
      return;
    }
    const msg = transRemoteInfo.on ? t('trans.rpc_confirm_regen') : t('trans.rpc_confirm_gen');
    if (!confirm(msg)) return;

    setTransRpcButtonsBusy(true);
    try {
      const res = await TOR.rpc('shareos-remote-set', { on: true, regen: true });
      if (!res || !res.password) {
        toast('ShareOS did not return a remote password', true);
        return;
      }
      const pw = res.password;
      const sanitized = Object.assign({}, res);
      delete sanitized.password;
      transRemoteInfo = sanitized;
      lastGeneratedRemotePassword = pw;
      renderGeneratedRemotePasswordBox();
      await saveTransmissionDownloaderCore(pw);
    } catch (err) {
      toast(`Error generating remote password: ${err.message}`, true);
    } finally {
      setTransRpcButtonsBusy(false);
    }
  }

  async function testAutobrrTransmissionClient() {
    if (transRpcBusy) return;
    if (!AB || !serviceStatus || !serviceStatus.ready) {
      toast(t('err.service_not_ready'), true);
      return;
    }
    const existing = findShareOSTransmissionClient();
    if (!existing) return;

    setTransRpcButtonsBusy(true);
    try {
      if (isShareOSTransmissionHost(existing.host)) {
        await refreshDownloaders();
        await refreshTransmissionRemote();
        renderTransmissionRpcSection();

        const client = findShareOSTransmissionClient();
        if (!client || client.enabled === false) {
          toast('autobrr → Transmission verification failed: client is missing or disabled', true);
          return;
        }
        if (!transRemoteInfo || !transRemoteInfo.box_enabled) {
          toast(t('trans.rpc_disabled_hint'), true);
          return;
        }
        const user = transRemoteInfo.user || client.username || 'root';
        if (!transRemoteInfo.on) {
          toast(t('trans.rpc_no_password_hint', { user }), true);
          return;
        }

        const ep = getExpectedShareOSTransmissionEndpoint(transRemoteInfo);
        const parsed = parseDownloaderHostUrl(client.host, client.tls);
        const parsedHost = cleanHost(parsed ? parsed.hostname : client.host).toLowerCase();
        const isLoopback = parsedHost === '127.0.0.1' || parsedHost === 'localhost' || parsedHost === '::1';
        const actualPort = (parsed && parsed.port)
          ? parseInt(parsed.port, 10)
          : (client.port > 0 ? client.port : (client.tls ? 443 : 80));
        const portMatches = actualPort === ep.port ||
          (!!client.tls && !!transRemoteInfo.https && actualPort === (transRemoteInfo.https_port || 9092));
        const pathOk = !!(parsed && (parsed.pathname || '').includes('/transmission/rpc'));
        if (!isLoopback || !portMatches || !pathOk) {
          toast(t('trans.rpc_verify_mismatch', {
            current: formatDownloaderEndpoint(client),
            expected: ep.url
          }), true);
          return;
        }

        let version = 'Active';
        const TOR = SOS && SOS.torrent;
        if (TOR && TOR.rpc) {
          try {
            const res = await TOR.rpc('session-get');
            const session = (res && res.arguments) ? res.arguments : res;
            if (session && typeof session === 'object' && session.version) {
              version = `v${session.version}`;
            }
          } catch (rpcErr) {
            toast(t('trans.rpc_err_daemon_offline', {
              error: (rpcErr && rpcErr.message) ? rpcErr.message : String(rpcErr || '')
            }), true);
            return;
          }
        }

        toast(t('toast.trans_rpc_verify_ok', {
          version,
          endpoint: formatDownloaderEndpoint(client)
        }));
        return;
      }

      await AB.api('POST', '/api/downloaders/test', existing);
      toast(t('toast.trans_rpc_test_ok'));
    } catch (err) {
      toast(`autobrr → Transmission test failed: ${err.message}`, true);
    } finally {
      setTransRpcButtonsBusy(false);
    }
  }

  async function removeAutobrrTransmissionClient() {
    if (transRpcBusy) return;
    if (!AB || !serviceStatus || !serviceStatus.ready) return;
    const existing = findShareOSTransmissionClient();
    if (!existing) return;
    if (!confirm(t('trans.rpc_confirm_remove', { name: existing.name || existing.id }))) return;
    setTransRpcButtonsBusy(true);
    try {
      await AB.api('DELETE', `/api/downloaders/${existing.id}`);
      lastGeneratedRemotePassword = '';
      await refreshDownloaders();
      renderTransmissionRpcSection();
      renderGeneratedRemotePasswordBox();
      updateStatusbar();
      toast(t('toast.trans_rpc_removed'));
    } catch (err) {
      toast(`Error removing download client: ${err.message}`, true);
    } finally {
      setTransRpcButtonsBusy(false);
    }
  }

  // Explicit Transmission connection test via RPC
  async function testTransmissionRPC() {
    const badge = $('trans-daemon-badge');
    if (badge) {
      badge.textContent = 'Connecting...';
      badge.className = 'badge warn';
    }
    let lastErr = '';
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
        lastErr = (err && err.message) ? err.message : String(err || '');
        console.warn('RPC test failed:', err);
      }
    }
    toast(t('trans.rpc_err_daemon_offline', { error: lastErr || 'unavailable' }), true);
    if (badge) {
      badge.textContent = 'Disconnected';
      badge.className = 'badge err';
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
          { label: t('menu.about'), action: () => alert('autobrr-ui for ShareOS v1.1.5\nIntegrated via ShareOS.autobrr\nPublisher: @SamuelSilvaG') }
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
    if ($('btn-disable-legacy-drop')) $('btn-disable-legacy-drop').onclick = disableLegacyDropFolder;
    if ($('btn-save-admin-pw')) $('btn-save-admin-pw').onclick = saveAdminPassword;
    if ($('btn-refresh-log')) $('btn-refresh-log').onclick = refreshLog;
    if ($('btn-test-transmission')) $('btn-test-transmission').onclick = testTransmissionRPC;
    if ($('btn-connect-trans-rpc')) $('btn-connect-trans-rpc').onclick = connectTransmissionRpcWithInput;
    if ($('btn-gen-connect-trans-rpc')) $('btn-gen-connect-trans-rpc').onclick = generateAndConnectTransmissionRpc;
    if ($('btn-test-autobrr-trans')) $('btn-test-autobrr-trans').onclick = testAutobrrTransmissionClient;
    if ($('btn-remove-autobrr-trans')) $('btn-remove-autobrr-trans').onclick = removeAutobrrTransmissionClient;
    if ($('btn-toggle-trans-rpc-gen-pw')) {
      $('btn-toggle-trans-rpc-gen-pw').onclick = () => {
        const inp = $('trans-rpc-generated-pw');
        const btn = $('btn-toggle-trans-rpc-gen-pw');
        if (!inp || !btn) return;
        const show = inp.type === 'password';
        inp.type = show ? 'text' : 'password';
        btn.textContent = t(show ? 'btn.hide_pw' : 'btn.show_pw');
      };
    }
    if ($('btn-copy-trans-rpc-gen-pw')) {
      $('btn-copy-trans-rpc-gen-pw').onclick = async () => {
        if (!lastGeneratedRemotePassword) return;
        const ok = await copyTextToClipboard(lastGeneratedRemotePassword);
        toast(t(ok ? 'toast.pw_copied' : 'toast.copy_failed'), !ok);
      };
    }
    if ($('btn-dismiss-trans-rpc-gen-pw')) {
      $('btn-dismiss-trans-rpc-gen-pw').onclick = () => {
        lastGeneratedRemotePassword = '';
        renderGeneratedRemotePasswordBox();
        renderTransmissionRpcSection();
      };
    }
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
        const url = getWebUIUrl();
        const ok = await copyTextToClipboard(url);
        if (ok) toast('Web UI URL copied to clipboard!');
        else toast(url);
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
    if ($('indexer-modal-save-btn')) $('indexer-modal-save-btn').onclick = () => saveIndexerFromModal(false);
    if ($('indexer-preset')) {
      $('indexer-preset').onchange = () => {
        const id = $('indexer-preset').value;
        const schema = indexerSchemas.find((s) => s.identifier === id) || null;
        if (schema) {
          const targetName = schema.name || schema.identifier;
          if ($('indexer-name')) $('indexer-name').value = targetName;
          const impl = String(schema.implementation || '').toLowerCase();
          if ($('indexer-identifier')) {
            $('indexer-identifier').value = isFeedImplementation(impl)
              ? slugifyFeedIdentifier(impl, targetName)
              : schema.identifier;
          }
          if ($('indexer-url') && schema.urls && schema.urls[0]) {
            $('indexer-url').value = schema.urls[0];
          }
        } else if (!editingIndexerId) {
          if ($('indexer-name')) $('indexer-name').value = '';
          if ($('indexer-identifier')) $('indexer-identifier').value = '';
        }
        updateIndexerSchemaUI();
      };
    }
    if ($('indexer-name')) {
      $('indexer-name').oninput = () => {
        if (editingIndexerId) return;
        const presetId = $('indexer-preset') ? $('indexer-preset').value : '';
        const schema = indexerSchemas.find((s) => s.identifier === presetId);
        if (schema && isFeedImplementation(schema.implementation) && $('indexer-identifier')) {
          $('indexer-identifier').value = slugifyFeedIdentifier(schema.implementation, $('indexer-name').value) || schema.identifier;
        }
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
