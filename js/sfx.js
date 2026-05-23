/**
 * 像素风合成音 — 大厅 / 选单 / 各游戏独立 BGM 与音效
 * 各游戏 BGM 在旋律、调式、波形、节奏型上区分，非单纯变速
 */
const Sfx = (function () {
  const STORAGE_KEY = 'lv999_audio';

  const NOTE = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0,
  };

  /*
   * BGM 配置
   * steps: [freq, dur] | [freq, dur, wave] | [0, dur] 休止
   * harmony: 每隔 N 步叠三度和声
   * bassMode: pulse=低音跺脚 | follow=根音跟随 | off=无
   */
  const BGM = {
    /* 大厅：慢速环境音，长音 sine，空灵感 */
    hub: {
      wave: 'sine',
      vol: 0.038,
      bassVol: 0.018,
      bassMode: 'pulse',
      harmony: 0,
      steps: [
        [NOTE.E3, 0.38], [NOTE.G3, 0.38], [0, 0.18],
        [NOTE.B3, 0.38], [NOTE.A3, 0.38], [0, 0.18],
        [NOTE.G3, 0.38], [NOTE.E3, 0.48], [0, 0.28],
      ],
    },
    /* 选单：轻快上行琶音 */
    menu: {
      wave: 'triangle',
      vol: 0.04,
      bassVol: 0,
      bassMode: 'off',
      harmony: 3,
      steps: [
        [NOTE.C4, 0.14], [NOTE.E4, 0.14], [NOTE.G4, 0.14], [NOTE.C5, 0.18],
        [NOTE.A3, 0.14], [NOTE.C4, 0.14], [NOTE.E4, 0.14], [NOTE.A4, 0.18],
        [NOTE.G3, 0.14], [NOTE.B3, 0.14], [NOTE.D4, 0.14], [NOTE.G4, 0.22],
      ],
    },
    /* 贪吃蛇：小调爬行感，短促方波，低音脉冲 */
    snake: {
      wave: 'square',
      vol: 0.028,
      bassVol: 0.022,
      bassMode: 'pulse',
      harmony: 0,
      steps: [
        [NOTE.A3, 0.1], [NOTE.B3, 0.1], [NOTE.C4, 0.1], [NOTE.B3, 0.1],
        [NOTE.A3, 0.1], [NOTE.G3, 0.1], [NOTE.F3, 0.1], [NOTE.G3, 0.14],
        [NOTE.A3, 0.1], [NOTE.C4, 0.1], [NOTE.E4, 0.1], [NOTE.C4, 0.14],
        [NOTE.A3, 0.1], [NOTE.G3, 0.1], [NOTE.E3, 0.1], [NOTE.A3, 0.2],
      ],
    },
    /* 俄罗斯方块：下行+上行交替，经典堆叠感 */
    tetris: {
      wave: 'triangle',
      vol: 0.042,
      bassVol: 0.024,
      bassMode: 'follow',
      harmony: 4,
      steps: [
        [NOTE.E4, 0.12], [NOTE.B3, 0.12], [NOTE.C4, 0.12], [NOTE.D4, 0.12],
        [NOTE.C4, 0.12], [NOTE.B3, 0.12], [NOTE.A3, 0.12], [NOTE.A3, 0.16],
        [NOTE.A3, 0.12], [NOTE.C4, 0.12], [NOTE.E4, 0.12], [NOTE.A4, 0.12],
        [NOTE.G4, 0.12], [NOTE.F4, 0.12], [NOTE.E4, 0.12], [NOTE.D4, 0.18],
      ],
    },
    /* 弹幕射击：紧张驱动，快速小三度跳进 */
    shooter: {
      wave: 'sawtooth',
      vol: 0.022,
      bassVol: 0.02,
      bassMode: 'pulse',
      harmony: 2,
      steps: [
        [NOTE.A3, 0.09], [NOTE.C4, 0.09], [NOTE.E4, 0.09], [NOTE.A4, 0.09],
        [NOTE.G4, 0.09], [NOTE.E4, 0.09], [NOTE.C4, 0.09], [NOTE.A3, 0.09],
        [NOTE.B3, 0.09], [NOTE.D4, 0.09], [NOTE.F4, 0.09], [NOTE.A4, 0.09],
        [NOTE.G4, 0.09], [NOTE.E4, 0.09], [NOTE.C4, 0.09], [NOTE.A3, 0.14],
      ],
    },
    /* 吃豆人：轻快跳跃，八分音符律动 */
    pacman: {
      wave: 'square',
      vol: 0.032,
      bassVol: 0.018,
      bassMode: 'pulse',
      harmony: 0,
      steps: [
        [NOTE.C4, 0.08], [NOTE.E4, 0.08], [NOTE.G4, 0.08], [NOTE.C5, 0.08],
        [NOTE.G4, 0.08], [NOTE.E4, 0.08], [NOTE.C4, 0.08], [NOTE.G3, 0.08],
        [NOTE.A3, 0.08], [NOTE.C4, 0.08], [NOTE.E4, 0.08], [NOTE.A4, 0.08],
        [NOTE.E4, 0.08], [NOTE.C4, 0.08], [NOTE.A3, 0.08], [NOTE.E3, 0.12],
      ],
    },
    platform: {
      wave: 'triangle',
      vol: 0.028,
      bassVol: 0.02,
      bassMode: 'pulse',
      harmony: 1,
      steps: [
        [NOTE.E4, 0.1], [NOTE.G4, 0.1], [NOTE.A4, 0.1], [NOTE.B4, 0.1],
        [NOTE.A4, 0.1], [NOTE.G4, 0.1], [NOTE.E4, 0.1], [NOTE.D4, 0.1],
        [NOTE.C4, 0.1], [NOTE.D4, 0.1], [NOTE.E4, 0.1], [NOTE.G4, 0.1],
        [NOTE.A4, 0.1], [NOTE.G4, 0.1], [NOTE.E4, 0.1], [NOTE.C4, 0.14],
      ],
    },
  };

  const CLICK = {
    hub: { freq: 523, wave: 'sine', vol: 0.032, dur: 0.04 },
    menu: { freq: 659, wave: 'triangle', vol: 0.036, dur: 0.035 },
    snake: { freq: 392, wave: 'square', vol: 0.026, dur: 0.025 },
    tetris: { freq: 587, wave: 'triangle', vol: 0.03, dur: 0.028 },
    shooter: { freq: 880, wave: 'square', vol: 0.024, dur: 0.022 },
    pacman: { freq: 440, wave: 'square', vol: 0.028, dur: 0.03 },
    platform: { freq: 520, wave: 'triangle', vol: 0.03, dur: 0.032 },
  };

  const FAIL = {
    snake: {
      notes: [NOTE.C5, NOTE.A4, NOTE.F4, NOTE.D4, NOTE.C4, NOTE.A3],
      step: 0.11,
      wave: 'square',
      tail: () => playTone(NOTE.G2, 0.25, 'triangle', 0.055),
    },
    tetris: {
      notes: [NOTE.E5, NOTE.C5, NOTE.A4, NOTE.F4, NOTE.D4, NOTE.C4, NOTE.A3],
      step: 0.1,
      wave: 'triangle',
      tail: () => {
        playTone(NOTE.C3, 0.4, 'triangle', 0.06);
        setTimeout(() => playNoise(0.08, 0.03), 120);
      },
    },
    shooter: {
      notes: [NOTE.A4, NOTE.F4, NOTE.D4, NOTE.A3, NOTE.F3, NOTE.D3],
      step: 0.09,
      wave: 'sawtooth',
      tail: () => {
        playNoise(0.2, 0.05);
        setTimeout(() => playTone(55, 0.3, 'triangle', 0.05), 80);
      },
    },
    pacman: {
      notes: [NOTE.E4, NOTE.C4, NOTE.A3, NOTE.G3, NOTE.E3, NOTE.C3],
      step: 0.12,
      wave: 'square',
      tail: () => playTone(NOTE.G2, 0.35, 'triangle', 0.05),
    },
    platform: {
      notes: [NOTE.G4, NOTE.E4, NOTE.C4, NOTE.A3, NOTE.G3, NOTE.E3],
      step: 0.11,
      wave: 'triangle',
      tail: () => playTone(NOTE.C3, 0.3, 'triangle', 0.05),
    },
    default: {
      notes: [NOTE.G4, NOTE.E4, NOTE.C4, NOTE.A3],
      step: 0.13,
      wave: 'triangle',
      tail: null,
    },
  };

  let ctx = null;
  let master = null;
  let bgmGain = null;
  let sfxGain = null;
  let unlocked = false;
  let bgmPlaying = false;
  let bgmStep = 0;
  let bgmTimer = null;
  let currentScene = 'hub';
  let currentTrack = BGM.hub;
  let musicChangeListeners = [];

  let settings = { music: true, sfx: true };

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        settings.music = parsed.music !== false;
        settings.sfx = parsed.sfx !== false;
      }
    } catch (_) {}
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (_) {}
  }

  function notifyMusicChange() {
    musicChangeListeners.forEach((fn) => {
      try {
        fn(settings.music);
      } catch (_) {}
    });
  }

  function onMusicChange(fn) {
    if (typeof fn === 'function') musicChangeListeners.push(fn);
  }

  function isMusicEnabled() {
    return settings.music;
  }

  function isSfxEnabled() {
    return settings.sfx;
  }

  function setMusic(on) {
    settings.music = !!on;
    saveSettings();
    if (!settings.music) stopBgm();
    else if (unlocked) setScene(currentScene, true);
    notifyMusicChange();
    syncToggleUI();
  }

  function setSfx(on) {
    settings.sfx = !!on;
    saveSettings();
    syncToggleUI();
  }

  function getCtx() {
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      ctx = new Ctx();
      master = ctx.createGain();
    master.gain.value = 1.0;
    master.connect(ctx.destination);
    bgmGain = ctx.createGain();
    bgmGain.gain.value = settings.music ? 1 : 0;
    bgmGain.connect(master);
    sfxGain = ctx.createGain();
    sfxGain.gain.value = 0.6;
    sfxGain.connect(master);
    }
    return ctx;
  }

  function unlock() {
    const ac = getCtx();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    if (!unlocked) {
      unlocked = true;
      if (settings.music) setScene(currentScene, true);
    }
  }

  function playTone(freq, duration, type, volume, dest, when, forBgm) {
    if (forBgm) {
      if (!settings.music) return;
    } else if (!settings.sfx) {
      return;
    }
    if (!freq || freq <= 0) return;
    const ac = getCtx();
    if (!ac || !unlocked) return;
    const t = when != null ? when : ac.currentTime;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    const vol = volume || 0.06;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(gain);
    gain.connect(dest || sfxGain);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  }

  function playNoise(duration, volume, when) {
    if (!settings.sfx) return;
    const ac = getCtx();
    if (!ac || !unlocked) return;
    const t = when != null ? when : ac.currentTime;
    const bufferSize = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (i < 60 ? 0.55 : 0.12);
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    const gain = ac.createGain();
    gain.gain.setValueAtTime(volume || 0.025, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(gain);
    gain.connect(sfxGain);
    src.start(t);
    src.stop(t + duration);
  }

  function playMelody(notes, step, dest, wave) {
    const ac = getCtx();
    if (!ac || !unlocked || !settings.sfx) return;
    const t0 = ac.currentTime;
    const w = wave || 'triangle';
    notes.forEach((freq, i) => {
      playTone(freq, 0.14, w, 0.055, dest || sfxGain, t0 + i * step);
    });
  }

  function click() {
    const cfg = CLICK[currentScene] || CLICK.menu;
    playTone(cfg.freq, cfg.dur, cfg.wave, cfg.vol * 1.5);
  }

  function portal() {
    playTone(NOTE.C4, 0.05, 'sine', 0.04);
    setTimeout(() => playTone(NOTE.E4, 0.07, 'triangle', 0.038), 50);
    setTimeout(() => playTone(NOTE.G4, 0.09, 'triangle', 0.032), 110);
  }

  /* —— 贪吃蛇 —— */
  function snakeEat() {
    playTone(NOTE.E4, 0.05, 'square', 0.038);
    setTimeout(() => playTone(NOTE.G4, 0.07, 'triangle', 0.04), 35);
  }

  function snakeTurn() {
    playTone(NOTE.A3, 0.02, 'square', 0.022);
  }

  /* —— 俄罗斯方块 —— */
  function tetrisMove() {
    playTone(NOTE.G3, 0.018, 'triangle', 0.02);
  }

  function tetrisRotate() {
    playTone(NOTE.C4, 0.028, 'triangle', 0.026);
    setTimeout(() => playTone(NOTE.E4, 0.02, 'triangle', 0.018), 25);
  }

  function tetrisLine(lines) {
    const n = Math.min(4, lines || 1);
    const arps = [
      [NOTE.C4, NOTE.E4],
      [NOTE.C4, NOTE.E4, NOTE.G4],
      [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5],
      [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5, NOTE.E5],
    ];
    playMelody(arps[n - 1], 0.08, sfxGain, 'square');
    playNoise(0.12, 0.04);
  }

  function tetrisDrop() {
    playTone(NOTE.A2, 0.045, 'triangle', 0.032);
    playNoise(0.03, 0.018);
  }

  /* —— 弹幕射击 —— */
  function shoot() {
    playTone(720, 0.022, 'square', 0.05);
  }

  function hit() {
    playTone(140, 0.055, 'sawtooth', 0.06);
    playNoise(0.035, 0.04);
  }

  function explode() {
    playTone(180, 0.045, 'square', 0.06);
    setTimeout(() => playTone(90, 0.07, 'triangle', 0.05), 20);
    playNoise(0.055, 0.04);
  }

  function bomb() {
    if (!settings.sfx || !unlocked) return;
    playTone(65, 0.1, 'sawtooth', 0.055);
    playNoise(0.16, 0.04);
    setTimeout(() => playTone(45, 0.14, 'triangle', 0.04), 45);
  }

  function powerup() {
    playTone(NOTE.C5, 0.05, 'square', 0.042);
    setTimeout(() => playTone(NOTE.E5, 0.06, 'triangle', 0.04), 45);
    setTimeout(() => playTone(NOTE.G5, 0.08, 'square', 0.038), 95);
  }

  /* —— 吃豆人 —— */
  function pacmanEat() {
    playTone(NOTE.C5, 0.04, 'square', 0.032);
  }

  function pacmanPower() {
    playTone(NOTE.G4, 0.06, 'square', 0.04);
    setTimeout(() => playTone(NOTE.C5, 0.08, 'triangle', 0.038), 60);
  }

  function pacmanGhost() {
    playTone(NOTE.E5, 0.07, 'square', 0.045);
    setTimeout(() => playTone(NOTE.G5, 0.09, 'triangle', 0.04), 50);
  }

  function pacmanTurn() {
    playTone(NOTE.A3, 0.015, 'square', 0.018);
  }

  function pacmanDie() {
    playTone(NOTE.A4, 0.08, 'square', 0.05);
    setTimeout(() => playTone(NOTE.E4, 0.1, 'triangle', 0.045), 70);
    setTimeout(() => playTone(NOTE.C4, 0.14, 'triangle', 0.04), 160);
  }

  function platformJump() {
    playTone(NOTE.C5, 0.05, 'square', 0.034);
    setTimeout(() => playTone(NOTE.E5, 0.04, 'triangle', 0.028), 35);
  }

  function platformCoin() {
    playTone(NOTE.G5, 0.05, 'square', 0.032);
    setTimeout(() => playTone(NOTE.C6, 0.06, 'triangle', 0.028), 40);
  }

  function platformHit() {
    playTone(NOTE.A3, 0.09, 'sawtooth', 0.05);
    setTimeout(() => playTone(NOTE.E3, 0.12, 'triangle', 0.04), 60);
  }

  function gameOver(game) {
    if (!settings.sfx || !unlocked) return;
    duckBgm(0.2, 1.6);
    const cfg = FAIL[game] || FAIL.default;
    playMelody(cfg.notes, cfg.step, sfxGain, cfg.wave);
    playNoise(0.08, 0.028);
    if (cfg.tail) {
      setTimeout(cfg.tail, cfg.notes.length * cfg.step * 1000 + 60);
    }
  }

  function duckBgm(level, duration) {
    if (!bgmGain || !ctx || !settings.music) return;
    const t = ctx.currentTime;
    bgmGain.gain.cancelScheduledValues(t);
    bgmGain.gain.setValueAtTime(level, t);
    bgmGain.gain.linearRampToValueAtTime(1, t + duration);
  }

  function tickBgm() {
    if (!bgmPlaying || !unlocked || !settings.music) return;
    const cfg = currentTrack;
    const raw = cfg.steps[bgmStep % cfg.steps.length];
    const freq = raw[0];
    const dur = raw[1];
    const stepWave = raw[2] || cfg.wave || 'triangle';

    if (freq > 0) {
      playTone(freq, dur * 0.9, stepWave, cfg.vol, bgmGain, null, true);

      if (cfg.harmony > 0 && bgmStep % cfg.harmony === 0) {
        playTone(freq * 1.25, dur * 0.85, 'sine', cfg.vol * 0.45, bgmGain, null, true);
      }

      if (cfg.bassMode === 'follow' && cfg.bassVol) {
        playTone(freq / 2, dur * 0.9, 'triangle', cfg.bassVol, bgmGain, null, true);
      }
    }

    if (cfg.bassMode === 'pulse' && cfg.bassVol && bgmStep % 4 === 0 && freq > 0) {
      playTone(Math.min(freq, NOTE.A3), dur * 0.95, 'triangle', cfg.bassVol, bgmGain, null, true);
    }

    bgmStep++;
    bgmTimer = setTimeout(tickBgm, Math.max(70, dur * 1000));
  }

  function setScene(scene, forceRestart) {
    const track = BGM[scene] || BGM.hub;
    const changed = scene !== currentScene || forceRestart;
    currentScene = scene;
    currentTrack = track;
    if (!settings.music || !unlocked) return;
    if (changed) {
      stopBgm();
      bgmStep = 0;
      startBgm();
    }
  }

  function startBgm() {
    if (!settings.music) return;
    getCtx();
    if (!ctx) return;
    bgmPlaying = true;
    if (bgmGain) bgmGain.gain.value = 1;
    if (!bgmTimer) tickBgm();
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmTimer) {
      clearTimeout(bgmTimer);
      bgmTimer = null;
    }
    if (bgmGain && ctx) {
      bgmGain.gain.setValueAtTime(0, ctx.currentTime);
    }
  }

  let musicToggleEl = null;
  let sfxToggleEl = null;

  function syncToggleUI() {
    if (musicToggleEl) musicToggleEl.checked = settings.music;
    if (sfxToggleEl) sfxToggleEl.checked = settings.sfx;
  }

  function bindSettingsUI() {
    musicToggleEl = document.getElementById('toggle-music');
    sfxToggleEl = document.getElementById('toggle-sfx');
    syncToggleUI();
    if (musicToggleEl) {
      musicToggleEl.addEventListener('change', () => {
        unlock();
        setMusic(musicToggleEl.checked);
      });
    }
    if (sfxToggleEl) {
      sfxToggleEl.addEventListener('change', () => {
        unlock();
        setSfx(sfxToggleEl.checked);
      });
    }
  }

  function bindClicks() {
    const selector =
      'button, .hub-portal, .pick-card, .mode-card, .btn-go, .vkey, .hub-media-btn, [tabindex="0"]';

    document.addEventListener(
      'click',
      (e) => {
        const el = e.target.closest(selector);
        if (!el) return;
        if (el.closest && el.closest('.audio-settings')) return;
        if (el.closest && el.closest('.media-music-list')) return;
        if (el.closest && el.closest('.media-video-list')) return;
        if (el.closest && el.closest('.music-player')) return;
        if (el.closest && el.closest('.video-player-controls')) return;
        if (el.closest && el.closest('.music-progress-wrap-inner')) return;
        if (el.closest && el.closest('#video-progress-wrap')) return;
        if (el.closest && el.closest('.video-progress-wrap-inner')) return;
        if (el.closest && el.closest('#video-seek-slider')) return;
        if (el.closest && el.closest('.music-progress-wrap')) return;
        if (el.tagName === 'INPUT' && el.type === 'range') return;
        unlock();
        const ac = getCtx();
        if (ac && ac.state === 'suspended') {
          ac.resume();
        }
        if (el.classList.contains('hub-portal')) portal();
        else click();
      },
      true
    );
  }

  const VIEW_BGM = {
    hub: 'hub',
    'game-select': 'menu',
    'snake-select': 'menu',
    'shooter-select': 'menu',
    'pacman-select': 'menu',
    'platform-select': 'menu',
    'media-gallery': 'menu',
    'media-video': 'menu',
    snake: 'snake',
    tetris: 'tetris',
    shooter: 'shooter',
    pacman: 'pacman',
    platform: 'platform',
  };

  function setSceneForView(viewName) {
    if (viewName === 'media-music') {
      stopBgm();
      return;
    }
    setScene(VIEW_BGM[viewName] || 'hub');
  }

  loadSettings();

  setTimeout(() => {
    getCtx();
    unlock();
    const ac = getCtx();
    if (ac) {
      if (ac.resume && ac.state === 'suspended') {
        ac.resume();
      }
    }
  }, 50);

  return {
    unlock,
    click,
    portal,
    snakeEat,
    snakeTurn,
    tetrisMove,
    tetrisRotate,
    tetrisLine,
    tetrisDrop,
    shoot,
    hit,
    explode,
    bomb,
    powerup,
    pacmanEat,
    pacmanPower,
    pacmanGhost,
    pacmanTurn,
    pacmanDie,
    platformJump,
    platformCoin,
    platformHit,
    gameOver,
    setScene,
    setSceneForView,
    startBgm,
    stopBgm,
    setMusic,
    setSfx,
    isMusicEnabled,
    isSfxEnabled,
    onMusicChange,
    bindClicks,
    bindSettingsUI,
  };
})();
