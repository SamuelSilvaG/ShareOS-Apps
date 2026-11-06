(function () {
  'use strict';

  const t = window.VPI18n ? window.VPI18n.t : (k) => k;
  const SOS = window.ShareOS || null;

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

  // Controls Elements
  const btnPlayPause = $('btn-play-pause');
  const iconPlay = $('icon-play');
  const iconPause = $('icon-pause');
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
  let currentFolder = { root: '', path: '' };
  let playlist = []; // array of { name, size, root, path, url }
  let currentIndex = -1;
  let detectedSubtitles = []; // array of { label, url, blobUrl, lang }
  let activeSubTrackIndex = -1; // -1 = off
  let autohideTimer = null;
  let isSeeking = false;
  let centerFlashTimer = null;

  // Aspect ratios: 'fit', 'orig', 'wide', 'fill'
  const aspectModes = ['fit', 'wide', 'fill', 'orig'];
  let currentAspectIdx = 0;

  // Initialize
  function init() {
    window.VPI18n.applyDOM();
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

    // Search filter
    searchInput.addEventListener('input', filterPlaylist);

    // Video events
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('progress', onProgress);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('ended', onEnded);
    video.addEventListener('error', onError);
    video.addEventListener('click', togglePlay);
    video.addEventListener('dblclick', toggleFullscreen);

    // Controls
    btnPlayPause.addEventListener('click', togglePlay);
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
    stage.addEventListener('mousemove', resetAutohide);
    stage.addEventListener('touchstart', resetAutohide, { passive: true });
    overlay.addEventListener('mouseenter', () => clearTimeout(autohideTimer));

    // Menus
    btnSubtitles.addEventListener('click', (e) => {
      e.stopPropagation();
      menuSpeed.classList.remove('show');
      menuSubtitles.classList.toggle('show');
    });
    btnSpeed.addEventListener('click', (e) => {
      e.stopPropagation();
      menuSubtitles.classList.remove('show');
      menuSpeed.classList.toggle('show');
    });

    document.addEventListener('click', () => {
      menuSubtitles.classList.remove('show');
      menuSpeed.classList.remove('show');
    });

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
  }

  // Check if opened from ShareOS file manager (?file=ticket)
  async function checkOpenedFile() {
    if (SOS && SOS.file) {
      try {
        const ticket = new URLSearchParams(location.search).get('file');
        await SOS.file.info();
        const name = SOS.file.name;
        const url = SOS.file.url || '/_shareos/cgi/file?t=' + encodeURIComponent(ticket);
        playlist = [{ name, root: '', path: '', url, size: 0 }];
        renderPlaylist();
        playVideoAtIndex(0);
      } catch (err) {
        toast(t('toast.error') + err.message, true);
      }
    }
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
      playlistContainer.appendChild(div);
    });
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

    // Hide empty screen
    emptyScreen.style.display = 'none';

    // Clear old subtitle tracks
    clearSubtitles();

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
    video.play().catch(() => {});

    // Look for matching subtitle files in the same directory
    if (item.root) {
      scanMatchingSubtitles(item.root, item.path || '', item.name);
    }
  }

  // Scan Matching Subtitle files in the same directory
  async function scanMatchingSubtitles(root, path, videoName) {
    if (!SOS || !SOS.fs) return;
    try {
      const list = await SOS.fs.list(root, path);
      if (!list || !list.entries) return;

      const baseName = videoName.replace(/\.[^.]+$/, '').toLowerCase();
      const subEntries = list.entries.filter((e) => {
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

  // Convert SRT to WebVTT format
  function srtToVtt(srt) {
    let vtt = 'WEBVTT\n\n' + srt
      .replace(/\r\n|\r/g, '\n')
      .replace(/^([0-9]+)\n([0-9]{2}:[0-9]{2}:[0-9]{2}),([0-9]{3})/gm, '$1\n$2.$3')
      .replace(/([0-9]{2}:[0-9]{2}:[0-9]{2}),([0-9]{3})/g, '$1.$2');
    return vtt;
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
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = (i === index) ? 'showing' : 'disabled';
    }
    renderSubtitleMenu();
    menuSubtitles.classList.remove('show');
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

  // Playback Speed
  function setSpeed(speed) {
    video.playbackRate = speed;
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
    if (!document.fullscreenElement) {
      if (stage.requestFullscreen) stage.requestFullscreen();
      else if (video.requestFullscreen) video.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
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
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }

  function onPlay() {
    iconPlay.style.display = 'none';
    iconPause.style.display = 'inline';
    btnPlayPause.setAttribute('title', t('btn.pause'));
    flashCenter('play');
    resetAutohide();
  }

  function onPause() {
    iconPlay.style.display = 'inline';
    iconPause.style.display = 'none';
    btnPlayPause.setAttribute('title', t('btn.play'));
    flashCenter('pause');
    clearTimeout(autohideTimer);
    overlay.classList.remove('autohide');
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
    updateVolumeUI();
    flashCenter(video.muted ? 'muted' : Math.round(video.volume * 100) + '%');
  }

  function onVolumeChange(e) {
    video.volume = parseFloat(e.target.value);
    video.muted = false;
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
  }

  function onTimeUpdate() {
    if (isSeeking) return;
    updateTimeDisplay();
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
      progressFilled.style.width = (pos * 100) + '%';
      progressThumb.style.left = (pos * 100) + '%';
      updateTimeDisplay();
    }
  }

  // Autohide Controls
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
        if (detectedSubtitles.length > 0) {
          const next = activeSubTrackIndex === -1 ? 0 : -1;
          setSubtitleTrack(next);
          flashCenter(next === -1 ? t('sub.none') : detectedSubtitles[next].label);
        }
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

      if (videoFile) {
        const url = URL.createObjectURL(videoFile);
        playlist.unshift({ name: videoFile.name, size: videoFile.size, url });
        renderPlaylist();
        playVideoAtIndex(0);
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
    playlist = [];
    for (const f of files) {
      playlist.push({
        name: f.name,
        size: f.size,
        url: URL.createObjectURL(f)
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

