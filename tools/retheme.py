#!/usr/bin/env python3
"""
Moves an app's own colours onto the ShareOS theme (/_shareos/theme.css), so it
follows the interface: light/dark and the accent colour. The layout stays.

  tools/retheme.py <app> [<app> …]      rewrites apps/<app>/files/*.css (and
                                         inline colours in *.html / *.js)

- variables the app defines in :root become references to the theme
  (--sos-bg, --sos-panel, --sos-line, --sos-text, --sos-accent …); the names
  the theme already has are dropped, so the theme's values win
- the other colours are mapped by what they are: dark greys → background /
  panel / bar, mid greys → line / muted, light greys → text, the app's accent
  → --sos-accent, red / amber / green → --sos-err / --sos-warn / --sos-ok;
  transparent ones keep their opacity (color-mix)
- light text on an accent / status background becomes --sos-bg (as the
  theme's .sos-btn.primary does)
Canvas colours (fillStyle …) and colour lists in JavaScript are left alone.
"""
import colorsys, os, re, sys

TOP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
THEME = {'bg', 'panel', 'bar', 'line', 'accent', 'soft', 'dim', 'text', 'muted', 'ok', 'warn', 'err', 'rgb'}
HEX = re.compile(r'#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b')
RGBA = re.compile(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+%?)\s*)?\)')
NAMED = {'white': (255, 255, 255), 'black': (0, 0, 0)}


def rgb_of(h):
    h = h.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hls(c):
    return colorsys.rgb_to_hls(*(x / 255 for x in c))


def var_role(name):
    """role of an app variable by its name (None: not a colour role)"""
    n = name.lower()
    for keys, role in (
        (('danger', 'error', '-err', 'red', 'expense'), 'err'),
        (('warning', 'warn', 'yellow'), 'warn'),
        (('success', '-ok', 'income', 'green'), 'ok'),
        (('on-accent',), 'on'),
        (('accent-hover', 'accent-soft', 'hover', 'soft', 'secondary'), 'soft'),
        (('glow',), 'glow'),
        (('accent', 'blue', 'prompt', 'dir-color', 'lcd-text', 'lcd-accent'), 'accent'),
        (('muted', 'dim', 'inactive'), 'muted'),
        (('border', 'line', 'grid', 'step-line'), 'line'),
        (('text', '-fg'), 'text'),
        (('field', 'ctl', 'well', 'code-bg', 'lcd-bg', 'cell-empty', 'tag-bg', 'step', 'btn-bg', 'progress-bg', 'badge-bg'), 'bar'),
        (('panel', 'card', 'header', 'pane', 'bar', 'tab-active'), 'panel'),
        (('bg', 'background', 'main'), 'bg'),
        (('row-hover', 'row-selected', 'row-cursor', 'cell-select', 'selected'), 'tint'),
    ):
        if any(k in n for k in keys):
            return role
    return None


def role_of(c, accent_hue):
    """role of a colour by its look (the apps are dark designs)"""
    h, l, s = hls(c)
    if max(c) - min(c) < 45 or l < 0.06 or l > 0.96:      # greys (also the bluish slate greys)
        if l < 0.105: return 'bg'
        if l < 0.165: return 'panel'
        if l < 0.24: return 'bar'
        if l < 0.38: return 'line'
        if l < 0.72: return 'muted'
        return 'text'
    deg = h * 360
    if l < 0.3:
        # dark tinted surfaces (badges, selected rows): a tint of the role
        r = role_of(tuple(min(255, int(x * 0.55 / max(l, 0.01))) for x in c), accent_hue)
        return r + '_d' if r in ('accent', 'ok', 'warn', 'err') else r
    # the app's own accent first (some apps use orange or red as accent)
    if accent_hue is not None and min(abs(deg - accent_hue), 360 - abs(deg - accent_hue)) < 15: return 'accent'
    if deg >= 340 or deg < 18: return 'err'
    if 18 <= deg < 52: return 'warn'
    if accent_hue is not None and min(abs(deg - accent_hue), 360 - abs(deg - accent_hue)) < 28: return 'accent'
    if 75 <= deg < 165: return 'ok'
    return 'accent'


def theme_ref(role, alpha=None, pale=False):
    if role.endswith('_d'):
        role, alpha = role[:-2], 0.16 if alpha is None else alpha * 0.16
    base = {'bg': 'bg', 'panel': 'panel', 'bar': 'bar', 'line': 'line', 'muted': 'muted', 'text': 'text',
            'accent': 'accent', 'soft': 'soft', 'ok': 'ok', 'warn': 'warn', 'err': 'err', 'on': 'bg', 'glow': 'accent', 'tint': 'accent'}[role]
    if role == 'tint' and alpha is None: alpha = 0.14
    if role == 'glow' and alpha is None: alpha = 0.35
    if alpha is None or alpha >= 0.999:
        return 'var(--sos-%s)' % base
    if base == 'accent':
        return 'rgba(var(--sos-rgb), %s)' % fmt(alpha)
    return 'color-mix(in srgb, var(--sos-%s) %s%%, transparent)' % (base, fmt(alpha * 100))


