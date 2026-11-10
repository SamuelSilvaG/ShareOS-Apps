(function () {
  'use strict';

  const t = window.VPI18n ? window.VPI18n.t : (k) => k;
  const getSOS = () => window.ShareOS || null;
  const SOS = {
    get file() { return window.ShareOS && window.ShareOS.file; },
    get fs() { return window.ShareOS && window.ShareOS.fs; }
  };

  // DOM Elements
  const $ = (id) => document.getElementById(id);
  const video = $('main-video');
  const stage = $('video-stage');
  const emptyScreen = $('empty-screen');
  const overlay = $('controls-overlay');
  const sidebar = $('sidebar');
  const playlistContainer = $('playlist-container');
  const searchInput = $('library-search');
  const folderNameLabel = $('folder-name-label');
  const videoCountLabel = $('video-count-label');
  const unmuteBanner = $('unmute-banner');
  let unmuteCleanup = null;

  // Controls Elements
  const btnPlayPause = $('btn-play-pause');
  const iconPlay = $('icon-play');
  const iconPause = $('icon-pause');
  const btnStop = $('btn-stop');
  const btnPrev = $('btn-prev');
  const btnNext = $('btn-next');
  const btnMute = $('btn-mute');
  const iconVol = $('icon-vol');
  const iconMuted = $('icon-muted');
  const volumeSlider = $('volume-slider');
  const timeDisplay = $('time-display');
  const progressWrap = $('progress-bar-wrap');
  const progressFilled = $('progress-filled');
  const progressBuffered = $('progress-buffered');
  const progressThumb = $('progress-thumb');

  // Center indicator
  const centerIndicator = $('center-indicator');
  const centerIcon = $('center-icon');

  // Extra menus
  const audioAnchor = $('audio-track-anchor');
  const btnAudio = $('btn-audio');
  const menuAudio = $('menu-audio');
  const audioTracksList = $('audio-tracks-list');
  const btnSubtitles = $('btn-subtitles');
  const menuSubtitles = $('menu-subtitles');
  const subTracksList = $('sub-tracks-list');
  const subOptOff = $('sub-opt-off');
  const btnSpeed = $('btn-speed');
  const menuSpeed = $('menu-speed');
  const speedLabel = $('speed-label');
  const btnAspect = $('btn-aspect');
  const btnPip = $('btn-pip');
  const btnFullscreen = $('btn-fullscreen');
  const iconFsEnter = $('icon-fs-enter');
  const iconFsExit = $('icon-fs-exit');

  // State
  const VIDEO_EXTS = ['.mp4', '.m4v', '.webm', '.mov', '.ogv', '.mkv'];
  const SUB_EXTS = ['.srt', '.vtt'];
  const AUDIO_EXTS = ['.m4a', '.mp3', '.aac', '.opus', '.ogg', '.wav', '.flac'];
  let currentFolder = { root: '', path: '' };
  let currentFolderEntries = null;
  let playlist = []; // array of { name, size, root, path, url }
  let currentIndex = -1;
  let currentVideoBlobUrl = null;
  let detectedSubtitles = []; // array of { label, url, blobUrl, lang }
  let activeSubTrackIndex = -1; // -1 = off
  let lastSubTrackIndex = 0;
  let externalAudio = null;
  let externalAudioUrl = null;
  let autohideTimer = null;
  let isSeeking = false;
  let centerFlashTimer = null;
  let lastReportedSec = -1;
  let lastMouseMoveTime = 0;
  let touchStartedWhileHidden = false;

  // Aspect ratios: 'fit', 'orig', 'wide', 'fill'
  const aspectModes = ['fit', 'wide', 'fill', 'orig'];
  let currentAspectIdx = 0;

  // Single-Instance Management
  const INSTANCE_ID = 'vp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const SINGLE_CHANNEL_NAME = 'sos_single_videoplayer';
  let singleChannel = null;
  let heartbeatTimer = null;
  let isPrimaryInstance = false;

  function getActiveInstance() {
    try {
      const str = localStorage.getItem('sos_videoplayer_active');
      if (!str) return null;
      const data = JSON.parse(str);
      if (data && data.id && data.ts && (Date.now() - data.ts < 3500)) {
        return data;
      }
    } catch (_) {}
    return null;
  }

  function markAsPrimary() {
    isPrimaryInstance = true;
    window.name = 'sosapp-videoplayer';
    const record = { id: INSTANCE_ID, ts: Date.now() };
    try {
      localStorage.setItem('sos_videoplayer_active', JSON.stringify(record));
      localStorage.removeItem('sos_videoplayer_transfer');
      localStorage.removeItem('sos_videoplayer_ack');
    } catch (_) {}

    clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      try {
        localStorage.setItem('sos_videoplayer_active', JSON.stringify({ id: INSTANCE_ID, ts: Date.now() }));
      } catch (_) {}
    }, 1200);
  }

  function releasePrimary() {
    clearInterval(heartbeatTimer);
    if (!isPrimaryInstance) return;
    try {
      const cur = getActiveInstance();
      if (cur && cur.id === INSTANCE_ID) {
        localStorage.removeItem('sos_videoplayer_active');
      }
      localStorage.removeItem('sos_videoplayer_transfer');
      localStorage.removeItem('sos_videoplayer_ack');
    } catch (_) {}
  }

  function checkSingleInstance() {
    return new Promise((resolve) => {
      const q = new URLSearchParams(location.search);
      const ticket = q.get('file');

      // Setup BroadcastChannel if supported
      if ('BroadcastChannel' in window) {
        try {
          singleChannel = new BroadcastChannel(SINGLE_CHANNEL_NAME);
        } catch (_) {}
      }

      // Check if an existing primary instance is running
      const active = getActiveInstance();

      // If no other instance is alive, we are the primary
      if (!active || active.id === INSTANCE_ID) {
        markAsPrimary();
        setupPrimaryListeners();
        return resolve(true);
      }

      // If another instance is alive and we were opened with a file:
      if (ticket && singleChannel) {
        const payload = {
          fromId: INSTANCE_ID,
          ticket: ticket,
          name: q.get('name') || '',
          ts: Date.now()
        };

        let handled = false;

        const onAck = (targetId) => {
          if (targetId !== INSTANCE_ID || handled) return;
          handled = true;
          // Successfully handed over to existing window, close self
          try { window.close(); } catch (_) {}
          // Fallback UI in case popup policy delays window.close
          document.body.innerHTML = `
            <div class="sos-app" style="display:flex;height:100vh;align-items:center;justify-content:center;background:var(--sos-bg);color:var(--sos-text);text-align:center;padding:20px;">
              <div>
                <p style="font-size:16px;margin-bottom:12px;">✓ ${t('single.transferred')}</p>
                <button class="sos-btn" onclick="window.close()">${t('single.close')}</button>
              </div>
            </div>`;
          resolve(false);
        };

        // Listen for ACK from primary window
        singleChannel.addEventListener('message', (ev) => {
          if (ev.data && ev.data.type === 'open-file-ack') {
            onAck(ev.data.targetId);
          }
        });

        // Broadcast file open request to primary window
        singleChannel.postMessage({ type: 'open-file', data: payload });

        // Timeout fallback: if no ACK received in 750ms (e.g. stale crashed window or busy thread)
        setTimeout(() => {
          if (!handled) {
            markAsPrimary();
            setupPrimaryListeners();
            resolve(true);
          }
        }, 750);
        return;
      }

      // If opened without a file ticket (e.g. fresh launch) or no BroadcastChannel, become primary
      markAsPrimary();
      setupPrimaryListeners();
      resolve(true);
    });
  }

  function setupPrimaryListeners() {
    const handleIncoming = (data) => {
      if (!data || !data.ticket) return;

      // Send ACK back to the requesting window
      if (singleChannel) {
        singleChannel.postMessage({ type: 'open-file-ack', targetId: data.fromId });
      }

      // Bring primary window to front
      try { window.focus(); } catch (_) {}

      // Load video into current player (append to playlist & play)
      openTicketFile(data.ticket, data.name, true);
    };

    if (singleChannel) {
      singleChannel.addEventListener('message', (ev) => {
        if (ev.data && ev.data.type === 'open-file') {
          handleIncoming(ev.data.data);
        }
      });
    }

    window.addEventListener('beforeunload', releasePrimary);
    window.addEventListener('pagehide', releasePrimary);
  }

  // Initialize
  async function init() {
    window.VPI18n.applyDOM();

    // Check single-instance: if an active window already exists and this one opened with a file,
    // transfer the video to the existing window and close this window immediately.
    const shouldRun = await checkSingleInstance();
    if (!shouldRun) return;

    // Sidebar already starts collapsed by default in HTML
    sidebar.classList.add('collapsed');
    updateSidebarToggleIcon();
    loadPreferences();
    bindEvents();
    checkOpenedFile();
  }

  // Load preferences from localStorage
  function loadPreferences() {
    try {
      const savedVol = localStorage.getItem('vp_volume');
      if (savedVol !== null) {
        const v = parseFloat(savedVol);
        video.volume = isNaN(v) ? 1 : Math.max(0, Math.min(1, v));
        volumeSlider.value = video.volume;
      }
      const savedAspect = localStorage.getItem('vp_aspect');
      if (savedAspect && aspectModes.includes(savedAspect)) {
        currentAspectIdx = aspectModes.indexOf(savedAspect);
        applyAspect(savedAspect);
      }
      const savedSubSize = localStorage.getItem('vp_sub_size');
      if (savedSubSize) {
        setSubSize(savedSubSize);
      }
    } catch (_) {}
  }

  // Bind UI Events
  function bindEvents() {
    // Header actions
    $('btn-hdr-open').addEventListener('click', openVideoFile);
    $('btn-hdr-folder').addEventListener('click', openFolderPicker);
    $('btn-empty-browse').addEventListener('click', openVideoFile);
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

    // Video events
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgress);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('loadeddata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('click', () => {
      if (touchStartedWhileHidden) {
        touchStartedWhileHidden = false;
        return;
      }
      togglePlay();
    });
    video.addEventListener('dblclick', toggleFullscreen);

    if (video.audioTracks && typeof video.audioTracks.addEventListener === 'function') {
      video.audioTracks.addEventListener('addtrack', updateAudioTracks);
      video.audioTracks.addEventListener('change', updateAudioTracks);
    }
    if (video.textTracks && typeof video.textTracks.addEventListener === 'function') {
      video.textTracks.addEventListener('addtrack', syncEmbeddedSubtitleTracks);
    }

    updateAudioTracks();

    // Controls
    btnPlayPause.addEventListener('click', togglePlay);
    btnStop.addEventListener('click', stopVideo);
    btnPrev.addEventListener('click', playPrev);
    btnNext.addEventListener('click', playNext);
    btnMute.addEventListener('click', toggleMute);
    volumeSlider.addEventListener('input', onVolumeChange);

    // Progress scrub
    progressWrap.addEventListener('mousedown', onScrubStart);
    document.addEventListener('mousemove', onScrubMove);
    document.addEventListener('mouseup', onScrubEnd);
    progressWrap.addEventListener('touchstart', onScrubTouchStart, { passive: false });
    document.addEventListener('touchmove', onScrubTouchMove, { passive: false });
    document.addEventListener('touchend', onScrubTouchEnd);

    // Autohide controls on inactivity
    stage.addEventListener('mousemove', onStageMouseMove);
    stage.addEventListener('touchstart', (e) => {
      if ((e.target === video || e.target === stage) && overlay.classList.contains('autohide')) {
        touchStartedWhileHidden = true;
      } else {
        touchStartedWhileHidden = false;
      }
      resetAutohide();
    }, { passive: true });
    overlay.addEventListener('mouseenter', () => clearTimeout(autohideTimer));

    // Menus
    btnAudio.addEventListener('click', (e) => {
      e.stopPropagation();
      menuSubtitles.classList.remove('show');
      menuSpeed.classList.remove('show');
      menuAudio.classList.toggle('show');
    });
    btnSubtitles.addEventListener('click', (e) => {
      e.stopPropagation();
      menuAudio.classList.remove('show');
      menuSpeed.classList.remove('show');
      menuSubtitles.classList.toggle('show');
    });
    btnSpeed.addEventListener('click', (e) => {
      e.stopPropagation();
      menuAudio.classList.remove('show');
      menuSubtitles.classList.remove('show');
      menuSpeed.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      menuAudio.classList.remove('show');
      menuSubtitles.classList.remove('show');
      menuSpeed.classList.remove('show');
    });

    // Audio options
    $('btn-load-custom-audio').addEventListener('click', openCustomAudioPicker);
    $('local-audio-input').addEventListener('change', onLocalAudioSelected);

    // Speed options
    menuSpeed.querySelectorAll('.menu-item').forEach((item) => {
      item.addEventListener('click', () => {
        const sp = parseFloat(item.dataset.speed);
        setSpeed(sp);
      });
    });

    // Subtitle options
    subOptOff.addEventListener('click', () => setSubtitleTrack(-1));
    $('btn-load-custom-sub').addEventListener('click', openCustomSubtitlePicker);
    $('btn-sub-size-sm').addEventListener('click', () => setSubSize('sm'));
    $('btn-sub-size-md').addEventListener('click', () => setSubSize('md'));
    $('btn-sub-size-lg').addEventListener('click', () => setSubSize('lg'));

    // Aspect & Fullscreen
    btnAspect.addEventListener('click', cycleAspect);
    btnPip.addEventListener('click', togglePip);
    btnFullscreen.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    // Keyboard shortcuts
    document.addEventListener('keydown', onKeyDown);

    // Help modal
    $('btn-hdr-help').addEventListener('click', () => $('modal-help').style.display = 'flex');
    $('btn-help-close').addEventListener('click', () => $('modal-help').style.display = 'none');
    $('btn-help-ok').addEventListener('click', () => $('modal-help').style.display = 'none');
    $('modal-help').addEventListener('click', (e) => {
      if (e.target === $('modal-help')) $('modal-help').style.display = 'none';
    });

    // Drag and Drop files
    setupDragAndDrop();

    // Local inputs fallback
    $('local-video-input').addEventListener('change', onLocalVideoSelected);
    $('local-sub-input').addEventListener('change', onLocalSubtitleSelected);

    // Unmute banner click
    if (unmuteBanner) {
      unmuteBanner.addEventListener('click', (e) => {
        e.stopPropagation();
        video.muted = false;
        if (externalAudio) externalAudio.muted = false;
        updateVolumeUI();
        hideUnmuteBanner();
        flashCenter(Math.round(video.volume * 100) + '%');
      });
    }
  }

  // Floating Unmute Banner controls (used when autoplay starts muted due to browser policy)
  function showUnmuteBanner() {
    if (unmuteBanner) {
      unmuteBanner.style.display = 'inline-flex';
    }
  }

  function hideUnmuteBanner() {
    if (unmuteBanner) {
      unmuteBanner.style.display = 'none';
    }
    if (unmuteCleanup) {
      unmuteCleanup();
      unmuteCleanup = null;
    }
  }

  // Reliable Playback with Autoplay Policy fallback
  function startPlayback(allowMutedFallback = true) {
    const src = video.currentSrc || video.src;
    const playPromise = video.play();
    if (!playPromise) return;

    playPromise.then(() => {
      if (!video.muted) {
        hideUnmuteBanner();
      }
    }).catch((err) => {
      // Only handle browser autoplay policy block (NotAllowedError), and only if the same video is still loaded
      if (!allowMutedFallback || err.name !== 'NotAllowedError') return;
      if ((video.currentSrc || video.src) !== src || video.muted) return;

      const targetVolume = video.volume > 0 ? video.volume : 1;
      video.muted = true;
      updateVolumeUI();

      video.play().then(() => {
        showUnmuteBanner();
        toast(t('toast.clickToUnmute'));

        const restoreAudio = (e) => {
          // If the user pressed 'm' / 'M', skip restoreAudio so toggleMute() handles unmute directly without double-toggling
          if (e && e.type === 'keydown' && (e.key === 'm' || e.key === 'M')) {
            return;
          }
          video.muted = false;
          video.volume = targetVolume;
          if (externalAudio) {
            externalAudio.muted = false;
            externalAudio.volume = targetVolume;
          }
          updateVolumeUI();
          hideUnmuteBanner();
          flashCenter(Math.round(video.volume * 100) + '%');
        };

        const cleanup = () => {
          window.removeEventListener('click', restoreAudio, true);
          window.removeEventListener('keydown', restoreAudio, true);
          window.removeEventListener('pointerdown', restoreAudio, true);
          window.removeEventListener('touchstart', restoreAudio, true);
        };

        unmuteCleanup = cleanup;

        window.addEventListener('click', restoreAudio, { once: true, capture: true });
        window.addEventListener('keydown', restoreAudio, { capture: true });
        window.addEventListener('pointerdown', restoreAudio, { once: true, capture: true });
        window.addEventListener('touchstart', restoreAudio, { once: true, capture: true });
      }).catch((e2) => {
        console.warn('Muted autoplay fallback failed:', e2);
      });
    });
  }

  // Open a file ticket (supports both initial startup and single-instance transfer)
  async function openTicketFile(ticket, fallbackName, appendToPlaylist = false) {
    if (!ticket) return;

    const sos = getSOS();
    let url = '/_shareos/cgi/file?t=' + encodeURIComponent(ticket);
    let name = fallbackName || 'Video', size = 0;

    const initial = !appendToPlaylist && sos && sos.file && typeof sos.file.info === 'function';
    if (initial) {
      try {
        await sos.file.info();
        if (sos.file.name) name = sos.file.name;
        if (sos.file.url) url = sos.file.url;
        if (sos.file.size) size = sos.file.size;
      } catch (err) {
        console.warn('ShareOS.file.info() error:', err);
      }
    } else if (name === 'Video') {
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

    document.title = name + ' – VideoPlayer';

    if (appendToPlaylist && playlist.length > 0) {
      const existingIdx = playlist.findIndex((item) => item.url === url);
      if (existingIdx >= 0) {
        playVideoAtIndex(existingIdx);
      } else {
        playlist.push({ name, root: '', path: '', url, size });
        renderPlaylist();
        playVideoAtIndex(playlist.length - 1);
      }
    } else {
      currentFolder = { root: '', path: '' };
      updateFolderLabels();
      playlist = [{ name, root: '', path: '', url, size }];
      renderPlaylist();
      playVideoAtIndex(0);
    }

    sidebar.classList.add('collapsed');
    updateSidebarToggleIcon();

    try {
      const q = new URLSearchParams(location.search);
      q.set('file', ticket);
      if (name) q.set('name', name);
      window.history.replaceState({}, '', location.pathname + '?' + q.toString());
    } catch (_) {}

    flashCenter(name);
  }

  // Check if opened from ShareOS file manager (?file=ticket)
  async function checkOpenedFile() {
    const q = new URLSearchParams(location.search);
    const ticket = q.get('file');
    if (!ticket) return;
    await openTicketFile(ticket, q.get('name'), false);
  }

  // Open Video File Picker
  async function openVideoFile() {
    if (SOS && SOS.fs && SOS.fs.pick) {
      try {
        const picked = await SOS.fs.pick({
          title: t('btn.openFile'),
          ext: VIDEO_EXTS,
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
          playVideoAtIndex(0);
        }
      } catch (err) {
        toast(t('toast.error') + err.message, true);
      }
    } else {
      $('local-video-input').click();
    }
  }

  // Open Folder Picker
  async function openFolderPicker() {
    if (SOS && SOS.fs && SOS.fs.pick) {
      try {
        const picked = await SOS.fs.pick({
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
      $('local-video-input').click();
    }
  }

  // Load Folder contents and populate playlist
  async function loadFolder(root, path) {
    if (!SOS || !SOS.fs) {
      toast(t('toast.noBoxAccess'), true);
      return;
    }
    toast(t('toast.loading'));
    try {
      const list = await SOS.fs.list(root, path);
      currentFolder = { root, path };
      currentFolderEntries = list && list.entries ? list.entries : [];
      playlist = [];
      if (list && list.entries) {
        const files = list.entries.filter((e) => {
          if (e.type !== 'file') return false;
          const lower = e.name.toLowerCase();
          return VIDEO_EXTS.some((ext) => lower.endsWith(ext));
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
        playVideoAtIndex(0);
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
    videoCountLabel.textContent = t('library.count', { count: playlist.length });
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
        <svg class="item-icon" viewBox="0 0 24 24" fill="currentColor">
          <polygon points="5 3 19 12 5 21 5 3"></polygon>
        </svg>
        <div class="item-info">
          <div class="item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
          <div class="item-size">${formatBytes(item.size)}</div>
        </div>
      `;
      div.addEventListener('click', () => playVideoAtIndex(item.originalIndex));
      frag.appendChild(div);
    });
    playlistContainer.appendChild(frag);
  }

  function filterPlaylist() {
    renderPlaylist();
  }

  // Play Video by Index
  async function playVideoAtIndex(index) {
    if (index < 0 || index >= playlist.length) return;
    currentIndex = index;
    const item = playlist[currentIndex];

    // Highlight in playlist
    renderPlaylist();

    // Auto-collapse sidebar if only one video in playlist or on mobile/tablet so the cinema video takes full stage
    if (playlist.length <= 1 || window.innerWidth <= 768) {
      sidebar.classList.add('collapsed');
      updateSidebarToggleIcon();
    }

    // Hide empty screen
    emptyScreen.style.display = 'none';

    // Clear old subtitle tracks and external audio
    clearSubtitles();
    disableExternalAudio();

    // Clean up previous video blob URL if any
    if (currentVideoBlobUrl) {
      URL.revokeObjectURL(currentVideoBlobUrl);
      currentVideoBlobUrl = null;
    }

    hideUnmuteBanner();

    // Teardown previous decoder buffers
    video.pause();
    video.removeAttribute('src');
    video.load();
    lastReportedSec = -1;

    // Get streaming URL
    let streamUrl = item.url;
    if (!streamUrl && SOS && SOS.fs) {
      try {
        const handle = await SOS.fs.open(item.root, item.path || '', item.name);
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

    video.src = streamUrl;
    video.load();
    startPlayback(true);

    // Look for matching subtitle files in the same directory (using cached entries if available)
    if (item.root) {
      scanMatchingSubtitles(item.root, item.path || '', item.name);
    }
  }

  // Scan Matching Subtitle files in the same directory (cached to avoid redundant NAS I/O)
  async function scanMatchingSubtitles(root, path, videoName) {
    if (!SOS || !SOS.fs) return;
    try {
      let entries = null;
      if (currentFolderEntries && currentFolder.root === root && (currentFolder.path || '') === (path || '')) {
        entries = currentFolderEntries;
      } else {
        const list = await SOS.fs.list(root, path);
        if (list && list.entries) {
          entries = list.entries;
          currentFolderEntries = entries;
        }
      }

      if (!entries) return;

      const baseName = videoName.replace(/\.[^.]+$/, '').toLowerCase();
      const subEntries = entries.filter((e) => {
        if (e.type !== 'file') return false;
        const lower = e.name.toLowerCase();
        const hasExt = SUB_EXTS.some((ext) => lower.endsWith(ext));
        return hasExt && lower.startsWith(baseName);
      });

      for (const entry of subEntries) {
        try {
          const handle = await SOS.fs.open(root, path, entry.name);
          const blob = await handle.blob();
          const text = await blob.text();
          addSubtitleTrack(entry.name, text, true);
        } catch (_) {}
      }
    } catch (_) {}
  }

  // Convert SRT to WebVTT format (fast single-pass)
  function srtToVtt(srt) {
    return 'WEBVTT\n\n' + srt
      .replace(/\r\n|\r/g, '\n')
      .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  }

  // Add Subtitle Track (SRT or VTT)
  function addSubtitleTrack(filename, content, autoSelect = false) {
    let vttContent = content;
    if (filename.toLowerCase().endsWith('.srt')) {
      vttContent = srtToVtt(content);
    }

    const blob = new Blob([vttContent], { type: 'text/vtt' });
    const blobUrl = URL.createObjectURL(blob);

    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = filename;
    track.srclang = extractLang(filename);
    track.src = blobUrl;
    video.appendChild(track);

    const trackObj = {
      label: filename,
      blobUrl,
      trackIndex: video.textTracks.length - 1
    };
    detectedSubtitles.push(trackObj);

    renderSubtitleMenu();

    if (autoSelect && activeSubTrackIndex === -1) {
      setSubtitleTrack(detectedSubtitles.length - 1);
      toast(t('sub.loaded', { name: filename }));
    }
  }

  function extractLang(filename) {
    const parts = filename.split('.');
    if (parts.length >= 3) {
      const code = parts[parts.length - 2].toLowerCase();
      if (/^[a-z]{2,3}(-[a-z]{2})?$/.test(code)) return code;
    }
    return 'en';
  }

  // Clear Subtitles
  function clearSubtitles() {
    detectedSubtitles.forEach((s) => {
      if (s.blobUrl) URL.revokeObjectURL(s.blobUrl);
    });
    detectedSubtitles = [];
    activeSubTrackIndex = -1;
    while (video.firstChild) {
      video.removeChild(video.firstChild);
    }
    renderSubtitleMenu();
  }

  // Render Subtitle Dropdown Menu
  function renderSubtitleMenu() {
    subTracksList.innerHTML = '';
    subOptOff.classList.toggle('active', activeSubTrackIndex === -1);

    detectedSubtitles.forEach((s, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'menu-item' + (activeSubTrackIndex === idx ? ' active' : '');
      btn.textContent = s.label;
      btn.addEventListener('click', () => setSubtitleTrack(idx));
      subTracksList.appendChild(btn);
    });

    btnSubtitles.classList.toggle('active', activeSubTrackIndex !== -1);
  }

  // Set Active Subtitle Track (-1 = Off)
  function setSubtitleTrack(index) {
    activeSubTrackIndex = index;
    if (index >= 0) lastSubTrackIndex = index;
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = (i === index) ? 'showing' : 'disabled';
    }
    renderSubtitleMenu();
    menuSubtitles.classList.remove('show');
    if (index === -1) {
      flashCenter(t('sub.none'));
    } else if (detectedSubtitles[index]) {
      flashCenter(detectedSubtitles[index].label);
    }
  }

  // Toggle Subtitles On/Off
  function toggleSubtitles() {
    if (activeSubTrackIndex !== -1) {
      setSubtitleTrack(-1);
    } else if (detectedSubtitles.length > 0) {
      const idx = (lastSubTrackIndex >= 0 && lastSubTrackIndex < detectedSubtitles.length) ? lastSubTrackIndex : 0;
      setSubtitleTrack(idx);
    }
  }

  // Sync embedded subtitles from container (MKV/MP4 internal tracks)
  function syncEmbeddedSubtitleTracks() {
    if (!video.textTracks || video.textTracks.length === 0) return;
    for (let i = 0; i < video.textTracks.length; i++) {
      const tr = video.textTracks[i];
      const exists = detectedSubtitles.some((s) => s.trackIndex === i);
      if (!exists) {
        const label = tr.label || (tr.language ? `Subtitle (${tr.language.toUpperCase()})` : `Subtitle ${i + 1}`);
        detectedSubtitles.push({
          label,
          trackIndex: i,
          blobUrl: null
        });
      }
    }
    renderSubtitleMenu();
  }

  // Open Custom Subtitle Picker
  async function openCustomSubtitlePicker() {
    menuSubtitles.classList.remove('show');
    if (SOS && SOS.fs && SOS.fs.pick) {
      try {
        const picked = await SOS.fs.pick({
          title: t('btn.loadSub'),
          ext: SUB_EXTS
        });
        if (picked && picked[0]) {
          const handle = await SOS.fs.open(picked[0].root, picked[0].path || '', picked[0].name);
          const blob = await handle.blob();
          const text = await blob.text();
          addSubtitleTrack(picked[0].name, text, true);
        }
      } catch (err) {
        toast(t('toast.subError') + err.message, true);
      }
    } else {
      $('local-sub-input').click();
    }
  }

  // Subtitle Size (sm, md, lg)
  function setSubSize(size) {
    const map = { sm: '1.05rem', md: '1.3rem', lg: '1.65rem' };
    const val = map[size] || map.md;
    document.documentElement.style.setProperty('--sub-size', val);
    $('btn-sub-size-sm').classList.toggle('sos-btn-accent', size === 'sm');
    $('btn-sub-size-md').classList.toggle('sos-btn-accent', size === 'md');
    $('btn-sub-size-lg').classList.toggle('sos-btn-accent', size === 'lg');
    try { localStorage.setItem('vp_sub_size', size); } catch (_) {}
  }

  // --- Audio Tracks Management ---
  function updateAudioTracks() {
    audioTracksList.innerHTML = '';
    audioAnchor.style.display = 'block';
    const tracks = video.audioTracks;
    const hasTracks = tracks && tracks.length > 0;

    if (hasTracks) {
      for (let i = 0; i < tracks.length; i++) {
        const tr = tracks[i];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'menu-item' + (tr.enabled && !externalAudio ? ' active' : '');
        const langTag = tr.language ? tr.language.toUpperCase() : '';
        const label = tr.label
          ? (langTag && !tr.label.toUpperCase().includes(langTag) ? `${tr.label} [${langTag}]` : tr.label)
          : (langTag ? `${t('audio.track', { num: i + 1 })} (${langTag})` : t('audio.track', { num: i + 1 }));
        btn.textContent = label;
        btn.addEventListener('click', () => {
          disableExternalAudio();
          for (let j = 0; j < tracks.length; j++) {
            tracks[j].enabled = (j === i);
          }
          const ct = video.currentTime;
          if (ct > 0) {
            video.currentTime = ct;
          }
          updateAudioTracks();
          flashCenter(label);
          toast(t('audio.loaded', { name: label }));
          menuAudio.classList.remove('show');
        });
        audioTracksList.appendChild(btn);
      }
    } else {
      const btnDef = document.createElement('button');
      btnDef.type = 'button';
      btnDef.className = 'menu-item' + (!externalAudio ? ' active' : '');
      btnDef.textContent = t('audio.default');
      btnDef.addEventListener('click', () => {
        disableExternalAudio();
        updateAudioTracks();
        menuAudio.classList.remove('show');
      });
      audioTracksList.appendChild(btnDef);

      if (!('audioTracks' in HTMLMediaElement.prototype)) {
        const isEdge = /Edg\//.test(navigator.userAgent);
        const flagUrl = (isEdge ? 'edge' : 'chrome') + '://flags/#enable-experimental-web-platform-features';
        const hintDiv = document.createElement('div');
        hintDiv.style.cssText = 'padding: 6px 10px; font-size: 11px; color: var(--sos-muted); line-height: 1.35; border-top: 1px solid rgba(255,255,255,0.08); margin-top: 4px;';
        hintDiv.textContent = t('audio.flagHint');
        const flagBtn = document.createElement('button');
        flagBtn.type = 'button';
        flagBtn.className = 'sos-btn';
        flagBtn.style.cssText = 'width: 100%; margin-top: 5px; font-size: 10px; font-family: monospace; padding: 4px 6px; word-break: break-all; text-align: left;';
        flagBtn.textContent = flagUrl;
        flagBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(flagUrl).catch(() => {});
          }
          toast(t('audio.flagCopied'));
          menuAudio.classList.remove('show');
        });
        hintDiv.appendChild(flagBtn);
        audioTracksList.appendChild(hintDiv);
      }
    }

    if (externalAudio) {
      const btnExt = document.createElement('button');
      btnExt.type = 'button';
      btnExt.className = 'menu-item active';
      btnExt.textContent = externalAudio.label;
      audioTracksList.appendChild(btnExt);
    }
  }

  function disableExternalAudio() {
    if (externalAudio) {
      externalAudio.pause();
      externalAudio = null;
      video.muted = false;
      btnAudio.classList.remove('active');
    }
  }

  async function openCustomAudioPicker() {
    menuAudio.classList.remove('show');
    if (SOS && SOS.fs && SOS.fs.pick) {
      try {
        const picked = await SOS.fs.pick({
          title: t('audio.loadExternal'),
          ext: AUDIO_EXTS
        });
        if (picked && picked[0]) {
          const handle = await SOS.fs.open(picked[0].root, picked[0].path || '', picked[0].name);
          setExternalAudio(picked[0].name, handle.url);
        }
      } catch (err) {
        toast(t('toast.error') + err.message, true);
      }
    } else {
      $('local-audio-input').click();
    }
  }

  function setExternalAudio(name, url) {
    disableExternalAudio();
    const aud = new Audio(url);
    aud.label = name;
    aud.currentTime = video.currentTime;
    aud.playbackRate = video.playbackRate;
    aud.volume = video.volume;
    aud.muted = video.muted;

    video.muted = true;
    externalAudio = aud;

    if (!video.paused) {
      aud.play().catch(() => {});
    }

    btnAudio.classList.add('active');
    updateAudioTracks();
    toast(t('audio.loaded', { name }));
    flashCenter(name);
  }

  function onLocalAudioSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setExternalAudio(file.name, url);
  }

  // Playback Speed
  function setSpeed(speed) {
    video.playbackRate = speed;
    if (externalAudio) externalAudio.playbackRate = speed;
    speedLabel.textContent = speed + 'x';
    menuSpeed.querySelectorAll('.menu-item').forEach((item) => {
      const sp = parseFloat(item.dataset.speed);
      item.classList.toggle('active', sp === speed);
    });
    menuSpeed.classList.remove('show');
    flashCenter(speed + 'x');
  }

  // Aspect Ratio
  function cycleAspect() {
    currentAspectIdx = (currentAspectIdx + 1) % aspectModes.length;
    const mode = aspectModes[currentAspectIdx];
    applyAspect(mode);
    try { localStorage.setItem('vp_aspect', mode); } catch (_) {}
    flashCenter(t('aspect.' + mode));
  }

  function applyAspect(mode) {
    video.className = 'aspect-' + mode;
  }

  // Picture in Picture
  async function togglePip() {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && video.readyState >= 2) {
        await video.requestPictureInPicture();
      }
    } catch (_) {}
  }

  // Fullscreen
  function toggleFullscreen() {
    const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fsEl) {
      if (stage.requestFullscreen) stage.requestFullscreen();
      else if (stage.webkitRequestFullscreen) stage.webkitRequestFullscreen();
      else if (video.requestFullscreen) video.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
    }
  }

  function onFullscreenChange() {
    const isFs = !!document.fullscreenElement;
    iconFsEnter.style.display = isFs ? 'none' : 'inline';
    iconFsExit.style.display = isFs ? 'inline' : 'none';
  }

  // Video State Handlers
  function togglePlay() {
    if (!video.src) return;
    if (video.paused) {
      startPlayback(false);
    } else {
      video.pause();
    }
  }

  function onPlay() {
    if (externalAudio) externalAudio.play().catch(() => {});
    if (!video.muted) {
      hideUnmuteBanner();
    }
    iconPlay.style.display = 'none';
    iconPause.style.display = 'inline';
    btnPlayPause.setAttribute('title', t('btn.pause'));
    flashCenter('play');
    resetAutohide();
  }

  function onPause() {
    if (externalAudio) externalAudio.pause();
    iconPlay.style.display = 'inline';
    iconPause.style.display = 'none';
    btnPlayPause.setAttribute('title', t('btn.play'));
    if (video.getAttribute('src')) {
      flashCenter('pause');
    }
    clearTimeout(autohideTimer);
    overlay.classList.remove('autohide');
  }

  function stopVideo() {
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    if (document.pictureInPictureElement && document.exitPictureInPicture) {
      document.exitPictureInPicture().catch(() => {});
    }

    hideUnmuteBanner();

    video.pause();
    video.removeAttribute('src');
    video.load();

    clearSubtitles();
    disableExternalAudio();
    updateAudioTracks();

    lastReportedSec = -1;
    currentIndex = -1;
    progressFilled.style.width = '0%';
    progressBuffered.style.width = '0%';
    progressThumb.style.left = '0%';
    timeDisplay.textContent = '00:00 / 00:00';

    iconPlay.style.display = 'inline';
    iconPause.style.display = 'none';
    btnPlayPause.setAttribute('title', t('btn.play'));

    clearTimeout(autohideTimer);
    overlay.classList.remove('autohide');

    emptyScreen.style.display = 'flex';
    if (playlist.length > 1 && window.innerWidth > 768) {
      sidebar.classList.remove('collapsed');
      updateSidebarToggleIcon();
    }
    renderPlaylist();
  }

  function playPrev() {
    if (currentIndex > 0) {
      playVideoAtIndex(currentIndex - 1);
    }
  }

  function playNext() {
    if (currentIndex < playlist.length - 1) {
      playVideoAtIndex(currentIndex + 1);
    }
  }

  function onEnded() {
    if (currentIndex < playlist.length - 1) {
      playNext();
    }
  }

  function onError() {
    if (!video.src) return;
    toast(t('toast.unsupportedCodec'), true);
  }

  // Volume
  function toggleMute() {
    video.muted = !video.muted;
    if (externalAudio) externalAudio.muted = video.muted;
    if (!video.muted) {
      hideUnmuteBanner();
    }
    updateVolumeUI();
    flashCenter(video.muted ? 'muted' : Math.round(video.volume * 100) + '%');
  }

  function onVolumeChange(e) {
    video.volume = parseFloat(e.target.value);
    video.muted = false;
    hideUnmuteBanner();
    if (externalAudio) {
      externalAudio.volume = video.volume;
      externalAudio.muted = false;
    }
    updateVolumeUI();
    try { localStorage.setItem('vp_volume', video.volume); } catch (_) {}
  }

  function updateVolumeUI() {
    const isMuted = video.muted || video.volume === 0;
    iconVol.style.display = isMuted ? 'none' : 'inline';
    iconMuted.style.display = isMuted ? 'inline' : 'none';
    volumeSlider.value = isMuted ? 0 : video.volume;
  }

  // Time & Progress
  function onLoadedMetadata() {
    updateTimeDisplay();
    updateAudioTracks();
    syncEmbeddedSubtitleTracks();
  }

  function onTimeUpdate() {
    if (isSeeking) return;
    const curSec = Math.floor(video.currentTime || 0);
    if (curSec !== lastReportedSec) {
      lastReportedSec = curSec;
      updateTimeDisplay();
    }
    const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    progressFilled.style.width = pct + '%';
    progressThumb.style.left = pct + '%';
  }

  function onProgress() {
    if (video.buffered.length > 0 && video.duration) {
      const end = video.buffered.end(video.buffered.length - 1);
      const pct = (end / video.duration) * 100;
      progressBuffered.style.width = pct + '%';
    }
  }

  function updateTimeDisplay() {
    const cur = formatTime(video.currentTime || 0);
    const dur = formatTime(video.duration || 0);
    timeDisplay.textContent = cur + ' / ' + dur;
  }

  function formatTime(sec) {
    const s = Math.floor(sec);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const rem = s % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  }

  // Scrubbing
  function onScrubStart(e) {
    isSeeking = true;
    seekByMouse(e);
  }

  function onScrubMove(e) {
    if (isSeeking) seekByMouse(e);
  }

  function onScrubEnd() {
    isSeeking = false;
  }

  function onScrubTouchStart(e) {
    if (e.touches.length === 1) {
      isSeeking = true;
      seekByTouch(e.touches[0]);
    }
  }

  function onScrubTouchMove(e) {
    if (isSeeking && e.touches.length === 1) {
      seekByTouch(e.touches[0]);
    }
  }

  function onScrubTouchEnd() {
    isSeeking = false;
  }

  function seekByMouse(e) {
    const rect = progressWrap.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (video.duration) {
      video.currentTime = pos * video.duration;
      if (externalAudio) externalAudio.currentTime = video.currentTime;
      progressFilled.style.width = (pos * 100) + '%';
      progressThumb.style.left = (pos * 100) + '%';
      updateTimeDisplay();
    }
  }

  function seekByTouch(touch) {
    const rect = progressWrap.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (touch.clientX - rect.left) / rect.width));
    if (video.duration) {
      video.currentTime = pos * video.duration;
      if (externalAudio) externalAudio.currentTime = video.currentTime;
      progressFilled.style.width = (pos * 100) + '%';
      progressThumb.style.left = (pos * 100) + '%';
      updateTimeDisplay();
    }
  }

  // Autohide Controls
  function onStageMouseMove() {
    const now = Date.now();
    if (now - lastMouseMoveTime > 250) {
      lastMouseMoveTime = now;
      resetAutohide();
    }
  }

  function resetAutohide() {
    overlay.classList.remove('autohide');
    clearTimeout(autohideTimer);
    if (!video.paused) {
      autohideTimer = setTimeout(() => {
        overlay.classList.add('autohide');
      }, 3500);
    }
  }

  // Center Flash Feedback
  function flashCenter(typeOrText) {
    clearTimeout(centerFlashTimer);
    if (typeOrText === 'play') {
      centerIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    } else if (typeOrText === 'pause') {
      centerIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    } else if (typeOrText === 'muted') {
      centerIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15" stroke="currentColor" stroke-width="2"></line>';
    } else {
      centerIcon.innerHTML = `<text x="12" y="15" font-size="9" text-anchor="middle" fill="#fff" font-weight="bold">${escapeHtml(typeOrText)}</text>`;
    }
    centerIndicator.classList.add('flash');
    centerFlashTimer = setTimeout(() => {
      centerIndicator.classList.remove('flash');
    }, 450);
  }

  // Sidebar Toggle
  function toggleSidebar() {
    sidebar.classList.toggle('collapsed');
    updateSidebarToggleIcon();
  }

  function updateSidebarToggleIcon() {
    const icon = $('icon-toggle-sidebar');
    if (!icon) return;
    if (sidebar.classList.contains('collapsed')) {
      icon.innerHTML = '<line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="18" x2="21" y2="18"></line>';
    } else {
      icon.innerHTML = '<line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line>';
    }
  }

  // Keyboard Shortcuts
  function onKeyDown(e) {
    // If typing in input, ignore
    if (e.target.tagName === 'INPUT') return;

    switch (e.key) {
      case ' ':
      case 'k':
      case 'K':
        e.preventDefault();
        togglePlay();
        break;
      case 's':
      case 'S':
        e.preventDefault();
        stopVideo();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 5);
        flashCenter('-5s');
        break;
      case 'ArrowRight':
        e.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
        flashCenter('+5s');
        break;
      case 'j':
      case 'J':
        e.preventDefault();
        video.currentTime = Math.max(0, video.currentTime - 10);
        flashCenter('-10s');
        break;
      case 'l':
      case 'L':
        e.preventDefault();
        video.currentTime = Math.min(video.duration || 0, video.currentTime + 10);
        flashCenter('+10s');
        break;
      case 'ArrowUp':
        e.preventDefault();
        video.volume = Math.min(1, video.volume + 0.05);
        video.muted = false;
        updateVolumeUI();
        flashCenter(Math.round(video.volume * 100) + '%');
        break;
      case 'ArrowDown':
        e.preventDefault();
        video.volume = Math.max(0, video.volume - 0.05);
        video.muted = false;
        updateVolumeUI();
        flashCenter(Math.round(video.volume * 100) + '%');
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
      case 'c':
      case 'C':
        e.preventDefault();
        toggleSubtitles();
        break;
      case '[':
        e.preventDefault();
        setSpeed(Math.max(0.5, Math.round((video.playbackRate - 0.25) * 100) / 100));
        break;
      case ']':
        e.preventDefault();
        setSpeed(Math.min(2.0, Math.round((video.playbackRate + 0.25) * 100) / 100));
        break;
      case 'p':
      case 'P':
        e.preventDefault();
        togglePip();
        break;
      case 'n':
      case 'N':
        e.preventDefault();
        playNext();
        break;
    }
  }

  // Drag & Drop
  function setupDragAndDrop() {
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      if (!files || !files.length) return;

      const videoFile = Array.from(files).find((f) => VIDEO_EXTS.some((x) => f.name.toLowerCase().endsWith(x)));
      const subFile = Array.from(files).find((f) => SUB_EXTS.some((x) => f.name.toLowerCase().endsWith(x)));
      const audioFile = Array.from(files).find((f) => AUDIO_EXTS.some((x) => f.name.toLowerCase().endsWith(x)));

      if (videoFile) {
        if (currentVideoBlobUrl) {
          URL.revokeObjectURL(currentVideoBlobUrl);
        }
        currentVideoBlobUrl = URL.createObjectURL(videoFile);
        playlist.unshift({ name: videoFile.name, size: videoFile.size, url: currentVideoBlobUrl });
        renderPlaylist();
        playVideoAtIndex(0);
      }

      if (audioFile) {
        const url = URL.createObjectURL(audioFile);
        setExternalAudio(audioFile.name, url);
      }

      if (subFile) {
        const reader = new FileReader();
        reader.onload = () => {
          addSubtitleTrack(subFile.name, reader.result, true);
        };
        reader.readAsText(subFile);
      }
    });
  }

  // Local File Fallbacks
  function onLocalVideoSelected(e) {
    const files = e.target.files;
    if (!files || !files.length) return;
    if (currentVideoBlobUrl) {
      URL.revokeObjectURL(currentVideoBlobUrl);
      currentVideoBlobUrl = null;
    }
    playlist = [];
    for (const f of files) {
      const u = URL.createObjectURL(f);
      currentVideoBlobUrl = u;
      playlist.push({
        name: f.name,
        size: f.size,
        url: u
      });
    }
    renderPlaylist();
    playVideoAtIndex(0);
  }

  function onLocalSubtitleSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      addSubtitleTrack(file.name, reader.result, true);
    };
    reader.readAsText(file);
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

