// Transmission ShareOS Web Client – i18n (pt / en / de)
'use strict';

(function () {
  const SUPPORTED = ['pt', 'en', 'de'];
  const FALLBACK = 'en';

  const STRINGS = {
    // ---------- Português ----------
    pt: {
      'conn.checking': 'Verificando conexão...',
      'conn.online': '● Conectado',
      'conn.offline': '○ Indisponível',

      'tb.add.title': 'Adicionar torrent (Ctrl+O)',
      'tb.start': 'Iniciar',
      'tb.start.title': 'Iniciar selecionados',
      'tb.pause': 'Pausar',
      'tb.pause.title': 'Pausar selecionados',
      'tb.remove': 'Excluir',
      'tb.remove.title': 'Excluir selecionados (Del)',
      'tb.turtle': 'Limitar',
      'tb.turtle.title': 'Limite alternativo de velocidade (modo tartaruga)',
      'tb.settings': 'Configurações',

      'filter.all': 'Todos os torrents',
      'filter.downloading': 'Baixando',
      'filter.seeding': 'Semeando (Seeding)',
      'filter.paused': 'Pausados',
      'filter.active': 'Ativos',
      'search.placeholder': 'Pesquisar...',

      'banner.title': '⚠️ Transmission indisponível.',
      'banner.retry': 'Tentar novamente',

      'col.status': 'Status',
      'col.name': 'Nome',
      'col.progress': 'Progresso',
      'col.size': 'Tamanho',
      'col.rates': 'Download / Upload',
      'col.eta': 'Tempo restante',
      'col.peers': 'Peers',

      'list.loading': 'Carregando torrents...',
      'list.empty': 'Nenhum torrent. Clique em “+ Torrent” para iniciar um download.',
      'list.nomatch': 'Nenhum resultado para o filtro atual.',
      'list.offline': 'O Transmission-daemon não está respondendo. Verifique o serviço no ShareOS.',

      'status.0': 'Pausado',
      'status.1': 'Aguardando verificação',
      'status.2': 'Verificando dados...',
      'status.3': 'Aguardando download',
      'status.4': 'Baixando',
      'status.5': 'Aguardando seed',
      'status.6': 'Semeando (Seeding)',
      'status.unknown': 'Desconhecido',

      'eta.done': 'Concluído',

      'tab.general': 'Geral',
      'tab.files': 'Arquivos',
      'tab.peers': 'Peers',
      'tab.trackers': 'Trackers',
      'drawer.close': 'Fechar detalhes',

      'det.location': 'Local:',
      'det.totalSize': 'Tamanho total:',
      'det.hash': 'Hash:',
      'det.status': 'Status:',
      'det.dlRate': 'Taxa de download:',
      'det.ulRate': 'Taxa de upload:',
      'det.ratio': 'Proporção de upload:',
      'det.file': 'Arquivo',
      'det.size': 'Tamanho',
      'det.progress': 'Progresso',
      'det.ip': 'IP / Host',
      'det.client': 'Cliente',
      'det.noFiles': 'Nenhuma informação de arquivos disponível.',
      'det.noPeers': 'Nenhum peer conectado.',
      'det.noTrackers': 'Nenhum tracker cadastrado.',

      'sb.torrents': '{n} torrents',
      'sb.turtle': '🐢 Limite ativo',
      'sb.ready': 'Pronto',

      'add.title': 'Adicionar torrent',
      'add.tabFile': 'Arquivo torrent',
      'add.urlLabel': 'Link magnet ou URL do arquivo .torrent:',
      'add.urlPlaceholder': 'magnet:?xt=urn:btih:... ou https://...',
      'add.fileLabel': 'Selecionar arquivo .torrent do computador:',
      'add.or': 'ou',
      'add.pickBox': 'Escolher do armazenamento do ShareOS...',
      'add.dest': 'Local de salvamento (pasta de destino):',
      'add.destPlaceholder': 'vazio = pasta padrão',
      'add.browse': 'Procurar',
      'add.browse.title': 'Selecionar pasta na box',
      'add.startNow': 'Iniciar download imediatamente',
      'add.submit': 'Adicionar',
      'btn.cancel': 'Cancelar',
      'btn.save': 'Salvar',

      'del.title': 'Excluir torrent',
      'del.prompt': 'Deseja realmente remover os torrents selecionados?',
      'del.data': '<strong>Excluir os arquivos baixados</strong> do disco',
      'del.submit': 'Excluir',

      'cfg.title': 'Configurações do Transmission',
      'cfg.downloadDir': 'Pasta de download',
      'cfg.limits': 'Limites de velocidade (KB/s)',
      'cfg.limitDown': 'Limitar download:',
      'cfg.limitUp': 'Limitar upload:',
      'cfg.alt': 'Limite alternativo (modo tartaruga, KB/s)',
      'cfg.altDown': 'Download (limitado):',
      'cfg.altUp': 'Upload (limitado):',
      'cfg.conn': 'Conexão e porta',
      'cfg.peerPort': 'Porta de peers (para redirecionamento de portas no roteador):',

      'toast.started': 'Torrents iniciados',
      'toast.paused': 'Torrents pausados',
      'toast.deleted': 'Torrent(s) excluído(s) com sucesso',
      'toast.turtleOn': 'Limite (tartaruga) ativado',
      'toast.turtleOff': 'Limite desativado',
      'toast.added': 'Torrent adicionado',
      'toast.addedName': 'Torrent “{name}” adicionado!',
      'toast.addError': 'Erro ao adicionar: ',
      'toast.saved': 'Configurações salvas',
      'toast.saveError': 'Erro ao salvar: ',
      'toast.noPicker': 'Seleção de arquivos do ShareOS indisponível',
      'toast.needUrl': 'Informe um link magnet ou uma URL',
      'toast.needFile': 'Selecione um arquivo .torrent',
      'toast.about': 'Transmission para ShareOS 1.2 – cada usuário tem seu próprio serviço',
      'toast.noFolderPicker': 'Seleção de pastas do ShareOS indisponível',
      'rpc.error': 'Erro de RPC do Transmission',
      'err.noShareOS': 'Disponível apenas no ShareOS 0.2.0-beta.4 ou mais recente',
      'why.notInstalled': 'O serviço do Transmission não está instalado: APPS → Store → “transmission-daemon”.',
      'why.noDrive': 'Nenhuma unidade ou nenhuma pasta pessoal em uma unidade – os downloads precisam de uma unidade.',
      'why.noAccess': 'Sem permissão – abra o app a partir do ShareOS.',
      'why.noResponse': 'O Transmission não está respondendo{detail}.',
      'path.home': 'Minha pasta',

      'pick.destTitle': 'Pasta para downloads',
      'pick.fileTitle': 'Selecionar arquivo .torrent',
      'pick.selected': 'Selecionado: {name}',
      'confirm.openFile': 'Deseja adicionar o arquivo “{name}” ao Transmission agora?',

      'menu.torrent': 'Torrent',
      'menu.add': 'Adicionar torrent...',
      'menu.pauseAll': 'Pausar todos',
      'menu.resumeAll': 'Retomar todos',
      'menu.close': 'Fechar',
      'menu.edit': 'Editar',
      'menu.start': 'Iniciar',
      'menu.pause': 'Pausar',
      'menu.remove': 'Excluir...',
      'menu.removeKbd': 'Del',
      'menu.selectAll': 'Selecionar todos',
      'menu.view': 'Exibir',
      'menu.refresh': 'Atualizar',
      'menu.light': 'Claro',
      'menu.dark': 'Escuro',
      'menu.language': 'Idioma',
      'menu.help': 'Ajuda',
      'menu.about': 'Sobre o Transmission'
    },

    // ---------- English ----------
    en: {
      'conn.checking': 'Checking connection...',
      'conn.online': '● Connected',
      'conn.offline': '○ Unreachable',

      'tb.add.title': 'Add torrent (Ctrl+O)',
      'tb.start': 'Start',
      'tb.start.title': 'Start selected',
      'tb.pause': 'Pause',
      'tb.pause.title': 'Pause selected',
      'tb.remove': 'Delete',
      'tb.remove.title': 'Delete selected (Del)',
      'tb.turtle': 'Throttle',
      'tb.turtle.title': 'Alternative speed limits (turtle mode)',
      'tb.settings': 'Settings',

      'filter.all': 'All torrents',
      'filter.downloading': 'Downloading',
      'filter.seeding': 'Seeding',
      'filter.paused': 'Paused',
      'filter.active': 'Active',
      'search.placeholder': 'Search...',

      'banner.title': '⚠️ Transmission unreachable.',
      'banner.retry': 'Retry',

      'col.status': 'Status',
      'col.name': 'Name',
      'col.progress': 'Progress',
      'col.size': 'Size',
      'col.rates': 'Download / Upload',
      'col.eta': 'Remaining',
      'col.peers': 'Peers',

      'list.loading': 'Loading torrents...',
      'list.empty': 'No torrents yet. Click “+ Torrent” to start a download.',
      'list.nomatch': 'No matches for the current filter.',
      'list.offline': 'Transmission daemon is not responding. Check the service in ShareOS.',

      'status.0': 'Paused',
      'status.1': 'Queued for check',
      'status.2': 'Checking data...',
      'status.3': 'Queued for download',
      'status.4': 'Downloading',
      'status.5': 'Queued for seed',
      'status.6': 'Seeding',
      'status.unknown': 'Unknown',

      'eta.done': 'Done',

      'tab.general': 'General',
      'tab.files': 'Files',
      'tab.peers': 'Peers',
      'tab.trackers': 'Trackers',
      'drawer.close': 'Close details',

      'det.location': 'Location:',
      'det.totalSize': 'Total size:',
      'det.hash': 'Hash:',
      'det.status': 'Status:',
      'det.dlRate': 'Download rate:',
      'det.ulRate': 'Upload rate:',
      'det.ratio': 'Upload ratio:',
      'det.file': 'File',
      'det.size': 'Size',
      'det.progress': 'Progress',
      'det.ip': 'IP / Host',
      'det.client': 'Client',
      'det.noFiles': 'No file information available.',
      'det.noPeers': 'No peers connected.',
      'det.noTrackers': 'No trackers configured.',

      'sb.torrents': '{n} torrents',
      'sb.turtle': '🐢 Throttling active',
      'sb.ready': 'Ready',

      'add.title': 'Add torrent',
      'add.tabFile': 'Torrent file',
      'add.urlLabel': 'Magnet link or URL to the .torrent file:',
      'add.urlPlaceholder': 'magnet:?xt=urn:btih:... or https://...',
      'add.fileLabel': 'Select a .torrent file from your computer:',
      'add.or': 'or',
      'add.pickBox': 'Choose from ShareOS storage...',
      'add.dest': 'Save location (destination folder):',
      'add.destPlaceholder': 'empty = default folder',
      'add.browse': 'Browse',
      'add.browse.title': 'Select a folder on the box',
      'add.startNow': 'Start download immediately',
      'add.submit': 'Add',
      'btn.cancel': 'Cancel',
      'btn.save': 'Save',

      'del.title': 'Delete torrent',
      'del.prompt': 'Do you really want to remove the selected torrents?',
      'del.data': 'Also delete <strong>downloaded files</strong> from disk',
      'del.submit': 'Delete',

      'cfg.title': 'Transmission settings',
      'cfg.downloadDir': 'Download directory',
      'cfg.limits': 'Speed limits (KB/s)',
      'cfg.limitDown': 'Limit download:',
      'cfg.limitUp': 'Limit upload:',
      'cfg.alt': 'Alternative limits (turtle mode, KB/s)',
      'cfg.altDown': 'Download (throttled):',
      'cfg.altUp': 'Upload (throttled):',
      'cfg.conn': 'Connection & port',
      'cfg.peerPort': 'Peer port (for port forwarding in the router):',

      'toast.started': 'Torrents started',
      'toast.paused': 'Torrents paused',
      'toast.deleted': 'Torrent(s) deleted successfully',
      'toast.turtleOn': 'Throttling (turtle) enabled',
      'toast.turtleOff': 'Throttling disabled',
      'toast.added': 'Torrent added',
      'toast.addedName': 'Torrent “{name}” added!',
      'toast.addError': 'Error adding torrent: ',
      'toast.saved': 'Settings saved',
      'toast.saveError': 'Error saving: ',
      'toast.noPicker': 'ShareOS file picker not available',
      'toast.needUrl': 'Please enter a magnet link or URL',
      'toast.needFile': 'Please select a .torrent file',
      'toast.about': 'Transmission for ShareOS 1.2 – every user has their own service',
      'toast.noFolderPicker': 'ShareOS folder picker not available',
      'rpc.error': 'Transmission RPC error',
      'err.noShareOS': 'Only available in ShareOS 0.2.0-beta.4 or newer',
      'why.notInstalled': 'The Transmission service is not installed: APPS → Store → “transmission-daemon”.',
      'why.noDrive': 'No drive or no personal folder on a drive – downloads need a drive.',
      'why.noAccess': 'No permission – please open the app from within ShareOS.',
      'why.noResponse': 'Transmission is not responding{detail}.',
      'path.home': 'My folder',

      'pick.destTitle': 'Folder for downloads',
      'pick.fileTitle': 'Select .torrent file',
      'pick.selected': 'Selected: {name}',
      'confirm.openFile': 'Do you want to add “{name}” to Transmission now?',

      'menu.torrent': 'Torrent',
      'menu.add': 'Add torrent...',
      'menu.pauseAll': 'Pause all',
      'menu.resumeAll': 'Resume all',
      'menu.close': 'Close',
      'menu.edit': 'Edit',
      'menu.start': 'Start',
      'menu.pause': 'Pause',
      'menu.remove': 'Delete...',
      'menu.removeKbd': 'Del',
      'menu.selectAll': 'Select all',
      'menu.view': 'View',
      'menu.refresh': 'Refresh',
      'menu.light': 'Light',
      'menu.dark': 'Dark',
      'menu.language': 'Language',
      'menu.help': 'Help',
      'menu.about': 'About Transmission'
    },

    // ---------- Deutsch ----------
    de: {
      'conn.checking': 'Prüfe Verbindung...',
      'conn.online': '● Verbunden',
      'conn.offline': '○ Nicht erreichbar',

      'tb.add.title': 'Torrent hinzufügen (Ctrl+O)',
      'tb.start': 'Starten',
      'tb.start.title': 'Ausgewählte starten',
      'tb.pause': 'Anhalten',
      'tb.pause.title': 'Ausgewählte anhalten',
      'tb.remove': 'Löschen',
      'tb.remove.title': 'Ausgewählte löschen (Entf)',
      'tb.turtle': 'Drosselung',
      'tb.turtle.title': 'Alternative Geschwindigkeitsbegrenzung (Turtle-Modus)',
      'tb.settings': 'Einstellungen',

      'filter.all': 'Alle Torrents',
      'filter.downloading': 'Herunterladen',
      'filter.seeding': 'Verteilen (Seeding)',
      'filter.paused': 'Angehalten',
      'filter.active': 'Aktiv',
      'search.placeholder': 'Suchen...',

      'banner.title': '⚠️ Transmission nicht erreichbar.',
      'banner.retry': 'Erneut prüfen',

      'col.status': 'Status',
      'col.name': 'Name',
      'col.progress': 'Fortschritt',
      'col.size': 'Größe',
      'col.rates': 'Download / Upload',
      'col.eta': 'Restzeit',
      'col.peers': 'Peers',

      'list.loading': 'Lade Torrents...',
      'list.empty': 'Keine Torrents vorhanden. Klicken Sie auf „+ Torrent“ um einen Download zu starten.',
      'list.nomatch': 'Keine Treffer für den aktuellen Filter.',
      'list.offline': 'Transmission-Daemon antwortet nicht. Prüfen Sie den Dienst in ShareOS.',

      'status.0': 'Angehalten',
      'status.1': 'Wartet auf Prüfung',
      'status.2': 'Prüft Daten...',
      'status.3': 'Wartet auf DL',
      'status.4': 'Lädt herunter',
      'status.5': 'Wartet auf Seed',
      'status.6': 'Verteilt (Seeding)',
      'status.unknown': 'Unbekannt',

      'eta.done': 'Fertig',

      'tab.general': 'Allgemein',
      'tab.files': 'Dateien',
      'tab.peers': 'Peers',
      'tab.trackers': 'Tracker',
      'drawer.close': 'Details schließen',

      'det.location': 'Speicherort:',
      'det.totalSize': 'Gesamtgröße:',
      'det.hash': 'Hash:',
      'det.status': 'Status:',
      'det.dlRate': 'Download-Rate:',
      'det.ulRate': 'Upload-Rate:',
      'det.ratio': 'Upload-Verhältnis:',
      'det.file': 'Datei',
      'det.size': 'Größe',
      'det.progress': 'Fortschritt',
      'det.ip': 'IP / Host',
      'det.client': 'Client',
      'det.noFiles': 'Keine Dateiinformationen vorhanden.',
      'det.noPeers': 'Keine Peers verbunden.',
      'det.noTrackers': 'Keine Tracker eingetragen.',

      'sb.torrents': '{n} Torrents',
      'sb.turtle': '🐢 Drosselung aktiv',
      'sb.ready': 'Bereit',

      'add.title': 'Torrent hinzufügen',
      'add.tabFile': 'Torrent-Datei',
      'add.urlLabel': 'Magnet-Link oder URL zur .torrent-Datei:',
      'add.urlPlaceholder': 'magnet:?xt=urn:btih:... oder https://...',
      'add.fileLabel': '.torrent-Datei vom Computer auswählen:',
      'add.or': 'oder',
      'add.pickBox': 'Aus ShareOS-Speicher wählen...',
      'add.dest': 'Speicherort (Zielordner):',
      'add.destPlaceholder': 'leer = Standard-Ordner',
      'add.browse': 'Durchsuchen',
      'add.browse.title': 'Ordner auf der Box auswählen',
      'add.startNow': 'Download sofort starten',
      'add.submit': 'Hinzufügen',
      'btn.cancel': 'Abbrechen',
      'btn.save': 'Speichern',

      'del.title': 'Torrent löschen',
      'del.prompt': 'Möchten Sie die ausgewählten Torrents wirklich entfernen?',
      'del.data': '<strong>Heruntergeladene Dateien</strong> von der Festplatte löschen',
      'del.submit': 'Löschen',

      'cfg.title': 'Transmission Einstellungen',
      'cfg.downloadDir': 'Download-Verzeichnis',
      'cfg.limits': 'Geschwindigkeitsbegrenzungen (KB/s)',
      'cfg.limitDown': 'Download begrenzen:',
      'cfg.limitUp': 'Upload begrenzen:',
      'cfg.alt': 'Alternative Begrenzung (Turtle-Modus, KB/s)',
      'cfg.altDown': 'Download (Drossel):',
      'cfg.altUp': 'Upload (Drossel):',
      'cfg.conn': 'Verbindung & Port',
      'cfg.peerPort': 'Peer-Port (für Portweiterleitung im Router):',

      'toast.started': 'Torrents gestartet',
      'toast.paused': 'Torrents angehalten',
      'toast.deleted': 'Torrent(s) erfolgreich gelöscht',
      'toast.turtleOn': 'Drosselung (Turtle) aktiviert',
      'toast.turtleOff': 'Drosselung deaktiviert',
      'toast.added': 'Torrent hinzugefügt',
      'toast.addedName': 'Torrent „{name}“ hinzugefügt!',
      'toast.addError': 'Fehler beim Hinzufügen: ',
      'toast.saved': 'Einstellungen gespeichert',
      'toast.saveError': 'Fehler beim Speichern: ',
      'toast.noPicker': 'Dateiauswahl über ShareOS nicht verfügbar',
      'toast.needUrl': 'Bitte geben Sie einen Magnet-Link oder eine URL ein',
      'toast.needFile': 'Bitte wählen Sie eine .torrent-Datei aus',
      'toast.about': 'Transmission für ShareOS 1.2 – jeder Benutzer hat seinen eigenen Dienst',
      'toast.noFolderPicker': 'Ordnerwahl über ShareOS nicht verfügbar',
      'rpc.error': 'Transmission RPC Fehler',
      'err.noShareOS': 'Nur in ShareOS 0.2.0-beta.4 oder neuer verfügbar',
      'why.notInstalled': 'Der Transmission-Dienst ist nicht installiert: APPS → Store → „transmission-daemon“.',
      'why.noDrive': 'Kein Laufwerk bzw. kein persönlicher Ordner auf einem Laufwerk – Downloads brauchen ein Laufwerk.',
      'why.noAccess': 'Keine Berechtigung – die App bitte aus ShareOS heraus öffnen.',
      'why.noResponse': 'Transmission antwortet nicht{detail}.',
      'path.home': 'Mein Ordner',

      'pick.destTitle': 'Ordner für Downloads',
      'pick.fileTitle': '.torrent-Datei auswählen',
      'pick.selected': 'Ausgewählt: {name}',
      'confirm.openFile': 'Möchten Sie die Datei „{name}“ jetzt zu Transmission hinzufügen?',

      'menu.torrent': 'Torrent',
      'menu.add': 'Torrent hinzufügen...',
      'menu.pauseAll': 'Alle anhalten',
      'menu.resumeAll': 'Alle fortsetzen',
      'menu.close': 'Schließen',
      'menu.edit': 'Bearbeiten',
      'menu.start': 'Starten',
      'menu.pause': 'Anhalten',
      'menu.remove': 'Löschen...',
      'menu.removeKbd': 'Entf',
      'menu.selectAll': 'Alle auswählen',
      'menu.view': 'Ansicht',
      'menu.refresh': 'Aktualisieren',
      'menu.light': 'Hell',
      'menu.dark': 'Dunkel',
      'menu.language': 'Sprache',
      'menu.help': 'Hilfe',
      'menu.about': 'Über Transmission'
    }
  };

  const LANG_NAMES = { pt: 'Português', en: 'English', de: 'Deutsch' };
  const STORAGE_KEY = 'transmission_lang';

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

  // Applies translations to static markup:
  //   data-i18n            -> textContent
  //   data-i18n-html       -> innerHTML (trusted strings only)
  //   data-i18n-title      -> title attribute
  //   data-i18n-placeholder-> placeholder attribute
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
