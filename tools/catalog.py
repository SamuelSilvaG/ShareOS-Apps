#!/usr/bin/env python3
"""
Write the app catalog (index.json) from the GitHub releases of this repository.

    GITHUB_TOKEN=… GITHUB_REPOSITORY=owner/repo tools/catalog.py > index.json

Every release tagged <id>-v<version> with <id>-<version>.sapp and .sha256 is a
version of the app; pre-releases are the beta channel. Name, publisher,
description, icon … come from apps/<id>/app.json on the default branch.
"""
import json, os, re, sys, time, urllib.request

REPO = os.environ['GITHUB_REPOSITORY']
TOKEN = os.environ.get('GITHUB_TOKEN', '')
API = os.environ.get('GITHUB_API_URL', 'https://api.github.com')
TOP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TAG_RE = re.compile(r'^([a-z][a-z0-9-]{1,31})-v(\d+\.\d+(?:\.\d+)?(?:-[A-Za-z0-9.]+)?)$')


def get(url):
    req = urllib.request.Request(url, headers={'Accept': 'application/vnd.github+json', **({'Authorization': 'Bearer ' + TOKEN} if TOKEN else {})})
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def releases():
    page, out = 1, []
    while True:
        chunk = get('%s/repos/%s/releases?per_page=100&page=%d' % (API, REPO, page))
        out += chunk
        if len(chunk) < 100: return out
        page += 1


def asset_text(a):
    req = urllib.request.Request(a['url'], headers={'Accept': 'application/octet-stream', **({'Authorization': 'Bearer ' + TOKEN} if TOKEN else {})})
    with urllib.request.urlopen(req) as r:
        return r.read().decode()


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
        meta = json.load(open(manifest, encoding='utf-8')) if os.path.isfile(manifest) else {}
        a = apps.setdefault(app_id, {
            'id': app_id, 'name': meta.get('name', app_id), 'publisher': meta.get('publisher', ''),
            'description': meta.get('description', ''), 'category': meta.get('category', ''),
            'type': meta.get('type', 'webapp'), 'homepage': meta.get('homepage', ''), 'license': meta.get('license', ''),
            'icon_url': 'https://raw.githubusercontent.com/%s/main/apps/%s/files/%s' % (REPO, app_id, meta['icon']) if meta.get('icon') else None,
            'versions': []})
        a['versions'].append({'version': version, 'date': rel['published_at'], 'prerelease': rel['prerelease'],
                              'url': pkg['browser_download_url'], 'sha256': sha, 'size': pkg['size'],
                              'min_shareos': meta.get('min_shareos', '0') if version == meta.get('version') else '0',
                              'permissions': meta.get('permissions', []) if version == meta.get('version') else [],
                              'notes_url': rel['html_url']})
    json.dump({'schema': 1, 'generated': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'repository': REPO,
               'apps': sorted(apps.values(), key=lambda a: a['name'].lower())}, sys.stdout, indent=1, ensure_ascii=False)
    print()


if __name__ == '__main__':
    main()
