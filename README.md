# ShareOS Apps

Apps for [ShareOS](https://github.com/UniqueDroid/ShareOS), the alternative NAS
firmware for the D-Link DNS-320L. ShareOS shows them under **APPS → Store** and
installs them with one click – the same way it offers firmware updates.

*Deutsch weiter unten.*

> **This repository takes web apps only** (HTML/CSS/JS that run in the
> browser and use the app SDK). **System apps** – native programs and
> services (daemons) for the box – are submitted to the
> [ShareOS repository, folder `sysapps/`](https://github.com/UniqueDroid/ShareOS/tree/main/sysapps),
> which has an example of each kind. See [System apps and services](#system-apps-and-services).

## Apps

| App | What it does |
|---|---|
| [Webpad](apps/webpad) | Text editor in the style of Notepad++; opens and saves files on the box or on your computer, takes files from other apps |
| [WebTerm](apps/webterm) | Terminal with tabs, a virtual file system, a JavaScript sandbox and a bridge to Webpad; views log files of the box |
| [ShareCommander](apps/sharecommander) | Two-pane file manager in the style of Total Commander for the folders of the box and the browser file system (shared with WebTerm): ZIP, multi-rename, preview, bridges to Webpad and WinWeb Player |
| [WinWeb Player](apps/webplayer) | Audio and video player in retro style with equalizer and visualizer; plays music and videos from your area on the box (streamed, with seeking) or from your computer |
| [SheetOS](apps/sheetos) | Small spreadsheet with formulas; opens and saves CSV files of the box |
| [DevBox](apps/devbox) | Developer toolbox: JSON, Base64/URL/hex, checksums (also of files of the box), regex, diff, JWT |
| [API-Pilot](apps/apipilot) | REST and GraphQL client in the style of Postman: headers, auth, JSON/GraphQL/form bodies, history, cURL/fetch code; saves responses on the box or opens them in Webpad |
| [BeatBox Studio](apps/beatbox) | 16-step drum sequencer with synthesizer; projects (`.beatbox`) and WAV loops on the box, sends loops to WinWeb Player |
| [Transmission](apps/transmission) | BitTorrent client by @SamuelSilvaG: every user has their own Transmission service (system app `transmission-daemon`), downloads into their folders |
| [NetTunnel](apps/nettunnel) | VPN for the box (OpenVPN, system app `openvpn`): as client import profiles and connect; as server reach home from anywhere with a ready-made profile per device; admins only, shown inside ShareOS |
| [MediaTranscoder](apps/mediatranscoder) | Converts media on the box with FFmpeg (system app `ffmpeg`): audio to MP3/M4A/Opus/FLAC/WAV, videos into another container without re-encoding, cut out parts; jobs run in the background |
| [Tailscale](apps/tailscale) | WireGuard-based mesh VPN client by @SamuelSilvaG: secure zero-config remote access to your box, files (SMB) and web apps from anywhere – connects the box through the ShareOS system app `tailscaled` (admins, ShareOS 0.2.0-beta.8+) |

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

To withdraw an app from the store, move its folder out of `apps/` (e.g. to
`examples/`): the catalog lists only apps that have a folder in `apps/`; its
releases stay on GitHub.

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
  "requires": ["transmission-daemon"], // apps it needs: installed from the store first (ShareOS 0.2.0-beta.4+)
  "jobs": [                            // scheduled tasks, need "cron" (ShareOS 0.1.0-beta.7+)
    { "id": "cleanup",                 // a-z, 0-9, -; max. 24 characters
      "name": "Clean up",
      "command": "jobs/cleanup.sh",    // in files/, run with /bin/sh
      "schedule": "0 3 * * *",         // cron time, at most every 5 minutes
      "timeout": 300 }                 // seconds, 10 … 3600 (default 300)
  ],
  "window": { "width": 1100, "height": 760 },   // own window of this size (ShareOS 0.1.0-beta.9+)
  "opens": [                           // file types it opens from the file browser (beta.9+)
    { "ext": [".txt", ".md"],          // lower case, with dot
      "mode": "edit",                  // "edit" may save back, "view" only reads
      "label": { "de": "Bearbeiten", "en": "Edit" } }
  ]
}
```

### Permissions

| Permission | What the app may do |
|---|---|
| `embed` | Be shown as a page inside the ShareOS interface instead of its own window – for apps that only have settings (ShareOS 0.1.0-beta.9+). |
| `torrent` | Control the signed-in user's own Transmission service through `ShareOS.torrent.rpc(method, args)` (needs `files`; ShareOS 0.2.0-beta.4+ with the system app `transmission-daemon`). Every user has their own service; folders are `<root>/<path>` like `ShareOS.fs`, and the box passes only what a remote control needs (no scripts, no other places). |
| `media` | Media jobs with FFmpeg on the box through `ShareOS.media` (needs `files`; ShareOS 0.2.0-beta.5+ with the system app `ffmpeg`). |
| `vpn` | The box as an OpenVPN client through `ShareOS.vpn` (`list`, `status`, `log`, `importProfile`, `set`, `remove`, `connect`, `disconnect`; needs `files`; ShareOS 0.2.0-beta.6+ with the system app `openvpn`). **Admin accounts only** – a VPN changes the network of the whole box. The box cleans every profile on import (no scripts, plugins, file references). |
| `tailscale` | Remote access with Tailscale through `ShareOS.tailscale` (`status`, `up({authKey})`, `login`, `down`, `logout`, `ping(ip)`, `log`; without a key `up` answers with `auth_url`, the sign-in link; needs `files`; ShareOS 0.2.0-beta.7+, system app `tailscaled` since 0.2.0-beta.8). **Admin accounts only** – it changes the network of the whole box. |
| `status` | One short chip in the header of the ShareOS interface through `ShareOS.status.set({ text, state, ttl })` / `.clear()` (needs `files`; ShareOS 0.2.0-beta.6+): max. 24 characters, state `ok`/`warn`/`err`/`info`, gone after `ttl` seconds (max. 600) unless set again; only the account that opened the app sees it. |
| `files` | Read, change and delete the files the signed-in user reaches in the file browser (his personal folder; admins: all volumes and USB drives), with his rights, while the app is open – through `ShareOS.fs` (ShareOS 0.1.0-beta.11+). For file managers and editors that save on the box. |
| `cron` | Run its `jobs` on a schedule (at most 5, at most every 5 minutes). Each job runs as the app's own user `app-<id>` (no login, no access to the users' files) in the app's data folder, with `nice` and the time limit; the output (max. 64 KB) appears under APPS → Tasks. The admin can change or switch off every schedule there; a changed schedule stays across updates. |

Environment of a job: `APP_ID`, `APP_DIR` (the installed files, read-only for
the job), `APP_DATA` = `HOME` = working directory (the only writable place).
The install dialog shows the permissions before the app is installed.
Note: job scripts live in `files/` and can be fetched over the app web server
like any other file – keep secrets in `APP_DATA`, not in the script.

### App SDK and look (ShareOS 0.1.0-beta.9+)

The apps web server serves two files for every app – same address, works offline:

```html
<link rel="stylesheet" href="/_shareos/theme.css">
<script src="/_shareos/app.js"></script>
<body class="sos-app">
  <div class="sos-titlebar">My app <span class="sos-title-file" id="file"></span></div>
  <nav id="menu"></nav>
  <main class="sos-main">…</main>
  <div class="sos-statusbar"><span>Ready</span><span>UTF-8</span></div>
</body>
```

- **Look:** CSS variables `--sos-bg`, `--sos-panel`, `--sos-bar`, `--sos-line`, `--sos-accent`, `--sos-text`, `--sos-muted` … for light/dark and the user's accent colour (set on `<html data-theme data-accent>`; ShareOS passes the user's look in the URL and updates it live). Building blocks: `.sos-titlebar`, `.sos-menubar`, `.sos-toolbar`, `.sos-statusbar`, `.sos-btn`, `.sos-input`, `.sos-dialog`, styled scroll bars.
- **Menu bar** like Notepad++: `ShareOS.menu(document.getElementById('menu'), [{ label: 'Datei', items: [{ label: 'Speichern', kbd: 'Ctrl+S', action: save }, '-', …] }, { label: 'Bearbeiten', items: […] }, { label: 'Ansicht', items: […] }])` – mouse and keyboard, shortcuts included.
- **Opened file:** when the user opens a file from the ShareOS file browser, `ShareOS.file` is set: `await ShareOS.file.info()` (name, mode), `await ShareOS.file.text()` / `.blob()`, `await ShareOS.file.save(data)` (mode `edit` only), `ShareOS.file.url` (address of the content for `<audio>`/`<video>`; ShareOS 0.1.0-beta.11+; byte ranges for seeking). The app gets a ticket for exactly this file and the user's rights – nothing else on the box.
- **Messages between apps:** `ShareOS.emit(type, data)` / `ShareOS.on(type, fn)` (BroadcastChannel `shareos`, `{type, data, from}`; every app hears them, so no secrets). Used by the apps here: `open-file` `{to, name, path, content, readonly}` → `file-saved` `{to, path, name, content}` (Webpad), `open-media` `{to, name, blob|url}` (WinWeb Player), `ping`/`pong`/`app-ready` (is an app open?). The browser file system of WebTerm and ShareCommander is shared under the key `shareos.vfs`.
- **Folders of the box** (permission `files`, ShareOS 0.1.0-beta.11+): `ShareOS.fs.roots()`, `.list(root, path)`, `.mkdir`, `.rename`, `.copy` / `.move(root, path, names, destRoot, dest)`, `.remove`, `.open(root, path, name, {write, create})` (a file like `ShareOS.file`). Exactly the folders the signed-in user reaches in the file browser, with his rights, while the app is open (ShareOS passes a grant in the URL when it opens the app).
- **File dialog of the box** (ShareOS 0.2.0-beta.1+): `await ShareOS.fs.pick({ title, ext: ['.mp3'], multiple, save, name })` shows the user's folders and returns `[{root, path, name}]` (with `save`: the chosen folder and file name) or `null`; then `ShareOS.fs.open(…)`. Check `ShareOS.fs && ShareOS.fs.pick` before showing the button.
- **Storage per account** (ShareOS 0.2.0-beta.1+): all apps share one web origin, so ShareOS passes the account (`?user=`) and the SDK keeps `localStorage` and IndexedDB of the accounts apart (`ShareOS.user`). Load `/_shareos/app.js` **before** the app's own scripts. This separates accounts in one browser but does not protect against someone with the browser's developer tools – private data belongs on the box (`ShareOS.fs`), where the box checks the user's rights.
- **Open another app** (ShareOS 0.2.0-beta.2+): `ShareOS.openApp(id, {width, height})` opens it in its own window (the one ShareOS uses for it) with look, language and account; returns the window or `null` (pop-up blocked).
- `ShareOS.onTheme(fn)`, `ShareOS.embedded` (true inside the ShareOS interface).

Webpad loads the SDK first whenever ShareOS opened it (it passes `?user=`), so it still works as a plain HTML file anywhere.

Rules for web apps: the app itself (HTML, scripts, styles, fonts, icons) is
inside `files/` – no CDN for the app's own code, so it starts on a box without
internet. Apps **may use the internet** when they need it (online services,
streams, maps, sync …): then set `"internet": true` in `app.json`; the store
shows "uses the internet" (ShareOS 0.1.0-beta.12+, older versions ignore it).
No symbolic links, at most 40 MB.

## System apps and services

**Not here – in the [ShareOS repository](https://github.com/UniqueDroid/ShareOS/tree/main/sysapps).**
System apps (`"type": "system"`) are native programs for the box – nano,
htop, strace, iperf3, FFmpeg – and services (daemons) such as Tailscale,
OpenVPN, Transmission or the media server. They need the firmware's
toolchain, so they are built in ShareOS (`sysapps/<id>/`) and attached to its
releases as `.sapp`. The catalog lists them too (every version once, from the
newest firmware release that has it; refreshed every 3 hours), so the store
installs them like any other app. `tools/build.py` refuses `"type": "system"`.

[`sysapps/README.md`](https://github.com/UniqueDroid/ShareOS/blob/main/sysapps/README.md)
in ShareOS explains both kinds with an example each:

- a **program** (`tree`): buildroot package + `sysapps/<id>/` (`app.json`,
  `pack.json`, `icon.svg`);
- a **service** (`mosquitto`): the same plus `"service": { "control": … }` in
  `app.json` and the controller `/usr/sbin/shareos-<control>` in the firmware,
  which ShareOS uses to start the daemon at boot and stop it on removal
  (ShareOS 0.2.0-beta.9+). A package never starts a service by itself.

A web app that needs one names it in `"requires"`: installing the app installs
the system app first, and the store warns before removing a system app an
installed app needs. A web app for a service (e.g. Tailscale, NetTunnel,
Transmission) talks to it only through the app SDK and a permission of
ShareOS (`tailscale`, `vpn`, `torrent` …) – not through its own ports or
interfaces on the box. **Plan a new service?** Open an issue or pull request
in ShareOS for the system app and its controller first; the web app comes
here once ShareOS has it. A web app whose service does not exist yet cannot be
installed (its `"requires"` is not in the store) and is not merged.

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
- **Fenster und Dateien** (ab ShareOS 0.1.0-beta.9): `"window"` legt die Fenstergröße fest, `"opens"` die Dateitypen, die die App aus dem Dateibrowser öffnet (`edit` darf zurückspeichern). Die Berechtigung `embed` zeigt eine reine Einstellungs-App direkt in ShareOS an. Mit der Berechtigung `files` (ab ShareOS 0.1.0-beta.11) arbeitet eine App mit den Ordnern der Box – mit den Rechten des angemeldeten Benutzers (`ShareOS.fs`). Für Aussehen, Menüleiste (Datei | Bearbeiten | Ansicht), geöffnete Datei und Nachrichten zwischen Apps gibt es `/_shareos/theme.css` und `/_shareos/app.js` (siehe oben).
- **Speicher je Konto** (ab ShareOS 0.2.0-beta.1): Das SDK trennt `localStorage` und IndexedDB der Apps nach Konto – dafür `/_shareos/app.js` vor den eigenen Skripten laden. Private Daten gehören auf die Box (`ShareOS.fs`, Dateidialog `ShareOS.fs.pick`).
- Web-Apps bringen ihren eigenen Code mit (kein CDN für Skripte, Styles, Schriften), damit sie auch auf einer Box ohne Internet starten. **Internet nutzen dürfen sie**, wenn sie es brauchen (Online-Dienste, Streams, Karten, Sync …): dann `"internet": true` in `app.json` setzen – der Store zeigt „Nutzt das Internet“ (ab ShareOS 0.1.0-beta.12, ältere Versionen ignorieren das Feld).
- **Eigene Apps:** `.sapp` unter APPS → Store hochladen (gilt als „eigene/ungeprüft“) oder einen eigenen Katalog unter APPS → Quellen eintragen.
- **Hier nur Web-Apps.** System-Apps (Programme und Dienste für die Box, z. B. Tailscale, OpenVPN, Transmission) werden im [ShareOS-Repository unter `sysapps/`](https://github.com/UniqueDroid/ShareOS/tree/main/sysapps) eingereicht – dort gibt es je ein Beispiel für ein Programm (`tree`) und einen Dienst (`mosquitto`, mit `"service"` in `app.json` und der Steuerung `shareos-<control>` in der Firmware). Eine Web-App für einen Dienst kommt erst hierher, wenn ShareOS den Dienst hat; sie spricht ihn nur über das SDK und eine Berechtigung an.

## Example

`examples/notes-demo/` is a complete small app with the SDK: title bar,
menu bar (Datei | Bearbeiten | Ansicht), status bar, opened file and saving.
It is not in the store; `tools/build.py examples/notes-demo` builds its
`.sapp` (APPS → Store → *Install package*), or copy it as a start for an own app.
