# Changelog

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
