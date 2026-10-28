/**
 * Zabbix Agent Config - Main Application Logic
 * Integrates with ShareOS zabbix-agent service and APIs
 */
(function() {
	'use strict';

	// State
	const state = {
		installed: true,
		enabled: true,
		running: true,
		server: '',
		hostname: '',
		hostname_used: '',
		metadata: 'ShareOS',
		psk_identity: '',
		psk: '',
		passive: false,
		allow: '',
		port: 10050,
		disk_interval: 30,
		templateContent: ''
	};

	// DOM Elements
	const els = {
		statusPill: document.getElementById('statusPill'),
		statusText: document.getElementById('statusText'),
		langSelector: document.getElementById('langSelector'),
		btnRefresh: document.getElementById('btnRefresh'),
		btnApply: document.getElementById('btnApply'),
		tabBtns: document.querySelectorAll('.tab-btn'),
		tabPanels: document.querySelectorAll('.tab-panel'),
		// Form Fields
		fieldEnabled: document.getElementById('fieldEnabled'),
		fieldServer: document.getElementById('fieldServer'),
		fieldHostname: document.getElementById('fieldHostname'),
		fieldMetadata: document.getElementById('fieldMetadata'),
		fieldPskIdentity: document.getElementById('fieldPskIdentity'),
		fieldPskKey: document.getElementById('fieldPskKey'),
		btnGenPsk: document.getElementById('btnGenPsk'),
		btnCopyPsk: document.getElementById('btnCopyPsk'),
		fieldPassive: document.getElementById('fieldPassive'),
		fieldAllow: document.getElementById('fieldAllow'),
		fieldPort: document.getElementById('fieldPort'),
		fieldDiskInterval: document.getElementById('fieldDiskInterval'),
		// CLI & Template
		cliPreview: document.getElementById('cliPreview'),
		btnCopyCli: document.getElementById('btnCopyCli'),
		btnDownloadTemplate: document.getElementById('btnDownloadTemplate'),
		btnCopyTemplate: document.getElementById('btnCopyTemplate'),
		// Metrics
		mTemp: document.getElementById('mTemp'),
		mFanRpm: document.getElementById('mFanRpm'),
		mFanPwm: document.getElementById('mFanPwm'),
		mBoard: document.getElementById('mBoard'),
		toastContainer: document.getElementById('toastContainer')
	};

	// Toast Notification
	function showToast(message, type = 'success') {
		const toast = document.createElement('div');
		toast.className = `toast ${type}`;
		toast.textContent = message;
		els.toastContainer.appendChild(toast);

		requestAnimationFrame(() => {
			toast.classList.add('show');
		});

		setTimeout(() => {
			toast.classList.remove('show');
			setTimeout(() => {
				if (toast.parentNode) {
					toast.parentNode.removeChild(toast);
				}
			}, 300);
		}, 3200);
	}

	// Copy to Clipboard
	async function copyToClipboard(text, successMsg) {
		try {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				await navigator.clipboard.writeText(text);
			} else {
				const textarea = document.createElement('textarea');
				textarea.value = text;
				document.body.appendChild(textarea);
				textarea.select();
				document.execCommand('copy');
				document.body.removeChild(textarea);
			}
			showToast(successMsg || I18n.t('copied', 'Copied to clipboard!'), 'success');
		} catch (err) {
			console.error('Copy failed:', err);
			showToast(I18n.t('copy_failed', 'Failed to copy to clipboard.'), 'error');
		}
	}

	// Generate 256-bit cryptographically secure hex key
	function generatePskHex() {
		const array = new Uint8Array(32);
		window.crypto.getRandomValues(array);
		return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
	}

	// Update CLI preview snippet
	function updateCliPreview() {
		const payload = {
			enabled: els.fieldEnabled.checked,
			server: els.fieldServer.value.trim(),
			hostname: els.fieldHostname.value.trim(),
			metadata: els.fieldMetadata.value.trim() || 'ShareOS',
			psk_identity: els.fieldPskIdentity.value.trim(),
			psk: els.fieldPskKey.value.trim(),
			passive: els.fieldPassive.checked,
			allow: els.fieldAllow.value.trim(),
			port: parseInt(els.fieldPort.value, 10) || 10050,
			disk_interval: parseInt(els.fieldDiskInterval.value, 10) || 30
		};

		// Filter empty fields for cleaner CLI display if desired, or keep standard schema
		const jsonStr = JSON.stringify(payload);
		els.cliPreview.textContent = `echo '${jsonStr}' | shareos-zabbix set`;
		return payload;
	}

	// Tab Switching
	function setupTabs() {
		els.tabBtns.forEach(btn => {
			btn.addEventListener('click', () => {
				const targetTab = btn.getAttribute('data-tab');
				els.tabBtns.forEach(b => b.classList.remove('active'));
				els.tabPanels.forEach(p => p.classList.remove('active'));

				btn.classList.add('active');
				const panel = document.getElementById(`panel-${targetTab}`);
				if (panel) {
					panel.classList.add('active');
				}
			});
		});
	}

	// Load status and configuration from ShareOS backend / mock
	async function loadConfig() {
		try {
			// Check if running inside ShareOS Webview with native RPC
			if (window.ShareOS && window.ShareOS.system && window.ShareOS.system.zabbixStatus) {
				const res = await window.ShareOS.system.zabbixStatus();
				if (res) {
					Object.assign(state, res);
				}
			} else {
				// Standalone / Storage fallback
				const saved = localStorage.getItem('shareos_zabbix_cfg');
				if (saved) {
					try {
						Object.assign(state, JSON.parse(saved));
					} catch (e) {
						console.error('Failed to parse local config', e);
					}
				}
			}

			// Populate UI fields
			els.fieldEnabled.checked = !!state.enabled;
			els.fieldServer.value = state.server || '';
			els.fieldHostname.value = state.hostname || '';
			els.fieldMetadata.value = state.metadata || 'ShareOS';
			els.fieldPskIdentity.value = state.psk_identity || '';
			els.fieldPskKey.value = state.psk || '';
			els.fieldPassive.checked = !!state.passive;
			els.fieldAllow.value = state.allow || '';
			els.fieldPort.value = state.port || 10050;
			els.fieldDiskInterval.value = state.disk_interval || 30;

			updateStatusBadge();
			updateCliPreview();
			loadTelemetry();
		} catch (err) {
			console.error('Failed to load configuration:', err);
		}
	}

	// Update Status Pill
	function updateStatusBadge() {
		els.statusPill.className = 'status-pill';
		if (!state.installed) {
			els.statusPill.classList.add('stopped');
			els.statusText.textContent = I18n.t('status_not_installed', 'Not Installed');
		} else if (state.running) {
			els.statusPill.classList.add('running');
			els.statusText.textContent = I18n.t('status_running', 'Running');
		} else if (!state.enabled) {
			els.statusPill.classList.add('stopped');
			els.statusText.textContent = I18n.t('status_disabled', 'Disabled');
		} else {
			els.statusPill.classList.add('stopped');
			els.statusText.textContent = I18n.t('status_stopped', 'Stopped');
		}
	}

	// Save and Apply Configuration
	async function saveConfig() {
		const payload = updateCliPreview();

		// Basic Validation
		if (payload.server && payload.server.split(',').length > 8) {
			showToast('Maximum 8 servers allowed in active mode.', 'error');
			return;
		}

		if (payload.psk && (payload.psk.length < 32 || payload.psk.length > 512 || !/^[0-9a-fA-F]+$/.test(payload.psk))) {
			showToast('PSK must be between 32 and 512 hexadecimal characters.', 'error');
			return;
		}

		if (payload.psk && !payload.psk_identity) {
			showToast('PSK Identity is required when PSK encryption is used.', 'error');
			return;
		}

		els.btnApply.disabled = true;
		const originalText = els.btnApply.querySelector('span').textContent;
		els.btnApply.querySelector('span').textContent = I18n.t('applying', 'Applying...');

		try {
			if (window.ShareOS && window.ShareOS.system && window.ShareOS.system.zabbixSet) {
				await window.ShareOS.system.zabbixSet(payload);
			} else {
				localStorage.setItem('shareos_zabbix_cfg', JSON.stringify(payload));
				// Simulate application delay
				await new Promise(r => setTimeout(r, 600));
			}

			Object.assign(state, payload);
			state.running = payload.enabled;
			updateStatusBadge();
			showToast(I18n.t('save_success', 'Configuration saved and applied successfully!'), 'success');
		} catch (err) {
			console.error('Error applying config:', err);
			showToast(I18n.t('save_error', 'Error applying configuration. Please check the values.'), 'error');
		} finally {
			els.btnApply.disabled = false;
			els.btnApply.querySelector('span').textContent = originalText;
		}
	}

	// Fetch template content for copy/download
	async function fetchTemplate() {
		try {
			const res = await fetch('shareos_template.yaml');
			if (res.ok) {
				state.templateContent = await res.text();
			}
		} catch (e) {
			console.warn('Could not preload shareos_template.yaml', e);
		}
	}

	// Download template YAML
	function downloadTemplateFile() {
		if (!state.templateContent) {
			showToast('Template is loading, please try again in a moment.', 'error');
			return;
		}
		const blob = new Blob([state.templateContent], { type: 'application/x-yaml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'shareos_template.yaml';
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		showToast('Template downloaded: shareos_template.yaml', 'success');
	}

	// Telemetry / Metrics loader
	async function loadTelemetry() {
		try {
			if (window.ShareOS && window.ShareOS.sysinfo) {
				const info = await window.ShareOS.sysinfo();
				if (info.temperature) els.mTemp.textContent = `${info.temperature} °C`;
				if (info.fan_rpm) els.mFanRpm.textContent = `${info.fan_rpm} RPM`;
				if (info.fan_pwm) els.mFanPwm.textContent = `${info.fan_pwm} %`;
				if (info.board) els.mBoard.textContent = info.board;
			} else {
				// Realistic simulated data for preview
				els.mTemp.textContent = '38.5 °C';
				els.mFanRpm.textContent = '1450 RPM';
				els.mFanPwm.textContent = '42 %';
				els.mBoard.textContent = 'ShareOS Box v1';
			}
		} catch (e) {
			console.warn('Telemetry load failed:', e);
		}
	}

	// Event Listeners
	function setupEvents() {
		// Language selector
		els.langSelector.value = I18n.getLang();
		els.langSelector.addEventListener('change', (e) => {
			I18n.setLang(e.target.value);
			updateStatusBadge();
			updateCliPreview();
		});

		window.onLanguageChanged = function() {
			updateStatusBadge();
		};

		// Realtime input sync to CLI snippet
		const inputs = [
			els.fieldEnabled,
			els.fieldServer,
			els.fieldHostname,
			els.fieldMetadata,
			els.fieldPskIdentity,
			els.fieldPskKey,
			els.fieldPassive,
			els.fieldAllow,
			els.fieldPort,
			els.fieldDiskInterval
		];
		inputs.forEach(input => {
			input.addEventListener('input', updateCliPreview);
			input.addEventListener('change', updateCliPreview);
		});

		// PSK generation
		els.btnGenPsk.addEventListener('click', () => {
			const newKey = generatePskHex();
			els.fieldPskKey.value = newKey;
			if (!els.fieldPskIdentity.value) {
				const hostname = els.fieldHostname.value.trim() || 'shareos';
				els.fieldPskIdentity.value = `PSK-${hostname.toUpperCase()}-01`;
			}
			updateCliPreview();
			showToast('New 256-bit PSK generated!', 'success');
		});

		// Copy buttons
		els.btnCopyPsk.addEventListener('click', () => {
			const key = els.fieldPskKey.value.trim();
			if (!key) {
				showToast('PSK key is empty', 'error');
				return;
			}
			copyToClipboard(key, 'PSK key copied to clipboard!');
		});

		els.btnCopyCli.addEventListener('click', () => {
			copyToClipboard(els.cliPreview.textContent, 'CLI command copied!');
		});

		els.btnCopyTemplate.addEventListener('click', async () => {
			if (!state.templateContent) {
				await fetchTemplate();
			}
			copyToClipboard(state.templateContent, 'Zabbix YAML template copied!');
		});

		els.btnDownloadTemplate.addEventListener('click', downloadTemplateFile);

		// Apply and Refresh
		els.btnApply.addEventListener('click', saveConfig);
		els.btnRefresh.addEventListener('click', () => {
			loadConfig();
			showToast('Status refreshed', 'success');
		});
	}

	// Init
	document.addEventListener('DOMContentLoaded', () => {
		I18n.applyToDOM();
		setupTabs();
		setupEvents();
		fetchTemplate();
		loadConfig();
	});

})();
