// autobrr ShareOS Web Client - Internationalization (en, de, pt)
'use strict';

window.I18N = (function () {
  const dict = {
    en: {
      'app.title': 'autobrr',
      'conn.checking': 'Checking service...',
      'conn.online': 'autobrr Online',
      'conn.offline': 'autobrr Offline',
      'conn.standalone': 'Standalone Demo Mode',

      // Menu
      'menu.file': 'File',
      'menu.refresh': 'Refresh Data',
      'menu.quit': 'Close autobrr',
      'menu.view': 'View',
      'menu.tab.releases': 'Releases & Feed',
      'menu.tab.filters': 'Filters',
      'menu.tab.irc': 'IRC & Indexers',
      'menu.tab.clients': 'Download Clients',
      'menu.tab.settings': 'Settings',
      'menu.transmission': 'Open Transmission',
      'menu.help': 'Help',
      'menu.docs': 'autobrr Documentation',
      'menu.about': 'About autobrr for ShareOS',

      // Toolbar
      'tb.refresh': 'Refresh',
      'tb.add_filter': 'New Filter',
      'tb.test_client': 'Test Transmission',
      'tb.settings': 'Settings',
      'tb.search_placeholder': 'Search releases, filters, trackers...',

      // Tabs
      'tab.releases': 'Releases',
      'tab.filters': 'Filters',
      'tab.irc': 'IRC & Indexers',
      'tab.clients': 'Clients',
      'tab.settings': 'Settings',

      // Releases Table
      'col.time': 'Time',
      'col.indexer': 'Indexer / Channel',
      'col.release': 'Release Name',
      'col.status': 'Status',
      'col.action': 'Client Action',
      'col.actions': 'Actions',

      // Status badges
      'status.APPROVED': 'Approved',
      'status.FILTER_REJECTED': 'Filtered Out',
      'status.PUSH_APPROVED': 'Sent to Client',
      'status.PUSH_ERROR': 'Send Error',
      'status.PENDING': 'Processing',

      // Action buttons
      'btn.send_transmission': 'Push to Transmission',
      'btn.details': 'Details',
      'btn.edit': 'Edit',
      'btn.delete': 'Delete',
      'btn.save': 'Save Changes',
      'btn.cancel': 'Cancel',
      'btn.create': 'Create',
      'btn.retry': 'Retry Connection',

      // Filters View
      'filters.title': 'Active Filter Rules',
      'filters.empty': 'No filters configured yet. Create a filter to start capturing torrents.',
      'filters.new_title': 'Create New Filter',
      'filters.name': 'Filter Name',
      'filters.indexers': 'Indexers / Trackers (comma-separated or empty for all)',
      'filters.match_releases': 'Match Releases (wildcards e.g. *1080p*, *2160p*)',
      'filters.except_releases': 'Except Releases (e.g. *CAM*, *TS*)',
      'filters.resolutions': 'Resolutions',
      'filters.codecs': 'Codecs',
      'filters.min_size': 'Min Size (MB)',
      'filters.max_size': 'Max Size (MB)',
      'filters.freeleech': 'Only Freeleech',
      'filters.client': 'Forward to Client',

      // IRC & Indexers View
      'irc.title': 'Monitored Networks & IRC Channels',
      'irc.empty': 'No IRC networks connected.',
      'irc.server': 'Network / Server',
      'irc.channel': 'Announce Channel',
      'irc.bot': 'Announce Bot',
      'irc.nick': 'Nick',
      'irc.status': 'IRC Status',
      'irc.connected': 'Connected & Listening',
      'irc.disconnected': 'Disconnected',

      // Clients View
      'clients.title': 'Download Clients',
      'clients.transmission_desc': 'Native Transmission integration on ShareOS. autobrr delivers torrents directly to your Transmission daemon.',
      'clients.type': 'Client Type',
      'clients.host': 'Host / Endpoint',
      'clients.status': 'Client Status',
      'clients.online': 'Connected & Ready',
      'clients.offline': 'Transmission Daemon Unreachable',

      // Settings View
      'settings.title': 'autobrr Service Connection',
      'settings.api_endpoint': 'API Endpoint URL',
      'settings.api_endpoint_hint': 'Default local proxy: /_shareos/cgi/autobrr or direct daemon at http://127.0.0.1:7474',
      'settings.api_key': 'API Key (Optional)',
      'settings.poll_interval': 'Auto-refresh Interval (seconds)',
      'settings.dns320l_notice': 'DNS-320L Notice: autobrr runs as a native lightweight background daemon (autobrr-daemon) with limited memory overhead (~30-40 MB).',

      // Banner
      'banner.offline_title': '⚠️ autobrr-daemon service unreachable.',
      'banner.offline_desc': 'The autobrr background service is not running or not responding at the configured endpoint. You can inspect sample data in standalone mode or check your ShareOS service status.',

      // Statusbar
      'sb.releases_count': '{count} releases monitored',
      'sb.filters_count': '{count} active filters',
      'sb.last_updated': 'Updated: {time}'
    },

    de: {
      'app.title': 'autobrr',
      'conn.checking': 'Dienst wird geprüft...',
      'conn.online': 'autobrr Online',
      'conn.offline': 'autobrr Offline',
      'conn.standalone': 'Demo-Modus',

      // Menu
      'menu.file': 'Datei',
      'menu.refresh': 'Aktualisieren',
      'menu.quit': 'autobrr schließen',
      'menu.view': 'Ansicht',
      'menu.tab.releases': 'Releases & Feed',
      'menu.tab.filters': 'Filter',
      'menu.tab.irc': 'IRC & Indexer',
      'menu.tab.clients': 'Download-Clients',
      'menu.tab.settings': 'Einstellungen',
      'menu.transmission': 'Transmission öffnen',
      'menu.help': 'Hilfe',
      'menu.docs': 'autobrr Dokumentation',
      'menu.about': 'Über autobrr für ShareOS',

      // Toolbar
      'tb.refresh': 'Aktualisieren',
      'tb.add_filter': 'Neuer Filter',
      'tb.test_client': 'Transmission testen',
      'tb.settings': 'Einstellungen',
      'tb.search_placeholder': 'Releases, Filter, Tracker durchsuchen...',

      // Tabs
      'tab.releases': 'Releases',
      'tab.filters': 'Filter',
      'tab.irc': 'IRC & Indexer',
      'tab.clients': 'Clients',
      'tab.settings': 'Einstellungen',

      // Releases Table
      'col.time': 'Zeit',
      'col.indexer': 'Indexer / Kanal',
      'col.release': 'Release-Name',
      'col.status': 'Status',
      'col.action': 'Client-Aktion',
      'col.actions': 'Aktionen',

      // Status badges
      'status.APPROVED': 'Akzeptiert',
      'status.FILTER_REJECTED': 'Gefiltert',
      'status.PUSH_APPROVED': 'An Client gesendet',
      'status.PUSH_ERROR': 'Sendefehler',
      'status.PENDING': 'Wird verarbeitet',

      // Action buttons
      'btn.send_transmission': 'An Transmission senden',
      'btn.details': 'Details',
      'btn.edit': 'Bearbeiten',
      'btn.delete': 'Löschen',
      'btn.save': 'Speichern',
      'btn.cancel': 'Abbrechen',
      'btn.create': 'Erstellen',
      'btn.retry': 'Neu verbinden',

      // Filters View
      'filters.title': 'Aktive Filterregeln',
      'filters.empty': 'Noch keine Filter konfiguriert. Erstellen Sie einen Filter.',
      'filters.new_title': 'Neuen Filter anlegen',
      'filters.name': 'Filtername',
      'filters.indexers': 'Indexer / Tracker (kommagetrennt oder leer für alle)',
      'filters.match_releases': 'Passende Releases (*1080p*, *2160p*)',
      'filters.except_releases': 'Ausschließen (*CAM*, *TS*)',
      'filters.resolutions': 'Auflösungen',
      'filters.codecs': 'Codecs',
      'filters.min_size': 'Min. Größe (MB)',
      'filters.max_size': 'Max. Größe (MB)',
      'filters.freeleech': 'Nur Freeleech',
      'filters.client': 'Weiterleiten an Client',

      // IRC & Indexers View
      'irc.title': 'Überwachte Netzwerke & IRC-Kanäle',
      'irc.empty': 'Keine IRC-Netzwerke verbunden.',
      'irc.server': 'Netzwerk / Server',
      'irc.channel': 'Ankündigungskanal',
      'irc.bot': 'Bot',
      'irc.nick': 'Benutzername',
      'irc.status': 'IRC-Status',
      'irc.connected': 'Verbunden & aktiv',
      'irc.disconnected': 'Getrennt',

      // Clients View
      'clients.title': 'Download-Clients',
      'clients.transmission_desc': 'Native Transmission-Integration in ShareOS. autobrr leitet Torrents direkt an Ihren Transmission-Dienst weiter.',
      'clients.type': 'Client-Typ',
      'clients.host': 'Adresse / Endpunkt',
      'clients.status': 'Client-Status',
      'clients.online': 'Verbunden & bereit',
      'clients.offline': 'Transmission-Dienst nicht erreichbar',

      // Settings View
      'settings.title': 'autobrr Dienst-Verbindung',
      'settings.api_endpoint': 'API-Endpunkt URL',
      'settings.api_endpoint_hint': 'Lokaler Proxy: /_shareos/cgi/autobrr oder direkt unter http://127.0.0.1:7474',
      'settings.api_key': 'API-Schlüssel (Optional)',
      'settings.poll_interval': 'Aktualisierungsintervall (Sekunden)',
      'settings.dns320l_notice': 'DNS-320L Hinweis: autobrr läuft als nativer Hintergrunddienst mit minimalem Speicherverbrauch (~30-40 MB).',

      // Banner
      'banner.offline_title': '⚠️ autobrr-daemon Dienst nicht erreichbar.',
      'banner.offline_desc': 'Der Hintergrunddienst läuft nicht oder antwortet nicht am Endpunkt. Sie können Beispieldaten im Demo-Modus einsehen.',

      // Statusbar
      'sb.releases_count': '{count} Releases überwacht',
      'sb.filters_count': '{count} aktive Filter',
      'sb.last_updated': 'Aktualisiert: {time}'
    },

    pt: {
      'app.title': 'autobrr',
      'conn.checking': 'Verificando serviço...',
      'conn.online': 'autobrr Online',
      'conn.offline': 'autobrr Offline',
      'conn.standalone': 'Modo Demonstração',

      // Menu
      'menu.file': 'Arquivo',
      'menu.refresh': 'Atualizar Dados',
      'menu.quit': 'Fechar autobrr',
      'menu.view': 'Exibir',
      'menu.tab.releases': 'Releases & Feed',
      'menu.tab.filters': 'Filtros',
      'menu.tab.irc': 'IRC & Indexadores',
      'menu.tab.clients': 'Clientes de Download',
      'menu.tab.settings': 'Configurações',
      'menu.transmission': 'Abrir Transmission',
      'menu.help': 'Ajuda',
      'menu.docs': 'Documentação do autobrr',
      'menu.about': 'Sobre o autobrr no ShareOS',

      // Toolbar
      'tb.refresh': 'Atualizar',
      'tb.add_filter': 'Novo Filtro',
      'tb.test_client': 'Testar Transmission',
      'tb.settings': 'Configurações',
      'tb.search_placeholder': 'Buscar releases, filtros, trackers...',

      // Tabs
      'tab.releases': 'Releases',
      'tab.filters': 'Filtros',
      'tab.irc': 'IRC & Indexadores',
      'tab.clients': 'Clientes',
      'tab.settings': 'Configurações',

      // Releases Table
      'col.time': 'Hora',
      'col.indexer': 'Indexador / Canal',
      'col.release': 'Nome do Release',
      'col.status': 'Status',
      'col.action': 'Ação do Cliente',
      'col.actions': 'Ações',

      // Status badges
      'status.APPROVED': 'Aprovado',
      'status.FILTER_REJECTED': 'Filtrado',
      'status.PUSH_APPROVED': 'Enviado ao Transmission',
      'status.PUSH_ERROR': 'Erro ao Enviar',
      'status.PENDING': 'Processando',

      // Action buttons
      'btn.send_transmission': 'Enviar ao Transmission',
      'btn.details': 'Detalhes',
      'btn.edit': 'Editar',
      'btn.delete': 'Excluir',
      'btn.save': 'Salvar Alterações',
      'btn.cancel': 'Cancelar',
      'btn.create': 'Criar',
      'btn.retry': 'Tentar Novamente',

      // Filters View
      'filters.title': 'Regras de Filtros Ativas',
      'filters.empty': 'Nenhum filtro configurado. Crie um filtro para capturar torrents automaticamente.',
      'filters.new_title': 'Novo Filtro de Download',
      'filters.name': 'Nome do Filtro',
      'filters.indexers': 'Indexadores / Trackers (separados por vírgula ou vazio para todos)',
      'filters.match_releases': 'Padrão do Release (*1080p*, *2160p*)',
      'filters.except_releases': 'Exceções (*CAM*, *TS*)',
      'filters.resolutions': 'Resoluções',
      'filters.codecs': 'Codecs',
      'filters.min_size': 'Tamanho Mín. (MB)',
      'filters.max_size': 'Tamanho Máx. (MB)',
      'filters.freeleech': 'Apenas Freeleech',
      'filters.client': 'Encaminhar para Cliente',

      // IRC & Indexers View
      'irc.title': 'Redes Monitoradas & Canais IRC',
      'irc.empty': 'Nenhuma rede IRC configurada.',
      'irc.server': 'Rede / Servidor',
      'irc.channel': 'Canal de Anúncio',
      'irc.bot': 'Bot de Anúncio',
      'irc.nick': 'Apelido (Nick)',
      'irc.status': 'Status IRC',
      'irc.connected': 'Conectado & Escutando',
      'irc.disconnected': 'Desconectado',

      // Clients View
      'clients.title': 'Clientes de Download',
      'clients.transmission_desc': 'Integração nativa com o Transmission no ShareOS. O autobrr entrega os torrents diretamente para o seu daemon de torrent.',
      'clients.type': 'Tipo de Cliente',
      'clients.host': 'Endereço / Host',
      'clients.status': 'Status do Cliente',
      'clients.online': 'Conectado e Pronto',
      'clients.offline': 'Transmission-Daemon Inacessível',

      // Settings View
      'settings.title': 'Conexão com o Serviço autobrr',
      'settings.api_endpoint': 'URL do Endpoint da API',
      'settings.api_endpoint_hint': 'Proxy local padrão: /_shareos/cgi/autobrr ou direto em http://127.0.0.1:7474',
      'settings.api_key': 'Chave de API (Opcional)',
      'settings.poll_interval': 'Intervalo de Atualização (segundos)',
      'settings.dns320l_notice': 'Nota DNS-320L: O autobrr roda como serviço nativo de segundo plano (autobrr-daemon) com footprint otimizado de memória (~30-40 MB).',

      // Banner
      'banner.offline_title': '⚠️ Serviço autobrr-daemon não encontrado.',
      'banner.offline_desc': 'O daemon do autobrr não está em execução ou não respondeu no endereço configurado. Você pode visualizar dados no modo de demonstração ou verificar o status do serviço no ShareOS.',

      // Statusbar
      'sb.releases_count': '{count} releases monitorados',
      'sb.filters_count': '{count} filtros ativos',
      'sb.last_updated': 'Atualizado às {time}'
    }
  };

  function detectLang() {
    try {
      const p = new URLSearchParams(window.location.search);
      const urlLang = p.get('lang');
      if (urlLang && dict[urlLang]) return urlLang;
      const htmlLang = document.documentElement.lang;
      if (htmlLang && dict[htmlLang]) return htmlLang;
      const navLang = (navigator.language || '').slice(0, 2);
      if (navLang && dict[navLang]) return navLang;
    } catch (_) {}
    return 'en';
  }

  let currentLang = detectLang();

  return {
    get lang() {
      return currentLang;
    },
    set lang(l) {
      if (dict[l]) {
        currentLang = l;
        document.documentElement.lang = l;
        this.apply();
      }
    },
    t: function (key, vars = {}) {
      const table = dict[currentLang] || dict.en;
      let str = table[key] || dict.en[key] || key;
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
      }
      return str;
    },
    apply: function (root = document) {
      root.querySelectorAll('[data-i18n]').forEach((el) => {
        const k = el.getAttribute('data-i18n');
        el.textContent = this.t(k);
      });
      root.querySelectorAll('[data-i18n-title]').forEach((el) => {
        const k = el.getAttribute('data-i18n-title');
        el.title = this.t(k);
      });
      root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
        const k = el.getAttribute('data-i18n-placeholder');
        el.placeholder = this.t(k);
      });
    }
  };
})();
