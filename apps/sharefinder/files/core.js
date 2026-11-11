/*
 * Shared core of ShareExplorer and ShareFinder (the same file in both apps):
 * the folders of the box through ShareOS.fs, navigation history, selection,
 * clipboard, sorting, uploads and downloads, file types and the formats.
 * The two apps only draw it differently.
 *
 *   const fm = new FileCore({ onChange })   fm.start() → roots, first folder
 *
 * Everything that changes the state calls onChange(what):
 *   'roots' | 'list' | 'sel' | 'busy' | 'clip' | 'error'
 */
(function () {
	'use strict';

	const IMG = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico'];
	const VID = ['mp4', 'webm', 'm4v', 'mov', 'mkv', 'avi', 'ogv'];
	const AUD = ['mp3', 'm4a', 'aac', 'ogg', 'oga', 'opus', 'flac', 'wav'];
	const TXT = ['txt', 'md', 'log', 'csv', 'json', 'xml', 'yml', 'yaml', 'ini', 'conf', 'cfg', 'sh', 'js', 'mjs', 'ts', 'css', 'html', 'htm', 'py', 'c', 'h', 'cpp', 'go', 'rs', 'java', 'php', 'sql', 'srt', 'vtt', 'toml', 'env'];
	const ARC = ['zip', '7z', 'rar', 'tar', 'gz', 'tgz', 'bz2', 'xz', 'zst'];
	const DOC = ['doc', 'docx', 'odt', 'rtf'];
	const XLS = ['xls', 'xlsx', 'ods'];
	const PPT = ['ppt', 'pptx', 'odp'];

	function ext(name) { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(i + 1).toLowerCase() : ''; }
	// kind of an entry: dir, image, video, audio, text, pdf, archive, doc, sheet, slides, file
	function kind(e) {
		if (!e) return 'file';
		if (e.type === 'dir' || e.type === 'dirlink') return 'dir';
		const x = ext(e.name);
		if (IMG.includes(x)) return 'image';
		if (VID.includes(x)) return 'video';
		if (AUD.includes(x)) return 'audio';
		if (x === 'pdf') return 'pdf';
		if (TXT.includes(x)) return 'text';
		if (ARC.includes(x)) return 'archive';
		if (DOC.includes(x)) return 'doc';
		if (XLS.includes(x)) return 'sheet';
		if (PPT.includes(x)) return 'slides';
		return 'file';
	}
	const KIND_NAME = { dir: 'Dateiordner', image: 'Bild', video: 'Video', audio: 'Audio', text: 'Textdokument', pdf: 'PDF-Dokument',
		archive: 'Archiv', doc: 'Dokument', sheet: 'Tabelle', slides: 'Präsentation', file: 'Datei' };
	function typeName(e) {
		const k = kind(e);
		if (k === 'dir') return KIND_NAME.dir;
		const x = ext(e.name);
		return k === 'file' ? (x ? x.toUpperCase() + '-Datei' : 'Datei') : KIND_NAME[k] + (x ? ' (' + x.toUpperCase() + ')' : '');
	}
	// the preview can show it in the browser
	const canPreview = (e) => ['image', 'video', 'audio', 'text', 'pdf'].includes(kind(e));

	function fmtSize(b) {
		if (b == null) return '';
		if (b === 1) return '1 Byte';
		const u = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
		let i = 0;
		while (b >= 1024 && i < 4) { b /= 1024; i++; }
		return (i ? b.toLocaleString('de-DE', { maximumFractionDigits: b < 10 ? 1 : 0 }) : b) + ' ' + u[i];
	}
	function fmtDate(t, long) {
		if (!t) return '';
		const d = new Date(t * 1000);
		return long ? d.toLocaleString('de-DE', { dateStyle: 'long', timeStyle: 'short' })
			: d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
	}
	// "heute, 14:02" / "gestern, 09:10" / "3. Nov. 2026 um 18:20" (Finder)
	function fmtRel(t) {
		if (!t) return '';
		const d = new Date(t * 1000), now = new Date();
		const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
		const diff = Math.round((day(now) - day(d)) / 86400000);
		const hm = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
		if (diff === 0) return 'Heute, ' + hm;
		if (diff === 1) return 'Gestern, ' + hm;
		return d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }) + ' um ' + hm;
	}
	const joinPath = (p, n) => (p ? p + '/' + n : n);
	const parentOf = (p) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
	const baseOf = (p) => p.slice(p.lastIndexOf('/') + 1);

	// messages of the box in plain German
	function errText(e) {
		const m = String(e && e.message || e || '');
		if (/exists/i.test(m)) return 'Ein Element mit diesem Namen gibt es hier schon.';
		if (/read.?only|readonly/i.test(m)) return 'Dieser Ordner ist schreibgeschützt.';
		if (/denied|not allowed|permission/i.test(m)) return 'Keine Berechtigung für diesen Ordner.';
		if (/no space|full/i.test(m)) return 'Auf dem Laufwerk ist kein Platz mehr.';
		if (/not found|no such/i.test(m)) return 'Nicht gefunden – vielleicht wurde es inzwischen verschoben oder gelöscht.';
		if (/into itself/i.test(m)) return 'Ein Ordner kann nicht in sich selbst kopiert werden.';
		return m || 'Unbekannter Fehler';
	}

	class FileCore {
		constructor(o) {
			this.onChange = o.onChange || (() => {});
			this.fs = (window.ShareOS && window.ShareOS.fs) || null;
			this.roots = [];
			this.root = ''; this.path = '';
			this.entries = []; this.free = null; this.total = null;
			this.sel = new Set(); this.anchor = null; this.focus = null;
			this.sort = { by: 'name', dir: 1 };
			this.filter = '';
			this.hidden = false;
			this.back = []; this.fwd = [];
			this.clip = null;            // { op: 'copy'|'cut', root, path, names }
			this.busy = 0;
			this.error = '';
			this.loadSeq = 0;
			try {
				const s = JSON.parse(localStorage.getItem(o.store || 'fm-prefs') || '{}');
				if (s.sort && s.sort.by) this.sort = s.sort;
				this.hidden = !!s.hidden;
			} catch (e) { /* storage may be off */ }
			this.storeKey = o.store || 'fm-prefs';
		}
		savePrefs(extra) {
			try {
				const s = JSON.parse(localStorage.getItem(this.storeKey) || '{}');
				localStorage.setItem(this.storeKey, JSON.stringify({ ...s, sort: this.sort, hidden: this.hidden, ...(extra || {}) }));
			} catch (e) { /* storage may be off */ }
		}
		prefs() { try { return JSON.parse(localStorage.getItem(this.storeKey) || '{}'); } catch (e) { return {}; } }

		get rootInfo() { return this.roots.find((r) => r.name === this.root) || null; }
		get readOnly() { return !!(this.rootInfo && this.rootInfo.ro); }
		rootLabel(r) {
			if (!r) return '';
			if (r.name === 'app') return 'App-Ordner';
			if (r.home || r.personal) return 'Persönlicher Ordner';
			return r.name;
		}

		async start() {
			if (!this.fs) { this.error = 'nofs'; this.onChange('error'); return; }
			try {
				this.roots = (await this.fs.roots()) || [];
			} catch (e) { this.error = errText(e); this.onChange('error'); return; }
			if (!this.roots.length) { this.error = 'noroots'; this.onChange('error'); return; }
			this.onChange('roots');
			const last = this.prefs().last;
			const home = this.roots.find((r) => r.home || r.personal) || this.roots[0];
			if (last && this.roots.some((r) => r.name === last.root)) await this.go(last.root, last.path || '', false).catch(() => this.go(home.name, '', false));
			else await this.go(home.name, '', false);
		}

		// open a folder; hist: put the current one into the back history
		async go(root, path, hist = true) {
			if (hist && this.root && (this.root !== root || this.path !== path)) { this.back.push({ root: this.root, path: this.path }); this.fwd = []; }
			const seq = ++this.loadSeq;
			this.busy++; this.onChange('busy');
			try {
				const r = await this.fs.list(root, path, this.hidden);
				if (seq !== this.loadSeq) return;
				this.root = root; this.path = path;
				this.entries = (r.entries || []).map((e) => ({ ...e, kind: kind(e) }));
				this.free = r.free ?? null; this.total = r.size ?? null;
				this.sel.clear(); this.anchor = null; this.focus = null; this.filter = '';
				this.error = '';
				this.savePrefs({ last: { root, path } });
				this.onChange('list');
			} catch (e) {
				if (seq !== this.loadSeq) return;
				this.error = errText(e);
				this.onChange('error');
				throw e;
			} finally { this.busy--; this.onChange('busy'); }
		}
		reload() {
			const keep = new Set(this.sel);
			return this.go(this.root, this.path, false).then(() => {
				for (const n of keep) if (this.entries.some((e) => e.name === n)) this.sel.add(n);
				this.onChange('sel');
			});
		}
		goBack() { const h = this.back.pop(); if (!h) return; this.fwd.push({ root: this.root, path: this.path }); return this.go(h.root, h.path, false); }
		goFwd() { const h = this.fwd.pop(); if (!h) return; this.back.push({ root: this.root, path: this.path }); return this.go(h.root, h.path, false); }
		goUp() { if (this.path) return this.go(this.root, parentOf(this.path)); }
		open(name) { const e = this.entry(name); if (e && e.kind === 'dir') return this.go(this.root, joinPath(this.path, name)); }

		entry(name) { return this.entries.find((e) => e.name === name) || null; }
		// what is shown: filter and sort (folders first)
		view() {
			const f = this.filter.trim().toLowerCase();
			const L = f ? this.entries.filter((e) => e.name.toLowerCase().includes(f)) : this.entries.slice();
			const { by, dir } = this.sort;
			const coll = new Intl.Collator('de', { numeric: true, sensitivity: 'base' });
			L.sort((a, b) => {
				const da = a.kind === 'dir', db = b.kind === 'dir';
				if (da !== db) return da ? -1 : 1;
				let c = 0;
				if (by === 'size') c = (a.size || 0) - (b.size || 0);
				else if (by === 'mtime') c = (a.mtime || 0) - (b.mtime || 0);
				else if (by === 'type') c = coll.compare(typeName(a), typeName(b));
				if (!c) c = coll.compare(a.name, b.name);
				return c * dir;
			});
			return L;
		}
		setSort(by) {
			if (this.sort.by === by) this.sort.dir = -this.sort.dir; else this.sort = { by, dir: by === 'mtime' || by === 'size' ? -1 : 1 };
			this.savePrefs(); this.onChange('list');
		}
		setHidden(v) { this.hidden = !!v; this.savePrefs(); return this.reload(); }

		// selection: plain click, ctrl/cmd (toggle), shift (range in the shown order)
		click(name, ev) {
			const L = this.view().map((e) => e.name);
			if (ev && ev.shiftKey && this.anchor && L.includes(this.anchor)) {
				const a = L.indexOf(this.anchor), b = L.indexOf(name);
				if (!(ev.ctrlKey || ev.metaKey)) this.sel.clear();
				for (let i = Math.min(a, b); i <= Math.max(a, b); i++) this.sel.add(L[i]);
			} else if (ev && (ev.ctrlKey || ev.metaKey)) {
				if (this.sel.has(name)) this.sel.delete(name); else this.sel.add(name);
				this.anchor = name;
			} else {
				this.sel.clear(); this.sel.add(name); this.anchor = name;
			}
			this.focus = name;
			this.onChange('sel');
		}
		selectOnly(name) { this.sel.clear(); if (name) { this.sel.add(name); this.anchor = name; this.focus = name; } this.onChange('sel'); }
		selectAll() { for (const e of this.view()) this.sel.add(e.name); this.onChange('sel'); }
		clearSel() { this.sel.clear(); this.onChange('sel'); }
		// arrow keys: step through the shown order (cols > 1: a grid)
		step(delta, ev) {
			const L = this.view().map((e) => e.name);
			if (!L.length) return null;
			let i = this.focus ? L.indexOf(this.focus) : -1;
			i = i < 0 ? (delta > 0 ? 0 : L.length - 1) : Math.max(0, Math.min(L.length - 1, i + delta));
			if (ev && ev.shiftKey) {
				if (!this.anchor) this.anchor = this.focus || L[i];
				const a = L.indexOf(this.anchor);
				this.sel.clear();
				for (let k = Math.min(a, i); k <= Math.max(a, i); k++) this.sel.add(L[k]);
				this.focus = L[i];
				this.onChange('sel');
			} else this.selectOnly(L[i]);
			return L[i];
		}
		selected() { return this.view().filter((e) => this.sel.has(e.name)); }

		/* ---- changes on the box ---- */
		async run(fn) {
			this.busy++; this.onChange('busy');
			try { return await fn(); } catch (e) { throw new Error(errText(e)); } finally { this.busy--; this.onChange('busy'); }
		}
		freeName(base, isDir) {
			const names = new Set(this.entries.map((e) => e.name.toLowerCase()));
			if (!names.has(base.toLowerCase())) return base;
			const x = isDir ? '' : ext(base), stem = x ? base.slice(0, -(x.length + 1)) : base;
			for (let i = 2; ; i++) { const n = stem + ' (' + i + ')' + (x ? '.' + x : ''); if (!names.has(n.toLowerCase())) return n; }
		}
		validName(n) {
			n = String(n || '').trim();
			if (!n || n === '.' || n === '..' || /[/\\]/.test(n) || /[\u0000-\u001f]/.test(n)) return null;
			return n;
		}
		async mkdir(name) {
			const n = this.validName(name);
			if (!n) throw new Error('Ungültiger Name.');
			await this.run(() => this.fs.mkdir(this.root, this.path, n));
			await this.reload(); this.selectOnly(n);
			return n;
		}
		async newFile(name) {
			const n = this.validName(name);
			if (!n) throw new Error('Ungültiger Name.');
			await this.run(async () => { const f = await this.fs.open(this.root, this.path, n, { write: true, create: true }); await f.save(new Blob([''])); });
			await this.reload(); this.selectOnly(n);
			return n;
		}
		async rename(name, to) {
			const n = this.validName(to);
			if (!n) throw new Error('Ungültiger Name.');
			if (n === name) return name;
			if (this.entries.some((e) => e.name.toLowerCase() === n.toLowerCase() && e.name !== name)) throw new Error('Ein Element mit diesem Namen gibt es hier schon.');
			await this.run(() => this.fs.rename(this.root, this.path, name, n));
			await this.reload(); this.selectOnly(n);
			return n;
		}
		async remove(names) {
			if (!names.length) return;
			await this.run(() => this.fs.remove(this.root, this.path, names));
			await this.reload(); this.clearSel();
		}
		copySel(cut) {
			const names = [...this.sel];
			if (!names.length) return;
			this.clip = { op: cut ? 'cut' : 'copy', root: this.root, path: this.path, names };
			this.onChange('clip');
		}
		isCut(name) { return !!(this.clip && this.clip.op === 'cut' && this.clip.root === this.root && this.clip.path === this.path && this.clip.names.includes(name)); }
		// paste into this folder (or into the folder dest of this folder)
		async paste(dest) {
			const c = this.clip;
			if (!c) return;
			const to = dest ? joinPath(this.path, dest) : this.path;
			if (c.root === this.root && c.path === to && c.op === 'cut') return;
			for (const n of c.names) if (c.root === this.root && (to === joinPath(c.path, n) || to.startsWith(joinPath(c.path, n) + '/'))) throw new Error('Ein Ordner kann nicht in sich selbst kopiert werden.');
			if (c.op === 'copy' && c.root === this.root && c.path === to) {
				// a copy in the same folder: "Name - Kopie" (files: read and written again;
				// the box copies only under the same name)
				for (const n of c.names) {
					const e = this.entry(n);
					if (!e) continue;
					if (e.kind === 'dir') throw new Error('Ordner lassen sich nicht im selben Ordner duplizieren – in einen anderen Ordner einfügen.');
					const x = ext(n), stem = x ? n.slice(0, -(x.length + 1)) : n;
					const cp = this.freeName(stem + ' - Kopie' + (x ? '.' + x : ''), false);
					await this.run(async () => {
						const src = await this.fileOf(n), blob = await src.blob();
						const dst = await this.fs.open(this.root, this.path, cp, { write: true, create: true });
						await dst.save(blob);
					});
				}
			} else {
				await this.run(() => (c.op === 'cut' ? this.fs.move : this.fs.copy).call(this.fs, c.root, c.path, c.names, this.root, to));
			}
			if (c.op === 'cut') this.clip = null;
			this.onChange('clip');
			await this.reload();
		}
		// drag & drop: move (or copy with ctrl/alt) names of this folder into a folder
		async dropInto(names, destRoot, destPath, copy) {
			if (!names.length) return;
			for (const n of names) if (destRoot === this.root && (destPath === joinPath(this.path, n) || destPath.startsWith(joinPath(this.path, n) + '/'))) throw new Error('Ein Ordner kann nicht in sich selbst verschoben werden.');
			if (destRoot === this.root && destPath === this.path) return;
			await this.run(() => (copy ? this.fs.copy : this.fs.move).call(this.fs, this.root, this.path, names, destRoot, destPath));
			await this.reload();
		}
		// files from the computer (input or drop); progress(i, n, name)
		async upload(files, progress) {
			const list = [...files];
			for (let i = 0; i < list.length; i++) {
				const f = list[i];
				if (progress) progress(i, list.length, f.name);
				const n = this.entries.some((e) => e.name === f.name) ? this.freeName(f.name, false) : f.name;
				await this.run(async () => { const h = await this.fs.open(this.root, this.path, n, { write: true, create: true }); await h.save(f); });
			}
			if (progress) progress(list.length, list.length, '');
			await this.reload();
		}
		async fileOf(name) { return this.fs.open(this.root, this.path, name, {}); }
		async download(names) {
			for (const n of names) {
				const e = this.entry(n);
				if (!e || e.kind === 'dir') continue;
				const f = await this.run(() => this.fileOf(n));
				const a = document.createElement('a');
				a.href = f.url; a.download = n; document.body.appendChild(a); a.click(); a.remove();
			}
		}
		// the folder tree of the sidebar: subfolders of a folder (no change of the view)
		async subdirs(root, path) {
			try {
				const r = await this.fs.list(root, path, this.hidden);
				return (r.entries || []).filter((e) => e.type === 'dir' || e.type === 'dirlink').map((e) => e.name)
					.sort(new Intl.Collator('de', { numeric: true, sensitivity: 'base' }).compare);
			} catch (e) { return []; }
		}
		async readText(name, max) {
			const f = await this.fileOf(name);
			const r = await fetch(f.url, { headers: { Range: 'bytes=0-' + ((max || 262144) - 1) }, cache: 'no-store' });
			return r.text();
		}
	}

	window.FileCore = FileCore;
	window.FC = { kind, ext, typeName, canPreview, fmtSize, fmtDate, fmtRel, joinPath, parentOf, baseOf, errText };
})();
