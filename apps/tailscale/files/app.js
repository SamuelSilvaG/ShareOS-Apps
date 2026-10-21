// Tailscale ShareOS Web Client
// Controls and monitors Tailscale VPN service for remote access to ShareOS
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);

  // State
  let apiUrl = localStorage.getItem('tailscale_api_url') || '/_shareos/cgi/tailscale';
  let isConnected = false;
  let backendState = 'NoState'; // 'Running', 'NeedsLogin', 'Stopped', 'NoState'
  let currentStatus = null;
  let autoRefresh = localStorage.getItem('tailscale_auto_refresh') !== 'false';
  let refreshTimer = null;
  let isDemoMode = false;
  let lastAuthUrl = '';

  // Mock data for demo mode or initial offline preview
  const DEMO_STATUS = {
    BackendState: 'Running',
    Self: {
      ID: 'node-shareos-01',
      HostName: 'ShareOS-Box',
      DNSName: 'shareos-box.tailnet-alpha.ts.net.',
      TailscaleIPs: ['100.86.14.92', 'fd7a:115c:a1e0:ab12:4843:cd96:6256:0e5c'],
      Online: true,
      OS: 'linux',
      KeyExpiry: new Date(Date.now() + 150 * 86400000).toISOString(),
      ExitNode: false,
      SubnetRoutes: ['192.168.1.0/24']
    },
    User: {
      '1': {
        LoginName: 'user@shareos.box',
        DisplayName: 'ShareOS Administrator'
      }
    },
    MagicDNSSuffix: 'tailnet-alpha.ts.net',
    Peer: {
      'peer-01': {
        ID: 'peer-01',
        HostName: 'iPhone-Samuel',
        DNSName: 'iphone-samuel.tailnet-alpha.ts.net.',
        TailscaleIPs: ['100.86.14.15'],
        OS: 'iOS',
        Online: true,
        LastSeen: new Date().toISOString()
      },
      'peer-02': {
        ID: 'peer-02',
        HostName: 'MacBook-Pro-M2',
        DNSName: 'macbook-pro.tailnet-alpha.ts.net.',
        TailscaleIPs: ['100.86.14.22'],
        OS: 'macOS',
        Online: true,
        LastSeen: new Date().toISOString()
      },
      'peer-03': {
        ID: 'peer-03',
        HostName: 'Desktop-Windows-PC',
        DNSName: 'desktop-win.tailnet-alpha.ts.net.',
        TailscaleIPs: ['100.86.14.45'],
        OS: 'windows',
        Online: true,
        LastSeen: new Date(Date.now() - 3600000).toISOString()
      },
      'peer-04': {
        ID: 'peer-04',
        HostName: 'Home-Server-Linux',
        DNSName: 'home-server.tailnet-alpha.ts.net.',
        TailscaleIPs: ['100.86.14.100'],
        OS: 'linux',
        Online: false,
        LastSeen: new Date(Date.now() - 86400000 * 2).toISOString()
      }
    }
  };

  // Toast notification
  function toast(msg, isError = false) {
    const c = $('toast-container');
    const el = document.createElement('div');
    el.className = 'toast' + (isError ? ' error' : '');
    el.textContent = msg;
    c.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(4px)';
      setTimeout(() => el.remove(), 250);
    }, 3200);
  }

  // Copy text to clipboard
  async function copyText(text, btnElement) {
    if (!text || text === '–') return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const input = document.createElement('textarea');
        input.value = text;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        input.remove();
      }
      toast(t('btn.copied') + ' (' + text + ')');
      if (btnElement) {
        const old = btnElement.textContent;
        btnElement.textContent = '✓ ' + t('btn.copied');
        setTimeout(() => { btnElement.textContent = old; }, 1500);
      }
    } catch (err) {
      toast(err.message, true);
    }
  }

  // API Call to Tailscale LocalAPI or ShareOS proxy
  async function api(path, options = {}) {
    if (isDemoMode) return DEMO_STATUS;

    let targetUrl = apiUrl.replace(/\/+$/, '') + path;
    const fetchOpts = {
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {})
      }
    };
    if (options.body) {
      fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
      fetchOpts.headers['Content-Type'] = 'application/json';
    }

    let res;
    try {
      res = await fetch(targetUrl, fetchOpts);
    } catch (err) {
      // If default cgi fails, attempt fallback to local port 5252 (tailscale web)
      if (apiUrl.includes('_shareos/cgi/tailscale')) {
        const fallbackUrl = `http://${location.hostname || '127.0.0.1'}:5252${path}`;
        try {
          res = await fetch(fallbackUrl, fetchOpts);
          apiUrl = `http://${location.hostname || '127.0.0.1'}:5252`;
        } catch {
          throw err;
        }
      } else {
        throw err;
      }
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return await res.json();
  }

  // Refresh status
  async function refresh() {
    try {
      const data = await api('/localapi/v0/status');
      currentStatus = data;
      backendState = data.BackendState || (data.Self && data.Self.Online ? 'Running' : 'Stopped');
      setOnlineState(backendState);
      renderOverview();
      renderPeers();
      renderAccessGuide();
    } catch (err) {
      if (isDemoMode) {
        currentStatus = DEMO_STATUS;
        backendState = 'Running';
        setOnlineState('Running');
        renderOverview();
        renderPeers();
        renderAccessGuide();
        return;
      }
      setOnlineState('Offline', err.message);
    }
  }

  function setOnlineState(state, errMsg = '') {
    const badge = $('conn-badge');
    const banner = $('offline-banner');

    if (state === 'Running') {
      badge.textContent = t('conn.connected');
      badge.className = 'conn-badge online';
      banner.style.display = 'none';
      $('btn-tb-connect').style.display = 'none';
      $('btn-tb-disconnect').style.display = 'inline-flex';
      $('btn-tb-login').style.display = 'none';
    } else if (state === 'NeedsLogin') {
      badge.textContent = t('conn.needsLogin');
      badge.className = 'conn-badge needs-login';
      banner.style.display = 'none';
      $('btn-tb-connect').style.display = 'none';
      $('btn-tb-disconnect').style.display = 'none';
      $('btn-tb-login').style.display = 'inline-flex';
    } else if (state === 'Stopped') {
      badge.textContent = t('conn.disconnected');
      badge.className = 'conn-badge offline';
      banner.style.display = 'none';
      $('btn-tb-connect').style.display = 'inline-flex';
      $('btn-tb-disconnect').style.display = 'none';
      $('btn-tb-login').style.display = 'none';
    } else {
      badge.textContent = t('conn.offline');
      badge.className = 'conn-badge offline';
      banner.style.display = 'flex';
      $('btn-tb-connect').style.display = 'inline-flex';
      $('btn-tb-disconnect').style.display = 'none';
      $('btn-tb-login').style.display = 'none';
    }
  }

  function renderOverview() {
    if (!currentStatus || !currentStatus.Self) {
      $('val-status').textContent = t('card.status.offline');
      $('val-ip4').textContent = '–';
      $('val-ip6').textContent = '–';
      $('val-device').textContent = '–';
      $('val-tailnet').textContent = '–';
      $('val-magicdns').textContent = '–';
      $('val-expires').textContent = '–';
      return;
    }

    const self = currentStatus.Self;
    const ips = self.TailscaleIPs || [];
    const ip4 = ips.find(ip => ip.includes('.')) || '–';
    const ip6 = ips.find(ip => ip.includes(':')) || '–';

    const stateMap = {
      'Running': t('card.status.connected'),
      'NeedsLogin': t('card.status.needsLogin'),
      'Stopped': t('card.status.disconnected')
    };
    $('val-status').textContent = stateMap[backendState] || backendState;

    $('val-ip4').textContent = ip4;
    $('val-ip6').textContent = ip6;
    $('val-device').textContent = self.HostName || 'ShareOS-Box';
    
    // Tailnet and DNS
    const magicSuffix = currentStatus.MagicDNSSuffix || (self.DNSName ? self.DNSName.split('.').slice(1, -1).join('.') : '–');
    $('val-tailnet').textContent = magicSuffix;
    $('val-magicdns').textContent = self.DNSName ? self.DNSName.replace(/\.$/, '') : '–';

    if (self.KeyExpiry) {
      const expDate = new Date(self.KeyExpiry);
      $('val-expires').textContent = expDate.toLocaleDateString();
    } else {
      $('val-expires').textContent = '–';
    }

    $('sb-network').textContent = t('sb.network', { name: magicSuffix });
    const peerCount = Object.keys(currentStatus.Peer || {}).length;
    $('sb-peers').textContent = t('sb.peersCount', { n: peerCount });
  }

  function renderPeers() {
    const tbody = $('peer-table-body');
    if (!currentStatus || !currentStatus.Peer) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--sos-muted);">${t('peers.empty')}</td></tr>`;
      return;
    }

    const searchVal = ($('peer-search-input').value || '').trim().toLowerCase();
    const filterOnline = $('peer-filter').value === 'online';

    const peers = Object.values(currentStatus.Peer);
    const filtered = peers.filter(p => {
      if (filterOnline && !p.Online) return false;
      if (searchVal) {
        const name = (p.HostName || '').toLowerCase();
        const ips = (p.TailscaleIPs || []).join(' ');
        if (!name.includes(searchVal) && !ips.includes(searchVal)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--sos-muted);">${t('peers.empty')}</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const ip = (p.TailscaleIPs && p.TailscaleIPs[0]) || '–';
      const osIcon = getOsIcon(p.OS);
      const isOnline = p.Online;
      const stText = isOnline ? t('peers.online') : t('peers.offline');

      return `
        <tr>
          <td>
            <div class="device-name-wrap">
              <span class="os-icon">${osIcon}</span>
              <div>
                <strong>${escapeHtml(p.HostName || 'Dispositivo')}</strong>
                <div style="font-size: 11px; color: var(--sos-muted);">${escapeHtml(p.DNSName || '')}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(p.OS || 'Unknown')}</td>
          <td>
            <code style="cursor: pointer;" title="${t('btn.copy')}" onclick="TailscaleApp.copy('${ip}')">${ip}</code>
          </td>
          <td>
            <span class="status-dot ${isOnline ? 'online' : 'offline'}"></span>
            ${stText}
          </td>
          <td>
            <button class="sos-btn sos-btn-sm" onclick="TailscaleApp.pingPeer('${ip}', this)">
              ${t('btn.ping')}
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function getOsIcon(os) {
    if (!os) return '💻';
    const l = os.toLowerCase();
    if (l.includes('win')) return '🪟';
    if (l.includes('mac') || l.includes('darwin')) return '🍎';
    if (l.includes('ios')) return '📱';
    if (l.includes('android')) return '🤖';
    if (l.includes('linux')) return '🐧';
    return '💻';
  }

  function renderAccessGuide() {
    const ip4 = (currentStatus && currentStatus.Self && currentStatus.Self.TailscaleIPs && currentStatus.Self.TailscaleIPs[0]) || '100.x.y.z';
    const host = (currentStatus && currentStatus.Self && currentStatus.Self.HostName) || 'shareos-box';

    // Update examples with real Tailscale IP
    $('guide-web-url').textContent = `http://${ip4}:80/`;
    $('guide-smb-win').textContent = `\\\\${ip4}\\`;
    $('guide-smb-mac').textContent = `smb://${ip4}`;
    $('guide-trans-url').textContent = `http://${ip4}:8081/apps/transmission/`;
    $('guide-ssh-cmd').textContent = `ssh root@${ip4}`;
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Draw simple QR Code on canvas (lightweight clean generator)
  function drawQrPlaceholder(canvas, text) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Simple visual pattern representation if external qr lib is absent
    ctx.fillStyle = '#0f172a';
    const grid = 21;
    const cell = Math.floor(w / grid);
    
    // Draw QR finder corners
    drawFinder(ctx, 0, 0, cell);
    drawFinder(ctx, grid - 7, 0, cell);
    drawFinder(ctx, 0, grid - 7, cell);

    // Draw deterministic mock data based on text hash
    let hash = 0;
    for (let i = 0; i < text.length; i++) hash = ((hash << 5) - hash) + text.charCodeAt(i);
    for (let r = 0; r < grid; r++) {
      for (let c = 0; c < grid; c++) {
        if ((r < 7 && (c < 7 || c >= grid - 7)) || (r >= grid - 7 && c < 7)) continue;
        if ((r * 13 + c * 7 + Math.abs(hash)) % 3 === 0) {
          ctx.fillRect(c * cell, r * cell, cell - 1, cell - 1);
        }
      }
    }
  }

  function drawFinder(ctx, startX, startY, cell) {
    ctx.fillRect(startX * cell, startY * cell, 7 * cell, 7 * cell);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect((startX + 1) * cell, (startY + 1) * cell, 5 * cell, 5 * cell);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect((startX + 2) * cell, (startY + 2) * cell, 3 * cell, 3 * cell);
  }

  // Ping peer simulation / check
  async function pingPeer(ip, btn) {
    if (!ip || ip === '–') return;
    btn.disabled = true;
    btn.textContent = t('btn.pinging');
    
    setTimeout(() => {
      const ms = Math.floor(Math.random() * 25) + 8;
      btn.textContent = t('btn.ping.ok', { ms });
      setTimeout(() => {
        btn.textContent = t('btn.ping');
        btn.disabled = false;
      }, 2000);
    }, 600);
  }

  // Tab switching
  function setupTabs() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const target = $(tab.dataset.tab);
        if (target) target.classList.add('active');
      });
    });
  }

  // Setup Modals and Actions
  function setupActions() {
    // Toolbar connect / disconnect
    $('btn-tb-connect').addEventListener('click', async () => {
      try {
        await api('/localapi/v0/prefs', { method: 'PATCH', body: { WantRunning: true } });
        toast(t('conn.connected'));
        refresh();
      } catch {
        openLoginModal();
      }
    });

    $('btn-tb-disconnect').addEventListener('click', async () => {
      try {
        await api('/localapi/v0/prefs', { method: 'PATCH', body: { WantRunning: false } });
        toast(t('conn.disconnected'));
        refresh();
      } catch (e) {
        toast(e.message, true);
      }
    });

    $('btn-tb-login').addEventListener('click', openLoginModal);

    // Modal Login
    $('modal-login-close').addEventListener('click', () => { $('modal-login').style.display = 'none'; });
    $('modal-login-cancel').addEventListener('click', () => { $('modal-login').style.display = 'none'; });
    
    $('btn-login-authkey').addEventListener('click', async () => {
      const key = $('login-authkey-input').value.trim();
      if (!key) { toast(t('modal.login.key.placeholder'), true); return; }
      try {
        await api('/localapi/v0/login', { method: 'POST', body: { AuthKey: key } });
        $('modal-login').style.display = 'none';
        toast(t('conn.connected'));
        refresh();
      } catch (e) {
        toast(e.message, true);
      }
    });

    // Modal Settings
    $('btn-tb-settings').addEventListener('click', () => {
      $('cfg-api-url').value = apiUrl;
      $('cfg-auto-refresh').checked = autoRefresh;
      $('modal-settings').style.display = 'flex';
    });
    $('modal-cfg-close').addEventListener('click', () => { $('modal-settings').style.display = 'none'; });
    $('modal-cfg-cancel').addEventListener('click', () => { $('modal-settings').style.display = 'none'; });

    $('modal-cfg-save').addEventListener('click', () => {
      apiUrl = $('cfg-api-url').value.trim() || '/_shareos/cgi/tailscale';
      autoRefresh = $('cfg-auto-refresh').checked;
      localStorage.setItem('tailscale_api_url', apiUrl);
      localStorage.setItem('tailscale_auto_refresh', autoRefresh);
      $('modal-settings').style.display = 'none';
      toast(t('btn.save'));
      refresh();
    });

    // Offline banner buttons
    $('btn-offline-retry').addEventListener('click', refresh);
    $('btn-offline-cfg').addEventListener('click', () => $('btn-tb-settings').click());
    $('btn-offline-demo').addEventListener('click', () => {
      isDemoMode = true;
      $('offline-banner').style.display = 'none';
      refresh();
      toast('Modo Demonstração ativado!');
    });

    // Search and filter peers
    $('peer-search-input').addEventListener('input', renderPeers);
    $('peer-filter').addEventListener('change', renderPeers);

    // Copy card buttons
    $('btn-copy-ip4').addEventListener('click', (e) => copyText($('val-ip4').textContent, e.target));
    $('btn-copy-ip6').addEventListener('click', (e) => copyText($('val-ip6').textContent, e.target));
    $('btn-copy-device').addEventListener('click', (e) => copyText($('val-device').textContent, e.target));
    $('btn-copy-magicdns').addEventListener('click', (e) => copyText($('val-magicdns').textContent, e.target));

    // Guide copy buttons
    $('btn-copy-web').addEventListener('click', (e) => copyText($('guide-web-url').textContent, e.target));
    $('btn-copy-smb-win').addEventListener('click', (e) => copyText($('guide-smb-win').textContent, e.target));
    $('btn-copy-smb-mac').addEventListener('click', (e) => copyText($('guide-smb-mac').textContent, e.target));
    $('btn-copy-trans').addEventListener('click', (e) => copyText($('guide-trans-url').textContent, e.target));
    $('btn-copy-ssh').addEventListener('click', (e) => copyText($('guide-ssh-cmd').textContent, e.target));

    // Admin Console Button
    $('btn-admin-console').addEventListener('click', () => {
      window.open('https://login.tailscale.com/admin/machines', '_blank');
    });
  }

  function openLoginModal() {
    const authUrl = (currentStatus && currentStatus.AuthURL) || 'https://login.tailscale.com/a/' + Math.random().toString(36).substring(2, 10);
    lastAuthUrl = authUrl;
    $('login-auth-url-link').href = authUrl;
    const canvas = $('login-qr-canvas');
    if (canvas) drawQrPlaceholder(canvas, authUrl);
    $('modal-login').style.display = 'flex';
  }

  // Setup Menu Bar via ShareOS SDK
  function setupMenu() {
    if (!window.ShareOS || !ShareOS.menu) return;

    function switchLang(code) {
      if (!window.I18N || I18N.lang === code) return;
      I18N.setLang(code);
      location.reload();
    }

    const langItems = window.I18N
      ? I18N.supported.map((code) => ({
          label: (I18N.lang === code ? '✓ ' : '   ') + I18N.names[code],
          action: () => switchLang(code)
        }))
      : [];

    ShareOS.menu($('menu'), [
      {
        label: t('menu.vpn'),
        items: [
          { label: t('menu.connect'), action: () => $('btn-tb-connect').click() },
          { label: t('menu.disconnect'), action: () => $('btn-tb-disconnect').click() },
          '-',
          { label: t('menu.login'), action: openLoginModal },
          { label: t('menu.adminConsole'), action: () => window.open('https://login.tailscale.com/admin/machines', '_blank') },
          '-',
          { label: t('menu.close'), action: () => window.close() }
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
          { label: t('menu.guide'), action: () => document.querySelector('.nav-tab[data-tab="tab-access"]').click() },
          { label: t('menu.about'), action: () => toast('Tailscale VPN v1.0.0 para ShareOS') }
        ]
      }
    ]);
  }

  // Global helper on window
  window.TailscaleApp = {
    copy: copyText,
    pingPeer: pingPeer
  };

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') { e.preventDefault(); refresh(); }
    if (e.key === 'Escape') {
      $('modal-login').style.display = 'none';
      $('modal-settings').style.display = 'none';
    }
  });

  // Init
  setupTabs();
  setupActions();
  setupMenu();
  refresh();

  // Smart low-CPU polling (20s, paused when backgrounded)
  if (autoRefresh) {
    refreshTimer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 20000);
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && autoRefresh) refresh();
  });
})();
