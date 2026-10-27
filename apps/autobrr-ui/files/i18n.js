// autobrr ShareOS Web Client - Internationalization (en, de, pt)
'use strict';

window.I18N = (function () {
  const dict = {
    en: {
      'app.title': 'autobrr',
      'conn.checking': 'Checking service...',
      'conn.online': 'autobrr Online',
      'conn.offline': 'autobrr Stopped',
      'conn.starting': 'Starting autobrr...',
      'conn.not_installed': 'autobrr Not Installed',
      'conn.no_drive': 'Apps Drive Missing',
      'conn.no_access': 'Admin Access Only',

      // Menu
      'menu.file': 'File',
      'menu.refresh': 'Refresh Data',
      'menu.view_log': 'View Daemon Log',
      'menu.quit': 'Close autobrr',
      'menu.service': 'Service',
      'menu.start': 'Start autobrr',
      'menu.stop': 'Stop autobrr',
      'menu.open_ui': 'Open Native Web UI (:7474)',
      'menu.view': 'View',
      'menu.tab.releases': 'Releases & Feed',
      'menu.tab.filters': 'Filters',
      'menu.tab.irc': 'IRC & Indexers',
      'menu.tab.transmission': 'Transmission Handover',
      'menu.tab.settings': 'Settings & Service',
      'menu.transmission': 'Open Transmission App',
      'menu.help': 'Help',
      'menu.docs': 'autobrr Documentation',
      'menu.about': 'About autobrr for ShareOS',

      // Toolbar
      'tb.refresh': 'Refresh',
      'tb.add_filter': 'New Filter',
      'tb.view_log': 'Logs',
      'tb.open_webui': 'Advanced Setup (:7474)',
      'tb.open_transmission': 'Transmission',
      'tb.search_placeholder': 'Search releases, filters, trackers...',

      // Tabs
      'tab.releases': 'Releases',
      'tab.filters': 'Filters',
      'tab.irc': 'IRC & Indexers',
      'tab.transmission': 'Transmission',
      'tab.settings': 'Service & Settings',

      // Releases Table
      'col.time': 'Time',
      'col.indexer': 'Indexer / Channel',
      'col.release': 'Release Name',
      'col.status': 'Filter Status',
      'col.action': 'Client Action',
      'col.actions': 'Actions',
      'releases.empty': 'No releases yet.',
      'releases.no_match': 'No releases match the criteria.',
      'releases.no_access': 'No releases yet (admins only).',

      // Status badges
      'status.APPROVED': 'Approved',
      'status.FILTER_REJECTED': 'Filtered Out',
      'status.PUSH_APPROVED': 'Sent to Transmission',
      'status.PUSH_ERROR': 'Send Error',
      'status.PENDING': 'Processing',
      'status.active': 'Active',
      'status.inactive': 'Disabled',
      'status.stopped': 'Stopped',

      // Action buttons
      'btn.send_transmission': 'Push to Transmission',
      'btn.details': 'Details',
      'btn.edit': 'Edit',
      'btn.delete': 'Delete',
      'btn.save': 'Save Changes',
      'btn.cancel': 'Cancel',
      'btn.create': 'Create Filter',
      'btn.start_service': 'Start autobrr',
      'btn.stop_service': 'Stop Service',
      'btn.refresh_log': 'Refresh Log',
      'btn.save_account': 'Save Account',
      'btn.change_pw': 'Update Password',
      'btn.test_rpc': 'Test Transmission RPC',
      'btn.open_trans_app': 'Open Transmission',
      'btn.retry': 'Retry Connection',

      // Filters View
      'filters.title': 'Active Filter Rules',
      'filters.empty': 'No filters yet.',
      'filters.no_access': 'No filters yet (admins only).',
      'filters.new_title': 'Create New Filter',
      'filters.edit_title': 'Edit Filter',
      'filters.name': 'Filter Name',
      'filters.indexers': 'Indexers / Trackers (comma-separated or empty for all)',
      'filters.match_releases': 'Match Releases (wildcards e.g. *1080p*, *BluRay*)',
      'filters.except_releases': 'Exceptions (e.g. *CAM*, *TS*, *HDCAM*)',
      'filters.min_size': 'Min Size (MB)',
      'filters.max_size': 'Max Size (MB)',
      'filters.freeleech': 'Only Freeleech',
      'filters.enabled': 'Filter Enabled',

      // IRC & Indexers View
      'irc.title': 'Monitored Networks & IRC Channels',
      'irc.empty': 'No IRC networks connected yet.',
      'irc.no_access': 'No IRC networks connected yet (admins only).',
      'irc.server': 'Network / Server',
      'irc.channel': 'Announce Channel',
      'irc.bot': 'Announce Bot',
      'irc.nick': 'Nick',
      'irc.status': 'IRC Status',
      'irc.connected': 'Connected & Listening',
      'irc.disconnected': 'Disconnected',
      'indexers.title': 'Configured Indexers & Trackers',
      'indexers.empty': 'No indexers configured yet.',
      'indexers.no_access': 'No indexers configured yet (admins only).',
      'indexers.name': 'Indexer Name',
      'indexers.identifier': 'Identifier',
      'indexers.type': 'Type',
      'indexers.status': 'Status',

      // Transmission View
      'trans.title': 'Transmission Handover Integration',
      'trans.how_it_works': 'How It Works',
      'trans.how_desc': 'autobrr runs as a single service for the whole box. When a matching torrent is captured, it is placed into a secure hand-over folder with permissions 2770. The Transmission daemon of the designated user monitors this folder and automatically starts downloading.',
      'trans.drop_title': 'Handover Drop Folder',
      'trans.drop_path': 'Folder Path',
      'trans.drop_account': 'Watching User Account',
      'trans.drop_mode': 'Permissions Mode',
      'trans.drop_hint': 'Torrents copied or dispatched into this directory are automatically imported by Transmission.',
      'trans.daemon_card': 'Transmission Client',
      'trans.daemon_desc': 'Native ShareOS BitTorrent daemon running per-user with isolated file permissions.',

      // Settings View
      'settings.title': 'autobrr Service & System Settings',
      'settings.daemon_section': 'autobrr Daemon Control',
      'settings.daemon_desc': 'Runs as the system user "autobrr" with memory constrained to 48 MiB, ideal for the DNS-320L NAS.',
      'settings.daemon_status': 'Current State',
      'settings.daemon_boot': 'Autostart on Boot',
      'settings.daemon_boot_hint': 'Keep autobrr running in the background when the NAS powers on.',
      'settings.handover_section': 'Transmission Handover Account',
      'settings.handover_desc': 'Select which ShareOS user account receives torrents from autobrr in their personal Transmission watch directory.',
      'settings.handover_account': 'Target User Account',
      'settings.webui_section': 'Native autobrr Web Interface (Port 7474)',
      'settings.webui_desc': 'autobrr includes its full native web dashboard. By default, it binds only to 127.0.0.1 for maximum security and RAM efficiency.',
      'settings.webui_enable': 'Expose Web UI on local network (0.0.0.0:7474)',
      'settings.webui_open': 'Open autobrr Web Interface',
      'settings.password_section': 'Admin Web UI Password',
      'settings.password_desc': 'Change the password for the "admin" user when accessing autobrr on port 7474 (8 to 128 characters).',
      'settings.password_label': 'New Password',
      'settings.password_placeholder': 'Enter at least 8 characters',
      'settings.log_section': 'Daemon Log Viewer',
      'log.no_access': 'autobrr daemon logs are accessible to administrator accounts only.',
      'log.offline': 'autobrr service is not connected.',

      // Banners
      'banner.offline_title': 'autobrr Service Stopped',
      'banner.offline_desc': 'The autobrr daemon is currently not running. Start the service to enable release capturing.',
      'banner.not_installed_title': 'autobrr System App Not Installed',
      'banner.not_installed_desc': 'The backend daemon is missing. Install "autobrr" from Apps → Store → System Apps.',
      'banner.no_drive_title': 'Apps Storage Drive Required',
      'banner.no_drive_desc': 'autobrr needs an active storage drive (Storage) to store its database and downloads.',
      'banner.no_access_title': 'Administrator Access Required',
      'banner.no_access_desc': 'autobrr is a box-wide service and can only be configured by administrator accounts.',

      // Statusbar
      'sb.releases_count': '{count} releases monitored',
      'sb.filters_count': '{count} active filters',
      'sb.account': 'Handover: {account}',
      'sb.updated': 'Updated: {time}',

      // Messages and Errors
      'err.service_not_ready': 'autobrr service is not running or not ready.',
      'toast.torrent_dispatched': 'Torrent dispatched to Transmission drop folder!',
      'toast.filter_deleted': 'Filter deleted',
      'toast.filter_created': 'Filter created successfully'
    },

    de: {
      'app.title': 'autobrr',
      'conn.checking': 'Dienst wird geprüft...',
      'conn.online': 'autobrr Online',
      'conn.offline': 'autobrr Gestoppt',
      'conn.starting': 'autobrr startet...',
      'conn.not_installed': 'autobrr nicht installiert',
      'conn.no_drive': 'Apps-Laufwerk fehlt',
      'conn.no_access': 'Nur für Administratoren',

      // Menu
      'menu.file': 'Datei',
      'menu.refresh': 'Aktualisieren',
      'menu.view_log': 'Dienstprotokoll anzeigen',
      'menu.quit': 'autobrr schließen',
      'menu.service': 'Dienst',
      'menu.start': 'autobrr starten',
      'menu.stop': 'autobrr stoppen',
      'menu.open_ui': 'Eigene Weboberfläche öffnen (:7474)',
      'menu.view': 'Ansicht',
      'menu.tab.releases': 'Releases & Feed',
      'menu.tab.filters': 'Filter',
      'menu.tab.irc': 'IRC & Indexer',
      'menu.tab.transmission': 'Transmission-Übergabe',
      'menu.tab.settings': 'Dienst & Einstellungen',
      'menu.transmission': 'Transmission-App öffnen',
      'menu.help': 'Hilfe',
      'menu.docs': 'autobrr Dokumentation',
      'menu.about': 'Über autobrr für ShareOS',

      // Toolbar
      'tb.refresh': 'Aktualisieren',
      'tb.add_filter': 'Neuer Filter',
      'tb.view_log': 'Protokoll',
      'tb.open_webui': 'Erweiterte Einstellungen (:7474)',
      'tb.open_transmission': 'Transmission',
      'tb.search_placeholder': 'Releases, Filter, Tracker durchsuchen...',

      // Tabs
      'tab.releases': 'Releases',
      'tab.filters': 'Filter',
      'tab.irc': 'IRC & Indexer',
      'tab.transmission': 'Transmission',
      'tab.settings': 'Dienst & Einstellungen',

      // Releases Table
      'col.time': 'Zeit',
      'col.indexer': 'Indexer / Kanal',
      'col.release': 'Release-Name',
      'col.status': 'Filter-Status',
      'col.action': 'Client-Aktion',
      'col.actions': 'Aktionen',
      'releases.empty': 'Noch keine Releases.',
      'releases.no_match': 'Keine Releases entsprechen den Suchkriterien.',
      'releases.no_access': 'Noch keine Releases (nur für Administratoren).',

      // Status badges
      'status.APPROVED': 'Akzeptiert',
      'status.FILTER_REJECTED': 'Ausgefiltert',
      'status.PUSH_APPROVED': 'An Transmission gesendet',
      'status.PUSH_ERROR': 'Sendefehler',
      'status.PENDING': 'Wird verarbeitet',
      'status.active': 'Aktiv',
      'status.inactive': 'Deaktiviert',
      'status.stopped': 'Gestoppt',

      // Action buttons
      'btn.send_transmission': 'An Transmission senden',
      'btn.details': 'Details',
      'btn.edit': 'Bearbeiten',
      'btn.delete': 'Löschen',
      'btn.save': 'Änderungen speichern',
      'btn.cancel': 'Abbrechen',
      'btn.create': 'Filter erstellen',
      'btn.start_service': 'autobrr starten',
      'btn.stop_service': 'Dienst stoppen',
      'btn.refresh_log': 'Protokoll aktualisieren',
      'btn.save_account': 'Konto speichern',
      'btn.change_pw': 'Passwort ändern',
      'btn.test_rpc': 'Transmission RPC testen',
      'btn.open_trans_app': 'Transmission öffnen',
      'btn.retry': 'Verbindung wiederholen',

      // Filters View
      'filters.title': 'Aktive Filterregeln',
      'filters.empty': 'Noch keine Filter eingerichtet.',
      'filters.no_access': 'Noch keine Filter eingerichtet (nur für Administratoren).',
      'filters.new_title': 'Neuen Filter erstellen',
      'filters.edit_title': 'Filter bearbeiten',
      'filters.name': 'Filtername',
      'filters.indexers': 'Indexer / Tracker (kommagetrennt oder leer für alle)',
      'filters.match_releases': 'Passende Releases (Platzhalter z.B. *1080p*, *BluRay*)',
      'filters.except_releases': 'Ausnahmen (z.B. *CAM*, *TS*, *HDCAM*)',
      'filters.min_size': 'Min. Größe (MB)',
      'filters.max_size': 'Max. Größe (MB)',
      'filters.freeleech': 'Nur Freeleech',
      'filters.enabled': 'Filter aktiviert',

      // IRC & Indexers View
      'irc.title': 'Überwachte Netzwerke & IRC-Kanäle',
      'irc.empty': 'Noch keine IRC-Netzwerke verbunden.',
      'irc.no_access': 'Noch keine IRC-Netzwerke verbunden (nur für Administratoren).',
      'irc.server': 'Netzwerk / Server',
      'irc.channel': 'Ankündigungskanal',
      'irc.bot': 'Ankündigungs-Bot',
      'irc.nick': 'Nick',
      'irc.status': 'IRC-Status',
      'irc.connected': 'Verbunden & lauscht',
      'irc.disconnected': 'Getrennt',
      'indexers.title': 'Eingerichtete Indexer & Tracker',
      'indexers.empty': 'Noch keine Indexer eingerichtet.',
      'indexers.no_access': 'Noch keine Indexer eingerichtet (nur für Administratoren).',
      'indexers.name': 'Indexer-Name',
      'indexers.identifier': 'Kennung',
      'indexers.type': 'Typ',
      'indexers.status': 'Status',

      // Transmission View
      'trans.title': 'Transmission-Übergabe',
      'trans.how_it_works': 'Funktionsweise',
      'trans.how_desc': 'autobrr läuft als Dienst für die ganze Box. Passende Torrents landen in einem gesicherten Übergabeordner mit den Rechten 2770. Der Transmission-Dienst des gewählten Kontos überwacht diesen Ordner und startet den Download automatisch.',
      'trans.drop_title': 'Übergabe-Ordner (Drop)',
      'trans.drop_path': 'Ordnerpfad',
      'trans.drop_account': 'Empfangendes Benutzerkonto',
      'trans.drop_mode': 'Rechteverwaltung',
      'trans.drop_hint': 'Dateien, die in diesen Ordner gelegt werden, übernimmt Transmission automatisch.',
      'trans.daemon_card': 'Transmission-Client',
      'trans.daemon_desc': 'Nativer ShareOS BitTorrent-Dienst pro Benutzer mit isolierten Dateirechten.',

      // Settings View
      'settings.title': 'autobrr Dienst- & Systemeinstellungen',
      'settings.daemon_section': 'autobrr-Dienststeuerung',
      'settings.daemon_desc': 'Läuft als Systembenutzer „autobrr“ mit Speicherlimit 48 MiB (ideal für DNS-320L).',
      'settings.daemon_status': 'Aktueller Zustand',
      'settings.daemon_boot': 'Beim Start der Box aktivieren',
      'settings.daemon_boot_hint': 'autobrr nach jedem Neustart der Box automatisch ausführen.',
      'settings.handover_section': 'Transmission-Übergabekonto',
      'settings.handover_desc': 'Wähle das ShareOS-Konto, dessen Transmission-Dienst die Torrents im Übergabeordner empfängt.',
      'settings.handover_account': 'Zielkonto',
      'settings.webui_section': 'Eigene Weboberfläche von autobrr (Port 7474)',
      'settings.webui_desc': 'autobrr enthält eine eigene Weboberfläche. Standardmäßig lauscht sie nur auf 127.0.0.1 für Sicherheit und Ressourcenschonung.',
      'settings.webui_enable': 'Weboberfläche im Heimnetz freigeben (0.0.0.0:7474)',
      'settings.webui_open': 'autobrr-Weboberfläche öffnen',
      'settings.password_section': 'Admin-Passwort für Weboberfläche',
      'settings.password_desc': 'Passwort für den Benutzer „admin“ beim Zugriff auf Port 7474 (8 bis 128 Zeichen).',
      'settings.password_label': 'Neues Passwort',
      'settings.password_placeholder': 'Mindestens 8 Zeichen eingeben',
      'settings.log_section': 'Dienstprotokoll',
      'log.no_access': 'Dienstprotokolle von autobrr sind nur für Administratoren zugänglich.',
      'log.offline': 'autobrr-Dienst ist nicht verbunden.',

      // Banners
      'banner.offline_title': 'autobrr-Dienst gestoppt',
      'banner.offline_desc': 'Der Hintergrunddienst läuft derzeit nicht. Starte den Dienst, um Releases abzufangen.',
      'banner.not_installed_title': 'System-App „autobrr“ nicht installiert',
      'banner.not_installed_desc': 'Der Dienst fehlt auf der Box. Installiere „autobrr“ unter Apps → Store → System-Apps.',
      'banner.no_drive_title': 'Apps-Laufwerk erforderlich',
      'banner.no_drive_desc': 'autobrr benötigt ein eingerichtetes Apps-Laufwerk für die Datenbank und Downloads.',
      'banner.no_access_title': 'Administratorenzugriff erforderlich',
      'banner.no_access_desc': 'autobrr ist ein Dienst der gesamten Box und kann nur von Administratoren eingerichtet werden.',

      // Statusbar
      'sb.releases_count': '{count} Releases überwacht',
      'sb.filters_count': '{count} aktive Filter',
      'sb.account': 'Konto: {account}',
      'sb.updated': 'Aktualisiert: {time}',

      // Messages and Errors
      'err.service_not_ready': 'autobrr-Dienst läuft nicht oder ist noch nicht bereit.',
      'toast.torrent_dispatched': 'Torrent an Transmission-Übergabeordner übergeben!',
      'toast.filter_deleted': 'Filter gelöscht',
      'toast.filter_created': 'Filter erfolgreich erstellt'
    },

    pt: {
      'app.title': 'autobrr',
      'conn.checking': 'Verificando serviço...',
      'conn.online': 'autobrr Online',
      'conn.offline': 'autobrr Parado',
      'conn.starting': 'Iniciando autobrr...',
      'conn.not_installed': 'autobrr Não Instalado',
      'conn.no_drive': 'Disco de Apps Ausente',
      'conn.no_access': 'Apenas Administradores',

      // Menu
      'menu.file': 'Arquivo',
      'menu.refresh': 'Atualizar Dados',
      'menu.view_log': 'Ver Log do Serviço',
      'menu.quit': 'Fechar autobrr',
      'menu.service': 'Serviço',
      'menu.start': 'Iniciar autobrr',
      'menu.stop': 'Parar autobrr',
      'menu.open_ui': 'Abrir Interface Web Nativa (:7474)',
      'menu.view': 'Exibir',
      'menu.tab.releases': 'Releases & Feed',
      'menu.tab.filters': 'Filtros',
      'menu.tab.irc': 'IRC & Indexadores',
      'menu.tab.transmission': 'Entrega para Transmission',
      'menu.tab.settings': 'Serviço & Configurações',
      'menu.transmission': 'Abrir App Transmission',
      'menu.help': 'Ajuda',
      'menu.docs': 'Documentação do autobrr',
      'menu.about': 'Sobre o autobrr para ShareOS',

      // Toolbar
      'tb.refresh': 'Atualizar',
      'tb.add_filter': 'Novo Filtro',
      'tb.view_log': 'Logs',
      'tb.open_webui': 'Configuração Avançada (:7474)',
      'tb.open_transmission': 'Transmission',
      'tb.search_placeholder': 'Buscar releases, filtros, trackers...',

      // Tabs
      'tab.releases': 'Releases',
      'tab.filters': 'Filtros',
      'tab.irc': 'IRC & Indexadores',
      'tab.transmission': 'Transmission',
      'tab.settings': 'Serviço & Ajustes',

      // Releases Table
      'col.time': 'Horário',
      'col.indexer': 'Tracker / Canal',
      'col.release': 'Nome do Release',
      'col.status': 'Status do Filtro',
      'col.action': 'Ação do Cliente',
      'col.actions': 'Ações',
      'releases.empty': 'Nenhum release ainda.',
      'releases.no_match': 'Nenhum release corresponde aos critérios.',
      'releases.no_access': 'Nenhum release ainda (apenas administradores).',

      // Status badges
      'status.APPROVED': 'Aprovado',
      'status.FILTER_REJECTED': 'Filtrado',
      'status.PUSH_APPROVED': 'Enviado ao Transmission',
      'status.PUSH_ERROR': 'Erro de Envio',
      'status.PENDING': 'Processando',
      'status.active': 'Ativo',
      'status.inactive': 'Desativado',
      'status.stopped': 'Parado',

      // Action buttons
      'btn.send_transmission': 'Enviar ao Transmission',
      'btn.details': 'Detalhes',
      'btn.edit': 'Editar',
      'btn.delete': 'Excluir',
      'btn.save': 'Salvar Alterações',
      'btn.cancel': 'Cancelar',
      'btn.create': 'Criar Filtro',
      'btn.start_service': 'Iniciar autobrr',
      'btn.stop_service': 'Parar Serviço',
      'btn.refresh_log': 'Atualizar Log',
      'btn.save_account': 'Salvar Conta',
      'btn.change_pw': 'Alterar Senha',
      'btn.test_rpc': 'Testar RPC Transmission',
      'btn.open_trans_app': 'Abrir Transmission',
      'btn.retry': 'Tentar Novamente',

      // Filters View
      'filters.title': 'Regras de Filtragem Ativas',
      'filters.empty': 'Nenhum filtro ainda.',
      'filters.no_access': 'Nenhum filtro ainda (apenas administradores).',
      'filters.new_title': 'Criar Novo Filtro',
      'filters.edit_title': 'Editar Filtro',
      'filters.name': 'Nome do Filtro',
      'filters.indexers': 'Indexadores / Trackers (separados por vírgula ou vazio para todos)',
      'filters.match_releases': 'Padrões de Busca (ex: *1080p*, *BluRay*)',
      'filters.except_releases': 'Exceções (ex: *CAM*, *TS*, *HDCAM*)',
      'filters.min_size': 'Tamanho Mínimo (MB)',
      'filters.max_size': 'Tamanho Máximo (MB)',
      'filters.freeleech': 'Apenas Freeleech',
      'filters.enabled': 'Filtro Ativado',

      // IRC & Indexers View
      'irc.title': 'Redes Monitoradas & Canais IRC',
      'irc.empty': 'Nenhuma rede IRC conectada ainda.',
      'irc.no_access': 'Nenhuma rede IRC conectada ainda (apenas administradores).',
      'irc.server': 'Rede / Servidor',
      'irc.channel': 'Canal de Anúncios',
      'irc.bot': 'Bot de Anúncios',
      'irc.nick': 'Nick',
      'irc.status': 'Status IRC',
      'irc.connected': 'Conectado & Escutando',
      'irc.disconnected': 'Desconectado',
      'indexers.title': 'Indexadores & Trackers Configurados',
      'indexers.empty': 'Nenhum indexador configurado ainda.',
      'indexers.no_access': 'Nenhum indexador configurado ainda (apenas administradores).',
      'indexers.name': 'Nome do Indexador',
      'indexers.identifier': 'Identificador',
      'indexers.type': 'Tipo',
      'indexers.status': 'Status',

      // Transmission View
      'trans.title': 'Integração de Entrega para Transmission',
      'trans.how_it_works': 'Como Funciona no ShareOS',
      'trans.how_desc': 'O autobrr roda como um serviço único para toda a box. Quando um torrent corresponde aos filtros, ele é gravado na pasta de entrega segura com permissões 2770. O Transmission do usuário selecionado monitora essa pasta e inicia o download automaticamente.',
      'trans.drop_title': 'Pasta de Entrega (Drop Folder)',
      'trans.drop_path': 'Caminho da Pasta',
      'trans.drop_account': 'Conta de Usuário Vinculada',
      'trans.drop_mode': 'Permissões do Diretório',
      'trans.drop_hint': 'Qualquer arquivo .torrent gravado nesta pasta é imediatamente absorvido pelo Transmission.',
      'trans.daemon_card': 'Cliente Transmission',
      'trans.daemon_desc': 'Serviço Transmission BitTorrent nativo do ShareOS rodando isolado por usuário.',

      // Settings View
      'settings.title': 'Configurações do Serviço autobrr',
      'settings.daemon_section': 'Controle do Serviço autobrr',
      'settings.daemon_desc': 'Executado como usuário de sistema "autobrr" com limite de memória restrito a 48 MiB (ideal para o DNS-320L).',
      'settings.daemon_status': 'Estado Atual',
      'settings.daemon_boot': 'Iniciar Automaticamente no Boot',
      'settings.daemon_boot_hint': 'Mantém o autobrr ativo em segundo plano quando o ShareOS inicializa.',
      'settings.handover_section': 'Conta de Usuário para o Transmission',
      'settings.handover_desc': 'Selecione qual conta do ShareOS receberá os torrents do autobrr em sua pasta vigiada do Transmission.',
      'settings.handover_account': 'Conta de Destino',
      'settings.webui_section': 'Interface Web Nativa do autobrr (Porta 7474)',
      'settings.webui_desc': 'O autobrr inclui sua própria interface web completa. Por padrão, ele escuta apenas em 127.0.0.1 para segurança e economia de memória.',
      'settings.webui_enable': 'Habilitar Web UI na rede local (0.0.0.0:7474)',
      'settings.webui_open': 'Abrir Interface Web do autobrr',
      'settings.password_section': 'Senha do Usuário Admin',
      'settings.password_desc': 'Altere a senha do usuário "admin" para acesso à interface web na porta 7474 (8 a 128 caracteres).',
      'settings.password_label': 'Nova Senha',
      'settings.password_placeholder': 'Digite ao menos 8 caracteres',
      'settings.log_section': 'Visualizador de Log do Serviço',
      'log.no_access': 'Logs do serviço autobrr estão acessíveis apenas para administradores.',
      'log.offline': 'Serviço autobrr não está conectado.',

      // Banners
      'banner.offline_title': 'Serviço autobrr Parado',
      'banner.offline_desc': 'O serviço autobrr não está em execução. Inicie o serviço para capturar novos releases.',
      'banner.not_installed_title': 'App de Sistema "autobrr" Não Instalado',
      'banner.not_installed_desc': 'O pacote backend não foi encontrado. Instale o app "autobrr" em Apps → Loja → Apps de Sistema.',
      'banner.no_drive_title': 'Disco de Armazenamento Necessário',
      'banner.no_drive_desc': 'O autobrr necessita de um disco configurado para guardar o banco de dados e arquivos.',
      'banner.no_access_title': 'Acesso Restrito a Administradores',
      'banner.no_access_desc': 'O autobrr é um serviço global da box e só pode ser configurado por administradores.',

      // Statusbar
      'sb.releases_count': '{count} releases monitorados',
      'sb.filters_count': '{count} filtros ativos',
      'sb.account': 'Entrega: {account}',
      'sb.updated': 'Atualizado: {time}',

      // Messages and Errors
      'err.service_not_ready': 'Serviço autobrr não está em execução ou não está pronto.',
      'toast.torrent_dispatched': 'Torrent enviado para a pasta de entrega do Transmission!',
      'toast.filter_deleted': 'Filtro excluído',
      'toast.filter_created': 'Filtro criado com sucesso'
    }
  };

  function detectLang() {
    try {
      const p = new URLSearchParams(window.location.search);
      const urlLang = p.get('lang');
      if (urlLang && dict[urlLang]) return urlLang;
      if (window.ShareOS && typeof ShareOS.lang === 'string' && dict[ShareOS.lang]) return ShareOS.lang;
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
