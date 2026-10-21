# Status: not in the store yet

Transmission (contributed by @SamuelSilvaG, PR #9) is a remote control for
`transmission-daemon`. ShareOS does not ship the daemon yet, and the app's way
to reach it (`/_shareos/cgi/transmission`) does not exist yet; the fallback to
`http://<box>:9091` is blocked by the browser (HTTPS mixed content, no CORS).

It comes back to the store when ShareOS has:

- `transmission-daemon` as a system app, one daemon per user (own torrents,
  files written with the user's rights),
- the protected proxy `/_shareos/cgi/transmission` of the apps web server,
- fixes in the app: choosing the download folder (`ShareOS.fs.pick` returns an
  array; folders of the box instead of `/mnt/...`).
