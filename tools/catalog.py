#!/usr/bin/env python3
"""
Write the app catalog (index.json) from the GitHub releases of this repository.

    GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo tools/catalog.py > index.json

Every release tagged <id>-v<version> with <id>-<version>.sapp and .sha256 is a
version of the app; pre-releases are the beta channel. Name, publisher,
description, icon … come from apps/<id>/app.json on the default branch.

System apps (type "system": native programs such as nano, htop and the
Transmission daemon) are built with the firmware's toolchain in the ShareOS
repository and attached to its releases as <id>-<version>.sapp (+ .sha256).
They are listed too (SYSAPPS_REPO, default UniqueDroid/ShareOS): every
version once, from the newest firmware release that has it; name,
description … from sysapps/<id>/app.json at that release's tag.
"""
import json, os, re, sys, time, urllib.request

REPO = os.environ['GITHUB_REPOSITORY']
TOKEN = os.environ.get('GITHUB_TOKEN', '')
API = os.environ.get('GITHUB_API_URL', 'https://api.github.com')
TOP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAG_RE = re.compile(r'^([a-z][a-z0-9-]{1,31})-v(\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.]+)?)$')
SYSAPPS_REPO = os.environ.get('SYSAPPS_REPO', 'UniqueDroid/ShareOS')
SAPP_RE = re.compile(r'^([a-z][a-z0-9-]{1,31})-(\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.]+)?)\.sapp$')
RAW = os.environ.get('GITHUB_RAW_URL', 'https://raw.githubusercontent.com')


def get(url):
    req = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json', **({'Authorization': 'Bearer ' + TOKEN} if TOKEN else {})})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def releases(repo=None):
    page, out = 1, []
    while True:
        chunk = get('%s/repos/%s/releases?per_page=100&page=%d' % (API, repo or REPO, page))
        out += chunk
        if len(chunk) < 100: return out
        page += 1


def asset_text(a):
    req = urllib.request.Request(a['url'], headers={'Accept': 'application/octet-stream', **({'Authorization': 'Bearer ' + TOKEN} if TOKEN else {})})
    with urllib.request.urlopen(req) as r:
        return r.read().decode()


def raw_json(repo, ref, path):
    try:
        with urllib.request.urlopen('%s/%s/%s/%s' % (RAW, repo, ref, path)) as r:
            return json.load(r)
    except Exception:
        return None


def version_entry(meta, version, rel, pkg, sha):
    cur = version == meta.get('version')
    return {'version': version, 'date': rel['published_at'], 'prerelease': rel['prerelease'],
            'url': pkg['browser_download_url'], 'sha256': sha, 'size': pkg['size'],
            'min_shareos': meta.get('min_shareos', '0') if cur else '0',
            'permissions': meta.get('permissions', []) if cur else [],
            'internet': bool(meta.get('internet')) if cur else False,
            'requires': meta.get('requires', []) if cur else [],
            'notes_url': rel['html_url']}


def system_apps(apps):
    """the .sapp of the firmware releases (newest first); each version once"""
    seen = set()
    for rel in releases(SYSAPPS_REPO):
        if rel['draft']: continue
        assets = {a['name']: a for a in rel['assets']}
        for name, pkg in assets.items():
            m = SAPP_RE.match(name)
            sumf = assets.get(name + '.sha256')
            if not m or not sumf: continue
            app_id, version = m.groups()
            if (app_id, version) in seen or (app_id in apps and apps[app_id].get('type') != 'system'): continue
            meta = raw_json(SYSAPPS_REPO, rel['tag_name'], 'sysapps/%s/app.json' % app_id)
            if not isinstance(meta, dict) or meta.get('type') != 'system' or meta.get('id') != app_id or meta.get('version') != version:
                continue
            seen.add((app_id, version))
            a = apps.setdefault(app_id, {
                'id': app_id, 'name': meta.get('name', app_id), 'publisher': meta.get('publisher', ''),
                'description': meta.get('description', ''), 'category': meta.get('category', ''),
                'type': 'system', 'homepage': meta.get('homepage', ''), 'license': meta.get('license', ''),
                'icon_url': '%s/%s/%s/sysapps/%s/%s' % (RAW, SYSAPPS_REPO, rel['tag_name'], app_id, meta['icon']) if meta.get('icon') else None,
                'versions': []})
            v = version_entry(meta, version, rel, pkg, asset_text(sumf).split()[0])
            # the firmware releases are test versions, the programs in them are not:
            # a system app is a pre-release only by its own version (e.g. 1.2.0-rc1);
            # min_shareos keeps it from boxes that are too old
            v['prerelease'] = '-' in version
            a['versions'].append(v)


def main():
    apps = {}
    for rel in releases():
        m = TAG_RE.match(rel['tag_name'])
        if not m or rel['draft']: continue
        app_id, version = m.groups()
        assets = {a['name']: a for a in rel['assets']}
        pkg, sumf = assets.get('%s-%s.sapp' % (app_id, version)), assets.get('%s-%s.sapp.sha256' % (app_id, version))
        if not pkg or not sumf: continue
        sha = asset_text(sumf).split()[0]
        manifest = os.path.join(TOP, 'apps', app_id, 'app.json')
        if not os.path.isfile(manifest): continue      # app withdrawn from the store (folder removed)
        meta = json.load(open(manifest, encoding='utf-8'))
        a = apps.setdefault(app_id, {
            'id': app_id, 'name': meta.get('name', app_id), 'publisher': meta.get('publisher', ''),
            'description': meta.get('description', ''), 'category': meta.get('category', ''),
            'type': meta.get('type', 'webapp'), 'homepage': meta.get('homepage', ''), 'license': meta.get('license', ''),
            'icon_url': 'https://raw.githubusercontent.com/%s/main/apps/%s/files/%s' % (REPO, app_id, meta['icon']) if meta.get('icon') else None,
            'versions': []})
        a['versions'].append(version_entry(meta, version, rel, pkg, sha))
    if SYSAPPS_REPO: system_apps(apps)
    json.dump({'schema': 1, 'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'repository': REPO,
               'apps': sorted(apps.values(), key=lambda a: a['name'].lower())}, sys.stdout, indent=1, ensure_ascii=False)
    print()


if __name__ == '__main__':
    main()
