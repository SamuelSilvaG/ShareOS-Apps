# Changelog

## 1.0.2

- Added Edit button (✏️) in the Indexers list table to allow modifying existing tracker indexers without duplicate insertion.
- Prevent duplicate identifier errors with explicit confirmation: prompt "Indexer “X” already exists – update it?" before overwriting an existing indexer; cancelling leaves the existing indexer untouched and keeps the modal open to edit the identifier.
- Added quick link to the native autobrr Web UI (:7474) inside the indexer modal for trackers requiring complex IRC bot invites or custom schemas.

## 1.0.1

- Display name aligned to **autobrr-ui** across UI title bar, menu bar and window title to clearly distinguish the web interface from the backend system daemon `autobrr`.
- Added native **IRC Networks** and **Indexers** management directly in the ShareOS UI: connect and configure IRC networks (server, port, TLS, nick, auth mechanism SASL/NickServ, announce channels), restart connections, and create/manage indexers from autobrr templates with live API connection tests.
- Fix **Open Transmission** launching without a ShareOS app grant (`?fs=`): ensure the `torrent` permission is shipped in the packaged manifest, convert `#btn-open-trans-app` to a button so it always invokes `ShareOS.openApp('transmission')`, and avoid falling back to an unauthenticated URL inside ShareOS.
- Fix Transmission daemon detection and **Test Transmission RPC** (`checkTransmissionStatus` / `testTransmissionRPC`) to read the unwrapped session object returned by `ShareOS.torrent.rpc('session-get')`.
- Fix **Advanced Setup (:7474)** resolving to `http://shareos:7474` instead of the NAS IP address: prioritize the IP address from `?origin=` / `window.location.hostname` over the system hostname, enable `0.0.0.0:7474` in a single daemon call, and preserve browser user activation so pop-ups are not blocked.

## 1.0.0

- First release for ShareOS (requires ShareOS 0.2.0-beta.9+ and system apps `autobrr` + `transmission-daemon`).
- Integrated directly with the firmware daemon via `ShareOS.autobrr` (permissions `files`, `autobrr`, and `torrent` for admin accounts).
- Automatic torrent hand-over: dispatches matching releases to the dedicated drop folder (`/mnt/<drive>/.shareos/autobrr-drop`, mode 2770) watched by the chosen user's Transmission daemon.
- Complete filter management: view, create, edit, toggle, and delete filters via autobrr's REST API.
- IRC networks and announce channels live monitoring dashboard.
- Service management: start, stop, toggle autostart on boot, and live daemon log viewer.
- Native autobrr Web UI toggle: switch port 7474 between localhost-only and network-wide exposure, with direct admin password configuration.
- Native ShareOS desktop integration: theme adaptiveness (light/dark with accents), menubar, responsive layout, and full multi-language translations (English, German, Portuguese).
