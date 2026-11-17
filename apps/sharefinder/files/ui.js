/*
 * Shared building blocks of ShareExplorer and ShareFinder (the same file in
 * both apps): menus, dialogs, the file viewer, toasts and a small html helper.
 * The look comes from each app's style.css (classes fm-*).
 */
(function () {
	'use strict';

	const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
	const $ = (s, el) => (el || document).querySelector(s);
	const T = (s) => (window.sosT ? window.sosT(s) : s);
	// menus and dialogs live inside #app: they take its colours
	const host = () => document.getElementById('app') || document.body;

	/* ---- menu (context menu and drop-down menus) ----
	 * items: [{ label, icon, kbd, action, disabled, checked, sub: [...] }, '-', …] */
	let openMenu = null;
	function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
	function menu(items, x, y, o) {
		closeMenu();
		const m = document.createElement('div');
		m.className = 'fm-menu' + (o && o.cls ? ' ' + o.cls : '');
		m.setAttribute('role', 'menu');
		const build = (box, list) => {
			for (const it of list) {
				if (it === '-') { const s = document.createElement('div'); s.className = 'fm-msep'; box.appendChild(s); continue; }
				if (!it) continue;
				const b = document.createElement('button');
				b.type = 'button'; b.className = 'fm-mi' + (it.checked ? ' on' : '') + (it.sub ? ' has-sub' : '');
				b.setAttribute('role', it.checked != null ? 'menuitemcheckbox' : 'menuitem');
				if (it.checked != null) b.setAttribute('aria-checked', String(!!it.checked));
				b.disabled = !!it.disabled;
				b.innerHTML = `<span class="fm-mico">${it.icon || (it.checked ? '✓' : '')}</span><span class="fm-mlbl">${esc(T(it.label))}</span><span class="fm-mkbd">${esc(it.kbd || (it.sub ? '›' : ''))}</span>`;
				if (it.sub) {
					const sub = document.createElement('div');
					sub.className = 'fm-menu fm-sub';
					build(sub, it.sub);
					b.appendChild(sub);
				} else b.addEventListener('click', (ev) => { ev.stopPropagation(); closeMenu(); if (it.action) it.action(); });
				box.appendChild(b);
			}
		};
		build(m, items);
		host().appendChild(m);
		const r = m.getBoundingClientRect();
		m.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 4)) + 'px';
		m.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 4)) + 'px';
		openMenu = m;
		const first = m.querySelector('.fm-mi:not(:disabled)');
		if (first) first.focus({ preventScroll: true });
		m.addEventListener('keydown', (ev) => {
			const L = [...m.querySelectorAll(':scope > .fm-mi:not(:disabled)')];
			const i = L.indexOf(document.activeElement);
			if (ev.key === 'ArrowDown') { ev.preventDefault(); (L[i + 1] || L[0]).focus(); }
			else if (ev.key === 'ArrowUp') { ev.preventDefault(); (L[i - 1] || L[L.length - 1]).focus(); }
			else if (ev.key === 'Escape') { ev.preventDefault(); closeMenu(); }
		});
		return m;
	}
	document.addEventListener('mousedown', (ev) => { if (openMenu && !openMenu.contains(ev.target)) closeMenu(); }, true);
	window.addEventListener('blur', closeMenu);
	window.addEventListener('resize', closeMenu);

	/* ---- dialogs ---- */
	// raw: the title is a file name (not translated)
	function dialog({ title, body, ok, cancel, danger, input, value, select, cls, raw }) {
		return new Promise((resolve) => {
			const w = document.createElement('div');
			w.className = 'fm-modal' + (cls ? ' ' + cls : '');
			w.innerHTML = `<div class="fm-dlg" role="dialog" aria-modal="true" aria-label="${esc(T(title || ''))}">
				${title ? `<h2${raw ? ' data-i18n-skip' : ''}>${esc(title)}</h2>` : ''}
				${body ? `<div class="fm-dbody">${body}</div>` : ''}
				${input ? `<input class="fm-in" type="text" value="${esc(value || '')}" spellcheck="false" autocapitalize="off">` : ''}
				<div class="fm-dacts">
					${cancel !== false ? `<button type="button" class="fm-btn" data-r="0">${esc(cancel || 'Abbrechen')}</button>` : ''}
					<button type="button" class="fm-btn primary${danger ? ' danger' : ''}" data-r="1">${esc(ok || 'OK')}</button>
				</div></div>`;
			host().appendChild(w);
			const inp = $('.fm-in', w);
			const done = (v) => { document.removeEventListener('keydown', key, true); w.remove(); resolve(v); };
			const key = (ev) => {
				if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); done(null); }
				else if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); done(inp ? inp.value : true); }
			};
			document.addEventListener('keydown', key, true);
			w.addEventListener('click', (ev) => {
				const b = ev.target.closest('[data-r]');
				if (b) done(b.dataset.r === '1' ? (inp ? inp.value : true) : null);
				else if (ev.target === w) done(null);
			});
			if (inp) {
				inp.focus();
				// the name without its extension is selected, like in the file managers
				const v = inp.value, dot = select === 'stem' ? v.lastIndexOf('.') : -1;
				inp.setSelectionRange(0, dot > 0 ? dot : v.length);
			} else $('[data-r="1"]', w).focus();
		});
	}
	const confirmDlg = (title, body, ok, danger) => dialog({ title, body: `<p>${esc(body)}</p>`, ok, danger });
	const promptDlg = (title, value, ok, select) => dialog({ title, input: true, value, ok, select });
	const info = (title, raw, html) => dialog({ title, raw, body: html, ok: 'Schließen', cancel: false, cls: 'fm-info' });

	/* ---- toast ---- */
	let toastT = null;
	function toast(msg, err) {
		let t = $('.fm-toast');
		if (!t) { t = document.createElement('div'); t.className = 'fm-toast'; t.setAttribute('role', 'status'); host().appendChild(t); }
		t.textContent = T(msg);
		t.classList.toggle('err', !!err);
		t.classList.add('on');
		clearTimeout(toastT);
		toastT = setTimeout(() => t.classList.remove('on'), err ? 5000 : 2600);
	}

	/* ---- progress of a copy or move on the box ----
	 * progress() gives the function for FileCore.onProgress: called with
	 * { op, count, total, done, cancel } while the box works (bytes; null while
	 * it is still counting) and with null at the end. Speed and remaining time
	 * come from the steps of the last 20 seconds. */
	function fmtDur(s) {
		s = Math.max(1, Math.round(s));
		if (s < 60) return s + ' s';
		if (s < 3600) return Math.floor(s / 60) + ' min' + (s % 60 && s < 600 ? ' ' + (s % 60) + ' s' : '');
		return Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' min';
	}
	function progress() {
		let w = null, hist = [], cancel = null, stopping = false;
		const set = (sel, t) => { const e = $(sel, w); if (e.textContent !== t) e.textContent = t; };
		return (p) => {
			if (!p) { if (w) w.remove(); w = null; hist = []; cancel = null; stopping = false; return; }
			if (!w) {
				w = document.createElement('div');
				w.className = 'fm-prog';
				w.setAttribute('role', 'status');
				w.innerHTML = `<div class="fm-ptitle"></div>
					<div class="fm-pbar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><i></i></div>
					<div class="fm-pline"><span class="fm-pamt" data-i18n-skip></span><span class="fm-prate" data-i18n-skip></span></div>
					<div class="fm-pline"><span class="fm-peta"></span><button type="button" class="fm-btn" data-p="cancel">Abbrechen</button></div>`;
				host().appendChild(w);
				$('[data-p="cancel"]', w).addEventListener('click', () => {
					if (!cancel || stopping) return;
					stopping = true;
					$('[data-p="cancel"]', w).disabled = true;
					set('.fm-peta', 'Wird abgebrochen …');
					cancel().catch((e) => { stopping = false; if (w) $('[data-p="cancel"]', w).disabled = false; toast(e.message || String(e), true); });
				});
			}
			cancel = p.cancel || null;
			$('[data-p="cancel"]', w).hidden = !cancel;
			const verb = p.op === 'move' ? 'verschoben' : 'kopiert';
			set('.fm-ptitle', p.count === 1 ? `1 Element wird ${verb}` : `${p.count} Elemente werden ${verb}`);
			const now = Date.now(), last = hist[hist.length - 1];
			if (p.done != null && (!last || p.done !== last.done)) hist.push({ t: now, done: p.done });
			while (hist.length > 2 && now - hist[0].t > 20000) hist.shift();
			const a = hist[0], b = hist[hist.length - 1];
			const rate = hist.length > 1 && b.t - a.t >= 2000 && b.done > a.done ? (b.done - a.done) / ((b.t - a.t) / 1000) : 0;
			const known = p.total != null && p.total > 0, pct = known && p.done != null ? Math.min(100, Math.floor(p.done * 100 / p.total)) : null;
			const bar = $('.fm-pbar', w);
			bar.classList.toggle('wait', pct == null);
			if (pct != null) { bar.setAttribute('aria-valuenow', pct); $('i', bar).style.width = pct + '%'; } else bar.removeAttribute('aria-valuenow');
			set('.fm-pamt', pct != null ? `${pct} % · ${FC.fmtSize(p.done)} ${T('von')} ${FC.fmtSize(p.total)}` : p.done ? FC.fmtSize(p.done) : '');
			set('.fm-prate', rate ? FC.fmtSize(rate) + '/s' : '');
			if (!stopping) set('.fm-peta', !known ? 'Größe wird ermittelt …' : pct >= 100 ? 'Wird abgeschlossen …' : rate ? `noch etwa ${fmtDur((p.total - p.done) / rate)}` : 'Restzeit wird berechnet …');
		};
	}

	/* ---- viewer: pictures, video, audio, text, PDF straight from the box ----
	 * list: entries of the folder that can be shown (← → step through them) */
	async function viewer(fm, name, o) {
		o = o || {};
		const list = fm.view().filter((e) => FC.canPreview(e)).map((e) => e.name);
		let i = Math.max(0, list.indexOf(name));
		const w = document.createElement('div');
		w.className = 'fm-viewer' + (o.cls ? ' ' + o.cls : '');
		w.innerHTML = `<div class="fm-vbar"><span class="fm-vname" data-i18n-skip></span><span class="fm-vmeta"></span>
			<button type="button" class="fm-btn" data-v="prev" title="Vorheriges (←)" aria-label="Vorheriges">‹</button>
			<button type="button" class="fm-btn" data-v="next" title="Nächstes (→)" aria-label="Nächstes">›</button>
			<button type="button" class="fm-btn" data-v="dl">Herunterladen</button>
			<button type="button" class="fm-btn" data-v="close" title="Schließen (Esc)" aria-label="Schließen">✕</button></div>
			<div class="fm-vbody"></div>`;
		host().appendChild(w);
		const body = $('.fm-vbody', w);
		async function show() {
			const n = list[i], e = fm.entry(n);
			$('.fm-vname', w).textContent = n;
			$('.fm-vmeta', w).textContent = e ? FC.fmtSize(e.size) + ' · ' + FC.fmtDate(e.mtime) : '';
			$('[data-v="prev"]', w).disabled = i <= 0; $('[data-v="next"]', w).disabled = i >= list.length - 1;
			body.innerHTML = '<div class="fm-spin"></div>';
			try {
				const f = await fm.fileOf(n);
				if (list[i] !== n) return;
				const k = e.kind;
				if (k === 'image') body.innerHTML = `<img alt="${esc(n)}" src="${esc(f.url)}">`;
				else if (k === 'video') body.innerHTML = `<video controls autoplay src="${esc(f.url)}"></video>`;
				else if (k === 'audio') body.innerHTML = `<div class="fm-vaudio"><div class="fm-vbig">♪</div><audio controls autoplay src="${esc(f.url)}"></audio></div>`;
				else if (k === 'pdf') body.innerHTML = `<iframe title="${esc(n)}" src="${esc(f.url)}"></iframe>`;
				else {
					const t = await fm.readText(n, 262144);
					body.innerHTML = `<pre class="fm-vtext"></pre>`;
					$('.fm-vtext', body).textContent = t + ((e.size || 0) > 262144 ? '\n\n… ' + T('(gekürzt – zum Lesen herunterladen)') : '');
				}
			} catch (err) { body.innerHTML = `<p class="fm-verr">${esc(FC.errText(err))}</p>`; }
		}
		const done = () => { document.removeEventListener('keydown', key, true); w.remove(); if (o.onClose) o.onClose(list[i]); };
		const key = (ev) => {
			if (ev.key === 'Escape' || (o.space && ev.key === ' ' && !/INPUT|TEXTAREA/.test(ev.target.tagName))) { ev.preventDefault(); ev.stopPropagation(); done(); }
			else if (ev.key === 'ArrowLeft' && i > 0) { ev.preventDefault(); i--; show(); }
			else if (ev.key === 'ArrowRight' && i < list.length - 1) { ev.preventDefault(); i++; show(); }
		};
		document.addEventListener('keydown', key, true);
		w.addEventListener('click', (ev) => {
			const b = ev.target.closest('[data-v]');
			if (!b) { if (ev.target === w) done(); return; }
			if (b.dataset.v === 'close') done();
			else if (b.dataset.v === 'prev' && i > 0) { i--; show(); }
			else if (b.dataset.v === 'next' && i < list.length - 1) { i++; show(); }
			else if (b.dataset.v === 'dl') fm.download([list[i]]).catch((e) => toast(e.message, true));
		});
		show();
	}

	/* ---- the look: system light/dark from ShareOS, original or ShareOS style ---- */
	function look(appEl, key) {
		let style = 'orig';
		try { style = localStorage.getItem(key) || 'orig'; } catch (e) { /* storage may be off */ }
		const apply = () => {
			const t = (window.ShareOS && ShareOS.theme && ShareOS.theme.theme) || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
			appEl.classList.toggle('dark', t !== 'light');
			appEl.classList.toggle('st-sos', style === 'sos');
			appEl.classList.toggle('st-orig', style !== 'sos');
			document.documentElement.style.colorScheme = t === 'light' ? 'light' : 'dark';
		};
		apply();
		if (window.ShareOS && ShareOS.onTheme) ShareOS.onTheme(apply);
		return {
			get style() { return style; },
			toggle() { style = style === 'sos' ? 'orig' : 'sos'; try { localStorage.setItem(key, style); } catch (e) { /* off */ } apply(); return style; }
		};
	}

	window.FMUI = { esc, $, T, menu, closeMenu, dialog, confirmDlg, promptDlg, info, toast, viewer, progress, look };
})();
