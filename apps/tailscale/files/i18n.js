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
      'tab.access': 'Acesso Remoto aos Serviços',

      // Visão Geral - Cartões
      'card.status.title': 'Estado da Conexão',
      'card.status.connected': 'Conectado e Seguro',
      'card.status.disconnected': 'Desconectado',
      'card.status.needsLogin': 'Autenticação Necessária',
      'card.status.offline': 'Serviço Parado ou Não Instalado',
      'card.ip4.title': 'Tailscale IPv4 (IP da Box)',
      'card.ip6.title': 'Tailscale IPv6',
      'card.device.title': 'Nome do Dispositivo',
      'card.tailnet.title': 'Sua Rede (Tailnet)',
      'card.magicdns.title': 'Domínio MagicDNS',
      'card.expires.title': 'Validade da Chave',

      // Banner offline / erro
      'banner.offline.title': '⚠️ Tailscale daemon (tailscaled) não respondeu.',
      'banner.offline.desc': 'O serviço não responde: {err}',
      'banner.offline.retry': 'Tentar Novamente',
      'about.text': 'Tailscale {v} para ShareOS · App {a}',
      'peers.relay': 'via relay {r}',
      'peers.direct': 'direto',
      'toast.loggedOut': 'Desconectado do Tailnet',
      'confirm.logout': 'Remover esta box do Tailnet? Para acesso remoto será preciso fazer login novamente.',
      'menu.logout': 'Sair do Tailnet…',
      'menu.reauth': 'Fazer login novamente…',
      'modal.login.wait': 'Solicitando link de login…',
      'card.status.needsMachineAuth': 'Aguardando aprovação no console de administração',
      'card.status.starting': 'Tailscale está iniciando…',
      'conn.starting': '◌ Iniciando…',
      'banner.missing.desc': 'Instale-o na loja do ShareOS (Apps → Loja → Apps de sistema) e depois clique em "Tentar novamente".',
      'banner.missing.title': '⚠️ O app de sistema "tailscaled" não está instalado.',
      'banner.noapi.desc': 'Este app precisa do ShareOS 0.2.0-beta.8 ou mais recente e só funciona para contas de administrador.',
      'banner.noapi.title': '⚠️ Sem acesso ao Tailscale da box.',

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
      'access.hero.title': 'Como acessar seus serviços ShareOS remotamente',
      'access.hero.desc': 'Com o Tailscale, sua box ganha um endereço IP privado seguro (100.x.y.z) acessível de qualquer lugar sem precisar abrir portas no roteador.',
      
      'access.step1.badge': 'Passo 1',
      'access.step1.title': 'Instale o Tailscale no seu celular ou computador',
      'access.step1.desc': 'Instale o app oficial do Tailscale (Windows, Mac, iOS, Android ou Linux) e faça login na mesma conta conectada nesta box.',
      
      'access.step2.badge': 'Serviço 1',
      'access.step2.title': 'Interface Web do ShareOS',
      'access.step2.desc': 'Acesse o painel completo do ShareOS de qualquer rede externa via navegador:',
      
      'access.step3.badge': 'Serviço 2',
      'access.step3.title': 'Transmission (Torrents e Downloads)',
      'access.step3.desc': 'Faça login no ShareOS e abra o Transmission:',

      'access.step4.badge': 'Serviço 3',
      'access.step4.title': 'Terminal SSH Leve',
      'access.step4.desc': 'Acesso administrativo direto ao terminal sem expor a porta 22 para a internet pública:',

      'access.step5.badge': 'Aviso',
      'access.step5.title': 'Acesso a Arquivos (SMB / Rede)',
      'access.step5.desc': 'Você pode conectar a pasta de rede pelo IP:',
      'access.step5.win': 'No Windows Explorer:',
      'access.step5.mac': 'No Mac Finder (Cmd+K):',

      // Alerta de desempenho DNS-320L
      'access.warn.title': '⚠️ Atenção: Limitação de Hardware do DNS-320L',
      'access.warn.desc': 'O processador do DNS-320L (ARM 1.0 GHz Single-Core) não possui aceleração de criptografia por hardware. Copiar arquivos grandes pela VPN consumirá 100% da CPU, a velocidade será baixa (~1 a 3 MB/s) e transferências pesadas podem causar lentidão severa ou travamento temporário da box. Para arquivos grandes, prefira a rede local (LAN) ou envie o download diretamente para o Transmission.',

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
      'modal.cfg.auto.label': 'Atualizar status da rede automaticamente a cada 20 segundos (economiza CPU)',

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
      'tab.access': 'Remote Service Access',

      // Overview Cards
      'card.status.title': 'Connection State',
      'card.status.connected': 'Connected & Secure',
      'card.status.disconnected': 'Disconnected',
      'card.status.needsLogin': 'Authentication Required',
      'card.status.offline': 'Daemon Stopped or Not Installed',
      'card.ip4.title': 'Tailscale IPv4 (Box IP)',
      'card.ip6.title': 'Tailscale IPv6',
      'card.device.title': 'Device Name',
      'card.tailnet.title': 'Your Tailnet',
      'card.magicdns.title': 'MagicDNS Domain',
      'card.expires.title': 'Key Expiry',

      // Banner offline
      'banner.offline.title': '⚠️ Tailscale daemon (tailscaled) is unreachable.',
      'banner.offline.desc': 'The service does not answer: {err}',
      'banner.offline.retry': 'Retry',
      'about.text': 'Tailscale {v} for ShareOS · App {a}',
      'peers.relay': 'via relay {r}',
      'peers.direct': 'direct',
      'toast.loggedOut': 'Logged out of the Tailnet',
      'confirm.logout': 'Remove this box from the Tailnet? Remote access will need a new sign-in afterwards.',
      'menu.logout': 'Log out of Tailnet…',
      'menu.reauth': 'Sign in again…',
      'modal.login.wait': 'Requesting sign-in link…',
      'card.status.needsMachineAuth': 'Waiting for approval in the admin console',
      'card.status.starting': 'Tailscale is starting…',
      'conn.starting': '◌ Starting…',
      'banner.missing.desc': 'Install it from the ShareOS store (Apps → Store → System apps), then click "Retry".',
      'banner.missing.title': '⚠️ The system app "tailscaled" is not installed.',
      'banner.noapi.desc': 'This app needs ShareOS 0.2.0-beta.8 or newer and only works for administrator accounts.',
      'banner.noapi.title': '⚠️ No access to the box\'s Tailscale.',

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
      'access.hero.title': 'How to access your ShareOS services from anywhere',
      'access.hero.desc': 'With Tailscale active, your box receives a dedicated private IP (100.x.y.z) accessible securely from anywhere without opening any ports on your router.',

      'access.step1.badge': 'Step 1',
      'access.step1.title': 'Install Tailscale on your devices',
      'access.step1.desc': 'Install the official Tailscale app on your computer or phone (Windows, Mac, iOS, Android, Linux) and sign in with the same account.',

      'access.step2.badge': 'Service 1',
      'access.step2.title': 'ShareOS Web Interface',
      'access.step2.desc': 'Access the full ShareOS desktop dashboard from any remote network in your browser:',

      'access.step3.badge': 'Service 2',
      'access.step3.title': 'Transmission & Downloads',
      'access.step3.desc': 'Sign in to ShareOS and open Transmission:',

      'access.step4.badge': 'Service 3',
      'access.step4.title': 'Lightweight SSH Terminal',
      'access.step4.desc': 'Direct administrative terminal access without exposing port 22 to the public internet:',

      'access.step5.badge': 'Notice',
      'access.step5.title': 'File Access (SMB / Network Drive)',
      'access.step5.desc': 'You can connect to the shared folder via IP:',
      'access.step5.win': 'In Windows Explorer:',
      'access.step5.mac': 'In Mac Finder (Cmd+K):',

      // Hardware warning
      'access.warn.title': '⚠️ Performance Notice: DNS-320L Hardware Limits',
      'access.warn.desc': 'The DNS-320L CPU (ARM 1.0 GHz Single-Core) processes VPN encryption entirely in software without hardware crypto acceleration. Copying large files over the VPN will saturate the CPU at 100%, transfer speeds will be low (~1 to 3 MB/s), and heavy transfers can cause severe slowdowns or temporary box freezing. For large files, use local network (LAN) or download directly with Transmission.',

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
      'modal.cfg.auto.label': 'Automatically refresh network state every 20 seconds (saves CPU)',

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
      'tab.access': 'Fernzugriff auf Dienste',

      // Übersicht - Karten
      'card.status.title': 'Verbindungsstatus',
      'card.status.connected': 'Verbunden & Sicher',
      'card.status.disconnected': 'Getrennt',
      'card.status.needsLogin': 'Authentifizierung erforderlich',
      'card.status.offline': 'Dienst gestoppt oder nicht installiert',
      'card.ip4.title': 'Tailscale IPv4 (Box-IP)',
      'card.ip6.title': 'Tailscale IPv6',
      'card.device.title': 'Gerätename',
      'card.tailnet.title': 'Ihre Tailnet-Domain',
      'card.magicdns.title': 'MagicDNS-Domain',
      'card.expires.title': 'Schlüsselgültigkeit',

      // Banner offline
      'banner.offline.title': '⚠️ Tailscale-Daemon (tailscaled) nicht erreichbar.',
      'banner.offline.desc': 'Der Dienst antwortet nicht: {err}',
      'banner.offline.retry': 'Erneut versuchen',
      'about.text': 'Tailscale {v} für ShareOS · App {a}',
      'peers.relay': 'über Relay {r}',
      'peers.direct': 'direkt',
      'toast.loggedOut': 'Vom Tailnet abgemeldet',
      'confirm.logout': 'Diese Box vom Tailnet abmelden? Für den Fernzugriff muss sie danach neu angemeldet werden.',
      'menu.logout': 'Vom Tailnet abmelden…',
      'menu.reauth': 'Neu anmelden…',
      'modal.login.wait': 'Anmeldelink wird angefordert…',
      'card.status.needsMachineAuth': 'Wartet auf Freigabe in der Admin-Konsole',
      'card.status.starting': 'Tailscale startet…',
      'conn.starting': '◌ Startet…',
      'banner.missing.desc': 'Bitte im ShareOS-Store (Apps → Store → System-Apps) installieren und dann „Erneut versuchen“ klicken.',
      'banner.missing.title': '⚠️ Die System-App „tailscaled“ ist nicht installiert.',
      'banner.noapi.desc': 'Diese App braucht ShareOS 0.2.0-beta.8 oder neuer und funktioniert nur mit Administrator-Konten.',
      'banner.noapi.title': '⚠️ Kein Zugriff auf Tailscale der Box.',

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
      'access.hero.title': 'So greifen Sie sicher auf ShareOS-Dienste zu',
      'access.hero.desc': 'Mit aktivem Tailscale erhält Ihre Box eine feste private IP (100.x.y.z), erreichbar von überall ohne offene Router-Ports.',

      'access.step1.badge': 'Schritt 1',
      'access.step1.title': 'Tailscale auf Geräten installieren',
      'access.step1.desc': 'Installieren Sie die offizielle Tailscale-App (Windows, Mac, iOS, Android, Linux) und melden Sie sich mit demselben Konto an.',

      'access.step2.badge': 'Dienst 1',
      'access.step2.title': 'ShareOS Weboberfläche',
      'access.step2.desc': 'Rufen Sie die Weboberfläche von unterwegs sicher im Browser auf:',

      'access.step3.badge': 'Dienst 2',
      'access.step3.title': 'Transmission & Downloads',
      'access.step3.desc': 'In ShareOS anmelden und Transmission öffnen:',

      'access.step4.badge': 'Dienst 3',
      'access.step4.title': 'Schlankes SSH-Terminal',
      'access.step4.desc': 'Sicherer Terminalzugriff ohne Portweiterleitung von Port 22:',

      'access.step5.badge': 'Hinweis',
      'access.step5.title': 'Dateifreigabe (SMB / Netzlaufwerk)',
      'access.step5.desc': 'Netzlaufwerk über die Tailscale-IP einbinden:',
      'access.step5.win': 'Im Windows Explorer:',
      'access.step5.mac': 'Im Mac Finder (Cmd+K):',

      // Hardwarewarnung
      'access.warn.title': '⚠️ Leistungshinweis: Hardwaregrenzen des DNS-320L',
      'access.warn.desc': 'Der Prozessor des DNS-320L (ARM 1.0 GHz Single-Core) berechnet VPN-Verschlüsselung vollständig per Software ohne Hardware-Kryptobeschleunigung. Das Kopieren großer Dateien über das VPN lastet die CPU zu 100% aus, ist langsam (~1 bis 3 MB/s) und kann die Box vorübergehend einfrieren. Für große Dateien bitte das lokale Netzwerk (LAN) oder Transmission nutzen.',

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
      'modal.cfg.auto.label': 'Netzwerkstatus alle 20 Sekunden automatisch aktualisieren (schont die CPU)',

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
