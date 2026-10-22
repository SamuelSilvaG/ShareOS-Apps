# autobrr for ShareOS

Download automation for IRC announces and RSS feeds designed for the ShareOS ecosystem (D-Link DNS-320L). It monitors indexers in real time and automatically dispatches matching torrents to the local **Transmission** client.

## Features

- **Real-Time Release Monitoring:** Live table of releases captured from IRC announces and feeds.
- **Direct Transmission Integration:** Sends approved torrents directly to the user's `transmission-daemon` through `ShareOS.torrent.rpc`.
- **Flexible Filter Engine:** Configure filters with wildcards (`*1080p*`, `*2160p*`), exceptions (`*CAM*`), minimum/maximum file sizes, and freeleech enforcement.
- **IRC Network Diagnostics:** Monitor connection status of IRC networks and announce channels.
- **Native ShareOS UI:** Matches the ShareOS desktop appearance (light/dark themes, accent colors, menu bar, and status indicators).
- **Multi-Language (i18n):** Complete interface translations in English, Portuguese, and German.
- **Graceful Standalone / Demo Mode:** Interactive preview and testing even when the background daemon is not yet running.

---

## ⚠️ Hardware Performance Notice (D-Link DNS-320L)

The DNS-320L is powered by a Marvell Kirkwood 88F6702 1.0 GHz Single-Core ARMv5TE processor with **256 MB of RAM**:

- **Memory Overhead:** As a Go application, `autobrr` must be constrained to prevent memory exhaustion (OOM). Recommended daemon environment flags:
  ```sh
  export GOMEMLIMIT=35MiB
  export GOGC=20
  ```
- **Storage Location:** All SQLite database writes (`autobrr.db`) and configuration files (`config.toml`) must reside on SATA disks (e.g. `APP_DATA` or `/mnt/HD/...`), **never on internal NAND flash**.

---

## Backend Daemon Plan (`autobrr-daemon`)

The web app requires the background service `autobrr-daemon` (system app) running on the box to keep persistent IRC socket connections active:

### 1. Cross-Compilation Target
```bash
CGO_ENABLED=0 GOOS=linux GOARCH=arm GOARM=5 \
  go build -ldflags="-s -w" -o autobrr ./cmd/autobrr
```
*(If CGO is desired for native SQLite, use `CC=arm-linux-gnueabi-gcc` with the Kirkwood toolchain or use modern pure-Go SQLite drivers).*

### 2. Service Management
- Managed via the ShareOS firmware service layer under `sysapps/` (similar to `transmission-daemon`).
- Default local listening port: `127.0.0.1:7474`.
- Web interface communicates via local proxy (`/_shareos/cgi/autobrr`) or local direct endpoint.
