/**
 * Zabbix Agent Config - Main Application Logic
 * Integrates with ShareOS zabbix-agent service and APIs
 */
(function() {
	'use strict';

	const SOS = window.ShareOS || null;
	const ZBX = SOS && SOS.zabbix ? SOS.zabbix : null;
	const SYS = SOS && SOS.sysinfo ? SOS.sysinfo : null;

	// State
	const state = {
		installed: true,
		enabled: true,
		running: false,
		server: '',
		hostname: '',
		hostname_used: '',
		metadata: 'ShareOS',
		psk_identity: '',
		psk: '',
		psk_set: false,
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
		btnCopyCliFooter: document.getElementById('btnCopyCliFooter'),
		btnCopyCliTop: document.getElementById('btnCopyCliTop'),
		cliNoticeCard: document.getElementById('cliNoticeCard'),
		footerHostStatus: document.getElementById('footerHostStatus'),
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
		disksTableBody: document.getElementById('disksTableBody'),
		raidTableBody: document.getElementById('raidTableBody'),
		telemetryNotice: document.getElementById('telemetryNotice'),
		telemetryNoticeText: document.getElementById('telemetryNoticeText'),
		toastContainer: document.getElementById('toastContainer')
	};

	function escapeHTML(str) {
		if (str == null) return '';
		return String(str)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

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

	// Load status and configuration
	async function loadConfig() {
		try {
			if (ZBX && ZBX.status) {
				const res = await ZBX.status();
				if (res) {
					Object.assign(state, res);
				}
				// Firmware API is present
				if (els.cliNoticeCard) els.cliNoticeCard.style.display = 'none';
				if (els.btnApply) els.btnApply.style.display = 'inline-flex';
				if (els.btnCopyCliFooter) els.btnCopyCliFooter.style.display = 'none';
			} else {
				// No firmware API yet: version A (CLI command workflow)
				state.running = false;
				if (els.cliNoticeCard) els.cliNoticeCard.style.display = 'flex';
				if (els.btnApply) els.btnApply.style.display = 'none';
				if (els.btnCopyCliFooter) els.btnCopyCliFooter.style.display = 'inline-flex';
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
			await loadTelemetry();
		} catch (err) {
			console.error('Failed to load configuration:', err);
		}
	}

	// Update Status Pill
	function updateStatusBadge() {
		els.statusPill.className = 'status-pill';

		if (!ZBX) {
			// Honest CLI mode indicator when firmware API is not yet available
			els.statusPill.classList.add('neutral');
			els.statusText.textContent = I18n.t('status_cli_mode', 'CLI Mode');
			if (els.footerHostStatus) {
				els.footerHostStatus.textContent = I18n.t('footer_cli_mode', 'Terminal / SSH Mode');
			}
			return;
		}

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

		if (els.footerHostStatus) {
			els.footerHostStatus.textContent = state.running
				? I18n.t('status_connected', 'Active Mode Configured')
				: I18n.t('status_stopped', 'Stopped');
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

		if (!ZBX) {
			// Honest behaviour: no real API available, copy command to apply via Terminal/SSH
			copyToClipboard(els.cliPreview.textContent, I18n.t('copy_cli_apply_hint', 'Command copied! Run in System → Terminal or SSH to apply settings.'));
			return;
		}

		els.btnApply.disabled = true;
		const originalText = els.btnApply.querySelector('span').textContent;
		els.btnApply.querySelector('span').textContent = I18n.t('applying', 'Applying...');

		try {
			await ZBX.set(payload);
			if (ZBX.restart) {
				await ZBX.restart();
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

	// Render Disks in telemetry table
	function renderDisks(disks) {
		if (!els.disksTableBody) return;
		if (!disks || !Array.isArray(disks) || disks.length === 0) {
			els.disksTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--sos-text-muted); padding:16px;">–</td></tr>`;
			return;
		}

		els.disksTableBody.innerHTML = disks.map(d => {
			const devName = escapeHTML(d.name ? `/dev/${d.name}` : (d.dev || '–'));
			const model = escapeHTML(d.model || d.vendor || '–');
			const smart = escapeHTML(d.smart || d.health || 'PASSED');
			const temp = d.temp != null ? `${d.temp} °C` : '–';
			const isStandby = !!d.standby;
			const stateBadge = isStandby
				? `<span class="pill-badge yellow">${I18n.t('drive_standby', 'Standby')}</span>`
				: `<span class="pill-badge green">${I18n.t('drive_healthy', 'Active')}</span>`;

			return `<tr>
				<td><code>${devName}</code></td>
				<td>${model}</td>
				<td><span class="pill-badge green">${smart}</span></td>
				<td>${temp}</td>
				<td>${stateBadge}</td>
			</tr>`;
		}).join('');
	}

	// Render RAID in telemetry table
	function renderRaid(raid) {
		if (!els.raidTableBody) return;
		if (!raid || !Array.isArray(raid) || raid.length === 0) {
			els.raidTableBody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--sos-text-muted); padding:16px;">–</td></tr>`;
			return;
		}

		els.raidTableBody.innerHTML = raid.map(r => {
			const dev = escapeHTML(r.dev || r.name || '–');
			const level = escapeHTML(r.level || 'RAID');
			const health = escapeHTML(r.health || 'Healthy');
			const disks = escapeHTML(r.disks || `${r.working || 0} / ${r.total || 0}`);
			const sync = escapeHTML(r.sync || '100%');

			return `<tr>
				<td><code>${dev}</code></td>
				<td>${level}</td>
				<td><span class="pill-badge green">${health}</span></td>
				<td>${disks}</td>
				<td>${sync}</td>
			</tr>`;
		}).join('');
	}

	// Telemetry / Metrics loader using ShareOS.sysinfo.info()
	async function loadTelemetry() {
		if (!SYS || typeof SYS.info !== 'function') {
			// Honest empty values when API is unavailable
			els.mTemp.textContent = '–';
			els.mFanRpm.textContent = '–';
			els.mFanPwm.textContent = '–';
			els.mBoard.textContent = '–';
			renderDisks(null);
			renderRaid(null);
			if (els.telemetryNotice) {
				els.telemetryNotice.style.display = 'flex';
				if (els.telemetryNoticeText) {
					els.telemetryNoticeText.textContent = I18n.t('telemetry_admin_required', 'Administrator access required for hardware telemetry.');
				}
			}
			return;
		}

		try {
			const info = await SYS.info();
			if (els.telemetryNotice) {
				els.telemetryNotice.style.display = 'none';
			}

			// Temperature is in m°C -> divide by 1000
			if (info.temperature != null) {
				const tempC = info.temperature / 1000;
				els.mTemp.textContent = `${tempC.toFixed(1)} °C`;
			} else {
				els.mTemp.textContent = '–';
			}

			// fan_rpm does not exist on ShareOS hardware -> always show "–"
			els.mFanRpm.textContent = '–';

			// fan_pwm is 0–255 -> convert to percentage
			if (info.fan_pwm != null) {
				const pwmPct = Math.round((info.fan_pwm / 255) * 100);
				els.mFanPwm.textContent = `${pwmPct} %`;
			} else {
				els.mFanPwm.textContent = '–';
			}

			els.mBoard.textContent = info.board || info.model || '–';

			renderDisks(info.disks);
			renderRaid(info.raid);
		} catch (err) {
			console.warn('sysinfo.info() call failed:', err);
			els.mTemp.textContent = '–';
			els.mFanRpm.textContent = '–';
			els.mFanPwm.textContent = '–';
			els.mBoard.textContent = '–';
			renderDisks(null);
			renderRaid(null);

			if (els.telemetryNotice) {
				els.telemetryNotice.style.display = 'flex';
				if (els.telemetryNoticeText) {
					els.telemetryNoticeText.textContent = I18n.t('telemetry_admin_required', 'Administrator access required for hardware telemetry.');
				}
			}
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

		const handleCopyCommand = () => {
			copyToClipboard(els.cliPreview.textContent, I18n.t('copy_cli_apply_hint', 'Command copied! Run in System → Terminal or SSH to apply settings.'));
		};

		els.btnCopyCli.addEventListener('click', handleCopyCommand);
		if (els.btnCopyCliTop) els.btnCopyCliTop.addEventListener('click', handleCopyCommand);
		if (els.btnCopyCliFooter) els.btnCopyCliFooter.addEventListener('click', handleCopyCommand);

		els.btnCopyTemplate.addEventListener('click', async () => {
			if (!state.templateContent) {
				await fetchTemplate();
			}
			copyToClipboard(state.templateContent, 'Zabbix YAML template copied!');
		});

		els.btnDownloadTemplate.addEventListener('click', downloadTemplateFile);

		// Apply and Refresh
		els.btnApply.addEventListener('click', saveConfig);
		els.btnRefresh.addEventListener('click', async () => {
			await loadConfig();
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
