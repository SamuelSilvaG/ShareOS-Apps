# Changelog

## 1.0.0

- First release for ShareOS (requires ShareOS 0.2.0-beta.20+ and system app `zabbix-agent`).
- Full firmware SDK integration via `ShareOS.zabbix` (permissions `files` and `zabbix`, admin accounts only): load status, apply settings, restart agent, and read live daemon logs.
- Secure TLS-PSK handling: key is securely passed to the firmware daemon and never displayed back in cleartext (`status().psk` indicates boolean configuration).
- Dynamic theming with `/_shareos/theme.css`: automatically matches box light/dark mode and accent colour while keeping Zabbix red logo accent.
- Honest CLI fallback: generates exact `echo '{...}' | shareos-zabbix set` commands to inspect or apply settings via System → Terminal or SSH when SDK is unavailable.
- Built-in TLS-PSK encryption key generator: generate secure 256-bit (64 hex characters) pre-shared keys with one click.
- Optional passive mode configuration: listen port and allowed server IPs/subnets.
- Bundled official ShareOS Zabbix 7.0 template (`shareos_template.yaml`) with one-click copy and download.
- Automatic language detection matching the ShareOS system language (English, Portuguese, German) without requiring a manual language selector.
- Step-by-step Zabbix Server host setup guide and live SSH/CLI command generator.
