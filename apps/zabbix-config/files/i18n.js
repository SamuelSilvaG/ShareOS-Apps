/**
 * Zabbix Agent Config - Internationalization (i18n)
 * Supported languages: English (en), Portuguese (pt), German (de)
 */
(function(window) {
	'use strict';

	const translations = {
		en: {
			app_name: 'Zabbix Agent Config',
			app_subtitle: 'ShareOS Active Monitoring Agent',
			status_running: 'Running',
			status_stopped: 'Stopped',
			status_disabled: 'Disabled',
			status_not_installed: 'Not Installed',
			status_connected: 'Active Mode Configured',
			status_unconfigured: 'Not Configured',

			tab_config: 'Agent Setup',
			tab_template: 'Zabbix Template',
			tab_metrics: 'ShareOS Metrics',
			tab_cli: 'CLI & Audit',

			refresh: 'Refresh Status',
			apply_changes: 'Save & Apply',
			applying: 'Applying...',
			save_success: 'Configuration saved and applied successfully!',
			save_error: 'Error applying configuration. Please check the values.',
			copied: 'Copied to clipboard!',
			copy_failed: 'Failed to copy to clipboard.',

			// Config Tab
			sec_general: 'Service & Autostart',
			lbl_enabled: 'Enable Zabbix Agent (Autostart on boot)',
			desc_enabled: 'When enabled, the Zabbix agent daemon starts automatically on system boot.',
			
			sec_active: 'Active Server Configuration',
			desc_active: 'ShareOS Zabbix Agent operates primarily in active mode, sending discovery and collected metrics directly to your Zabbix Server or Zabbix Proxy.',
			lbl_server: 'Zabbix Server / Proxy (Active)',
			hint_server: 'Comma-separated list of host[:port] (e.g. zabbix.example.com or 192.168.1.50:10051). Maximum 8 servers.',
			lbl_hostname: 'Host Name in Zabbix',
			hint_hostname: 'The unique host name as registered in Zabbix. Leave blank to automatically use this ShareOS box hostname.',
			lbl_metadata: 'Host Metadata (Auto-Registration)',
			hint_metadata: 'Used by Zabbix Server auto-registration action. Default is "ShareOS". Maximum 255 characters.',

			sec_encryption: 'TLS-PSK Encryption',
			desc_encryption: 'Pre-Shared Key (PSK) encryption secures all metric data transmitted between this ShareOS box and your Zabbix Server.',
			lbl_psk_identity: 'PSK Identity',
			hint_psk_identity: 'Unique identifier for the key (e.g. "PSK-SHAREOS-01"). Max 128 characters.',
			lbl_psk_key: 'Pre-Shared Key (Hex)',
			hint_psk_key: 'Hexadecimal key (32 to 512 hex digits; 64 hex characters = 256 bits).',
			btn_generate_psk: 'Generate 256-bit Key',
			btn_copy_psk: 'Copy PSK',

			sec_passive: 'Passive Checks (Optional)',
			lbl_passive: 'Enable Passive Listener',
			desc_passive: 'Allows Zabbix Server or Proxy to query this agent directly on the configured listen port.',
			lbl_allow: 'Allowed Server IPs / CIDRs',
			hint_allow: 'Comma-separated list of IP addresses or CIDR subnets allowed to query this agent (max 16).',
			lbl_port: 'Listen Port',
			hint_port: 'Default is 10050 (range 1024-65535).',

			sec_intervals: 'SMART & Hardware Polling',
			lbl_disk_interval: 'SMART Cache Interval',
			desc_disk_interval: 'Interval between disk health SMART scans to avoid waking sleeping drives unnecessarily.',
			min_10: '10 minutes',
			min_15: '15 minutes',
			min_20: '20 minutes',
			min_30: '30 minutes (Default)',
			min_60: '60 minutes (Power Saver)',

			// Template Tab
			tmpl_title: 'Official ShareOS Zabbix Template',
			tmpl_badge: 'Zabbix 7.0+ Ready',
			tmpl_desc: 'Template designed specifically for ShareOS active monitoring. It automatically discovers storage drives, SMART metrics, software RAID arrays, box temperature, and fan telemetry.',
			tmpl_requirements_title: 'Template Linking Requirements',
			tmpl_req_1: 'Link "Linux by Zabbix agent active" as parent template.',
			tmpl_req_2: 'Link "ShareOS by Zabbix agent active" to monitor box hardware, fan, temperature, disks, and RAID.',
			tmpl_req_3: 'Configure Host Name and HostMetadata ("ShareOS") in your auto-registration rules.',
			btn_download_tmpl: 'Download shareos_template.yaml',
			btn_copy_tmpl: 'Copy Template YAML',
			tmpl_quick_guide: 'Quick Import Instructions',
			tmpl_step_1: 'Open your Zabbix Web UI and navigate to Data collection → Templates.',
			tmpl_step_2: 'Click the "Import" button at top right and upload the downloaded YAML file.',
			tmpl_step_3: 'Create or update your Host with the Host name matching this configuration.',
			tmpl_step_4: 'In Host Encryption tab, enable PSK connections and enter the exact PSK Identity and Key configured here.',

			// Metrics Tab
			metrics_title: 'Live Hardware & Storage Metrics',
			metrics_desc: 'Live telemetry exposed natively by the ShareOS daemon to the Zabbix agent items.',
			metric_box_temp: 'Box Temperature',
			metric_fan_rpm: 'Fan Speed',
			metric_fan_pwm: 'Fan PWM Duty',
			metric_board: 'Hardware Board',
			metric_os_version: 'ShareOS Version',
			metric_disks: 'Monitored Storage Drives',
			metric_raid: 'RAID Arrays',
			no_data: 'Awaiting agent data...',
			drive_healthy: 'Healthy',
			drive_standby: 'Standby / Spun Down',
			raid_active: 'Active & In-Sync',

			// CLI Tab
			cli_title: 'ShareOS CLI & Service Audit',
			cli_desc: 'The configuration above translates directly into standard ShareOS Zabbix daemon commands. You can review or copy the command to execute via SSH or terminal.',
			cli_generated_cmd: 'Generated Configuration Command',
			btn_copy_cli: 'Copy Command',
			cli_ref_title: 'Command Reference (`shareos-zabbix`)',
			cli_ref_status: 'Check agent installation, process state, and current settings',
			cli_ref_set: 'Apply configuration from JSON payload via stdin',
			cli_ref_restart: 'Restart the Zabbix agent daemon',
			cli_ref_logs: 'View recent agent log entries'
		},
		pt: {
			app_name: 'Zabbix Agent Config',
			app_subtitle: 'Agente de Monitoramento Ativo do ShareOS',
			status_running: 'Em Execução',
			status_stopped: 'Parado',
			status_disabled: 'Desativado',
			status_not_installed: 'Não Instalado',
			status_connected: 'Modo Ativo Configurado',
			status_unconfigured: 'Não Configurado',

			tab_config: 'Configuração',
			tab_template: 'Template Zabbix',
			tab_metrics: 'Métricas ShareOS',
			tab_cli: 'CLI & Auditoria',

			refresh: 'Atualizar Status',
			apply_changes: 'Salvar & Aplicar',
			applying: 'Aplicando...',
			save_success: 'Configurações salvas e aplicadas com sucesso!',
			save_error: 'Erro ao aplicar configurações. Verifique os valores.',
			copied: 'Copiado para a área de transferência!',
			copy_failed: 'Falha ao copiar para a área de transferência.',

			// Config Tab
			sec_general: 'Serviço & Inicialização',
			lbl_enabled: 'Ativar Agente Zabbix (Iniciar no boot)',
			desc_enabled: 'Quando ativado, o serviço do Zabbix agent inicia automaticamente no boot do sistema.',
			
			sec_active: 'Configuração do Servidor Ativo',
			desc_active: 'O agente Zabbix do ShareOS opera prioritariamente em modo ativo, enviando descoberta e métricas coletadas diretamente para o seu Zabbix Server ou Proxy.',
			lbl_server: 'Zabbix Server / Proxy (Ativo)',
			hint_server: 'Lista de host[:porta] separados por vírgula (ex: zabbix.exemplo.com ou 192.168.1.50:10051). Máximo 8 servidores.',
			lbl_hostname: 'Nome do Host no Zabbix',
			hint_hostname: 'Nome exclusivo do host cadastrado no Zabbix. Deixe em branco para usar o nome da máquina ShareOS.',
			lbl_metadata: 'Host Metadata (Auto-Registro)',
			hint_metadata: 'Usado nas regras de autorregistro do Zabbix. Padrão é "ShareOS". Máximo de 255 caracteres.',

			sec_encryption: 'Criptografia TLS-PSK',
			desc_encryption: 'A criptografia por chave pré-compartilhada (PSK) protege todo o tráfego de métricas entre este ShareOS e o seu Zabbix Server.',
			lbl_psk_identity: 'Identidade PSK',
			hint_psk_identity: 'Identificador único da chave (ex: "PSK-SHAREOS-01"). Máximo 128 caracteres.',
			lbl_psk_key: 'Chave Pré-Compartilhada (Hex)',
			hint_psk_key: 'Chave hexadecimal (32 a 512 dígitos hex; 64 caracteres hex = chave de 256 bits).',
			btn_generate_psk: 'Gerar Chave de 256 bits',
			btn_copy_psk: 'Copiar PSK',

			sec_passive: 'Checagens Passivas (Opcional)',
			lbl_passive: 'Ativar Modo Passivo',
			desc_passive: 'Permite que o Zabbix Server ou Proxy consulte o agente diretamente na porta especificada.',
			lbl_allow: 'IPs / Sub-redes Permitidas',
			hint_allow: 'Lista de IPs ou blocos CIDR autorizados a consultar o agente (máx. 16).',
			lbl_port: 'Porta de Escuta',
			hint_port: 'Padrão 10050 (intervalo 1024 a 65535).',

			sec_intervals: 'Intervalo de Coleta SMART',
			lbl_disk_interval: 'Intervalo do Cache SMART',
			desc_disk_interval: 'Tempo entre leituras de saúde dos discos para evitar acordar discos em repouso (spin down).',
			min_10: '10 minutos',
			min_15: '15 minutos',
			min_20: '20 minutos',
			min_30: '30 minutos (Padrão)',
			min_60: '60 minutos (Econômico)',

			// Template Tab
			tmpl_title: 'Template Oficial ShareOS para Zabbix',
			tmpl_badge: 'Zabbix 7.0+',
			tmpl_desc: 'Template desenvolvido especialmente para o ShareOS em modo ativo. Descobre automaticamente discos, métricas SMART, arrays de RAID, temperatura da placa e rotação das ventoinhas.',
			tmpl_requirements_title: 'Requisitos de Vínculo de Templates',
			tmpl_req_1: 'Vincule o template "Linux by Zabbix agent active" como base.',
			tmpl_req_2: 'Vincule o template "ShareOS by Zabbix agent active" para métricas de hardware, ventoinha, temperatura, discos e RAID.',
			tmpl_req_3: 'Configure o Host Name e HostMetadata ("ShareOS") nas regras de auto-registro.',
			btn_download_tmpl: 'Baixar shareos_template.yaml',
			btn_copy_tmpl: 'Copiar YAML do Template',
			tmpl_quick_guide: 'Guia Rápido de Importação',
			tmpl_step_1: 'Abra a interface web do Zabbix e acesse Coleta de dados → Templates.',
			tmpl_step_2: 'Clique no botão "Importar" no canto superior direito e envie o arquivo YAML baixado.',
			tmpl_step_3: 'Crie ou edite o Host com o mesmo nome configurado aqui.',
			tmpl_step_4: 'Na aba Criptografia do Host no Zabbix, ative PSK e informe a mesma Identidade PSK e Chave configuradas aqui.',

			// Metrics Tab
			metrics_title: 'Métricas de Hardware & Armazenamento',
			metrics_desc: 'Telemetria fornecida nativamente pelo serviço do ShareOS para as chaves do Zabbix.',
			metric_box_temp: 'Temperatura da Box',
			metric_fan_rpm: 'Velocidade da Ventoinha',
			metric_fan_pwm: 'Controle PWM',
			metric_board: 'Placa-Mãe / Modelo',
			metric_os_version: 'Versão do ShareOS',
			metric_disks: 'Discos Monitorados',
			metric_raid: 'Arrays RAID',
			no_data: 'Aguardando dados do agente...',
			drive_healthy: 'Saudável',
			drive_standby: 'Repouso / Standby',
			raid_active: 'Ativo & Sincronizado',

			// CLI Tab
			cli_title: 'CLI do ShareOS & Auditoria',
			cli_desc: 'As configurações acima se traduzem diretamente em comandos do utilitário `shareos-zabbix`. Você pode conferir ou copiar o comando para rodar manualmente via terminal ou SSH.',
			cli_generated_cmd: 'Comando de Configuração Gerado',
			btn_copy_cli: 'Copiar Comando',
			cli_ref_title: 'Comandos do Utilitário (`shareos-zabbix`)',
			cli_ref_status: 'Verifica instalação, estado do processo e configurações ativas',
			cli_ref_set: 'Aplica configurações a partir de JSON enviado via stdin',
			cli_ref_restart: 'Reinicia o serviço do agente Zabbix',
			cli_ref_logs: 'Exibe os registros recentes de log do agente'
		},
		de: {
			app_name: 'Zabbix Agent Config',
			app_subtitle: 'ShareOS Aktiver Überwachungs-Agent',
			status_running: 'Aktiv',
			status_stopped: 'Gestoppt',
			status_disabled: 'Deaktiviert',
			status_not_installed: 'Nicht installiert',
			status_connected: 'Aktiver Modus konfiguriert',
			status_unconfigured: 'Nicht konfiguriert',

			tab_config: 'Konfiguration',
			tab_template: 'Zabbix-Vorlage',
			tab_metrics: 'ShareOS-Metriken',
			tab_cli: 'CLI & Audit',

			refresh: 'Status aktualisieren',
			apply_changes: 'Speichern & Anwenden',
			applying: 'Wird angewendet...',
			save_success: 'Konfiguration erfolgreich gespeichert und angewendet!',
			save_error: 'Fehler beim Anwenden der Konfiguration.',
			copied: 'In die Zwischenablage kopiert!',
			copy_failed: 'Kopieren fehlgeschlagen.',

			// Config Tab
			sec_general: 'Dienst & Autostart',
			lbl_enabled: 'Zabbix-Agent aktivieren (Autostart beim Booten)',
			desc_enabled: 'Wenn aktiviert, startet der Zabbix-Agent-Dienst automatisch beim Systemstart.',
			
			sec_active: 'Aktive Server-Konfiguration',
			desc_active: 'Der ShareOS Zabbix-Agent arbeitet primär im aktiven Modus und sendet Metriken direkt an Ihren Zabbix-Server oder Proxy.',
			lbl_server: 'Zabbix Server / Proxy (Aktiv)',
			hint_server: 'Kommagetrennte Liste von Host[:Port] (z. B. zabbix.example.com oder 192.168.1.50:10051). Max. 8 Server.',
			lbl_hostname: 'Host-Name in Zabbix',
			hint_hostname: 'Eindeutiger Host-Name in Zabbix. Leer lassen für Box-Hostnamen.',
			lbl_metadata: 'Host-Metadaten (Auto-Registrierung)',
			hint_metadata: 'Wird für Auto-Registrierungsregeln genutzt. Standard ist "ShareOS". Max. 255 Zeichen.',

			sec_encryption: 'TLS-PSK-Verschlüsselung',
			desc_encryption: 'Pre-Shared Key (PSK) sichert die Datenübertragung zwischen ShareOS und Zabbix Server.',
			lbl_psk_identity: 'PSK-Identität',
			hint_psk_identity: 'Eindeutiger Bezeichner (z. B. "PSK-SHAREOS-01"). Max. 128 Zeichen.',
			lbl_psk_key: 'Pre-Shared Key (Hex)',
			hint_psk_key: 'Hexadezimaler Schlüssel (32 bis 512 Hex-Zeichen; 64 Hex-Zeichen = 256-Bit-Schlüssel).',
			btn_generate_psk: '256-Bit-Schlüssel generieren',
			btn_copy_psk: 'PSK kopieren',

			sec_passive: 'Passive Abfragen (Optional)',
			lbl_passive: 'Passiven Modus aktivieren',
			desc_passive: 'Erlaubt dem Zabbix-Server direkte Abfragen auf dem angegebenen Port.',
			lbl_allow: 'Erlaubte Server-IPs / CIDRs',
			hint_allow: 'Kommagetrennte Liste autorisierter IPs/Netze (max. 16).',
			lbl_port: 'Lausch-Port',
			hint_port: 'Standard ist 10050 (Bereich 1024-65535).',

			sec_intervals: 'SMART-Abfrageintervall',
			lbl_disk_interval: 'SMART-Cache-Intervall',
			desc_disk_interval: 'Zeitintervall zwischen Festplattenprüfungen, um ruhende Laufwerke zu schonen.',
			min_10: '10 Minuten',
			min_15: '15 Minuten',
			min_20: '20 Minuten',
			min_30: '30 Minuten (Standard)',
			min_60: '60 Minuten (Energiesparend)',

			// Template Tab
			tmpl_title: 'Offizielle ShareOS Zabbix-Vorlage',
			tmpl_badge: 'Zabbix 7.0+',
			tmpl_desc: 'Speziell für den aktiven Modus von ShareOS entwickelt. Erkennt automatisch Speicherlaufwerke, SMART-Werte, Software-RAID, Gehäusetemperatur und Lüfterdrehzahl.',
			tmpl_requirements_title: 'Verknüpfte Vorlagen',
			tmpl_req_1: 'Verknüpfen Sie "Linux by Zabbix agent active" als Basis.',
			tmpl_req_2: 'Verknüpfen Sie "ShareOS by Zabbix agent active" für Hardware-, Lüfter-, Temperatur-, Festplatten- und RAID-Metriken.',
			tmpl_req_3: 'Stellen Sie Hostname und HostMetadata ("ShareOS") in den Regeln sicher.',
			btn_download_tmpl: 'shareos_template.yaml herunterladen',
			btn_copy_tmpl: 'Vorlagen-YAML kopieren',
			tmpl_quick_guide: 'Schnellanleitung zum Importieren',
			tmpl_step_1: 'Öffnen Sie Zabbix und gehen Sie zu Datensammlung → Vorlagen.',
			tmpl_step_2: 'Klicken Sie oben rechts auf "Importieren" und laden Sie die YAML-Datei hoch.',
			tmpl_step_3: 'Erstellen oder bearbeiten Sie den Host mit dem konfigurierten Namen.',
			tmpl_step_4: 'Aktivieren Sie im Host-Reiter "Verschlüsselung" PSK mit derselben Identität und demselben Schlüssel.',

			// Metrics Tab
			metrics_title: 'Live-Hardware- & Speichermetriken',
			metrics_desc: 'Telemetrie, die der ShareOS-Dienst dem Zabbix-Agenten nativ bereitstellt.',
			metric_box_temp: 'Box-Temperatur',
			metric_fan_rpm: 'Lüfterdrehzahl',
			metric_fan_pwm: 'Lüfter PWM',
			metric_board: 'Hauptplatine',
			metric_os_version: 'ShareOS-Version',
			metric_disks: 'Überwachte Laufwerke',
			metric_raid: 'RAID-Verbünde',
			no_data: 'Warte auf Agenten-Daten...',
			drive_healthy: 'Einwandfrei',
			drive_standby: 'Standby / Im Ruhezustand',
			raid_active: 'Aktiv & Synchron',

			// CLI Tab
			cli_title: 'ShareOS CLI & Audit',
			cli_desc: 'Die Einstellungen entsprechen direkt den Befehlen des `shareos-zabbix`-Dienstes. Sie können den Befehl kopieren und via SSH ausführen.',
			cli_generated_cmd: 'Generierter Konfigurationsbefehl',
			btn_copy_cli: 'Befehl kopieren',
			cli_ref_title: 'Befehlsübersicht (`shareos-zabbix`)',
			cli_ref_status: 'Prüft Installation, Prozesszustand und aktive Einstellungen',
			cli_ref_set: 'Wendet Einstellungen aus JSON-Eingabe via stdin an',
			cli_ref_restart: 'Startet den Zabbix-Agentendienst neu',
			cli_ref_logs: 'Zeigt aktuelle Protokolleinträge des Agenten'
		}
	};

	let currentLang = 'en';

	function detectLanguage() {
		if (window.ShareOS && window.ShareOS.lang && translations[window.ShareOS.lang]) {
			return window.ShareOS.lang;
		}
		const navLang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
		if (navLang.startsWith('pt')) return 'pt';
		if (navLang.startsWith('de')) return 'de';
		return 'en';
	}

	currentLang = detectLanguage();

	const I18n = {
		translations: translations,
		getLang: function() {
			return currentLang;
		},
		setLang: function(lang) {
			if (translations[lang]) {
				currentLang = lang;
				this.applyToDOM();
				if (window.onLanguageChanged) {
					window.onLanguageChanged(currentLang);
				}
			}
		},
		t: function(key, fallback) {
			const dict = translations[currentLang] || translations.en;
			if (dict && dict[key]) return dict[key];
			if (translations.en && translations.en[key]) return translations.en[key];
			return fallback || key;
		},
		applyToDOM: function() {
			document.querySelectorAll('[data-i18n]').forEach(el => {
				const key = el.getAttribute('data-i18n');
				const text = this.t(key);
				if (text) {
					el.textContent = text;
				}
			});
			document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
				const key = el.getAttribute('data-i18n-placeholder');
				const text = this.t(key);
				if (text) {
					el.placeholder = text;
				}
			});
			document.querySelectorAll('[data-i18n-title]').forEach(el => {
				const key = el.getAttribute('data-i18n-title');
				const text = this.t(key);
				if (text) {
					el.title = text;
				}
			});
		}
	};

	window.I18n = I18n;
})(window);
