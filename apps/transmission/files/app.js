// Transmission ShareOS Web Client
// Communicates with transmission-daemon via JSON-RPC
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);

  // State
  let rpcUrl = localStorage.getItem('transmission_rpc_url') || '/_shareos/cgi/transmission';
  let sessionId = '';
  let torrents = [];
  let selectedIds = new Set();
  let sessionStats = null;
  let serverSession = null;
  let refreshTimer = null;
  let isConnected = false;
  let pendingFileMetainfo = null;

  // Status mapping
  const STATUS_LABELS = {
    0: { key: 'paused', text: 'Angehalten' },
    1: { key: 'checking', text: 'Wartet auf Prüfung' },
    2: { key: 'checking', text: 'Prüft Daten...' },
    3: { key: 'downloading', text: 'Wartet auf DL' },
    4: { key: 'downloading', text: 'Lädt herunter' },
    5: { key: 'seeding', text: 'Wartet auf Seed' },
    6: { key: 'seeding', text: 'Verteilt (Seeding)' }
  };

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
    if (seconds === 0) return 'Fertig';
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

  // JSON-RPC Transport
  async function rpc(method, args = {}) {
    const payload = JSON.stringify({ method, arguments: args, tag: Date.now() });
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers['X-Transmission-Session-Id'] = sessionId;

    let res;
    try {
      res = await fetch(rpcUrl, { method: 'POST', headers, body: payload });
    } catch (err) {
      // If default cgi proxy fails, try direct :9091 port fallback
      if (rpcUrl.includes('_shareos/cgi')) {
        const directUrl = `http://${location.hostname || '127.0.0.1'}:9091/transmission/rpc`;
        try {
          res = await fetch(directUrl, { method: 'POST', headers, body: payload });
          rpcUrl = directUrl;
        } catch {
          throw err;
        }
      } else {
        throw err;
      }
    }

    // Transmission CSRF session token negotiation (409 Conflict)
    if (res.status === 409) {
      const token = res.headers.get('X-Transmission-Session-Id');
      if (token) {
        sessionId = token;
        return rpc(method, args);
      }
    }

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.result !== 'success') {
      throw new Error(data.result || 'Transmission RPC Fehler');
    }
    return data.arguments;
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
      setConnected(false);
    }
  }

  function setConnected(online) {
    isConnected = online;
    const badge = $('conn-badge');
    const banner = $('offline-banner');
    if (online) {
      badge.textContent = '● Verbunden';
      badge.className = 'conn-badge online';
      banner.style.display = 'none';
    } else {
      badge.textContent = '○ Nicht erreichbar';
      badge.className = 'conn-badge offline';
      banner.style.display = 'flex';
      $('torrent-rows').innerHTML = `<tr><td colspan="8" class="empty-state">Transmission-Daemon antwortet nicht. Prüfen Sie den Dienst in ShareOS.</td></tr>`;
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
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">${torrents.length === 0 ? 'Keine Torrents vorhanden. Klicken Sie auf „+ Torrent“ um einen Download zu starten.' : 'Keine Treffer für den aktuellen Filter.'}</td></tr>`;
      updateActionButtons();
      return;
    }

    tbody.innerHTML = filtered.map((t) => {
      const isSel = selectedIds.has(t.id);
      const pct = (t.percentDone * 100).toFixed(1);
      const st = STATUS_LABELS[t.status] || { key: 'unknown', text: 'Unbekannt' };
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
    $('sb-count').textContent = `${torrents.length} Torrents`;
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
    const t = torrents.find((x) => x.id === id);
    if (!t) { drawer.style.display = 'none'; return; }

    drawer.style.display = 'flex';

    // Tab General
    $('tab-general').innerHTML = `
      <div class="grid-2">
        <div>
          <div><strong>Speicherort:</strong> ${escapeHtml(t.downloadDir)}</div>
          <div><strong>Gesamtgröße:</strong> ${fmtBytes(t.totalSize)}</div>
          <div><strong>Hash:</strong> <code>${t.hashString}</code></div>
        </div>
        <div>
          <div><strong>Status:</strong> ${STATUS_LABELS[t.status]?.text || ''}</div>
          <div><strong>Download-Rate:</strong> ↓ ${fmtRate(t.rateDownload)}</div>
          <div><strong>Upload-Rate:</strong> ↑ ${fmtRate(t.rateUpload)}</div>
          <div><strong>Upload-Verhältnis:</strong> ${t.uploadRatio.toFixed(2)}</div>
        </div>
      </div>
    `;

    // Tab Files
    if (t.files && t.files.length) {
      $('tab-files').innerHTML = `
        <table class="torrent-table" style="font-size:11px;">
          <thead><tr><th>Datei</th><th style="width:100px;">Größe</th><th style="width:100px;">Fortschritt</th></tr></thead>
          <tbody>
            ${t.files.map((f) => `
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
      $('tab-files').innerHTML = '<div style="color:var(--sos-muted)">Keine Dateiinformationen vorhanden.</div>';
    }

    // Tab Peers
    if (t.peers && t.peers.length) {
      $('tab-peers').innerHTML = `
        <table class="torrent-table" style="font-size:11px;">
          <thead><tr><th>IP / Host</th><th>Client</th><th>Download</th><th>Upload</th></tr></thead>
          <tbody>
            ${t.peers.map((p) => `
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
      $('tab-peers').innerHTML = '<div style="color:var(--sos-muted)">Keine Peers verbunden.</div>';
    }

    // Tab Trackers
    if (t.trackers && t.trackers.length) {
      $('tab-trackers').innerHTML = `
        <ul>
          ${t.trackers.map((tr) => `<li>${escapeHtml(tr.announce)}</li>`).join('')}
        </ul>
      `;
    } else {
      $('tab-trackers').innerHTML = '<div style="color:var(--sos-muted)">Keine Tracker eingetragen.</div>';
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
      toast('Torrents gestartet');
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  $('btn-pause').addEventListener('click', async () => {
    if (!selectedIds.size) return;
    try {
      await rpc('torrent-stop', { ids: Array.from(selectedIds) });
      toast('Torrents angehalten');
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
      toast('Torrent(s) erfolgreich gelöscht');
      refresh();
    } catch (e) { toast(e.message, true); }
  });

  // Turtle Mode Toggle
  $('btn-turtle').addEventListener('click', async () => {
    if (!serverSession) return;
    const current = serverSession['alt-speed-enabled'];
    try {
      await rpc('session-set', { 'alt-speed-enabled': !current });
      toast(!current ? 'Drosselung (Turtle) aktiviert' : 'Drosselung deaktiviert');
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

  // Browse destination using ShareOS.fs.pick if available
  $('btn-browse-dest').addEventListener('click', async () => {
    if (window.ShareOS && ShareOS.fs && ShareOS.fs.pick) {
      try {
        const picked = await ShareOS.fs.pick({ title: 'Zielordner für Downloads auswählen', save: true });
        if (picked && picked.path) {
          $('torrent-dest').value = `/mnt/${picked.root}/${picked.path}`.replace(/\/+/g, '/');
        }
      } catch (e) { console.error(e); }
    }
  });

  // Pick file on box using ShareOS.fs.pick
  $('btn-pick-box').addEventListener('click', async () => {
    if (window.ShareOS && ShareOS.fs && ShareOS.fs.pick) {
      try {
        const picked = await ShareOS.fs.pick({ title: '.torrent-Datei auswählen', ext: ['.torrent'] });
        if (picked && picked.length) {
          const item = picked[0];
          const fileRef = await ShareOS.fs.open(item.root, item.path, item.name);
          const blob = await fileRef.blob();
          const reader = new FileReader();
          reader.onload = () => {
            pendingFileMetainfo = reader.result.split(',')[1];
            $('picked-file-name').textContent = `Ausgewählt: ${item.name}`;
          };
          reader.readAsDataURL(blob);
        }
      } catch (e) { toast(e.message, true); }
    } else {
      toast('Dateiauswahl über ShareOS nicht verfügbar', true);
    }
  });

  $('torrent-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        pendingFileMetainfo = reader.result.split(',')[1];
        $('picked-file-name').textContent = `Ausgewählt: ${file.name}`;
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
      if (!url) { toast('Bitte geben Sie einen Magnet-Link oder eine URL ein', true); return; }
      addArgs.filename = url;
    } else {
      if (!pendingFileMetainfo) { toast('Bitte wählen Sie eine .torrent-Datei aus', true); return; }
      addArgs.metainfo = pendingFileMetainfo;
    }

    try {
      await rpc('torrent-add', addArgs);
      $('modal-add').style.display = 'none';
      $('torrent-url').value = '';
      $('torrent-file-input').value = '';
      pendingFileMetainfo = null;
      $('picked-file-name').textContent = '';
      toast('Torrent hinzugefügt');
      refresh();
    } catch (e) {
      toast('Fehler beim Hinzufügen: ' + e.message, true);
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
    $('cfg-peer-port').value = serverSession['peer-port'] || 51413;
    $('cfg-rpc-url').value = rpcUrl;
    $('modal-settings').style.display = 'flex';
  });

  $('btn-cfg-conn').addEventListener('click', () => $('btn-settings').click());
  $('modal-cfg-close').addEventListener('click', () => $('modal-settings').style.display = 'none');
  $('modal-cfg-cancel').addEventListener('click', () => $('modal-settings').style.display = 'none');

  $('modal-cfg-submit').addEventListener('click', async () => {
    const newRpc = $('cfg-rpc-url').value.trim();
    if (newRpc) {
      rpcUrl = newRpc;
      localStorage.setItem('transmission_rpc_url', rpcUrl);
    }

    const setArgs = {
      'download-dir': $('cfg-download-dir').value.trim(),
      'speed-limit-down-enabled': $('cfg-speed-down-enabled').checked,
      'speed-limit-down': parseInt($('cfg-speed-down').value, 10) || 0,
      'speed-limit-up-enabled': $('cfg-speed-up-enabled').checked,
      'speed-limit-up': parseInt($('cfg-speed-up').value, 10) || 0,
      'alt-speed-down': parseInt($('cfg-alt-down').value, 10) || 50,
      'alt-speed-up': parseInt($('cfg-alt-up').value, 10) || 50,
      'peer-port': parseInt($('cfg-peer-port').value, 10) || 51413
    };

    try {
      await rpc('session-set', setArgs);
      $('modal-settings').style.display = 'none';
      toast('Einstellungen gespeichert');
      refresh();
    } catch (e) {
      toast('Fehler beim Speichern: ' + e.message, true);
    }
  });

  // Native UI Link
  const host = location.hostname || '127.0.0.1';
  $('link-native-ui').href = `http://${host}:9091/transmission/web/`;
  $('btn-retry').addEventListener('click', refresh);

  // ShareOS Menu Bar
  if (window.ShareOS && ShareOS.menu) {
    ShareOS.menu($('menu'), [
      {
        label: 'Torrent',
        items: [
          { label: 'Torrent hinzufügen...', kbd: 'Ctrl+O', action: () => $('btn-add').click() },
          '-',
          { label: 'Alle anhalten', action: async () => { await rpc('torrent-stop'); refresh(); } },
          { label: 'Alle fortsetzen', action: async () => { await rpc('torrent-start'); refresh(); } },
          '-',
          { label: 'Schließen', action: () => window.close() }
        ]
      },
      {
        label: 'Bearbeiten',
        items: [
          { label: 'Starten', action: () => $('btn-start').click() },
          { label: 'Anhalten', action: () => $('btn-pause').click() },
          { label: 'Löschen...', kbd: 'Entf', action: () => $('btn-remove').click() },
          '-',
          { label: 'Alle auswählen', kbd: 'Ctrl+A', action: () => { torrents.forEach((t) => selectedIds.add(t.id)); renderTorrents(); } }
        ]
      },
      {
        label: 'Ansicht',
        items: [
          { label: 'Aktualisieren', kbd: 'F5', action: refresh },
          '-',
          { label: 'Hell', action: () => document.documentElement.setAttribute('data-theme', 'light') },
          { label: 'Dunkel', action: () => document.documentElement.setAttribute('data-theme', 'dark') }
        ]
      },
      {
        label: 'Hilfe',
        items: [
          { label: 'Original Web-Interface öffnen (:9091)', action: () => window.open(`http://${host}:9091/transmission/web/`, '_blank') },
          { label: 'Über Transmission', action: () => toast('Transmission BitTorrent Client v1.0.0 für ShareOS') }
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
          if (confirm(`Möchten Sie die Datei „${ShareOS.file.name}“ jetzt zu Transmission hinzufügen?`)) {
            try {
              await rpc('torrent-add', { metainfo: b64 });
              toast(`Torrent „${ShareOS.file.name}“ hinzugefügt!`);
              refresh();
            } catch (err) {
              toast('Fehler beim Hinzufügen: ' + err.message, true);
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
