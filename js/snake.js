/**
 * Lv999 Snake - 贪吃蛇
 */
const SnakeGame = (function () {
  const GRID = 32;
  const BASE_INTERVAL = 120;
  const SCORE_PER_FOOD = 10;
  const SPEEDUP_EVERY = 5;
  const SPEEDUP_MS = 8;
  const MIN_INTERVAL = 45;

  const MODES = {
    bounded: {
      label: '有边界',
      wrap: false,
      baseInterval: 120,
      speedup: true,
      speedupEvery: 5,
      obstacles: 0,
    },
    wrap: {
      label: '无边界',
      wrap: true,
      baseInterval: 120,
      speedup: true,
      speedupEvery: 5,
      obstacles: 0,
    },
    turbo: {
      label: '极速',
      wrap: false,
      baseInterval: 65,
      speedup: true,
      speedupEvery: 3,
      speedupMs: 10,
      minInterval: 35,
      obstacles: 0,
    },
    zen: {
      label: '休闲',
      wrap: true,
      baseInterval: 165,
      speedup: false,
      obstacles: 0,
    },
    obstacle: {
      label: '障碍',
      wrap: false,
      baseInterval: 110,
      speedup: true,
      speedupEvery: 5,
      obstacles: 16,
    },
    marathon: {
      label: '马拉松',
      wrap: false,
      baseInterval: 95,
      speedup: true,
      speedupEvery: 2,
      speedupMs: 10,
      minInterval: 40,
      obstacles: 0,
    },
  };

  let canvas, ctx;
  let intervalId = null;
  let scoreEl, statusEl, modeLabelEl;
  let onGameOverCb = null;

  let snake, direction, nextDirection, food, score, tickInterval, foodEaten;
  let mode = 'bounded';
  let config = MODES.bounded;
  let obstacles = [];
  let isOver = false;

  function wrapCoord(v) {
    return ((v % GRID) + GRID) % GRID;
  }

  function getConfig(m) {
    return MODES[m] || MODES.bounded;
  }

  function applyModeSettings() {
    config = getConfig(mode);
    tickInterval = config.baseInterval;
  }

  function isBlockedCell(x, y) {
    return obstacles.some((o) => o.x === x && o.y === y);
  }

  function buildObstacles() {
    obstacles = [];
    const count = config.obstacles || 0;
    if (count <= 0) return;

    const mid = Math.floor(GRID / 2);
    const safe = new Set();
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        safe.add(`${mid + dx},${mid + dy}`);
      }
    }

    let attempts = 0;
    while (obstacles.length < count && attempts < 2000) {
      attempts++;
      const cell = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
      const key = `${cell.x},${cell.y}`;
      if (safe.has(key)) continue;
      if (obstacles.some((o) => o.x === cell.x && o.y === cell.y)) continue;
      obstacles.push(cell);
    }
  }

  function reset() {
    const mid = Math.floor(GRID / 2);
    snake = [
      { x: mid, y: mid },
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    score = 0;
    foodEaten = 0;
    isOver = false;
    applyModeSettings();
    buildObstacles();
    spawnFood();
    updateHUD();
    if (statusEl) statusEl.textContent = '';
  }

  function spawnFood() {
    const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
    obstacles.forEach((o) => occupied.add(`${o.x},${o.y}`));
    let attempts = 0;
    do {
      food = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
      attempts++;
    } while (occupied.has(`${food.x},${food.y}`) && attempts < 800);
  }

  function updateHUD() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (modeLabelEl) modeLabelEl.textContent = config.label || '—';
  }

  function isOpposite(a, b) {
    return a.x === -b.x && a.y === -b.y;
  }

  function handleInput(action) {
    if (isOver) return;
    const map = {
      up: { x: 0, y: -1 },
      down: { x: 0, y: 1 },
      left: { x: -1, y: 0 },
      right: { x: 1, y: 0 },
    };
    const dir = map[action];
    if (!dir) return;
    if (!isOpposite(dir, direction)) {
      nextDirection = dir;
      if (typeof Sfx !== 'undefined') Sfx.snakeTurn();
    }
  }

  function tick() {
    if (isOver) return;
    direction = nextDirection;
    const head = snake[0];
    let newHead = { x: head.x + direction.x, y: head.y + direction.y };

    if (config.wrap) {
      newHead = {
        x: wrapCoord(newHead.x),
        y: wrapCoord(newHead.y),
      };
    } else if (
      newHead.x < 0 ||
      newHead.x >= GRID ||
      newHead.y < 0 ||
      newHead.y >= GRID
    ) {
      gameOver();
      return;
    }

    if (isBlockedCell(newHead.x, newHead.y)) {
      gameOver();
      return;
    }

    const willEat = newHead.x === food.x && newHead.y === food.y;
    const bodyCheck = willEat ? snake : snake.slice(0, -1);
    for (let i = 0; i < bodyCheck.length; i++) {
      if (bodyCheck[i].x === newHead.x && bodyCheck[i].y === newHead.y) {
        gameOver();
        return;
      }
    }

    snake.unshift(newHead);

    if (willEat) {
      score += SCORE_PER_FOOD;
      foodEaten++;
      if (typeof Sfx !== 'undefined') Sfx.snakeEat();
      if (config.speedup) {
        const every = config.speedupEvery || SPEEDUP_EVERY;
        const step = config.speedupMs || SPEEDUP_MS;
        const minIv = config.minInterval || MIN_INTERVAL;
        if (foodEaten % every === 0) {
          tickInterval = Math.max(minIv, tickInterval - step);
          restartLoop();
        }
      }
      spawnFood();
      updateHUD();
    } else {
      snake.pop();
    }

    draw();
  }

  function restartLoop() {
    if (intervalId) clearInterval(intervalId);
    intervalId = setInterval(tick, tickInterval);
  }

  function gameOver() {
    if (isOver) return;
    isOver = true;
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    draw();
    if (onGameOverCb) onGameOverCb(score);
  }

  function draw() {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const cell = w / GRID;
    const t = Date.now() / 400;

    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, w, h);

    if (config.wrap) {
      ctx.strokeStyle = 'rgba(123, 47, 255, 0.2)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.strokeRect(2, 2, w - 4, h - 4);
      ctx.setLineDash([]);
    } else {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, w - 2, h - 2);
    }

    ctx.strokeStyle = 'rgba(0, 245, 255, 0.04)';
    ctx.lineWidth = 1;
    const gridStep = GRID > 24 ? 2 : 1;
    for (let i = 0; i <= GRID; i += gridStep) {
      ctx.beginPath();
      ctx.moveTo(i * cell, 0);
      ctx.lineTo(i * cell, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * cell);
      ctx.lineTo(w, i * cell);
      ctx.stroke();
    }

    obstacles.forEach((o) => {
      const pad = 2;
      ctx.fillStyle = 'rgba(255, 68, 102, 0.85)';
      ctx.shadowColor = '#ff4466';
      ctx.shadowBlur = 6;
      ctx.fillRect(o.x * cell + pad, o.y * cell + pad, cell - pad * 2, cell - pad * 2);
      ctx.shadowBlur = 0;
    });

    const pulse = 0.7 + 0.3 * Math.sin(t);
    const fx = food.x * cell + cell / 2;
    const fy = food.y * cell + cell / 2;
    const fr = Math.max(2, (cell / 2 - 2) * pulse);
    const foodGrad = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr);
    foodGrad.addColorStop(0, '#ff00ea');
    foodGrad.addColorStop(1, 'rgba(255, 0, 234, 0.2)');
    ctx.fillStyle = foodGrad;
    ctx.beginPath();
    ctx.arc(fx, fy, fr, 0, Math.PI * 2);
    ctx.fill();

    snake.forEach((seg, i) => {
      const pad = i === 0 ? 1 : 2;
      const x = seg.x * cell + pad;
      const y = seg.y * cell + pad;
      const size = cell - pad * 2;
      const alpha = 1 - (i / snake.length) * 0.5;
      if (i === 0) {
        ctx.fillStyle = '#00f5ff';
        ctx.shadowColor = '#00f5ff';
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = `rgba(0, 255, 136, ${alpha})`;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 4;
      }
      ctx.fillRect(x, y, size, size);
      ctx.shadowBlur = 0;
    });

    if (isOver) {
      ctx.fillStyle = 'rgba(5, 5, 8, 0.35)';
      ctx.fillRect(0, 0, w, h);
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const sidePad = 120;
    const size = Math.min(
      Math.min(window.innerWidth, window.innerHeight) - sidePad,
      560,
      window.innerHeight - 48,
      window.innerWidth - sidePad - 32
    );
    canvas.width = size;
    canvas.height = size;
    draw();
  }

  function init(cvs, elements, gameMode, onGameOver) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    scoreEl = elements.score;
    statusEl = elements.status;
    modeLabelEl = elements.modeLabel;
    onGameOverCb = onGameOver;
    mode = MODES[gameMode] ? gameMode : 'bounded';

    reset();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    draw();
    intervalId = setInterval(tick, tickInterval);
  }

  function restart() {
    if (!canvas) return;
    reset();
    draw();
    intervalId = setInterval(tick, tickInterval);
  }

  function destroy() {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    window.removeEventListener('resize', resizeCanvas);
    canvas = null;
    ctx = null;
    onGameOverCb = null;
    isOver = false;
    obstacles = [];
  }

  function getMode() {
    return mode;
  }

  return { init, destroy, restart, handleInput, getMode };
})();
