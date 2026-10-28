// Transmission ShareOS Web Client - Transgui Desktop Interface
// Fully integrated with ShareOS.torrent RPC and ShareOS.fs
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);

  // Core State
  const TOR = window.ShareOS && ShareOS.torrent;
  let lastError = '';
  let torrents = [];
  let selectedIds = new Set();
  let serverSession = null;
  let serverStats = null;
  let refreshTimer = null;
  let isConnected = false;
  let pendingFileMetainfo = null;

  // Filter & Sort State
  let activeFilter = { type: 'status', val: 'all' }; // type: 'status' | 'tracker' | 'dir'
  let sortField = 'queuePosition';
  let sortAsc = true;
  let activeDetailTab = 'general';
  let sidebarCollapsed = false;

  // Status mapping
  const STATUS_MAP = {
    0: { key: 'paused', name: 'status.0' },
    1: { key: 'checking', name: 'status.1' },
    2: { key: 'checking', name: 'status.2' },
    3: { key: 'downloading', name: 'status.3' },
    4: { key: 'downloading', name: 'status.4' },
    5: { key: 'seeding', name: 'status.5' },
    6: { key: 'seeding', name: 'status.6' }
  };

  function statusInfo(status, errorString) {
    if (errorString && errorString.trim().length > 0) {
      return { key: 'error', text: t('filter.error') + ': ' + errorString };
    }
    const info = STATUS_MAP[status];
    if (!info) return { key: 'unknown', text: t('status.unknown') };
    return { key: info.key, text: t(info.name) };
  }

  function fmtBytes(bytes) {
    if (bytes == null || isNaN(bytes) || bytes < 0) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024, dm = 2;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + (sizes[i] || 'B');
  }

  function fmtRate(rate) {
    return fmtBytes(rate) + '/s';
  }

  function fmtEta(seconds) {
    if (seconds == null || seconds < 0 || seconds > 3600 * 24 * 365) return '–';
    if (seconds === 0) return t('eta.done');
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  function fmtDuration(seconds) {
    if (!seconds || seconds <= 0) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0 || parts.length === 0) parts.push(`${s}s`);
    return parts.join(' ');
  }

  function fmtDate(timestamp) {
    if (!timestamp || timestamp <= 0) return '–';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function toast(msg, isError = false) {
    const c = $('toast-container');
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // JSON-RPC via ShareOS daemon proxy
  async function rpc(method, args = {}) {
    if (!TOR) throw new Error(t('err.noShareOS'));
    return TOR.rpc(method, args);
  }

  function boxPath(p) {
    if (!p) return '–';
    return p.replace(/^home(\/|$)/, t('path.home') + '$1');
  }

  // Extract host from tracker URL
  function trackerHost(url) {
    try {
      if (!url) return 'Unknown';
      const m = url.match(/^(?:https?|udp):\/\/([^:/]+)/i);
      return m ? m[1].toLowerCase() : url;
    } catch {
      return url || 'Unknown';
    }
  }

  // Refresh Torrent list and server state
  async function refresh() {
    try {
      const [torrentData, sessionData] = await Promise.all([
        rpc('torrent-get', {
          fields: [
            'id', 'name', 'status', 'totalSize', 'percentDone', 'rateDownload',
            'rateUpload', 'eta', 'errorString', 'downloadDir', 'uploadRatio',
            'uploadedEver', 'downloadedEver', 'corruptEver', 'peersConnected',
            'peersSendingToUs', 'peersGettingFromUs', 'files', 'fileStats',
            'trackers', 'trackerStats', 'peers', 'hashString', 'dateCreated',
            'addedDate', 'doneDate', 'pieceCount', 'pieceSize', 'pieces',
            'bandwidthPriority', 'downloadLimit', 'downloadLimited',
            'uploadLimit', 'uploadLimited', 'seedRatioLimit', 'seedRatioMode',
            'queuePosition', 'comment', 'creator', 'maxConnectedPeers', 'isPrivate'
          ]
        }),
        rpc('session-get')
      ]);

      torrents = torrentData.torrents || [];
      serverSession = sessionData;
      setConnected(true);
      renderSidebar();
      renderTorrents();
      updateStatusbar();
      renderDetails();
    } catch (err) {
      lastError = err.message;
      setConnected(false);
    }
  }

  function setConnected(online) {
    isConnected = online;
    const badge = $('conn-badge');
    const banner = $('offline-banner');
    if (online) {
      badge.textContent = t('conn.online');
      badge.className = 'conn-badge online';
      banner.style.display = 'none';
    } else {
      badge.textContent = t('conn.offline');
      badge.className = 'conn-badge offline';
      banner.style.display = 'flex';
      const why = /not installed/.test(lastError) ? t('why.notInstalled')
        : /no drive|no personal folder/.test(lastError) ? t('why.noDrive')
        : /no access/.test(lastError) ? t('why.noAccess')
        : t('why.noResponse', { detail: lastError ? ' (' + lastError + ')' : '' });
      $('banner-why').textContent = why;
      $('torrent-rows').innerHTML = `<tr><td colspan="14" class="empty-state">${why}</td></tr>`;
    }
  }

  // Render Sidebar counters and dynamic groups
  function renderSidebar() {
    let dl = 0, seed = 0, active = 0, paused = 0, finished = 0, errCount = 0;
    const trackersMap = new Map();
    const dirsMap = new Map();

    torrents.forEach((t) => {
      if (t.status === 3 || t.status === 4) dl++;
      if (t.status === 5 || t.status === 6) seed++;
      if (t.rateDownload > 0 || t.rateUpload > 0) active++;
      if (t.status === 0) paused++;
      if (t.percentDone >= 1) finished++;
      if (t.errorString && t.errorString.trim().length > 0) errCount++;

      // Trackers
      const seenTrackers = new Set();
      if (t.trackers && t.trackers.length) {
        t.trackers.forEach((tr) => {
          const h = trackerHost(tr.announce);
          if (h && !seenTrackers.has(h)) {
            seenTrackers.add(h);
            trackersMap.set(h, (trackersMap.get(h) || 0) + 1);
          }
        });
      }

      // Directories
      const dir = t.downloadDir || 'default';
      dirsMap.set(dir, (dirsMap.get(dir) || 0) + 1);
    });

    $('badge-all').textContent = torrents.length;
    $('badge-downloading').textContent = dl;
    $('badge-seeding').textContent = seed;
    $('badge-active').textContent = active;
    $('badge-paused').textContent = paused;
    $('badge-finished').textContent = finished;
    $('badge-error').textContent = errCount;

    // Trackers dynamic list
    const trList = $('sidebar-trackers');
    $('badge-trackers-all').textContent = torrents.length;
    const trItems = Array.from(trList.querySelectorAll('.sidebar-item:not([data-tracker="all"])'));
    trItems.forEach((el) => el.remove());

    const sortedTrackers = Array.from(trackersMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    sortedTrackers.forEach(([host, count]) => {
      const li = document.createElement('li');
      li.className = 'sidebar-item' + (activeFilter.type === 'tracker' && activeFilter.val === host ? ' active' : '');
      li.dataset.tracker = host;
      li.innerHTML = `
        <span class="sidebar-icon">🌐</span>
        <span class="sidebar-label" title="${escapeHtml(host)}">${escapeHtml(host)}</span>
        <span class="sidebar-badge">${count}</span>
      `;
      trList.appendChild(li);
    });

    // Directories dynamic list
    const dirList = $('sidebar-dirs');
    $('badge-dirs-all').textContent = torrents.length;
    const dirItems = Array.from(dirList.querySelectorAll('.sidebar-item:not([data-dir="all"])'));
    dirItems.forEach((el) => el.remove());

    const sortedDirs = Array.from(dirsMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    sortedDirs.forEach(([dir, count]) => {
      const li = document.createElement('li');
      li.className = 'sidebar-item' + (activeFilter.type === 'dir' && activeFilter.val === dir ? ' active' : '');
      li.dataset.dir = dir;
      li.innerHTML = `
        <span class="sidebar-icon">📂</span>
        <span class="sidebar-label" title="${escapeHtml(boxPath(dir))}">${escapeHtml(boxPath(dir))}</span>
        <span class="sidebar-badge">${count}</span>
      `;
      dirList.appendChild(li);
    });
  }

  // Filter & Sort
  function getFilteredTorrents() {
    const query = $('search-input').value.trim().toLowerCase();

    return torrents.filter((t) => {
      // Search
      if (query && !t.name.toLowerCase().includes(query)) return false;

      // Sidebar Filter
      if (activeFilter.type === 'status') {
        if (activeFilter.val === 'all') return true;
        if (activeFilter.val === 'downloading') return t.status === 3 || t.status === 4;
        if (activeFilter.val === 'seeding') return t.status === 5 || t.status === 6;
        if (activeFilter.val === 'active') return t.rateDownload > 0 || t.rateUpload > 0;
        if (activeFilter.val === 'paused') return t.status === 0;
        if (activeFilter.val === 'finished') return t.percentDone >= 1;
        if (activeFilter.val === 'error') return !!t.errorString;
      } else if (activeFilter.type === 'tracker') {
        if (activeFilter.val === 'all') return true;
        if (!t.trackers || !t.trackers.length) return false;
        return t.trackers.some((tr) => trackerHost(tr.announce) === activeFilter.val);
      } else if (activeFilter.type === 'dir') {
        if (activeFilter.val === 'all') return true;
        return t.downloadDir === activeFilter.val;
      }
      return true;
    }).sort((a, b) => {
      let vA = a[sortField], vB = b[sortField];
      if (sortField === 'name') {
        vA = (vA || '').toLowerCase();
        vB = (vB || '').toLowerCase();
        return sortAsc ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      if (sortField === 'seeds') {
        vA = a.peersSendingToUs || 0;
        vB = b.peersSendingToUs || 0;
      }
      if (sortField === 'peers') {
        vA = a.peersConnected || 0;
        vB = b.peersConnected || 0;
      }
      if (vA == null) vA = 0;
      if (vB == null) vB = 0;
      return sortAsc ? (vA > vB ? 1 : vA < vB ? -1 : 0) : (vA < vB ? 1 : vA > vB ? -1 : 0);
    });
  }

  // Render Torrent Table
  function renderTorrents() {
    const tbody = $('torrent-rows');
    const filtered = getFilteredTorrents();

    // Update column sort indicators
    document.querySelectorAll('.torrent-table th.sortable').forEach((th) => {
      th.classList.remove('sort-asc', 'sort-desc');
      if (th.dataset.sort === sortField) {
        th.classList.add(sortAsc ? 'sort-asc' : 'sort-desc');
      }
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="14" class="empty-state">${torrents.length === 0 ? t('list.empty') : t('list.nomatch')}</td></tr>`;
      updateActionButtons();
      return;
    }

    tbody.innerHTML = filtered.map((t) => {
      const isSel = selectedIds.has(t.id);
      const pct = (t.percentDone * 100).toFixed(1);
      const st = statusInfo(t.status, t.errorString);
      const isSeed = t.status === 5 || t.status === 6;
      const isPaused = t.status === 0;
      const isChecking = t.status === 1 || t.status === 2;
      const pbarCls = isSeed ? 'seeding' : (isPaused ? 'paused' : (isChecking ? 'verifying' : ''));

      return `
        <tr class="torrent-row ${isSel ? 'selected' : ''}" data-id="${t.id}">
          <td class="td-sel"><input type="checkbox" class="row-chk" data-id="${t.id}" ${isSel ? 'checked' : ''}></td>
          <td class="td-order">${t.queuePosition != null ? t.queuePosition + 1 : '–'}</td>
          <td class="td-name" title="${escapeHtml(t.name)}"><strong>${escapeHtml(t.name)}</strong></td>
          <td class="td-size">${fmtBytes(t.totalSize)}</td>
          <td class="td-progress">
            <div class="pbar-wrap"><div class="pbar-fill ${pbarCls}" style="width:${pct}%"></div></div>
            <div class="pbar-text">${pct}%</div>
          </td>
          <td class="td-status"><span class="status-badge ${st.key}">${st.text}</span></td>
          <td class="td-seeds">${t.peersSendingToUs || 0}</td>
          <td class="td-peers">${t.peersConnected || 0}</td>
          <td class="td-down">${t.rateDownload > 0 ? '↓ ' + fmtRate(t.rateDownload) : '–'}</td>
          <td class="td-up">${t.rateUpload > 0 ? '↑ ' + fmtRate(t.rateUpload) : '–'}</td>
          <td class="td-eta">${fmtEta(t.eta)}</td>
          <td class="td-ratio">${t.uploadRatio != null ? t.uploadRatio.toFixed(2) : '0.00'}</td>
          <td class="td-uploaded">${fmtBytes(t.uploadedEver)}</td>
          <td class="td-added">${fmtDate(t.addedDate)}</td>
        </tr>
      `;
    }).join('');

    updateActionButtons();
  }

  function updateActionButtons() {
    const hasSel = selectedIds.size > 0;
    $('btn-start').disabled = !hasSel;
    $('btn-force').disabled = !hasSel;
    $('btn-pause').disabled = !hasSel;
    $('btn-remove').disabled = !hasSel;
    $('btn-verify').disabled = !hasSel;
    $('btn-queue-up').disabled = !hasSel;
    $('btn-queue-down').disabled = !hasSel;
    $('btn-reannounce').disabled = !hasSel;
  }

  function updateStatusbar() {
    let dlCount = 0, seedCount = 0, pauseCount = 0;
    let totalDown = 0, totalUp = 0;

    torrents.forEach((t) => {
      if (t.status === 3 || t.status === 4) dlCount++;
      if (t.status === 5 || t.status === 6) seedCount++;
      if (t.status === 0) pauseCount++;
      totalDown += t.rateDownload;
      totalUp += t.rateUpload;
    });

    $('sb-count').textContent = t('sb.torrents_detail', {
      n: torrents.length,
      dl: dlCount,
      seed: seedCount,
      pause: pauseCount
    });

    $('sb-rates').textContent = `↓ ${fmtRate(totalDown)}   ↑ ${fmtRate(totalUp)}`;

    if (serverSession) {
      const isTurtle = serverSession['alt-speed-enabled'];
      $('sb-turtle-status').style.display = isTurtle ? 'inline' : 'none';
      $('sb-turtle-sep').style.display = isTurtle ? 'inline' : 'none';
      $('btn-turtle').classList.toggle('sos-btn-accent', !!isTurtle);

      const port = serverSession['peer-port'];
      if (port) {
        $('sb-port').textContent = `Port: ${port}`;
      }
    }
  }

  // Render Bottom Details Panel
  function renderDetails() {
    const drawer = $('details-drawer');
    if (selectedIds.size === 0) {
      document.querySelectorAll('.drawer-content .tab-panel').forEach((p) => {
        p.innerHTML = '<div class="empty-detail-hint">Select a torrent to view details.</div>';
      });
      return;
    }

    const firstId = Array.from(selectedIds)[0];
    const tor = torrents.find((x) => x.id === firstId);
    if (!tor) return;

    // 1. Tab General
    $('tab-general').innerHTML = `
      <div class="det-grid">
        <div class="det-card">
          <h4>${t('det.transferred')}</h4>
          <div class="det-row"><span class="det-label">${t('det.dlRate')}</span><span class="det-val">↓ ${fmtRate(tor.rateDownload)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.ulRate')}</span><span class="det-val">↑ ${fmtRate(tor.rateUpload)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.downloaded')}</span><span class="det-val">${fmtBytes(tor.downloadedEver)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.uploaded')}</span><span class="det-val">${fmtBytes(tor.uploadedEver)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.ratio')}</span><span class="det-val">${tor.uploadRatio != null ? tor.uploadRatio.toFixed(2) : '0.00'}</span></div>
          <div class="det-row"><span class="det-label">${t('det.corrupt')}</span><span class="det-val">${fmtBytes(tor.corruptEver)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.remainingTime')}</span><span class="det-val">${fmtEta(tor.eta)}</span></div>
        </div>
        <div class="det-card">
          <h4>${t('det.info')}</h4>
          <div class="det-row"><span class="det-label">${t('det.totalSize')}</span><span class="det-val">${fmtBytes(tor.totalSize)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.piecesInfo')}</span><span class="det-val">${tor.pieceCount || 0} × ${fmtBytes(tor.pieceSize)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.location')}</span><span class="det-val">${escapeHtml(boxPath(tor.downloadDir))}</span></div>
          <div class="det-row"><span class="det-label">${t('det.hash')}</span><span class="det-val"><code style="font-size:11px;">${tor.hashString}</code></span></div>
          <div class="det-row"><span class="det-label">${t('det.addedDate')}</span><span class="det-val">${fmtDate(tor.addedDate)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.doneDate')}</span><span class="det-val">${fmtDate(tor.doneDate)}</span></div>
          <div class="det-row"><span class="det-label">${t('det.private')}</span><span class="det-val">${tor.isPrivate ? t('det.yes') : t('det.no')}</span></div>
          ${tor.comment ? `<div class="det-row"><span class="det-label">${t('det.comment')}</span><span class="det-val">${escapeHtml(tor.comment)}</span></div>` : ''}
        </div>
      </div>
    `;

    // 2. Tab Files (Granular selection and priority)
    if (tor.files && tor.files.length) {
      const stats = tor.fileStats || [];
      $('tab-files').innerHTML = `
        <div class="files-actions-bar">
          <button id="btn-files-check-all" class="sos-btn sos-btn-sm">${t('det.checkAll')}</button>
          <button id="btn-files-uncheck-all" class="sos-btn sos-btn-sm">${t('det.uncheckAll')}</button>
          <span style="border-left:1px solid var(--sos-line); margin:0 4px;"></span>
          <button id="btn-files-prio-high" class="sos-btn sos-btn-sm">${t('det.prioHigh')}</button>
          <button id="btn-files-prio-normal" class="sos-btn sos-btn-sm">${t('det.prioNormal')}</button>
          <button id="btn-files-prio-low" class="sos-btn sos-btn-sm">${t('det.prioLow')}</button>
        </div>
        <table class="torrent-table" style="font-size:11px;">
          <thead>
            <tr>
              <th style="width:30px;">${t('det.wanted')}</th>
              <th style="width:90px;">${t('det.priority')}</th>
              <th>${t('det.file')}</th>
              <th style="width:100px;">${t('det.size')}</th>
              <th style="width:140px;">${t('det.progress')}</th>
            </tr>
          </thead>
          <tbody>
            ${tor.files.map((f, idx) => {
              const st = stats[idx] || {};
              const wanted = st.wanted !== false;
              const prio = st.priority === 1 ? 'high' : (st.priority === -1 ? 'low' : 'normal');
              const pct = ((f.bytesCompleted / (f.length || 1)) * 100).toFixed(1);
              return `
                <tr data-file-idx="${idx}">
                  <td style="text-align:center;"><input type="checkbox" class="file-chk" data-idx="${idx}" ${wanted ? 'checked' : ''}></td>
                  <td>
                    <select class="file-prio-sel sos-input" data-idx="${idx}" style="height:22px; padding:0 4px; font-size:11px;">
                      <option value="1" ${prio === 'high' ? 'selected' : ''}>${t('det.prioHigh')}</option>
                      <option value="0" ${prio === 'normal' ? 'selected' : ''}>${t('det.prioNormal')}</option>
                      <option value="-1" ${prio === 'low' ? 'selected' : ''}>${t('det.prioLow')}</option>
                    </select>
                  </td>
                  <td title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</td>
                  <td>${fmtBytes(f.length)}</td>
                  <td>
                    <div class="pbar-wrap" style="height:10px;"><div class="pbar-fill" style="width:${pct}%"></div></div>
                    <span style="font-size:10px; color:var(--sos-muted);">${pct}% (${fmtBytes(f.bytesCompleted)})</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      // Wire file events
      $('tab-files').querySelectorAll('.file-chk').forEach((chk) => {
        chk.addEventListener('change', async (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          const wanted = e.target.checked;
          try {
            await rpc('torrent-set', {
              ids: [tor.id],
              [wanted ? 'files-wanted' : 'files-unwanted']: [idx]
            });
            refresh();
          } catch (err) { toast(err.message, true); }
        });
      });

      $('tab-files').querySelectorAll('.file-prio-sel').forEach((sel) => {
        sel.addEventListener('change', async (e) => {
          const idx = parseInt(e.target.dataset.idx, 10);
          const prio = parseInt(e.target.value, 10);
          const prioKey = prio === 1 ? 'priority-high' : (prio === -1 ? 'priority-low' : 'priority-normal');
          try {
            await rpc('torrent-set', { ids: [tor.id], [prioKey]: [idx] });
            refresh();
          } catch (err) { toast(err.message, true); }
        });
      });

      $('btn-files-check-all').addEventListener('click', async () => {
        const allIdx = tor.files.map((_, i) => i);
        try {
          await rpc('torrent-set', { ids: [tor.id], 'files-wanted': allIdx });
          refresh();
        } catch (err) { toast(err.message, true); }
      });

      $('btn-files-uncheck-all').addEventListener('click', async () => {
        const allIdx = tor.files.map((_, i) => i);
        try {
          await rpc('torrent-set', { ids: [tor.id], 'files-unwanted': allIdx });
          refresh();
        } catch (err) { toast(err.message, true); }
      });

      $('btn-files-prio-high').addEventListener('click', async () => {
        const allIdx = tor.files.map((_, i) => i);
        try {
          await rpc('torrent-set', { ids: [tor.id], 'priority-high': allIdx });
          refresh();
        } catch (err) { toast(err.message, true); }
      });

      $('btn-files-prio-normal').addEventListener('click', async () => {
        const allIdx = tor.files.map((_, i) => i);
        try {
          await rpc('torrent-set', { ids: [tor.id], 'priority-normal': allIdx });
          refresh();
        } catch (err) { toast(err.message, true); }
      });

      $('btn-files-prio-low').addEventListener('click', async () => {
        const allIdx = tor.files.map((_, i) => i);
        try {
          await rpc('torrent-set', { ids: [tor.id], 'priority-low': allIdx });
          refresh();
        } catch (err) { toast(err.message, true); }
      });
    } else {
      $('tab-files').innerHTML = `<div class="empty-detail-hint">${t('det.noFiles')}</div>`;
    }

    // 3. Tab Peers
    if (tor.peers && tor.peers.length) {
      $('tab-peers').innerHTML = `
        <table class="torrent-table" style="font-size:11px;">
          <thead>
            <tr>
              <th>${t('det.ip')}</th>
              <th>${t('det.client')}</th>
              <th style="width:80px;">Flags</th>
              <th style="width:80px;">${t('det.progress')}</th>
              <th style="width:110px;">${t('col.downSpeed')}</th>
              <th style="width:110px;">${t('col.upSpeed')}</th>
            </tr>
          </thead>
          <tbody>
            ${tor.peers.map((p) => `
              <tr>
                <td><code>${escapeHtml(p.address)}:${p.port || ''}</code></td>
                <td>${escapeHtml(p.clientName || '–')}</td>
                <td><code>${escapeHtml(p.flagStr || '–')}</code></td>
                <td>${((p.progress || 0) * 100).toFixed(1)}%</td>
                <td>${p.rateToClient > 0 ? '↓ ' + fmtRate(p.rateToClient) : '–'}</td>
                <td>${p.rateToPeer > 0 ? '↑ ' + fmtRate(p.rateToPeer) : '–'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      $('tab-peers').innerHTML = `<div class="empty-detail-hint">${t('det.noPeers')}</div>`;
    }

    // 4. Tab Trackers
    if (tor.trackers && tor.trackers.length) {
      const stats = tor.trackerStats || [];
      $('tab-trackers').innerHTML = `
        <div class="files-actions-bar">
          <button id="btn-add-tracker" class="sos-btn sos-btn-sm">${t('det.addTracker')}</button>
        </div>
        <table class="torrent-table" style="font-size:11px;">
          <thead>
            <tr>
              <th style="width:50px;">${t('det.tier')}</th>
              <th>${t('det.announce')}</th>
              <th style="width:80px;">${t('det.seeds')}</th>
              <th style="width:80px;">${t('det.leechers')}</th>
              <th style="width:80px;">${t('det.downloads')}</th>
              <th style="width:140px;">${t('det.lastAnnounce')}</th>
              <th style="width:140px;">${t('det.nextAnnounce')}</th>
              <th style="width:70px;"></th>
            </tr>
          </thead>
          <tbody>
            ${tor.trackers.map((tr, idx) => {
              const st = stats[idx] || {};
              return `
                <tr>
                  <td>${tr.tier != null ? tr.tier : idx}</td>
                  <td title="${escapeHtml(tr.announce)}"><code>${escapeHtml(tr.announce)}</code></td>
                  <td>${st.seederCount >= 0 ? st.seederCount : '–'}</td>
                  <td>${st.leecherCount >= 0 ? st.leecherCount : '–'}</td>
                  <td>${st.downloadCount >= 0 ? st.downloadCount : '–'}</td>
                  <td>${st.lastAnnounceTime ? fmtDate(st.lastAnnounceTime) : '–'}</td>
                  <td>${st.nextAnnounceTime ? fmtEta(st.nextAnnounceTime - Math.floor(Date.now() / 1000)) : '–'}</td>
                  <td>
                    <button class="sos-btn sos-btn-sm sos-btn-danger btn-del-tr" data-tr-id="${tr.id != null ? tr.id : idx}">✕</button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      $('btn-add-tracker').addEventListener('click', async () => {
        const url = prompt(t('tracker.addPrompt'));
        if (url && url.trim()) {
          try {
            await rpc('torrent-set', { ids: [tor.id], trackerAdd: [url.trim()] });
            toast(t('toast.saved'));
            refresh();
          } catch (err) { toast(err.message, true); }
        }
      });

      $('tab-trackers').querySelectorAll('.btn-del-tr').forEach((btn) => {
        btn.addEventListener('click', async (e) => {
          const trId = parseInt(e.target.dataset.trId, 10);
          if (confirm(t('del.prompt'))) {
            try {
              await rpc('torrent-set', { ids: [tor.id], trackerRemove: [trId] });
              toast(t('toast.saved'));
              refresh();
            } catch (err) { toast(err.message, true); }
          }
        });
      });
    } else {
      $('tab-trackers').innerHTML = `
        <div class="files-actions-bar">
          <button id="btn-add-tracker" class="sos-btn sos-btn-sm">${t('det.addTracker')}</button>
        </div>
        <div class="empty-detail-hint">${t('det.noTrackers')}</div>
      `;
      $('btn-add-tracker').addEventListener('click', async () => {
        const url = prompt(t('tracker.addPrompt'));
        if (url && url.trim()) {
          try {
            await rpc('torrent-set', { ids: [tor.id], trackerAdd: [url.trim()] });
            toast(t('toast.saved'));
            refresh();
          } catch (err) { toast(err.message, true); }
        }
      });
    }

    // 5. Tab Pieces (Visual Piece Map!)
    renderPiecesTab(tor);

    // 6. Tab Stats
    renderStatsTab();
  }

  // Render Interactive Piece Map onto Canvas
  function renderPiecesTab(tor) {
    if (!tor.pieceCount || tor.pieceCount <= 0) {
      $('tab-pieces').innerHTML = `<div class="empty-detail-hint">${t('pieces.noMap')}</div>`;
      return;
    }

    const totalPieces = tor.pieceCount;
    let completedPieces = 0;
    let bitfield = null;

    if (tor.pieces) {
      try {
        const raw = atob(tor.pieces);
        bitfield = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bitfield[i] = raw.charCodeAt(i);
        for (let i = 0; i < totalPieces; i++) {
          const byteIdx = Math.floor(i / 8);
          const bitIdx = 7 - (i % 8);
          if (byteIdx < bitfield.length && ((bitfield[byteIdx] >> bitIdx) & 1)) {
            completedPieces++;
          }
        }
      } catch (e) {
        console.warn('Error decoding pieces bitfield:', e);
      }
    } else {
      completedPieces = Math.floor(totalPieces * (tor.percentDone || 0));
    }

    const pct = ((completedPieces / totalPieces) * 100).toFixed(1);
    const summary = t('pieces.summary', {
      count: totalPieces.toLocaleString(),
      size: fmtBytes(tor.pieceSize),
      done: completedPieces.toLocaleString(),
      pct: pct
    });

    $('tab-pieces').innerHTML = `
      <div class="pieces-container">
        <div class="pieces-summary-bar">${summary}</div>
        <div class="pieces-canvas-wrap">
          <canvas id="pieces-canvas"></canvas>
        </div>
      </div>
    `;

    // Draw on Canvas
    const canvas = $('pieces-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const wrap = canvas.parentElement;
    canvas.width = wrap.clientWidth;
    canvas.height = wrap.clientHeight;

    const blockSize = 6;
    const gap = 1;
    const step = blockSize + gap;
    const cols = Math.floor(canvas.width / step);
    const rows = Math.ceil(totalPieces / cols);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < totalPieces; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * step;
      const y = row * step;
      if (y + blockSize > canvas.height) break;

      let isDone = false;
      if (bitfield) {
        const byteIdx = Math.floor(i / 8);
        const bitIdx = 7 - (i % 8);
        isDone = byteIdx < bitfield.length && ((bitfield[byteIdx] >> bitIdx) & 1);
      } else {
        isDone = i < completedPieces;
      }

      ctx.fillStyle = isDone ? '#3a7bd5' : 'rgba(255, 255, 255, 0.08)';
      ctx.fillRect(x, y, blockSize, blockSize);
    }
  }

  // Render Stats Tab
  async function renderStatsTab() {
    try {
      if (!serverStats) serverStats = await rpc('session-stats');
      const cur = serverStats['current-stats'] || {};
      const cum = serverStats['cumulative-stats'] || {};
      const curRatio = cur.downloadedBytes > 0 ? (cur.uploadedBytes / cur.downloadedBytes).toFixed(2) : '–';
      const cumRatio = cum.downloadedBytes > 0 ? (cum.uploadedBytes / cum.downloadedBytes).toFixed(2) : '–';

      $('tab-stats').innerHTML = `
        <div class="det-grid">
          <div class="det-card">
            <h4>${t('stats.currentSession')}</h4>
            <div class="det-row"><span class="det-label">${t('stats.downloaded')}</span><span class="det-val">${fmtBytes(cur.downloadedBytes)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.uploaded')}</span><span class="det-val">${fmtBytes(cur.uploadedBytes)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.ratio')}</span><span class="det-val">${curRatio}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.duration')}</span><span class="det-val">${fmtDuration(cur.secondsActive)}</span></div>
          </div>
          <div class="det-card">
            <h4>${t('stats.cumulative')}</h4>
            <div class="det-row"><span class="det-label">${t('stats.downloaded')}</span><span class="det-val">${fmtBytes(cum.downloadedBytes)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.uploaded')}</span><span class="det-val">${fmtBytes(cum.uploadedBytes)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.ratio')}</span><span class="det-val">${cumRatio}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.duration')}</span><span class="det-val">${fmtDuration(cum.secondsActive)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.torrentsAdded')}</span><span class="det-val">${cum.filesAdded || 0}</span></div>
          </div>
        </div>
      `;
    } catch (e) {
      $('tab-stats').innerHTML = `<div class="empty-detail-hint">${e.message}</div>`;
    }
  }

  // Row Selection & Events
  $('torrent-rows').addEventListener('click', (e) => {
    const row = e.target.closest('.torrent-row');
    if (!row) return;
    const id = parseInt(row.dataset.id, 10);

    if (e.target.classList.contains('row-chk')) {
      if (e.target.checked) selectedIds.add(id);
      else selectedIds.delete(id);
    } else {
      if (e.ctrlKey || e.metaKey) {
        if (selectedIds.has(id)) selectedIds.delete(id);
        else selectedIds.add(id);
      } else if (e.shiftKey && selectedIds.size > 0) {
        const filtered = getFilteredTorrents();
        const lastId = Array.from(selectedIds)[selectedIds.size - 1];
        const idx1 = filtered.findIndex((x) => x.id === lastId);
        const idx2 = filtered.findIndex((x) => x.id === id);
        if (idx1 >= 0 && idx2 >= 0) {
          const start = Math.min(idx1, idx2);
          const end = Math.max(idx1, idx2);
          for (let i = start; i <= end; i++) selectedIds.add(filtered[i].id);
        }
      } else {
        selectedIds.clear();
        selectedIds.add(id);
      }
    }
    renderTorrents();
    renderDetails();
  });

  // Double Click opens properties
  $('torrent-rows').addEventListener('dblclick', (e) => {
    const row = e.target.closest('.torrent-row');
    if (!row) return;
    openPropsModal();
  });

  // Table Sort Header Click
  document.querySelectorAll('.torrent-table th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const field = th.dataset.sort;
      if (sortField === field) {
        sortAsc = !sortAsc;
      } else {
        sortField = field;
        sortAsc = true;
      }
      renderTorrents();
    });
  });

  $('select-all').addEventListener('change', (e) => {
    const filtered = getFilteredTorrents();
    if (e.target.checked) filtered.forEach((t) => selectedIds.add(t.id));
    else selectedIds.clear();
    renderTorrents();
    renderDetails();
  });

  // Search filter
  $('search-input').addEventListener('input', () => {
    renderTorrents();
    renderSidebar();
  });

  // Sidebar Filter Selection
  $('sidebar').addEventListener('click', (e) => {
    const item = e.target.closest('.sidebar-item');
    if (!item) return;

    document.querySelectorAll('.sidebar-item').forEach((el) => el.classList.remove('active'));
    item.classList.add('active');

    if (item.dataset.filter) {
      activeFilter = { type: 'status', val: item.dataset.filter };
    } else if (item.dataset.tracker) {
      activeFilter = { type: 'tracker', val: item.dataset.tracker };
    } else if (item.dataset.dir) {
      activeFilter = { type: 'dir', val: item.dataset.dir };
    }

    renderTorrents();
    renderDetails();
  });

  // Toggle Sidebar
  $('btn-toggle-sidebar').addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    $('sidebar').classList.toggle('collapsed', sidebarCollapsed);
    $('sidebar-resizer').style.display = sidebarCollapsed ? 'none' : 'block';
  });

  // Details Drawer Tabs
  document.querySelectorAll('.d-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.d-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      activeDetailTab = btn.dataset.tab;
      $(`tab-${activeDetailTab}`).classList.add('active');
      renderDetails();
    });
  });

  $('btn-close-drawer').addEventListener('click', () => {
    $('details-drawer').style.display = 'none';
    $('pane-resizer').style.display = 'none';
  });

  // Action Buttons
  $('btn-start').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('torrent-start', { ids: Array.from(selectedIds) });
      toast(t('toast.started'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  $('btn-force').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('torrent-start-now', { ids: Array.from(selectedIds) });
      toast(t('toast.forceStarted'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  $('btn-pause').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('torrent-stop', { ids: Array.from(selectedIds) });
      toast(t('toast.paused'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  $('btn-verify').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('torrent-verify', { ids: Array.from(selectedIds) });
      toast(t('toast.verified'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  $('btn-reannounce').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('torrent-reannounce', { ids: Array.from(selectedIds) });
      toast(t('toast.reannounced'));
    } catch (e) { toast(e.message, true); }
  });

  $('btn-queue-up').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('queue-move-up', { ids: Array.from(selectedIds) });
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  $('btn-queue-down').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('queue-move-down', { ids: Array.from(selectedIds) });
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  $('btn-remove').addEventListener('click', () => {
    if (!selectedIds.size) return;
    $('modal-delete').style.display = 'flex';
  });

  $('btn-turtle').addEventListener('click', async () => {
    if (!serverSession) return;
    const current = serverSession['alt-speed-enabled'];
    try {
      await rpc('session-set', { 'alt-speed-enabled': !current });
      toast(!current ? t('toast.turtleOn') : t('toast.turtleOff'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  $('btn-stats').addEventListener('click', async () => {
    $('modal-stats').style.display = 'flex';
    try {
      serverStats = await rpc('session-stats');
      const cur = serverStats['current-stats'] || {};
      const cum = serverStats['cumulative-stats'] || {};
      const curRatio = cur.downloadedBytes > 0 ? (cur.uploadedBytes / cur.downloadedBytes).toFixed(2) : '0.00';
      const cumRatio = cum.downloadedBytes > 0 ? (cum.uploadedBytes / cum.downloadedBytes).toFixed(2) : '0.00';

      $('stats-modal-body').innerHTML = `
        <div class="det-grid">
          <div class="det-card">
            <h4>${t('stats.currentSession')}</h4>
            <div class="det-row"><span class="det-label">${t('stats.downloaded')}</span><span class="det-val">${fmtBytes(cur.downloadedBytes)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.uploaded')}</span><span class="det-val">${fmtBytes(cur.uploadedBytes)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.ratio')}</span><span class="det-val">${curRatio}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.duration')}</span><span class="det-val">${fmtDuration(cur.secondsActive)}</span></div>
          </div>
          <div class="det-card">
            <h4>${t('stats.cumulative')}</h4>
            <div class="det-row"><span class="det-label">${t('stats.downloaded')}</span><span class="det-val">${fmtBytes(cum.downloadedBytes)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.uploaded')}</span><span class="det-val">${fmtBytes(cum.uploadedBytes)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.ratio')}</span><span class="det-val">${cumRatio}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.duration')}</span><span class="det-val">${fmtDuration(cum.secondsActive)}</span></div>
            <div class="det-row"><span class="det-label">${t('stats.torrentsAdded')}</span><span class="det-val">${cum.filesAdded || 0}</span></div>
          </div>
        </div>
      `;
    } catch (e) {
      $('stats-modal-body').innerHTML = `<div class="empty-state">${e.message}</div>`;
    }
  });

  $('modal-stats-close').addEventListener('click', () => $('modal-stats').style.display = 'none');
  $('modal-stats-close-btn').addEventListener('click', () => $('modal-stats').style.display = 'none');

  // Context Menu Handling
  const ctxMenu = $('context-menu');

  window.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('.torrent-row');
    if (!row) {
      ctxMenu.style.display = 'none';
      return;
    }
    e.preventDefault();
    const id = parseInt(row.dataset.id, 10);
    if (!selectedIds.has(id)) {
      selectedIds.clear();
      selectedIds.add(id);
      renderTorrents();
      renderDetails();
    }

    let x = e.clientX;
    let y = e.clientY;
    ctxMenu.style.display = 'block';

    const rect = ctxMenu.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) x = window.innerWidth - rect.width - 8;
    if (y + rect.height > window.innerHeight) y = window.innerHeight - rect.height - 8;

    ctxMenu.style.left = `${x}px`;
    ctxMenu.style.top = `${y}px`;
  });

  window.addEventListener('click', (e) => {
    if (!ctxMenu.contains(e.target)) {
      ctxMenu.style.display = 'none';
    }
  });

  // Context Menu Action Handlers
  $('ctx-start').addEventListener('click', () => { $('btn-start').click(); ctxMenu.style.display = 'none'; });
  $('ctx-force').addEventListener('click', () => { $('btn-force').click(); ctxMenu.style.display = 'none'; });
  $('ctx-pause').addEventListener('click', () => { $('btn-pause').click(); ctxMenu.style.display = 'none'; });
  $('ctx-verify').addEventListener('click', () => { $('btn-verify').click(); ctxMenu.style.display = 'none'; });
  $('ctx-reannounce').addEventListener('click', () => { $('btn-reannounce').click(); ctxMenu.style.display = 'none'; });
  $('ctx-delete').addEventListener('click', () => { $('btn-remove').click(); ctxMenu.style.display = 'none'; });

  $('ctx-q-top').addEventListener('click', async () => {
    ctxMenu.style.display = 'none';
    try { await rpc('queue-move-top', { ids: Array.from(selectedIds) }); refresh(); } catch (e) { toast(e.message, true); }
  });
  $('ctx-q-up').addEventListener('click', () => { $('btn-queue-up').click(); ctxMenu.style.display = 'none'; });
  $('ctx-q-down').addEventListener('click', () => { $('btn-queue-down').click(); ctxMenu.style.display = 'none'; });
  $('ctx-q-bottom').addEventListener('click', async () => {
    ctxMenu.style.display = 'none';
    try { await rpc('queue-move-bottom', { ids: Array.from(selectedIds) }); refresh(); } catch (e) { toast(e.message, true); }
  });

  $('ctx-copy-magnet').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (!selectedIds.size) return;
    const tor = torrents.find((t) => t.id === Array.from(selectedIds)[0]);
    if (!tor) return;
    const magnet = `magnet:?xt=urn:btih:${tor.hashString}&dn=${encodeURIComponent(tor.name)}`;
    navigator.clipboard.writeText(magnet).then(() => toast(t('toast.copied'))).catch(() => toast(magnet));
  });

  $('ctx-copy-hash').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (!selectedIds.size) return;
    const tor = torrents.find((t) => t.id === Array.from(selectedIds)[0]);
    if (!tor) return;
    navigator.clipboard.writeText(tor.hashString).then(() => toast(t('toast.copied'))).catch(() => toast(tor.hashString));
  });

  // Modal: Set Location / Move Data
  $('ctx-location').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (!selectedIds.size) return;
    const tor = torrents.find((t) => t.id === Array.from(selectedIds)[0]);
    if (!tor) return;
    $('loc-new-path').value = tor.downloadDir || '';
    $('modal-location').style.display = 'flex';
  });

  $('modal-loc-close').addEventListener('click', () => $('modal-location').style.display = 'none');
  $('modal-loc-cancel').addEventListener('click', () => $('modal-location').style.display = 'none');
  $('btn-loc-browse').addEventListener('click', () => pickFolder($('loc-new-path')));

  $('modal-loc-submit').addEventListener('click', async () => {
    const newLocation = $('loc-new-path').value.trim();
    const moveData = $('loc-move-data').checked;
    if (!newLocation) return;
    try {
      await rpc('torrent-set-location', {
        ids: Array.from(selectedIds),
        location: newLocation,
        move: moveData
      });
      $('modal-location').style.display = 'none';
      toast(t('toast.moved'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  // Modal: Rename Torrent
  $('ctx-rename').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    if (!selectedIds.size) return;
    const tor = torrents.find((t) => t.id === Array.from(selectedIds)[0]);
    if (!tor) return;
    $('rename-input').value = tor.name;
    $('modal-rename').style.display = 'flex';
  });

  $('modal-rename-close').addEventListener('click', () => $('modal-rename').style.display = 'none');
  $('modal-rename-cancel').addEventListener('click', () => $('modal-rename').style.display = 'none');
  $('modal-rename-submit').addEventListener('click', async () => {
    const newName = $('rename-input').value.trim();
    if (!newName || !selectedIds.size) return;
    const tor = torrents.find((t) => t.id === Array.from(selectedIds)[0]);
    if (!tor) return;
    try {
      await rpc('torrent-rename-path', {
        ids: [tor.id],
        path: tor.name,
        name: newName
      });
      $('modal-rename').style.display = 'none';
      toast(t('toast.renamed'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  // Modal: Torrent Properties
  function openPropsModal() {
    if (!selectedIds.size) return;
    const tor = torrents.find((t) => t.id === Array.from(selectedIds)[0]);
    if (!tor) return;

    $('prop-prio').value = tor.bandwidthPriority != null ? tor.bandwidthPriority : 0;
    $('prop-max-peers').value = tor.maxConnectedPeers || 50;
    $('prop-limit-down-en').checked = !!tor.downloadLimited;
    $('prop-limit-down').value = tor.downloadLimit || 0;
    $('prop-limit-up-en').checked = !!tor.uploadLimited;
    $('prop-limit-up').value = tor.uploadLimit || 0;

    const mode = tor.seedRatioMode != null ? tor.seedRatioMode : 0;
    if (mode === 1) $('prop-ratio-m1').checked = true;
    else if (mode === 2) $('prop-ratio-m2').checked = true;
    else $('prop-ratio-m0').checked = true;

    $('prop-ratio-val').value = tor.seedRatioLimit || 2.0;

    $('modal-props').style.display = 'flex';
  }

  $('ctx-props').addEventListener('click', () => {
    ctxMenu.style.display = 'none';
    openPropsModal();
  });

  $('modal-props-close').addEventListener('click', () => $('modal-props').style.display = 'none');
  $('modal-props-cancel').addEventListener('click', () => $('modal-props').style.display = 'none');
  $('modal-props-submit').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    const prio = parseInt($('prop-prio').value, 10);
    const maxPeers = parseInt($('prop-max-peers').value, 10);
    const dlLimited = $('prop-limit-down-en').checked;
    const dlLimit = parseInt($('prop-limit-down').value, 10) || 0;
    const ulLimited = $('prop-limit-up-en').checked;
    const ulLimit = parseInt($('prop-limit-up').value, 10) || 0;

    let ratioMode = 0;
    if ($('prop-ratio-m1').checked) ratioMode = 1;
    else if ($('prop-ratio-m2').checked) ratioMode = 2;
    const ratioLimit = parseFloat($('prop-ratio-val').value) || 2.0;

    try {
      await rpc('torrent-set', {
        ids: Array.from(selectedIds),
        bandwidthPriority: prio,
        'peer-limit': maxPeers,
        downloadLimited: dlLimited,
        downloadLimit: dlLimit,
        uploadLimited: ulLimited,
        uploadLimit: ulLimit,
        seedRatioMode: ratioMode,
        seedRatioLimit: ratioLimit
      });
      $('modal-props').style.display = 'none';
      toast(t('toast.propsSaved'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  // Modal: Delete Torrent
  $('modal-del-close').addEventListener('click', () => $('modal-delete').style.display = 'none');
  $('modal-del-cancel').addEventListener('click', () => $('modal-delete').style.display = 'none');
  $('modal-del-submit').addEventListener('click', async () => {
    const deleteData = $('del-data-check').checked;
    try {
      await rpc('torrent-remove', { ids: Array.from(selectedIds), 'delete-local-data': deleteData });
      $('modal-delete').style.display = 'none';
      selectedIds.clear();
      toast(t('toast.deleted'));
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  // Modal: Add Torrent
  $('btn-add').addEventListener('click', () => {
    if (serverSession && serverSession['download-dir']) {
      $('torrent-dest').value = serverSession['download-dir'];
    }
    $('modal-add').style.display = 'flex';
  });
  $('modal-add-close').addEventListener('click', () => $('modal-add').style.display = 'none');
  $('modal-add-cancel').addEventListener('click', () => $('modal-add').style.display = 'none');

  $('mtab-link').addEventListener('click', () => {
    $('mtab-link').classList.add('active');
    $('mtab-file').classList.remove('active');
    $('mtab-box').classList.remove('active');
    $('mcontent-link').classList.add('active');
    $('mcontent-file').classList.remove('active');
    $('mcontent-box').classList.remove('active');
  });

  $('mtab-file').addEventListener('click', () => {
    $('mtab-file').classList.add('active');
    $('mtab-link').classList.remove('active');
    $('mtab-box').classList.remove('active');
    $('mcontent-file').classList.add('active');
    $('mcontent-link').classList.remove('active');
    $('mcontent-box').classList.remove('active');
  });

  $('mtab-box').addEventListener('click', () => {
    $('mtab-box').classList.add('active');
    $('mtab-link').classList.remove('active');
    $('mtab-file').classList.remove('active');
    $('mcontent-box').classList.add('active');
    $('mcontent-link').classList.remove('active');
    $('mcontent-file').classList.remove('active');
  });

  async function pickFolder(input) {
    if (!(window.ShareOS && ShareOS.fs && ShareOS.fs.pick)) {
      toast(t('toast.noFolderPicker'), true);
      return;
    }
    try {
      const picked = await ShareOS.fs.pick({ title: t('pick.destTitle'), folder: true });
      if (picked && picked.length) {
        input.value = picked[0].path ? picked[0].root + '/' + picked[0].path : picked[0].root;
      }
    } catch (e) { toast(e.message, true); }
  }

  $('btn-browse-dest').addEventListener('click', () => pickFolder($('torrent-dest')));
  $('btn-cfg-browse').addEventListener('click', () => pickFolder($('cfg-download-dir')));
  $('btn-cfg-incomplete-browse').addEventListener('click', () => pickFolder($('cfg-incomplete-dir')));

  // Local file upload
  $('torrent-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        pendingFileMetainfo = reader.result.split(',')[1];
        $('picked-local-name').textContent = t('pick.selected', { name: file.name });
      };
      reader.readAsDataURL(file);
    }
  });

  // Pick file on box
  $('btn-pick-box').addEventListener('click', async () => {
    if (window.ShareOS && ShareOS.fs && ShareOS.fs.pick) {
      try {
        const picked = await ShareOS.fs.pick({ title: t('pick.fileTitle'), ext: ['.torrent'] });
        if (picked && picked.length) {
          const item = picked[0];
          const fileRef = await ShareOS.fs.open(item.root, item.path, item.name);
          const blob = await fileRef.blob();
          const reader = new FileReader();
          reader.onload = () => {
            pendingFileMetainfo = reader.result.split(',')[1];
            $('picked-file-name').textContent = t('pick.selected', { name: item.name });
          };
          reader.readAsDataURL(blob);
        }
      } catch (e) { toast(e.message, true); }
    } else {
      toast(t('toast.noPicker'), true);
    }
  });

  $('modal-add-submit').addEventListener('click', async () => {
    const isLinkTab = $('mcontent-link').classList.contains('active');
    const isFileTab = $('mcontent-file').classList.contains('active');
    const downloadDir = $('torrent-dest').value.trim();
    const paused = !$('torrent-start-now').checked;
    const prio = parseInt($('torrent-prio').value, 10);

    const addArgs = { paused, bandwidthPriority: prio };
    if (downloadDir) addArgs['download-dir'] = downloadDir;

    if (isLinkTab) {
      const url = $('torrent-url').value.trim();
      if (!url) { toast(t('toast.needUrl'), true); return; }
      addArgs.filename = url;
    } else {
      if (!pendingFileMetainfo) { toast(t('toast.needFile'), true); return; }
      addArgs.metainfo = pendingFileMetainfo;
    }

    try {
      await rpc('torrent-add', addArgs);
      $('modal-add').style.display = 'none';
      $('torrent-url').value = '';
      $('torrent-file-input').value = '';
      pendingFileMetainfo = null;
      $('picked-file-name').textContent = '';
      $('picked-local-name').textContent = '';
      toast(t('toast.added'));
      refresh();
    } catch (e) {
      toast(t('toast.addError') + e.message, true);
    }
  });

  // Modal: Settings (transgui tabs)
  $('btn-settings').addEventListener('click', () => {
    if (!serverSession) return;
    $('cfg-download-dir').value = serverSession['download-dir'] || '';
    $('cfg-incomplete-enabled').checked = !!serverSession['incomplete-dir-enabled'];
    $('cfg-incomplete-dir').value = serverSession['incomplete-dir'] || '';
    $('cfg-start-added').checked = serverSession['start-added-torrents'] !== false;
    $('cfg-append-part').checked = serverSession['rename-partial-files'] !== false;

    $('cfg-speed-down-enabled').checked = !!serverSession['speed-limit-down-enabled'];
    $('cfg-speed-down').value = serverSession['speed-limit-down'] || 0;
    $('cfg-speed-up-enabled').checked = !!serverSession['speed-limit-up-enabled'];
    $('cfg-speed-up').value = serverSession['speed-limit-up'] || 0;
    $('cfg-alt-down').value = serverSession['alt-speed-down'] || 50;
    $('cfg-alt-up').value = serverSession['alt-speed-up'] || 50;

    $('cfg-peer-port').value = serverSession['peer-port'] || '';
    $('cfg-port-forward').checked = serverSession['port-forwarding-enabled'] !== false;
    $('cfg-random-port').checked = !!serverSession['peer-port-random-on-start'];
    $('cfg-max-peers-global').value = serverSession['peer-limit-global'] || 200;
    $('cfg-max-peers-torrent').value = serverSession['peer-limit-per-torrent'] || 50;
    $('cfg-encryption').value = serverSession['encryption'] || 'preferred';
    $('cfg-dht').checked = serverSession['dht-enabled'] !== false;
    $('cfg-pex').checked = serverSession['pex-enabled'] !== false;
    $('cfg-lpd').checked = !!serverSession['lpd-enabled'];

    $('cfg-dl-queue').value = serverSession['download-queue-size'] || 5;
    $('cfg-seed-queue').value = serverSession['seed-queue-size'] || 10;
    $('cfg-ratio-limited').checked = !!serverSession['seedRatioLimited'];
    $('cfg-ratio-limit').value = serverSession['seedRatioLimit'] || 2.0;

    $('port-test-result').textContent = '';
    $('port-test-result').className = 'port-result';

    $('modal-settings').style.display = 'flex';
  });

  // Settings Tabs
  document.querySelectorAll('.s-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.s-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.stab-content').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`stab-${btn.dataset.stab}`).classList.add('active');
    });
  });

  // Test Port button
  $('btn-test-port').addEventListener('click', async () => {
    const resEl = $('port-test-result');
    resEl.textContent = t('cfg.portTesting');
    resEl.className = 'port-result';
    try {
      const res = await rpc('port-test');
      if (res && res['port-is-open']) {
        resEl.textContent = t('cfg.portOpen');
        resEl.className = 'port-result ok';
      } else {
        resEl.textContent = t('cfg.portClosed');
        resEl.className = 'port-result err';
      }
    } catch (e) {
      resEl.textContent = e.message;
      resEl.className = 'port-result err';
    }
  });

  $('modal-cfg-close').addEventListener('click', () => $('modal-settings').style.display = 'none');
  $('modal-cfg-cancel').addEventListener('click', () => $('modal-settings').style.display = 'none');

  $('modal-cfg-submit').addEventListener('click', async () => {
    const setArgs = {
      'download-dir': $('cfg-download-dir').value.trim(),
      'incomplete-dir-enabled': $('cfg-incomplete-enabled').checked,
      'incomplete-dir': $('cfg-incomplete-dir').value.trim(),
      'start-added-torrents': $('cfg-start-added').checked,
      'rename-partial-files': $('cfg-append-part').checked,

      'speed-limit-down-enabled': $('cfg-speed-down-enabled').checked,
      'speed-limit-down': parseInt($('cfg-speed-down').value, 10) || 0,
      'speed-limit-up-enabled': $('cfg-speed-up-enabled').checked,
      'speed-limit-up': parseInt($('cfg-speed-up').value, 10) || 0,
      'alt-speed-down': parseInt($('cfg-alt-down').value, 10) || 50,
      'alt-speed-up': parseInt($('cfg-alt-up').value, 10) || 50,

      'peer-port': parseInt($('cfg-peer-port').value, 10) || 51413,
      'port-forwarding-enabled': $('cfg-port-forward').checked,
      'peer-port-random-on-start': $('cfg-random-port').checked,
      'peer-limit-global': parseInt($('cfg-max-peers-global').value, 10) || 200,
      'peer-limit-per-torrent': parseInt($('cfg-max-peers-torrent').value, 10) || 50,
      'encryption': $('cfg-encryption').value,
      'dht-enabled': $('cfg-dht').checked,
      'pex-enabled': $('cfg-pex').checked,
      'lpd-enabled': $('cfg-lpd').checked,

      'download-queue-size': parseInt($('cfg-dl-queue').value, 10) || 5,
      'seed-queue-size': parseInt($('cfg-seed-queue').value, 10) || 10,
      'seedRatioLimited': $('cfg-ratio-limited').checked,
      'seedRatioLimit': parseFloat($('cfg-ratio-limit').value) || 2.0
    };

    if (!setArgs['download-dir']) delete setArgs['download-dir'];
    if (!setArgs['incomplete-dir']) delete setArgs['incomplete-dir'];

    try {
      await rpc('session-set', setArgs);
      $('modal-settings').style.display = 'none';
      toast(t('toast.saved'));
      refresh();
    } catch (e) {
      toast(t('toast.saveError') + e.message, true);
    }
  });

  $('btn-retry').addEventListener('click', refresh);

  // Vertical Resizer (Sidebar)
  const sidebarResizer = $('sidebar-resizer');
  let isResizingSidebar = false;

  sidebarResizer.addEventListener('mousedown', (e) => {
    isResizingSidebar = true;
    document.body.style.cursor = 'col-resize';
  });

  // Horizontal Resizer (Details Panel)
  const paneResizer = $('pane-resizer');
  let isResizingDrawer = false;

  paneResizer.addEventListener('mousedown', (e) => {
    isResizingDrawer = true;
    document.body.style.cursor = 'row-resize';
  });

  window.addEventListener('mousemove', (e) => {
    if (isResizingSidebar) {
      const newWidth = Math.max(140, Math.min(450, e.clientX));
      $('sidebar').style.width = `${newWidth}px`;
    }
    if (isResizingDrawer) {
      const containerRect = $('center-pane').getBoundingClientRect();
      const newHeight = Math.max(80, Math.min(600, containerRect.bottom - e.clientY));
      $('details-drawer').style.height = `${newHeight}px`;
      if (activeDetailTab === 'pieces') {
        const tor = torrents.find((x) => selectedIds.has(x.id));
        if (tor) renderPiecesTab(tor);
      }
    }
  });

  window.addEventListener('mouseup', () => {
    if (isResizingSidebar || isResizingDrawer) {
      isResizingSidebar = false;
      isResizingDrawer = false;
      document.body.style.cursor = '';
    }
  });

  // ShareOS Menu Bar
  if (window.ShareOS && ShareOS.menu) {
    ShareOS.menu($('menu'), [
      {
        label: t('menu.torrent'),
        items: [
          { label: t('menu.add'), kbd: 'Ctrl+O', action: () => $('btn-add').click() },
          '-',
          { label: t('menu.pauseAll'), action: async () => { await rpc('torrent-stop'); refresh(); } },
          { label: t('menu.resumeAll'), action: async () => { await rpc('torrent-start'); refresh(); } },
          '-',
          { label: t('menu.close'), action: () => window.close() }
        ]
      },
      {
        label: t('menu.edit'),
        items: [
          { label: t('menu.start'), action: () => $('btn-start').click() },
          { label: t('tb.force'), action: () => $('btn-force').click() },
          { label: t('menu.pause'), action: () => $('btn-pause').click() },
          { label: t('menu.remove'), kbd: t('menu.removeKbd'), action: () => $('btn-remove').click() },
          '-',
          { label: t('menu.selectAll'), kbd: 'Ctrl+A', action: () => { torrents.forEach((x) => selectedIds.add(x.id)); renderTorrents(); renderDetails(); } }
        ]
      },
      {
        label: t('menu.view'),
        items: [
          { label: t('menu.refresh'), kbd: 'F5', action: refresh },
          { label: t('menu.sidebar'), action: () => $('btn-toggle-sidebar').click() },
          '-',
          { label: t('menu.light'), action: () => document.documentElement.setAttribute('data-theme', 'light') },
          { label: t('menu.dark'), action: () => document.documentElement.setAttribute('data-theme', 'dark') }
        ]
      },
      {
        label: t('menu.options'),
        items: [
          { label: t('menu.stats'), action: () => $('btn-stats').click() },
          { label: t('menu.settings'), action: () => $('btn-settings').click() }
        ]
      },
      {
        label: t('menu.help'),
        items: [
          { label: t('menu.about'), action: () => toast(t('toast.about')) }
        ]
      }
    ]);
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'o') { e.preventDefault(); $('btn-add').click(); }
    if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        torrents.forEach((t) => selectedIds.add(t.id));
        renderTorrents();
        renderDetails();
      }
    }
    if (e.key === 'Delete' && selectedIds.size > 0) {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        $('btn-remove').click();
      }
    }
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach((m) => m.style.display = 'none');
      ctxMenu.style.display = 'none';
    }
  });

  // Handle Opened File (when opened from ShareOS File Browser with a .torrent)
  async function checkOpenedFile() {
    if (window.ShareOS && ShareOS.file) {
      try {
        await ShareOS.file.info();
        const blob = await ShareOS.file.blob();
        const reader = new FileReader();
        reader.onload = async () => {
          const b64 = reader.result.split(',')[1];
          if (confirm(t('confirm.openFile', { name: ShareOS.file.name }))) {
            try {
              await rpc('torrent-add', { metainfo: b64 });
              toast(t('toast.addedName', { name: ShareOS.file.name }));
              refresh();
            } catch (err) {
              toast(t('toast.addError') + err.message, true);
            }
          }
        };
        reader.readAsDataURL(blob);
      } catch (e) {
        console.error('ShareOS file open error:', e);
      }
    }
  }

  // Init
  refresh();
  checkOpenedFile();
  refreshTimer = setInterval(refresh, 2000);
})();
