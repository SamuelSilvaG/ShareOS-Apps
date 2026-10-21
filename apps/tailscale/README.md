# Tailscale for ShareOS

Secure WireGuard-based mesh VPN access for your ShareOS box. Connect to your NAS from anywhere in the world without port forwarding, dynamic DNS, or public IP exposure.

## Features

- **Zero-Config Remote Access:** Access the ShareOS web interface, files (SMB/Samba), SSH, and web apps (like Transmission) securely over Tailscale.
- **Status & Diagnostics:** Real-time connection status, Tailscale IPv4 and IPv6 addresses, device FQDN (MagicDNS), and Tailnet info.
- **Tailnet Device List:** See all connected machines, phones, and servers in your private network with OS icons, IP addresses, and connectivity checks.
- **Easy Authentication:** Authenticate via browser link, QR code scanner on your phone, or reusable Auth Key.
- **Exit Node & Subnet Routing:** Overview and toggle instructions to use your box as a gateway into your local home network.
- **Full Localization:** Portuguese, English, and German interface with automatic language detection.

## How it works

The app connects to the Tailscale daemon (`tailscaled`) running on the box via local API or proxy, allowing full control directly from the ShareOS desktop.
