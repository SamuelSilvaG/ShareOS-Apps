#!/usr/bin/env python3
"""
Translations of the apps (German source, i18n/<lang>.json per app).

  tools/i18n.py sync <app> …              copy lib/sos-i18n.js into the app and
                                          load it in index.html
  tools/i18n.py extract <app> <out.json>  German texts of the app that
                                          i18n/en.json does not cover yet
  tools/i18n.py apply <app> <todo.json> <lines.txt> [lang]
                                          one translation per line of the todo
                                          list ("-": leave as it is)
  tools/i18n.py check                     every app's copy of sos-i18n.js is
                                          current, every en.json is valid
"""
import json, os, re, sys

TOP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(TOP, 'lib', 'sos-i18n.js')
GERMAN = re.compile(r'[äöüÄÖÜß]|\b(der|die|das|und|nicht|kein|keine|mit|für|auf|ein|eine|ist|wird|werden|oder|noch|zum|zur|von|bei|alle|neu|neue|neuer|neues|speichern|löschen|abbrechen|hinzufügen|bearbeiten|suchen|öffnen|schließen|laden|fehler|wählen|bitte|jetzt|heute|gestern|eintrag|einträge|datei|dateien|ordner|ja|nein)\b', re.I)


def files_of(app):
    d = os.path.join(TOP, 'apps', app, 'files')
    for f in sorted(os.listdir(d)):
        p = os.path.join(d, f)
        if os.path.isfile(p) and f.endswith(('.js', '.html')) and f != 'sos-i18n.js':
            yield p


def js_literals(src):
    """string literals of JavaScript: (text, is_template)"""
    out, i, n = [], 0, len(src)
    while i < n:
        c = src[i]
        if src.startswith('//', i):
            j = src.find('\n', i); i = n if j < 0 else j; continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2); i = n if j < 0 else j + 2; continue
        if c in '\'"':
            j, buf = i + 1, []
            while j < n and src[j] != c and src[j] != '\n':
                if src[j] == '\\' and j + 1 < n:
                    buf.append({'n': '\n', 't': '\t'}.get(src[j + 1], src[j + 1])); j += 2; continue
                buf.append(src[j]); j += 1
            out.append((''.join(buf), False)); i = j + 1; continue
        if c == '`':
            j, buf, depth = i + 1, [], 0
            while j < n:
                if src[j] == '\\' and j + 1 < n:
                    buf.append(src[j + 1]); j += 2; continue
                if src.startswith('${', j):
                    # an expression: nested literals are collected recursively
                    k, d = j + 2, 1
                    while k < n and d:
                        if src[k] == '{': d += 1
                        elif src[k] == '}': d -= 1
                        elif src[k] in '\'"`':
                            q = src[k]; k += 1
                            while k < n and src[k] != q:
                                k += 2 if src[k] == '\\' else 1
                        k += 1
                    out.extend(js_literals(src[j + 2:k - 1]))
                    buf.append('\x00'); j = k; continue
                if src[j] == '`': break
                buf.append(src[j]); j += 1
            out.append((''.join(buf), True)); i = j + 1; continue
        i += 1
    return out


def pieces(s):
    """visible text pieces of a string that may hold HTML"""
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', s, flags=re.S | re.I)
    res = []
    for m in re.finditer(r'(placeholder|title|aria-label|alt)\s*=\s*"([^"\x00]*(?:\x00[^"\x00]*)*)"', s):
        res.append(m[2])
    for part in re.split(r'<[^<>]*>', s):
        part = part.replace('&nbsp;', ' ')
        for line in part.split('\n'):
            if line.strip(): res.append(line)
    return res


def wanted(t):
    t = t.strip()
    plain = t.replace('\x00', '')
    if len(re.sub(r'[^A-Za-zÄÖÜäöüß]', '', plain)) < 2: return False
    if re.fullmatch(r'[\w.$#-]+', plain) and not re.search(r'[äöüÄÖÜß]', plain) and not (plain[:1].isupper() and len(plain) > 2 and re.fullmatch(r'[A-Za-z]+(-[A-Za-z]+)*', plain)): return False
    if re.search(r'^(https?:|/|\.|#|data:|var\(|rgba?\()|[{};=]|=>|\(\)|\.(js|css|json|png|svg)\b', plain): return False
    if re.fullmatch(r'[a-z-]+(\s+[a-z-]+)*', plain) and not GERMAN.search(plain): return False   # class lists
    if re.fullmatch(r'[A-Z_]+|Key[A-Z]|Digit\d|Arrow\w+|Space|Enter|Escape|Tab|Backspace|Delete|BroadcastChannel|AbortError|Content-Type|Bearer|Basic', plain): return False
    return bool(GERMAN.search(plain) or re.search(r'[A-ZÄÖÜ][a-zäöüß]+', plain))


