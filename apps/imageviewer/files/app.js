(function () {
  'use strict';

  const t = window.IVI18n ? window.IVI18n.t : (k) => k;
  const getSOS = () => window.ShareOS || null;
  const SOS = {
    get file() { return window.ShareOS && window.ShareOS.file; },
    get fs() { return window.ShareOS && window.ShareOS.fs; }
  };

  const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp', '.ico', '.avif'];

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  const mainImage = $('main-image');
  const stage = $('image-stage');
  const transformContainer = $('transform-container');
  const emptyScreen = $('empty-screen');
  const overlay = $('controls-overlay');
  const sidebar = $('sidebar');
  const playlistContainer = $('playlist-container');
  const searchInput = $('library-search');
  const folderNameLabel = $('folder-name-label');
  const imageCountLabel = $('image-count-label');
  const counterDisplay = $('counter-display');
  const zoomText = $('zoom-text');
  const centerIndicator = $('center-indicator');
  const centerText = $('center-text');
  const imageMetaBadge = $('image-meta-badge');
  const badgeFilename = $('badge-filename');
  const badgeDims = $('badge-dims');
  const badgeSize = $('badge-size');

  // Controls Elements
  const btnPrev = $('btn-prev');
  const btnNext = $('btn-next');
  const btnStagePrev = $('btn-stage-prev');
  const btnStageNext = $('btn-stage-next');
  const btnSlideshow = $('btn-slideshow');
  const iconSlidePlay = $('icon-slide-play');
  const iconSlidePause = $('icon-slide-pause');
  const btnStop = $('btn-stop');
  const btnZoomIn = $('btn-zoom-in');
  const btnZoomOut = $('btn-zoom-out');
  const btnZoomLevel = $('btn-zoom-level');
  const btnZoomOrig = $('btn-zoom-orig');
  const btnRotateLeft = $('btn-rotate-left');
  const btnRotateRight = $('btn-rotate-right');
  const btnFlipH = $('btn-flip-h');
  const btnInfo = $('btn-info');
  const btnFullscreen = $('btn-fullscreen');
  const iconFsEnter = $('icon-fs-enter');
  const iconFsExit = $('icon-fs-exit');

  // App State
  let playlist = [];
  let currentIndex = -1;
  let currentFolder = { root: '', path: '' };
  let currentFolderEntries = null;
  let currentImageBlobUrl = null;

  // Transform State
  let scale = 1;
  let fitScale = 1;
  let isFitMode = true;
  let panX = 0;
  let panY = 0;
  let rotation = 0; // 0, 90, 180, 270
  let flipH = false;
  let flipV = false;

  // Interaction State
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let initialPanX = 0;
  let initialPanY = 0;
  let autohideTimer = null;
  let centerFlashTimer = null;
  let isSlideshowActive = false;
  let slideshowTimer = null;
  const SLIDESHOW_INTERVAL_MS = 4000;

  // Touch State
  let touchStartDist = 0;
  let touchStartScale = 1;
  let touchStartX = 0;
  let touchStartY = 0;
  let lastTapTime = 0;

  // Initialize
  function init() {
    window.IVI18n.applyDOM();
    if (window.innerWidth <= 768) {
      sidebar.classList.add('collapsed');
    }
    updateSidebarToggleIcon();
    bindEvents();
    checkOpenedFile();
  }

  // Bind Events
  function bindEvents() {
    // Header actions
    $('btn-hdr-open').addEventListener('click', openImageFile);
    $('btn-hdr-folder').addEventListener('click', openFolderPicker);
    $('btn-empty-browse').addEventListener('click', openImageFile);
    $('btn-empty-folder').addEventListener('click', openFolderPicker);
    $('btn-scan-folder').addEventListener('click', () => {
      if (currentFolder.root) loadFolder(currentFolder.root, currentFolder.path);
      else openFolderPicker();
    });

    // Sidebar Toggle
    $('btn-toggle-sidebar').addEventListener('click', toggleSidebar);
    if ($('btn-hdr-sidebar')) {
      $('btn-hdr-sidebar').addEventListener('click', toggleSidebar);
    }
    if ($('sidebar-backdrop')) {
      $('sidebar-backdrop').addEventListener('click', () => {
        sidebar.classList.add('collapsed');
        updateSidebarToggleIcon();
      });
    }

    // Search filter
    searchInput.addEventListener('input', filterPlaylist);

    // Image Stage Navigation
    btnPrev.addEventListener('click', showPrevImage);
    btnNext.addEventListener('click', showNextImage);
    btnStagePrev.addEventListener('click', showPrevImage);
    btnStageNext.addEventListener('click', showNextImage);
    btnStop.addEventListener('click', stopViewer);

    // Transform actions
    btnZoomIn.addEventListener('click', () => zoomByStep(1.25));
    btnZoomOut.addEventListener('click', () => zoomByStep(0.8));
    btnZoomLevel.addEventListener('click', resetToFit);
    btnZoomOrig.addEventListener('click', setActualSize);
    btnRotateLeft.addEventListener('click', rotateCounterClockwise);
    btnRotateRight.addEventListener('click', rotateClockwise);
    btnFlipH.addEventListener('click', toggleFlipHorizontal);
    btnSlideshow.addEventListener('click', toggleSlideshow);
    btnInfo.addEventListener('click', toggleInfoBadge);
    btnFullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Pointer / Mouse events for Pan & Zoom
    transformContainer.addEventListener('wheel', onWheelZoom, { passive: false });
    transformContainer.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);

    // Touch events (Pinch-to-zoom & Swipe)
    transformContainer.addEventListener('touchstart', onTouchStart, { passive: false });
    transformContainer.addEventListener('touchmove', onTouchMove, { passive: false });
    transformContainer.addEventListener('touchend', onTouchEnd);

    // Autohide controls on inactivity
    stage.addEventListener('mousemove', onStageMouseMove);
    stage.addEventListener('pointerdown', resetAutohide);
    overlay.addEventListener('mouseenter', () => clearTimeout(autohideTimer));

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Help modal
    $('btn-hdr-help').addEventListener('click', () => $('modal-help').style.display = 'flex');
    $('btn-help-close').addEventListener('click', () => $('modal-help').style.display = 'none');
    $('btn-help-ok').addEventListener('click', () => $('modal-help').style.display = 'none');
    $('modal-help').addEventListener('click', (e) => {
      if (e.target === $('modal-help')) $('modal-help').style.display = 'none';
    });

    // Window resize: recompute fit
    window.addEventListener('resize', onWindowResize);

    // Drag and Drop files
    setupDragAndDrop();

    // Local inputs fallback
    $('local-image-input').addEventListener('change', onLocalImageSelected);
  }

  // Check if opened from ShareOS file manager (?file=ticket)
  async function checkOpenedFile() {
    const q = new URLSearchParams(location.search);
    const ticket = q.get('file');
    if (!ticket) return;

    const sos = getSOS();
    let name = 'Image';
    let url = '/_shareos/cgi/file?t=' + encodeURIComponent(ticket);
    let size = 0;

    if (sos && sos.file) {
      try {
        await sos.file.info();
        if (sos.file.name) name = sos.file.name;
        if (sos.file.url) url = sos.file.url;
        if (sos.file.size) size = sos.file.size;
      } catch (err) {
        console.warn('ShareOS.file.info() error:', err);
      }
    } else {
      const parts = ticket.split('/');
      const last = parts[parts.length - 1];
      if (last && last.length < 150) {
        try {
          name = decodeURIComponent(last);
        } catch (_) {
          name = last;
        }
      }
    }

    document.title = name + ' – ImageViewer';
    currentFolder = { root: '', path: '' };
    updateFolderLabels();
    playlist = [{ name, root: '', path: '', url, size }];
    renderPlaylist();

    // Auto-collapse sidebar when a single image is opened (keeps full stage focused)
    sidebar.classList.add('collapsed');
    updateSidebarToggleIcon();

    showImageAtIndex(0);
  }

  // Open Image File Picker
  async function openImageFile() {
    const sos = getSOS();
    if (sos && sos.fs && sos.fs.pick) {
      try {
        const picked = await sos.fs.pick({
          title: t('btn.openFile'),
          ext: IMAGE_EXTS,
          multiple: true
        });
        if (picked && picked.length) {
          playlist = [];
          for (const p of picked) {
            playlist.push({
              name: p.name,
              root: p.root,
              path: p.path || '',
              size: p.size || 0
            });
          }
          currentFolder = { root: picked[0].root, path: picked[0].path || '' };
          updateFolderLabels();
          renderPlaylist();
          if (playlist.length <= 1) {
            sidebar.classList.add('collapsed');
            updateSidebarToggleIcon();
          }
          showImageAtIndex(0);
        }
      } catch (err) {
        toast(t('toast.error') + err.message, true);
      }
    } else {
      $('local-image-input').click();
    }
  }

  // Open Folder Picker
  async function openFolderPicker() {
    const sos = getSOS();
    if (sos && sos.fs && sos.fs.pick) {
      try {
        const picked = await sos.fs.pick({
          title: t('btn.openFolder'),
          folder: true
        });
        if (picked && picked[0]) {
          loadFolder(picked[0].root, picked[0].path || '');
        }
      } catch (err) {
        toast(t('toast.error') + err.message, true);
      }
    } else {
      $('local-image-input').click();
    }
  }

  // Load Folder contents and populate gallery
  async function loadFolder(root, path) {
    const sos = getSOS();
    if (!sos || !sos.fs) {
      toast(t('toast.noBoxAccess'), true);
      return;
    }
    toast(t('toast.loading'));
    try {
      const list = await sos.fs.list(root, path);
      currentFolder = { root, path };
      currentFolderEntries = list && list.entries ? list.entries : [];
      playlist = [];

      if (list && list.entries) {
        const files = list.entries.filter((e) => {
          if (e.type !== 'file') return false;
          const lower = e.name.toLowerCase();
          return IMAGE_EXTS.some((ext) => lower.endsWith(ext));
        }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

        for (const f of files) {
          playlist.push({
            name: f.name,
            root,
            path,
            size: f.size || 0
          });
        }
      }

      updateFolderLabels();
      renderPlaylist();

      if (playlist.length > 0) {
        if (playlist.length > 1 && window.innerWidth > 768) {
          sidebar.classList.remove('collapsed');
          updateSidebarToggleIcon();
        }
        showImageAtIndex(0);
      } else {
        toast(t('library.empty'), false);
      }
    } catch (err) {
      toast(t('toast.error') + err.message, true);
    }
  }

  function updateFolderLabels() {
    const p = currentFolder.path ? currentFolder.root + '/' + currentFolder.path : currentFolder.root;
    folderNameLabel.textContent = p || '–';
    folderNameLabel.title = p || '';
    imageCountLabel.textContent = t('library.count', { count: playlist.length });
  }

  // Render Playlist in Sidebar
  function renderPlaylist() {
    playlistContainer.innerHTML = '';
    const query = searchInput.value.toLowerCase().trim();
    const filtered = playlist.map((item, idx) => ({ ...item, originalIndex: idx }))
      .filter((item) => !query || item.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
      playlistContainer.innerHTML = `<div class="playlist-empty">${query ? t('library.empty') : t('library.selectPrompt')}</div>`;
      return;
    }

    const frag = document.createDocumentFragment();
    filtered.forEach((item) => {
      const div = document.createElement('div');
      div.className = 'playlist-item' + (item.originalIndex === currentIndex ? ' active' : '');
      div.innerHTML = `
        <div class="item-thumb-box">
          <svg class="item-thumb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <circle cx="8.5" cy="8.5" r="1.5"></circle>
            <polyline points="21 15 16 10 5 21"></polyline>
          </svg>
        </div>
        <div class="item-info">
          <div class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="item-size">${formatBytes(item.size)}</div>
        </div>
      `;
      div.addEventListener('click', () => showImageAtIndex(item.originalIndex));
      frag.appendChild(div);
    });
    playlistContainer.appendChild(frag);
  }

  function filterPlaylist() {
    renderPlaylist();
  }

  // Display Image by Index
  async function showImageAtIndex(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    const item = playlist[currentIndex];

    // Highlight active in sidebar
    renderPlaylist();

    // Auto-collapse sidebar if single image or mobile
    if (playlist.length <= 1 || window.innerWidth <= 768) {
      sidebar.classList.add('collapsed');
      updateSidebarToggleIcon();
    }

    // Hide empty screen
    emptyScreen.style.display = 'none';

    // Update Counter Display
    counterDisplay.textContent = t('counter.info', {
      current: currentIndex + 1,
      total: playlist.length
    });

    // Clean up previous blob URL if any
    if (currentImageBlobUrl) {
      URL.revokeObjectURL(currentImageBlobUrl);
      currentImageBlobUrl = null;
    }

    // Get stream URL
    let streamUrl = item.url;
    const sos = getSOS();
    if (!streamUrl && sos && sos.fs) {
      try {
        const handle = await sos.fs.open(item.root, item.path || '', item.name);
        streamUrl = handle.url;
        item.url = streamUrl;
      } catch (err) {
        toast(t('toast.error') + err.message, true);
        return;
      }
    }

    if (!streamUrl) {
      toast(t('toast.error') + 'URL not found', true);
      return;
    }

    // Reset transform state for new photo
    resetTransformState();

    // Load Image
    mainImage.style.display = 'none';
    mainImage.onload = () => {
      mainImage.style.display = 'block';
      calculateFitScale();
      applyTransform();
      updateMetaBadge(item);
      resetAutohide();
    };
    mainImage.onerror = () => {
      toast(t('toast.error') + item.name, true);
    };
    mainImage.src = streamUrl;
  }

  // Calculate Fit-To-Screen Scale
  function calculateFitScale() {
    if (!mainImage.naturalWidth || !mainImage.naturalHeight) return;
    const stageWidth = stage.clientWidth || window.innerWidth;
    const stageHeight = stage.clientHeight || (window.innerHeight - 48);

    const isRotated90 = (rotation === 90 || rotation === 270);
    const naturalW = isRotated90 ? mainImage.naturalHeight : mainImage.naturalWidth;
    const naturalH = isRotated90 ? mainImage.naturalWidth : mainImage.naturalHeight;

    const scaleX = (stageWidth * 0.96) / naturalW;
    const scaleY = (stageHeight * 0.94) / naturalH;
    fitScale = Math.min(scaleX, scaleY, 1.0); // Never upscale past 100% in fit mode

    if (isFitMode) {
      scale = fitScale;
      panX = 0;
      panY = 0;
    }
  }

  // Reset transforms to defaults
  function resetTransformState() {
    isFitMode = true;
    rotation = 0;
    flipH = false;
    flipV = false;
    panX = 0;
    panY = 0;
    scale = 1;
  }

  function resetToFit() {
    isFitMode = true;
    panX = 0;
    panY = 0;
    calculateFitScale();
    scale = fitScale;
    applyTransform();
    flashCenter(t('btn.zoomFit'));
  }

  function setActualSize() {
    isFitMode = false;
    scale = 1.0;
    panX = 0;
    panY = 0;
    applyTransform();
    flashCenter('100%');
  }

  // Zoom by multiplier step (e.g. 1.25, 0.8)
  function zoomByStep(factor, clientCenterX = null, clientCenterY = null) {
    isFitMode = false;
    const prevScale = scale;
    scale = Math.max(0.08, Math.min(25.0, scale * factor));

    if (clientCenterX !== null && clientCenterY !== null) {
      const rect = transformContainer.getBoundingClientRect();
      const originX = clientCenterX - rect.left - rect.width / 2;
      const originY = clientCenterY - rect.top - rect.height / 2;
      panX = originX - (originX - panX) * (scale / prevScale);
      panY = originY - (originY - panY) * (scale / prevScale);
    }

    applyTransform();
    flashCenter(Math.round(scale * 100) + '%');
  }

  // Wheel Zoom (smooth & mouse-centered)
  function onWheelZoom(e) {
    if (!mainImage.src || emptyScreen.style.display !== 'none') return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    zoomByStep(factor, e.clientX, e.clientY);
  }

  // Pointer Pan Events
  function onPointerDown(e) {
    if (!mainImage.src || emptyScreen.style.display !== 'none') return;
    if (e.button !== 0) return; // Only left mouse button

    // Double tap / click detection
    const now = Date.now();
    if (now - lastTapTime < 280) {
      if (Math.abs(scale - fitScale) < 0.05) {
        setActualSize();
      } else {
        resetToFit();
      }
      lastTapTime = 0;
      return;
    }
    lastTapTime = now;

    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    initialPanX = panX;
    initialPanY = panY;

    transformContainer.classList.add('grabbing');
    resetAutohide();
  }

  function onPointerMove(e) {
    if (!isDragging) return;
    isFitMode = false;
    panX = initialPanX + (e.clientX - dragStartX);
    panY = initialPanY + (e.clientY - dragStartY);
    applyTransform();
  }

  function onPointerUp() {
    if (isDragging) {
      isDragging = false;
      transformContainer.classList.remove('grabbing');
    }
  }

  // Touch gesture handling
  function onTouchStart(e) {
    if (e.touches.length === 2) {
      // Pinch to zoom
      touchStartDist = getTouchDist(e.touches);
      touchStartScale = scale;
      isDragging = false;
    } else if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      initialPanX = panX;
      initialPanY = panY;
      isDragging = true;
    }
  }

  function onTouchMove(e) {
    if (e.touches.length === 2 && touchStartDist > 0) {
      e.preventDefault();
      const currentDist = getTouchDist(e.touches);
      const ratio = currentDist / touchStartDist;
      scale = Math.max(0.08, Math.min(25.0, touchStartScale * ratio));
      isFitMode = false;
      applyTransform();
    } else if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - touchStartX;
      const dy = e.touches[0].clientY - touchStartY;
      if (scale > fitScale * 1.05) {
        e.preventDefault();
        panX = initialPanX + dx;
        panY = initialPanY + dy;
        applyTransform();
      }
    }
  }

  function onTouchEnd(e) {
    if (e.touches.length === 0) {
      touchStartDist = 0;
      isDragging = false;
      // Detect single swipe if not zoomed in
      if (scale <= fitScale * 1.05) {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - touchStartX;
        const dy = touch.clientY - touchStartY;
        if (Math.abs(dx) > 60 && Math.abs(dy) < 50) {
          if (dx < 0) showNextImage();
          else showPrevImage();
        }
      }
    }
  }

  function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }

  // Rotation & Flip
  function rotateClockwise() {
    rotation = (rotation + 90) % 360;
    if (isFitMode) calculateFitScale();
    applyTransform();
    flashCenter(rotation + '°');
  }

  function rotateCounterClockwise() {
    rotation = (rotation + 270) % 360;
    if (isFitMode) calculateFitScale();
    applyTransform();
    flashCenter(rotation + '°');
  }

  function toggleFlipHorizontal() {
    flipH = !flipH;
    applyTransform();
    flashCenter(t('btn.flipH'));
  }

  // Apply CSS transforms to image
  function applyTransform() {
    const scaleFactor = Math.max(0.01, scale);
    const trans = `translate(${panX}px, ${panY}px) rotate(${rotation}deg) scale(${flipH ? -scaleFactor : scaleFactor}, ${flipV ? -scaleFactor : scaleFactor})`;
    mainImage.style.transform = trans;

    // Update zoom label in controls
    if (isFitMode) {
      zoomText.textContent = 'Fit';
      transformContainer.classList.remove('grabbable');
    } else {
      zoomText.textContent = Math.round(scale * 100) + '%';
      transformContainer.classList.add('grabbable');
    }
  }

  // Update Meta Badge Info
  function updateMetaBadge(item) {
    badgeFilename.textContent = item.name || 'Image';
    const dims = (mainImage.naturalWidth && mainImage.naturalHeight)
      ? `${mainImage.naturalWidth} × ${mainImage.naturalHeight}`
      : '–';
    badgeDims.textContent = dims;
    badgeSize.textContent = formatBytes(item.size);
  }

  function toggleInfoBadge() {
    imageMetaBadge.classList.toggle('hidden');
    btnInfo.classList.toggle('active', !imageMetaBadge.classList.contains('hidden'));
  }

  // Slideshow
  function toggleSlideshow() {
    if (isSlideshowActive) {
      stopSlideshow();
    } else {
      startSlideshow();
    }
  }

  function startSlideshow() {
    if (playlist.length <= 1) return;
    isSlideshowActive = true;
    iconSlidePlay.style.display = 'none';
    iconSlidePause.style.display = 'inline';
    btnSlideshow.classList.add('active');
    btnSlideshow.setAttribute('title', t('btn.slideshowPause'));
    toast(t('toast.slideshowStarted'));

    clearInterval(slideshowTimer);
    slideshowTimer = setInterval(() => {
      showNextImage(true);
    }, SLIDESHOW_INTERVAL_MS);
  }

  function stopSlideshow() {
    isSlideshowActive = false;
    clearInterval(slideshowTimer);
    slideshowTimer = null;
    iconSlidePlay.style.display = 'inline';
    iconSlidePause.style.display = 'none';
    btnSlideshow.classList.remove('active');
    btnSlideshow.setAttribute('title', t('btn.slideshow'));
    toast(t('toast.slideshowStopped'));
  }

  // Navigation: Next / Previous
  function showNextImage(isLoop = false) {
    if (playlist.length === 0) return;
    if (currentIndex < playlist.length - 1) {
      showImageAtIndex(currentIndex + 1);
    } else if (isLoop) {
      showImageAtIndex(0);
    }
  }

  function showPrevImage() {
    if (currentIndex > 0) {
      showImageAtIndex(currentIndex - 1);
    } else if (playlist.length > 1) {
      showImageAtIndex(playlist.length - 1);
    }
  }

  // Stop & Reset Viewer
  function stopViewer() {
    stopSlideshow();
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }

    if (currentImageBlobUrl) {
      URL.revokeObjectURL(currentImageBlobUrl);
      currentImageBlobUrl = null;
    }

    mainImage.removeAttribute('src');
    mainImage.style.display = 'none';
    currentIndex = -1;
    counterDisplay.textContent = '0 / 0';

    clearTimeout(autohideTimer);
    overlay.classList.remove('autohide');

    emptyScreen.style.display = 'flex';
    if (playlist.length > 1 && window.innerWidth > 768) {
      sidebar.classList.remove('collapsed');
      updateSidebarToggleIcon();
    }
    renderPlaylist();
  }

  // Fullscreen
  function toggleFullscreen() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      if (stage.requestFullscreen) stage.requestFullscreen();
      else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  function onFullscreenChange() {
    const isFs = !!document.fullscreenElement;
    iconFsEnter.style.display = isFs ? 'none' : 'inline';
    iconFsExit.style.display = isFs ? 'inline' : 'none';
    calculateFitScale();
    applyTransform();
  }

  function onWindowResize() {
    if (isFitMode) {
      calculateFitScale();
      applyTransform();
    }
  }

  // Autohide controls on inactivity
  function onStageMouseMove() {
    resetAutohide();
  }

  function resetAutohide() {
    overlay.classList.remove('autohide');
    clearTimeout(autohideTimer);
    if (emptyScreen.style.display === 'none') {
      autohideTimer = setTimeout(() => {
        overlay.classList.add('autohide');
      }, 3500);
    }
  }

  // Center Indicator Flash
  function flashCenter(text) {
    centerText.textContent = text;
    centerIndicator.classList.add('flash');
    clearTimeout(centerFlashTimer);
    centerFlashTimer = setTimeout(() => {
      centerIndicator.classList.remove('flash');
    }, 800);
  }

  // Sidebar Drawer Toggle
  function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    updateSidebarToggleIcon();
  }

  function updateSidebarToggleIcon() {
    const icon = $('icon-toggle-sidebar');
    if (!icon) return;
    if (sidebar.classList.contains('collapsed')) {
      icon.innerHTML = `
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      `;
    } else {
      icon.innerHTML = `
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      `;
    }
  }

  // Keyboard Shortcuts
  function onKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'ArrowRight':
      case 'Right':
        e.preventDefault();
        showNextImage();
        break;
      case 'ArrowLeft':
      case 'Left':
        e.preventDefault();
        showPrevImage();
        break;
      case '+':
      case '=':
        e.preventDefault();
        zoomByStep(1.25);
        break;
      case '-':
      case '_':
        e.preventDefault();
        zoomByStep(0.8);
        break;
      case '0':
        e.preventDefault();
        resetToFit();
        break;
      case '1':
        e.preventDefault();
        setActualSize();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        rotateClockwise();
        break;
      case 'l':
      case 'L':
        e.preventDefault();
        rotateCounterClockwise();
        break;
      case 'h':
      case 'H':
        e.preventDefault();
        toggleFlipHorizontal();
        break;
      case ' ':
        e.preventDefault();
        toggleSlideshow();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'i':
      case 'I':
        e.preventDefault();
        toggleInfoBadge();
        break;
      case 's':
      case 'S':
      case 'Escape':
        e.preventDefault();
        if ($('modal-help').style.display === 'flex') {
          $('modal-help').style.display = 'none';
        } else {
          stopViewer();
        }
        break;
    }
  }

  // Drag and Drop files
  function setupDragAndDrop() {
    const dropTarget = document.body;

    ['dragenter', 'dragover'].forEach((ev) => {
      dropTarget.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ['dragleave', 'drop'].forEach((ev) => {
      dropTarget.addEventListener(ev, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    dropTarget.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (!files || !files.length) return;

      const imgFiles = Array.from(files).filter((f) => {
        const lower = f.name.toLowerCase();
        return IMAGE_EXTS.some((ext) => lower.endsWith(ext));
      });

      if (imgFiles.length > 0) {
        playlist = [];
        for (const f of imgFiles) {
          playlist.push({
            name: f.name,
            size: f.size,
            url: URL.createObjectURL(f)
          });
        }
        renderPlaylist();
        if (playlist.length <= 1) {
          sidebar.classList.add('collapsed');
          updateSidebarToggleIcon();
        }
        showImageAtIndex(0);
      }
    });
  }

  // Local File Picker Fallback
  function onLocalImageSelected(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    playlist = [];
    for (const f of files) {
      playlist.push({
        name: f.name,
        size: f.size,
        url: URL.createObjectURL(f)
      });
    }
    renderPlaylist();
    if (playlist.length <= 1) {
      sidebar.classList.add('collapsed');
      updateSidebarToggleIcon();
    }
    showImageAtIndex(0);
  }

  // Toast
  let toastTimer = null;
  function toast(msg, isError = false) {
    const box = $('toast-box');
    box.textContent = msg;
    box.className = 'toast-box show' + (isError ? ' error' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      box.className = 'toast-box';
    }, 3500);
  }

  // Utilities
  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, (m) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[m]);
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '–';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + units[i];
  }

  // Start app
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
