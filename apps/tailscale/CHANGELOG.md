# Changelog

## 1.1.0

- Talks to the box for real through `ShareOS.tailscale` (needs ShareOS 0.2.0-beta.8+ and the system app `tailscaled`, which the store installs first) – the LocalAPI guesswork, the API endpoint setting and the demo mode are gone.
- *Connect* runs `tailscale up` on the box; the sign-in link is shown with a real, scannable QR code (qrcode-generator by Kazuhiko Arase, MIT) and the app closes the dialog by itself once the box is in the Tailnet.
- Sign-in with an auth key, *Sign in again* and *Log out of Tailnet* in the VPN menu.
- Real ping over the Tailnet (`tailscale ping`), with direct/relay shown per device.
- Clear notices when the system app is missing or the account is not an administrator.
- Can be shown as a page inside ShareOS (`embed`).
- Remote-access guide: Transmission link fixed (`http://<ip>/#/apps/run/transmission`).

## 1.0.0

- Initial release for ShareOS: secure remote VPN access to the box via Tailscale.
- Tailored for low-power NAS hardware (DNS-320L): focused on remote access to ShareOS Web UI, Transmission, and SSH.
- Explicit hardware performance notice regarding software WireGuard encryption overhead during file transfers.
- Status dashboard: connection state, Tailscale IPv4 (`100.x.y.z`), IPv6, MagicDNS FQDN, and Tailnet name.
- Peer device list: view online devices in your Tailnet with their OS, IP addresses, and ping test.
- Remote access guide: one-click copyable addresses for ShareOS Web UI, Transmission, and SSH.
- Low-overhead smart polling: 20s interval, automatically paused when backgrounded to conserve CPU.
- Interactive authentication: login URL with QR code for mobile login, or non-interactive Auth Key (`tskey-auth-...`).
- Native ShareOS look & feel with dark/light themes, accent colors, and menu bar.
- Multilingual interface: Portuguese, English, and German (`pt`, `en`, `de`) with automatic detection.