def candidates(app):
    seen, out = set(), []
    def add(kind, s):
        if (kind, s) not in seen: seen.add((kind, s)); out.append({'k': kind, 'de': s})
    for p in files_of(app):
        src = open(p, encoding='utf-8').read()
        texts = []
        if p.endswith('.html'):
            body = re.sub(r'<script[^>]*>.*?</script>|<style[^>]*>.*?</style>', ' ', src, flags=re.S)
            texts += [(x, False) for x in pieces(body)]
            for m in re.finditer(r'<title>(.*?)</title>', src): texts.append((m[1], False))
            for m in re.finditer(r'<script(?![^>]*src)[^>]*>(.*?)</script>', src, re.S): texts += js_literals(m[1])
        else:
            texts += js_literals(src)
        for s, tpl in texts:
            for piece in (pieces(s) if ('<' in s or '\x00' in s or tpl) else [s]):
                t = piece.strip()
                if not wanted(t): continue
                if '\x00' in t:
                    if re.fullmatch(r'[\x00\s\W\d]*', t.replace('\x00', '')): continue
                    add('pattern', t)
                elif not tpl and (piece.endswith((' ', ': ')) or piece.startswith(' ')) and len(t) < 80:
                    # a part that is joined with values: "Speicher: " + x
                    add('exact', t)
                    if piece.endswith(' '): add('prefix', t)
                    if piece.startswith(' '): add('suffix', t)
                else:
                    add('exact', t)
    return out


def regex_of(c):
    if c['k'] == 'pattern':
        parts = [re.escape(x) for x in c['de'].split('\x00')]
        return '^' + '(.+?)'.join(parts) + '$', c['de'].count('\x00')
    if c['k'] == 'prefix': return '^' + re.escape(c['de']) + r' (.+)$', 1
    if c['k'] == 'suffix': return r'^(.+) ' + re.escape(c['de']) + '$', 1
    return None, 0


def load(app, lang='en'):
    p = os.path.join(TOP, 'apps', app, 'files', 'i18n', lang + '.json')
    if os.path.exists(p): return p, json.load(open(p, encoding='utf-8'))
    return p, {'exact': {}, 'patterns': []}


WORDS = {}


def memory(lang='en'):
    """what the other apps already translate (exact texts and patterns)"""
    ex, pa, keep = {}, {}, set()
    for a in sorted(os.listdir(os.path.join(TOP, 'apps'))):
        p = os.path.join(TOP, 'apps', a, 'files', 'i18n', lang + '.json')
        if not os.path.exists(p): continue
        j = json.load(open(p, encoding='utf-8'))
        for k, v in j.get('exact', {}).items(): ex.setdefault(k, v)
        for r, v in j.get('patterns', []): pa.setdefault(r, v)
        keep.update(j.get('keep', []))
        for w in j.get('words', []): WORDS.setdefault(w[0], w)
    return ex, pa, keep


