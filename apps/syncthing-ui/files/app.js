// Syncthing for ShareOS
// Interface for the account's own Syncthing (system app "syncthing");
// ShareOS.syncthing.api() goes through the box's proxy /_shareos/cgi/syncthing
// (permissions "files" + "syncthing", ShareOS 0.2.0-beta.20+). Folders are
// "<root>/<path>" like ShareOS.fs.
'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  const t = (key, vars) => (window.I18N ? I18N.t(key, vars) : key);
  const ST = window.ShareOS && ShareOS.syncthing;
  const api = (m, p, q, b) => ST.api(m, p, q, b);

  let myID = '';
  let devices = [];          // config
  let folders = [];          // config
  let conns = {};            // device ID -> connection
  let fstat = {};            // folder ID -> db/status
  let pendDev = {};
  let pendFol = {};
  let lastTotals = null;
  let tick = 0;
  let busy = false;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function fmtBytes(b) {
    if (!b) return '0 B';
    const u = ['B', 'KB', 'MB', 'GB', 'TB'], i = Math.min(4, Math.floor(Math.log(b) / Math.log(1024)));
    return (b / Math.pow(1024, i)).toFixed(i ? 1 : 0) + ' ' + u[i];
  }
  function shortId(id) { return String(id || '').slice(0, 7); }
  function devName(id) {
    if (id === myID) return t('dev.thisBox');
    const d = devices.find((x) => x.deviceID === id);
    return d && d.name ? d.name : shortId(id);
  }
  let toastTimer = null;
  function toast(msg, err) {
    const el = $('toast');
    el.textContent = msg; el.className = 'toast' + (err ? ' err' : ''); el.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }
  function badge(state) {
    const b = $('badge');
    b.className = 'badge ' + state;
    b.textContent = t('conn.' + state);
  }
  function openDlg(id) { const d = $(id); if (!d.open) d.showModal(); }
  document.querySelectorAll('dialog [data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
  function randomId() {
    const a = 'abcdefghijklmnopqrstuvwxyz234567';
    let s = '';
    for (let i = 0; i < 10; i++) s += a[Math.floor(Math.random() * a.length)] + (i === 4 ? '-' : '');
    return s;
  }

  // "<root>/<path>" exists, or is created (one level)
  async function ensureFolder(p) {
    p = String(p || '').replace(/\/+$/, '');
    const i = p.indexOf('/');
    if (i < 0) return;
    const root = p.slice(0, i), rest = p.slice(i + 1), j = rest.lastIndexOf('/');
    const parent = j < 0 ? '' : rest.slice(0, j), name = j < 0 ? rest : rest.slice(j + 1);
    try { await ShareOS.fs.mkdir(root, parent, name); } catch (e) { if (!/exists/.test(e.message)) throw e; }
  }

  /* ---------- loading ---------- */
  async function loadConfig() {
    const [st, dv, fo, ver] = await Promise.all([
      api('GET', '/rest/system/status'), api('GET', '/rest/config/devices'), api('GET', '/rest/config/folders'),
      tick ? Promise.resolve(null) : api('GET', '/rest/system/version')
    ]);
    myID = st.myID; devices = dv || []; folders = fo || [];
    if (ver) $('sb-version').textContent = 'Syncthing ' + ver.version;
    const me = devices.find((d) => d.deviceID === myID);
    $('sb-name').textContent = me ? me.name : '';
  }
  async function loadState(full) {
    const c = await api('GET', '/rest/system/connections');
    conns = c.connections || {};
    const tot = c.total || {};
    if (lastTotals && tot.at) {
      const dt = (new Date(tot.at) - new Date(lastTotals.at)) / 1000;
      if (dt > 0) $('sb-rates').textContent = '↓ ' + fmtBytes(Math.max(0, (tot.inBytesTotal - lastTotals.inBytesTotal) / dt)) + '/s  ↑ ' +
        fmtBytes(Math.max(0, (tot.outBytesTotal - lastTotals.outBytesTotal) / dt)) + '/s';
    }
    lastTotals = tot;
    if (full) {
      const res = await Promise.all(folders.map((f) => api('GET', '/rest/db/status', { folder: f.id }).catch(() => null)));
      folders.forEach((f, i) => { if (res[i]) fstat[f.id] = res[i]; });
      [pendDev, pendFol] = await Promise.all([api('GET', '/rest/cluster/pending/devices'), api('GET', '/rest/cluster/pending/folders')]);
      pendDev = pendDev || {}; pendFol = pendFol || {};
    }
  }
  async function refresh(force) {
    if (busy && !force) return;
    busy = true;
    try {
      const full = force || tick % 3 === 0;
      if (full) await loadConfig();
      await loadState(full);
      tick++;
      badge('online');
      $('notice').hidden = true;
      render();
    } catch (e) {
      badge('offline');
      const n = $('notice');
      n.hidden = false;
      n.textContent = e.installed === false ? t('err.notInstalled') : t('err.connect', { msg: e.message });
    } finally { busy = false; }
  }

  /* ---------- rendering ---------- */
  function folderState(f) {
    if (f.paused) return ['paused', t('state.paused')];
    const s = fstat[f.id];
    if (!s) return ['unknown', '…'];
    if (s.state === 'error' || s.errors || s.pullErrors) return ['error', t('state.error') + (s.error ? ': ' + s.error : '')];
    if (s.state === 'scanning' || s.state === 'scan-waiting') return ['busy', t('state.scanning')];
    if (s.state === 'syncing' || s.state === 'sync-preparing' || s.state === 'sync-waiting') {
      const pct = s.globalBytes ? Math.floor(100 * s.inSyncBytes / s.globalBytes) : 0;
      return ['busy', t('state.syncing', { pct })];
    }
    if (s.needTotalItems > 0) return ['warn', t('state.outOfSync', { n: s.needTotalItems })];
    return ['ok', t('state.upToDate')];
  }
  function render() {
    // pending requests
    let h = '';
    for (const id in pendDev) {
      const p = pendDev[id];
      h += `<div class="req"><span>${t('req.device', { name: esc(p.name || shortId(id)), addr: esc(p.address || '') })}</span>
        <code class="mono small">${esc(id)}</code>
        <span class="req-actions"><button class="sos-btn sos-btn-sm sos-btn-accent" data-act="dev-accept" data-id="${esc(id)}" data-name="${esc(p.name || '')}">${t('btn.add')}</button>
        <button class="sos-btn sos-btn-sm" data-act="dev-ignore" data-id="${esc(id)}">${t('btn.ignore')}</button></span></div>`;
    }
    for (const fid in pendFol) {
      for (const dev in pendFol[fid].offeredBy || {}) {
        const p = pendFol[fid].offeredBy[dev];
        if (folders.some((f) => f.id === fid)) continue;
        h += `<div class="req"><span>${t('req.folder', { dev: esc(devName(dev)), label: esc(p.label || fid) })}</span>
          <span class="req-actions"><button class="sos-btn sos-btn-sm sos-btn-accent" data-act="fol-accept" data-id="${esc(fid)}" data-dev="${esc(dev)}" data-label="${esc(p.label || fid)}">${t('btn.accept')}</button>
          <button class="sos-btn sos-btn-sm" data-act="fol-ignore" data-id="${esc(fid)}" data-dev="${esc(dev)}">${t('btn.ignore')}</button></span></div>`;
      }
    }
    $('pending').innerHTML = h;

    // folders
    $('folders').innerHTML = folders.length ? folders.map((f) => {
      const [cls, txt] = folderState(f), s = fstat[f.id] || {};
      const shared = (f.devices || []).filter((d) => d.deviceID !== myID).map((d) => esc(devName(d.deviceID))).join(', ') || t('fol.notShared');
      return `<div class="card">
        <div class="card-head"><span class="dot ${cls}"></span><b>${esc(f.label || f.id)}</b><span class="state ${cls}">${esc(txt)}</span></div>
        <div class="meta"><span class="mono">${esc(f.path || t('fol.outside'))}</span></div>
        <div class="meta">${t('fol.size', { files: s.localFiles ?? '–', size: fmtBytes(s.localBytes || 0) })} · ${t('type.' + f.type)}</div>
        <div class="meta">${t('fol.sharedWith')}: ${shared}</div>
        <div class="card-actions">
          <button class="sos-btn sos-btn-sm" data-act="fol-scan" data-id="${esc(f.id)}">${t('btn.scan')}</button>
          <button class="sos-btn sos-btn-sm" data-act="fol-pause" data-id="${esc(f.id)}">${f.paused ? t('btn.resume') : t('btn.pause')}</button>
          <button class="sos-btn sos-btn-sm" data-act="fol-edit" data-id="${esc(f.id)}">${t('btn.edit')}</button>
          ${f.type === 'receiveonly' && s.receiveOnlyTotalItems ? `<button class="sos-btn sos-btn-sm" data-act="fol-revert" data-id="${esc(f.id)}">${t('btn.revert')}</button>` : ''}
          ${f.type === 'sendonly' && s.needTotalItems ? `<button class="sos-btn sos-btn-sm" data-act="fol-override" data-id="${esc(f.id)}">${t('btn.override')}</button>` : ''}
          <button class="sos-btn sos-btn-sm sos-btn-danger" data-act="fol-remove" data-id="${esc(f.id)}">${t('btn.remove')}</button>
        </div></div>`;
    }).join('') : `<p class="empty">${t('fol.empty')}</p>`;

    // devices
    const others = devices.filter((d) => d.deviceID !== myID);
    $('devices').innerHTML = others.length ? others.map((d) => {
      const c = conns[d.deviceID] || {};
      const cls = d.paused ? 'paused' : c.connected ? 'ok' : 'off';
      const txt = d.paused ? t('state.paused') : c.connected ? t('dev.connected') : t('dev.disconnected');
      return `<div class="card">
        <div class="card-head"><span class="dot ${cls}"></span><b>${esc(d.name || shortId(d.deviceID))}</b><span class="state ${cls}">${txt}</span></div>
        <div class="meta"><code class="mono small">${esc(d.deviceID)}</code></div>
        ${c.connected ? `<div class="meta">${esc(c.address || '')} · ${esc(c.clientVersion || '')}${c.type && /relay/.test(c.type) ? ' · ' + t('dev.relay') : ''}</div>` : ''}
        <div class="card-actions">
          <button class="sos-btn sos-btn-sm" data-act="dev-pause" data-id="${esc(d.deviceID)}">${d.paused ? t('btn.resume') : t('btn.pause')}</button>
          <button class="sos-btn sos-btn-sm" data-act="dev-edit" data-id="${esc(d.deviceID)}">${t('btn.edit')}</button>
          <button class="sos-btn sos-btn-sm sos-btn-danger" data-act="dev-remove" data-id="${esc(d.deviceID)}">${t('btn.remove')}</button>
        </div></div>`;
    }).join('') : `<p class="empty">${t('dev.empty')}</p>`;
    if (window.ShareOS && ShareOS.resize) ShareOS.resize();
  }

  /* ---------- this device ---------- */
  async function showMyId() {
    $('my-id').textContent = myID;
    $('my-qr').removeAttribute('src');
    openDlg('dlg-id');
    try { $('my-qr').src = await ST.qr(myID); } catch (e) { }
  }
  $('btn-my-id').addEventListener('click', showMyId);
  $('btn-copy-id').addEventListener('click', () => {
    navigator.clipboard?.writeText(myID).then(() => toast(t('toast.copied')), () => { });
  });

  /* ---------- devices ---------- */
  let devEdit = null;
  function deviceDialog(d, name) {
    devEdit = d || null;
    $('dev-title').textContent = t(d ? 'dev.edit' : 'dev.add');
    $('dev-id').value = d ? d.deviceID : (typeof name === 'object' ? name.id : '');
    $('dev-id').readOnly = !!d;
    $('dev-name').value = d ? d.name : (typeof name === 'object' ? name.name : '');
    $('dev-addr').value = d ? (d.addresses || ['dynamic']).join(', ') : 'dynamic';
    $('dev-intro').checked = !!(d && d.introducer);
    $('dev-autoaccept').checked = !!(d && d.autoAcceptFolders);
    $('dev-err').textContent = '';
    openDlg('dlg-device');
  }
  $('btn-add-device').addEventListener('click', () => deviceDialog(null));
  $('btn-dev-save').addEventListener('click', async () => {
    const id = $('dev-id').value.replace(/\s+/g, '').toUpperCase();
    const addresses = $('dev-addr').value.split(/[,\s]+/).filter(Boolean);
    const body = { name: $('dev-name').value.trim(), addresses: addresses.length ? addresses : ['dynamic'],
      introducer: $('dev-intro').checked, autoAcceptFolders: $('dev-autoaccept').checked };
    try {
      if (devEdit) await api('PATCH', '/rest/config/devices/' + devEdit.deviceID, null, body);
      else {
        const chk = await api('GET', '/rest/svc/deviceid', { id });
        if (!chk || chk.error || !chk.id) throw new Error(t('err.badId'));
        if (chk.id === myID) throw new Error(t('err.ownId'));
        await api('POST', '/rest/config/devices', null, Object.assign({ deviceID: chk.id }, body));
      }
      $('dlg-device').close();
      refresh(true);
    } catch (e) { $('dev-err').textContent = e.message; }
  });

  /* ---------- folders ---------- */
  let folEdit = null;
  function folderDialog(f, pre) {
    folEdit = f || null;
    pre = pre || {};
    $('fol-title').textContent = t(f ? 'fol.edit' : pre.id ? 'fol.accept' : 'fol.add');
    $('fol-label').value = f ? f.label : (pre.label || '');
    $('fol-path').value = f ? f.path : (pre.label ? 'home/' + pre.label.replace(/[\/\\]/g, '_') : '');
    $('fol-path').readOnly = !!f;
    $('btn-fol-pick').disabled = !!f;
    $('fol-id').value = f ? f.id : (pre.id || randomId());
    $('fol-id').readOnly = !!f || !!pre.id;
    $('fol-type').value = f ? f.type : 'sendreceive';
    $('fol-versioning').value = f ? ((f.versioning && f.versioning.type) || '') : '';
    const sel = new Set(f ? (f.devices || []).map((d) => d.deviceID) : (pre.dev ? [pre.dev] : []));
    const others = devices.filter((d) => d.deviceID !== myID);
    $('fol-devices').innerHTML = others.length ? others.map((d) =>
      `<label class="check"><input type="checkbox" value="${esc(d.deviceID)}"${sel.has(d.deviceID) ? ' checked' : ''}> ${esc(d.name || shortId(d.deviceID))}</label>`).join('')
      : `<p class="hint">${t('fol.noDevices')}</p>`;
    $('fol-err').textContent = '';
    openDlg('dlg-folder');
  }
  const VERSIONING = {
    '': { type: '', params: {} },
    trashcan: { type: 'trashcan', params: { cleanoutDays: '30' } },
    simple: { type: 'simple', params: { keep: '5', cleanoutDays: '0' } },
    staggered: { type: 'staggered', params: { maxAge: '31536000' } }
  };
  $('btn-add-folder').addEventListener('click', () => folderDialog(null));
  $('btn-fol-pick').addEventListener('click', async () => {
    try {
      const p = await ShareOS.fs.pick({ title: t('fol.path'), folder: true });
      if (p && p.length) $('fol-path').value = p[0].path ? p[0].root + '/' + p[0].path : p[0].root;
    } catch (e) { toast(e.message, true); }
  });
  $('btn-fol-save').addEventListener('click', async () => {
    const devs = [...$('fol-devices').querySelectorAll('input:checked')].map((x) => ({ deviceID: x.value }));
    const v = VERSIONING[$('fol-versioning').value];
    const body = { label: $('fol-label').value.trim(), type: $('fol-type').value,
      devices: devs, versioning: { type: v.type, params: v.params, fsPath: '', fsType: 'basic', cleanupIntervalS: 3600 } };
    try {
      if (folEdit) await api('PATCH', '/rest/config/folders/' + folEdit.id, null, body);
      else {
        const path = $('fol-path').value.trim();
        if (!path) throw new Error(t('err.noPath'));
        await ensureFolder(path);
        await api('POST', '/rest/config/folders', null, Object.assign({ id: $('fol-id').value.trim(), path }, body));
      }
      $('dlg-folder').close();
      refresh(true);
    } catch (e) { $('fol-err').textContent = e.message; }
  });

  /* ---------- settings ---------- */
  $('btn-settings').addEventListener('click', async () => {
    try {
      const o = await api('GET', '/rest/config/options');
      const me = devices.find((d) => d.deviceID === myID);
      $('set-name').value = me ? me.name : '';
      $('set-down').value = o.maxRecvKbps; $('set-up').value = o.maxSendKbps;
      $('set-lan').checked = o.limitBandwidthInLan; $('set-global').checked = o.globalAnnounceEnabled;
      $('set-local').checked = o.localAnnounceEnabled; $('set-relays').checked = o.relaysEnabled; $('set-nat').checked = o.natEnabled;
      $('set-err').textContent = '';
      openDlg('dlg-settings');
    } catch (e) { toast(e.message, true); }
  });
  $('btn-set-save').addEventListener('click', async () => {
    try {
      await api('PATCH', '/rest/config/options', null, {
        maxRecvKbps: Math.max(0, parseInt($('set-down').value, 10) || 0), maxSendKbps: Math.max(0, parseInt($('set-up').value, 10) || 0),
        limitBandwidthInLan: $('set-lan').checked, globalAnnounceEnabled: $('set-global').checked,
        localAnnounceEnabled: $('set-local').checked, relaysEnabled: $('set-relays').checked, natEnabled: $('set-nat').checked });
      const name = $('set-name').value.trim();
      if (name) await api('PATCH', '/rest/config/devices/' + myID, null, { name });
      const rr = await api('GET', '/rest/config/restart-required');
      if (rr && rr.requiresRestart) { toast(t('toast.restarting')); await ST.restart(); }
      $('dlg-settings').close();
      refresh(true);
    } catch (e) { $('set-err').textContent = e.message; }
  });

  /* ---------- actions on cards and requests ---------- */
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    try {
      if (act === 'dev-accept') return deviceDialog(null, { id, name: b.dataset.name });
      if (act === 'dev-ignore') await api('DELETE', '/rest/cluster/pending/devices', { device: id });
      if (act === 'fol-accept') return folderDialog(null, { id, dev: b.dataset.dev, label: b.dataset.label });
      if (act === 'fol-ignore') await api('DELETE', '/rest/cluster/pending/folders', { folder: id, device: b.dataset.dev });
      if (act === 'fol-scan') { await api('POST', '/rest/db/scan', { folder: id }); toast(t('toast.scan')); }
      if (act === 'fol-pause') { const f = folders.find((x) => x.id === id); await api('PATCH', '/rest/config/folders/' + id, null, { paused: !f.paused }); }
      if (act === 'fol-edit') return folderDialog(folders.find((x) => x.id === id));
      if (act === 'fol-revert' && confirm(t('confirm.revert'))) await api('POST', '/rest/db/revert', { folder: id });
      if (act === 'fol-override' && confirm(t('confirm.override'))) await api('POST', '/rest/db/override', { folder: id });
      if (act === 'fol-remove') {
        const f = folders.find((x) => x.id === id);
        if (!confirm(t('confirm.removeFolder', { name: f.label || f.id }))) return;
        await api('DELETE', '/rest/config/folders/' + id);
      }
      if (act === 'dev-pause') {
        const d = devices.find((x) => x.deviceID === id);
        await api('POST', d.paused ? '/rest/system/resume' : '/rest/system/pause', { device: id });
        await api('PATCH', '/rest/config/devices/' + id, null, { paused: !d.paused });
      }
      if (act === 'dev-edit') return deviceDialog(devices.find((x) => x.deviceID === id));
      if (act === 'dev-remove') {
        if (!confirm(t('confirm.removeDevice', { name: devName(id) }))) return;
        await api('DELETE', '/rest/config/devices/' + id);
      }
      refresh(true);
    } catch (e) { toast(e.message, true); }
  });

  $('btn-rescan').addEventListener('click', async () => {
    try { await Promise.all(folders.map((f) => api('POST', '/rest/db/scan', { folder: f.id }))); toast(t('toast.scan')); } catch (e) { toast(e.message, true); }
  });

  /* ---------- menu ---------- */
  if (window.ShareOS && ShareOS.menu) {
    ShareOS.menu($('menu'), [
      { label: t('menu.syncthing'), items: [
        { label: t('tb.folder') + ' …', action: () => folderDialog(null) },
        { label: t('tb.device') + ' …', action: () => deviceDialog(null) },
        { label: t('tb.myId'), action: showMyId },
        '-',
        { label: t('tb.settings') + ' …', action: () => $('btn-settings').click() },
        { label: t('menu.refresh'), action: () => refresh(true) }
      ] },
      { label: t('menu.language'), items: I18N.supported.map((l) => ({ label: I18N.names[l], action: () => { I18N.setLang(l); location.reload(); } })) }
    ]);
  }

  /* ---------- start ---------- */
  if (!ST) {
    badge('offline');
    $('notice').hidden = false;
    $('notice').textContent = t('err.noPermission');
    return;
  }
  refresh(true);
  setInterval(() => { if (!document.hidden) refresh(false); }, 3000);
})();
