(function () {
  'use strict';

  const translations = {
    en: {
      'app.title': 'VideoPlayer',
      'app.tagline': 'ShareOS Cinema & Video Player',
      'btn.openFile': 'Open Video',
      'btn.openFolder': 'Open Folder',
      'btn.subtitles': 'Subtitles',
      'btn.audio': 'Audio Tracks',
      'btn.loadSub': 'Load External Subtitle...',
      'btn.subOff': 'Subtitles Off',
      'btn.prev': 'Previous Video',
      'btn.next': 'Next Video',
      'btn.play': 'Play',
      'btn.pause': 'Pause',
      'btn.stop': 'Stop & Return to List',
      'btn.mute': 'Mute',
      'btn.unmute': 'Unmute',
      'btn.fullscreen': 'Fullscreen',
      'btn.exitFullscreen': 'Exit Fullscreen',
      'btn.pip': 'Picture in Picture',
      'btn.aspect': 'Aspect Ratio',
      'btn.speed': 'Playback Speed',
      'btn.shortcuts': 'Shortcuts',
      'aspect.fit': 'Fit to Screen',
      'aspect.orig': 'Original Ratio',
      'aspect.wide': '16:9 Widescreen',
      'aspect.fill': 'Fill / Crop',
      'library.title': 'Media Library',
      'library.scan': 'Scan Folder',
      'library.search': 'Search videos...',
      'library.empty': 'No video files found in this folder.',
      'library.selectPrompt': 'Choose a folder or open a video to populate the library.',
      'library.currentFolder': 'Folder: {folder}',
      'library.count': '{count} videos',
      'empty.title': 'HTML5 Cinema Player',
      'empty.desc': 'Direct streaming from your ShareOS box with zero transcoding, fast seek, and automatic subtitle sync (.srt, .vtt).',
      'empty.btnBrowse': 'Open Video from Box',
      'empty.btnFolder': 'Open Media Folder',
      'empty.drop': 'or drop video & subtitle files here',
      'sub.detected': 'Auto-detected ({name})',
      'sub.active': 'Active: {name}',
      'sub.none': 'None (Off)',
      'sub.loaded': 'Subtitle loaded: {name}',
      'sub.custom': 'Custom Subtitle',
      'sub.size': 'Subtitle Size',
      'sub.sizeSmall': 'Small',
      'sub.sizeNormal': 'Normal',
      'sub.sizeLarge': 'Large',
      'audio.title': 'Audio Tracks',
      'audio.track': 'Track {num}',
      'audio.loadExternal': 'Load External Audio...',
      'audio.loaded': 'Audio track: {name}',
      'audio.default': 'Default Audio',
      'audio.flagHint': 'To switch embedded multi-audio in Edge/Chrome, enable this flag (click to copy) and restart browser:',
      'audio.flagCopied': 'Flag URL copied! Paste in the address bar, set to Enabled, and restart browser.',
      'toast.loading': 'Opening video...',
      'toast.error': 'Error loading video: ',
      'toast.unsupportedCodec': 'Video or audio format not supported by this browser. Tip: If this MKV uses AC3/DTS audio, use MediaTranscoder to remux to MP4/AAC in seconds without re-encoding.',
      'toast.subError': 'Error loading subtitle: ',
      'toast.noBoxAccess': 'No permission to access box files. Ask administrator to grant Files permission.',
      'help.title': 'Keyboard & Remote Shortcuts',
      'help.space': 'Play / Pause',
      'help.s': 'Stop & return to video list',
      'help.arrowsX': 'Seek backward / forward 5 seconds',
      'help.arrowsY': 'Volume up / down (5%)',
      'help.f': 'Toggle Fullscreen',
      'help.m': 'Toggle Mute',
      'help.c': 'Toggle Subtitles On / Off',
      'help.brackets': 'Decrease / Increase playback speed',
      'help.p': 'Toggle Picture-in-Picture',
      'help.n': 'Play Next video in playlist',
      'help.close': 'Close'
    },
    pt: {
      'app.title': 'VideoPlayer',
      'app.tagline': 'Player de Cinema e Vídeo para ShareOS',
      'btn.openFile': 'Abrir Vídeo',
      'btn.openFolder': 'Abrir Pasta',
      'btn.subtitles': 'Legendas',
      'btn.audio': 'Faixas de Áudio',
      'btn.loadSub': 'Carregar Legenda Externa...',
      'btn.subOff': 'Desativar Legendas',
      'btn.prev': 'Vídeo Anterior',
      'btn.next': 'Próximo Vídeo',
      'btn.play': 'Reproduzir',
      'btn.pause': 'Pausar',
      'btn.stop': 'Parar e Voltar à Lista',
      'btn.mute': 'Silenciar',
      'btn.unmute': 'Ativar Som',
      'btn.fullscreen': 'Tela Cheia',
      'btn.exitFullscreen': 'Sair da Tela Cheia',
      'btn.pip': 'Picture-in-Picture',
      'btn.aspect': 'Proporção de Tela',
      'btn.speed': 'Velocidade',
      'btn.shortcuts': 'Atalhos',
      'aspect.fit': 'Ajustar à Tela',
      'aspect.orig': 'Proporção Original',
      'aspect.wide': '16:9 Widescreen',
      'aspect.fill': 'Preencher / Cortar',
      'library.title': 'Biblioteca de Mídia',
      'library.scan': 'Escanear Pasta',
      'library.search': 'Buscar vídeos...',
      'library.empty': 'Nenhum arquivo de vídeo encontrado nesta pasta.',
      'library.selectPrompt': 'Escolha uma pasta ou abra um vídeo para listar os títulos.',
      'library.currentFolder': 'Pasta: {folder}',
      'library.count': '{count} vídeos',
      'empty.title': 'Player de Cinema HTML5',
      'empty.desc': 'Streaming direto da sua box ShareOS com zero transcodificação, navegação rápida e sincronização automática de legendas (.srt, .vtt).',
      'empty.btnBrowse': 'Abrir Vídeo na Box',
      'empty.btnFolder': 'Abrir Pasta de Mídia',
      'empty.drop': 'ou arraste arquivos de vídeo e legendas para cá',
      'sub.detected': 'Detectada automaticamente ({name})',
      'sub.active': 'Ativa: {name}',
      'sub.none': 'Nenhuma (Desativada)',
      'sub.loaded': 'Legenda carregada: {name}',
      'sub.custom': 'Legenda Personalizada',
      'sub.size': 'Tamanho da Legenda',
      'sub.sizeSmall': 'Pequeno',
      'sub.sizeNormal': 'Normal',
      'sub.sizeLarge': 'Grande',
      'audio.title': 'Faixas de Áudio',
      'audio.track': 'Faixa {num}',
      'audio.loadExternal': 'Carregar Áudio Externo...',
      'audio.loaded': 'Faixa de áudio: {name}',
      'audio.default': 'Áudio Padrão',
      'audio.flagHint': 'Para trocar faixas de áudio embutidas no Edge/Chrome, ative a flag abaixo (clique para copiar) e reinicie o navegador:',
      'audio.flagCopied': 'Copiado! Cole na barra de endereços, mude para Enabled e reinicie o navegador.',
      'toast.loading': 'Abrindo vídeo...',
      'toast.error': 'Erro ao carregar vídeo: ',
      'toast.unsupportedCodec': 'Formato de vídeo ou áudio não suportado por este navegador. Dica: Se este MKV usar áudio AC3/DTS, use o MediaTranscoder para remuxar para MP4/AAC em segundos sem recodificar o vídeo.',
      'toast.subError': 'Erro ao carregar legenda: ',
      'toast.noBoxAccess': 'Sem permissão para acessar os arquivos da box. O administrador pode habilitar em Usuários → Arquivos.',
      'help.title': 'Atalhos de Teclado e Controle',
      'help.space': 'Reproduzir / Pausar',
      'help.s': 'Parar e voltar à lista de vídeos',
      'help.arrowsX': 'Avançar / Voltar 5 segundos',
      'help.arrowsY': 'Aumentar / Diminuir volume (5%)',
      'help.f': 'Alternar Tela Cheia',
      'help.m': 'Alternar Mudo',
      'help.c': 'Ligar / Desligar Legendas',
      'help.brackets': 'Diminuir / Aumentar velocidade de reprodução',
      'help.p': 'Alternar Picture-in-Picture',
      'help.n': 'Próximo vídeo da lista',
      'help.close': 'Fechar'
    },
    de: {
      'app.title': 'VideoPlayer',
      'app.tagline': 'Kino- und Videoplayer für ShareOS',
      'btn.openFile': 'Video öffnen',
      'btn.openFolder': 'Ordner öffnen',
      'btn.subtitles': 'Untertitel',
      'btn.audio': 'Audiospuren',
      'btn.loadSub': 'Externe Untertitel laden...',
      'btn.subOff': 'Untertitel ausschalten',
      'btn.prev': 'Vorheriges Video',
      'btn.next': 'Nächstes Video',
      'btn.play': 'Wiedergabe',
      'btn.pause': 'Pause',
      'btn.stop': 'Stopp & Zurück zur Liste',
      'btn.mute': 'Stumm',
      'btn.unmute': 'Ton an',
      'btn.fullscreen': 'Vollbild',
      'btn.exitFullscreen': 'Vollbild beenden',
      'btn.pip': 'Bild-in-Bild',
      'btn.aspect': 'Seitenverhältnis',
      'btn.speed': 'Geschwindigkeit',
      'btn.shortcuts': 'Tastenkürzel',
      'aspect.fit': 'An Bildschirm anpassen',
      'aspect.orig': 'Originalformat',
      'aspect.wide': '16:9 Breitbild',
      'aspect.fill': 'Ausfüllen / Zuschneiden',
      'library.title': 'Medienbibliothek',
      'library.scan': 'Ordner scannen',
      'library.search': 'Videos suchen...',
      'library.empty': 'Keine Videodateien in diesem Ordner gefunden.',
      'library.selectPrompt': 'Wählen Sie einen Ordner oder öffnen Sie ein Video.',
      'library.currentFolder': 'Ordner: {folder}',
      'library.count': '{count} Videos',
      'empty.title': 'HTML5-Kinoplayer',
      'empty.desc': 'Direktes Streaming von Ihrer ShareOS-Box ohne Transkodierung, schnelles Spulen und automatische Untertitelsynchronisation (.srt, .vtt).',
      'empty.btnBrowse': 'Video von der Box öffnen',
      'empty.btnFolder': 'Medienordner öffnen',
      'empty.drop': 'oder Video- und Untertiteldateien hierher ziehen',
      'sub.detected': 'Automatisch erkannt ({name})',
      'sub.active': 'Aktiv: {name}',
      'sub.none': 'Keine (Aus)',
      'sub.loaded': 'Untertitel geladen: {name}',
      'sub.custom': 'Eigener Untertitel',
      'sub.size': 'Untertitelgröße',
      'sub.sizeSmall': 'Klein',
      'sub.sizeNormal': 'Normal',
      'sub.sizeLarge': 'Groß',
      'audio.title': 'Audiospuren',
      'audio.track': 'Spur {num}',
      'audio.loadExternal': 'Externe Audiospur laden...',
      'audio.loaded': 'Audiospur: {name}',
      'audio.default': 'Standard-Audio',
      'audio.flagHint': 'Für eingebettete Audiospuren in Edge/Chrome dieses Flag aktivieren (zum Kopieren klicken) und Browser neu starten:',
      'audio.flagCopied': 'Kopiert! In die Adressleiste einfügen, auf Enabled stellen und Browser neu starten.',
      'toast.loading': 'Video wird geöffnet...',
      'toast.error': 'Fehler beim Laden des Videos: ',
      'toast.unsupportedCodec': 'Video- oder Audioformat wird von diesem Browser nicht unterstützt. Tipp: Wenn diese MKV AC3/DTS-Audio nutzt, mit MediaTranscoder in Sekunden ohne Neukodierung in MP4/AAC packen.',
      'toast.subError': 'Fehler beim Laden des Untertitels: ',
      'toast.noBoxAccess': 'Kein Zugriff auf die Ordner der Box – der Administrator kann ihn unter Benutzer → „Dateien“ einschalten.',
      'help.title': 'Tastatur- und Fernbedienungskürzel',
      'help.space': 'Wiedergabe / Pause',
      'help.s': 'Stopp & zurück zur Videoliste',
      'help.arrowsX': '5 Sekunden vor- / zurückspulen',
      'help.arrowsY': 'Lautstärke erhöhen / verringern (5%)',
      'help.f': 'Vollbild umschalten',
      'help.m': 'Stummschaltung umschalten',
      'help.c': 'Untertitel ein- / ausschalten',
      'help.brackets': 'Wiedergabegeschwindigkeit verlangsamen / beschleunigen',
      'help.p': 'Bild-in-Bild umschalten',
      'help.n': 'Nächstes Video abspielen',
      'help.close': 'Schließen'
    }
  };

  let currentLang = 'en';

  function detectLang() {
    const sosLang = window.ShareOS && (ShareOS.lang || (ShareOS.user && ShareOS.user.lang));
    const nav = sosLang || navigator.language || navigator.userLanguage || 'en';
    const short = nav.slice(0, 2).toLowerCase();
    return translations[short] ? short : 'en';
  }

  function setLanguage(lang) {
    currentLang = translations[lang] ? lang : 'en';
    document.documentElement.lang = currentLang;
    applyDOM();
  }

  function t(key, params) {
    const dict = translations[currentLang] || translations.en;
    let str = dict[key] || translations.en[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
      }
    }
    return str;
  }

  function applyDOM(root = document) {
    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (k) el.textContent = t(k);
    });
    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const k = el.getAttribute('data-i18n-title');
      if (k) el.setAttribute('title', t(k));
    });
    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (k) el.setAttribute('placeholder', t(k));
    });
  }

  currentLang = detectLang();

  window.VPI18n = {
    t,
    setLanguage,
    getLanguage: () => currentLang,
    applyDOM
  };
})();

