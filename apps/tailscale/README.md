# Tailscale for ShareOS

Secure WireGuard-based mesh VPN access for your ShareOS box. Connect to your NAS from anywhere in the world without port forwarding, dynamic DNS, or public IP exposure.

## Features

- **Zero-Config Remote Service Access:** Access the ShareOS web interface, Transmission torrent client, and lightweight SSH shell securely over Tailscale.
- **Status & Diagnostics:** Real-time connection status, Tailscale IPv4 and IPv6 addresses, device FQDN (MagicDNS), and Tailnet info.
- **Tailnet Device List:** See all connected machines, phones, and servers in your private network with OS icons, IP addresses, and connectivity checks.
- **Easy Authentication:** Authenticate via browser link, QR code scanner on your phone, or reusable Auth Key.
- **Low-Overhead Polling:** Efficient background updates that pause when minimized to save CPU cycles on low-power NAS devices.
- **Full Localization:** Portuguese, English, and German interface with automatic language detection.

## ⚠️ Hardware Performance Notice (D-Link DNS-320L)

The DNS-320L runs on a Marvell Kirkwood 1.0 GHz Single-Core ARMv5TE processor without hardware crypto acceleration and with 256 MB of RAM:

- **Intended Use:** Managing Transmission downloads remotely, accessing the ShareOS web desktop, and remote administration.
- **File Transfers (SMB / SFTP):** Transferring large files over the VPN will saturate the CPU at 100% due to software ChaCha20-Poly1305 encryption. Throughput is limited to ~1–3 MB/s (10–25 Mbps). Heavy file transfers can cause high load, unresponsiveness, or temporary freezing. For large files, use local LAN transfers or send download links directly to Transmission.
- **Daemon Memory Optimization:** When running `tailscaled`, it is recommended to set `GOMEMLIMIT=32MiB` and `GOGC=25` to prevent Go runtime heap exhaustion.

## How it works

The app connects to the Tailscale daemon (`tailscaled`) running on the box via local API or proxy, allowing full control directly from the ShareOS desktop.
