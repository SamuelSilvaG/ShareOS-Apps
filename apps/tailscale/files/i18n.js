// Tailscale ShareOS Web Client – i18n (pt / en / de)
'use strict';

(function () {
  const SUPPORTED = ['pt', 'en', 'de'];
  const FALLBACK = 'en';

  const STRINGS = {
    // ==========================================
    // PORTUGUÊS
    // ==========================================
    pt: {
      'app.title': 'Tailscale VPN',
      'app.tagline': 'Acesso Remoto Seguro WireGuard para ShareOS',

      // Conexão
      'conn.checking': 'Verificando conexão...',
      'conn.connected': '● Conectado à VPN',
      'conn.disconnected': '○ Desconectado',
      'conn.needsLogin': '◐ Aguardando login',
      'conn.offline': '✕ Tailscale indisponível',

      // Barra de Ferramentas
      'tb.connect': 'Conectar',
      'tb.disconnect': 'Desconectar',
      'tb.login': 'Fazer Login',
      'tb.admin': 'Painel Admin ↗',
      'tb.settings': 'Configurações',
      'tb.refresh': 'Atualizar',

      // Abas
      'tab.overview': 'Visão Geral',
      'tab.peers': 'Dispositivos na Rede',
      'tab.access': 'Como Acessar Remoto',
      'tab.advanced': 'Recursos da Box',

      // Visão Geral - Cartões
      'card.status.title': 'Estado da Conexão',
      'card.status.connected': 'Conectado e Seguro',
      'card.status.disconnected': 'Desconectado',
      'card.status.needsLogin': 'Autenticação Necessária',
      'card.status.offline': 'Serviço Parado ou Não Instalado',
      'card.ip4.title': 'Endereço Tailscale (IPv4)',
      'card.ip6.title': 'Endereço Tailscale (IPv6)',
      'card.device.title': 'Nome do Dispositivo',
      'card.tailnet.title': 'Sua Rede (Tailnet)',
      'card.magicdns.title': 'Domínio MagicDNS',
      'card.expires.title': 'Validade da Chave',

      // Banner offline / erro
      'banner.offline.title': '⚠️ Tailscale daemon (tailscaled) não respondeu.',
      'banner.offline.desc': 'Certifique-se de que o pacote Tailscale está em execução na box. Você pode iniciar o serviço no terminal ou configurar a URL da API.',
      'banner.offline.retry': 'Tentar Novamente',
      'banner.offline.cfg': 'Configurar Endpoint',
      'banner.offline.demo': 'Modo Demonstração',

      // Botões comuns
      'btn.copy': 'Copiar',
      'btn.copied': 'Copiado!',
      'btn.open': 'Abrir ↗',
      'btn.ping': 'Testar Ping',
      'btn.pinging': 'Testando...',
      'btn.ping.ok': 'Ping: {ms}ms',
      'btn.ping.fail': 'Sem resposta',
      'btn.cancel': 'Cancelar',
      'btn.save': 'Salvar',
      'btn.login.now': 'Conectar com Auth Key',
      'btn.close': 'Fechar',

      // Tabela de Peers
      'peers.search.placeholder': 'Pesquisar dispositivos pelo nome ou IP...',
      'peers.filter.all': 'Todos os dispositivos',
      'peers.filter.online': 'Somente online',
      'peers.th.device': 'Dispositivo',
      'peers.th.os': 'Sistema',
      'peers.th.ip': 'IP Tailscale',
      'peers.th.status': 'Status',
      'peers.th.actions': 'Ações',
      'peers.empty': 'Nenhum outro dispositivo encontrado na sua rede Tailscale.',
      'peers.online': 'Online',
      'peers.offline': 'Offline',
      'peers.thisDevice': 'Esta Box (Você)',

      // Guia de Acesso Remoto
      'access.hero.title': 'Como acessar sua box ShareOS de qualquer lugar do mundo',
      'access.hero.desc': 'Com o Tailscale ativo, sua box possui um IP privado (100.x.y.z) e um nome seguro criptografado de ponta a ponta sem precisar de portas abertas no roteador.',
      
      'access.step1.badge': 'Passo 1',
      'access.step1.title': 'Conecte seus outros aparelhos',
      'access.step1.desc': 'Instale o aplicativo do Tailscale no seu computador, celular ou tablet (Windows, macOS, Linux, Android ou iOS) e faça login com a mesma conta.',
      
      'access.step2.badge': 'Passo 2',
      'access.step2.title': 'Interface Web do ShareOS',
      'access.step2.desc': 'Abra o navegador em qualquer rede (Wi-Fi externo, 4G/5G) e acesse diretamente pelo IP da box:',
      
      'access.step3.badge': 'Passo 3',
      'access.step3.title': 'Arquivos em Rede (SMB / Windows / Mac)',
      'access.step3.desc': 'Abra o Explorador de Arquivos do Windows ou o Finder do Mac e conecte à pasta da box pela VPN:',
      'access.step3.win': 'No Windows: digite na barra de endereços:',
      'access.step3.mac': 'No Mac: Finder → Conectar ao Servidor (Cmd+K):',

      'access.step4.badge': 'Passo 4',
      'access.step4.title': 'Transmission e Downloads',
      'access.step4.desc': 'Acompanhe seus downloads do Transmission remotamente pelo navegador:',

      'access.step5.badge': 'Passo 5',
      'access.step5.title': 'Terminal SSH Seguro',
      'access.step5.desc': 'Conecte-se ao terminal da sua NAS sem expor a porta 22 para a internet pública:',

      // Recursos Avançados
      'adv.exitnode.title': 'Usar esta Box como Exit Node (Roteador VPN)',
      'adv.exitnode.desc': 'Permite que todo o tráfego de internet do seu celular ou notebook passe pela sua casa através da sua box ShareOS enquanto você estiver viajando.',
      'adv.exitnode.btn': 'Ativar Exit Node',
      'adv.exitnode.active': 'Exit Node Anunciado',
      'adv.subnet.title': 'Subnet Router (Acesso a toda a sua rede local)',
      'adv.subnet.desc': 'Permite acessar outros aparelhos da sua rede local (roteador, impressoras, outras máquinas) remotamente através da box.',
      'adv.subnet.btn': 'Configurar Rotas',

      // Modal Login
      'modal.login.title': 'Conectar esta Box ao Tailscale',
      'modal.login.qr.title': 'Opção 1: Escanear QR Code pelo Celular ou Abrir Link',
      'modal.login.qr.desc': 'Abra a URL de autenticação no seu navegador ou escaneie o QR Code abaixo com seu celular:',
      'modal.login.btn.open': 'Abrir Página de Login ↗',
      'modal.login.key.title': 'Opção 2: Entrar com Auth Key (Chave do Painel Tailscale)',
      'modal.login.key.desc': 'Gere uma chave em tailscale.com/admin/settings/keys e cole-a abaixo para autenticação sem navegador:',
      'modal.login.key.placeholder': 'tskey-auth-kXXXXX-XXXXXXXXXXXX...',

      // Modal Configurações
      'modal.cfg.title': 'Configurações de Conexão do Tailscale',
      'modal.cfg.api.label': 'Endereço da API do Tailscale (daemon local ou proxy):',
      'modal.cfg.api.help': 'Padrão: /_shareos/cgi/tailscale ou http://127.0.0.1:5252',
      'modal.cfg.auto.label': 'Atualizar status da rede automaticamente a cada 5 segundos',

      // Barra de Status
      'sb.network': 'Tailnet: {name}',
      'sb.peersCount': '{n} dispositivos conectados',
      'sb.ready': 'Pronto',

      // Menus
      'menu.vpn': 'VPN',
      'menu.connect': 'Conectar',
      'menu.disconnect': 'Desconectar',
      'menu.login': 'Fazer Login...',
      'menu.adminConsole': 'Abrir Console de Administração ↗',
      'menu.close': 'Fechar',

      'menu.view': 'Exibir',
      'menu.refresh': 'Atualizar',
      'menu.light': 'Tema Claro',
      'menu.dark': 'Tema Escuro',
      'menu.language': 'Idioma',

      'menu.help': 'Ajuda',
      'menu.guide': 'Guia de Acesso Remoto',
      'menu.about': 'Sobre o Tailscale'
    },

    // ==========================================
    // ENGLISH
    // ==========================================
    en: {
      'app.title': 'Tailscale VPN',
      'app.tagline': 'Secure Remote WireGuard Access for ShareOS',

      // Connection
      'conn.checking': 'Checking connection...',
      'conn.connected': '● Connected to VPN',
      'conn.disconnected': '○ Disconnected',
      'conn.needsLogin': '◐ Login required',
      'conn.offline': '✕ Tailscale unreachable',

      // Toolbar
      'tb.connect': 'Connect',
      'tb.disconnect': 'Disconnect',
      'tb.login': 'Log In',
      'tb.admin': 'Admin Console ↗',
      'tb.settings': 'Settings',
      'tb.refresh': 'Refresh',

      // Tabs
      'tab.overview': 'Overview',
      'tab.peers': 'Network Devices',
      'tab.access': 'Remote Access Guide',
      'tab.advanced': 'Box Features',

      // Overview Cards
      'card.status.title': 'Connection State',
      'card.status.connected': 'Connected & Secure',
      'card.status.disconnected': 'Disconnected',
      'card.status.needsLogin': 'Authentication Required',
      'card.status.offline': 'Daemon Stopped or Not Installed',
      'card.ip4.title': 'Tailscale IPv4 Address',
      'card.ip6.title': 'Tailscale IPv6 Address',
      'card.device.title': 'Device Name',
      'card.tailnet.title': 'Your Tailnet',
      'card.magicdns.title': 'MagicDNS Domain',
      'card.expires.title': 'Key Expiry',

      // Banner offline
      'banner.offline.title': '⚠️ Tailscale daemon (tailscaled) is unreachable.',
      'banner.offline.desc': 'Ensure the Tailscale package is running on the box. You can launch the daemon in the terminal or configure the API URL.',
      'banner.offline.retry': 'Retry',
      'banner.offline.cfg': 'Configure Endpoint',
      'banner.offline.demo': 'Demo Mode',

      // Common Buttons
      'btn.copy': 'Copy',
      'btn.copied': 'Copied!',
      'btn.open': 'Open ↗',
      'btn.ping': 'Ping',
      'btn.pinging': 'Pinging...',
      'btn.ping.ok': 'Ping: {ms}ms',
      'btn.ping.fail': 'No response',
      'btn.cancel': 'Cancel',
      'btn.save': 'Save',
      'btn.login.now': 'Connect with Auth Key',
      'btn.close': 'Close',

      // Peers Table
      'peers.search.placeholder': 'Search devices by name or IP...',
      'peers.filter.all': 'All devices',
      'peers.filter.online': 'Online only',
      'peers.th.device': 'Device',
      'peers.th.os': 'OS',
      'peers.th.ip': 'Tailscale IP',
      'peers.th.status': 'Status',
      'peers.th.actions': 'Actions',
      'peers.empty': 'No other devices found on your Tailscale network.',
      'peers.online': 'Online',
      'peers.offline': 'Offline',
      'peers.thisDevice': 'This Box (You)',

      // Remote Access Guide
      'access.hero.title': 'How to access your ShareOS box from anywhere in the world',
      'access.hero.desc': 'With Tailscale active, your box receives a dedicated private IP (100.x.y.z) and a secure end-to-end encrypted name without opening any ports on your router.',

      'access.step1.badge': 'Step 1',
      'access.step1.title': 'Connect your other devices',
      'access.step1.desc': 'Install the official Tailscale app on your computer, phone, or tablet (Windows, macOS, Linux, Android, iOS) and sign in with the same account.',

      'access.step2.badge': 'Step 2',
      'access.step2.title': 'ShareOS Web Interface',
      'access.step2.desc': 'Open your web browser on any network (external Wi-Fi, cellular 4G/5G) and navigate to the box IP:',

      'access.step3.badge': 'Step 3',
      'access.step3.title': 'Network File Sharing (SMB / Windows / Mac)',
      'access.step3.desc': 'Connect your network drive in Windows File Explorer or Mac Finder over the VPN:',
      'access.step3.win': 'On Windows: enter in File Explorer address bar:',
      'access.step3.mac': 'On Mac: Finder → Connect to Server (Cmd+K):',

      'access.step4.badge': 'Step 4',
      'access.step4.title': 'Transmission & Downloads',
      'access.step4.desc': 'Monitor and manage your Transmission torrent downloads remotely in the browser:',

      'access.step5.badge': 'Step 5',
      'access.step5.title': 'Secure SSH Terminal',
      'access.step5.desc': 'Open a secure SSH shell without exposing port 22 to the public internet:',

      // Advanced
      'adv.exitnode.title': 'Use this Box as an Exit Node (VPN Gateway)',
      'adv.exitnode.desc': 'Route all internet traffic from your phone or laptop through your home box while traveling.',
      'adv.exitnode.btn': 'Enable Exit Node',
      'adv.exitnode.active': 'Exit Node Announced',
      'adv.subnet.title': 'Subnet Router (Access local home network)',
      'adv.subnet.desc': 'Access other devices on your home LAN (router, printers, local servers) remotely through this box.',
      'adv.subnet.btn': 'Configure Routes',

      // Modal Login
      'modal.login.title': 'Connect this Box to Tailscale',
      'modal.login.qr.title': 'Option 1: Scan QR Code with Phone or Open Link',
      'modal.login.qr.desc': 'Open the authentication URL in your browser or scan the QR Code below with your mobile camera:',
      'modal.login.btn.open': 'Open Login Page ↗',
      'modal.login.key.title': 'Option 2: Sign in with Auth Key (from Tailscale Admin)',
      'modal.login.key.desc': 'Generate a key at tailscale.com/admin/settings/keys and paste it below for non-interactive sign-in:',
      'modal.login.key.placeholder': 'tskey-auth-kXXXXX-XXXXXXXXXXXX...',

      // Modal Settings
      'modal.cfg.title': 'Tailscale Connection Settings',
      'modal.cfg.api.label': 'Tailscale API Endpoint (local daemon or proxy):',
      'modal.cfg.api.help': 'Default: /_shareos/cgi/tailscale or http://127.0.0.1:5252',
      'modal.cfg.auto.label': 'Automatically refresh network state every 5 seconds',

      // Status Bar
      'sb.network': 'Tailnet: {name}',
      'sb.peersCount': '{n} connected devices',
      'sb.ready': 'Ready',

      // Menus
      'menu.vpn': 'VPN',
      'menu.connect': 'Connect',
      'menu.disconnect': 'Disconnect',
      'menu.login': 'Log In...',
      'menu.adminConsole': 'Open Admin Console ↗',
      'menu.close': 'Close',

      'menu.view': 'View',
      'menu.refresh': 'Refresh',
      'menu.light': 'Light Theme',
      'menu.dark': 'Dark Theme',
      'menu.language': 'Language',

      'menu.help': 'Help',
      'menu.guide': 'Remote Access Guide',
      'menu.about': 'About Tailscale'
    },

    // ==========================================
    // DEUTSCH
    // ==========================================
    de: {
      'app.title': 'Tailscale VPN',
      'app.tagline': 'Sicherer WireGuard-Fernzugriff für ShareOS',

      // Verbindung
      'conn.checking': 'Prüfe Verbindung...',
      'conn.connected': '● Verbunden mit VPN',
      'conn.disconnected': '○ Nicht verbunden',
      'conn.needsLogin': '◐ Anmeldung erforderlich',
      'conn.offline': '✕ Tailscale nicht erreichbar',

      // Symbolleiste
      'tb.connect': 'Verbinden',
      'tb.disconnect': 'Trennen',
      'tb.login': 'Anmelden',
      'tb.admin': 'Admin-Konsole ↗',
      'tb.settings': 'Einstellungen',
      'tb.refresh': 'Aktualisieren',

      // Reiter
      'tab.overview': 'Übersicht',
      'tab.peers': 'Netzwerkgeräte',
      'tab.access': 'Fernzugriff-Anleitung',
      'tab.advanced': 'Box-Funktionen',

      // Übersicht - Karten
      'card.status.title': 'Verbindungsstatus',
      'card.status.connected': 'Verbunden & Sicher',
      'card.status.disconnected': 'Getrennt',
      'card.status.needsLogin': 'Authentifizierung erforderlich',
      'card.status.offline': 'Dienst gestoppt oder nicht installiert',
      'card.ip4.title': 'Tailscale IPv4-Adresse',
      'card.ip6.title': 'Tailscale IPv6-Adresse',
      'card.device.title': 'Gerätename',
      'card.tailnet.title': 'Ihre Tailnet-Domain',
      'card.magicdns.title': 'MagicDNS-Domain',
      'card.expires.title': 'Schlüsselgültigkeit',

      // Banner offline
      'banner.offline.title': '⚠️ Tailscale-Daemon (tailscaled) nicht erreichbar.',
      'banner.offline.desc': 'Stellen Sie sicher, dass Tailscale auf der Box ausgeführt wird. Sie können den Dienst im Terminal starten oder den API-Endpunkt anpassen.',
      'banner.offline.retry': 'Erneut versuchen',
      'banner.offline.cfg': 'Endpunkt konfigurieren',
      'banner.offline.demo': 'Demo-Modus',

      // Schaltflächen
      'btn.copy': 'Kopieren',
      'btn.copied': 'Kopiert!',
      'btn.open': 'Öffnen ↗',
      'btn.ping': 'Ping testen',
      'btn.pinging': 'Prüfe...',
      'btn.ping.ok': 'Ping: {ms}ms',
      'btn.ping.fail': 'Keine Antwort',
      'btn.cancel': 'Abbrechen',
      'btn.save': 'Speichern',
      'btn.login.now': 'Mit Auth-Key verbinden',
      'btn.close': 'Schließen',

      // Geräteliste
      'peers.search.placeholder': 'Geräte nach Name oder IP suchen...',
      'peers.filter.all': 'Alle Geräte',
      'peers.filter.online': 'Nur online',
      'peers.th.device': 'Gerät',
      'peers.th.os': 'System',
      'peers.th.ip': 'Tailscale-IP',
      'peers.th.status': 'Status',
      'peers.th.actions': 'Aktionen',
      'peers.empty': 'Keine weiteren Geräte in Ihrem Tailscale-Netzwerk gefunden.',
      'peers.online': 'Online',
      'peers.offline': 'Offline',
      'peers.thisDevice': 'Diese Box (Sie)',

      // Fernzugriff
      'access.hero.title': 'So greifen Sie weltweit sicher auf Ihre ShareOS-Box zu',
      'access.hero.desc': 'Mit aktivem Tailscale erhält Ihre Box eine feste private IP (100.x.y.z) und einen verschlüsselten Namen ohne offene Ports am Router.',

      'access.step1.badge': 'Schritt 1',
      'access.step1.title': 'Andere Geräte verbinden',
      'access.step1.desc': 'Installieren Sie die offizielle Tailscale-App auf Computer, Smartphone oder Tablet (Windows, macOS, Linux, Android, iOS) mit demselben Konto.',

      'access.step2.badge': 'Schritt 2',
      'access.step2.title': 'ShareOS Weboberfläche',
      'access.step2.desc': 'Öffnen Sie einen Browser von unterwegs (fremdes WLAN, Mobilfunk) und rufen Sie die Box-IP auf:',

      'access.step3.badge': 'Schritt 3',
      'access.step3.title': 'Netzlaufwerk & Dateien (SMB / Windows / Mac)',
      'access.step3.desc': 'Binden Sie Ihre Freigaben im Windows Explorer oder Mac Finder über das VPN ein:',
      'access.step3.win': 'Unter Windows im Explorer-Adressfeld eingeben:',
      'access.step3.mac': 'Auf dem Mac: Finder → Mit Server verbinden (Cmd+K):',

      'access.step4.badge': 'Schritt 4',
      'access.step4.title': 'Transmission & Downloads',
      'access.step4.desc': 'Steuern Sie Ihre Torrents im Browser von überall aus:',

      'access.step5.badge': 'Schritt 5',
      'access.step5.title': 'Sicheres SSH-Terminal',
      'access.step5.desc': 'Bauen Sie eine sichere Terminalverbindung ohne Portweiterleitung auf:',

      // Erweitert
      'adv.exitnode.title': 'Diese Box als Exit-Node nutzen (VPN-Gateway)',
      'adv.exitnode.desc': 'Leiten Sie den gesamten Internetverkehr Ihres Laptops oder Handys von unterwegs verschlüsselt über Ihren heimischen Anschluss um.',
      'adv.exitnode.btn': 'Exit-Node aktivieren',
      'adv.exitnode.active': 'Exit-Node angekündigt',
      'adv.subnet.title': 'Subnet-Router (Zugriff auf das gesamte Heimnetz)',
      'adv.subnet.desc': 'Erreichen Sie andere Geräte im Heimnetz (Router, Drucker, Heimserver) aus der Ferne über diese Box.',
      'adv.subnet.btn': 'Routen konfigurieren',

      // Modal Login
      'modal.login.title': 'Diese Box mit Tailscale verbinden',
      'modal.login.qr.title': 'Option 1: QR-Code scannen oder Link öffnen',
      'modal.login.qr.desc': 'Öffnen Sie den Anmeldelink im Browser oder scannen Sie den QR-Code mit Ihrem Smartphone:',
      'modal.login.btn.open': 'Anmeldeseite öffnen ↗',
      'modal.login.key.title': 'Option 2: Mit Auth-Key anmelden',
      'modal.login.key.desc': 'Erstellen Sie einen Schlüssel unter tailscale.com/admin/settings/keys für die direkte Anmeldung:',
      'modal.login.key.placeholder': 'tskey-auth-kXXXXX-XXXXXXXXXXXX...',

      // Modal Einstellungen
      'modal.cfg.title': 'Tailscale Verbindungseinstellungen',
      'modal.cfg.api.label': 'Tailscale API-Endpunkt (lokaler Daemon oder Proxy):',
      'modal.cfg.api.help': 'Standard: /_shareos/cgi/tailscale oder http://127.0.0.1:5252',
      'modal.cfg.auto.label': 'Netzwerkstatus alle 5 Sekunden automatisch aktualisieren',

      // Statusleiste
      'sb.network': 'Tailnet: {name}',
      'sb.peersCount': '{n} verbundene Geräte',
      'sb.ready': 'Bereit',

      // Menüs
      'menu.vpn': 'VPN',
      'menu.connect': 'Verbinden',
      'menu.disconnect': 'Trennen',
      'menu.login': 'Anmelden...',
      'menu.adminConsole': 'Admin-Konsole öffnen ↗',
      'menu.close': 'Schließen',

      'menu.view': 'Ansicht',
      'menu.refresh': 'Aktualisieren',
      'menu.light': 'Helles Design',
      'menu.dark': 'Dunkles Design',
      'menu.language': 'Sprache',

      'menu.help': 'Hilfe',
      'menu.guide': 'Fernzugriff-Anleitung',
      'menu.about': 'Über Tailscale'
    }
  };

  const LANG_NAMES = { pt: 'Português', en: 'English', de: 'Deutsch' };
  const STORAGE_KEY = 'tailscale_lang';

  function detectLang() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    const candidates = [];
    if (window.ShareOS && typeof ShareOS.lang === 'string') candidates.push(ShareOS.lang);
    if (navigator.languages) candidates.push(...navigator.languages);
    if (navigator.language) candidates.push(navigator.language);
    for (const c of candidates) {
      const short = String(c).toLowerCase().split(/[-_]/)[0];
      if (SUPPORTED.includes(short)) return short;
    }
    return FALLBACK;
  }

  let lang = detectLang();

  function t(key, vars) {
    let s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS[FALLBACK][key] ?? key;
    if (vars) {
      for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
    }
    return s;
  }

  function apply(root = document) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => { el.placeholder = t(el.dataset.i18nPlaceholder); });
  }

  function setLang(newLang) {
    if (!SUPPORTED.includes(newLang)) return;
    lang = newLang;
    localStorage.setItem(STORAGE_KEY, newLang);
    apply();
  }

  window.I18N = {
    t,
    apply,
    setLang,
    get lang() { return lang; },
    supported: SUPPORTED,
    names: LANG_NAMES
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => apply());
  } else {
    apply();
  }
})();