def fmt(x):
    return ('%.3f' % x).rstrip('0').rstrip('.')


class Mapper:
    def __init__(self, css_text):
        self.known = {}       # colour -> role (from the app's own variables)
        self.accent_hue = None
        for name, val in re.findall(r'(--[a-z0-9-]+)\s*:\s*([^;]+);', css_text):
            r, c = var_role(name), self.colour(val.strip())
            if r and c and len(c) == 3:
                self.known.setdefault(c, 'accent' if r == 'glow' else r)
                if r == 'accent' and self.accent_hue is None and hls(c)[2] > 0.2:
                    self.accent_hue = hls(c)[0] * 360
        if self.accent_hue is None:
            # the most used saturated colour that is not red/amber
            cnt = {}
            for hx in HEX.findall(css_text):
                c = rgb_of(hx); h, l, s = hls(c)
                if s > 0.35 and 0.25 < l < 0.8 and 52 <= h * 360 < 340: cnt[c] = cnt.get(c, 0) + 1
            if cnt: self.accent_hue = hls(max(cnt, key=cnt.get))[0] * 360

    @staticmethod
    def colour(v):
        m = HEX.fullmatch(v)
        if m: return rgb_of(v)
        m = RGBA.fullmatch(v)
        if m: return (int(m[1]), int(m[2]), int(m[3])) + ((alpha(m[4]),) if m[4] else ())
        return None

    def role(self, c):
        if c in self.known:
            r = self.known[c]
            return 'accent' if r == 'on' else r
        return role_of(c, self.accent_hue)

    def hexref(self, hx):
        return theme_ref(self.role(rgb_of(hx)))

    def rgbaref(self, m):
        c = (int(m[1]), int(m[2]), int(m[3]))
        a = alpha(m[4]) if m[4] else None
        if c == (0, 0, 0) or (sum(c) < 40 and a is not None):
            return m[0]                       # shadows and scrims stay
        if a is None: return theme_ref(self.role(c))
        if min(c) > 225: return theme_ref('text', a)
        return theme_ref(self.role(c), a)


def alpha(s):
    return float(s[:-1]) / 100 if s.endswith('%') else float(s)


def map_colours(text, mp, skip=None):
    def one(seg):
        seg = RGBA.sub(lambda m: mp.rgbaref(m), seg)
        seg = HEX.sub(lambda m: mp.hexref(m[0]), seg)
        return seg
    return one(text)


def rewrite_root(block, mp):
    """the :root variables: theme names dropped, others pointed at the theme"""
    out = []
    for line in block.split('\n'):
        m = re.match(r'(\s*)(--[a-z0-9-]+)\s*:\s*([^;]+);(.*)$', line)
        if not m:
            out.append(line); continue
        ind, name, val, rest = m.groups()
        if name.startswith('--sos-') and name[6:] in THEME:
            continue
        c, r = mp.colour(val.strip()), var_role(name)
        if c is None and not HEX.search(val) and not RGBA.search(val):
            out.append(line); continue      # fonts, sizes …
        if r is None:
            r = mp.role(c[:3]) if c else None
        a = c[3] if c and len(c) == 4 else None
        new = theme_ref(r, a) if r else map_colours(val, mp)
        out.append('%s%s: %s;%s' % (ind, name, new, rest))
    return '\n'.join(out)


LIGHT_TEXT = re.compile(r'(?<![-\w])color\s*:\s*(#fff(?:fff)?|white|#f8fafc|#ffffff)\b', re.I)


def fix_on_accent(css):
    """light text on a coloured background -> the background colour"""
    def blk(m):
        body = m[2]
        bg = re.search(r'background(?:-color)?\s*:\s*([^;]+)', body)
        if bg and re.search(r'var\(--sos-(accent|soft|ok|warn|err)\)|var\(--(?:[a-z-]*)(accent|danger|success|warning)', bg[1]) and LIGHT_TEXT.search(body):
            body = LIGHT_TEXT.sub('color: var(--sos-bg)', body)
        return m[1] + body + '}'
    return re.sub(r'([^{}]*\{)([^{}]*)\}', blk, css)


