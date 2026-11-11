/*
 * ShareOS apps – translations (the same scheme as the ShareOS interface).
 *
 * The apps are written in German. For any other interface language
 * (ShareOS.lang, ?lang=) i18n/<lang>.json is loaded – i18n/en.json when there
 * is none – and every text node plus the attributes placeholder / title /
 * aria-label / alt is translated, also what the app renders later:
 *
 *   { "exact": { "German text": "translation" },
 *     "patterns": [ [ "^regular expression on the whole text$", "with $1" ] ],
 *     "words": [ [ "regular expression", "replacement" ] ] }   (what is left)
 *
 * alert / confirm / prompt are translated too; sosT(text) for anything else.
 * Elements with data-i18n-skip (and code, pre, textarea, input values) stay.
 * Source of this file: lib/sos-i18n.js in ShareOS-Apps (tools/i18n.py sync).
 */
(function () {
	'use strict';
	var q = new URLSearchParams(location.search);
	var lang = ((window.ShareOS && window.ShareOS.lang) || q.get('lang') || navigator.language || 'de').toLowerCase().slice(0, 2);
	var D = null;
	window.sosLang = lang;
	window.sosT = function (s) { return D && typeof s === 'string' ? text(s) : s; };
	if (lang === 'de') return;
	document.documentElement.lang = lang;

	function text(s) {
		var t = s.trim();
		if (!t) return s;
		var at = s.indexOf(t), pre = s.slice(0, at), post = s.slice(at + t.length);
		if (Object.prototype.hasOwnProperty.call(D.exact, t)) return pre + D.exact[t] + post;
		for (var i = 0; i < D.patterns.length; i++) {
			var p = D.patterns[i];
			if (p[0].test(t)) return pre + t.replace(p[0], function () {
				var a = arguments;
				return p[1].replace(/\$(\d)/g, function (_, n) { var v = a[+n]; return v == null ? '' : text(v); });
			}) + post;
		}
		var w = words(t);
		return w === t ? s : pre + w + post;
	}
	// single words in texts made of parts (dates: "Montag, 26. Oktober")
	function words(t) {
		for (var i = 0; i < D.words.length; i++) t = t.replace(D.words[i][0], D.words[i][1]);
		return t;
	}
	var DONE = new WeakMap(), ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
	function node(n) {
		if (DONE.get(n) === n.nodeValue) return;
		var p = n.parentElement;
		if (p && p.closest('code, pre, textarea, script, style, [data-i18n-skip], [contenteditable="true"]')) return;
		var v = text(n.nodeValue);
		if (v !== n.nodeValue) n.nodeValue = v;
		DONE.set(n, v);
	}
	function attrs(e) {
		for (var i = 0; i < ATTRS.length; i++) {
			var a = ATTRS[i], v = e.getAttribute(a), k = 'i18n' + a.replace('-', '');
			if (v && e.dataset[k] !== v) { var t = text(v); e.dataset[k] = t; if (t !== v) e.setAttribute(a, t); }
		}
		if ((e.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(e.type)) && e.value) e.value = text(e.value);
	}
	function apply(root) {
		if (root.nodeType === 3) { node(root); return; }
		if (root.nodeType !== 1) return;
		var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
		while ((n = w.nextNode())) node(n);
		attrs(root);
		root.querySelectorAll('[placeholder],[aria-label],[title],[alt],input[type=button],input[type=submit]').forEach(attrs);
	}
	function start() {
		document.title = text(document.title);
		apply(document.body);
		new MutationObserver(function (ms) {
			ms.forEach(function (m) {
				if (m.type === 'characterData') apply(m.target);
				else if (m.type === 'attributes') attrs(m.target);
				else m.addedNodes.forEach(apply);
			});
		}).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
		document.documentElement.style.visibility = '';
	}
	// texts drawn on a canvas (charts, placeholders)
	if (window.CanvasRenderingContext2D) ['fillText', 'strokeText'].forEach(function (f) {
		var orig = CanvasRenderingContext2D.prototype[f];
		CanvasRenderingContext2D.prototype[f] = function (t) {
			var a = Array.prototype.slice.call(arguments);
			if (D && typeof t === 'string') a[0] = text(t);
			return orig.apply(this, a);
		};
	});
	['alert', 'confirm', 'prompt'].forEach(function (f) {
		var orig = window[f];
		window[f] = function (msg, def) { return orig.call(window, D ? text(String(msg == null ? '' : msg)) : msg, def); };
	});
	// no flash of German while the file loads
	document.documentElement.style.visibility = 'hidden';
	setTimeout(function () { document.documentElement.style.visibility = ''; }, 1500);
	function load(code) {
		return fetch('i18n/' + code + '.json', { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw 0; return r.json(); });
	}
	load(lang).catch(function () { return lang === 'en' ? null : load('en'); }).catch(function () { return null; }).then(function (j) {
		if (!j) { document.documentElement.style.visibility = ''; return; }
		D = { exact: j.exact || {}, patterns: (j.patterns || []).map(function (p) { return [new RegExp(p[0]), p[1]]; }),
			words: (j.words || []).map(function (w) { return [new RegExp(w[0], 'g'), w[1]]; }) };
		if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
	});
})();
