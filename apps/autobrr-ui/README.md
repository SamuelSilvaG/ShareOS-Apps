# autobrr-ui for ShareOS

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
   - Requires permissions `files`, `autobrr`, and `torrent` (admin accounts only, ShareOS 0.2.0-beta.9+).
   - `.status()`: reports daemon state, ports, drop directory, and active account.
   - `.start()`: starts the background daemon.
   - `.set({ enabled, ui, account })`: updates boot configuration, external web UI access, and handover user.
   - `.password(pw)`: updates the web dashboard password for the `admin` user.
   - `.accounts()`: queries available user accounts on the box.
   - `.log()`: retrieves recent daemon execution logs.
   - `.api(method, path, body)`: proxies requests directly to autobrr's REST API authenticated with the internal ShareOS API key.

---

## Native Web Interface Access & Password Setup (:7474)

autobrr includes its official native web interface on port **7474**.

### 1. Network Access (IP Address vs Hostname)
- By default, autobrr binds strictly to `127.0.0.1:7474` to conserve sockets and memory.
- To open it from other devices on your local network (PC, laptop, smartphone):
  1. Open **autobrr-ui** in ShareOS.
  2. Go to the **Settings** tab.
  3. Under **Native autobrr Web Interface (Port 7474)**, enable **"Expose Web UI on local network (0.0.0.0:7474)"**.
  4. Access the web interface using the **NAS IP address** (e.g., `http://192.168.1.50:7474`).
  > **Note:** Many home routers do not resolve local hostnames like `http://shareos:7474`. Always prefer using your box's static or DHCP IP address to connect reliably.

### 2. Default Username and Admin Password Setup
autobrr does **not** have an insecure pre-configured default password. You must set an admin password before logging in for the first time:

- **Default Username:** `admin`
- **Setting the Password via the App (Recommended):**
  1. In **autobrr-ui**, navigate to the **Settings** tab.
  2. Scroll down to **Admin Web UI Password**.
  3. Enter your desired password in **New Password** (minimum 8 characters, maximum 128 characters).
  4. Click **Update Password** (or *Salvar Senha*).
  5. The app executes `ShareOS.autobrr.password(pw)`, registering the hashed credentials for user `admin`.
  6. Open `http://<NAS_IP>:7474` and log in with username `admin` and your newly created password.

- **Setting the Password via SSH / Terminal (Alternative):**
  If accessing the box shell as `root`:
  ```sh
  /usr/sbin/shareos-autobrr password "YourSecretPassword"
  ```
  The configuration and SQLite database are stored at:
  ```sh
  /mnt/<storage-volume>/.shareos/autobrr/config.toml
  /mnt/<storage-volume>/.shareos/autobrr/autobrr.db
  ```

---

## Features

- **Real-Time Release Monitoring:** Captures releases from IRC channels and RSS feeds.
- **Filter Management:** Create, edit, toggle, and delete filters (resolutions, codecs, wildcards, freeleech, size constraints).
- **IRC & Indexers Status:** Live diagnostics for announce channels and trackers.
- **Transmission Integration:** Direct launcher and live RPC connection testing.
- **Service & Security Controls:** Start/stop daemon, toggle autostart on boot, view logs, and manage the native web UI.
- **Native ShareOS UI:** Supports ShareOS dark/light themes, accent colors, menu bar, and localized translations (English, German, Portuguese).

---

## Requirements

- **Firmware:** ShareOS 0.2.0-beta.9 or newer.
- **Permissions:** `files`, `autobrr`, `torrent` (administered by box admins).
- **System Apps:** `autobrr` (installed via Store → System Apps) and `transmission-daemon`.
- **Storage:** Formatted apps drive (Storage volume).
