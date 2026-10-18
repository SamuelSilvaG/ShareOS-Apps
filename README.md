# ShareOS Apps

Apps for [ShareOS](https://github.com/UniqueDroid/ShareOS), the alternative NAS
firmware for the D-Link DNS-320L. ShareOS shows them under **APPS → Store** and
installs them with one click – the same way it offers firmware updates.

*Deutsch weiter unten.*

## How it works

```
apps/<id>/app.json        manifest
apps/<id>/files/          the app: entry file (index.html), icon, assets
apps/<id>/CHANGELOG.md    release notes per version (optional)
```

A push to `main` runs GitHub Actions:

1. every manifest is checked (`tools/build.py --check`),
2. each app is packed into `<id>-<version>.sapp` (tar.gz, reproducible) with a `.sha256`,
3. a version that has no release yet becomes the release `<id>-v<version>`
   (versions with a `-`, e.g. `1.1.0-beta.1`, are pre-releases = beta channel),
4. the catalog `index.json` is rebuilt and attached to the release `catalog`.

ShareOS downloads only `…/releases/download/catalog/index.json`, checks the
SHA-256 of a package before installing it and serves web apps from their own
port (8081) – another origin than the admin interface, so an app cannot use the
admin login.

To release a new version: change the app, raise `version` in `app.json`, add a
section to `CHANGELOG.md`, push.

## app.json

```json
{
  "id": "webpad",                      // a-z, 0-9, -; same as the folder name
  "name": "Webpad",
  "version": "1.0.0",
  "publisher": "UniqueDroid",
  "description": { "de": "…", "en": "…" },
  "type": "webapp",                    // later also "native" (programs for the box)
  "entry": "index.html",               // in files/
  "icon": "icon.svg",                  // in files/ (SVG or PNG)
  "category": "tools",                 // tools, media, office, network, system …
  "license": "MIT",
  "homepage": "https://…",
  "min_shareos": "0.1.0",              // also met by the betas of 0.1.0; name a beta if you need one ("0.1.0-beta.7")
  "permissions": ["cron"],             // see below; ShareOS refuses unknown ones
  "jobs": [                            // scheduled tasks, need "cron" (ShareOS 0.1.0-beta.7+)
    { "id": "cleanup",                 // a-z, 0-9, -; max. 24 characters
      "name": "Clean up",
      "command": "jobs/cleanup.sh",    // in files/, run with /bin/sh
      "schedule": "0 3 * * *",         // cron time, at most every 5 minutes
      "timeout": 300 }                 // seconds, 10 … 3600 (default 300)
  ]
}
```

### Permissions

| Permission | What the app may do |
|---|---|
| `cron` | Run its `jobs` on a schedule (at most 5, at most every 5 minutes). Each job runs as the app's own user `app-<id>` (no login, no access to the users' files) in the app's data folder, with `nice` and the time limit; the output (max. 64 KB) appears under APPS → Tasks. The admin can change or switch off every schedule there; a changed schedule stays across updates. |

Environment of a job: `APP_ID`, `APP_DIR` (the installed files, read-only for
the job), `APP_DATA` = `HOME` = working directory (the only writable place).
The install dialog shows the permissions before the app is installed.
Note: job scripts live in `files/` and can be fetched over the app web server
like any other file – keep secrets in `APP_DATA`, not in the script.

Rules for web apps: everything the app needs must be inside `files/` (no CDN –
the box often has no internet, and offline it must still work), no symbolic
links, at most 40 MB.

## Own apps

- **Upload:** APPS → Store → *Install package* takes a `.sapp` file (`tools/build.py` builds one). It is marked as “own / not verified”.
- **Own catalog:** fork this repository (or use the same layout), run the workflow, then add `https://github.com/<you>/<repo>/releases/download/catalog/index.json` under APPS → Sources.

Build locally: `tools/build.py` → `dist/`.

---

## Deutsch

Apps für ShareOS. Sie erscheinen unter **APPS → Store** und werden mit einem
Klick installiert – genauso wie Firmware-Updates angeboten werden.

- Jede App liegt in `apps/<id>/` mit `app.json` (Name, Version, Herausgeber, Beschreibung, Typ, Startdatei, Symbol) und dem Ordner `files/`.
- Ein Push auf `main` baut die Pakete (`.sapp` + SHA-256), legt für neue Versionen ein Release `<id>-v<version>` an (mit `-` in der Version = Beta) und erneuert den Katalog `index.json` im Release `catalog`.
- Neue Version: App ändern, `version` in `app.json` erhöhen, Abschnitt in `CHANGELOG.md`, pushen.
- **Berechtigungen:** `"permissions": ["cron"]` erlaubt geplante Aufgaben (`jobs` in `app.json`, Skript aus `files/`, Zeitplan im Cron-Format, höchstens alle 5 Minuten, max. 5). Sie laufen als eigener Benutzer `app-<id>` nur im Datenordner der App; der Admin kann Zeitpläne unter APPS → Aufgaben ändern oder abschalten. Ab ShareOS 0.1.0-beta.7.
- Web-Apps müssen alles mitbringen (keine CDN-Links), damit sie auch ohne Internet laufen.
- **Eigene Apps:** `.sapp` unter APPS → Store hochladen (gilt als „eigene/ungeprüft“) oder einen eigenen Katalog unter APPS → Quellen eintragen.
