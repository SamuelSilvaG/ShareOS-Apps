// Transmission ShareOS Web Client
// Remote control for the account's own transmission-daemon (system app
// "transmission-daemon"); ShareOS.torrent.rpc() goes through the box's proxy
// /_shareos/cgi/transmission (permissions "files" + "torrent", ShareOS
// 0.2.0-beta.4+). Folders are "<root>/<path>" like ShareOS.fs.
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);

  // State
  const TOR = window.ShareOS && ShareOS.torrent;
  let lastError = '';
  let torrents = [];
  let selectedIds = new Set();
  let sessionStats = null;
  let serverSession = null;
  let refreshTimer = null;
  let isConnected = false;
  let pendingFileMetainfo = null;

  // Status mapping
  const STATUS_KEYS = {
    0: 'paused',
    1: 'checking',
    2: 'checking',
    3: 'downloading',
    4: 'downloading',
    5: 'seeding',
    6: 'seeding'
  };

  function statusInfo(status) {
    if (!(status in STATUS_KEYS)) return { key: 'unknown', text: t('status.unknown') };
    return { key: STATUS_KEYS[status], text: t(`status.${status}`) };
  }

  function fmtBytes(bytes) {
    if (bytes == null || isNaN(bytes)) return '0 B';
    if (bytes === 0) return '0 B';
    const k = 1024, dm = 2;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
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

  function toast(msg, isError = false) {
    const c = $('toast-container');
    const t = document.createElement('div');
    t.className = 'toast' + (isError ? ' error' : '');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 250);
    }, 3200);
  }

  // JSON-RPC through ShareOS (the box starts the account's daemon on the first call)
  async function rpc(method, args = {}) {
    if (!TOR) throw new Error(t('err.noShareOS'));
    return TOR.rpc(method, args);
  }

  // "<root>/<path>" for display: the personal folder is "home"
  function boxPath(p) {
    if (!p) return '–';
    return p.replace(/^home(\/|$)/, t('path.home') + '$1');
  }

  // Refresh Torrent list and server state
  async function refresh() {
    try {
      const [torrentData, sessionData] = await Promise.all([
        rpc('torrent-get', {
          fields: [
            'id', 'name', 'status', 'totalSize', 'percentDone', 'rateDownload',
            'rateUpload', 'eta', 'errorString', 'downloadDir', 'uploadRatio',
            'peersConnected', 'peersSendingToUs', 'peersGettingFromUs', 'files',
            'fileStats', 'trackers', 'peers', 'hashString', 'dateCreated', 'addedDate'
          ]
        }),
        rpc('session-get')
      ]);

      torrents = torrentData.torrents || [];
      serverSession = sessionData;
      setConnected(true);
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
      $('torrent-rows').innerHTML = '';
      const tr = document.createElement('tr'), td = document.createElement('td');
      td.colSpan = 8; td.className = 'empty-state'; td.textContent = why;
      tr.appendChild(td); $('torrent-rows').appendChild(tr);
    }
  }

  function renderTorrents() {
    const tbody = $('torrent-rows');
    const filter = $('filter-status').value;
    const query = $('search-input').value.trim().toLowerCase();

    let filtered = torrents.filter((t) => {
      if (query && !t.name.toLowerCase().includes(query)) return false;
      if (filter === 'all') return true;
      if (filter === 'downloading') return t.status === 3 || t.status === 4;
      if (filter === 'seeding') return t.status === 5 || t.status === 6;
      if (filter === 'paused') return t.status === 0;
      if (filter === 'active') return t.rateDownload > 0 || t.rateUpload > 0;
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${torrents.length === 0 ? t('list.empty') : t('list.nomatch')}</td></tr>`;
      updateActionButtons();
      return;
    }

    tbody.innerHTML = filtered.map((t) => {
      const isSel = selectedIds.has(t.id);
      const pct = (t.percentDone * 100).toFixed(1);
      const st = statusInfo(t.status);
      const isSeed = t.status === 5 || t.status === 6;
      const isPaused = t.status === 0;
      const pbarCls = isSeed ? 'seeding' : (isPaused ? 'paused' : '');

      return `
        <tr class="torrent-row ${isSel ? 'selected' : ''}" data-id="${t.id}">
          <td class="td-sel"><input type="checkbox" class="row-chk" data-id="${t.id}" ${isSel ? 'checked' : ''}></td>
          <td class="td-status"><span class="status-badge ${st.key}">${st.text}</span></td>
          <td class="td-name"><strong>${escapeHtml(t.name)}</strong></td>
          <td class="td-progress">
            <div class="pbar-wrap"><div class="pbar-fill ${pbarCls}" style="width:${pct}%"></div></div>
            <div class="pbar-text">${pct}% • Ratio: ${t.uploadRatio.toFixed(2)}</div>
          </td>
          <td class="td-size">${fmtBytes(t.totalSize)}</td>
          <td class="td-rates">↓ ${fmtRate(t.rateDownload)}<br>↑ ${fmtRate(t.rateUpload)}</td>
          <td class="td-eta">${fmtEta(t.eta)}</td>
          <td class="td-peers">${t.peersSendingToUs + t.peersGettingFromUs} / ${t.peersConnected}</td>
        </tr>
      `;
    }).join('');

    updateActionButtons();
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updateActionButtons() {
    const hasSel = selectedIds.size > 0;
    $('btn-start').disabled = !hasSel;
    $('btn-pause').disabled = !hasSel;
    $('btn-remove').disabled = !hasSel;
  }

  function updateStatusbar() {
    $('sb-count').textContent = t('sb.torrents', { n: torrents.length });
    let totalDown = 0, totalUp = 0;
    torrents.forEach((t) => { totalDown += t.rateDownload; totalUp += t.rateUpload; });
    $('sb-rates').textContent = `↓ ${fmtRate(totalDown)}   ↑ ${fmtRate(totalUp)}`;

    if (serverSession) {
      const isTurtle = serverSession['alt-speed-enabled'];
      $('sb-turtle-status').style.display = isTurtle ? 'inline' : 'none';
      $('sb-turtle-sep').style.display = isTurtle ? 'inline' : 'none';
      $('btn-turtle').classList.toggle('sos-btn-accent', !!isTurtle);
    }
  }

  function renderDetails() {
    const drawer = $('details-drawer');
    if (selectedIds.size !== 1) {
      drawer.style.display = 'none';
      return;
    }
    const id = Array.from(selectedIds)[0];
    const tor = torrents.find((x) => x.id === id);
    if (!tor) { drawer.style.display = 'none'; return; }

    drawer.style.display = 'flex';

    // Tab General
    $('tab-general').innerHTML = `
      <div class="grid-2">
        <div>
          <div><strong>${t('det.location')}</strong> ${escapeHtml(boxPath(tor.downloadDir))}</div>
          <div><strong>${t('det.totalSize')}</strong> ${fmtBytes(tor.totalSize)}</div>
          <div><strong>${t('det.hash')}</strong> <code>${tor.hashString}</code></div>
        </div>
        <div>
          <div><strong>${t('det.status')}</strong> ${statusInfo(tor.status).text}</div>
          <div><strong>${t('det.dlRate')}</strong> ↓ ${fmtRate(tor.rateDownload)}</div>
          <div><strong>${t('det.ulRate')}</strong> ↑ ${fmtRate(tor.rateUpload)}</div>
          <div><strong>${t('det.ratio')}</strong> ${tor.uploadRatio.toFixed(2)}</div>
        </div>
      </div>
    `;

    // Tab Files
    if (tor.files && tor.files.length) {
      $('tab-files').innerHTML = `
        <table class="torrent-table" style="font-size:11px;">
          <thead><tr><th>${t('det.file')}</th><th style="width:100px;">${t('det.size')}</th><th style="width:100px;">${t('det.progress')}</th></tr></thead>
          <tbody>
            ${tor.files.map((f) => `
              <tr>
                <td>${escapeHtml(f.name)}</td>
                <td>${fmtBytes(f.length)}</td>
                <td>${((f.bytesCompleted / (f.length || 1)) * 100).toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      $('tab-files').innerHTML = `<div style="color:var(--sos-muted)">${t('det.noFiles')}</div>`;
    }

    // Tab Peers
    if (tor.peers && tor.peers.length) {
      $('tab-peers').innerHTML = `
        <table class="torrent-table" style="font-size:11px;">
          <thead><tr><th>${t('det.ip')}</th><th>${t('det.client')}</th><th>Download</th><th>Upload</th></tr></thead>
          <tbody>
            ${tor.peers.map((p) => `
              <tr>
                <td>${escapeHtml(p.address)}</td>
                <td>${escapeHtml(p.clientName || '–')}</td>
                <td>${fmtRate(p.rateToClient)}</td>
                <td>${fmtRate(p.rateToPeer)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      $('tab-peers').innerHTML = `<div style="color:var(--sos-muted)">${t('det.noPeers')}</div>`;
    }

    // Tab Trackers
    if (tor.trackers && tor.trackers.length) {
      $('tab-trackers').innerHTML = `
        <ul>
          ${tor.trackers.map((tr) => `<li>${escapeHtml(tr.announce)}</li>`).join('')}
        </ul>
      `;
    } else {
      $('tab-trackers').innerHTML = `<div style="color:var(--sos-muted)">${t('det.noTrackers')}</div>`;
    }
  }

  // Row Selection & Click Events
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
      } else {
        selectedIds.clear();
        selectedIds.add(id);
      }
    }
    renderTorrents();
    renderDetails();
  });

  $('select-all').addEventListener('change', (e) => {
    if (e.target.checked) torrents.forEach((t) => selectedIds.add(t.id));
    else selectedIds.clear();
    renderTorrents();
    renderDetails();
  });

  $('filter-status').addEventListener('change', renderTorrents);
  $('search-input').addEventListener('input', renderTorrents);

  // Drawer Tabs
  document.querySelectorAll('.d-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.d-tab').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      $(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });
  $('btn-close-drawer').addEventListener('click', () => {
    selectedIds.clear();
    renderTorrents();
    renderDetails();
  });

  // Actions: Start, Pause, Remove
  $('btn-start').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('torrent-start', { ids: Array.from(selectedIds) });
      toast(t('toast.started'));
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

  $('btn-remove').addEventListener('click', () => {
    if (!selectedIds.size) return;
    $('modal-delete').style.display = 'flex';
  });

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

  // Turtle Mode Toggle
  $('btn-turtle').addEventListener('click', async () => {
    if (!serverSession) return;
    const current = serverSession['alt-speed-enabled'];
    try {
      await rpc('session-set', { 'alt-speed-enabled': !current });
      toast(!current ? t('toast.turtleOn') : t('toast.turtleOff'));
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
    $('mcontent-link').classList.add('active');
    $('mcontent-file').classList.remove('active');
  });

  $('mtab-file').addEventListener('click', () => {
    $('mtab-file').classList.add('active');
    $('mtab-link').classList.remove('active');
    $('mcontent-file').classList.add('active');
    $('mcontent-link').classList.remove('active');
  });

  // choose a download folder of the box ("<root>/<path>")
  async function pickFolder(input) {
    if (!(window.ShareOS && ShareOS.fs && ShareOS.fs.pick)) { toast(t('toast.noFolderPicker'), true); return; }
    try {
      const picked = await ShareOS.fs.pick({ title: t('pick.destTitle'), folder: true });
      if (picked && picked.length) input.value = picked[0].path ? picked[0].root + '/' + picked[0].path : picked[0].root;
    } catch (e) { toast(e.message, true); }
  }
  $('btn-browse-dest').addEventListener('click', () => pickFolder($('torrent-dest')));
  $('btn-cfg-browse').addEventListener('click', () => pickFolder($('cfg-download-dir')));

  // Pick file on box using ShareOS.fs.pick
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

  $('torrent-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        pendingFileMetainfo = reader.result.split(',')[1];
        $('picked-file-name').textContent = t('pick.selected', { name: file.name });
      };
      reader.readAsDataURL(file);
    }
  });

  $('modal-add-submit').addEventListener('click', async () => {
    const isLinkTab = $('mcontent-link').classList.contains('active');
    const downloadDir = $('torrent-dest').value.trim();
    const paused = !$('torrent-start-now').checked;
    const addArgs = { paused };
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
      toast(t('toast.added'));
      refresh();
    } catch (e) {
      toast(t('toast.addError') + e.message, true);
    }
  });

  // Modal: Settings
  $('btn-settings').addEventListener('click', () => {
    if (!serverSession) return;
    $('cfg-download-dir').value = serverSession['download-dir'] || '';
    $('cfg-speed-down-enabled').checked = !!serverSession['speed-limit-down-enabled'];
    $('cfg-speed-down').value = serverSession['speed-limit-down'] || 0;
    $('cfg-speed-up-enabled').checked = !!serverSession['speed-limit-up-enabled'];
    $('cfg-speed-up').value = serverSession['speed-limit-up'] || 0;
    $('cfg-alt-down').value = serverSession['alt-speed-down'] || 50;
    $('cfg-alt-up').value = serverSession['alt-speed-up'] || 50;
    $('cfg-peer-port').value = serverSession['peer-port'] || '';
    $('modal-settings').style.display = 'flex';
  });

  $('modal-cfg-close').addEventListener('click', () => $('modal-settings').style.display = 'none');
  $('modal-cfg-cancel').addEventListener('click', () => $('modal-settings').style.display = 'none');

  $('modal-cfg-submit').addEventListener('click', async () => {
    const setArgs = {
      'download-dir': $('cfg-download-dir').value.trim(),
      'speed-limit-down-enabled': $('cfg-speed-down-enabled').checked,
      'speed-limit-down': parseInt($('cfg-speed-down').value, 10) || 0,
      'speed-limit-up-enabled': $('cfg-speed-up-enabled').checked,
      'speed-limit-up': parseInt($('cfg-speed-up').value, 10) || 0,
      'alt-speed-down': parseInt($('cfg-alt-down').value, 10) || 50,
      'alt-speed-up': parseInt($('cfg-alt-up').value, 10) || 50
    };
    if (!setArgs['download-dir']) delete setArgs['download-dir'];

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

  // ShareOS Menu Bar
  // Language switch: persist choice and reload so menu + all views are rebuilt
  function switchLang(code) {
    if (!window.I18N || I18N.lang === code) return;
    I18N.setLang(code);
    location.reload();
  }

  if (window.ShareOS && ShareOS.menu) {
    const langItems = window.I18N
      ? I18N.supported.map((code) => ({
          label: (I18N.lang === code ? '✓ ' : '   ') + I18N.names[code],
          action: () => switchLang(code)
        }))
      : [];

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
          { label: t('menu.pause'), action: () => $('btn-pause').click() },
          { label: t('menu.remove'), kbd: t('menu.removeKbd'), action: () => $('btn-remove').click() },
          '-',
          { label: t('menu.selectAll'), kbd: 'Ctrl+A', action: () => { torrents.forEach((x) => selectedIds.add(x.id)); renderTorrents(); } }
        ]
      },
      {
        label: t('menu.view'),
        items: [
          { label: t('menu.refresh'), kbd: 'F5', action: refresh },
          '-',
          { label: t('menu.light'), action: () => document.documentElement.setAttribute('data-theme', 'light') },
          { label: t('menu.dark'), action: () => document.documentElement.setAttribute('data-theme', 'dark') }
        ]
      },
      {
        label: t('menu.language'),
        items: langItems
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
      }
    }
    if (e.key === 'Delete' && selectedIds.size > 0) {
      if (!['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) {
        e.preventDefault();
        $('btn-remove').click();
      }
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
