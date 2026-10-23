// Tailscale ShareOS Web Client
// Controls and monitors Tailscale VPN service for remote access to ShareOS
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);

  const APP_VERSION = '1.1.0';

  // State
  let backendState = 'NoState'; // Running, NeedsLogin, NeedsMachineAuth, Stopped, Starting
  let currentStatus = null;
  let autoRefresh = localStorage.getItem('tailscale_auto_refresh') !== 'false';
  let refreshTimer = null;
  let loginTimer = null;
  let busy = false;

  // ShareOS.tailscale exists for apps with the permissions "files" + "tailscale"
  // (ShareOS 0.2.0-beta.7+, system app "tailscaled" since beta.8); the box only answers for administrator accounts
  const TS = (window.ShareOS && ShareOS.tailscale) || null;

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

  function showBanner(title, desc) {
    $('banner-title').textContent = title;
    $('banner-desc').textContent = desc || '';
    $('offline-banner').style.display = 'flex';
  }

  // Refresh status
  async function refresh() {
    if (!TS) {
      setOnlineState('Offline');
      showBanner(t('banner.noapi.title'), t('banner.noapi.desc'));
      return null;
    }
    try {
      const st = await TS.status();
      currentStatus = st;
      if (!st.installed) {
        backendState = 'Offline';
        setOnlineState('Offline');
        showBanner(t('banner.missing.title'), t('banner.missing.desc'));
      } else {
        backendState = st.running ? (st.state || 'NoState') : 'Stopped';
        setOnlineState(backendState);
      }
      renderOverview();
      renderPeers();
      renderAccessGuide();
      if ($('modal-login').style.display !== 'none') updateLoginModal();
      return st;
    } catch (err) {
      currentStatus = null;
      setOnlineState('Offline');
      if (/no access/i.test(err.message)) showBanner(t('banner.noapi.title'), t('banner.noapi.desc'));
      else showBanner(t('banner.offline.title'), t('banner.offline.desc', { err: err.message }));
      renderOverview();
      renderPeers();
      return null;
    }
  }

  function showButtons(connect, disconnect, login) {
    $('btn-tb-connect').style.display = connect ? 'inline-flex' : 'none';
    $('btn-tb-disconnect').style.display = disconnect ? 'inline-flex' : 'none';
    $('btn-tb-login').style.display = login ? 'inline-flex' : 'none';
  }

  function setOnlineState(state) {
    const badge = $('conn-badge');
    const banner = $('offline-banner');
    if (state !== 'Offline') banner.style.display = 'none';

    if (state === 'Running') {
      badge.textContent = t('conn.connected');
      badge.className = 'conn-badge online';
      showButtons(false, true, false);
    } else if (state === 'NeedsLogin' || state === 'NeedsMachineAuth') {
      badge.textContent = t('conn.needsLogin');
      badge.className = 'conn-badge needs-login';
      showButtons(false, false, true);
    } else if (state === 'Starting' || state === 'NoState') {
      badge.textContent = t('conn.starting');
      badge.className = 'conn-badge checking';
      showButtons(false, true, false);
    } else if (state === 'Stopped') {
      badge.textContent = t('conn.disconnected');
      badge.className = 'conn-badge offline';
      showButtons(true, false, false);
    } else {
      badge.textContent = t('conn.offline');
      badge.className = 'conn-badge offline';
      showButtons(false, false, false);
    }
  }

  function renderOverview() {
    const st = currentStatus;
    const stateMap = {
      'Running': t('card.status.connected'),
      'NeedsLogin': t('card.status.needsLogin'),
      'NeedsMachineAuth': t('card.status.needsMachineAuth'),
      'Starting': t('card.status.starting'),
      'NoState': t('card.status.starting'),
      'Stopped': t('card.status.disconnected')
    };
    $('val-status').textContent = stateMap[backendState] || t('card.status.offline');

    const self = st && st.self;
    const ips = (self && self.ips) || [];
    $('val-ip4').textContent = ips.find(ip => ip.includes('.')) || '–';
    $('val-ip6').textContent = ips.find(ip => ip.includes(':')) || '–';
    $('val-device').textContent = (self && self.name) || '–';
    const suffix = (st && st.tailnet && (st.tailnet.suffix || st.tailnet.name)) || '–';
    $('val-tailnet').textContent = suffix;
    $('val-magicdns').textContent = (self && self.dns) || '–';
    const exp = self && self.key_expiry ? new Date(self.key_expiry) : null;
    const ve = $('val-expires'); // optional card
    if (ve) ve.textContent = exp && !isNaN(exp) && exp.getFullYear() > 1 ? exp.toLocaleDateString() : '–';

    $('sb-network').textContent = t('sb.network', { name: suffix });
    $('sb-peers').textContent = t('sb.peersCount', { n: ((st && st.peers) || []).length });
  }

  function renderPeers() {
    const tbody = $('peer-table-body');
    const empty = `<tr><td colspan="5" style="text-align:center; padding: 24px; color: var(--sos-muted);">${escapeHtml(t('peers.empty'))}</td></tr>`;
    const peers = (currentStatus && currentStatus.peers) || [];
    const searchVal = ($('peer-search-input').value || '').trim().toLowerCase();
    const filterOnline = $('peer-filter').value === 'online';

    const filtered = peers.filter(p => {
      if (filterOnline && !p.online) return false;
      if (searchVal) {
        const name = (p.name || '').toLowerCase() + ' ' + (p.dns || '').toLowerCase();
        const ips = (p.ips || []).join(' ');
        if (!name.includes(searchVal) && !ips.includes(searchVal)) return false;
      }
      return true;
    });
    if (!filtered.length) { tbody.innerHTML = empty; return; }

    tbody.innerHTML = filtered.map(p => {
      const ip = (p.ips || []).find(x => x.includes('.')) || (p.ips || [])[0] || '';
      const how = p.online ? (p.direct ? t('peers.direct') : (p.relay ? t('peers.relay', { r: p.relay }) : '')) : '';
      return `
        <tr>
          <td>
            <div class="device-name-wrap">
              <span class="os-icon">${getOsIcon(p.os)}</span>
              <div>
                <strong>${escapeHtml(p.name || '–')}</strong>
                <div style="font-size: 11px; color: var(--sos-muted);">${escapeHtml(p.dns || '')}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(p.os || '–')}</td>
          <td>${ip ? `<code style="cursor: pointer;" title="${escapeHtml(t('btn.copy'))}" data-copy="${escapeHtml(ip)}">${escapeHtml(ip)}</code>` : '–'}</td>
          <td>
            <span class="status-dot ${p.online ? 'online' : 'offline'}"></span>
            ${escapeHtml(p.online ? t('peers.online') : t('peers.offline'))}
            ${how ? `<div style="font-size: 11px; color: var(--sos-muted);">${escapeHtml(how)}</div>` : ''}
          </td>
          <td>
            ${ip && p.online ? `<button class="sos-btn sos-btn-sm" data-ping="${escapeHtml(ip)}">${escapeHtml(t('btn.ping'))}</button>` : ''}
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
    const ips = (currentStatus && currentStatus.self && currentStatus.self.ips) || [];
    const ip4 = ips.find(ip => ip.includes('.')) || '100.x.y.z';
    $('guide-web-url').textContent = `http://${ip4}/`;
    $('guide-smb-win').textContent = `\\\\${ip4}\\`;
    $('guide-smb-mac').textContent = `smb://${ip4}`;
    $('guide-trans-url').textContent = `http://${ip4}/#/apps/run/transmission`;
    $('guide-ssh-cmd').textContent = `ssh root@${ip4}`;
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Real QR code of the sign-in link (qrcode.js, MIT, Kazuhiko Arase)
  function drawQr(canvas, text) {
    const ctx = canvas.getContext('2d');
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const n = qr.getModuleCount();
    const quiet = 4;
    const cell = Math.max(1, Math.floor(canvas.width / (n + quiet * 2)));
    const off = Math.floor((canvas.width - cell * n) / 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++)
        if (qr.isDark(r, c)) ctx.fillRect(off + c * cell, off + r * cell, cell, cell);
  }

  // Ping over the tailnet (tailscale ping on the box)
  async function pingPeer(ip, btn) {
    if (!TS || !ip) return;
    btn.disabled = true;
    btn.textContent = t('btn.pinging');
    try {
      const r = await TS.ping(ip);
      btn.textContent = t('btn.ping.ok', { ms: Math.round(r.ms) }) + (r.direct ? '' : ' (Relay)');
    } catch (e) {
      btn.textContent = t('btn.ping.fail');
      btn.title = e.message;
    }
    setTimeout(() => { btn.textContent = t('btn.ping'); btn.disabled = false; }, 2500);
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

  // Run one action against the box, then refresh
  async function act(fn, okMsg) {
    if (!TS || busy) return null;
    busy = true;
    document.body.style.cursor = 'progress';
    try {
      const r = await fn();
      if (okMsg) toast(okMsg);
      return r;
    } catch (e) {
      toast(e.message, true);
      return null;
    } finally {
      busy = false;
      document.body.style.cursor = '';
      refresh();
    }
  }

  // Connect: "tailscale up" – without a key the box answers with a sign-in link
  async function connect(reauth) {
    openLoginModal();
    const st = await act(() => reauth ? TS.login() : TS.up());
    if (st) afterUp(st);
  }

  // a pending sign-in link is shown again instead of starting a new one
  function loginClick() {
    if (currentStatus && currentStatus.auth_url) openLoginModal();
    else connect(false);
  }

  function afterUp(st) {
    currentStatus = st;
    if (st.state === 'Running' && !st.auth_url) {
      closeLoginModal();
      toast(t('conn.connected'));
    } else {
      updateLoginModal();
    }
  }

  function setupActions() {
    $('btn-tb-connect').addEventListener('click', () => connect(false));
    $('btn-tb-login').addEventListener('click', loginClick);
    $('btn-tb-disconnect').addEventListener('click', () => act(() => TS.down(), t('conn.disconnected')));
    $('btn-tb-refresh').addEventListener('click', refresh);

    // Modal Login
    $('modal-login-close').addEventListener('click', closeLoginModal);
    $('modal-login-cancel').addEventListener('click', closeLoginModal);

    $('btn-login-authkey').addEventListener('click', async () => {
      const key = $('login-authkey-input').value.trim();
      if (!/^tskey-[A-Za-z0-9_-]+$/.test(key)) { toast(t('modal.login.key.placeholder'), true); return; }
      const st = await act(() => TS.up({ authKey: key }));
      if (st) {
        $('login-authkey-input').value = '';
        afterUp(st);
      }
    });

    // Modal Settings
    $('btn-tb-settings').addEventListener('click', () => {
      $('cfg-auto-refresh').checked = autoRefresh;
      $('modal-settings').style.display = 'flex';
    });
    $('modal-cfg-close').addEventListener('click', () => { $('modal-settings').style.display = 'none'; });
    $('modal-cfg-cancel').addEventListener('click', () => { $('modal-settings').style.display = 'none'; });

    $('modal-cfg-save').addEventListener('click', () => {
      autoRefresh = $('cfg-auto-refresh').checked;
      try { localStorage.setItem('tailscale_auto_refresh', autoRefresh); } catch {}
      $('modal-settings').style.display = 'none';
      setPolling();
      toast(t('btn.save'));
    });

    // Offline banner
    $('btn-offline-retry').addEventListener('click', refresh);

    // Peer table: copy IP / ping
    $('peer-table-body').addEventListener('click', (e) => {
      const c = e.target.closest('[data-copy]');
      if (c) copyText(c.dataset.copy);
      const b = e.target.closest('[data-ping]');
      if (b) pingPeer(b.dataset.ping, b);
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
    $('modal-login').style.display = 'flex';
    updateLoginModal();
    clearInterval(loginTimer);
    // the sign-in happens in another browser or on the phone: watch for it
    loginTimer = setInterval(async () => {
      if ($('modal-login').style.display === 'none') { clearInterval(loginTimer); return; }
      if (busy) return;
      const st = await refresh();
      if (st && st.state === 'Running' && !st.auth_url) {
        closeLoginModal();
        toast(t('conn.connected'));
      }
    }, 3000);
  }

  function closeLoginModal() {
    clearInterval(loginTimer);
    $('modal-login').style.display = 'none';
  }

  let shownUrl = '';
  function updateLoginModal() {
    const url = (currentStatus && currentStatus.auth_url) || '';
    const canvas = $('login-qr-canvas');
    $('login-qr-wait').style.display = url ? 'none' : '';
    canvas.style.display = url ? '' : 'none';
    $('login-link-wrap').style.display = url ? '' : 'none';
    if (url && url !== shownUrl) {
      shownUrl = url;
      $('login-auth-url-link').href = url;
      $('login-auth-url-link').title = url;
      drawQr(canvas, url);
    }
  }

  async function logout() {
    if (!confirm(t('confirm.logout'))) return;
    await act(() => TS.logout(), t('toast.loggedOut'));
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
          { label: t('menu.connect'), action: () => connect(false) },
          { label: t('menu.disconnect'), action: () => act(() => TS.down(), t('conn.disconnected')) },
          '-',
          { label: t('menu.login'), action: loginClick },
          { label: t('menu.reauth'), action: () => connect(true) },
          { label: t('menu.logout'), action: logout },
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
          { label: t('menu.about'), action: () => toast(t('about.text', { v: (currentStatus && currentStatus.version) || '–', a: APP_VERSION })) }
        ]
      }
    ]);
  }

  // Global helper on window
  window.TailscaleApp = { copy: copyText, pingPeer: pingPeer };

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'F5') { e.preventDefault(); refresh(); }
    if (e.key === 'Escape') {
      closeLoginModal();
      $('modal-settings').style.display = 'none';
    }
  });

  // Init
  setupTabs();
  setupActions();
  setupMenu();
  refresh();

  // Smart low-CPU polling (20s, paused when backgrounded)
  function setPolling() {
    clearInterval(refreshTimer);
    if (autoRefresh) refreshTimer = setInterval(() => { if (!document.hidden) refresh(); }, 20000);
  }
  setPolling();

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && autoRefresh) refresh();
  });
})();
