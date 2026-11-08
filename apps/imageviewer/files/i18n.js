(function () {
  'use strict';

  const translations = {
    en: {
      'app.title': 'ImageViewer',
      'app.tagline': 'ShareOS Cinema & Photo Viewer',
      'btn.openFile': 'Open Image',
      'btn.openFolder': 'Open Folder',
      'btn.prev': 'Previous Image',
      'btn.next': 'Next Image',
      'btn.zoomIn': 'Zoom In (+)',
      'btn.zoomOut': 'Zoom Out (-)',
      'btn.zoomFit': 'Fit to Screen (0)',
      'btn.zoomOrig': 'Actual Size 1:1 (1)',
      'btn.rotateRight': 'Rotate 90° CW (R)',
      'btn.rotateLeft': 'Rotate 90° CCW (L)',
      'btn.flipH': 'Flip Horizontal (H)',
      'btn.flipV': 'Flip Vertical (V)',
      'btn.slideshow': 'Slideshow (Space)',
      'btn.slideshowPause': 'Pause Slideshow',
      'btn.fullscreen': 'Fullscreen (F)',
      'btn.exitFullscreen': 'Exit Fullscreen',
      'btn.info': 'Image Details (I)',
      'btn.stop': 'Stop & Return to List (S)',
      'btn.shortcuts': 'Shortcuts',
      'library.title': 'Image Gallery',
      'library.scan': 'Scan Folder',
      'library.search': 'Search images...',
      'library.empty': 'No image files found in this folder.',
      'library.selectPrompt': 'Choose a folder or open an image to populate the gallery.',
      'library.currentFolder': 'Folder: {folder}',
      'library.count': '{count} images',
      'counter.info': '{current} / {total}',
      'empty.title': 'HTML5 Photo & Image Viewer',
      'empty.desc': 'Direct streaming from your ShareOS box with interactive zoom & pan, 90° rotation, horizontal/vertical flip, automated slideshow, and instant folder navigation.',
      'empty.btnBrowse': 'Open Image from Box',
      'empty.btnFolder': 'Open Photo Folder',
      'empty.drop': 'or drop image files here',
      'toast.loading': 'Loading image...',
      'toast.error': 'Error loading image: ',
      'toast.noBoxAccess': 'No permission to access box files. Ask administrator to grant Files permission.',
      'toast.slideshowStarted': 'Slideshow started (4s interval)',
      'toast.slideshowStopped': 'Slideshow paused',
      'help.title': 'Keyboard & Mouse Shortcuts',
      'help.arrowsX': 'Previous / Next image',
      'help.zoom': 'Zoom in / Zoom out',
      'help.wheel': 'Mouse wheel: Zoom in / Zoom out',
      'help.pan': 'Click & drag: Pan zoomed image',
      'help.fit': 'Fit image to viewport',
      'help.orig': 'Actual 1:1 pixel size (100%)',
      'help.rotR': 'Rotate 90° clockwise',
      'help.rotL': 'Rotate 90° counter-clockwise',
      'help.flipH': 'Flip horizontally (mirror)',
      'help.flipV': 'Flip vertically',
      'help.space': 'Start / Pause slideshow',
      'help.f': 'Toggle Fullscreen',
      'help.i': 'Toggle image details badge',
      'help.s': 'Stop & return to gallery list',
      'help.close': 'Close',
      'details.dimensions': 'Dimensions',
      'details.size': 'File Size',
      'details.format': 'Format',
      'details.zoom': 'Zoom Level'
    },
    pt: {
      'app.title': 'ImageViewer',
      'app.tagline': 'Visualizador de Fotos e Imagens para ShareOS',
      'btn.openFile': 'Abrir Imagem',
      'btn.openFolder': 'Abrir Pasta',
      'btn.prev': 'Imagem Anterior',
      'btn.next': 'Próxima Imagem',
      'btn.zoomIn': 'Aumentar Zoom (+)',
      'btn.zoomOut': 'Diminuir Zoom (-)',
      'btn.zoomFit': 'Ajustar à Tela (0)',
      'btn.zoomOrig': 'Tamanho Real 1:1 (1)',
      'btn.rotateRight': 'Girar 90° Horário (R)',
      'btn.rotateLeft': 'Girar 90° Anti-horário (L)',
      'btn.flipH': 'Espelhar Horizontal (H)',
      'btn.flipV': 'Espelhar Vertical (V)',
      'btn.slideshow': 'Apresentação de Slides (Espaço)',
      'btn.slideshowPause': 'Pausar Apresentação',
      'btn.fullscreen': 'Tela Cheia (F)',
      'btn.exitFullscreen': 'Sair da Tela Cheia',
      'btn.info': 'Detalhes da Imagem (I)',
      'btn.stop': 'Parar e Voltar à Lista (S)',
      'btn.shortcuts': 'Atalhos',
      'library.title': 'Galeria de Imagens',
      'library.scan': 'Escanear Pasta',
      'library.search': 'Buscar imagens...',
      'library.empty': 'Nenhuma imagem encontrada nesta pasta.',
      'library.selectPrompt': 'Escolha uma pasta ou abra uma foto para listar as imagens.',
      'library.currentFolder': 'Pasta: {folder}',
      'library.count': '{count} imagens',
      'counter.info': '{current} / {total}',
      'empty.title': 'Visualizador de Fotos e Imagens HTML5',
      'empty.desc': 'Streaming direto da sua box ShareOS com zoom e pan interativos, rotação 90°, espelhamento, apresentação automática de slides e navegação ágil por pastas.',
      'empty.btnBrowse': 'Abrir Imagem da Box',
      'empty.btnFolder': 'Abrir Pasta de Fotos',
      'empty.drop': 'ou arraste arquivos de imagem para cá',
      'toast.loading': 'Carregando imagem...',
      'toast.error': 'Erro ao carregar imagem: ',
      'toast.noBoxAccess': 'Sem permissão para acessar os arquivos da box. O administrador pode habilitar em Usuários → Arquivos.',
      'toast.slideshowStarted': 'Apresentação iniciada (intervalo de 4s)',
      'toast.slideshowStopped': 'Apresentação pausada',
      'help.title': 'Atalhos de Teclado e Mouse',
      'help.arrowsX': 'Imagem anterior / próxima',
      'help.zoom': 'Aumentar / Diminuir zoom',
      'help.wheel': 'Roda do mouse: Zoom in / Zoom out',
      'help.pan': 'Clique e arraste: Navegar pela foto com zoom',
      'help.fit': 'Ajustar imagem à tela',
      'help.orig': 'Tamanho real 1:1 (100% dos pixels)',
      'help.rotR': 'Girar 90° sentido horário',
      'help.rotL': 'Girar 90° sentido anti-horário',
      'help.flipH': 'Espelhar horizontalmente',
      'help.flipV': 'Espelhar verticalmente',
      'help.space': 'Iniciar / Pausar apresentação de slides',
      'help.f': 'Alternar Tela Cheia',
      'help.i': 'Exibir / Ocultar detalhes da foto',
      'help.s': 'Parar e voltar à lista da galeria',
      'help.close': 'Fechar',
      'details.dimensions': 'Dimensões',
      'details.size': 'Tamanho',
      'details.format': 'Formato',
      'details.zoom': 'Nível de Zoom'
    },
    de: {
      'app.title': 'ImageViewer',
      'app.tagline': 'Foto- und Bildbetrachter für ShareOS',
      'btn.openFile': 'Bild öffnen',
      'btn.openFolder': 'Ordner öffnen',
      'btn.prev': 'Vorheriges Bild',
      'btn.next': 'Nächstes Bild',
      'btn.zoomIn': 'Vergrößern (+)',
      'btn.zoomOut': 'Verkleinern (-)',
      'btn.zoomFit': 'An Bildschirm anpassen (0)',
      'btn.zoomOrig': 'Originalgröße 1:1 (1)',
      'btn.rotateRight': '90° im Uhrzeigersinn drehen (R)',
      'btn.rotateLeft': '90° gegen Uhrzeigersinn drehen (L)',
      'btn.flipH': 'Horizontal spiegeln (H)',
      'btn.flipV': 'Vertikal spiegeln (V)',
      'btn.slideshow': 'Diashow starten (Leertaste)',
      'btn.slideshowPause': 'Diashow anhalten',
      'btn.fullscreen': 'Vollbild (F)',
      'btn.exitFullscreen': 'Vollbild beenden',
      'btn.info': 'Bilddetails (I)',
      'btn.stop': 'Stopp & Zurück zur Liste (S)',
      'btn.shortcuts': 'Tastenkürzel',
      'library.title': 'Bildergalerie',
      'library.scan': 'Ordner scannen',
      'library.search': 'Bilder suchen...',
      'library.empty': 'Keine Bilddateien in diesem Ordner gefunden.',
      'library.selectPrompt': 'Wählen Sie einen Ordner oder öffnen Sie ein Bild.',
      'library.currentFolder': 'Ordner: {folder}',
      'library.count': '{count} Bilder',
      'counter.info': '{current} / {total}',
      'empty.title': 'HTML5-Foto- und Bildbetrachter',
      'empty.desc': 'Direktes Streaming von Ihrer ShareOS-Box mit interaktivem Zoom & Schwenken, 90°-Drehung, Spiegelung, automatischer Diashow und schneller Ordnernavigation.',
      'empty.btnBrowse': 'Bild von der Box öffnen',
      'empty.btnFolder': 'Foto-Ordner öffnen',
      'empty.drop': 'oder Bilddateien hierher ziehen',
      'toast.loading': 'Bild wird geladen...',
      'toast.error': 'Fehler beim Laden des Bildes: ',
      'toast.noBoxAccess': 'Kein Zugriff auf die Ordner der Box – der Administrator kann ihn unter Benutzer → „Dateien“ einschalten.',
      'toast.slideshowStarted': 'Diashow gestartet (4s Intervall)',
      'toast.slideshowStopped': 'Diashow angehalten',
      'help.title': 'Tastatur- und Mauskürzel',
      'help.arrowsX': 'Vorheriges / Nächstes Bild',
      'help.zoom': 'Vergrößern / Verkleinern',
      'help.wheel': 'Mausrad: Vergrößern / Verkleinern',
      'help.pan': 'Klicken & Ziehen: Gezoomtes Bild verschieben',
      'help.fit': 'Bild an Fenster anpassen',
      'help.orig': 'Originale 1:1 Pixelgröße (100%)',
      'help.rotR': '90° im Uhrzeigersinn drehen',
      'help.rotL': '90° gegen Uhrzeigersinn drehen',
      'help.flipH': 'Horizontal spiegeln',
      'help.flipV': 'Vertikal spiegeln',
      'help.space': 'Diashow starten / pausieren',
      'help.f': 'Vollbild umschalten',
      'help.i': 'Bilddetails ein- / ausblenden',
      'help.s': 'Stopp & zurück zur Galerieliste',
      'help.close': 'Schließen',
      'details.dimensions': 'Abmessungen',
      'details.size': 'Dateigröße',
      'details.format': 'Format',
      'details.zoom': 'Zoom-Stufe'
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

  window.IVI18n = {
    t,
    setLanguage,
    getLanguage: () => currentLang,
    applyDOM
  };
})();
