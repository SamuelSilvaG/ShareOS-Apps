/*
 * ShareExplorer – file manager for the folders of the box in the style of the
 * Windows file explorer (command bar, address bar, navigation pane, details
 * view, preview pane), switchable to the ShareOS look. Own drawings, no
 * Microsoft artwork. Logic: core.js (FileCore), building blocks: ui.js.
 */
(function () {
	'use strict';
	const { esc, $, T, menu, confirmDlg, info, toast, viewer } = FMUI;
	const app = $('#app');
	const look = FMUI.look(app, 'shareexplorer-style');

	/* ---------- icons (own drawings) ---------- */
	// file colours per kind (original style)
	const KC = { image: '#2f9e6e', video: '#9b4fd1', audio: '#e2536b', text: '#5d7a99', pdf: '#d13438', archive: '#c1891a', doc: '#2b62c9', sheet: '#1f8a4c', slides: '#d35d2a', file: '#7a8794' };
	const GLYPH = {
		image: '<circle cx="12.5" cy="17" r="2" fill="#fff"/><path d="M8 26l5-6 3 3 3-4 5 7z" fill="#fff"/>',
		video: '<path d="M13 15v10l8-5z" fill="#fff"/>',
		audio: '<path d="M18 13v9.5a2.5 2.5 0 1 1-2-2.4V15l6-1.5v7a2.5 2.5 0 1 1-2-2.4V13z" fill="#fff" transform="translate(-1.5 0)"/>',
		text: '<path d="M10 15h12M10 19h12M10 23h8" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
		pdf: '<text x="16" y="24" font-size="7.5" font-weight="700" text-anchor="middle" fill="#fff" font-family="Segoe UI,Arial,sans-serif">PDF</text>',
		archive: '<path d="M15 11h2v2h-2zM17 13h2v2h-2zM15 15h2v2h-2zM17 17h2v2h-2z" fill="#fff"/><rect x="14.5" y="20" width="5" height="5" rx="1" fill="none" stroke="#fff" stroke-width="1.4"/>',
		doc: '<path d="M10 15h12M10 19h12M10 23h12" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>',
		sheet: '<path d="M10 14h12v11H10zM10 18h12M10 22h12M15 14v11" stroke="#fff" stroke-width="1.3" fill="none"/>',
		slides: '<rect x="10" y="15" width="12" height="8" rx="1" fill="none" stroke="#fff" stroke-width="1.5"/><path d="M16 23v3" stroke="#fff" stroke-width="1.5"/>',
		file: ''
	};
	function icoOrig(k, root) {
		if (root === 'usb') return '<svg viewBox="0 0 32 32"><rect x="5" y="10" width="22" height="13" rx="2.5" fill="#8a96a3"/><rect x="5" y="10" width="22" height="13" rx="2.5" fill="none" stroke="#5f6b78"/><circle cx="22" cy="18.5" r="1.4" fill="#5ee36a"/><path d="M8 20.5h9" stroke="#d7dde3" stroke-width="1.4" stroke-linecap="round"/></svg>';
		if (root === 'drive') return '<svg viewBox="0 0 32 32"><rect x="4" y="9" width="24" height="15" rx="2.5" fill="#c7ced6"/><rect x="4" y="18" width="24" height="6" rx="2" fill="#9aa5b0"/><circle cx="23.5" cy="21" r="1.3" fill="#3ccf5a"/><path d="M8 13h12" stroke="#fff" stroke-width="1.4" stroke-linecap="round" opacity=".7"/></svg>';
		if (root === 'home') return '<svg viewBox="0 0 32 32"><path d="M3 10.5A2.5 2.5 0 0 1 5.5 8h6.6l2.6 2.6H26.5A2.5 2.5 0 0 1 29 13.1V24a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 24z" fill="#e8a600"/><path d="M3 13.5A2.5 2.5 0 0 1 5.5 11h21a2.5 2.5 0 0 1 2.5 2.5V24a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 24z" fill="#ffc83d"/><circle cx="16" cy="17" r="2.6" fill="#2b62c9"/><path d="M11.2 24c.6-2.7 2.5-4 4.8-4s4.2 1.3 4.8 4z" fill="#2b62c9"/></svg>';
		if (root === 'pc') return '<svg viewBox="0 0 32 32"><rect x="4" y="6" width="24" height="16" rx="2" fill="#2b62c9"/><rect x="6" y="8" width="20" height="12" rx="1" fill="#6cb4ff"/><path d="M12 26h8M16 22v4" stroke="#7a8794" stroke-width="2" stroke-linecap="round"/></svg>';
		if (k === 'dir') return '<svg viewBox="0 0 32 32"><path d="M3 10.5A2.5 2.5 0 0 1 5.5 8h6.6l2.6 2.6H26.5A2.5 2.5 0 0 1 29 13.1V24a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 24z" fill="#e8a600"/><path d="M3 13.5A2.5 2.5 0 0 1 5.5 11h21a2.5 2.5 0 0 1 2.5 2.5V24a2.5 2.5 0 0 1-2.5 2.5h-21A2.5 2.5 0 0 1 3 24z" fill="#ffc83d"/><path d="M3 13.5A2.5 2.5 0 0 1 5.5 11h21a2.5 2.5 0 0 1 2.5 2.5v.6H3z" fill="#ffd968"/></svg>';
		const c = KC[k] || KC.file;
		return `<svg viewBox="0 0 32 32"><path d="M7 3.5h12.5L26 10v17a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 6 27V5a1.5 1.5 0 0 1 1-1.5z" fill="#fff" stroke="#b9c0c8"/><path d="M19.5 3.5V10H26" fill="#e9edf1" stroke="#b9c0c8" stroke-linejoin="round"/>${k === 'file' ? '' : `<rect x="8" y="12" width="16" height="15" rx="1.5" fill="${c}"/>${GLYPH[k] || ''}`}</svg>`;
	}
	// ShareOS style: line drawings in the accent colour
	function icoSos(k, root) {
		const s = (d) => `<svg viewBox="0 0 32 32" class="sosi">${d}</svg>`;
		if (root === 'usb') return s('<rect x="5" y="11" width="22" height="11" rx="2"/><path d="M22 16.5h.01M9 19h8"/>');
		if (root === 'drive') return s('<rect x="4" y="9" width="24" height="15" rx="2"/><path d="M4 18h24M23 21h.01"/>');
		if (root === 'home') return s('<path d="M5 15l11-9 11 9M8 13v13h16V13"/><path d="M14 26v-7h4v7"/>');
		if (root === 'pc') return s('<rect x="4" y="6" width="24" height="16" rx="2"/><path d="M12 26h8M16 22v4"/>');
		if (k === 'dir') return s('<path d="M4 10a2 2 0 0 1 2-2h6l3 3h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/>');
		const g = { image: '<circle cx="13" cy="15" r="2"/><path d="M9 24l5-5 3 3 3-3 3 5"/>', video: '<path d="M14 14v8l6-4z"/>', audio: '<path d="M18 13v8.5a2 2 0 1 1-2-2"/>',
			text: '<path d="M10 14h12M10 18h12M10 22h8"/>', pdf: '<path d="M10 22h12M10 18h12"/>', archive: '<path d="M16 8v4M16 14v2M14 18h4v4h-4z"/>',
			doc: '<path d="M10 14h12M10 18h12M10 22h12"/>', sheet: '<path d="M10 14h12v9H10zM10 18.5h12M16 14v9"/>', slides: '<rect x="10" y="14" width="12" height="8"/>', file: '' }[k] || '';
		return s(`<path d="M8 4h11l6 6v17a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/><path d="M19 4v6h6"/>${g}`);
	}
	const ico = (k, root) => (look.style === 'sos' ? icoSos(k, root) : icoOrig(k, root));
	// small line icons of the command bar (both styles)
	const CI = {
		new: '<path d="M10 4v12M4 10h12"/>', cut: '<circle cx="6" cy="14" r="2.5"/><circle cx="14" cy="14" r="2.5"/><path d="M7.5 12L15 3M12.5 12L5 3"/>',
		copy: '<rect x="7" y="7" width="9" height="10" rx="1.5"/><path d="M4 13V4.5A1.5 1.5 0 0 1 5.5 3H12"/>', paste: '<rect x="4.5" y="4" width="11" height="13" rx="1.5"/><path d="M7.5 4V2.8h5V4"/>',
		rename: '<path d="M3 15h4l9-9-4-4-9 9z"/><path d="M11 3l4 4"/>', del: '<path d="M4 5h12M8 5V3h4v2M5.5 5l1 12h7l1-12"/>',
		sort: '<path d="M6 3v14M3 14l3 3 3-3M14 17V3M11 6l3-3 3 3"/>', view: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
		up: '<path d="M10 16V4M5 9l5-5 5 5"/>', upload: '<path d="M10 13V3M6 7l4-4 4 4M3 13v3h14v-3"/>', download: '<path d="M10 3v10M6 9l4 4 4-4M3 14v3h14v-3"/>',
		more: '<circle cx="4" cy="10" r="1.3"/><circle cx="10" cy="10" r="1.3"/><circle cx="16" cy="10" r="1.3"/>',
		back: '<path d="M16 10H4M9 5l-5 5 5 5"/>', fwd: '<path d="M4 10h12M11 5l5 5-5 5"/>', refresh: '<path d="M16 10a6 6 0 1 1-1.8-4.3M16 3v4h-4"/>',
		search: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.5 12.5L17 17"/>', pane: '<rect x="3" y="4" width="14" height="12" rx="1.5"/><path d="M11 4v12"/>',
		details: '<path d="M3 5h14M3 10h14M3 15h14"/>', tiles: '<rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/>',
		style: '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 0 0 14z" fill="currentColor"/>', chev: '<path d="M7 4l6 6-6 6"/>', down: '<path d="M5 8l5 5 5-5"/>', info: '<circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6.5v.01"/>'
	};
	const ci = (n) => `<svg class="ci" viewBox="0 0 20 20" aria-hidden="true">${CI[n]}</svg>`;

	/* ---------- state ---------- */
	const fm = new FileCore({ onChange, store: 'shareexplorer' });
	const P = fm.prefs();
	let view = P.view || 'details';          // details | tiles | list
	let pane = P.pane !== false;               // preview/details pane on the right
	const tree = new Map();                    // "root/path" -> { open, kids }
	let renaming = null;
	let upl = null;                            // upload progress text

	/* ---------- skeleton ---------- */
	app.innerHTML = `
	<div class="cmd" role="toolbar" aria-label="Befehle">
		<button type="button" class="cb primary" data-c="new">${ci('new')}<span>Neu</span>${ci('down')}</button>
		<span class="sep"></span>
		<button type="button" class="cb ic" data-c="cut" title="Ausschneiden (Strg+X)" aria-label="Ausschneiden">${ci('cut')}</button>
		<button type="button" class="cb ic" data-c="copy" title="Kopieren (Strg+C)" aria-label="Kopieren">${ci('copy')}</button>
		<button type="button" class="cb ic" data-c="paste" title="Einfügen (Strg+V)" aria-label="Einfügen">${ci('paste')}</button>
		<button type="button" class="cb ic" data-c="rename" title="Umbenennen (F2)" aria-label="Umbenennen">${ci('rename')}</button>
		<button type="button" class="cb ic" data-c="del" title="Löschen (Entf)" aria-label="Löschen">${ci('del')}</button>
		<span class="sep"></span>
		<button type="button" class="cb" data-c="sort">${ci('sort')}<span>Sortieren</span>${ci('down')}</button>
		<button type="button" class="cb" data-c="view">${ci('view')}<span>Anzeigen</span>${ci('down')}</button>
		<span class="sep"></span>
		<button type="button" class="cb" data-c="upload" title="Dateien vom Computer hochladen">${ci('upload')}<span>Hochladen</span></button>
		<button type="button" class="cb ic" data-c="download" title="Herunterladen" aria-label="Herunterladen">${ci('download')}</button>
		<span class="grow"></span>
		<button type="button" class="cb" data-c="style" title="Zwischen Original- und ShareOS-Stil wechseln">${ci('style')}<span class="stl"></span></button>
		<button type="button" class="cb ic" data-c="pane" title="Detailbereich ein/aus (Alt+Umschalt+P)" aria-label="Detailbereich">${ci('pane')}</button>
		<input type="file" id="up-in" multiple hidden>
	</div>
	<div class="addr">
		<button type="button" class="nb" data-c="back" title="Zurück (Alt+←)" aria-label="Zurück">${ci('back')}</button>
		<button type="button" class="nb" data-c="fwd" title="Vorwärts (Alt+→)" aria-label="Vorwärts">${ci('fwd')}</button>
		<button type="button" class="nb" data-c="up" title="Nach oben (Alt+↑)" aria-label="Nach oben">${ci('up')}</button>
		<button type="button" class="nb" data-c="refresh" title="Aktualisieren (F5)" aria-label="Aktualisieren">${ci('refresh')}</button>
		<div class="crumbs" tabindex="0" aria-label="Adresse"></div>
		<label class="search">${ci('search')}<input type="search" id="q" spellcheck="false" autocomplete="off"></label>
	</div>
	<div class="main">
		<nav class="nav" aria-label="Navigationsbereich"></nav>
		<div class="splitter" data-split="nav"></div>
		<section class="content" tabindex="0" aria-label="Dateien"></section>
		<div class="splitter" data-split="pane"></div>
		<aside class="pane" aria-label="Detailbereich"></aside>
	</div>
	<footer class="status"><span class="st-count"></span><span class="st-sel"></span><span class="st-up"></span><span class="grow"></span>
		<button type="button" class="vb" data-c="v-details" title="Details" aria-label="Details">${ci('details')}</button>
		<button type="button" class="vb" data-c="v-tiles" title="Große Symbole" aria-label="Große Symbole">${ci('tiles')}</button></footer>`;
	const content = $('.content'), nav = $('.nav'), paneEl = $('.pane'), crumbs = $('.crumbs'), q = $('#q');
	if (P.navW) app.style.setProperty('--nav-w', P.navW + 'px');
	if (P.paneW) app.style.setProperty('--pane-w', P.paneW + 'px');

	/* ---------- drawing ---------- */
	function onChange(what) {
		if (what === 'error') return drawError();
		if (what === 'roots') { drawNav(); return; }
		if (what === 'busy') { app.classList.toggle('busy', fm.busy > 0); return; }
		if (what === 'list') { drawCrumbs(); drawContent(); drawNav(); drawPane(); drawStatus(); drawCmd(); return; }
		if (what === 'sel') { markSel(); drawPane(); drawStatus(); drawCmd(); return; }
		if (what === 'clip') { drawContent(); drawCmd(); }
	}
	function drawError() {
		const e = fm.error;
		const msg = e === 'nofs' ? (window.ShareOS && ShareOS.embedded !== undefined && ShareOS.app
			? 'Diese App braucht den Zugriff auf die Dateien der Box. Der Admin schaltet ihn unter Benutzer → „Dateien“ ein.'
			: 'ShareExplorer läuft in ShareOS: dort unter Apps öffnen.')
			: e === 'noroots' ? 'Für dieses Konto gibt es weder einen persönlichen Ordner noch eine Freigabe.' : e;
		if (!fm.root) { content.innerHTML = `<div class="empty big">${ico('dir')}<p>${esc(T(msg))}</p></div>`; drawStatus(); return; }
		toast(msg, true);
	}
	function rootKind(r) { return r.usb ? 'usb' : r.home || r.personal ? 'home' : 'drive'; }
	function drawCrumbs() {
		const r = fm.rootInfo;
		const parts = fm.path ? fm.path.split('/') : [];
		let acc = '';
		crumbs.innerHTML = `<span class="cico">${ico('dir', r ? rootKind(r) : 'drive')}</span>`
			+ `<button type="button" class="crumb" data-root="${esc(fm.root)}" data-path="">${esc(fm.rootLabel(r))}</button>`
			+ parts.map((p) => { acc = acc ? acc + '/' + p : p; return `<span class="csep">${ci('chev')}</span><button type="button" class="crumb" data-i18n-skip data-root="${esc(fm.root)}" data-path="${esc(acc)}">${esc(p)}</button>`; }).join('');
		q.placeholder = T('Durchsuchen: ') + (parts.length ? parts[parts.length - 1] : fm.rootLabel(r));
		document.title = (parts.length ? parts[parts.length - 1] : fm.rootLabel(r)) + ' – ShareExplorer';
		$('[data-c="back"]').disabled = !fm.back.length;
		$('[data-c="fwd"]').disabled = !fm.fwd.length;
		$('[data-c="up"]').disabled = !fm.path;
	}
	const sizeOf = (e) => (e.kind === 'dir' ? '' : FC.fmtSize(e.size));
	function drawContent() {
		const L = fm.view();
		const sortArrow = (by) => (fm.sort.by === by ? `<span class="arr">${fm.sort.dir > 0 ? '▲' : '▼'}</span>` : '');
		content.classList.toggle('v-details', view === 'details');
		content.classList.toggle('v-tiles', view === 'tiles');
		content.classList.toggle('v-list', view === 'list');
		if (!L.length) {
			content.innerHTML = view === 'details' ? head() + `<div class="empty">${esc(T(fm.filter ? 'Keine Elemente entsprechen dem Suchbegriff.' : 'Dieser Ordner ist leer.'))}</div>` : `<div class="empty">${esc(T(fm.filter ? 'Keine Elemente entsprechen dem Suchbegriff.' : 'Dieser Ordner ist leer.'))}</div>`;
			return;
		}
		function head() {
			return `<div class="thead" role="row"><button type="button" class="th name" data-sort="name">Name${sortArrow('name')}</button>
				<button type="button" class="th date" data-sort="mtime">Änderungsdatum${sortArrow('mtime')}</button>
				<button type="button" class="th type" data-sort="type">Typ${sortArrow('type')}</button>
				<button type="button" class="th size" data-sort="size">Größe${sortArrow('size')}</button></div>`;
		}
		const row = (e) => {
			const cut = fm.isCut(e.name) ? ' cut' : '', sel = fm.sel.has(e.name) ? ' sel' : '';
			const nm = renaming === e.name ? `<input class="ren" value="${esc(e.name)}" spellcheck="false">` : `<span class="nm" data-i18n-skip>${esc(e.name)}</span>`;
			if (view === 'details') return `<div class="it row${sel}${cut}" role="row" draggable="true" data-n="${esc(e.name)}" data-k="${e.kind}" aria-selected="${!!sel}">
				<span class="td name"><span class="ico">${ico(e.kind)}</span>${nm}</span>
				<span class="td date">${esc(FC.fmtDate(e.mtime))}</span><span class="td type">${esc(T(FC.typeName(e)))}</span><span class="td size">${esc(sizeOf(e))}</span></div>`;
			return `<div class="it tile${sel}${cut}" role="option" draggable="true" data-n="${esc(e.name)}" data-k="${e.kind}" aria-selected="${!!sel}" title="${esc(e.name)}">
				<span class="ico">${ico(e.kind)}</span>${nm}${view === 'list' ? '' : ''}</div>`;
		};
		content.innerHTML = (view === 'details' ? head() : '') + `<div class="items" role="${view === 'details' ? 'grid' : 'listbox'}" aria-multiselectable="true">${L.map(row).join('')}</div>`;
		thumbs();
		const r = $('.ren', content);
		if (r) {
			r.focus();
			const dot = r.value.lastIndexOf('.');
			r.setSelectionRange(0, dot > 0 && fm.entry(renaming)?.kind !== 'dir' ? dot : r.value.length);
		}
	}
	// pictures as thumbnails in the large icons view (loaded lazily from the box)
	let thumbObs = null;
	function thumbs() {
		if (view !== 'tiles') return;
		thumbObs?.disconnect();
		thumbObs = new IntersectionObserver((list) => {
			for (const x of list) {
				if (!x.isIntersecting) continue;
				thumbObs.unobserve(x.target);
				const n = x.target.dataset.n;
				fm.fileOf(n).then((f) => { const s = $('.ico', x.target); if (s) s.innerHTML = `<img class="thumb" alt="" loading="lazy" src="${esc(f.url)}">`; }).catch(() => {});
			}
		}, { root: content });
		content.querySelectorAll('.it[data-k="image"]').forEach((el) => { if ((fm.entry(el.dataset.n)?.size || 0) < 15e6) thumbObs.observe(el); });
	}
	function markSel() {
		content.querySelectorAll('.it').forEach((el) => {
			const on = fm.sel.has(el.dataset.n);
			el.classList.toggle('sel', on); el.setAttribute('aria-selected', String(on));
			el.classList.toggle('focus', el.dataset.n === fm.focus);
		});
		const f = fm.focus && content.querySelector(`.it[data-n="${CSS.escape(fm.focus)}"]`);
		if (f) f.scrollIntoView({ block: 'nearest' });
	}
	function drawStatus() {
		const L = fm.view();
		$('.st-count').textContent = fm.root ? `${L.length} ${T(L.length === 1 ? 'Element' : 'Elemente')}` : '';
		const S = fm.selected();
		const bytes = S.filter((e) => e.kind !== 'dir').reduce((a, e) => a + (e.size || 0), 0);
		$('.st-sel').textContent = S.length ? `${S.length} ${T(S.length === 1 ? 'Element ausgewählt' : 'Elemente ausgewählt')}${bytes ? '  ' + FC.fmtSize(bytes) : ''}` : '';
		$('.st-up').textContent = upl || (fm.free != null ? FC.fmtSize(fm.free) + ' ' + T('frei') : '');
		$('[data-c="v-details"]').classList.toggle('on', view === 'details');
		$('[data-c="v-tiles"]').classList.toggle('on', view === 'tiles');
	}
	function drawCmd() {
		const S = fm.selected(), ro = fm.readOnly;
		$('[data-c="new"]').disabled = ro || !fm.root;
		$('[data-c="cut"]').disabled = ro || !S.length;
		$('[data-c="copy"]').disabled = !S.length;
		$('[data-c="paste"]').disabled = ro || !fm.clip;
		$('[data-c="rename"]').disabled = ro || S.length !== 1;
		$('[data-c="del"]').disabled = ro || !S.length;
		$('[data-c="upload"]').disabled = ro || !fm.root;
		$('[data-c="download"]').disabled = !S.some((e) => e.kind !== 'dir');
		$('.stl').textContent = T(look.style === 'sos' ? 'Original-Stil' : 'ShareOS-Stil');
		$('[data-c="pane"]').classList.toggle('on', pane);
		app.classList.toggle('no-pane', !pane);
	}
	async function drawPane() {
		if (!pane) return;
		const S = fm.selected();
		if (!S.length) {
			const r = fm.rootInfo;
			paneEl.innerHTML = `<div class="pv-empty">${ico('dir', r ? rootKind(r) : 'drive')}<p>${esc(T(fm.view().length ? 'Element auswählen, um die Details anzuzeigen.' : 'Dieser Ordner ist leer.'))}</p></div>`;
			return;
		}
		if (S.length > 1) {
			const bytes = S.filter((e) => e.kind !== 'dir').reduce((a, e) => a + (e.size || 0), 0);
			paneEl.innerHTML = `<div class="pv-head"><span class="pv-ico">${ico('file')}</span><h3>${S.length} ${esc(T('Elemente ausgewählt'))}</h3></div>
				<dl class="pv-props"><dt>Größe</dt><dd>${esc(FC.fmtSize(bytes))}</dd></dl>`;
			return;
		}
		const e = S[0];
		paneEl.innerHTML = `<div class="pv-media"></div><div class="pv-head"><span class="pv-ico">${ico(e.kind)}</span><h3 data-i18n-skip>${esc(e.name)}</h3></div>
			<dl class="pv-props"><dt>Typ</dt><dd>${esc(T(FC.typeName(e)))}</dd>
			${e.kind !== 'dir' ? `<dt>Größe</dt><dd>${esc(FC.fmtSize(e.size))}</dd>` : ''}
			<dt>Geändert</dt><dd>${esc(FC.fmtDate(e.mtime, true))}</dd>
			<dt>Ort</dt><dd>${esc(fm.rootLabel(fm.rootInfo) + (fm.path ? '/' + fm.path : ''))}</dd></dl>
			${e.kind !== 'dir' ? `<div class="pv-acts"><button type="button" class="fm-btn" data-c="open">${FC.canPreview(e) ? 'Öffnen' : 'Herunterladen'}</button>${FC.canPreview(e) ? '<button type="button" class="fm-btn" data-c="download">Herunterladen</button>' : ''}</div>` : ''}`;
		const box = $('.pv-media', paneEl);
		if (['image', 'video', 'audio', 'text', 'pdf'].includes(e.kind) && (e.kind !== 'image' || (e.size || 0) < 25e6)) {
			try {
				const f = await fm.fileOf(e.name);
				if (fm.selected()[0] !== e) return;
				if (e.kind === 'image') box.innerHTML = `<img alt="" src="${esc(f.url)}">`;
				else if (e.kind === 'video') box.innerHTML = `<video controls preload="metadata" src="${esc(f.url)}"></video>`;
				else if (e.kind === 'audio') box.innerHTML = `<audio controls preload="metadata" src="${esc(f.url)}"></audio>`;
				else if (e.kind === 'pdf') box.innerHTML = `<iframe title="${esc(e.name)}" src="${esc(f.url)}"></iframe>`;
				else { const t = await fm.readText(e.name, 8192); if (fm.selected()[0] !== e) return; box.innerHTML = '<pre></pre>'; $('pre', box).textContent = t; }
			} catch (err) { /* preview is optional */ }
		}
	}

	/* navigation pane: personal folder, the box with its folders (a tree) */
	async function drawNav() {
		const R = fm.roots;
		const node = (root, path, label, kind, depth) => {
			const key = root + '/' + path, t = tree.get(key) || {};
			const cur = fm.root === root && fm.path === path;
			const kids = t.open && t.kids ? t.kids.map((n) => node(root, path ? path + '/' + n : n, n, 'dir', depth + 1)).join('') : '';
			return `<div class="tn${cur ? ' cur' : ''}" data-root="${esc(root)}" data-path="${esc(path)}" style="--d:${depth}">
				<button type="button" class="tw${t.open ? ' open' : ''}${t.kids && !t.kids.length ? ' leaf' : ''}" data-tw="${esc(key)}" aria-label="${esc(T(t.open ? 'Zuklappen' : 'Aufklappen'))}">${ci('chev')}</button>
				<span class="tico">${ico('dir', kind === 'dir' ? null : kind)}</span><span class="tl"${kind === 'dir' || kind === 'drive' || kind === 'usb' ? ' data-i18n-skip' : ''}>${esc(label)}</span></div>${kids}`;
		};
		const home = R.filter((r) => r.home || r.personal || r.name === 'app');
		const shares = R.filter((r) => !(r.home || r.personal || r.name === 'app'));
		nav.innerHTML = `<div class="ngroup">${home.map((r) => node(r.name, '', fm.rootLabel(r), 'home', 0)).join('')}</div>
			<div class="ngroup"><div class="nhead"><span class="tico">${ico('dir', 'pc')}</span><span>${esc(T('Diese Box'))}</span></div>
			${shares.map((r) => node(r.name, '', r.name + (r.ro ? ' 🔒' : ''), rootKind(r), 1)).join('')}</div>`;
	}
	async function toggleTree(key, open) {
		const t = tree.get(key) || {};
		t.open = open ?? !t.open;
		tree.set(key, t);
		if (t.open && !t.kids) {
			const i = key.indexOf('/');
			t.kids = await fm.subdirs(key.slice(0, i), key.slice(i + 1));
		}
		drawNav();
	}
	// the tree follows the folder shown (its parents open)
	async function revealInTree() {
		const parts = fm.path ? fm.path.split('/') : [];
		let p = '';
		for (let i = 0; i < parts.length; i++) {
			const key = fm.root + '/' + p, t = tree.get(key) || {};
			if (!t.open || !t.kids) { t.open = true; t.kids = await fm.subdirs(fm.root, p); tree.set(key, t); }
			p = p ? p + '/' + parts[i] : parts[i];
		}
		drawNav();
	}

	/* ---------- actions ---------- */
	const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message || String(e), true); } };
	const go = guard(async (root, path) => { await fm.go(root, path); revealInTree(); });
	const openEntry = guard(async (name) => {
		const e = fm.entry(name);
		if (!e) return;
		if (e.kind === 'dir') { await fm.open(name); revealInTree(); return; }
		if (FC.canPreview(e)) viewer(fm, name, { onClose: (n) => { fm.selectOnly(n); content.focus(); } });
		else await fm.download([name]);
	});
	const newFolder = guard(async () => {
		const n = await fm.mkdir(fm.freeName(T('Neuer Ordner'), true));
		renaming = n; drawContent();
	});
	const newText = guard(async () => {
		const n = await fm.newFile(fm.freeName(T('Neues Textdokument') + '.txt', false));
		renaming = n; drawContent();
	});
	function startRename() { const S = fm.selected(); if (S.length !== 1 || fm.readOnly) return; renaming = S[0].name; drawContent(); }
	const finishRename = guard(async (input, keep) => {
		const from = renaming;
		renaming = null;
		if (!keep || !from) { drawContent(); markSel(); return; }
		try { await fm.rename(from, input.value); } catch (e) { drawContent(); throw e; }
	});
	const del = guard(async () => {
		const S = fm.selected();
		if (!S.length || fm.readOnly) return;
		const what = S.length === 1 ? `„${S[0].name}“` : `${S.length} ${T('Elemente')}`;
		const dirs = S.some((e) => e.kind === 'dir');
		if (!await confirmDlg(S.length === 1 ? (dirs ? 'Ordner löschen' : 'Datei löschen') : 'Elemente löschen',
			`${T('Soll')} ${what} ${T('endgültig gelöscht werden?')} ${dirs ? T('Ordner werden mit ihrem ganzen Inhalt gelöscht.') : ''} ${T('Auf der Box gibt es keinen Papierkorb.')}`, 'Löschen', true)) return;
		await fm.remove(S.map((e) => e.name));
		toast(S.length === 1 ? 'Gelöscht.' : `${S.length} ${T('Elemente gelöscht.')}`);
	});
	const paste = guard(async (into) => { await fm.paste(into); toast('Eingefügt.'); });
	const upload = guard(async (files, into) => {
		if (!files || !files.length || fm.readOnly) return;
		const back = into ? { root: fm.root, path: fm.path } : null;
		if (into) await fm.go(fm.root, FC.joinPath(fm.path, into));
		try {
			await fm.upload(files, (i, n, name) => { upl = i < n ? `${T('Hochladen')} ${i + 1}/${n}: ${name}` : null; drawStatus(); });
			toast(files.length === 1 ? 'Hochgeladen.' : `${files.length} ${T('Dateien hochgeladen.')}`);
		} finally { upl = null; drawStatus(); if (back) await fm.go(back.root, back.path, false); }
	});
	const props = guard(async () => {
		const S = fm.selected();
		const e = S[0] || null;
		const loc = fm.rootLabel(fm.rootInfo) + (fm.path ? '/' + fm.path : '');
		if (!e) {
			const r = fm.rootInfo;
			return info(T('Eigenschaften'), false, `<dl class="pv-props"><dt>Ort</dt><dd>${esc(loc)}</dd><dt>Inhalt</dt><dd>${fm.entries.length} ${esc(T('Elemente'))}</dd>
				${fm.free != null ? `<dt>Frei</dt><dd>${esc(FC.fmtSize(fm.free))}${fm.total ? ' / ' + esc(FC.fmtSize(fm.total)) : ''}</dd>` : ''}<dt>Zugriff</dt><dd>${esc(T(r && r.ro ? 'nur lesen' : 'lesen und schreiben'))}</dd></dl>`);
		}
		const bytes = S.filter((x) => x.kind !== 'dir').reduce((a, x) => a + (x.size || 0), 0);
		info(S.length === 1 ? e.name : `${S.length} ${T('Elemente')}`, S.length === 1, `<div class="pi-head">${ico(S.length === 1 ? e.kind : 'file')}</div><dl class="pv-props">
			${S.length === 1 ? `<dt>Typ</dt><dd>${esc(T(FC.typeName(e)))}</dd>` : ''}<dt>Ort</dt><dd>${esc(loc)}</dd>
			<dt>Größe</dt><dd>${esc(FC.fmtSize(bytes))}${S.some((x) => x.kind === 'dir') ? ' ' + esc(T('(ohne Ordnerinhalt)')) : ''}</dd>
			${S.length === 1 ? `<dt>Geändert</dt><dd>${esc(FC.fmtDate(e.mtime, true))}</dd>` : ''}</dl>`);
	});
	function setView(v) { view = v; fm.savePrefs({ view }); drawContent(); drawStatus(); }
	function togglePane() { pane = !pane; fm.savePrefs({ pane }); drawCmd(); drawPane(); }
	function toggleStyle() { look.toggle(); drawNav(); drawCrumbs(); drawContent(); drawPane(); drawCmd(); }
	const sortItems = () => [
		{ label: 'Name', checked: fm.sort.by === 'name', action: () => fm.setSort('name') },
		{ label: 'Änderungsdatum', checked: fm.sort.by === 'mtime', action: () => fm.setSort('mtime') },
		{ label: 'Typ', checked: fm.sort.by === 'type', action: () => fm.setSort('type') },
		{ label: 'Größe', checked: fm.sort.by === 'size', action: () => fm.setSort('size') }, '-',
		{ label: 'Aufsteigend', checked: fm.sort.dir > 0, action: () => { if (fm.sort.dir < 0) { fm.sort.dir = 1; fm.savePrefs(); onChange('list'); } } },
		{ label: 'Absteigend', checked: fm.sort.dir < 0, action: () => { if (fm.sort.dir > 0) { fm.sort.dir = -1; fm.savePrefs(); onChange('list'); } } }];
	const viewItems = () => [
		{ label: 'Große Symbole', icon: ci('tiles'), checked: view === 'tiles', action: () => setView('tiles') },
		{ label: 'Liste', icon: ci('details'), checked: view === 'list', action: () => setView('list') },
		{ label: 'Details', icon: ci('details'), checked: view === 'details', action: () => setView('details') }, '-',
		{ label: 'Detailbereich', checked: pane, action: togglePane },
		{ label: 'Ausgeblendete Elemente', checked: fm.hidden, action: guard(() => fm.setHidden(!fm.hidden)) }, '-',
		{ label: look.style === 'sos' ? 'Original-Stil' : 'ShareOS-Stil', icon: ci('style'), action: toggleStyle }];
	const newItems = () => [
		{ label: 'Ordner', icon: ico('dir'), kbd: 'Strg+Umschalt+N', action: newFolder },
		{ label: 'Textdokument', icon: ico('text'), action: newText }];
	function btnMenu(btn, items) { const r = btn.getBoundingClientRect(); menu(items, r.left, r.bottom + 4, { cls: 'dropdown' }); }

	function command(c, btn) {
		switch (c) {
			case 'new': return btnMenu(btn, newItems());
			case 'cut': fm.copySel(true); return drawContent();
			case 'copy': fm.copySel(false); return toast(fm.sel.size === 1 ? 'In die Zwischenablage kopiert.' : `${fm.sel.size} ${T('Elemente kopiert.')}`);
			case 'paste': return paste();
			case 'rename': return startRename();
			case 'del': return del();
			case 'sort': return btnMenu(btn, sortItems());
			case 'view': return btnMenu(btn, viewItems());
			case 'upload': return $('#up-in').click();
			case 'download': return guard(() => fm.download(fm.selected().map((e) => e.name)))();
			case 'style': return toggleStyle();
			case 'pane': return togglePane();
			case 'back': return guard(async () => { await fm.goBack(); revealInTree(); })();
			case 'fwd': return guard(async () => { await fm.goFwd(); revealInTree(); })();
			case 'up': return guard(async () => { await fm.goUp(); revealInTree(); })();
			case 'refresh': tree.clear(); return guard(async () => { await fm.reload(); revealInTree(); })();
			case 'v-details': return setView('details');
			case 'v-tiles': return setView('tiles');
			case 'open': { const S = fm.selected(); if (S[0]) openEntry(S[0].name); return; }
		}
	}
	app.addEventListener('click', (ev) => {
		const b = ev.target.closest('[data-c]');
		if (b && !b.disabled) { command(b.dataset.c, b); return; }
		const th = ev.target.closest('[data-sort]');
		if (th) { fm.setSort(th.dataset.sort); return; }
		const cr = ev.target.closest('.crumb');
		if (cr) { go(cr.dataset.root, cr.dataset.path); return; }
		const tw = ev.target.closest('[data-tw]');
		if (tw) { toggleTree(tw.dataset.tw); return; }
		const tn = ev.target.closest('.tn');
		if (tn) { go(tn.dataset.root, tn.dataset.path); return; }
	});
	$('#up-in').addEventListener('change', (ev) => { upload(ev.target.files); ev.target.value = ''; });
	q.addEventListener('input', () => { fm.filter = q.value; drawContent(); drawStatus(); });
	q.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { q.value = ''; fm.filter = ''; drawContent(); drawStatus(); content.focus(); } if (ev.key === 'ArrowDown') { content.focus(); fm.step(1); } });

	// address as text: a click into the free part of the bar
	crumbs.addEventListener('click', (ev) => {
		if (ev.target !== crumbs) return;
		const r = fm.rootInfo;
		const cur = fm.rootLabel(r) + (fm.path ? '/' + fm.path : '');
		crumbs.innerHTML = `<input class="addr-in" value="${esc(cur)}" spellcheck="false">`;
		const inp = $('.addr-in', crumbs);
		inp.focus(); inp.select();
		const done = guard(async (goTo) => {
			if (!goTo) { drawCrumbs(); return; }
			const v = inp.value.trim().replace(/^\/+|\/+$/g, '');
			const first = v.split('/')[0], rest = v.split('/').slice(1).join('/');
			const root = fm.roots.find((x) => fm.rootLabel(x) === first || x.name === first);
			if (!root) { drawCrumbs(); throw new Error(T('Ordner nicht gefunden:') + ' ' + v); }
			await go(root.name, rest);
		});
		inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); done(true); } if (e.key === 'Escape') done(false); });
		inp.addEventListener('blur', () => setTimeout(() => { if (crumbs.contains(inp)) drawCrumbs(); }, 150));
	});

	/* items: select, open, context menu */
	content.addEventListener('mousedown', (ev) => {
		if (ev.target.closest('.ren, .thead')) return;
		const it = ev.target.closest('.it');
		if (!it) { if (ev.button === 0 && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) fm.clearSel(); return; }
		const n = it.dataset.n;
		if (ev.button === 2 && fm.sel.has(n)) return;
		if (ev.button === 0 && fm.sel.has(n) && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey) { fm.focus = n; return; }   // keep for dragging
		fm.click(n, ev);
	});
	content.addEventListener('click', (ev) => {
		const it = ev.target.closest('.it');
		if (it && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && fm.sel.size > 1 && fm.sel.has(it.dataset.n)) fm.selectOnly(it.dataset.n);
	});
	content.addEventListener('dblclick', (ev) => { const it = ev.target.closest('.it'); if (it && !ev.target.closest('.ren')) openEntry(it.dataset.n); });
	app.addEventListener('contextmenu', (ev) => {
		if (ev.target.closest('input')) return;
		ev.preventDefault();
		const tn = ev.target.closest('.tn');
		if (tn) {
			return menu([{ label: 'Öffnen', action: () => go(tn.dataset.root, tn.dataset.path) },
				{ label: 'Aufklappen', action: () => toggleTree(tn.dataset.root + '/' + tn.dataset.path, true) }], ev.clientX, ev.clientY);
		}
		if (!ev.target.closest('.content')) return;
		const it = ev.target.closest('.it');
		const ro = fm.readOnly;
		if (it) {
			const S = fm.selected(), one = S.length === 1 ? S[0] : null;
			return menu([
				one ? { label: one.kind === 'dir' ? 'Öffnen' : FC.canPreview(one) ? 'Öffnen' : 'Herunterladen', icon: '', kbd: 'Eingabe', action: () => openEntry(one.name) } : null,
				S.some((e) => e.kind !== 'dir') ? { label: 'Herunterladen', icon: ci('download'), action: () => command('download') } : null, '-',
				{ label: 'Ausschneiden', icon: ci('cut'), kbd: 'Strg+X', disabled: ro, action: () => command('cut') },
				{ label: 'Kopieren', icon: ci('copy'), kbd: 'Strg+C', action: () => command('copy') },
				one && one.kind === 'dir' && fm.clip ? { label: 'In Ordner einfügen', icon: ci('paste'), disabled: ro, action: () => paste(one.name) } : null, '-',
				{ label: 'Umbenennen', icon: ci('rename'), kbd: 'F2', disabled: ro || !one, action: startRename },
				{ label: 'Löschen', icon: ci('del'), kbd: 'Entf', disabled: ro, action: del }, '-',
				{ label: 'Eigenschaften', icon: ci('info'), kbd: 'Alt+Eingabe', action: props }], ev.clientX, ev.clientY);
		}
		fm.clearSel();
		menu([
			{ label: 'Ansicht', icon: ci('view'), sub: viewItems() },
			{ label: 'Sortieren nach', icon: ci('sort'), sub: sortItems() },
			{ label: 'Aktualisieren', icon: ci('refresh'), kbd: 'F5', action: () => command('refresh') }, '-',
			{ label: 'Einfügen', icon: ci('paste'), kbd: 'Strg+V', disabled: ro || !fm.clip, action: () => paste() },
			{ label: 'Neu', icon: ci('new'), disabled: ro, sub: newItems() },
			{ label: 'Hochladen …', icon: ci('upload'), disabled: ro, action: () => $('#up-in').click() }, '-',
			{ label: 'Eigenschaften', icon: ci('info'), action: props }], ev.clientX, ev.clientY);
	});
	content.addEventListener('keydown', (ev) => {
		if (ev.target.classList.contains('ren')) {
			if (ev.key === 'Enter') { ev.preventDefault(); finishRename(ev.target, true); }
			else if (ev.key === 'Escape') { ev.preventDefault(); finishRename(ev.target, false); }
		}
	});
	content.addEventListener('focusout', (ev) => { if (ev.target.classList.contains('ren') && renaming) finishRename(ev.target, true); });

	// columns of the tiles view (arrow keys move by a row)
	const cols = () => {
		if (view === 'details' || view === 'list') return 1;
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
		const mod = ev.ctrlKey || ev.metaKey;
		if (ev.altKey && ev.key === 'ArrowLeft') { ev.preventDefault(); command('back'); return; }
		if (ev.altKey && ev.key === 'ArrowRight') { ev.preventDefault(); command('fwd'); return; }
		if (ev.altKey && ev.key === 'ArrowUp') { ev.preventDefault(); command('up'); return; }
		if (ev.altKey && ev.shiftKey && ev.key.toLowerCase() === 'p') { ev.preventDefault(); togglePane(); return; }
		if (ev.key === 'F5') { ev.preventDefault(); command('refresh'); return; }
		if (mod && (ev.key === 'f' || ev.key === 'e')) { ev.preventDefault(); q.focus(); q.select(); return; }
		if (mod && ev.shiftKey && ev.key.toLowerCase() === 'n') { ev.preventDefault(); if (!fm.readOnly) newFolder(); return; }
		if (inInput) return;
		if (mod && ev.key.toLowerCase() === 'a') { ev.preventDefault(); fm.selectAll(); return; }
		if (mod && ev.key.toLowerCase() === 'c') { ev.preventDefault(); command('copy'); return; }
		if (mod && ev.key.toLowerCase() === 'x') { ev.preventDefault(); if (!fm.readOnly) command('cut'); return; }
		if (mod && ev.key.toLowerCase() === 'v') { ev.preventDefault(); if (!fm.readOnly && fm.clip) paste(); return; }
		if (ev.key === 'F2') { ev.preventDefault(); startRename(); return; }
		if (ev.key === 'Delete') { ev.preventDefault(); del(); return; }
		if (ev.key === 'Backspace') { ev.preventDefault(); command('back'); return; }
		if (ev.altKey && ev.key === 'Enter') { ev.preventDefault(); props(); return; }
		if (ev.key === 'Enter') { ev.preventDefault(); const S = fm.selected(); if (S.length === 1) openEntry(S[0].name); return; }
		if (ev.key === 'Escape') { if (fm.clip) { fm.clip = null; onChange('clip'); } fm.clearSel(); return; }
		const c = cols();
		const steps = { ArrowDown: c, ArrowUp: -c, ArrowRight: c > 1 ? 1 : 0, ArrowLeft: c > 1 ? -1 : 0, Home: -1e6, End: 1e6, PageDown: 10 * c, PageUp: -10 * c };
		if (ev.key in steps && steps[ev.key]) { ev.preventDefault(); fm.step(steps[ev.key], ev); }
	});

	/* ---------- drag & drop: move in the box (Strg: copy), files from the computer ---------- */
	let dragNames = null;
	content.addEventListener('dragstart', (ev) => {
		const it = ev.target.closest('.it');
		if (!it) return;
		if (!fm.sel.has(it.dataset.n)) fm.selectOnly(it.dataset.n);
		dragNames = [...fm.sel];
		ev.dataTransfer.effectAllowed = 'copyMove';
		ev.dataTransfer.setData('text/plain', dragNames.join('\n'));
	});
	content.addEventListener('dragend', () => { dragNames = null; app.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); });
	function dropTarget(ev) {
		const it = ev.target.closest('.it[data-k="dir"]');
		if (it && !(dragNames && dragNames.includes(it.dataset.n))) return { el: it, root: fm.root, path: FC.joinPath(fm.path, it.dataset.n), into: it.dataset.n };
		const tn = ev.target.closest('.tn, .crumb');
		if (tn) return { el: tn, root: tn.dataset.root, path: tn.dataset.path };
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
		ev.dataTransfer.dropEffect = files || ev.ctrlKey || ev.altKey ? 'copy' : 'move';
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
		await fm.dropInto(names, t.root, t.path, ev.ctrlKey || ev.altKey);
		toast(ev.ctrlKey || ev.altKey ? 'Kopiert.' : 'Verschoben.');
	}));

	/* ---------- resizable panes ---------- */
	app.querySelectorAll('.splitter').forEach((sp) => sp.addEventListener('pointerdown', (ev) => {
		ev.preventDefault();
		const which = sp.dataset.split, x0 = ev.clientX;
		const w0 = which === 'nav' ? nav.offsetWidth : paneEl.offsetWidth;
		const move = (e) => {
			const w = Math.max(140, Math.min(520, which === 'nav' ? w0 + e.clientX - x0 : w0 - (e.clientX - x0)));
			app.style.setProperty(which === 'nav' ? '--nav-w' : '--pane-w', w + 'px');
		};
		const up = () => {
			removeEventListener('pointermove', move); removeEventListener('pointerup', up);
			fm.savePrefs({ navW: nav.offsetWidth, paneW: paneEl.offsetWidth });
		};
		addEventListener('pointermove', move); addEventListener('pointerup', up);
	}));

	drawCmd(); drawStatus();
	fm.start().then(revealInTree).catch(() => {});
	window.__explorer = { fm };
})();