def do_css(path):
    css = open(path, encoding='utf-8').read()
    mp = Mapper(css)
    # light-scheme blocks of the app: the theme does that now
    css = re.sub(r'@media\s*\(prefers-color-scheme:\s*light\)\s*\{(?:[^{}]*\{[^{}]*\})*\s*\}', '', css)
    out, pos = [], 0
    for m in re.finditer(r':root\s*\{([^}]*)\}', css):
        out.append(css[pos:m.start()])
        body = rewrite_root(m[1], mp)
        out.append(':root {%s}' % body if body.strip() else '')
        pos = m.end()
    out.append(css[pos:])
    css = ''.join(out)
    # the rest (outside :root): every colour
    parts = re.split(r'(:root \{[^}]*\})', css)
    css = ''.join(p if p.startswith(':root {') else fix_on_accent_raw(p, mp) for p in parts)
    css = re.sub(r'var\(--sos-([a-z]+), var\(--sos-\1\)\)', r'var(--sos-\1)', css)
    open(path, 'w', encoding='utf-8').write(css)
    return mp


def fix_on_accent_raw(seg, mp):
    # first mark light text on coloured backgrounds, then map the colours
    def blk(m):
        body = m[2]
        bgm = re.search(r'background(?:-color)?\s*:\s*([^;]+)', body)
        if bgm:
            bgv = bgm[1]
            cs = [rgb_of(h) for h in HEX.findall(bgv)]
            vr = re.search(r'var\(--([a-z0-9-]+)', bgv)
            coloured = any(mp.role(c) in ('accent', 'soft', 'ok', 'warn', 'err') for c in cs) or \
                (vr and (var_role(vr[1]) in ('accent', 'soft', 'ok', 'warn', 'err') or vr[1][4:] in ('accent', 'soft', 'ok', 'warn', 'err')))
            if coloured and 'gradient' not in bgv or (coloured and cs):
                body = LIGHT_TEXT.sub('color: var(--sos-bg)', body)
        return m[1] + body + '}'
    seg = re.sub(r'([^{}]*\{)([^{}]*)\}', blk, seg)
    return map_colours(seg, mp)


INLINE = re.compile(r'''((?:color|background(?:-color)?|border(?:-[a-z]+)?(?:-color)?|fill|stroke)\s*:\s*)([^;"'`]+)''')
JS_STYLE = re.compile(r'''(\.style\.(?:color|background|backgroundColor|borderColor)\s*=\s*['"])(#[0-9a-fA-F]{3,6})(['"])''')


def do_inline(path, mp):
    t = open(path, encoding='utf-8').read()
    o = t
    t = JS_STYLE.sub(lambda m: m[1] + mp.hexref(m[2]) + m[3], t)
    def inl(m):
        return m[1] + map_colours(m[2], mp)
    lines = []
    for line in t.split('\n'):
        if re.search(r'fillStyle|strokeStyle|addColorStop|shadowColor|getContext', line):
            lines.append(line); continue
        lines.append(INLINE.sub(inl, line) if 'style' in line or path.endswith('.html') else line)
    t = '\n'.join(lines)
    if t != o: open(path, 'w', encoding='utf-8').write(t)


def main():
    for app in sys.argv[1:]:
        d = os.path.join(TOP, 'apps', app, 'files')
        css = [f for f in os.listdir(d) if f.endswith('.css')]
        mp = None
        for f in css: mp = do_css(os.path.join(d, f))
        if mp is None:
            src = ''.join(open(os.path.join(d, f), encoding='utf-8').read() for f in os.listdir(d) if f.endswith('.html'))
            mp = Mapper(src)
        for f in os.listdir(d):
            if f.endswith(('.html', '.js')) and os.path.isfile(os.path.join(d, f)):
                if f.endswith('.html'):
                    # inline <style> blocks of a single-file app
                    p = os.path.join(d, f); t = open(p, encoding='utf-8').read()
                    t2 = re.sub(r'(<style[^>]*>)(.*?)(</style>)', lambda m: m[1] + inline_style_block(m[2], mp) + m[3], t, flags=re.S)
                    if t2 != t: open(p, 'w', encoding='utf-8').write(t2)
                do_inline(os.path.join(d, f), mp)
        print(app, 'accent hue', None if mp.accent_hue is None else round(mp.accent_hue))


def inline_style_block(s, mp):
    out, pos = [], 0
    for m in re.finditer(r':root\s*\{([^}]*)\}', s):
        out.append(fix_on_accent_raw(s[pos:m.start()], mp))
        out.append(':root {%s}' % rewrite_root(m[1], mp))
        pos = m.end()
    out.append(fix_on_accent_raw(s[pos:], mp))
    return ''.join(out)


if __name__ == '__main__':
    main()
