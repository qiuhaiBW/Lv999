/**
 * Lv999 Pac-Man - 吃豆人
 */
const PacmanGame = (function () {
  const COLS = 19;
  const ROWS = 21;
  const DOT_SCORE = 10;
  const POWER_SCORE = 50;
  const GHOST_BASE = 200;

  const MAP = [
    '###################',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o...............o#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    '   #.#       #.#   ',
    '####.# ##-## #.####',
    '    .  #---#  .    ',
    '####.# ##### #.####',
    '   #.#       #.#   ',
    '####.# ##### #.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#..#....... ...#..#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################',
  ];

  const DIRS = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];

  const GHOST_COLORS = ['#ff4466', '#00f5ff', '#ffb347', '#7b2fff'];
  const GHOST_START = [
    { x: 8, y: 9 },
    { x: 9, y: 9 },
    { x: 10, y: 9 },
    { x: 9, y: 10 },
  ];

  const MODES = {
    classic: {
      label: '经典',
      lives: 3,
      baseInterval: 85,
      minInterval: 52,
      ghostSmart: 1,
      powerTicks: 46,
      ghostCount: 4,
      ghostRelease: [0, 36, 90, 150],
    },
    turbo: {
      label: '极速',
      lives: 3,
      baseInterval: 58,
      minInterval: 38,
      ghostSmart: 1.15,
      powerTicks: 38,
      ghostCount: 4,
      ghostRelease: [0, 24, 60, 100],
    },
    zen: {
      label: '休闲',
      lives: 5,
      baseInterval: 105,
      minInterval: 78,
      ghostSmart: 0.55,
      powerTicks: 58,
      ghostCount: 4,
      ghostRelease: [0, 48, 120, 200],
    },
    hard: {
      label: '炼狱',
      lives: 2,
      baseInterval: 68,
      minInterval: 42,
      ghostSmart: 1.45,
      powerTicks: 32,
      ghostCount: 4,
      ghostRelease: [0, 20, 50, 80],
    },
    marathon: {
      label: '马拉松',
      lives: 3,
      baseInterval: 75,
      minInterval: 48,
      ghostSmart: 1.05,
      powerTicks: 44,
      ghostCount: 4,
      ghostRelease: [0, 30, 75, 120],
      endless: true,
    },
  };

  let canvas, ctx;
  let rafId = null;
  let lastLogicTime = 0;
  let scoreEl, livesEl, levelEl, statusEl, modeLabelEl;
  let onGameOverCb = null;

  let mode = 'classic';
  let config = MODES.classic;
  let grid, dotsLeft, score, lives, level, tickInterval;
  let pac, ghosts, poweredTimer, ghostCombo, isOver, isDying, dieTimer;
  let mouthFrame, pendingDir, tickCount;

  function getConfig(m) {
    return MODES[m] || MODES.classic;
  }

  function parseMap() {
    grid = [];
    dotsLeft = 0;
    for (let y = 0; y < ROWS; y++) {
      const row = [];
      const line = MAP[y] || '';
      for (let x = 0; x < COLS; x++) {
        const ch = line[x] || '#';
        if (ch === '#') row.push('wall');
        else if (ch === '.') {
          row.push('dot');
          dotsLeft++;
        } else if (ch === 'o') {
          row.push('power');
          dotsLeft++;
        } else if (ch === ' ' || ch === '-') row.push('empty');
        else row.push('empty');
      }
      grid.push(row);
    }
  }

  function isWalkable(x, y, allowGhostHouse) {
    if (x < 0 || x >= COLS || y < 0 || y >= ROWS) return false;
    const cell = grid[y][x];
    if (cell === 'wall') return false;
    if (!allowGhostHouse && cell === 'empty' && MAP[y][x] === '-') return false;
    return true;
  }

  const GHOST_HOUSE_EXIT = { x: 9, y: 6 };

  function isGhostHouseCell(x, y) {
    const ch = MAP[y]?.[x];
    return ch === '-' || (y === 10 && x >= 8 && x <= 12);
  }

  function resetActors() {
    pac = { x: 9, y: 15, dir: { x: 0, y: 0 }, next: { x: 0, y: 0 } };
    pendingDir = null;
    poweredTimer = 0;
    ghostCombo = 0;
    isDying = false;
    dieTimer = 0;
    mouthFrame = 0;
    const releaseTable = config.ghostRelease || [0, 36, 90, 150];
    ghosts = GHOST_START.slice(0, config.ghostCount).map((pos, i) => ({
      x: pos.x,
      y: pos.y,
      dir: DIRS[i % 4],
      color: GHOST_COLORS[i],
      eaten: false,
      scatter: false,
      released: false,
      releaseTick: releaseTable[i] ?? releaseTable[releaseTable.length - 1] ?? 0,
    }));
  }

  function reset(full) {
    config = getConfig(mode);
    if (full) {
      score = 0;
      lives = config.lives;
      level = 1;
      tickInterval = config.baseInterval;
      parseMap();
    }
    resetActors();
    isOver = false;
    updateHUD();
    if (statusEl) statusEl.textContent = full ? '' : 'READY';
  }

  function updateHUD() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (livesEl) livesEl.textContent = String(lives);
    if (levelEl) levelEl.textContent = String(level);
    if (modeLabelEl) modeLabelEl.textContent = config.label || '—';
  }

  function opposite(d) {
    return { x: -d.x, y: -d.y };
  }

  function handleInput(action) {
    if (isOver || isDying) return;
    const map = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const dir = map[action];
    if (!dir) return;
    pendingDir = dir;
    pac.next = dir;
    if (typeof Sfx !== 'undefined' && Sfx.pacmanTurn) Sfx.pacmanTurn();
  }

  function tryMove(entity, dir, isGhost) {
    const nx = entity.x + dir.x;
    const ny = entity.y + dir.y;
    if (isWalkable(nx, ny, isGhost)) {
      entity.x = nx;
      entity.y = ny;
      entity.dir = dir;
      return true;
    }
    return false;
  }

  function atIntersection(x, y) {
    let opts = 0;
    for (const d of DIRS) {
      if (isWalkable(x + d.x, y + d.y, true)) opts++;
    }
    return opts > 2;
  }

  function ghostTarget(g) {
    if (g.eaten) return { x: 9, y: 10 };
    if (!g.released || isGhostHouseCell(g.x, g.y)) return GHOST_HOUSE_EXIT;
    if (poweredTimer > 0) {
      const fleeX = g.x + (g.x - pac.x) * 2;
      const fleeY = g.y + (g.y - pac.y) * 2;
      return {
        x: Math.max(0, Math.min(COLS - 1, fleeX)),
        y: Math.max(0, Math.min(ROWS - 1, fleeY)),
      };
    }
    if (g.scatter) {
      const corners = [
        { x: 1, y: 1 },
        { x: COLS - 2, y: 1 },
        { x: 1, y: ROWS - 2 },
        { x: COLS - 2, y: ROWS - 2 },
      ];
      return corners[GHOST_COLORS.indexOf(g.color)] || corners[0];
    }
    return { x: pac.x, y: pac.y };
  }

  function chooseGhostDir(g) {
    const target = ghostTarget(g);
    const opp = g.dir ? opposite(g.dir) : null;
    const choices = DIRS.filter((d) => {
      if (opp && d.x === opp.x && d.y === opp.y) return false;
      return isWalkable(g.x + d.x, g.y + d.y, true);
    });
    if (choices.length === 0) return g.dir;
    if (choices.length === 1) return choices[0];

    const leavingHouse = !g.released || isGhostHouseCell(g.x, g.y);
    if (leavingHouse || poweredTimer > 0 || Math.random() > config.ghostSmart) {
      if (leavingHouse || poweredTimer > 0) {
        let best = choices[0];
        let bestDist = Infinity;
        choices.forEach((d) => {
          const tx = g.x + d.x;
          const ty = g.y + d.y;
          const dist = (tx - target.x) ** 2 + (ty - target.y) ** 2;
          if (dist < bestDist) {
            bestDist = dist;
            best = d;
          }
        });
        return best;
      }
      return choices[Math.floor(Math.random() * choices.length)];
    }

    let best = choices[0];
    let bestDist = Infinity;
    choices.forEach((d) => {
      const tx = g.x + d.x;
      const ty = g.y + d.y;
      const dist = (tx - target.x) ** 2 + (ty - target.y) ** 2;
      if (dist < bestDist) {
        bestDist = dist;
        best = d;
      }
    });
    return best;
  }

  function eatAt(x, y) {
    const cell = grid[y][x];
    if (cell === 'dot') {
      grid[y][x] = 'empty';
      dotsLeft--;
      score += DOT_SCORE;
      if (typeof Sfx !== 'undefined' && Sfx.pacmanEat) Sfx.pacmanEat();
    } else if (cell === 'power') {
      grid[y][x] = 'empty';
      dotsLeft--;
      score += POWER_SCORE;
      poweredTimer = config.powerTicks;
      ghostCombo = 0;
      ghosts.forEach((g) => {
        g.eaten = false;
      });
      if (typeof Sfx !== 'undefined' && Sfx.pacmanPower) Sfx.pacmanPower();
    }
  }

  function killPac() {
    if (isDying) return;
    isDying = true;
    dieTimer = 10;
    if (typeof Sfx !== 'undefined' && Sfx.pacmanDie) Sfx.pacmanDie();
  }

  function nextLevel() {
    level++;
    tickInterval = Math.max(config.minInterval, config.baseInterval - (level - 1) * 7);
    parseMap();
    resetActors();
    restartLoop();
    if (statusEl) statusEl.textContent = `LEVEL ${level}`;
    updateHUD();
  }

  function gameOver() {
    if (isOver) return;
    isOver = true;
    stopLoop();
    draw();
    if (onGameOverCb) {
      onGameOverCb(score, {
        mode,
        modeLabel: config.label,
        level,
      });
    }
  }

  function tickLogic() {
    if (isOver) return;

    tickCount++;

    if (isDying) {
      dieTimer--;
      if (dieTimer <= 0) {
        lives--;
        updateHUD();
        if (lives <= 0) {
          gameOver();
          return;
        }
        reset(false);
      }
      return;
    }

    mouthFrame = (mouthFrame + 1) % 4;

    const tryDir = pendingDir || pac.next;
    if (tryDir) {
      if (isWalkable(pac.x + tryDir.x, pac.y + tryDir.y, false)) {
        pac.dir = tryDir;
        pendingDir = null;
      }
    }
    if (pac.dir.x !== 0 || pac.dir.y !== 0) {
      if (isWalkable(pac.x + pac.dir.x, pac.y + pac.dir.y, false)) {
        pac.x += pac.dir.x;
        pac.y += pac.dir.y;
      }
    }

    if (pac.x === 0 && pac.dir.x === -1) pac.x = COLS - 1;
    else if (pac.x === COLS - 1 && pac.dir.x === 1) pac.x = 0;

    eatAt(pac.x, pac.y);

    if (poweredTimer > 0) poweredTimer--;

    ghosts.forEach((g) => {
      if (!g.released && !g.eaten) {
        if (tickCount >= g.releaseTick) g.released = true;
        else return;
      }

      if (atIntersection(g.x, g.y) || !isWalkable(g.x + g.dir.x, g.y + g.dir.y, true)) {
        g.dir = chooseGhostDir(g);
      }
      tryMove(g, g.dir, true);
      if (g.x === 0 && g.dir.x === -1) g.x = COLS - 1;
      else if (g.x === COLS - 1 && g.dir.x === 1) g.x = 0;

      if (g.eaten && g.x === 9 && g.y === 10) {
        g.eaten = false;
        g.released = false;
        g.releaseTick = tickCount + 36;
      }

      if (!isGhostHouseCell(g.x, g.y) && g.x === pac.x && g.y === pac.y) {
        if (poweredTimer > 0 && !g.eaten) {
          g.eaten = true;
          score += GHOST_BASE * (2 ** ghostCombo);
          ghostCombo++;
          g.x = 9;
          g.y = 10;
          g.released = false;
          g.releaseTick = tickCount + 48;
          if (typeof Sfx !== 'undefined' && Sfx.pacmanGhost) Sfx.pacmanGhost();
        } else if (!g.eaten) {
          killPac();
        }
      }
    });

    if (tickCount % 140 === 0) {
      ghosts.forEach((g) => {
        if (g.released && !isGhostHouseCell(g.x, g.y)) {
          g.scatter = !g.scatter;
        }
      });
    }

    if (dotsLeft <= 0) nextLevel();

    updateHUD();
  }

  function gameLoop(now) {
    if (isOver) return;
    rafId = requestAnimationFrame(gameLoop);
    if (now - lastLogicTime >= tickInterval) {
      lastLogicTime = now;
      tickLogic();
    }
    draw();
  }

  function drawMaze(cell) {
    const w = canvas.width;
    const h = canvas.height;
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, w, h);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const cellType = grid[y][x];
        const px = x * cell;
        const py = y * cell;
        if (cellType === 'wall') {
          ctx.fillStyle = '#1a2a6c';
          ctx.strokeStyle = '#00f5ff';
          ctx.lineWidth = 1;
          ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2);
          ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
        } else if (cellType === 'dot') {
          ctx.fillStyle = '#ffb347';
          ctx.beginPath();
          ctx.arc(px + cell / 2, py + cell / 2, Math.max(1.5, cell * 0.1), 0, Math.PI * 2);
          ctx.fill();
        } else if (cellType === 'power') {
          const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 200);
          ctx.fillStyle = '#ff00ea';
          ctx.beginPath();
          ctx.arc(px + cell / 2, py + cell / 2, cell * 0.22 * pulse, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawPac(cell) {
    if (isDying && dieTimer % 2 === 0) return;
    const cx = pac.x * cell + cell / 2;
    const cy = pac.y * cell + cell / 2;
    const r = cell * 0.42;
    let angle = 0;
    if (pac.dir.x === 1) angle = 0;
    else if (pac.dir.x === -1) angle = Math.PI;
    else if (pac.dir.y === -1) angle = -Math.PI / 2;
    else if (pac.dir.y === 1) angle = Math.PI / 2;
    const mouth = 0.15 + 0.3 * (0.5 + 0.5 * Math.sin(Date.now() / 90));
    ctx.fillStyle = '#ffe066';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, angle + mouth * Math.PI, angle - mouth * Math.PI, true);
    ctx.closePath();
    ctx.fill();
  }

  function drawGhosts(cell) {
    ghosts.forEach((g) => {
      const cx = g.x * cell + cell / 2;
      const cy = g.y * cell + cell / 2;
      const r = cell * 0.38;
      if (!g.released && !g.eaten) ctx.globalAlpha = 0.55;
      if (g.eaten) {
        ctx.fillStyle = 'rgba(200,200,255,0.5)';
      } else if (poweredTimer > 0) {
        ctx.fillStyle = poweredTimer < 40 && poweredTimer % 4 < 2 ? '#fff' : '#2244ff';
      } else {
        ctx.fillStyle = g.color;
      }
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.15, r, Math.PI, 0);
      ctx.lineTo(cx + r, cy + r * 0.5);
      for (let i = 2; i >= 0; i--) {
        const wx = cx - r + (i * (2 * r)) / 3;
        ctx.lineTo(wx + r / 3, cy + r * (i % 2 ? 0.2 : 0.55));
      }
      ctx.closePath();
      ctx.fill();
      if (!g.eaten && !(poweredTimer > 0)) {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx - r * 0.35, cy - r * 0.1, r * 0.22, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.35, cy - r * 0.1, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#112';
        ctx.beginPath();
        ctx.arc(cx - r * 0.35, cy - r * 0.1, r * 0.1, 0, Math.PI * 2);
        ctx.arc(cx + r * 0.35, cy - r * 0.1, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  function draw() {
    if (!ctx || !canvas) return;
    const cell = canvas.width / COLS;
    drawMaze(cell);
    drawPac(cell);
    drawGhosts(cell);

    if (poweredTimer > 0) {
      ctx.fillStyle = 'rgba(34,68,255,0.08)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    if (isOver) {
      ctx.fillStyle = 'rgba(2, 4, 8, 0.55)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const sidePad = 120;
    const maxW = Math.min(window.innerWidth - sidePad, 560);
    const maxH = Math.min(window.innerHeight - 80, 620);
    const cell = Math.floor(Math.min(maxW / COLS, maxH / ROWS));
    canvas.width = cell * COLS;
    canvas.height = cell * ROWS;
    draw();
  }

  function stopLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function restartLoop() {
    stopLoop();
    lastLogicTime = performance.now();
    rafId = requestAnimationFrame(gameLoop);
  }

  function init(cvs, elements, gameMode, onGameOver) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    scoreEl = elements.score;
    livesEl = elements.lives;
    levelEl = elements.level;
    statusEl = elements.status;
    modeLabelEl = elements.modeLabel;
    onGameOverCb = onGameOver;
    mode = MODES[gameMode] ? gameMode : 'classic';
    tickCount = 0;
    reset(true);
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    draw();
    restartLoop();
  }

  function restart() {
    if (!canvas) return;
    tickCount = 0;
    reset(true);
    draw();
    restartLoop();
  }

  function destroy() {
    stopLoop();
    window.removeEventListener('resize', resizeCanvas);
    canvas = null;
    ctx = null;
    onGameOverCb = null;
    isOver = false;
  }

  function getMode() {
    return mode;
  }

  return { init, destroy, restart, handleInput, getMode };
})();
