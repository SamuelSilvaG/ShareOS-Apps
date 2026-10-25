#!/usr/bin/env python3
"""
Build ShareOS app packages (.sapp) from apps/<id>/.

    tools/build.py [--out dist] [app-id ...]

apps/<id>/app.json  manifest (checked with the same rules as on the box)
apps/<id>/files/    the app (entry file, icon, assets)
apps/<id>/CHANGELOG.md  release notes (optional, the section of the version is used)

Output per app: dist/<id>-<version>.sapp (tar.gz: app.json + files at the top,
reproducible: sorted, owner 0, fixed time), .sapp.sha256 and <id>-<version>.notes.md
"""
import argparse, gzip, hashlib, io, json, os, re, sys, tarfile

ID_RE = re.compile(r'^[a-z][a-z0-9-]{1,31}$')
VER_RE = re.compile(r'^v?\d+\.\d+(\.\d+)?(-[A-Za-z0-9.]+)?$')
TYPES = {'webapp'}
MAX_FILES = 40 * 1048576
PERMISSIONS = {'cron', 'embed', 'files', 'torrent', 'media', 'vpn', 'status', 'tailscale', 'autobrr', 'sysinfo', 'netcheck', 'docker', 'tuya', 'notify'}   # what ShareOS knows (cron: beta.7+, embed: beta.9+, files: beta.11+, torrent: 0.2.0-beta.4+, media: 0.2.0-beta.5+, vpn/status: 0.2.0-beta.6+, tailscale: 0.2.0-beta.7+, autobrr: 0.2.0-beta.9+, sysinfo/netcheck/docker/tuya: 0.2.0-beta.11+, notify: 0.2.0-beta.12+)
JOB_RE = re.compile(r'^[a-z][a-z0-9-]{0,23}$')
CRON_RE = re.compile(r'^[0-9*/,-]+( [0-9*/,-]+){4}$')
MAX_JOBS = 5


def cron_ok(s):
    if not isinstance(s, str) or not CRON_RE.match(s): return False
    m = s.split(' ')[0]
    if m == '*': return False
    n = re.match(r'^\*/(\d+)$', m)
    return not n or int(n.group(1)) >= 5


EXT_RE = re.compile(r'^\.[a-z0-9]{1,10}$')


def check_ui(a):
    err = []
    w = a.get('window')
    if w is not None:
        if not isinstance(w, dict): err.append('window: {"width": …, "height": …}')
        else:
            for k in ('width', 'height'):
                if k in w and not (isinstance(w[k], int) and 200 <= w[k] <= 4000): err.append('window %s: 200 … 4000' % k)
    o = a.get('opens')
    if o is None: return err
    if not isinstance(o, list) or len(o) > 16: return err + ['opens: a list, at most 16 entries']
    for e in o:
        ext = e.get('ext') if isinstance(e, dict) else None
        if not isinstance(ext, list) or not 0 < len(ext) <= 32: err.append('opens: ext lists file extensions'); continue
        err += ['opens: invalid extension %r (like ".txt", lower case)' % x for x in ext if not isinstance(x, str) or not EXT_RE.match(x)]
        if e.get('mode', 'view') not in ('view', 'edit'): err.append('opens: mode is "view" or "edit"')
    return err


def check_jobs(a, files):
    perms, err = a.get('permissions', []), []
    if 'internet' in a and not isinstance(a['internet'], bool): err.append('internet: true or false')
    if not isinstance(perms, list): return ['permissions: a list, e.g. ["cron"]']
    err += ['unknown permission: %s (known: %s)' % (p, ', '.join(sorted(PERMISSIONS))) for p in perms if p not in PERMISSIONS]
    if 'torrent' in perms and 'files' not in perms: err.append('the permission "torrent" needs "files"')
    for p in ('media', 'vpn', 'status'):
        if p in perms and 'files' not in perms: err.append('the permission "%s" needs "files"' % p)
    jobs = a.get('jobs')
    if jobs is None: return err
    if not isinstance(jobs, list) or len(jobs) > MAX_JOBS: return err + ['jobs: a list, at most %d' % MAX_JOBS]
    if jobs and 'cron' not in perms: err.append('jobs need the permission "cron"')
    seen = set()
    for j in jobs:
        jid = j.get('id', '') if isinstance(j, dict) else ''
        if not JOB_RE.match(jid) or jid in seen: err.append('job id: a-z, 0-9 and -, unique, max. 24 characters'); continue
        seen.add(jid)
        cmd = j.get('command')
        if not isinstance(cmd, str) or cmd.startswith('/') or '..' in cmd or not os.path.isfile(os.path.join(files, cmd)):
            err.append('job %s: command missing in files/' % jid)
        if not cron_ok(j.get('schedule')): err.append('job %s: schedule is a cron time, at most every 5 minutes' % jid)
        t = j.get('timeout')
        if t is not None and not (isinstance(t, (int, float)) and 10 <= t <= 3600): err.append('job %s: timeout 10 … 3600 s' % jid)
    return err
