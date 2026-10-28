# Zabbix Agent Config for ShareOS

A graphical dashboard and configuration management app for the **Zabbix Agent** system service on ShareOS (D-Link DNS-320L, DNS-320 rev B, DNS-325).

The underlying service is provided by the classic C Zabbix agent (`zabbix_agentd` 7.0 LTS, system app `zabbix-agent`), running in active mode with minimal resource footprint (~5 MB, no open listener port by default, keeping Samba and Kirkwood ARMv5 NAS operations fast).

---

## Features

1. **Intuitive Service Configuration:**
   - **Active Check Servers:** Configure one or multiple Zabbix server/proxy endpoints (`host[:port]`).
   - **Host Identity:** Choose custom host names or default to the ShareOS box hostname, with customizable `HostMetadata` for auto-registration.
   - **Built-in TLS-PSK Generator:** Generate secure 64-character hex pre-shared keys (256-bit) directly in the browser via Web Crypto API.
   - **SMART Read Intervals:** Select interval (10, 15, 20, 30, or 60 min) between disk health checks to respect disk spindown/sleep states.
   - **Optional Passive Checks:** Toggle passive checks, configure custom listening port (default 10050), and define allowed server IPs.

2. **Zabbix Server Integration Assistant:**
   - **Bundled ShareOS Template:** Download or copy the official `shareos_template.yaml` (Zabbix 7.0+) with low-level discovery rules for hard drives, SSDs, and RAID arrays.
   - **Host Setup Checklist:** Step-by-step guidance showing the exact host name, linked templates (`Linux by Zabbix agent active` and `ShareOS by Zabbix agent active`), and encryption parameters.

3. **Metrics Diagnostics Preview:**
   - Live diagnostics showing the exact metrics that the agent delivers:
     - Box temperature (°C) and fan speed (RPM and PWM).
     - Individual bay hard drive / SSD health (SMART rating, temperature, power cycles, reallocated sectors, and standby state).
     - RAID array status (level, healthy disks, rebuild / sync progress).

4. **CLI Command Sync:**
   - Real-time command generator creating the exact `echo '...' | shareos-zabbix set` command for terminal/SSH auditing.

---

## Requirements

- **Firmware:** ShareOS 0.2.0-beta.15 or newer.
- **System App:** `zabbix-agent` (installed via Store → System Apps).
- **Permissions:** `files`, `sysinfo` (administered by box admins).
