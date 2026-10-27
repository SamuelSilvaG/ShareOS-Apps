# autobrr for ShareOS

Download automation for IRC announces and RSS feeds designed for the ShareOS ecosystem (D-Link DNS-320L, DNS-320 rev B, DNS-325). It monitors indexers in real time and automatically dispatches matching torrents to the local **Transmission** client.

## How it Works in ShareOS

autobrr runs as a native box-wide service (system app `autobrr`, version 1.89.0) with dedicated optimizations for Kirkwood ARMv5:

1. **System Service:**
   - Managed via `/usr/sbin/shareos-autobrr` under user `autobrr` with strict memory controls (`GOMEMLIMIT=48MiB GOGC=30`).
   - SQLite database (`autobrr.db`) and secrets reside on the apps storage drive (`/mnt/<drive>/.shareos/autobrr`), never wearing down the internal NAND flash.
   - Listens on `127.0.0.1:7474` by default for maximum security; can be exposed on the local network (`0.0.0.0:7474`) via the app settings.

2. **Transmission Handover Mechanism:**
   - In ShareOS, each user runs their own isolated `transmission-daemon`.
   - When an administrator configures a target account in autobrr, ShareOS creates the drop folder `/mnt/<drive>/.shareos/autobrr-drop` with permissions `2770` (`<account>:autobrr`).
   - The target account's Transmission service is configured to watch this directory.
   - Matching torrents dropped into this folder are automatically imported and downloaded by Transmission.

3. **ShareOS App SDK (`window.ShareOS.autobrr`):**
   - Requires permissions `files` and `autobrr` (admin accounts only, ShareOS 0.2.0-beta.9+).
   - `.status()`: reports daemon state, ports, drop directory, and active account.
   - `.start()`: starts the background daemon.
   - `.set({ enabled, ui, account })`: updates boot configuration, external web UI access, and handover user.
   - `.password(pw)`: updates the web dashboard password for the `admin` user.
   - `.accounts()`: queries available user accounts on the box.
   - `.log()`: retrieves recent daemon execution logs.
   - `.api(method, path, body)`: proxies requests directly to autobrr's REST API authenticated with the internal ShareOS API key.

---

## Features

- **Real-Time Release Monitoring:** Captures releases from IRC channels and RSS feeds.
- **Filter Management:** Create, edit, toggle, and delete filters (resolutions, codecs, wildcards, freeleech, size constraints).
- **IRC & Indexers Status:** Live diagnostics for announce channels and trackers.
- **Service & Security Controls:** Start/stop daemon, toggle autostart on boot, view logs, and manage the native web UI.
- **Native ShareOS UI:** Supports ShareOS dark/light themes, accent colors, menu bar, and localized translations (English, German, Portuguese).

---

## Requirements

- **Firmware:** ShareOS 0.2.0-beta.9 or newer.
- **Permissions:** `files`, `autobrr`, `torrent` (administered by box admins).
- **System Apps:** `autobrr` (installed via Store → System Apps) and `transmission-daemon`.
- **Storage:** Formatted apps drive (Storage volume).
