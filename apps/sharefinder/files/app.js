/*
 * ShareFinder – file manager for the folders of the box in the style of the
 * macOS Finder (toolbar, sidebar, icon / list / column view, Quick Look with
 * the space bar, path bar), switchable to the ShareOS look. Own drawings, no
 * Apple artwork. Logic: core.js (FileCore), building blocks: ui.js.
 */
(function () {
	'use strict';
	const { esc, $, T, menu, confirmDlg, info, toast, viewer } = FMUI;
	const app = $('#app');
	const look = FMUI.look(app, 'sharefinder-style');
	const MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
	const K = MAC ? { mod: '⌘', shift: '⇧', alt: '⌥' } : { mod: 'Strg+', shift: 'Umschalt+', alt: 'Alt+' };

	/* ---------- icons (own drawings) ---------- */
	const KC = { image: '#34a853', video: '#8e5bd8', audio: '#ef4b6c', text: '#8a95a1', pdf: '#e5483b', archive: '#a7865a', doc: '#3b7ddd', sheet: '#2f9e57', slides: '#ef8b2c', file: '#9aa3ad' };
	const LBL = { image: 'IMG', video: 'MOV', audio: 'AUD', text: 'TXT', pdf: 'PDF', archive: 'ZIP', doc: 'DOC', sheet: 'XLS', slides: 'PPT', file: '' };
	function folder(kind) {
		// a light blue folder with a darker tab; kinds of places get a sign on it
		const sign = kind === 'home' ? '<path d="M22 31.5l10-8 10 8M25 29.5v10h14v-10" fill="none" stroke="#2b7fd6" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>'
			: kind === 'share' ? '<circle cx="32" cy="34" r="6" fill="none" stroke="#2b7fd6" stroke-width="2.4"/><path d="M26 34h12M32 28c2 2 2 10 0 12M32 28c-2 2-2 10 0 12" fill="none" stroke="#2b7fd6" stroke-width="1.8"/>' : '';
		return `<svg viewBox="0 0 64 64"><path d="M6 16a4 4 0 0 1 4-4h14.5l5 5H54a4 4 0 0 1 4 4v29a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#5aa9ee"/><path d="M6 22a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v28a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4z" fill="#86c3f7"/><path d="M6 22a4 4 0 0 1 4-4h44a4 4 0 0 1 4 4v1.5H6z" fill="#a4d2fa"/>${sign}</svg>`;
	}
	function icoOrig(k, place) {
		if (place === 'usb') return '<svg viewBox="0 0 64 64"><rect x="8" y="18" width="48" height="28" rx="6" fill="#d9dde2"/><rect x="8" y="34" width="48" height="12" rx="5" fill="#b9c0c8"/><circle cx="48" cy="40" r="2.2" fill="#3dc75a"/><rect x="14" y="23" width="18" height="3" rx="1.5" fill="#fff" opacity=".8"/></svg>';
		if (place === 'drive') return '<svg viewBox="0 0 64 64"><rect x="6" y="16" width="52" height="32" rx="6" fill="#e3e6ea"/><rect x="6" y="34" width="52" height="14" rx="5" fill="#c3c9d0"/><circle cx="49" cy="41" r="2.2" fill="#3dc75a"/><circle cx="41" cy="41" r="2.2" fill="#9aa3ad"/></svg>';
		if (place === 'home') return folder('home');
		if (place === 'share') return folder('share');
		if (k === 'dir') return folder();
		const c = KC[k] || KC.file;
		return `<svg viewBox="0 0 64 64"><path d="M14 5h25l13 13v39a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z" fill="#fff" stroke="#c8cdd3" stroke-width="1.4"/><path d="M39 5v10a3 3 0 0 0 3 3h10" fill="#eef1f4" stroke="#c8cdd3" stroke-width="1.4" stroke-linejoin="round"/>${LBL[k] ? `<rect x="15" y="40" width="34" height="12" rx="3" fill="${c}"/><text x="32" y="49" font-size="8.5" font-weight="700" text-anchor="middle" fill="#fff" font-family="-apple-system,Helvetica Neue,Arial,sans-serif">${LBL[k]}</text>` : ''}${k === 'image' ? '<circle cx="24" cy="25" r="3.5" fill="#f5b83d"/><path d="M17 36l9-9 6 6 5-4 10 7z" fill="#5fb878"/>' : k === 'text' || k === 'doc' ? '<path d="M19 22h26M19 27h26M19 32h18" stroke="#c3c9d0" stroke-width="2" stroke-linecap="round"/>' : k === 'video' ? '<path d="M27 21v14l11-7z" fill="#8e5bd8"/>' : k === 'audio' ? '<path d="M36 18v13.5a4 4 0 1 1-3-3.9V21l-8 2v12a4 4 0 1 1-3-3.9V21z" fill="#ef4b6c"/>' : ''}</svg>`;
	}
	function icoSos(k, place) {
		const s = (d) => `<svg viewBox="0 0 64 64" class="sosi">${d}</svg>`;
		if (place === 'usb') return s('<rect x="9" y="20" width="46" height="24" rx="5"/><path d="M46 32h.01M16 37h16"/>');
		if (place === 'drive') return s('<rect x="7" y="17" width="50" height="30" rx="5"/><path d="M7 35h50M47 41h.01"/>');
		if (place === 'home') return s('<path d="M10 30L32 12l22 18M16 26v26h32V26"/><path d="M28 52V40h8v12"/>');
		if (k === 'dir' || place === 'share') return s('<path d="M7 18a4 4 0 0 1 4-4h12l5 5h25a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4z"/>');
		return s(`<path d="M15 6h24l12 12v38a2 2 0 0 1-2 2H15a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/><path d="M39 6v12h12"/>${LBL[k] ? `<text x="32" y="44" font-size="9" text-anchor="middle" fill="currentColor" stroke="none">${LBL[k]}</text>` : ''}`);
	}
	const ico = (k, place) => (look.style === 'sos' ? icoSos(k, place) : icoOrig(k, place));
	const SI = {
		back: '<path d="M12 4l-6 6 6 6"/>', fwd: '<path d="M8 4l6 6-6 6"/>',
		icons: '<rect x="3" y="3" width="5.5" height="5.5" rx="1"/><rect x="11.5" y="3" width="5.5" height="5.5" rx="1"/><rect x="3" y="11.5" width="5.5" height="5.5" rx="1"/><rect x="11.5" y="11.5" width="5.5" height="5.5" rx="1"/>',
		list: '<path d="M7 5h10M7 10h10M7 15h10"/><path d="M3 5h.01M3 10h.01M3 15h.01"/>', cols: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><path d="M7.5 3.5v13M12.5 3.5v13"/>',
		sort: '<path d="M4 6h12M6 10h8M8 14h4"/>', act: '<circle cx="10" cy="10" r="7.5"/><path d="M6.5 10h.01M10 10h.01M13.5 10h.01"/>',
		search: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5L17 17"/>', style: '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 0 0 14z" fill="currentColor"/>',
		newdir: '<path d="M2.5 6a1.5 1.5 0 0 1 1.5-1.5h4l1.5 1.5H16a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M10 8.5v5M7.5 11h5"/>',
		upload: '<path d="M10 13V3M6 7l4-4 4 4M3 13v3h14v-3"/>', chev: '<path d="M7 4l6 6-6 6"/>', eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.3"/>'
	};
	const si = (n) => `<svg class="ci" viewBox="0 0 20 20" aria-hidden="true">${SI[n]}</svg>`;

	/* ---------- state ---------- */
	const fm = new FileCore({ onChange, store: 'sharefinder' });
	const P = fm.prefs();
	let view = P.view || 'icons';         // icons | list | cols
	let pathbar = P.pathbar !== false;
	let renaming = null, upl = null;
	const colCache = new Map();           // "root/path" -> entries (column view)

	app.innerHTML = `
	<aside class="side" aria-label="Seitenleiste"></aside>
	<div class="win">
		<header class="tb">
			<div class="seg nav"><button type="button" class="tbb" data-c="back" title="Zurück" aria-label="Zurück">${si('back')}</button><button type="button" class="tbb" data-c="fwd" title="Vorwärts" aria-label="Vorwärts">${si('fwd')}</button></div>
			<h1 class="ttl"></h1>
			<span class="grow"></span>
			<div class="seg views" role="group" aria-label="Darstellung">
				<button type="button" class="tbb" data-c="v-icons" title="Als Symbole" aria-label="Als Symbole">${si('icons')}</button>
				<button type="button" class="tbb" data-c="v-list" title="Als Liste" aria-label="Als Liste">${si('list')}</button>
				<button type="button" class="tbb" data-c="v-cols" title="Als Spalten" aria-label="Als Spalten">${si('cols')}</button>
			</div>
			<button type="button" class="tbb solo" data-c="sort" title="Sortieren nach" aria-label="Sortieren nach">${si('sort')}</button>
			<button type="button" class="tbb solo" data-c="act" title="Aktionen" aria-label="Aktionen">${si('act')}</button>
			<button type="button" class="tbb solo" data-c="upload" title="Dateien hochladen" aria-label="Dateien hochladen">${si('upload')}</button>
			<button type="button" class="tbb solo stb" data-c="style" title="Zwischen Original- und ShareOS-Stil wechseln">${si('style')}<span class="stl"></span></button>
			<label class="srch">${si('search')}<input type="search" id="q" placeholder="Suchen" spellcheck="false" autocomplete="off"></label>
			<input type="file" id="up-in" multiple hidden>
		</header>
		<section class="content" tabindex="0" aria-label="Dateien"></section>
		<footer class="foot"><div class="pbar"></div><div class="sbar"></div></footer>
	</div>`;
	const content = $('.content'), side = $('.side'), q = $('#q');

	/* ---------- drawing ---------- */
	function onChange(what) {
		if (what === 'error') return drawError();
		if (what === 'roots') { drawSide(); return; }
		if (what === 'busy') { app.classList.toggle('busy', fm.busy > 0); return; }
		if (what === 'list') { colCache.set(fm.root + '/' + fm.path, fm.entries); drawAll(); return; }
		if (what === 'sel') { if (view === 'cols') drawContent(); else markSel(); drawFoot(); return; }
		if (what === 'clip') drawContent();
	}
	function drawAll() { drawTb(); drawSide(); drawContent(); drawFoot(); }
	function drawError() {
		const e = fm.error;
		const msg = e === 'nofs' ? (window.ShareOS && ShareOS.app ? 'Diese App braucht den Zugriff auf die Dateien der Box. Der Admin schaltet ihn unter Benutzer → „Dateien“ ein.' : 'ShareFinder läuft in ShareOS: dort unter Apps öffnen.')
			: e === 'noroots' ? 'Für dieses Konto gibt es weder einen persönlichen Ordner noch eine Freigabe.' : e;
		if (!fm.root) { content.innerHTML = `<div class="empty big">${ico('dir')}<p>${esc(T(msg))}</p></div>`; return; }
		toast(msg, true);
	}
	const place = (r) => (r.usb ? 'usb' : r.home || r.personal ? 'home' : 'share');
	const here = () => (fm.path ? FC.baseOf(fm.path) : fm.rootLabel(fm.rootInfo));
	function drawTb() {
		$('.ttl').textContent = here();
		$('.ttl').toggleAttribute('data-i18n-skip', !!fm.path);
		document.title = here() + ' – ShareFinder';
		$('[data-c="back"]').disabled = !fm.back.length;
		$('[data-c="fwd"]').disabled = !fm.fwd.length;
		for (const v of ['icons', 'list', 'cols']) $(`[data-c="v-${v}"]`).classList.toggle('on', view === v);
		$('[data-c="upload"]').disabled = fm.readOnly || !fm.root;
		$('.stl').textContent = T(look.style === 'sos' ? 'Original' : 'ShareOS');
		app.classList.toggle('no-pbar', !pathbar);
	}
	async function drawSide() {
		const R = fm.roots;
		const item = (root, path, label, kind, skip) => {
			const cur = fm.root === root && fm.path === path;
			return `<button type="button" class="si${cur ? ' cur' : ''}" data-root="${esc(root)}" data-path="${esc(path)}"><span class="sico">${ico('dir', kind)}</span><span class="sl"${skip ? ' data-i18n-skip' : ''}>${esc(label)}</span></button>`;
		};
		const home = R.find((r) => r.home || r.personal) || null;
		const favs = [];
		if (home) {
			favs.push(item(home.name, '', fm.rootLabel(home), 'home'));
			// the usual folders of the personal folder, when there
			if (!drawSide.kids) drawSide.kids = await fm.subdirs(home.name, '');
			for (const n of ['Dokumente', 'Documents', 'Bilder', 'Pictures', 'Musik', 'Music', 'Videos', 'Downloads', 'Schreibtisch', 'Desktop']) if (drawSide.kids.includes(n)) favs.push(item(home.name, n, n, null, true));
		}
		const app_ = R.filter((r) => r.name === 'app');
		const shares = R.filter((r) => !(r.home || r.personal || r.name === 'app' || r.usb));
		const usb = R.filter((r) => r.usb);
		side.innerHTML = `<div class="sh">${esc(T('Favoriten'))}</div>${favs.join('')}${app_.map((r) => item(r.name, '', fm.rootLabel(r), null)).join('')}
			${shares.length ? `<div class="sh">${esc(T('Freigaben'))}</div>${shares.map((r) => item(r.name, '', r.name + (r.ro ? ' 🔒' : ''), 'share', true)).join('')}` : ''}
			${usb.length ? `<div class="sh">${esc(T('Speicherorte'))}</div>${usb.map((r) => item(r.name, '', r.name, 'usb', true)).join('')}` : ''}`;
	}
	const kindTxt = (e) => (e.kind === 'dir' ? T('Ordner') : T(FC.typeName(e)));
	function nameHtml(e) {
		return renaming === e.name ? `<input class="ren" value="${esc(e.name)}" spellcheck="false">` : `<span class="nm" data-i18n-skip>${esc(e.name)}</span>`;
	}
	function drawContent() {
		const L = fm.view();
		content.className = 'content v-' + view;
		if (view === 'cols') return drawCols();
		const emptyTxt = T(fm.filter ? 'Keine Treffer.' : 'Dieser Ordner ist leer.');
		if (view === 'list') {
			const arr = (by) => (fm.sort.by === by ? `<span class="arr">${fm.sort.dir > 0 ? '⌃' : '⌄'}</span>` : '');
			content.innerHTML = `<div class="lhead"><button type="button" class="lh name${fm.sort.by === 'name' ? ' on' : ''}" data-sort="name">Name${arr('name')}</button><button type="button" class="lh date${fm.sort.by === 'mtime' ? ' on' : ''}" data-sort="mtime">Änderungsdatum${arr('mtime')}</button><button type="button" class="lh size${fm.sort.by === 'size' ? ' on' : ''}" data-sort="size">Größe${arr('size')}</button><button type="button" class="lh kind${fm.sort.by === 'type' ? ' on' : ''}" data-sort="type">Art${arr('type')}</button></div>
				<div class="items" role="grid" aria-multiselectable="true">${L.map((e) => `<div class="it lrow${fm.sel.has(e.name) ? ' sel' : ''}${fm.isCut(e.name) ? ' cut' : ''}" role="row" draggable="true" data-n="${esc(e.name)}" data-k="${e.kind}">
					<span class="lc name"><span class="ico">${ico(e.kind)}</span>${nameHtml(e)}</span><span class="lc date">${esc(FC.fmtRel(e.mtime))}</span><span class="lc size">${e.kind === 'dir' ? '--' : esc(FC.fmtSize(e.size))}</span><span class="lc kind">${esc(kindTxt(e))}</span></div>`).join('')}
				${L.length ? '' : `<div class="empty">${esc(emptyTxt)}</div>`}</div>`;
		} else {
			content.innerHTML = `<div class="items grid" role="listbox" aria-multiselectable="true">${L.map((e) => `<div class="it ic${fm.sel.has(e.name) ? ' sel' : ''}${fm.isCut(e.name) ? ' cut' : ''}" role="option" draggable="true" data-n="${esc(e.name)}" data-k="${e.kind}" title="${esc(e.name)}"><span class="ico">${ico(e.kind)}</span>${nameHtml(e)}</div>`).join('')}</div>${L.length ? '' : `<div class="empty">${esc(emptyTxt)}</div>`}`;
			thumbs();
		}
		focusRename();
	}
	function focusRename() {
		const r = $('.ren', content);
		if (!r) return;
		r.focus();
		const dot = r.value.lastIndexOf('.');
		r.setSelectionRange(0, dot > 0 && fm.entry(renaming)?.kind !== 'dir' ? dot : r.value.length);
	}
	let thumbObs = null;
	function thumbs() {
		thumbObs?.disconnect();
		thumbObs = new IntersectionObserver((list) => {
			for (const x of list) {
				if (!x.isIntersecting) continue;
				thumbObs.unobserve(x.target);
				fm.fileOf(x.target.dataset.n).then((f) => { const s = $('.ico', x.target); if (s) s.innerHTML = `<img class="thumb" alt="" loading="lazy" src="${esc(f.url)}">`; }).catch(() => {});
			}
		}, { root: content });
		content.querySelectorAll('.it.ic[data-k="image"]').forEach((el) => { if ((fm.entry(el.dataset.n)?.size || 0) < 15e6) thumbObs.observe(el); });
	}
	function markSel() {
		content.querySelectorAll('.it').forEach((el) => {
			if (el.dataset.col != null) return;
			el.classList.toggle('sel', fm.sel.has(el.dataset.n));
			el.classList.toggle('focus', el.dataset.n === fm.focus);
		});
		const f = fm.focus && content.querySelector(`.it[data-n="${CSS.escape(fm.focus)}"]:not([data-col])`);
		if (f) f.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	/* column view: one column per folder from the drive to the current one,
	 * then the preview of the selected file */
	async function drawCols() {
		const parts = fm.path ? fm.path.split('/') : [];
		const levels = [''];
		for (let i = 0; i < parts.length; i++) levels.push(parts.slice(0, i + 1).join('/'));
		const lists = await Promise.all(levels.map(async (p) => {
			const k = fm.root + '/' + p;
			if (p === fm.path) return fm.view();
			if (!colCache.has(k)) {
				try { const r = await fm.fs.list(fm.root, p, fm.hidden); colCache.set(k, (r.entries || []).map((e) => ({ ...e, kind: FC.kind(e) }))); } catch (e) { colCache.set(k, []); }
			}
			const coll = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
			return colCache.get(k).slice().sort((a, b) => ((a.kind === 'dir') !== (b.kind === 'dir') ? (a.kind === 'dir' ? -1 : 1) : coll.compare(a.name, b.name)));
		}));
		if (view !== 'cols') return;
		const S = fm.selected();
		const cols = lists.map((L, i) => {
			const cur = i === levels.length - 1, next = parts[i];
			return `<div class="col${cur ? ' cur' : ''}" data-level="${i}">${L.map((e) => {
				const on = cur ? fm.sel.has(e.name) : e.name === next;
				return `<div class="it crow${on ? (cur ? ' sel' : ' path') : ''}${cur && fm.isCut(e.name) ? ' cut' : ''}"${cur ? '' : ` data-col="${i}"`} draggable="${cur}" data-n="${esc(e.name)}" data-k="${e.kind}">
					<span class="ico">${ico(e.kind)}</span>${cur ? nameHtml(e) : `<span class="nm" data-i18n-skip>${esc(e.name)}</span>`}${e.kind === 'dir' ? `<span class="carr">${si('chev')}</span>` : ''}</div>`;
			}).join('') || `<div class="empty">${esc(T('leer'))}</div>`}</div>`;
		});
		let prev = '';
		if (S.length === 1 && S[0].kind !== 'dir') {
			const e = S[0];
			prev = `<div class="col prev"><div class="pv-media">${ico(e.kind)}</div><h3 data-i18n-skip>${esc(e.name)}</h3><p class="mut">${esc(kindTxt(e))} – ${esc(FC.fmtSize(e.size))}</p>
				<dl class="pv-props"><dt>${esc(T('Geändert'))}</dt><dd>${esc(FC.fmtRel(e.mtime))}</dd></dl>
				<div class="pv-acts">${FC.canPreview(e) ? `<button type="button" class="fm-btn" data-c="ql">${esc(T('Vorschau'))}</button>` : ''}<button type="button" class="fm-btn" data-c="download">${esc(T('Laden'))}</button></div></div>`;
		}
		const sx = content.scrollLeft;
		content.innerHTML = `<div class="cols">${cols.join('')}${prev}</div>`;
		content.scrollLeft = sx;
		requestAnimationFrame(() => { content.scrollLeft = content.scrollWidth; });
		if (prev && ['image', 'video', 'pdf'].includes(S[0].kind)) {
			try {
				const f = await fm.fileOf(S[0].name);
				const box = $('.prev .pv-media', content);
				if (box && fm.selected()[0] === S[0]) box.innerHTML = S[0].kind === 'image' ? `<img alt="" src="${esc(f.url)}">` : S[0].kind === 'video' ? `<video muted preload="metadata" src="${esc(f.url)}"></video>` : box.innerHTML;
			} catch (e) { /* preview is optional */ }
		}
		focusRename();
		const sel = $('.col.cur .it.sel', content);
		if (sel) sel.scrollIntoView({ block: 'nearest' });
	}
	function drawFoot() {
		const L = fm.view(), S = fm.selected();
		const r = fm.rootInfo;
		const parts = fm.path ? fm.path.split('/') : [];
		let acc = '';
		$('.pbar').innerHTML = `<button type="button" class="pseg" data-root="${esc(fm.root)}" data-path=""><span class="pico">${ico('dir', r ? place(r) : null)}</span>${esc(fm.rootLabel(r))}</button>`
			+ parts.map((p) => { acc = acc ? acc + '/' + p : p; return `<span class="psep">${si('chev')}</span><button type="button" class="pseg" data-i18n-skip data-root="${esc(fm.root)}" data-path="${esc(acc)}"><span class="pico">${ico('dir')}</span>${esc(p)}</button>`; }).join('');
		const n = S.length ? `${S.length} ${T('von')} ${L.length} ${T('ausgewählt')}` : `${L.length} ${T(L.length === 1 ? 'Objekt' : 'Objekte')}`;
		$('.sbar').textContent = upl || (fm.root ? n + (fm.free != null ? ', ' + FC.fmtSize(fm.free) + ' ' + T('verfügbar') : '') + (fm.readOnly ? ' · ' + T('nur lesen') : '') : '');
	}

	/* ---------- actions ---------- */
	const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message || String(e), true); } };
	const go = guard((root, path) => fm.go(root, path));
	const quickLook = (name) => viewer(fm, name, { space: true, cls: 'ql', onClose: (n) => { fm.selectOnly(n); content.focus(); } });
	const openEntry = guard(async (name) => {
		const e = fm.entry(name);
		if (!e) return;
		if (e.kind === 'dir') return fm.open(name);
		if (FC.canPreview(e)) quickLook(name); else await fm.download([name]);
	});
	const newFolder = guard(async () => { const n = await fm.mkdir(fm.freeName(T('Neuer Ordner'), true)); renaming = n; drawContent(); });
	const newText = guard(async () => { const n = await fm.newFile(fm.freeName(T('Ohne Titel') + '.txt', false)); renaming = n; drawContent(); });
	function startRename() { const S = fm.selected(); if (S.length !== 1 || fm.readOnly) return; renaming = S[0].name; drawContent(); }
	const finishRename = guard(async (input, keep) => {
		const from = renaming;
		renaming = null;
		if (!keep || !from) { drawContent(); return; }
		try { await fm.rename(from, input.value); } catch (e) { drawContent(); throw e; }
	});
	const del = guard(async () => {
		const S = fm.selected();
		if (!S.length || fm.readOnly) return;
		const what = S.length === 1 ? `„${S[0].name}“` : `${S.length} ${T('Objekte')}`;
		if (!await confirmDlg(T('Sofort löschen?'), `${T('Möchtest du')} ${what} ${T('wirklich löschen? Auf der Box gibt es keinen Papierkorb – das kann nicht widerrufen werden.')}`, 'Löschen', true)) return;
		await fm.remove(S.map((e) => e.name));
	});
	const paste = guard(async (into) => { await fm.paste(into); });
	// ⌥⌘V: the copied objects are moved instead of copied
	const pasteMove = guard(async () => { if (fm.clip) { fm.clip.op = 'cut'; await fm.paste(); } });
	const upload = guard(async (files, into) => {
		if (!files || !files.length || fm.readOnly) return;
		const back = into ? { root: fm.root, path: fm.path } : null;
		if (into) await fm.go(fm.root, FC.joinPath(fm.path, into));
		try {
			await fm.upload(files, (i, n, name) => { upl = i < n ? `${T('Hochladen')} ${i + 1}/${n}: ${name}` : null; drawFoot(); });
			toast(files.length === 1 ? 'Hochgeladen.' : `${files.length} ${T('Dateien hochgeladen.')}`);
		} finally { upl = null; drawFoot(); if (back) await fm.go(back.root, back.path, false); }
	});
	const getInfo = guard(async () => {
		const S = fm.selected(), e = S[0];
		const loc = fm.rootLabel(fm.rootInfo) + (fm.path ? '/' + fm.path : '');
		if (!e) {
			return info(here(), !!fm.path, `<div class="pi-head">${ico('dir', !fm.path && fm.rootInfo ? place(fm.rootInfo) : null)}</div><dl class="pv-props"><dt>${esc(T('Ort'))}</dt><dd>${esc(loc)}</dd><dt>${esc(T('Inhalt'))}</dt><dd>${fm.entries.length} ${esc(T('Objekte'))}</dd>${fm.free != null ? `<dt>${esc(T('Verfügbar'))}</dt><dd>${esc(FC.fmtSize(fm.free))}</dd>` : ''}<dt>${esc(T('Zugriff'))}</dt><dd>${esc(T(fm.readOnly ? 'Nur lesen' : 'Lesen & Schreiben'))}</dd></dl>`);
		}
		const bytes = S.filter((x) => x.kind !== 'dir').reduce((a, x) => a + (x.size || 0), 0);
		info(S.length === 1 ? e.name : `${S.length} ${T('Objekte')}`, S.length === 1, `<div class="pi-head">${ico(S.length === 1 ? e.kind : 'file')}</div><dl class="pv-props">
			${S.length === 1 ? `<dt>${esc(T('Art'))}</dt><dd>${esc(kindTxt(e))}</dd>` : ''}<dt>${esc(T('Größe'))}</dt><dd>${esc(FC.fmtSize(bytes))}</dd>
			<dt>${esc(T('Ort'))}</dt><dd>${esc(loc)}</dd>${S.length === 1 ? `<dt>${esc(T('Geändert'))}</dt><dd>${esc(FC.fmtDate(e.mtime, true))}</dd>` : ''}</dl>`);
	});
	function setView(v) { view = v; fm.savePrefs({ view }); drawTb(); drawContent(); }
	function toggleStyle() { look.toggle(); drawAll(); }
	const sortItems = () => [
		{ label: 'Name', checked: fm.sort.by === 'name', action: () => fm.setSort('name') },
		{ label: 'Art', checked: fm.sort.by === 'type', action: () => fm.setSort('type') },
		{ label: 'Änderungsdatum', checked: fm.sort.by === 'mtime', action: () => fm.setSort('mtime') },
		{ label: 'Größe', checked: fm.sort.by === 'size', action: () => fm.setSort('size') }, '-',
		{ label: 'Umgekehrte Reihenfolge', checked: fm.sort.dir < 0, action: () => { fm.sort.dir = -fm.sort.dir; fm.savePrefs(); onChange('list'); } }];
	const actItems = () => {
		const S = fm.selected(), ro = fm.readOnly, one = S.length === 1 ? S[0] : null;
		const make = [{ label: 'Neuer Ordner', kbd: K.shift + K.mod + 'N', disabled: ro, action: newFolder },
			{ label: 'Neue Textdatei', disabled: ro, action: newText }, '-'];
		return [
			...(S.length ? [] : make),
			one ? { label: 'Öffnen', kbd: K.mod + '↓', action: () => openEntry(one.name) } : null,
			one && FC.canPreview(one) ? { label: `„${one.name}“ ${T('übersichtlich zeigen')}`, kbd: 'Leertaste', action: () => quickLook(one.name) } : null,
			S.some((e) => e.kind !== 'dir') ? { label: 'Laden', action: guard(() => fm.download(S.map((e) => e.name))) } : null,
			S.length ? { label: 'Informationen', kbd: K.mod + 'I', action: getInfo } : null,
			one ? { label: 'Umbenennen', kbd: '↩', disabled: ro, action: startRename } : null,
			S.length ? { label: 'Löschen', kbd: K.mod + '⌫', disabled: ro, action: del } : null, '-',
			S.length ? { label: S.length === 1 ? `„${one.name}“ ${T('kopieren')}` : `${S.length} ${T('Objekte kopieren')}`, kbd: K.mod + 'C', action: () => fm.copySel(false) } : null,
			S.length ? { label: 'Ausschneiden', kbd: K.mod + 'X', disabled: ro, action: () => fm.copySel(true) } : null,
			{ label: 'Objekt einsetzen', kbd: K.mod + 'V', disabled: ro || !fm.clip, action: () => paste() },
			one && one.kind === 'dir' && fm.clip ? { label: 'In diesen Ordner einsetzen', disabled: ro, action: () => paste(one.name) } : null,
			fm.clip && fm.clip.op === 'copy' ? { label: 'Objekt hierher bewegen', kbd: K.alt + K.mod + 'V', disabled: ro, action: pasteMove } : null, '-',
			...(S.length ? make : []),
			{ label: 'Hochladen …', disabled: ro, action: () => $('#up-in').click() },
			!S.length ? { label: 'Informationen', kbd: K.mod + 'I', action: getInfo } : null, '-',
			{ label: 'Darstellung', sub: [
				{ label: 'Als Symbole', checked: view === 'icons', action: () => setView('icons') },
				{ label: 'Als Liste', checked: view === 'list', action: () => setView('list') },
				{ label: 'Als Spalten', checked: view === 'cols', action: () => setView('cols') }, '-',
				{ label: 'Pfadleiste', checked: pathbar, action: () => { pathbar = !pathbar; fm.savePrefs({ pathbar }); drawTb(); } },
				{ label: 'Unsichtbare Objekte', checked: fm.hidden, action: guard(() => { colCache.clear(); return fm.setHidden(!fm.hidden); }) }] },
			{ label: 'Sortieren nach', sub: sortItems() },
			{ label: look.style === 'sos' ? 'Original-Stil' : 'ShareOS-Stil', action: toggleStyle }];
	};
	function btnMenu(btn, items) { const r = btn.getBoundingClientRect(); menu(items, Math.min(r.left, innerWidth - 260), r.bottom + 6, { cls: 'dropdown' }); }
	function command(c, btn) {
		switch (c) {
			case 'back': return guard(() => fm.goBack())();
			case 'fwd': return guard(() => fm.goFwd())();
			case 'v-icons': return setView('icons');
			case 'v-list': return setView('list');
			case 'v-cols': return setView('cols');
			case 'sort': return btnMenu(btn, sortItems());
			case 'act': return btnMenu(btn, actItems());
			case 'upload': return $('#up-in').click();
			case 'style': return toggleStyle();
			case 'ql': { const S = fm.selected(); if (S[0]) quickLook(S[0].name); return; }
			case 'download': return guard(() => fm.download(fm.selected().map((e) => e.name)))();
		}
	}
	app.addEventListener('click', (ev) => {
		const b = ev.target.closest('[data-c]');
		if (b && !b.disabled) { command(b.dataset.c, b); return; }
		const h = ev.target.closest('[data-sort]');
		if (h) { fm.setSort(h.dataset.sort); return; }
		const s = ev.target.closest('.si, .pseg');
		if (s) { colCache.clear(); go(s.dataset.root, s.dataset.path); }
	});
	$('#up-in').addEventListener('change', (ev) => { upload(ev.target.files); ev.target.value = ''; });
	q.addEventListener('input', () => { fm.filter = q.value; drawContent(); drawFoot(); });
	q.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { q.value = ''; fm.filter = ''; drawContent(); drawFoot(); content.focus(); } });

	/* items */
	content.addEventListener('mousedown', (ev) => {
		if (ev.target.closest('.ren, .lhead, .prev')) return;
		const it = ev.target.closest('.it');
		if (!it) { if (ev.button === 0 && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey) fm.clearSel(); return; }
		if (it.dataset.col != null) {
			// a folder (or file) in a column to the left: show that folder
			const lvl = +it.dataset.col, parts = fm.path ? fm.path.split('/') : [];
			const base = parts.slice(0, lvl).join('/');
			const e = { name: it.dataset.n, kind: it.dataset.k };
			guard(async () => {
				if (e.kind === 'dir') await fm.go(fm.root, FC.joinPath(base, e.name));
				else { await fm.go(fm.root, base); fm.selectOnly(e.name); }
			})();
			return;
		}
		const n = it.dataset.n;
		if (ev.button === 2 && fm.sel.has(n)) return;
		if (ev.button === 0 && fm.sel.has(n) && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey) { fm.focus = n; return; }
		fm.click(n, ev);
		// column view: a folder opens as the next column at once
		if (view === 'cols' && it.dataset.k === 'dir' && ev.button === 0 && !ev.shiftKey && !ev.metaKey && !ev.ctrlKey) guard(() => fm.open(n))();
	});
	content.addEventListener('click', (ev) => {
		const it = ev.target.closest('.it');
		if (it && it.dataset.col == null && !ev.metaKey && !ev.ctrlKey && !ev.shiftKey && fm.sel.size > 1 && fm.sel.has(it.dataset.n)) fm.selectOnly(it.dataset.n);
	});
	content.addEventListener('dblclick', (ev) => { const it = ev.target.closest('.it'); if (it && it.dataset.col == null && !ev.target.closest('.ren')) openEntry(it.dataset.n); });
	app.addEventListener('contextmenu', (ev) => {
		if (ev.target.closest('input')) return;
		ev.preventDefault();
		const s = ev.target.closest('.si');
		if (s) return menu([{ label: 'Öffnen', action: () => go(s.dataset.root, s.dataset.path) }], ev.clientX, ev.clientY);
		if (!ev.target.closest('.content')) return;
		const it = ev.target.closest('.it');
		if (!it) fm.clearSel();
		menu(actItems(), ev.clientX, ev.clientY);
	});
	content.addEventListener('keydown', (ev) => {
		if (!ev.target.classList.contains('ren')) return;
		if (ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); finishRename(ev.target, true); }
		else if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finishRename(ev.target, false); }
	});
	content.addEventListener('focusout', (ev) => { if (ev.target.classList.contains('ren') && renaming) finishRename(ev.target, true); });

	const cols = () => {
		if (view !== 'icons') return 1;
		const its = content.querySelectorAll('.it');
		if (its.length < 2) return 1;
		const top = its[0].offsetTop;
		let n = 0;
		for (const el of its) { if (el.offsetTop !== top) break; n++; }
		return Math.max(1, n);
	};
	document.addEventListener('keydown', (ev) => {
		if (document.querySelector('.fm-modal, .fm-viewer')) return;
		const inInput = /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName);
		const mod = ev.metaKey || ev.ctrlKey, k = ev.key.toLowerCase();
		if (mod && ev.key === '[') { ev.preventDefault(); command('back'); return; }
		if (mod && ev.key === ']') { ev.preventDefault(); command('fwd'); return; }
		if (mod && ev.key === 'ArrowUp') { ev.preventDefault(); guard(() => fm.goUp())(); return; }
		if (mod && k === 'f') { ev.preventDefault(); q.focus(); q.select(); return; }
		if (mod && ev.shiftKey && k === 'n') { ev.preventDefault(); if (!fm.readOnly) newFolder(); return; }
		if (mod && ['1', '2', '3'].includes(ev.key)) { ev.preventDefault(); setView({ 1: 'icons', 2: 'list', 3: 'cols' }[ev.key]); return; }
		if (inInput) return;
		if (mod && ev.key === 'ArrowDown' || mod && k === 'o') { ev.preventDefault(); const S = fm.selected(); if (S.length === 1) openEntry(S[0].name); return; }
		if (mod && k === 'a') { ev.preventDefault(); fm.selectAll(); return; }
		if (mod && k === 'c') { ev.preventDefault(); fm.copySel(false); return; }
		if (mod && k === 'x') { ev.preventDefault(); if (!fm.readOnly) fm.copySel(true); return; }
		if (mod && ev.altKey && k === 'v') { ev.preventDefault(); if (!fm.readOnly) pasteMove(); return; }
		if (mod && k === 'v') { ev.preventDefault(); if (!fm.readOnly && fm.clip) paste(); return; }
		if (mod && k === 'i') { ev.preventDefault(); getInfo(); return; }
		if ((mod && ev.key === 'Backspace') || ev.key === 'Delete') { ev.preventDefault(); del(); return; }
		if (ev.key === 'Enter') { ev.preventDefault(); startRename(); return; }
		if (ev.key === ' ') { ev.preventDefault(); const S = fm.selected(); if (S.length === 1 && FC.canPreview(S[0])) quickLook(S[0].name); return; }
		if (ev.key === 'Escape') { fm.clearSel(); return; }
		if (view === 'cols' && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) {
			ev.preventDefault();
			if (ev.key === 'ArrowLeft' && fm.path) { const from = FC.baseOf(fm.path); guard(async () => { await fm.goUp(); fm.selectOnly(from); })(); }
			else if (ev.key === 'ArrowRight') { const S = fm.selected(); if (S.length === 1 && S[0].kind === 'dir') guard(async () => { await fm.open(S[0].name); fm.step(1); })(); }
			return;
		}
		const c = cols();
		const steps = { ArrowDown: c, ArrowUp: -c, ArrowRight: c > 1 ? 1 : 0, ArrowLeft: c > 1 ? -1 : 0, Home: -1e6, End: 1e6 };
		if (ev.key in steps && steps[ev.key]) {
			ev.preventDefault();
			fm.step(steps[ev.key], ev);
			// column view: a folder reached with the arrow keys shows its column
			if (view === 'cols') { const S = fm.selected(); if (S.length === 1 && S[0].kind === 'dir') { /* opened with → */ } }
		}
	});

	/* drag & drop: move (⌥/Strg: copy), files from the computer */
	let dragNames = null;
	content.addEventListener('dragstart', (ev) => {
		const it = ev.target.closest('.it');
		if (!it || it.dataset.col != null) { ev.preventDefault(); return; }
		if (!fm.sel.has(it.dataset.n)) fm.selectOnly(it.dataset.n);
		dragNames = [...fm.sel];
		ev.dataTransfer.effectAllowed = 'copyMove';
		ev.dataTransfer.setData('text/plain', dragNames.join('\n'));
	});
	content.addEventListener('dragend', () => { dragNames = null; app.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); });
	function dropTarget(ev) {
		const it = ev.target.closest('.it[data-k="dir"]');
		if (it && it.dataset.col == null && !(dragNames && dragNames.includes(it.dataset.n))) return { el: it, root: fm.root, path: FC.joinPath(fm.path, it.dataset.n), into: it.dataset.n };
		const s = ev.target.closest('.si, .pseg');
		if (s) return { el: s, root: s.dataset.root, path: s.dataset.path };
		if (ev.target.closest('.content')) return { el: content, root: fm.root, path: fm.path, here: true };
		return null;
	}
	app.addEventListener('dragover', (ev) => {
		const t = dropTarget(ev);
		const files = ev.dataTransfer.types.includes('Files');
		if (!t || (!files && !dragNames) || (dragNames && t.here)) return;
		const r = fm.roots.find((x) => x.name === t.root);
		if (r && r.ro) return;
		ev.preventDefault();
		ev.dataTransfer.dropEffect = files || ev.altKey || ev.ctrlKey ? 'copy' : 'move';
		app.querySelectorAll('.drop').forEach((x) => x !== t.el && x.classList.remove('drop'));
		t.el.classList.add('drop');
	});
	app.addEventListener('dragleave', (ev) => { if (ev.target.classList && ev.target.classList.contains('drop')) ev.target.classList.remove('drop'); });
	app.addEventListener('drop', guard(async (ev) => {
		const t = dropTarget(ev);
		app.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop'));
		if (!t) return;
		ev.preventDefault();
		if (ev.dataTransfer.files && ev.dataTransfer.files.length && !dragNames) {
			if (t.root !== fm.root || (!t.here && !t.into)) await fm.go(t.root, t.path);
			return upload(ev.dataTransfer.files, t.into || null);
		}
		if (!dragNames) return;
		const names = dragNames; dragNames = null;
		colCache.clear();
		await fm.dropInto(names, t.root, t.path, ev.altKey || ev.ctrlKey);
	}));

	drawTb(); drawFoot();
	fm.start().catch(() => {});
	window.__finder = { fm };
})();
