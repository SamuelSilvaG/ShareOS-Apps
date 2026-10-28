# Changelog

## 1.0.0

- First release for ShareOS (requires ShareOS 0.2.0-beta.15+ and system app `zabbix-agent`).
- Graphical configuration for `shareos-zabbix`: active servers, custom hostname, HostMetadata for auto-registration, and SMART disk interval.
- Built-in TLS-PSK encryption key generator: generate secure 256-bit (64 hex characters) pre-shared keys with one click.
- Optional passive mode configuration: listen port and allowed server IPs/subnets.
- Bundled official ShareOS Zabbix 7.0 template (`shareos_template.yaml`) with one-click copy and download.
- Step-by-step Zabbix Server host setup guide and live SSH/CLI command generator.
- Live system metrics diagnostics (CPU, box temperature, fan speed, disk SMART ratings, and RAID array health).