def cmd_extract(app, out):
    path, d = load(app)
    # texts other apps already translate are taken over
    ex, pa, keep0 = memory()
    n0 = len(d['exact']) + len(d['patterns'])
    for c in candidates(app):
        rx, _ = regex_of(c)
        if rx is None and c['de'] in ex: d['exact'].setdefault(c['de'], ex[c['de']])
        elif rx and rx in pa and not any(p[0] == rx for p in d['patterns']): d['patterns'].append([rx, pa[rx]])
        elif c['de'] in keep0 and c['de'] not in d.setdefault('keep', []): d['keep'].append(c['de'])
        for k, w in WORDS.items():
            if re.search(k.replace('(?!', '(?!'), c['de']) and w not in d.setdefault('words', []): d['words'].append(w)
    if len(d['exact']) + len(d['patterns']) != n0 or d.get('keep'):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        d['patterns'].sort(key=lambda p: -len(p[0]))
        json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        open(path, 'a').write('\n')
    pats = {p[0] for p in d['patterns']}
    keep = set(d.get('keep', []))
    todo = []
    for c in candidates(app):
        if c['de'] in keep: continue
        if c['k'] == 'exact' and c['de'] in d['exact']: continue
        rx, _ = regex_of(c)
        if rx and rx in pats: continue
        todo.append(c)
    json.dump(todo, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    for i, c in enumerate(todo):
        print('%d\t%s\t%s' % (i, {'exact': '', 'pattern': 'P', 'prefix': 'A', 'suffix': 'Z'}[c['k']], c['de'].replace('\x00', '{}').replace('\n', ' ')))


def cmd_apply(app, todo, lines, lang='en'):
    todo = json.load(open(todo, encoding='utf-8'))
    tr = [l.rstrip('\n') for l in open(lines, encoding='utf-8')]
    tr = [re.sub(r'^\d+\t', '', l) for l in tr if l.strip() != '']
    if len(tr) != len(todo): sys.exit('%d translations for %d texts' % (len(tr), len(todo)))
    path, d = load(app, lang)
    for c, t in zip(todo, tr):
        if t.strip() == '-' or t == c['de']:
            # stays as it is (names, units, code): not asked again
            if c['de'] not in d.setdefault('keep', []): d['keep'].append(c['de'])
            continue
        rx, n = regex_of(c)
        if t.startswith('~'):
            # also a single word inside other texts (day and month names)
            d['exact'][c['de']] = t[1:]
            w = ['(^|[^\\wäöüÄÖÜß])' + re.escape(c['de']) + '(?![\\wäöüÄÖÜß])', '$1' + t[1:]]
            if w not in d.setdefault('words', []): d['words'].append(w)
        elif rx is None:
            d['exact'][c['de']] = t
        else:
            i = [0]
            def num(m): i[0] += 1; return '$%d' % i[0]
            rep = re.sub(r'\{\}', num, t) if c['k'] == 'pattern' else (t + ' $1' if c['k'] == 'prefix' else '$1 ' + t)
            if c['k'] == 'pattern' and i[0] != n: sys.exit('placeholders differ: %r -> %r' % (c['de'], t))
            if not any(p[0] == rx for p in d['patterns']): d['patterns'].append([rx, rep])
    # longer patterns first: the more specific one wins
    d['patterns'].sort(key=lambda p: -len(p[0]))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump(d, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(path, 'a').write('\n')
    print('%s: %d exact, %d patterns' % (path, len(d['exact']), len(d['patterns'])))


def cmd_sync(apps):
    lib = open(LIB, encoding='utf-8').read()
    for app in apps:
        d = os.path.join(TOP, 'apps', app, 'files')
        open(os.path.join(d, 'sos-i18n.js'), 'w', encoding='utf-8').write(lib)
        p = os.path.join(d, 'index.html')
        h = open(p, encoding='utf-8').read()
        if 'sos-i18n.js' not in h:
            m = re.search(r'<script[^>]*src="/_shareos/app\.js"[^>]*></script>\s*\n?', h)
            tag = '<script src="sos-i18n.js"></script>\n'
            if m:
                ind = re.search(r'([ \t]*)<script[^>]*src="/_shareos/app\.js"', h)[1]
                h = h[:m.end()] + ind + tag + h[m.end():]
            else:
                h = h.replace('</head>', '  ' + tag + '</head>', 1)
            open(p, 'w', encoding='utf-8').write(h)


def cmd_check():
    lib, bad = open(LIB, encoding='utf-8').read(), 0
    for app in sorted(os.listdir(os.path.join(TOP, 'apps'))):
        d = os.path.join(TOP, 'apps', app, 'files')
        f = os.path.join(d, 'sos-i18n.js')
        if os.path.exists(f) and open(f, encoding='utf-8').read() != lib:
            print(app + ': sos-i18n.js is not the copy of lib/sos-i18n.js (tools/i18n.py sync ' + app + ')'); bad += 1
        for j in (os.listdir(os.path.join(d, 'i18n')) if os.path.isdir(os.path.join(d, 'i18n')) else []):
            try:
                x = json.load(open(os.path.join(d, 'i18n', j), encoding='utf-8'))
                for p in x.get('patterns', []): re.compile(p[0])
            except Exception as e:
                print('%s/i18n/%s: %s' % (app, j, e)); bad += 1
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a: sys.exit(__doc__)
    {'sync': lambda: cmd_sync(a[1:]), 'extract': lambda: cmd_extract(a[1], a[2]),
     'apply': lambda: cmd_apply(*a[1:]), 'check': cmd_check}[a[0]]()
