// Syncthing for ShareOS – i18n (de / en / pt)
'use strict';

(function () {
  const SUPPORTED = ['de', 'en', 'pt'];
  const FALLBACK = 'en';
  const STORAGE_KEY = 'syncthing-lang';
  const LANG_NAMES = { de: 'Deutsch', en: 'English', pt: 'Português' };

  const STRINGS = {
    en: {
      'conn.checking': 'Connecting …', 'conn.online': '● Running', 'conn.offline': '○ Not reachable',
      'tb.folder': 'Folder', 'tb.device': 'Device', 'tb.myId': "This device's ID", 'tb.rescan': 'Rescan all', 'tb.settings': 'Settings',
      'h.folders': 'Folders', 'h.devices': 'Other devices',
      'menu.syncthing': 'Syncthing', 'menu.refresh': 'Refresh', 'menu.language': 'Language',
      'btn.accept': 'Accept …', 'btn.add': 'Add …', 'btn.cancel': 'Cancel', 'btn.choose': 'Choose …', 'btn.close': 'Close', 'btn.copy': 'Copy',
      'btn.edit': 'Edit', 'btn.ignore': 'Ignore', 'btn.override': 'Override changes', 'btn.pause': 'Pause', 'btn.remove': 'Remove',
      'btn.resume': 'Resume', 'btn.revert': 'Revert local changes', 'btn.save': 'Save', 'btn.scan': 'Rescan',
      'id.title': 'This device', 'id.hint': 'Add this ID on the other device – or scan the code with the Syncthing app on the phone.',
      'dev.add': 'Add device', 'dev.edit': 'Edit device', 'dev.id': 'Device ID', 'dev.name': 'Name', 'dev.addresses': 'Addresses',
      'dev.addrHint': '"dynamic" finds the device by itself; or e.g. tcp://192.168.1.20:22000',
      'dev.introducer': 'Introducer (take over the devices it knows)', 'dev.autoAccept': 'Accept its folders automatically (into the personal folder)',
      'dev.connected': 'connected', 'dev.disconnected': 'not connected', 'dev.relay': 'over a relay', 'dev.thisBox': 'this box',
      'dev.empty': 'No other devices yet. Add one with its device ID – and add the ID of this box there.',
      'fol.add': 'Add folder', 'fol.edit': 'Edit folder', 'fol.accept': 'Accept folder', 'fol.label': 'Name', 'fol.path': 'Folder on the box',
      'fol.pathHint': 'A folder that does not exist yet is created.', 'fol.id': 'Folder ID', 'fol.idHint': 'Must be the same on all devices.',
      'fol.type': 'Type', 'fol.versioning': 'Keep old versions', 'fol.share': 'Share with', 'fol.noDevices': 'Add a device first.',
      'fol.notShared': 'nobody yet', 'fol.sharedWith': 'Shared with', 'fol.outside': '(outside your folders)',
      'fol.size': '{files} files, {size}', 'fol.empty': 'No folders yet.',
      'type.sendreceive': 'Send & receive', 'type.sendonly': 'Send only', 'type.receiveonly': 'Receive only', 'type.receiveencrypted': 'Receive encrypted',
      'ver.none': 'No', 'ver.trashcan': 'Trash can (30 days)', 'ver.simple': 'Last 5 versions', 'ver.staggered': 'Staggered (up to a year)',
      'set.title': 'Settings', 'set.name': 'Name of this device', 'set.down': 'Download limit (KiB/s, 0 = none)', 'set.up': 'Upload limit (KiB/s, 0 = none)',
      'set.lan': 'Limits also in the home network', 'set.global': 'Find devices over the internet (global discovery)',
      'set.local': 'Find devices in the home network (local discovery)', 'set.relays': 'Relays when no direct connection is possible',
      'set.nat': 'Open the port on the router (UPnP/NAT-PMP)',
      'state.paused': 'paused', 'state.error': 'error', 'state.scanning': 'scanning', 'state.syncing': 'syncing {pct} %',
      'state.outOfSync': '{n} items missing', 'state.upToDate': 'up to date',
      'req.device': 'Device <b>{name}</b> ({addr}) wants to connect.', 'req.folder': '<b>{dev}</b> wants to share the folder <b>{label}</b>.',
      'toast.copied': 'Copied.', 'toast.scan': 'Rescan started.', 'toast.restarting': 'Syncthing restarts …',
      'confirm.removeFolder': 'Stop syncing "{name}"? The files stay on the box.', 'confirm.removeDevice': 'Remove the device "{name}"?',
      'confirm.revert': 'Undo the changes made here, so the folder matches the other devices again?',
      'confirm.override': 'Make the other devices take this folder as it is here?',
      'err.notInstalled': 'The system app "syncthing" is not installed – install it in the store.',
      'err.noPermission': 'Open this app from ShareOS (it needs the permissions "files" and "syncthing", ShareOS 0.2.0-beta.20+).',
      'err.connect': 'Syncthing does not answer: {msg}', 'err.badId': 'This is not a valid device ID.', 'err.ownId': 'That is the ID of this box.',
      'err.noPath': 'Choose a folder.'
    },
    de: {
      'conn.checking': 'Verbinde …', 'conn.online': '● Läuft', 'conn.offline': '○ Nicht erreichbar',
      'tb.folder': 'Ordner', 'tb.device': 'Gerät', 'tb.myId': 'ID dieses Geräts', 'tb.rescan': 'Alle neu einlesen', 'tb.settings': 'Einstellungen',
      'h.folders': 'Ordner', 'h.devices': 'Andere Geräte',
      'menu.syncthing': 'Syncthing', 'menu.refresh': 'Aktualisieren', 'menu.language': 'Sprache',
      'btn.accept': 'Annehmen …', 'btn.add': 'Hinzufügen …', 'btn.cancel': 'Abbrechen', 'btn.choose': 'Wählen …', 'btn.close': 'Schließen', 'btn.copy': 'Kopieren',
      'btn.edit': 'Bearbeiten', 'btn.ignore': 'Ignorieren', 'btn.override': 'Änderungen durchsetzen', 'btn.pause': 'Pausieren', 'btn.remove': 'Entfernen',
      'btn.resume': 'Fortsetzen', 'btn.revert': 'Lokale Änderungen zurücknehmen', 'btn.save': 'Speichern', 'btn.scan': 'Neu einlesen',
      'id.title': 'Dieses Gerät', 'id.hint': 'Trage diese ID auf dem anderen Gerät ein – oder scanne den Code mit der Syncthing-App auf dem Handy.',
      'dev.add': 'Gerät hinzufügen', 'dev.edit': 'Gerät bearbeiten', 'dev.id': 'Geräte-ID', 'dev.name': 'Name', 'dev.addresses': 'Adressen',
      'dev.addrHint': '„dynamic“ findet das Gerät von selbst; oder z. B. tcp://192.168.1.20:22000',
      'dev.introducer': 'Verteiler (übernimmt die Geräte, die es kennt)', 'dev.autoAccept': 'Seine Ordner automatisch annehmen (in den persönlichen Ordner)',
      'dev.connected': 'verbunden', 'dev.disconnected': 'nicht verbunden', 'dev.relay': 'über ein Relay', 'dev.thisBox': 'diese Box',
      'dev.empty': 'Noch keine anderen Geräte. Füge eines mit seiner Geräte-ID hinzu – und trage dort die ID dieser Box ein.',
      'fol.add': 'Ordner hinzufügen', 'fol.edit': 'Ordner bearbeiten', 'fol.accept': 'Ordner annehmen', 'fol.label': 'Name', 'fol.path': 'Ordner auf der Box',
      'fol.pathHint': 'Ein Ordner, den es noch nicht gibt, wird angelegt.', 'fol.id': 'Ordner-ID', 'fol.idHint': 'Muss auf allen Geräten gleich sein.',
      'fol.type': 'Art', 'fol.versioning': 'Alte Versionen behalten', 'fol.share': 'Teilen mit', 'fol.noDevices': 'Füge zuerst ein Gerät hinzu.',
      'fol.notShared': 'noch niemandem', 'fol.sharedWith': 'Geteilt mit', 'fol.outside': '(außerhalb deiner Ordner)',
      'fol.size': '{files} Dateien, {size}', 'fol.empty': 'Noch keine Ordner.',
      'type.sendreceive': 'Senden & empfangen', 'type.sendonly': 'Nur senden', 'type.receiveonly': 'Nur empfangen', 'type.receiveencrypted': 'Verschlüsselt empfangen',
      'ver.none': 'Nein', 'ver.trashcan': 'Papierkorb (30 Tage)', 'ver.simple': 'Letzte 5 Versionen', 'ver.staggered': 'Gestaffelt (bis zu einem Jahr)',
      'set.title': 'Einstellungen', 'set.name': 'Name dieses Geräts', 'set.down': 'Download-Grenze (KiB/s, 0 = keine)', 'set.up': 'Upload-Grenze (KiB/s, 0 = keine)',
      'set.lan': 'Grenzen auch im Heimnetz', 'set.global': 'Geräte über das Internet finden (globale Suche)',
      'set.local': 'Geräte im Heimnetz finden (lokale Suche)', 'set.relays': 'Relays, wenn keine direkte Verbindung möglich ist',
      'set.nat': 'Port am Router öffnen (UPnP/NAT-PMP)',
      'state.paused': 'pausiert', 'state.error': 'Fehler', 'state.scanning': 'liest ein', 'state.syncing': 'synchronisiert {pct} %',
      'state.outOfSync': '{n} Einträge fehlen', 'state.upToDate': 'aktuell',
      'req.device': 'Gerät <b>{name}</b> ({addr}) möchte sich verbinden.', 'req.folder': '<b>{dev}</b> möchte den Ordner <b>{label}</b> teilen.',
      'toast.copied': 'Kopiert.', 'toast.scan': 'Einlesen gestartet.', 'toast.restarting': 'Syncthing startet neu …',
      'confirm.removeFolder': '„{name}“ nicht mehr synchronisieren? Die Dateien bleiben auf der Box.', 'confirm.removeDevice': 'Gerät „{name}“ entfernen?',
      'confirm.revert': 'Die hier gemachten Änderungen zurücknehmen, damit der Ordner wieder den anderen Geräten entspricht?',
      'confirm.override': 'Sollen die anderen Geräte den Ordner so übernehmen, wie er hier ist?',
      'err.notInstalled': 'Die System-App „syncthing“ ist nicht installiert – installiere sie im Store.',
      'err.noPermission': 'Öffne diese App aus ShareOS (sie braucht die Berechtigungen „files“ und „syncthing“, ShareOS 0.2.0-beta.20+).',
      'err.connect': 'Syncthing antwortet nicht: {msg}', 'err.badId': 'Das ist keine gültige Geräte-ID.', 'err.ownId': 'Das ist die ID dieser Box.',
      'err.noPath': 'Wähle einen Ordner.'
    },
    pt: {
      'conn.checking': 'Conectando …', 'conn.online': '● Em execução', 'conn.offline': '○ Indisponível',
      'tb.folder': 'Pasta', 'tb.device': 'Dispositivo', 'tb.myId': 'ID deste dispositivo', 'tb.rescan': 'Reescanear tudo', 'tb.settings': 'Configurações',
      'h.folders': 'Pastas', 'h.devices': 'Outros dispositivos',
      'menu.syncthing': 'Syncthing', 'menu.refresh': 'Atualizar', 'menu.language': 'Idioma',
      'btn.accept': 'Aceitar …', 'btn.add': 'Adicionar …', 'btn.cancel': 'Cancelar', 'btn.choose': 'Escolher …', 'btn.close': 'Fechar', 'btn.copy': 'Copiar',
      'btn.edit': 'Editar', 'btn.ignore': 'Ignorar', 'btn.override': 'Impor alterações', 'btn.pause': 'Pausar', 'btn.remove': 'Remover',
      'btn.resume': 'Retomar', 'btn.revert': 'Desfazer alterações locais', 'btn.save': 'Salvar', 'btn.scan': 'Reescanear',
      'id.title': 'Este dispositivo', 'id.hint': 'Adicione este ID no outro dispositivo – ou escaneie o código com o app Syncthing no celular.',
      'dev.add': 'Adicionar dispositivo', 'dev.edit': 'Editar dispositivo', 'dev.id': 'ID do dispositivo', 'dev.name': 'Nome', 'dev.addresses': 'Endereços',
      'dev.addrHint': '"dynamic" encontra o dispositivo sozinho; ou p. ex. tcp://192.168.1.20:22000',
      'dev.introducer': 'Introdutor (adota os dispositivos que ele conhece)', 'dev.autoAccept': 'Aceitar suas pastas automaticamente (na pasta pessoal)',
      'dev.connected': 'conectado', 'dev.disconnected': 'desconectado', 'dev.relay': 'por um relay', 'dev.thisBox': 'esta caixa',
      'dev.empty': 'Ainda não há outros dispositivos. Adicione um pelo seu ID – e adicione lá o ID desta caixa.',
      'fol.add': 'Adicionar pasta', 'fol.edit': 'Editar pasta', 'fol.accept': 'Aceitar pasta', 'fol.label': 'Nome', 'fol.path': 'Pasta na caixa',
      'fol.pathHint': 'Uma pasta que ainda não existe é criada.', 'fol.id': 'ID da pasta', 'fol.idHint': 'Deve ser igual em todos os dispositivos.',
      'fol.type': 'Tipo', 'fol.versioning': 'Manter versões antigas', 'fol.share': 'Compartilhar com', 'fol.noDevices': 'Adicione primeiro um dispositivo.',
      'fol.notShared': 'ninguém ainda', 'fol.sharedWith': 'Compartilhada com', 'fol.outside': '(fora das suas pastas)',
      'fol.size': '{files} arquivos, {size}', 'fol.empty': 'Ainda não há pastas.',
      'type.sendreceive': 'Enviar e receber', 'type.sendonly': 'Só enviar', 'type.receiveonly': 'Só receber', 'type.receiveencrypted': 'Receber criptografado',
      'ver.none': 'Não', 'ver.trashcan': 'Lixeira (30 dias)', 'ver.simple': 'Últimas 5 versões', 'ver.staggered': 'Escalonado (até um ano)',
      'set.title': 'Configurações', 'set.name': 'Nome deste dispositivo', 'set.down': 'Limite de download (KiB/s, 0 = nenhum)', 'set.up': 'Limite de upload (KiB/s, 0 = nenhum)',
      'set.lan': 'Limites também na rede local', 'set.global': 'Encontrar dispositivos pela internet (descoberta global)',
      'set.local': 'Encontrar dispositivos na rede local (descoberta local)', 'set.relays': 'Relays quando não há conexão direta',
      'set.nat': 'Abrir a porta no roteador (UPnP/NAT-PMP)',
      'state.paused': 'pausada', 'state.error': 'erro', 'state.scanning': 'escaneando', 'state.syncing': 'sincronizando {pct} %',
      'state.outOfSync': 'faltam {n} itens', 'state.upToDate': 'atualizada',
      'req.device': 'O dispositivo <b>{name}</b> ({addr}) quer se conectar.', 'req.folder': '<b>{dev}</b> quer compartilhar a pasta <b>{label}</b>.',
      'toast.copied': 'Copiado.', 'toast.scan': 'Reescaneamento iniciado.', 'toast.restarting': 'O Syncthing está reiniciando …',
      'confirm.removeFolder': 'Parar de sincronizar "{name}"? Os arquivos ficam na caixa.', 'confirm.removeDevice': 'Remover o dispositivo "{name}"?',
      'confirm.revert': 'Desfazer as alterações feitas aqui, para que a pasta volte a corresponder aos outros dispositivos?',
      'confirm.override': 'Fazer os outros dispositivos adotarem a pasta como está aqui?',
      'err.notInstalled': 'O app de sistema "syncthing" não está instalado – instale-o na loja.',
      'err.noPermission': 'Abra este app pelo ShareOS (ele precisa das permissões "files" e "syncthing", ShareOS 0.2.0-beta.20+).',
      'err.connect': 'O Syncthing não responde: {msg}', 'err.badId': 'Este não é um ID de dispositivo válido.', 'err.ownId': 'Este é o ID desta caixa.',
      'err.noPath': 'Escolha uma pasta.'
    }
  };

  function detectLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) { }
    const candidates = [];
    if (window.ShareOS && typeof ShareOS.lang === 'string') candidates.push(ShareOS.lang);
    if (navigator.languages) candidates.push(...navigator.languages);
    for (const c of candidates) {
      const short = String(c).toLowerCase().split(/[-_]/)[0];
      if (SUPPORTED.includes(short)) return short;
    }
    return FALLBACK;
  }

  let lang = detectLang();

  function t(key, vars) {
    let s = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS[FALLBACK][key] ?? key;
    if (vars) for (const k in vars) s = s.split(`{${k}}`).join(vars[k]);
    return s;
  }

  function apply(root = document) {
    document.documentElement.lang = lang;
    root.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  }

  function setLang(l) {
    if (!SUPPORTED.includes(l)) return;
    lang = l;
    try { localStorage.setItem(STORAGE_KEY, l); } catch (e) { }
    apply();
  }

  window.I18N = { t, apply, setLang, get lang() { return lang; }, supported: SUPPORTED, names: LANG_NAMES };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => apply());
  else apply();
})();
