# Changelog

## 1.0.0

- First release (draft by Jan, made to work with the box): the box itself is the VPN client – OpenVPN from the system app `openvpn` (`"requires"`), controlled through `ShareOS.vpn` (permission `vpn`, admin accounts only, ShareOS 0.2.0-beta.6+). Shown inside the ShareOS interface (`embed`).
- Import `.ovpn` profiles from the box (file dialog) or from the computer, with user name and password when the profile asks for them; the box tells which lines it removed (scripts, plugins …).
- Connect, disconnect, state (tunnel address, server, since, traffic), log; per profile: everything through the tunnel or only the VPN networks, connect when the box starts.
- The header of ShareOS shows "VPN · <address>" while connected.
- Server mode ("Box als Server", `ShareOS.vpn.server`): switch on/off (also after a restart), address in the internet (DynDNS), port, UDP/TCP, VPN network, optionally the whole home network; hints for the port forwarding and the static route in the router. The box makes its own CA (EC keys, tls-crypt) on first use.
- Devices: add a device → a complete `.ovpn` profile is downloaded (or saved on the box) for the OpenVPN app of the phone or laptop; list with online state, VPN address and traffic; download the profile again; remove a device (its profile stops working at once). Server log.
