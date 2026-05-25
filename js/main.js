/**
 * Lv999协议终端 - 主控制器
 */
(function () {
  function syncViewportUnits() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-vh', `${vh}px`);
  }
  syncViewportUnits();
  window.addEventListener('resize', syncViewportUnits);
  window.addEventListener('orientationchange', syncViewportUnits);

  const views = {
    hub: document.getElementById('view-hub'),
    gameSelect: document.getElementById('view-game-select'),
    snakeSelect: document.getElementById('view-snake-select'),
    shooterSelect: document.getElementById('view-shooter-select'),
    pacmanSelect: document.getElementById('view-pacman-select'),
    platformSelect: document.getElementById('view-platform-select'),
    mediaMusic: document.getElementById('view-media-music'),
    mediaGallery: document.getElementById('view-media-gallery'),
    mediaVideo: document.getElementById('view-media-video'),
    snake: document.getElementById('view-snake'),
    tetris: document.getElementById('view-tetris'),
    shooter: document.getElementById('view-shooter'),
    pacman: document.getElementById('view-pacman'),
    platform: document.getElementById('view-platform'),
  };

  const hubEntry = document.getElementById('hub-entry');
  const hubBgCanvas = document.getElementById('hub-bg-canvas');

  const snakeControls = document.getElementById('snake-controls');
  const tetrisControls = document.getElementById('tetris-controls');
  const shooterControls = document.getElementById('shooter-controls');
  const pacmanControls = document.getElementById('pacman-controls');
  const platformControls = document.getElementById('platform-controls');
  const snakeCanvas = document.getElementById('snake-canvas');
  const tetrisCanvas = document.getElementById('tetris-canvas');
  const shooterCanvas = document.getElementById('shooter-canvas');
  const pacmanCanvas = document.getElementById('pacman-canvas');
  const platformCanvas = document.getElementById('platform-canvas');
  const snakeScore = document.getElementById('snake-score');
  const snakeStatus = document.getElementById('snake-status');
  const snakeModeLabel = document.getElementById('snake-mode-label');
  const tetrisScore = document.getElementById('tetris-score');
  const tetrisLevel = document.getElementById('tetris-level');
  const tetrisLines = document.getElementById('tetris-lines');
  const tetrisStatus = document.getElementById('tetris-status');
  const shooterScore = document.getElementById('shooter-score');
  const shooterLives = document.getElementById('shooter-lives');
  const shooterBombs = document.getElementById('shooter-bombs');
  const shooterLevel = document.getElementById('shooter-level');
  const shooterStage = document.getElementById('shooter-stage');
  const shooterModeLabel = document.getElementById('shooter-mode-label');
  const shooterGameOverTitle = document.getElementById('shooter-game-over-title');
  const shooterGameOverSub = document.getElementById('shooter-game-over-sub');
  const pacmanScore = document.getElementById('pacman-score');
  const pacmanLives = document.getElementById('pacman-lives');
  const pacmanLevel = document.getElementById('pacman-level');
  const pacmanStatus = document.getElementById('pacman-status');
  const pacmanModeLabel = document.getElementById('pacman-mode-label');
  const pacmanGoSub = document.getElementById('pacman-go-sub');
  const pacmanFinalLevel = document.getElementById('pacman-final-level');

  const snakeGameOverEl = document.getElementById('snake-game-over');
  const tetrisGameOverEl = document.getElementById('tetris-game-over');
  const shooterGameOverEl = document.getElementById('shooter-game-over');
  const pacmanGameOverEl = document.getElementById('pacman-game-over');
  const snakeFinalScore = document.getElementById('snake-final-score');
  const tetrisFinalScore = document.getElementById('tetris-final-score');
  const shooterFinalScore = document.getElementById('shooter-final-score');
  const pacmanFinalScore = document.getElementById('pacman-final-score');
  const platformScore = document.getElementById('platform-score');
  const platformLives = document.getElementById('platform-lives');
  const platformLevel = document.getElementById('platform-level');
  const platformStatus = document.getElementById('platform-status');
  const platformModeLabel = document.getElementById('platform-mode-label');
  const platformGoSub = document.getElementById('platform-go-sub');
  const platformFinalLevel = document.getElementById('platform-final-level');
  const platformGameOverEl = document.getElementById('platform-game-over');
  const platformGameOverTitle = document.getElementById('platform-game-over-title');
  const platformFinalScore = document.getElementById('platform-final-score');

  let currentView = 'hub';
  let currentGame = null;
  let snakeMode = 'bounded';
  let shooterMode = 'classic';
  let pacmanMode = 'classic';
  let platformMode = 'classic';
  let gameOverActive = false;

  const KEY_MAP = {
    w: 'up',
    a: 'left',
    s: 'down',
    d: 'right',
    W: 'up',
    A: 'left',
    S: 'down',
    D: 'right',
  };

  const TETRIS_KEY_MAP = {
    ...KEY_MAP,
    ' ': 'hardDrop',
    p: 'pause',
    P: 'pause',
  };

  const SHOOTER_KEY_MAP = {
    ...KEY_MAP,
    ' ': 'fire',
  };

  const PLATFORM_KEY_MAP = {
    a: 'left',
    d: 'right',
    A: 'left',
    D: 'right',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ' ': 'jump',
    ArrowUp: 'jump',
    w: 'fire',
    W: 'fire',
  };

  function showView(name) {
    const prevView = currentView;
    const map = {
      hub: 'hub',
      'game-select': 'gameSelect',
      'snake-select': 'snakeSelect',
      'shooter-select': 'shooterSelect',
      'pacman-select': 'pacmanSelect',
      'platform-select': 'platformSelect',
      'media-music': 'mediaMusic',
      'media-gallery': 'mediaGallery',
      'media-video': 'mediaVideo',
      snake: 'snake',
      tetris: 'tetris',
      shooter: 'shooter',
      pacman: 'pacman',
      platform: 'platform',
    };
    Object.keys(views).forEach((key) => {
      views[key].classList.toggle('view-active', key === map[name]);
    });
    currentView = name;

    const showSnakePad = name === 'snake' && !gameOverActive;
    const showTetrisPad = name === 'tetris' && !gameOverActive;
    const showShooterPad = name === 'shooter' && !gameOverActive;
    const showPacmanPad = name === 'pacman' && !gameOverActive;
    const showPlatformPad = name === 'platform' && !gameOverActive;
    snakeControls.classList.toggle('hidden', !showSnakePad);
    tetrisControls.classList.toggle('hidden', !showTetrisPad);
    shooterControls.classList.toggle('hidden', !showShooterPad);
    pacmanControls.classList.toggle('hidden', !showPacmanPad);
    platformControls.classList.toggle('hidden', !showPlatformPad);

    if (name === 'hub') {
      HubClock.start();
      if (hubBgCanvas) HubBg.start(hubBgCanvas);
    } else {
      HubClock.stop();
      HubBg.stop();
    }

    if (prevView === 'media-video' && name !== 'media-video') {
      MediaHub.onLeaveVideo();
    }
    if (prevView === 'media-music' && name !== 'media-music') {
      MediaHub.onLeaveMusic();
    }
    if (name === 'media-music') MediaHub.onEnterMusic();
    if (name === 'media-gallery') MediaHub.onEnterGallery();
    if (name === 'media-video') MediaHub.onEnterVideo();

    Sfx.setSceneForView(name);
  }

  function showGameOver(game, score, opts) {
    gameOverActive = true;
    snakeControls.classList.add('hidden');
    tetrisControls.classList.add('hidden');
    shooterControls.classList.add('hidden');
    pacmanControls.classList.add('hidden');
    platformControls.classList.add('hidden');
    const cleared = (game === 'shooter' || game === 'platform') && opts && opts.victory;
    if (!cleared) Sfx.gameOver(game);
    else Sfx.portal();

    if (game === 'snake') {
      snakeFinalScore.textContent = String(score);
      snakeGameOverEl.classList.remove('hidden');
    } else if (game === 'tetris') {
      tetrisFinalScore.textContent = String(score);
      tetrisGameOverEl.classList.remove('hidden');
    } else if (game === 'shooter') {
      shooterFinalScore.textContent = String(score);
      if (shooterGameOverTitle) {
        shooterGameOverTitle.textContent = cleared ? 'MISSION CLEAR' : 'GAME OVER';
      }
      if (shooterGameOverSub) {
        if (cleared) {
          shooterGameOverSub.textContent = '// 全关卡 Boss 已击破';
          shooterGameOverSub.classList.remove('hidden');
        } else {
          shooterGameOverSub.textContent = '';
          shooterGameOverSub.classList.add('hidden');
        }
      }
      shooterGameOverEl.classList.remove('hidden');
    } else if (game === 'pacman') {
      pacmanFinalScore.textContent = String(score);
      if (pacmanFinalLevel) pacmanFinalLevel.textContent = String(opts?.level || 1);
      if (pacmanGoSub) {
        const label = opts?.modeLabel || '经典';
        pacmanGoSub.textContent = `// ${label} · 第 ${opts?.level || 1} 关`;
      }
      pacmanGameOverEl.classList.remove('hidden');
    } else if (game === 'platform') {
      platformFinalScore.textContent = String(score);
      if (platformFinalLevel) platformFinalLevel.textContent = String(opts?.level || 1);
      if (platformGameOverTitle) {
        platformGameOverTitle.textContent = cleared ? 'STAGE CLEAR' : 'GAME OVER';
      }
      if (platformGoSub) {
        const label = opts?.modeLabel || '经典';
        platformGoSub.textContent = cleared
          ? `// ${label} · 全关卡突破`
          : `// ${label} · 第 ${opts?.level || 1} 关`;
      }
      platformGameOverEl.classList.remove('hidden');
    }
  }

  function hideGameOver(game) {
    if (game === 'snake' || game === 'all') snakeGameOverEl.classList.add('hidden');
    if (game === 'tetris' || game === 'all') tetrisGameOverEl.classList.add('hidden');
    if (game === 'shooter' || game === 'all') {
      shooterGameOverEl.classList.add('hidden');
      if (shooterGameOverSub) shooterGameOverSub.classList.add('hidden');
    }
    if (game === 'pacman' || game === 'all') pacmanGameOverEl.classList.add('hidden');
    if (game === 'platform' || game === 'all') platformGameOverEl.classList.add('hidden');
    gameOverActive = false;
  }

  function stopCurrentGame() {
    hideGameOver('all');
    if (currentGame === 'snake') SnakeGame.destroy();
    else if (currentGame === 'tetris') TetrisGame.destroy();
    else if (currentGame === 'shooter') ShooterGame.destroy();
    else if (currentGame === 'pacman') PacmanGame.destroy();
    else if (currentGame === 'platform') PlatformGame.destroy();
    currentGame = null;
  }

  function startSnakePlay(mode) {
    snakeMode = mode;
    stopCurrentGame();
    hideGameOver('snake');
    showView('snake');
    currentGame = 'snake';
    SnakeGame.init(
      snakeCanvas,
      { score: snakeScore, status: snakeStatus, modeLabel: snakeModeLabel },
      snakeMode,
      (finalScore) => showGameOver('snake', finalScore)
    );
  }

  function showSnakeModeSelect() {
    stopCurrentGame();
    showView('snake-select');
    currentGame = null;
  }

  function showShooterModeSelect() {
    stopCurrentGame();
    showView('shooter-select');
    currentGame = null;
  }

  function startShooterPlay(mode) {
    shooterMode = mode;
    stopCurrentGame();
    hideGameOver('shooter');
    showView('shooter');
    currentGame = 'shooter';
    ShooterGame.init(
      shooterCanvas,
      {
        score: shooterScore,
        lives: shooterLives,
        bombs: shooterBombs,
        level: shooterLevel,
        stage: shooterStage,
        modeLabel: shooterModeLabel,
      },
      shooterMode,
      (finalScore, opts) => showGameOver('shooter', finalScore, opts)
    );
  }

  function showPacmanModeSelect() {
    stopCurrentGame();
    showView('pacman-select');
    currentGame = null;
  }

  function startPacmanPlay(mode) {
    pacmanMode = mode;
    stopCurrentGame();
    hideGameOver('pacman');
    showView('pacman');
    currentGame = 'pacman';
    PacmanGame.init(
      pacmanCanvas,
      {
        score: pacmanScore,
        lives: pacmanLives,
        level: pacmanLevel,
        status: pacmanStatus,
        modeLabel: pacmanModeLabel,
      },
      pacmanMode,
      (finalScore, opts) => showGameOver('pacman', finalScore, opts)
    );
  }

  function startPlatform() {
    showPlatformModeSelect();
  }

  function showPlatformModeSelect() {
    stopCurrentGame();
    showView('platform-select');
    currentGame = null;
  }

  function startPlatformPlay(mode) {
    platformMode = mode;
    stopCurrentGame();
    hideGameOver('platform');
    showView('platform');
    currentGame = 'platform';
    PlatformGame.init(
      platformCanvas,
      {
        score: platformScore,
        lives: platformLives,
        level: platformLevel,
        status: platformStatus,
        modeLabel: platformModeLabel,
      },
      platformMode,
      (finalScore, opts) => showGameOver('platform', finalScore, opts)
    );
  }

  function startPacman() {
    showPacmanModeSelect();
  }

  function startTetris() {
    stopCurrentGame();
    hideGameOver('tetris');
    showView('tetris');
    currentGame = 'tetris';
    TetrisGame.init(
      tetrisCanvas,
      {
        score: tetrisScore,
        level: tetrisLevel,
        lines: tetrisLines,
        status: tetrisStatus,
      },
      (finalScore) => showGameOver('tetris', finalScore)
    );
  }

  function goHub() {
    stopCurrentGame();
    showView('hub');
  }

  function showGameSelect() {
    stopCurrentGame();
    showView('game-select');
    currentGame = null;
  }

  function retryGame(game) {
    hideGameOver(game);
    if (game === 'snake' && currentGame === 'snake') {
      SnakeGame.restart();
      showView('snake');
    } else if (game === 'tetris' && currentGame === 'tetris') {
      TetrisGame.restart();
      showView('tetris');
    } else if (game === 'shooter' && currentGame === 'shooter') {
      ShooterGame.restart();
      showView('shooter');
    } else if (game === 'pacman' && currentGame === 'pacman') {
      PacmanGame.restart();
      showView('pacman');
    } else if (game === 'platform' && currentGame === 'platform') {
      PlatformGame.restart();
      showView('platform');
    }
  }

  function exitGame(game) {
    hideGameOver(game);
    if (game === 'snake') {
      SnakeGame.destroy();
      currentGame = null;
      showSnakeModeSelect();
    } else if (game === 'tetris') {
      TetrisGame.destroy();
      currentGame = null;
      showGameSelect();
    } else if (game === 'shooter') {
      ShooterGame.destroy();
      currentGame = null;
      showShooterModeSelect();
    } else if (game === 'pacman') {
      PacmanGame.destroy();
      currentGame = null;
      showPacmanModeSelect();
    } else if (game === 'platform') {
      PlatformGame.destroy();
      currentGame = null;
      showPlatformModeSelect();
    }
  }

  function dispatchInput(action, pressed) {
    if (!currentGame || gameOverActive) return;
    if (currentGame === 'snake') {
      if (['up', 'down', 'left', 'right'].includes(action)) {
        SnakeGame.handleInput(action);
      }
    } else if (currentGame === 'pacman') {
      if (['up', 'down', 'left', 'right'].includes(action)) {
        PacmanGame.handleInput(action);
      }
    } else if (currentGame === 'tetris') {
      TetrisGame.handleInput(action);
    } else if (currentGame === 'shooter') {
      if (action === 'bomb') {
        if (pressed !== false) ShooterGame.handleInput('bomb', true);
      } else {
        ShooterGame.handleInput(action, pressed !== false);
      }
    } else if (currentGame === 'platform') {
      PlatformGame.handleInput(action, pressed !== false);
    }
  }

  function onKeyDown(e) {
    if (
      currentView === 'hub' ||
      currentView === 'game-select' ||
      currentView === 'snake-select' ||
      currentView === 'shooter-select' ||
      currentView === 'pacman-select' ||
      currentView === 'platform-select' ||
      currentView === 'media-music' ||
      currentView === 'media-gallery' ||
      currentView === 'media-video'
    ) {
      return;
    }
    if (gameOverActive) return;

    let gameKeys = ['w', 'a', 's', 'd', 'W', 'A', 'S', 'D'];
    if (currentGame === 'tetris') gameKeys = [...gameKeys, ' ', 'p', 'P'];
    if (currentGame === 'shooter') gameKeys = [...gameKeys, ' ', 'b', 'B'];
    if (currentGame === 'platform') gameKeys = [...gameKeys, ' ', 'w', 'W', 'ArrowUp', 'ArrowLeft', 'ArrowRight'];

    if (gameKeys.includes(e.key)) e.preventDefault();

    if (currentGame === 'snake') {
      const action = KEY_MAP[e.key];
      if (action) dispatchInput(action, true);
    } else if (currentGame === 'pacman') {
      const action = KEY_MAP[e.key];
      if (action) dispatchInput(action, true);
    } else if (currentGame === 'tetris') {
      const action = TETRIS_KEY_MAP[e.key];
      if (action) dispatchInput(action, true);
    } else if (currentGame === 'shooter') {
      if (e.key >= '0' && e.key <= '9') return;
      const action = SHOOTER_KEY_MAP[e.key];
      if (action === 'bomb') {
        e.preventDefault();
        dispatchInput('bomb', true);
      } else if (action) {
        dispatchInput(action, true);
      }
    } else if (currentGame === 'platform') {
      const action = PLATFORM_KEY_MAP[e.key];
      if (action) dispatchInput(action, true);
    }
  }

  function onKeyUp(e) {
    if (gameOverActive) return;
    if (currentGame === 'shooter') {
      const action = SHOOTER_KEY_MAP[e.key];
      if (action && action !== 'bomb') {
        e.preventDefault();
        dispatchInput(action, false);
      }
    } else if (currentGame === 'platform') {
      const action = PLATFORM_KEY_MAP[e.key];
      if (action && action !== 'fire') {
        e.preventDefault();
        dispatchInput(action, false);
      } else if (action === 'fire') {
        e.preventDefault();
        dispatchInput('fire', false);
      }
    }
  }

  function bindVirtualKeys(root) {
    root.querySelectorAll('.vkey[data-action]').forEach((btn) => {
      const action = btn.dataset.action;
      const isHold = action === 'fire' || action === 'jump';
      const down = (e) => {
        e.preventDefault();
        dispatchInput(action, true);
      };
      const up = (e) => {
        e.preventDefault();
        if (isHold) dispatchInput(action, false);
      };
      btn.addEventListener('pointerdown', down);
      if (isHold) {
        btn.addEventListener('pointerup', up);
        btn.addEventListener('pointerleave', up);
      }
      btn.addEventListener('click', (e) => e.preventDefault());
    });
  }

  function bindHub() {
    const openGames = () => showGameSelect();
    hubEntry.addEventListener('click', openGames);
    hubEntry.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openGames();
      }
    });

    document.querySelectorAll('.hub-media-btn').forEach((btn) => {
      const open = () => {
        const m = btn.dataset.media;
        if (m === 'music') showView('media-music');
        else if (m === 'gallery') showView('media-gallery');
        else if (m === 'video') showView('media-video');
      };
      btn.addEventListener('click', open);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function bindGameSelect() {
    document.querySelectorAll('.pick-card[data-game]').forEach((card) => {
      const game = card.dataset.game;
      const open = () => {
        if (game === 'snake') showSnakeModeSelect();
        else if (game === 'tetris') startTetris();
        else if (game === 'pacman') startPacman();
        else if (game === 'shooter') showShooterModeSelect();
        else if (game === 'platform') showPlatformModeSelect();
      };
      card.addEventListener('click', open);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      });
    });
  }

  function bindSnakeModes() {
    document.querySelectorAll('[data-snake-mode]').forEach((card) => {
      const mode = card.dataset.snakeMode;
      const start = () => startSnakePlay(mode);
      card.addEventListener('click', start);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      });
    });
  }

  function bindShooterModes() {
    document.querySelectorAll('[data-shooter-mode]').forEach((card) => {
      const mode = card.dataset.shooterMode;
      const start = () => startShooterPlay(mode);
      card.addEventListener('click', start);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      });
    });
  }

  function bindPacmanModes() {
    document.querySelectorAll('[data-pacman-mode]').forEach((card) => {
      const mode = card.dataset.pacmanMode;
      const start = () => startPacmanPlay(mode);
      card.addEventListener('click', start);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      });
    });
  }

  function bindPlatformModes() {
    document.querySelectorAll('[data-platform-mode]').forEach((card) => {
      const mode = card.dataset.platformMode;
      const start = () => startPlatformPlay(mode);
      card.addEventListener('click', start);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          start();
        }
      });
    });
  }

  function bindBack() {
    document.querySelectorAll('[data-back-hub]').forEach((btn) => {
      btn.addEventListener('click', goHub);
    });
    document.querySelectorAll('[data-back-games]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopCurrentGame();
        showGameSelect();
      });
    });
    document.querySelectorAll('[data-back-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopCurrentGame();
        showSnakeModeSelect();
      });
    });
    document.querySelectorAll('[data-back-shooter-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopCurrentGame();
        showShooterModeSelect();
      });
    });
    document.querySelectorAll('[data-back-pacman-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopCurrentGame();
        showPacmanModeSelect();
      });
    });
    document.querySelectorAll('[data-back-platform-mode]').forEach((btn) => {
      btn.addEventListener('click', () => {
        stopCurrentGame();
        showPlatformModeSelect();
      });
    });
  }

  function bindGameOver() {
    document.querySelectorAll('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.go;
        const game = btn.dataset.game;
        if (action === 'retry') retryGame(game);
        else if (action === 'exit') exitGame(game);
      });
    });
  }

  document.addEventListener('keydown', onKeyDown);
  document.addEventListener('keyup', onKeyUp);
  bindVirtualKeys(snakeControls);
  bindVirtualKeys(tetrisControls);
  bindVirtualKeys(shooterControls);
  bindVirtualKeys(pacmanControls);
  bindVirtualKeys(platformControls);
  bindHub();
  bindGameSelect();
  bindSnakeModes();
  bindShooterModes();
  bindPacmanModes();
  bindPlatformModes();
  bindBack();
  bindGameOver();
  HubClock.start();
  Sfx.bindClicks();
  Sfx.bindSettingsUI();
  MediaHub.loadManifest();
  if (hubBgCanvas) HubBg.start(hubBgCanvas);
  showView('hub');
})();
