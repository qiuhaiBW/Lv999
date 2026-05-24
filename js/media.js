/**
 * 媒体库 — 音乐 / 图片 / 视频（与游戏合成音完全分离）
 * 图库优先加载缩略图，点击查看原图
 */
const MediaHub = (function () {
  const MUSIC_EXT = /\.(mp3|ogg|wav|m4a|flac)$/i;
  const IMAGE_EXT = /\.(png|jpe?g|gif|webp|bmp|svg)$/i;
  const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)$/i;

  function isAbsoluteUrl(path) {
    return typeof path === 'string' && /^https?:\/\//i.test(path);
  }

  function safeRemoteMediaUrl(url) {
    if (!url || !isAbsoluteUrl(url)) return url;
    try {
      const u = new URL(url);
      const parts = u.pathname.split('/');
      const file = parts.pop();
      if (!file) return url;
      let decoded = file;
      try {
        decoded = decodeURIComponent(file);
      } catch (_) {}
      u.pathname = `${parts.join('/')}/${encodeURIComponent(decoded)}`;
      return u.href;
    } catch (_) {
      return url;
    }
  }

  function assetUrl(path) {
    if (!path || typeof path !== 'string') return path;
    const slash = path.lastIndexOf('/');
    const dir = slash < 0 ? '' : path.slice(0, slash + 1);
    let name = slash < 0 ? path : path.slice(slash + 1);
    try {
      name = decodeURIComponent(name);
    } catch (_) {
      /* 文件名含非法 % 序列时保持原样 */
    }
    return dir + encodeURIComponent(name);
  }

  function fileNameFromPath(file) {
    if (!file) return '';
    const base = file.split('/').pop() || file;
    return decodeURIComponent(base);
  }

  function titleFromPath(file) {
    return fileNameFromPath(file).replace(/\.[^.]+$/, '');
  }

  function defaultThumbPath(src) {
    const slash = src.lastIndexOf('/');
    if (slash < 0) return src;
    const dir = src.slice(0, slash + 1);
    const name = src.slice(slash + 1);
    const stem = name.replace(/\.[^.]+$/, '');
    return `${dir}_thumb/${stem}.jpg`;
  }

  function normalizeImageEntry(item) {
    if (typeof item === 'string') {
      const src = assetUrl(item.trim());
      return { src, thumb: assetUrl(defaultThumbPath(item.trim())) };
    }
    if (item && typeof item === 'object') {
      const src = assetUrl(item.src || '');
      const thumb = assetUrl(item.thumb || defaultThumbPath(item.src || ''));
      return { src, thumb };
    }
    return null;
  }

  function normalizeList(value, extRe) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : Object.values(value);
    return raw
      .filter((p) => typeof p === 'string' && p.trim())
      .filter((p) => !extRe || extRe.test(p))
      .map((p) => {
        const trimmed = p.trim();
        return isAbsoluteUrl(trimmed) ? safeRemoteMediaUrl(trimmed) : assetUrl(trimmed);
      });
  }

  function normalizeImages(value) {
    if (!value) return [];
    const raw = Array.isArray(value) ? value : [];
    return raw.map(normalizeImageEntry).filter(Boolean);
  }

  function normalizeManifest(raw) {
    const m = raw || {};
    return {
      music: normalizeList(m.music, MUSIC_EXT),
      images: normalizeImages(m.images),
      videos: normalizeList(m.videos != null ? m.videos : m.video, VIDEO_EXT),
    };
  }

  let manifest = { music: [], images: [], videos: [] };
  let manifestReady = false;
  let galleryBuilt = false;
  let videoAnimId = null;
  let libraryAudio = null;
  let playingMusicPath = null;
  let playbackGen = 0;
  let musicProgressDragging = false;
  let activeVideoPath = null;
  let galleryObserver = null;
  const videoBlobUrls = new Map();
  let videoBlobLoadTask = null;

  function drawGalleryPlaceholder(canvas, index) {
    const g = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const palettes = [
      ['#050508', '#00f5ff', '#ff00ea'],
      ['#0a0e1a', '#7b2fff', '#00ff88'],
      ['#050508', '#ff8800', '#00f5ff'],
      ['#020408', '#ff4466', '#7b2fff'],
      ['#0a0e1a', '#00ff88', '#ff00ea'],
      ['#050508', '#c8e6ff', '#7b2fff'],
    ];
    const pal = palettes[index % palettes.length];
    g.fillStyle = pal[0];
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = i % 2 ? pal[1] : pal[2];
      g.fillRect((i * 17) % w, (i * 23) % h, 4, 4);
    }
    g.fillStyle = pal[1];
    g.font = '10px monospace';
    g.fillText(`IMG_${index + 1}.PX`, 8, h - 8);
  }

  let assetBase = 'assets';

  function githubRawUrl(repo, branch, filePath) {
    const parts = String(filePath || '')
      .split('/')
      .filter(Boolean)
      .map((part) => encodeURIComponent(part));
    return `https://raw.githubusercontent.com/${repo}/${encodeURIComponent(branch)}/${parts.join('/')}`;
  }

  function toMediaUrl(repo, branch, filePath, sameOrigin) {
    const path = String(filePath || '').replace(/\\/g, '/');
    if (!path) return '';
    if (sameOrigin) return assetUrl(path);
    return safeRemoteMediaUrl(githubRawUrl(repo, branch, path));
  }

  async function fetchGithubFolder(repo, branch, folderPath) {
    const apiUrl =
      `https://api.github.com/repos/${repo}/contents/${folderPath}` +
      `?ref=${encodeURIComponent(branch)}`;
    try {
      const res = await fetch(apiUrl, {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok) return [];
      const items = await res.json();
      return Array.isArray(items) ? items : [];
    } catch (_) {
      return [];
    }
  }

  function fallbackPaths(config, kind, extRe) {
    const fb = config?.remoteMedia?.fallback?.[kind];
    if (!Array.isArray(fb)) return [];
    const base = config.remoteMedia[`${kind}Path`] || `assets/${kind === 'videos' ? 'video' : kind}`;
    return fb
      .filter((name) => typeof name === 'string' && extRe.test(name))
      .map((name) => `${base.replace(/\/$/, '')}/${name}`);
  }

  const THUMB_EXT = /\.(jpe?g|webp|png|gif)$/i;

  function sortFileItems(items) {
    return items
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  }

  function buildImagesFromThumbs(thumbItems, repo, branch, sameOrigin) {
    return sortFileItems(
      thumbItems.filter((item) => item.type === 'file' && THUMB_EXT.test(item.name))
    ).map((item) => {
      const url = toMediaUrl(repo, branch, item.path, sameOrigin);
      return { src: url, thumb: url };
    });
  }

  function buildImagesFromFallback(config) {
    const remote = config && config.remoteMedia;
    if (!remote) return [];
    const names = remote.fallback?.images;
    if (!Array.isArray(names) || names.length === 0) return [];

    const imagesPath = remote.imagesPath || 'assets/images';
    const imagesThumbPath = remote.imagesThumbPath || `${imagesPath}/_thumb`;
    const base = remote.imagesFromThumbOnly ? imagesThumbPath : imagesPath;

    return names
      .filter((name) => typeof name === 'string' && IMAGE_EXT.test(name))
      .map((name) => {
        const path = `${String(base).replace(/\/$/, '')}/${name}`;
        const url = assetUrl(path);
        return { src: url, thumb: url };
      });
  }

  async function fetchRemoteManifest(config) {
    const remote = config && config.remoteMedia;
    if (!remote || !remote.enabled || !remote.repo) return null;

    const branch = remote.branch || 'main';
    const sameOrigin = remote.sameOrigin !== false;
    // GitHub Pages 同站部署：目录列表走 API 易 403，改用 media.json + fallback
    if (sameOrigin || remote.skipApiScan) return null;
    const musicPath = remote.musicPath || 'assets/music';
    const imagesPath = remote.imagesPath || 'assets/images';
    const imagesThumbPath = remote.imagesThumbPath || `${imagesPath}/_thumb`;
    const videosPath = remote.videosPath || 'assets/video';

    const [musicItems, imageItems, thumbItems, videoItems] = await Promise.all([
      fetchGithubFolder(remote.repo, branch, musicPath),
      fetchGithubFolder(remote.repo, branch, imagesPath),
      fetchGithubFolder(remote.repo, branch, imagesThumbPath),
      fetchGithubFolder(remote.repo, branch, videosPath),
    ]);

    const thumbNames = new Set(
      thumbItems.filter((item) => item.type === 'file').map((item) => item.name.toLowerCase())
    );

    let music = musicItems
      .filter((item) => item.type === 'file' && MUSIC_EXT.test(item.name))
      .map((item) => toMediaUrl(remote.repo, branch, item.path, sameOrigin));

    let images = sortFileItems(
      imageItems.filter((item) => item.type === 'file' && IMAGE_EXT.test(item.name))
    ).map((item) => {
      const src = toMediaUrl(remote.repo, branch, item.path, sameOrigin);
      const stem = item.name.replace(/\.[^.]+$/, '');
      const thumbFile = `${stem}.jpg`;
      const thumbPath = `${imagesThumbPath}/${thumbFile}`;
      const thumb = thumbNames.has(thumbFile.toLowerCase())
        ? toMediaUrl(remote.repo, branch, thumbPath, sameOrigin)
        : src;
      return { src, thumb };
    });

    let videos = videoItems
      .filter((item) => item.type === 'file' && VIDEO_EXT.test(item.name))
      .map((item) => toMediaUrl(remote.repo, branch, item.path, sameOrigin));

    if (music.length === 0) {
      music = fallbackPaths(config, 'music', MUSIC_EXT).map((p) =>
        toMediaUrl(remote.repo, branch, p, sameOrigin)
      );
    }
    if (images.length === 0) {
      images = buildImagesFromThumbs(thumbItems, remote.repo, branch, sameOrigin);
    }
    if (images.length === 0) {
      images = fallbackPaths(config, 'images', IMAGE_EXT).map((name) => {
        const src = toMediaUrl(remote.repo, branch, `${imagesPath}/${name}`, sameOrigin);
        return { src, thumb: src };
      });
    }
    if (videos.length === 0) {
      videos = fallbackPaths(config, 'videos', VIDEO_EXT).map((p) =>
        toMediaUrl(remote.repo, branch, p, sameOrigin)
      );
    }

    return { music, images, videos };
  }

  function pickMediaList(localList, remoteList) {
    if (localList && localList.length > 0) return localList;
    return remoteList || [];
  }

  function pickImageList(localList, remoteList, config) {
    const remote = config && config.remoteMedia;
    if (remote && remote.imagesFromThumbOnly && remoteList && remoteList.length > 0) {
      return remoteList;
    }
    return pickMediaList(localList, remoteList);
  }

  async function loadConfig() {
    try {
      const res = await fetch(`${assetBase}/config.json`, { cache: 'no-store' });
      if (res.ok) {
        const config = await res.json();
        if (config.assetBase) assetBase = String(config.assetBase).replace(/\/$/, '');
        return config;
      }
    } catch (_) {}
    return {};
  }

  function toRawGithubUrl(relativePath, config) {
    const remote = config && config.remoteMedia;
    if (!relativePath || !remote || !remote.repo) return assetUrl(relativePath);
    const path = String(relativePath).replace(/\\/g, '/').replace(/^\//, '');
    return safeRemoteMediaUrl(githubRawUrl(remote.repo, remote.branch || 'main', path));
  }

  function applyRawGithubImages(images, config) {
    if (!config?.remoteMedia?.imagesUseRawGithub) return images || [];
    return (images || []).map((entry) => ({
      src: toRawGithubUrl(entry.src, config),
      thumb: toRawGithubUrl(entry.thumb || entry.src, config),
    }));
  }

  function applyThumbOnlyMode(images, config) {
    if (!config?.remoteMedia?.imagesFromThumbOnly) return images || [];
    return (images || []).map((entry) => {
      const thumb = entry.thumb || assetUrl(defaultThumbPath(entry.src));
      return { src: thumb, thumb };
    });
  }

  function galleryDisplayPath(entry) {
    return entry.thumb || entry.src || '';
  }

  async function loadManifest() {
    const config = await loadConfig();
    let localManifest = { music: [], images: [], videos: [] };

    try {
      const res = await fetch(`${assetBase}/media.json`, { cache: 'no-store' });
      if (res.ok) {
        localManifest = normalizeManifest(await res.json());
      }
    } catch (_) {}

    const remoteManifest = config.remoteMedia?.enabled
      ? await fetchRemoteManifest(config)
      : null;

    manifest = {
      music: pickMediaList(localManifest.music, remoteManifest?.music),
      images: pickImageList(localManifest.images, remoteManifest?.images, config),
      videos: pickMediaList(localManifest.videos, remoteManifest?.videos),
    };

    if (!manifest.images.length) {
      manifest.images = buildImagesFromFallback(config);
    }

    manifest.images = applyThumbOnlyMode(manifest.images, config);
    manifest.images = applyRawGithubImages(manifest.images, config);

    manifestReady = true;
    galleryBuilt = false;
    return manifest;
  }

  function detachAudioHandlers(audio) {
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
  }

  function stopLibraryMusic() {
    playbackGen += 1;
    musicProgressDragging = false;
    const a = libraryAudio;
    libraryAudio = null;
    playingMusicPath = null;
    if (a) {
      detachAudioHandlers(a);
      a.pause();
      try {
        a.removeAttribute('src');
        a.load();
      } catch (_) {}
    }
    syncMusicPlayingUI();
    hideMusicPlayer();
  }

  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function showMusicPlayer() {
    const player = document.getElementById('music-player');
    if (player) player.classList.remove('hidden');
  }

  function hideMusicPlayer() {
    const player = document.getElementById('music-player');
    if (player) player.classList.add('hidden');
    resetMusicPlayerUI();
  }

  function resetMusicPlayerUI() {
    const titleEl = document.getElementById('music-player-title');
    const currentEl = document.getElementById('music-time-current');
    const totalEl = document.getElementById('music-time-total');
    const progressFill = document.getElementById('music-progress-fill');
    if (titleEl) titleEl.textContent = '—';
    if (currentEl) currentEl.textContent = '0:00';
    if (totalEl) totalEl.textContent = '0:00';
    if (progressFill) progressFill.style.width = '0%';
  }

  function getMediaDuration(media) {
    if (!media) return 0;
    const d = media.duration;
    if (typeof d === 'number' && isFinite(d) && d > 0) return d;
    try {
      if (media.seekable && media.seekable.length > 0) {
        const end = media.seekable.end(media.seekable.length - 1);
        if (isFinite(end) && end > 0) return end;
      }
    } catch (_) {}
    return 0;
  }

  function clampSeekTime(media, t) {
    const duration = getMediaDuration(media);
    if (!media || duration <= 0) return null;
    let target = Math.max(0, Math.min(t, duration - 0.05));
    try {
      if (media.seekable && media.seekable.length > 0) {
        const start = media.seekable.start(0);
        const end = media.seekable.end(media.seekable.length - 1);
        if (end > start) target = Math.max(start, Math.min(target, end - 0.05));
      }
    } catch (_) {}
    return target;
  }

  function applyMediaSeek(media, t) {
    const target = clampSeekTime(media, t);
    if (target == null) return false;
    try {
      if (typeof media.fastSeek === 'function') media.fastSeek(target);
      else media.currentTime = target;
      return true;
    } catch (_) {
      return false;
    }
  }

  function seekMediaTime(getMedia, getTrackEl, updateUi, clientX) {
    const media = getMedia();
    const track = getTrackEl();
    const duration = getMediaDuration(media);
    if (!media || !track || duration <= 0) return false;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return false;
    const p = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ok = applyMediaSeek(media, p * duration);
    if (ok && updateUi) updateUi();
    return ok;
  }

  function bindProgressSeek(wrapId, trackId, getMedia, updateUi, setDragging) {
    const wrap = document.getElementById(wrapId);
    const track = document.getElementById(trackId);
    if (!wrap || !track || wrap.dataset.seekBound) return;
    wrap.dataset.seekBound = '1';

    let seeking = false;

    const seekAt = (clientX) => {
      seekMediaTime(getMedia, () => track, updateUi, clientX);
    };

    const endSeek = (e) => {
      if (!seeking) return;
      seeking = false;
      setDragging(false);
      wrap.classList.remove('is-seeking');
      if (wrap.releasePointerCapture) {
        try {
          wrap.releasePointerCapture(e.pointerId);
        } catch (_) {}
      }
    };

    const startSeek = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      seeking = true;
      setDragging(true);
      wrap.classList.add('is-seeking');
      if (wrap.setPointerCapture) {
        try {
          wrap.setPointerCapture(e.pointerId);
        } catch (_) {}
      }
      seekAt(e.clientX);
    };

    const moveSeek = (e) => {
      if (!seeking) return;
      e.preventDefault();
      seekAt(e.clientX);
    };

    wrap.addEventListener('pointerdown', startSeek);
    wrap.addEventListener('pointermove', moveSeek);
    wrap.addEventListener('pointerup', endSeek);
    wrap.addEventListener('pointercancel', endSeek);
    track.style.touchAction = 'none';
    wrap.style.touchAction = 'none';
  }

  function bindMusicPlayerControls() {
    if (document.body.dataset.musicControlsBound) return;
    document.body.dataset.musicControlsBound = '1';

    bindProgressSeek(
      'music-progress-wrap',
      'music-progress-track',
      () => libraryAudio,
      updateMusicPlayerUI,
      (v) => { musicProgressDragging = v; }
    );

    const volumeSlider = document.getElementById('music-volume-slider');
    if (volumeSlider) {
      volumeSlider.addEventListener('input', handleVolumeChange);
      volumeSlider.addEventListener('mousedown', (e) => e.stopPropagation());
      volumeSlider.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
    }
  }

  function updateMusicPlayerUI() {
    if (!libraryAudio) return;
    const titleEl = document.getElementById('music-player-title');
    const currentEl = document.getElementById('music-time-current');
    const totalEl = document.getElementById('music-time-total');
    const progressFill = document.getElementById('music-progress-fill');
    const title = titleFromPath(playingMusicPath || '');
    if (titleEl) titleEl.textContent = title || '—';
    if (currentEl) currentEl.textContent = formatTime(libraryAudio.currentTime);
    if (totalEl) totalEl.textContent = formatTime(libraryAudio.duration);
    const duration = getMediaDuration(libraryAudio);
    if (duration > 0) {
      const percent = (libraryAudio.currentTime / duration) * 100;
      if (progressFill) progressFill.style.width = percent + '%';
    }
  }

  function handleVolumeChange(e) {
    const volume = parseInt(e.target.value, 10) / 100;
    if (libraryAudio) {
      libraryAudio.volume = volume;
    }
    const volumeValue = document.getElementById('music-volume-value');
    if (volumeValue) volumeValue.textContent = `${e.target.value}%`;
    const volumeIcon = document.getElementById('music-volume-icon');
    const player = document.getElementById('music-player');
    if (volumeIcon) {
      if (volume === 0) {
        volumeIcon.textContent = '✕';
        if (player) player.style.setProperty('--vol-muted', '1');
      } else if (volume < 0.4) {
        volumeIcon.textContent = '♫';
        if (player) player.style.removeProperty('--vol-muted');
      } else if (volume < 0.75) {
        volumeIcon.textContent = '♫♫';
        if (player) player.style.removeProperty('--vol-muted');
      } else {
        volumeIcon.textContent = '♫♫♫';
        if (player) player.style.removeProperty('--vol-muted');
      }
    }
  }

  function syncMusicPlayingUI() {
    document.querySelectorAll('.media-play-btn').forEach((btn) => {
      const playing = btn.dataset.musicPath === playingMusicPath;
      btn.classList.toggle('media-play-btn--active', playing);
      const icon = btn.querySelector('.media-play-icon');
      if (icon) icon.textContent = playing ? '⏸' : '▶';
    });
  }

  function playLibraryMusic(path) {
    if (typeof Sfx !== 'undefined') Sfx.unlock();
    if (typeof Sfx !== 'undefined' && !Sfx.isMusicEnabled()) return;

    if (playingMusicPath === path && libraryAudio && !libraryAudio.paused) {
      stopLibraryMusic();
      return;
    }

    stopLibraryMusic();
    const gen = playbackGen;
    const a = new Audio(isAbsoluteUrl(path) ? safeRemoteMediaUrl(path) : path);
    const savedVolume = parseInt((document.getElementById('music-volume-slider')?.value || 55), 10) / 100;
    a.volume = savedVolume;
    a.loop = false;
    libraryAudio = a;
    playingMusicPath = path;
    showMusicPlayer();
    updateMusicPlayerUI();

    a.addEventListener('loadedmetadata', updateMusicPlayerUI);
    a.addEventListener('timeupdate', () => {
      if (gen !== playbackGen || musicProgressDragging) return;
      updateMusicPlayerUI();
    });

    a.onended = () => {
      if (gen !== playbackGen) return;
      playingMusicPath = null;
      libraryAudio = null;
      syncMusicPlayingUI();
    };
    a.onerror = () => {
      if (gen !== playbackGen) return;
      stopLibraryMusic();
    };

    a.play().catch(() => {
      if (gen !== playbackGen) return;
      stopLibraryMusic();
    });
    syncMusicPlayingUI();
  }

  function buildMusicList() {
    const list = document.querySelector('.media-music-list');
    const empty = document.getElementById('media-music-empty');
    if (!list) return;
    list.innerHTML = '';

    const tracks = manifest.music || [];
    if (empty) empty.classList.toggle('hidden', tracks.length > 0);

    tracks.forEach((path) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'media-play-btn';
      btn.dataset.musicPath = path;

      const icon = document.createElement('span');
      icon.className = 'media-play-icon';
      icon.textContent = '▶';
      btn.appendChild(icon);

      const label = document.createElement('span');
      label.className = 'media-play-label';
      label.textContent = titleFromPath(path);
      btn.appendChild(label);

      btn.addEventListener('click', () => playLibraryMusic(path));
      li.appendChild(btn);
      list.appendChild(li);
    });
    syncMusicPlayingUI();
  }

  function openLightbox(entryOrSrc, caption) {
    const box = document.getElementById('gallery-lightbox');
    const img = document.getElementById('gallery-lightbox-img');
    const cap = document.getElementById('gallery-lightbox-cap');
    if (!box || !img) return;

    const urls = [];
    if (typeof entryOrSrc === 'object' && entryOrSrc) {
      if (entryOrSrc.src) urls.push(entryOrSrc.src);
      if (entryOrSrc.thumb && entryOrSrc.thumb !== entryOrSrc.src) urls.push(entryOrSrc.thumb);
    } else if (entryOrSrc) {
      urls.push(entryOrSrc);
    }
    const candidates = [...new Set(urls.filter(Boolean))];
    if (
      typeof entryOrSrc === 'object' &&
      entryOrSrc?.thumb &&
      entryOrSrc.thumb !== entryOrSrc.src &&
      entryOrSrc.thumb.includes('/_thumb/') &&
      !String(entryOrSrc.src).includes('/_thumb/')
    ) {
      const thumb = entryOrSrc.thumb;
      const rest = candidates.filter((u) => u !== thumb);
      candidates.length = 0;
      candidates.push(thumb, ...rest);
    }
    if (candidates.length === 0) return;

    box.classList.remove('hidden');
    box.setAttribute('aria-hidden', 'false');
    img.classList.add('gallery-lightbox-img--loading');
    img.removeAttribute('src');
    cap.textContent = caption || '';

    const tryLoad = (index) => {
      if (index >= candidates.length) {
        cap.textContent = '图片加载失败';
        img.classList.remove('gallery-lightbox-img--loading');
        return;
      }
      const probe = new Image();
      probe.onload = () => {
        img.src = candidates[index];
        img.classList.remove('gallery-lightbox-img--loading');
      };
      probe.onerror = () => tryLoad(index + 1);
      probe.src = candidates[index];
    };
    tryLoad(0);
  }

  function closeLightbox() {
    const box = document.getElementById('gallery-lightbox');
    const img = document.getElementById('gallery-lightbox-img');
    if (!box) return;
    box.classList.add('hidden');
    box.setAttribute('aria-hidden', 'true');
    if (img) img.removeAttribute('src');
  }

  function bindLightbox() {
    const box = document.getElementById('gallery-lightbox');
    if (!box || box.dataset.bound) return;
    box.dataset.bound = '1';

    box.querySelector('.gallery-lightbox-close')?.addEventListener('click', closeLightbox);
    box.querySelector('.gallery-lightbox-backdrop')?.addEventListener('click', closeLightbox);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && box && !box.classList.contains('hidden')) closeLightbox();
    });
  }

  function loadGalleryImage(img, entry) {
    if (img.dataset.loaded === '1') return;
    img.dataset.loaded = '1';
    img.classList.add('gallery-thumb--loading');

    const tryFull = () => {
      img.onerror = () => {
        img.classList.remove('gallery-thumb--loading');
        const cell = img.closest('.gallery-cell');
        if (!cell) return;
        const c = document.createElement('canvas');
        c.className = 'gallery-thumb';
        c.width = 160;
        c.height = 120;
        cell.replaceChildren(c);
        drawGalleryPlaceholder(c, Number(img.dataset.index || 0));
      };
      img.onload = () => img.classList.remove('gallery-thumb--loading');
      img.src = entry.src;
    };

    if (entry.thumb && entry.thumb !== entry.src) {
      img.onload = () => img.classList.remove('gallery-thumb--loading');
      img.onerror = tryFull;
      img.src = entry.thumb;
    } else {
      tryFull();
    }
  }

  function initGallery() {
    const grid = document.getElementById('media-gallery-grid');
    const empty = document.getElementById('media-gallery-empty');
    if (!grid) return;

    bindLightbox();

    const images = manifest.images || [];
    if (empty) empty.classList.toggle('hidden', images.length > 0);

    if (galleryBuilt && grid.children.length === images.length) return;

    if (galleryObserver) {
      galleryObserver.disconnect();
      galleryObserver = null;
    }

    grid.innerHTML = '';

    if (images.length === 0) {
      galleryBuilt = true;
      return;
    }

    images.forEach((entry, index) => {
      const cell = document.createElement('figure');
      cell.className = 'gallery-cell';
      cell.tabIndex = 0;
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `查看 ${titleFromPath(galleryDisplayPath(entry))}`);

      const wrap = document.createElement('div');
      wrap.className = 'gallery-thumb-wrap';

      const img = document.createElement('img');
      img.className = 'gallery-thumb';
      img.alt = titleFromPath(galleryDisplayPath(entry));
      img.decoding = 'async';
      img.loading = 'lazy';
      img.dataset.index = String(index);
      img.dataset.full = galleryDisplayPath(entry);

      wrap.appendChild(img);
      cell.appendChild(wrap);

      const cap = document.createElement('figcaption');
      cap.className = 'gallery-caption';
      cap.textContent = fileNameFromPath(galleryDisplayPath(entry));
      cell.appendChild(cap);

      const open = () => openLightbox(entry, fileNameFromPath(galleryDisplayPath(entry)));
      cell.addEventListener('click', open);
      cell.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });

      grid.appendChild(cell);
    });

    galleryObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((obs) => {
          if (!obs.isIntersecting) return;
          const img = obs.target.querySelector('.gallery-thumb');
          const idx = Number(img?.dataset.index);
          if (img && !Number.isNaN(idx) && images[idx]) {
            loadGalleryImage(img, images[idx]);
          }
          galleryObserver.unobserve(obs.target);
        });
      },
      { root: grid.closest('.view') || null, rootMargin: '120px' }
    );

    grid.querySelectorAll('.gallery-cell').forEach((cell) => galleryObserver.observe(cell));

    galleryBuilt = true;
  }

  let videoFallbackReason = 'empty';

  function startVideoAnim() {
    const canvas = document.getElementById('media-video-canvas');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (wrap) {
      const w = Math.min(640, wrap.clientWidth - 32);
      canvas.width = Math.floor(w);
      canvas.height = Math.floor((w * 9) / 16);
    }
    const g = canvas.getContext('2d');
    let f = 0;
    function anim() {
      videoAnimId = requestAnimationFrame(anim);
      f++;
      const w = canvas.width;
      const h = canvas.height;
      g.fillStyle = '#020408';
      g.fillRect(0, 0, w, h);
      const text = 'LV999 SIGNAL';
      g.font = '12px monospace';
      g.fillStyle = '#00f5ff';
      const offset = f % (text.length * 8);
      g.fillText(text, w / 2 - 60 + (offset % 40), h / 2);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = i % 2 ? '#ff00ea' : '#7b2fff';
        g.fillRect((f * 3 + i * 40) % w, (i * 30 + f) % h, 6, 6);
      }
      g.fillStyle = 'rgba(90,122,154,0.8)';
      const hint =
        videoFallbackReason === 'load'
          ? '// 视频加载失败 · 请双击 start-server.bat 用 http:// 打开'
          : '// 将视频放入 assets/video/ · 双击 sync-media.bat 登记';
      g.fillText(hint, 12, h - 16);
    }
    anim();
  }

  function stopVideoAnim() {
    if (videoAnimId) {
      cancelAnimationFrame(videoAnimId);
      videoAnimId = null;
    }
  }

  function isVideoSeekBroken(video) {
    if (!video) return true;
    try {
      if (!video.seekable || video.seekable.length === 0) return true;
      return video.seekable.end(video.seekable.length - 1) <= 0.5;
    } catch (_) {
      return true;
    }
  }

  function clearVideoBlobCache(keepPath) {
    videoBlobUrls.forEach((blobUrl, path) => {
      if (path !== keepPath) {
        URL.revokeObjectURL(blobUrl);
        videoBlobUrls.delete(path);
      }
    });
  }

  function ensureVideoBlobSrc(path) {
    if (videoBlobUrls.has(path)) {
      return Promise.resolve(videoBlobUrls.get(path));
    }
    if (videoBlobLoadTask && videoBlobLoadTask.path === path) {
      return videoBlobLoadTask.promise;
    }
    const promise = fetch(path)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        videoBlobUrls.set(path, blobUrl);
        return blobUrl;
      });
    videoBlobLoadTask = { path, promise };
    return promise.finally(() => {
      if (videoBlobLoadTask && videoBlobLoadTask.path === path) videoBlobLoadTask = null;
    });
  }

  function swapVideoToBlobSrc(path, seekTime) {
    const video = document.getElementById('media-video-player');
    if (!video || activeVideoPath !== path) return Promise.resolve(false);

    return ensureVideoBlobSrc(path)
      .then((blobUrl) => {
        if (activeVideoPath !== path) return false;
        if (video.src === blobUrl || video.currentSrc === blobUrl) {
          if (typeof seekTime === 'number') applyMediaSeek(video, seekTime);
          return true;
        }

        const t = typeof seekTime === 'number' ? seekTime : video.currentTime;
        const playing = !video.paused;
        return new Promise((resolve) => {
          const onReady = () => {
            video.removeEventListener('loadeddata', onReady);
            applyMediaSeek(video, t);
            if (playing) video.play().catch(() => {});
            updateVideoPlayerUI();
            resolve(true);
          };
          video.addEventListener('loadeddata', onReady);
          video.src = blobUrl;
          video.load();
        });
      })
      .catch(() => false);
  }

  function scheduleVideoBlobUpgrade(path) {
    ensureVideoBlobSrc(path).then(() => {
      const video = document.getElementById('media-video-player');
      if (!video || activeVideoPath !== path) return;
      if (video.src && video.src.startsWith('blob:')) return;
      if (!isVideoSeekBroken(video)) return;
      swapVideoToBlobSrc(path, video.currentTime);
    }).catch(() => {});
  }

  function trySeekVideo(t) {
    const video = document.getElementById('media-video-player');
    if (!video || !activeVideoPath || t == null) return;

    const before = video.currentTime;
    applyMediaSeek(video, t);
    const ok =
      Math.abs(video.currentTime - t) < 2 ||
      (Math.abs(video.currentTime - before) > 0.5 && !isVideoSeekBroken(video));

    if (ok) {
      updateVideoPlayerUI();
      return;
    }

    swapVideoToBlobSrc(activeVideoPath, t).then((swapped) => {
      if (swapped) updateVideoPlayerUI();
    });
  }

  function showVideoFallback(reason) {
    if (reason === 'load') videoFallbackReason = 'load';
    else if (!(manifest.videos || []).length) videoFallbackReason = 'empty';
    const video = document.getElementById('media-video-player');
    const canvas = document.getElementById('media-video-canvas');
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.classList.add('hidden');
    }
    if (canvas) {
      canvas.classList.remove('hidden');
      startVideoAnim();
    }
  }

  function playVideoFile(url, opts) {
    const options = opts || {};
    const video = document.getElementById('media-video-player');
    const canvas = document.getElementById('media-video-canvas');
    const container = document.getElementById('video-container');
    if (!video) {
      showVideoFallback();
      return;
    }

    stopVideoAnim();
    if (canvas) canvas.classList.add('hidden');
    if (container) container.classList.remove('hidden');
    video.classList.remove('hidden');

    if (
      !options.forceReload &&
      activeVideoPath === url &&
      video.src &&
      video.readyState >= 2 &&
      !video.error
    ) {
      syncVideoPlayingUI();
      updateVideoPlayerUI();
      video.play().catch(() => {});
      return;
    }

    activeVideoPath = url;
    clearVideoBlobCache(url);
    const vol = parseInt((document.getElementById('video-volume-slider')?.value || 70), 10) / 100;
    video.volume = vol;
    video.muted = false;
    video.preload = 'auto';
    let videoLoadOk = false;
    video.onerror = () => {
      if (videoLoadOk) return;
      showVideoFallback('load');
    };
    video.src = url;
    video.onloadedmetadata = () => {
      updateVideoPlayerUI();
    };
    video.onloadeddata = () => {
      videoLoadOk = true;
      video.onerror = null;
      stopVideoAnim();
      updateVideoPlayerUI();
      if (isVideoSeekBroken(video)) scheduleVideoBlobUpgrade(url);
    };
    video.ondurationchange = updateVideoPlayerUI;
    video.load();
    video.play().catch(() => {});
    scheduleVideoBlobUpgrade(url);
    syncVideoPlayingUI();
  }

  function syncVideoPlayingUI() {
    document.querySelectorAll('.media-video-item').forEach((btn) => {
      btn.classList.toggle('media-video-item--active', btn.dataset.videoPath === activeVideoPath);
    });
  }

  function buildVideoList() {
    const list = document.getElementById('media-video-list');
    const empty = document.getElementById('media-video-empty');
    const countEl = document.getElementById('video-count');
    if (!list) return;
    list.innerHTML = '';

    const videos = manifest.videos || [];
    if (empty) empty.classList.toggle('hidden', videos.length > 0);
    if (countEl) countEl.textContent = videos.length > 0 ? `(${videos.length})` : '';

    videos.forEach((path, index) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'media-video-item';
      btn.dataset.videoPath = path;
      btn.dataset.index = index;
      btn.textContent = `${index + 1}. ${titleFromPath(path)}`;
      btn.addEventListener('click', () => playVideoFile(path, { forceReload: true }));
      li.appendChild(btn);
      list.appendChild(li);
    });
    syncVideoPlayingUI();
  }

  async function reloadManifestIfEmpty(key) {
    const list = manifest[key];
    if (list && list.length > 0) return;
    manifestReady = false;
    await loadManifest();
  }

  async function onEnterMusic() {
    if (!manifestReady) await loadManifest();
    await reloadManifestIfEmpty('music');
    buildMusicList();
  }

  async function onEnterGallery() {
    if (!manifestReady) await loadManifest();
    await reloadManifestIfEmpty('images');
    galleryBuilt = false;
    initGallery();
  }

  async function onEnterVideo() {
    if (!manifestReady) await loadManifest();
    await reloadManifestIfEmpty('videos');
    buildVideoList();
    bindVideoControls();
    const videos = manifest.videos || [];
    if (videos.length === 0) {
      activeVideoPath = null;
      videoFallbackReason = 'empty';
      showVideoFallback();
      return;
    }

    videoFallbackReason = 'empty';

    const video = document.getElementById('media-video-player');
    const container = document.getElementById('video-container');
    const canvas = document.getElementById('media-video-canvas');
    stopVideoAnim();
    if (canvas) canvas.classList.add('hidden');
    if (container) container.classList.remove('hidden');

    if (activeVideoPath && videos.includes(activeVideoPath) && video && video.src && video.readyState >= 1 && !video.error) {
      syncVideoPlayingUI();
      updateVideoPlayerUI();
      if (video.paused) video.play().catch(() => {});
      return;
    }

    playVideoFile(videos[0]);
  }

  function onLeaveMusic() {
    stopLibraryMusic();
  }

  let videoProgressDragging = false;

  function onLeaveVideo() {
    stopVideoAnim();
    videoProgressDragging = false;
    activeVideoPath = null;
    videoBlobLoadTask = null;
    clearVideoBlobCache(null);
    const video = document.getElementById('media-video-player');
    const container = document.getElementById('video-container');
    const canvas = document.getElementById('media-video-canvas');
    if (video) {
      video.pause();
      video.removeAttribute('src');
    }
    const seekSlider = document.getElementById('video-seek-slider');
    if (seekSlider) seekSlider.value = '0';
    if (container) container.classList.add('hidden');
    if (canvas) canvas.classList.remove('hidden');
  }

  function sliderTimeFromValue(slider) {
    const video = document.getElementById('media-video-player');
    if (!video || !slider) return null;
    const duration = getMediaDuration(video);
    if (duration <= 0) return null;
    const max = parseFloat(slider.max) || 1000;
    const val = parseFloat(slider.value) || 0;
    return (val / max) * duration;
  }

  function syncVideoSeekSlider() {
    if (videoProgressDragging) return;
    const video = document.getElementById('media-video-player');
    const slider = document.getElementById('video-seek-slider');
    if (!video || !slider) return;
    const duration = getMediaDuration(video);
    if (duration <= 0) return;
    const maxSteps = Math.max(1000, Math.ceil(duration));
    slider.max = String(maxSteps);
    slider.value = String(Math.round((video.currentTime / duration) * maxSteps));
  }

  function handleVideoSeekInput(e) {
    const slider = e.target;
    if (!slider || slider.id !== 'video-seek-slider') return;
    const video = document.getElementById('media-video-player');
    if (!video) return;
    const t = sliderTimeFromValue(slider);
    if (t == null) return;
    videoProgressDragging = true;
    trySeekVideo(t);
    const currentEl = document.getElementById('video-time-current');
    if (currentEl) currentEl.textContent = formatTime(t);
  }

  function endVideoSeekDrag() {
    videoProgressDragging = false;
    updateVideoPlayerUI();
  }

  function bindVideoSeekControl() {
    const slider = document.getElementById('video-seek-slider');
    if (!slider || slider.dataset.bound) return;
    slider.dataset.bound = '1';
    slider.addEventListener('input', handleVideoSeekInput);
    slider.addEventListener('change', endVideoSeekDrag);
    slider.addEventListener('pointerdown', () => {
      videoProgressDragging = true;
    });
    slider.addEventListener('pointerup', endVideoSeekDrag);
    slider.addEventListener('pointercancel', endVideoSeekDrag);
  }

  function updateVideoPlayerUI() {
    const video = document.getElementById('media-video-player');
    const currentEl = document.getElementById('video-time-current');
    const totalEl = document.getElementById('video-time-total');
    if (!video) return;
    if (currentEl) currentEl.textContent = formatTime(video.currentTime);
    const duration = getMediaDuration(video);
    if (totalEl) totalEl.textContent = formatTime(duration);
    syncVideoSeekSlider();
  }

  function toggleVideoPlay() {
    const video = document.getElementById('media-video-player');
    const btn = document.getElementById('video-play-pause');
    if (!video || !btn) return;
    if (video.paused) {
      video.play();
      btn.textContent = '⏸';
    } else {
      video.pause();
      btn.textContent = '▶';
    }
  }

  function toggleVideoMute() {
    const video = document.getElementById('media-video-player');
    const btn = document.getElementById('video-mute');
    const slider = document.getElementById('video-volume-slider');
    if (!video || !btn) return;

    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (slider) {
        video.volume = parseInt(slider.value, 10) / 100;
      }
      btn.textContent = '♫';
    } else {
      video.muted = true;
      btn.textContent = '✕';
    }
  }

  function handleVideoVolumeChange(e) {
    const video = document.getElementById('media-video-player');
    const btn = document.getElementById('video-mute');
    const valueEl = document.getElementById('video-volume-value');
    if (!video) return;

    const volume = parseInt(e.target.value, 10) / 100;
    video.volume = volume;
    video.muted = false;

    if (valueEl) valueEl.textContent = `${e.target.value}%`;
    if (btn) btn.textContent = volume === 0 ? '✕' : '♫';
  }

  function toggleVideoFullscreen() {
    const container = document.getElementById('video-container');
    if (!container) return;

    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    } else if (container.mozRequestFullScreen) {
      container.mozRequestFullScreen();
    }
  }

  function bindVideoControls() {
    bindVideoSeekControl();

    const controls = document.querySelector('#video-container .video-player-controls');
    if (!controls || controls.dataset.bound) return;
    controls.dataset.bound = '1';

    const video = document.getElementById('media-video-player');
    const playBtn = document.getElementById('video-play-pause');
    const muteBtn = document.getElementById('video-mute');
    const fullscreenBtn = document.getElementById('video-fullscreen');

    controls.addEventListener('input', (e) => {
      if (e.target.id === 'video-volume-slider') handleVideoVolumeChange(e);
      else if (e.target.id === 'video-seek-slider') handleVideoSeekInput(e);
    });

    if (playBtn) {
      playBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVideoPlay();
      });
    }

    if (muteBtn) {
      muteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVideoMute();
      });
    }
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleVideoFullscreen();
      });
    }

    if (video) {
      video.addEventListener('timeupdate', () => {
        if (!videoProgressDragging) updateVideoPlayerUI();
      });
      video.addEventListener('play', () => {
        if (playBtn) playBtn.textContent = '⏸';
      });
      video.addEventListener('pause', () => {
        if (playBtn) playBtn.textContent = '▶';
      });
      video.addEventListener('loadedmetadata', updateVideoPlayerUI);
    }

    const videoList = document.getElementById('media-video-list');
    if (videoList) {
      document.addEventListener('keydown', (e) => {
        const view = document.getElementById('view-media-video');
        if (!view || !view.classList.contains('view-active')) return;

        const videos = manifest.videos || [];
        if (videos.length === 0) return;

        let currentIndex = videos.findIndex((v) => v === activeVideoPath);
        if (currentIndex === -1) currentIndex = 0;

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
          e.preventDefault();
          const newIndex = (currentIndex - 1 + videos.length) % videos.length;
          playVideoFile(videos[newIndex]);
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
          e.preventDefault();
          const newIndex = (currentIndex + 1) % videos.length;
          playVideoFile(videos[newIndex]);
        } else if (e.key >= '1' && e.key <= '9') {
          const num = parseInt(e.key, 10) - 1;
          if (num < videos.length) {
            e.preventDefault();
            playVideoFile(videos[num]);
          }
        }
      });
    }
  }

  function bindMusicToggle() {
    if (typeof Sfx !== 'undefined' && Sfx.onMusicChange) {
      Sfx.onMusicChange((on) => {
        if (!on) stopLibraryMusic();
      });
    }
  }

  bindMusicToggle();
  bindMusicPlayerControls();
  bindVideoControls();

  return {
    loadManifest,
    onEnterMusic,
    onEnterGallery,
    onEnterVideo,
    onLeaveMusic,
    onLeaveVideo,
    stopLibraryMusic,
  };
})();
