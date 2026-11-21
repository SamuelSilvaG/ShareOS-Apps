# Changelog

## 1.1.4

- Fix accent button and modal legibility: increase contrast on `<a class="sos-btn-accent">` links (such as *Open autobrr Web Interface*), modal headers/bodies/placeholders/read-only inputs across Dark and Light themes, and stop primary action buttons inside `.form-row` from stretching horizontally.
- Hide redundant state actions: hide *Start autobrr* while the daemon is running and *Stop Service* while stopped, and hide the Transmission RPC password/connect form once the client is connected (reappearing only when disconnected or when a remote password is missing).
- Copy generated remote password while hidden: keep newly generated Transmission remote passwords masked (`type="password"`) in a dedicated copy box with *Show*/*Hide* toggle, *Copy Password* button (supporting HTTP LAN clipboard fallback), and dismiss control.

## 1.1.3

- Remove the Handover Drop Folder (`autobrr-drop` / `WATCH_FOLDER`) UI, Settings handover account selector, and `Handover Ready` fallback so `autobrr-ui` operates natively through `autobrr`'s built-in Transmission RPC download client (`TRANSMISSION` filter actions). Automatically disables legacy `autobrr-drop` handover (`account: ""`) when connecting Transmission RPC and provides a one-click banner in the Transmission tab if a legacy drop folder is still active on the box.
- Fix ShareOS `rpcd` re-entrant deadlock on local Transmission RPC: stop calling `POST /api/downloaders/test` through `ShareOS.autobrr.api` for ShareOS-local hosts (`127.0.0.1:<port>/transmission/rpc`), which held single-threaded `rpcd` blocked while `uhttpd tremote` called back into `shareos.apptorrent.remote_session`.
- Save & verify safely: sequentially validate remote access enabled, account remote password presence, and `transmission-daemon` availability (`session-get`) before saving directly via `POST`/`PUT /api/downloaders`, replace the local client test with a non-blocking ShareOS RPC setup verifier, and lock action buttons during in-flight requests to prevent duplicate queued calls.
- Release retry safety: block retrying local ShareOS `TRANSMISSION` release actions through the app proxy (which would also deadlock `rpcd`) and direct users to autobrr Web UI (`:7474`) for live client testing and manual retries.

## 1.1.2

- Direct ShareOS Transmission RPC integration (optional): connect autobrr to ShareOS's local authenticated RPC proxy (`127.0.0.1:<port>/transmission/rpc`, backed by `transmission-rpc.uc`) using the account's remote password, with test/disconnect controls, remote-access/password status diagnostics, and a delivery mode selector (`Transmission RPC` vs `Watch Folder`) in Filters.
- Built-in schema-only indexer creation: require selecting a tracker or feed definition from `/api/indexer/schema` with a read-only canonical identifier (preventing invalid or orphaned identifiers), validate required fields and unchanged placeholder values, surface a clear `Unmapped / Orphan` badge on stray SQLite rows, and automatically create the associated IRC network (`POST /api/irc` with channels and `invite_command`) or Feed (`POST /api/feeds`) when adding an indexer.
- Filters aligned to autobrr's real API: select linked indexers via checkboxes populated from configured indexers, persist `indexers` and `actions` on filter creation with a two-step `POST /api/filters` + `PUT /api/filters/{id}`, fetch the full filter on edit, and send `type: "WATCH_FOLDER"` / `watch_folder` (auto-upgrading legacy `watch_dir` actions).
- Releases & IRC alignment: parse real `/api/release` objects (`indexer` object, `action_status[]`, numeric byte sizes, and rejection reasons), trigger action retries via `POST /api/release/{id}/actions/{actionStatusId}/retry`, display true IRC connection health (`connected`, `current_nick`, and `connection_errors`), and add `invite_command` to the IRC modal.

## 1.1.1

- Rollback & delete-error visibility: keep a backup payload before deleting an existing indexer after a UNIQUE collision or duplicate confirmation, restore it automatically if re-creating fails, show an error toast if deleting the old row fails after creating the replacement, fix `#indexer-modal-save-btn` passing the click event as `retried`, and use plain local script/stylesheet paths in `index.html` so `tools/build.py` stamps `?v=1.1.1`.

## 1.1.0

- Security & LAN exposure clarity: ask for confirmation before binding autobrr's native Web UI to `0.0.0.0:7474` and show a toolbar indicator badge when `:7474` is exposed with one-click deactivation back to `127.0.0.1`.
- Dynamic indexer schema settings & case-sensitive definitions: read `schema.settings` from `/api/indexer/schema` so tracker-specific credentials (`passkey`, `api_key`, `rsskey`, `cookie`, `torrent_pass`, etc.) and flags can be entered directly in the Indexer modal (preserving existing secrets on edit), preserve exact schema identifier casing (e.g. `BJ-Share`), fetch `/api/indexer/options` alongside `/api/indexer` to display and heal wrong-case SQLite rows with explicit confirmation (carrying settings over and deleting the old row only after the replacement exists), guard against duplicate conflict loops, and send clean `domain.Indexer` string maps and `base_url` fallbacks.
- IRC network editing: added Edit button (✏️) in the IRC table and preserved existing network/auth/channel passwords when updating with empty password fields.
- Filter enhancements: added optional `resolutions`, `sources`, and `codecs` fields in the Filter modal, preserved unedited filter fields and existing actions on update, and translated filter card labels and Transmission drop-folder labels.
- Light Mode & reliability: improved Light Mode (`data-theme="light"`) contrast across badges, tables, banners, info boxes, and `.sos-btn-*` variants; added `initTheme()` for ShareOS `{ theme, accent }` objects; added non-overlapping `refreshAll()` polling; sanitized release status badge CSS classes; and guarded against missing indexer names.

## 1.0.3

- Fix indexer unique constraint error (`UNIQUE constraint failed: indexer.identifier`):
  - Always fetch a fresh indexer list from the backend before duplicate validation to avoid stale state.
  - Suggest unique suffixed identifiers (e.g. `torznab-2`) when adding generic feeds (Torznab/Newznab/RSS), while preserving exact tracker definition identifiers.
  - Prevent accidental overwrite of custom indexer names when selecting presets.
  - Make duplicate indexer confirmation semantics explicit (OK = update existing, Cancel = keep editing).
  - Catch SQLite unique constraint errors, narrow error matching, and return retry call chain.
  - Ensure payload `id` is deleted when inserting new indexers.

## 1.0.2

- Added Edit button (✏️) in the Indexers list table to allow modifying existing tracker indexers without duplicate insertion.
- Preserve existing indexer settings and credentials (API key, passkey, and implementation parameters) during updates when the key field is left empty.
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
