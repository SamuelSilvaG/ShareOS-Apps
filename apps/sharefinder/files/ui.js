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

	window.FMUI = { esc, $, T, menu, closeMenu, dialog, confirmDlg, promptDlg, info, toast, viewer, look };
})();
