/**
 * Zabbix Agent Config - Main Application Logic
 * Integrates with ShareOS zabbix-agent service (ShareOS.zabbix) and CLI fallback
 */
(function() {
	'use strict';

	function getZBX() {
		return (window.ShareOS && window.ShareOS.zabbix) || null;
	}

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
		btnRefresh: document.getElementById('btnRefresh'),
		btnRestart: document.getElementById('btnRestart'),
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
		btnRemovePsk: document.getElementById('btnRemovePsk'),
		wrapRemovePsk: document.getElementById('wrapRemovePsk'),
		fieldRemovePsk: document.getElementById('fieldRemovePsk'),
		fieldPassive: document.getElementById('fieldPassive'),
		fieldAllow: document.getElementById('fieldAllow'),
		fieldPort: document.getElementById('fieldPort'),
		fieldDiskInterval: document.getElementById('fieldDiskInterval'),
		// CLI, Template & Logs
		cliPreview: document.getElementById('cliPreview'),
		btnCopyCli: document.getElementById('btnCopyCli'),
		btnDownloadTemplate: document.getElementById('btnDownloadTemplate'),
		btnCopyTemplate: document.getElementById('btnCopyTemplate'),
		logsSection: document.getElementById('logsSection'),
		logsView: document.getElementById('logsView'),
		btnRefreshLogs: document.getElementById('btnRefreshLogs'),
		toastContainer: document.getElementById('toastContainer')
	};

	// Toast Notification
	function showToast(message, type = 'success') {
		if (!els.toastContainer) return;
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
		const removePsk = els.fieldRemovePsk && els.fieldRemovePsk.checked;
		const payload = {
			enabled: els.fieldEnabled.checked,
			server: els.fieldServer.value.trim(),
			hostname: els.fieldHostname.value.trim(),
			metadata: els.fieldMetadata.value.trim() || 'ShareOS',
			psk_identity: removePsk ? '' : els.fieldPskIdentity.value.trim(),
			psk: removePsk ? '' : els.fieldPskKey.value.trim(),
			passive: els.fieldPassive.checked,
			allow: els.fieldAllow.value.trim(),
			port: parseInt(els.fieldPort.value, 10) || 10050,
			disk_interval: parseInt(els.fieldDiskInterval.value, 10) || 30
		};

		// If PSK is not being removed, and no new key was entered, but PSK was already configured on the box,
		// omit psk in CLI snippet so existing key is preserved
		if (!removePsk && !payload.psk && state.psk_set) {
			delete payload.psk;
		}

		const jsonStr = JSON.stringify(payload);
		if (els.cliPreview) {
			const q = (s) => "'" + s.replace(/'/g, "'\\''") + "'";
			els.cliPreview.textContent = `echo ${q(jsonStr)} | shareos-zabbix set`;
		}
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
				if (targetTab === 'cli' && els.logsSection && els.logsSection.style.display !== 'none') {
					fetchLogs();
				}
			});
		});
	}

	// Load status and configuration
	async function loadConfig() {
		try {
			const zbx = getZBX();
			if (zbx && zbx.status) {
				const res = await zbx.status();
				if (res) {
					state.installed = res.installed !== false;
					state.enabled = res.enabled !== false;
					state.running = !!res.running;
					state.server = res.server || '';
					state.hostname = res.hostname || '';
					state.hostname_used = res.hostname_used || '';
					state.metadata = res.metadata || 'ShareOS';
					state.psk_identity = res.psk_identity || '';
					// PSK on the box is boolean: status().psk is true/false
					state.psk_set = !!res.psk;
					state.passive = !!res.passive;
					state.allow = res.allow || '';
					state.port = res.port || 10050;
					state.disk_interval = res.disk_interval || 30;
				}

				// Native Firmware API is present
				if (els.cliNoticeCard) els.cliNoticeCard.style.display = 'none';
				if (els.btnApply) els.btnApply.style.display = 'inline-flex';
				if (els.btnCopyCliFooter) els.btnCopyCliFooter.style.display = 'none';
				if (els.btnRestart) els.btnRestart.style.display = zbx.restart ? 'inline-flex' : 'none';
				if (els.logsSection && zbx.log) {
					els.logsSection.style.display = 'block';
				}
			} else {
				// Fallback: honest CLI command workflow
				state.running = false;
				state.psk_set = false;
				if (els.cliNoticeCard) els.cliNoticeCard.style.display = 'flex';
				if (els.btnApply) els.btnApply.style.display = 'none';
				if (els.btnCopyCliFooter) els.btnCopyCliFooter.style.display = 'inline-flex';
				if (els.btnRestart) els.btnRestart.style.display = 'none';
				if (els.logsSection) els.logsSection.style.display = 'none';
			}

			// Populate UI fields
			els.fieldEnabled.checked = !!state.enabled;
			els.fieldServer.value = state.server || '';
			els.fieldHostname.value = state.hostname || '';
			if (!els.fieldHostname.value && state.hostname_used) {
				els.fieldHostname.placeholder = state.hostname_used;
			}
			els.fieldMetadata.value = state.metadata || 'ShareOS';
			els.fieldPskIdentity.value = state.psk_identity || '';

			if (state.psk_set) {
				els.fieldPskKey.value = '';
				els.fieldPskKey.placeholder = I18n.t('psk_configured_placeholder', '•••••••• (Configured on box – enter new key to change)');
				if (els.wrapRemovePsk) els.wrapRemovePsk.style.display = 'block';
				if (els.btnRemovePsk) els.btnRemovePsk.style.display = 'inline-flex';
			} else {
				els.fieldPskKey.value = state.psk || '';
				els.fieldPskKey.placeholder = '64 hex characters (256-bit key)';
				if (els.wrapRemovePsk) els.wrapRemovePsk.style.display = 'none';
				if (els.btnRemovePsk) els.btnRemovePsk.style.display = 'none';
			}

			if (els.fieldRemovePsk) {
				els.fieldRemovePsk.checked = false;
				els.fieldPskIdentity.disabled = false;
				els.fieldPskKey.disabled = false;
				els.btnGenPsk.disabled = false;
				els.btnCopyPsk.disabled = false;
			}

			els.fieldPassive.checked = !!state.passive;
			els.fieldAllow.value = state.allow || '';
			els.fieldPort.value = state.port || 10050;
			els.fieldDiskInterval.value = state.disk_interval || 30;

			updateStatusBadge();
			updateCliPreview();
		} catch (err) {
			console.error('Failed to load configuration:', err);
		}
	}

	// Update Status Pill
	function updateStatusBadge() {
		const zbx = getZBX();
		els.statusPill.className = 'status-pill';

		if (!zbx) {
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
		const removePsk = els.fieldRemovePsk && els.fieldRemovePsk.checked;

		// Basic Validation
		if (payload.server && payload.server.split(',').length > 8) {
			showToast(I18n.t('err_max_servers', 'Maximum 8 servers allowed in active mode.'), 'error');
			return;
		}

		if (!removePsk) {
			if (payload.psk && (payload.psk.length < 32 || payload.psk.length > 512 || !/^[0-9a-fA-F]+$/.test(payload.psk))) {
				showToast(I18n.t('err_psk_format', 'PSK must be between 32 and 512 hexadecimal characters.'), 'error');
				return;
			}

			if (payload.psk && !payload.psk_identity) {
				showToast(I18n.t('err_psk_identity_req', 'PSK Identity is required when PSK encryption is used.'), 'error');
				return;
			}

			if (payload.psk_identity && !payload.psk && !state.psk_set) {
				showToast(I18n.t('err_psk_key_req', 'Pre-Shared Key is required when PSK Identity is set.'), 'error');
				return;
			}
		}

		const zbx = getZBX();
		if (!zbx || !zbx.set) {
			// Fallback: copy command to apply via Terminal/SSH
			copyToClipboard(els.cliPreview.textContent, I18n.t('copy_cli_apply_hint', 'Command copied! Run in System → Terminal or SSH to apply settings.'));
			return;
		}

		els.btnApply.disabled = true;
		const originalText = els.btnApply.querySelector('span').textContent;
		els.btnApply.querySelector('span').textContent = I18n.t('applying', 'Applying...');

		try {
			const setPayload = { ...payload };
			if (removePsk) {
				setPayload.psk = '';
				setPayload.psk_identity = '';
			} else if (!setPayload.psk && state.psk_set) {
				// If key input is left blank and key is already configured on the box, preserve existing key
				delete setPayload.psk;
			}
			const res = await zbx.set(setPayload); // resolves to the new status
			await loadConfig();
			showToast(I18n.t('save_success', 'Configuration saved and applied successfully!'), 'success');
		} catch (err) {
			console.error('Error applying config:', err);
			showToast(I18n.t('save_error', 'Error applying configuration. Please check the values: ') + (err.message || err), 'error');
		} finally {
			els.btnApply.disabled = false;
			els.btnApply.querySelector('span').textContent = originalText;
		}
	}

	// Restart Daemon
	async function restartAgent() {
		const zbx = getZBX();
		if (!zbx || !zbx.restart) return;
		if (els.btnRestart) els.btnRestart.disabled = true;
		try {
			await zbx.restart();
			showToast(I18n.t('restart_success', 'Zabbix agent restarted successfully!'), 'success');
			await loadConfig();
		} catch (err) {
			console.error('Restart failed:', err);
			showToast(I18n.t('restart_error', 'Failed to restart Zabbix agent: ') + (err.message || err), 'error');
		} finally {
			if (els.btnRestart) els.btnRestart.disabled = false;
		}
	}

	// Fetch Agent Logs
	async function fetchLogs() {
		const zbx = getZBX();
		if (!zbx || !zbx.log || !els.logsView) return;
		try {
			els.logsView.textContent = I18n.t('logs_loading', 'Loading logs...');
			const res = await zbx.log();
			const logText = typeof res === 'string' ? res : (res && res.log) || '';
			els.logsView.textContent = logText.trim() || I18n.t('logs_empty', 'No log entries available.');
			els.logsView.scrollTop = els.logsView.scrollHeight;
		} catch (err) {
			els.logsView.textContent = 'Error reading logs: ' + (err.message || err);
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

	// Event Listeners
	function setupEvents() {
		window.onLanguageChanged = function() {
			updateStatusBadge();
			updateCliPreview();
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
			if (input) {
				input.addEventListener('input', updateCliPreview);
				input.addEventListener('change', updateCliPreview);
			}
		});

		function toggleRemovePsk(remove) {
			if (els.fieldRemovePsk) els.fieldRemovePsk.checked = remove;
			if (remove) {
				els.fieldPskIdentity.disabled = true;
				els.fieldPskKey.disabled = true;
				els.btnGenPsk.disabled = true;
				els.btnCopyPsk.disabled = true;
				els.fieldPskKey.placeholder = I18n.t('psk_removed_placeholder', 'PSK will be removed on Save & Apply');
			} else {
				els.fieldPskIdentity.disabled = false;
				els.fieldPskKey.disabled = false;
				els.btnGenPsk.disabled = false;
				els.btnCopyPsk.disabled = false;
				els.fieldPskIdentity.value = state.psk_identity || '';
				els.fieldPskKey.placeholder = state.psk_set
					? I18n.t('psk_configured_placeholder', '•••••••• (Configured on box – enter new key to change)')
					: '64 hex characters (256-bit key)';
			}
			updateCliPreview();
		}

		if (els.fieldRemovePsk) {
			els.fieldRemovePsk.addEventListener('change', () => {
				toggleRemovePsk(els.fieldRemovePsk.checked);
			});
		}

		if (els.btnRemovePsk) {
			els.btnRemovePsk.addEventListener('click', () => {
				const newVal = !(els.fieldRemovePsk && els.fieldRemovePsk.checked);
				toggleRemovePsk(newVal);
				if (newVal) {
					showToast(I18n.t('psk_marked_for_removal', 'PSK marked for removal. Click Save & Apply to remove.'), 'warning');
				}
			});
		}

		// PSK generation
		els.btnGenPsk.addEventListener('click', () => {
			if (els.fieldRemovePsk && els.fieldRemovePsk.checked) {
				toggleRemovePsk(false);
			}
			const newKey = generatePskHex();
			els.fieldPskKey.value = newKey;
			if (!els.fieldPskIdentity.value) {
				const hostname = els.fieldHostname.value.trim() || 'shareos';
				els.fieldPskIdentity.value = `PSK-${hostname.toUpperCase()}-01`;
			}
			updateCliPreview();
			showToast('New 256-bit PSK generated!', 'success');
		});

		// Copy PSK
		els.btnCopyPsk.addEventListener('click', () => {
			const key = els.fieldPskKey.value.trim();
			if (key) {
				copyToClipboard(key, 'PSK key copied to clipboard!');
			} else if (state.psk_set) {
				showToast(I18n.t('psk_copy_secure_hint', 'Existing PSK is stored securely on the box and cannot be read back.'), 'warning');
			} else {
				showToast('PSK key is empty', 'error');
			}
		});

		const handleCopyCommand = () => {
			copyToClipboard(els.cliPreview.textContent, I18n.t('copy_cli_apply_hint', 'Command copied! Run in System → Terminal or SSH to apply settings.'));
		};

		if (els.btnCopyCli) els.btnCopyCli.addEventListener('click', handleCopyCommand);
		if (els.btnCopyCliTop) els.btnCopyCliTop.addEventListener('click', handleCopyCommand);
		if (els.btnCopyCliFooter) els.btnCopyCliFooter.addEventListener('click', handleCopyCommand);

		if (els.btnCopyTemplate) {
			els.btnCopyTemplate.addEventListener('click', async () => {
				if (!state.templateContent) {
					await fetchTemplate();
				}
				copyToClipboard(state.templateContent, 'Zabbix YAML template copied!');
			});
		}

		if (els.btnDownloadTemplate) els.btnDownloadTemplate.addEventListener('click', downloadTemplateFile);

		// Apply, Refresh & Restart
		if (els.btnApply) els.btnApply.addEventListener('click', saveConfig);
		if (els.btnRefresh) {
			els.btnRefresh.addEventListener('click', async () => {
				await loadConfig();
				showToast('Status refreshed', 'success');
			});
		}
		if (els.btnRestart) els.btnRestart.addEventListener('click', restartAgent);
		if (els.btnRefreshLogs) els.btnRefreshLogs.addEventListener('click', fetchLogs);
	}

	// Init
	document.addEventListener('DOMContentLoaded', () => {
		setupTabs();
		setupEvents();
		I18n.init();
		fetchTemplate();
		loadConfig();
	});

})();