TOP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def check(app_dir):
    with open(os.path.join(app_dir, 'app.json'), encoding='utf-8') as f:
        a = json.load(f)
    err = []
    if not ID_RE.match(a.get('id', '')): err.append('id: a-z, 0-9 and -, 2-32 characters')
    if a.get('id') != os.path.basename(app_dir): err.append('id must match the folder name')
    if not VER_RE.match(a.get('version', '')): err.append('version: e.g. 1.2.0 or 1.3.0-beta.1')
    if not isinstance(a.get('name'), str) or not 0 < len(a['name']) <= 64: err.append('name: 1-64 characters')
    if not a.get('publisher'): err.append('publisher missing')
    if a.get('type') == 'system': err.append('type "system": system apps are submitted to the ShareOS repository (sysapps/), see https://github.com/UniqueDroid/ShareOS/blob/main/sysapps/README.md')
    elif a.get('type', 'webapp') not in TYPES: err.append('type: ' + ', '.join(sorted(TYPES)))
    files = os.path.join(app_dir, 'files')
    entry = a.get('entry', 'index.html')
    if '..' in entry or entry.startswith('/') or not os.path.isfile(os.path.join(files, entry)): err.append('entry file missing in files/')
    if a.get('icon') and not os.path.isfile(os.path.join(files, a['icon'])): err.append('icon file missing in files/')
    if not isinstance(a.get('description', {}), (dict, str)): err.append('description: text or {"de": …, "en": …}')
    total = 0
    for root, dirs, names in os.walk(files):
        for n in names + dirs:
            p = os.path.join(root, n)
            if os.path.islink(p): err.append('links are not allowed: ' + os.path.relpath(p, files))
        for n in names:
            total += os.path.getsize(os.path.join(root, n))
    if total > MAX_FILES: err.append('more than 40 MB')
    err += check_jobs(a, files) + check_ui(a)
    req = a.get('requires', [])
    if not isinstance(req, list) or len(req) > 5: err.append('requires: a list of at most 5 app ids')
    else: err += ['requires: invalid app id %r' % r for r in req if not isinstance(r, str) or not ID_RE.match(r) or r == a.get('id')]
    return a, err


def notes(app_dir, version):
    p = os.path.join(app_dir, 'CHANGELOG.md')
    if not os.path.isfile(p): return ''
    text = open(p, encoding='utf-8').read()
    m = re.search(r'^## +v?' + re.escape(version.lstrip('v')) + r'\b.*?$(.*?)(?=^## |\Z)', text, re.M | re.S)
    return m.group(1).strip() if m else ''


def build(app_dir, out):
    a, err = check(app_dir)
    if err:
        raise SystemExit('%s: %s' % (app_dir, '; '.join(err)))
    name = '%s-%s.sapp' % (a['id'], a['version'].lstrip('v'))
    buf = io.BytesIO()

    def add(tar, path, arc):
        ti = tar.gettarinfo(path, arc)
        ti.uid = ti.gid = 0; ti.uname = ti.gname = 'root'; ti.mtime = 0
        ti.mode = 0o755 if ti.isdir() else 0o644
        if ti.isdir(): tar.addfile(ti)
        else:
            with open(path, 'rb') as f: tar.addfile(ti, f)

    with tarfile.open(fileobj=buf, mode='w', format=tarfile.USTAR_FORMAT) as tar:
        add(tar, os.path.join(app_dir, 'app.json'), 'app.json')
        files = os.path.join(app_dir, 'files')
        for root, dirs, names in os.walk(files):
            dirs.sort()
            for d in dirs: add(tar, os.path.join(root, d), os.path.relpath(os.path.join(root, d), files))
            for n in sorted(names): add(tar, os.path.join(root, n), os.path.relpath(os.path.join(root, n), files))
    data = gzip.compress(buf.getvalue(), compresslevel=9, mtime=0)
    os.makedirs(out, exist_ok=True)
    with open(os.path.join(out, name), 'wb') as f: f.write(data)
    sha = hashlib.sha256(data).hexdigest()
    with open(os.path.join(out, name + '.sha256'), 'w') as f: f.write('%s  %s\n' % (sha, name))
    with open(os.path.join(out, name[:-5] + '.notes.md'), 'w') as f: f.write(notes(app_dir, a['version']))
    print('%s  %s  %d bytes' % (name, sha, len(data)))
    return a


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(TOP, 'dist'))
    ap.add_argument('--check', action='store_true', help='only check the manifests')
    ap.add_argument('ids', nargs='*', help='app ids under apps/, or a folder (e.g. examples/notes-demo)')
    o = ap.parse_args()
    base = os.path.join(TOP, 'apps')
    ids = o.ids or sorted(d for d in os.listdir(base) if os.path.isfile(os.path.join(base, d, 'app.json')))
    bad = 0
    for i in ids:
        d = os.path.abspath(i) if os.sep in i else os.path.join(base, i)
        i = os.path.basename(d.rstrip(os.sep))
        if o.check:
            a, err = check(d)
            print('%-20s %s' % (i, 'ok ' + a.get('version', '') if not err else 'FAIL ' + '; '.join(err)))
            bad += bool(err)
        else:
            build(d, o.out)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
