# Changelog

## 1.0.0

- First release (draft by Jan, made to work with the box): the box itself is the VPN client – OpenVPN from the system app `openvpn` (`"requires"`), controlled through `ShareOS.vpn` (permission `vpn`, admin accounts only, ShareOS 0.2.0-beta.6+). Shown inside the ShareOS interface (`embed`).
- Import `.ovpn` profiles from the box (file dialog) or from the computer, with user name and password when the profile asks for them; the box tells which lines it removed (scripts, plugins …).
- Connect, disconnect, state (tunnel address, server, since, traffic), log; per profile: everything through the tunnel or only the VPN networks, connect when the box starts.
- The header of ShareOS shows "VPN · <address>" while connected.
