/**
 * Lv999 横板闯关 — 2D 平台跳跃
 */
const PlatformGame = (function () {
  const TILE = 24;
  const GRAVITY = 0.46;
  const JUMP_V = -9.4;
  const MAX_FALL = 10;
  const BASE_MOVE = 2.35;

  const MODES = {
    classic: { label: '经典', lives: 3, speed: 1, enemySpeed: 0.55, totalLevels: 3, scoreMult: 1 },
    turbo: { label: '极速', lives: 3, speed: 1.18, enemySpeed: 0.75, totalLevels: 3, scoreMult: 1.2 },
    zen: { label: '休闲', lives: 5, speed: 0.78, enemySpeed: 0.4, totalLevels: 3, scoreMult: 1 },
    hard: { label: '炼狱', lives: 2, speed: 1.08, enemySpeed: 0.85, totalLevels: 4, scoreMult: 1.8 },
    marathon: { label: '马拉松', lives: 3, speed: 1, enemySpeed: 0.6, totalLevels: 99, endless: true, scoreMult: 1.3 },
  };

  const LEVELS = [
    [
      '....................................................',
      '....................................................',
      '....................................................',
      '...............................................GGG..',
      '...........................................########.',
      '..................................####..............',
      '.........................####.......................',
      '..................####..........C...................',
      '.........####...............E.......................',
      '..P...####.......E....####..........................',
      '########################...#########################',
      '########################...#########################',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    ],
    [
      '........................................................',
      '........................................................',
      '....................................................GGG.',
      '................................................########',
      '...............................####.....................',
      '......................####..........####................',
      '.............####...........................E...........',
      '......####...........E........####......................',
      '..####....................####..........................',
      '.P...................####...............................',
      '#########################...#############################',
      '#########################...#############################',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    ],
    [
      '............................................................',
      '............................................................',
      '........................................................GGG.',
      '....................................................########',
      '....................................####....................',
      '...........................####..........####...............',
      '..................####..........................E.............',
      '.........####..........E..........####........................',
      '....####....................####..............................',
      '..P...........................................................',
      '##############################...#############################',
      '##############################...#############################',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    ],
    [
      '................................................................',
      '................................................................',
      '............................................................GGG.',
      '........................................................########',
      '...........................................####.................',
      '..................................####..........####............',
      '.........................####........................E..........',
      '................####..........E..........####...................',
      '........####....................####............................',
      '...P............................................................',
      '##################################...###########################',
      '##################################...###########################',
      '^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^',
    ],
  ];

  let canvas, ctx, rafId;
  let scoreEl, livesEl, levelEl, modeLabelEl, statusEl, onGameOverCb;
  let W, H, mode, config, isOver, keys;
  let map, mapW, mapH, camX;
  let player, enemies, coins, bullets, particles;
  let score, lives, level, invuln, banner, bannerTimer;
  let moveSpeed, jumpV;

  function parseLevel(index) {
    const src = LEVELS[index % LEVELS.length];
    map = src.map((row) => row.split(''));
    mapH = map.length;
    mapW = Math.max(...map.map((r) => r.length));
    map.forEach((row) => {
      while (row.length < mapW) row.push('.');
    });
    enemies = [];
    coins = [];
    player = { x: 2 * TILE, y: 0, w: 18, h: 22, vx: 0, vy: 0, onGround: false, facing: 1, fireCd: 0 };
    bullets = [];
    particles = [];

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const ch = map[y][x];
        const px = x * TILE;
        const py = y * TILE;
        if (ch === 'P') {
          player.x = px + 3;
          player.y = py - player.h + TILE;
          map[y][x] = '.';
        } else if (ch === 'E') {
          map[y][x] = '.';
          const span = TILE * 2.5;
          enemies.push({
            x: px + 2,
            y: py + TILE - 18,
            w: 20,
            h: 18,
            vx: config.enemySpeed * 0.65 * (Math.random() > 0.5 ? 1 : -1),
            minX: px + 2 - span,
            maxX: px + 2 + span,
            alive: true,
          });
        } else if (ch === 'C') {
          map[y][x] = '.';
          coins.push({ x: px + TILE / 2, y: py + TILE / 2, r: 6, taken: false });
        }
      }
    }

    if (config.endless && level > 1) {
      const extra = Math.min(4, Math.floor(level / 2));
      for (let i = 0; i < extra; i++) {
        const ex = (20 + i * 8 + (level % 5) * 3) * TILE;
        enemies.push({
          x: ex,
          y: (mapH - 3) * TILE - 18,
          w: 20,
          h: 18,
          vx: config.enemySpeed * 0.65,
          minX: ex - TILE * 2,
          maxX: ex + TILE * 2,
          alive: true,
        });
      }
    }
  }

  function tileAt(tx, ty) {
    if (ty < 0 || ty >= mapH || tx < 0 || tx >= mapW) return ty >= mapH ? '.' : '#';
    return map[ty][tx];
  }

  function isSolid(ch) {
    return ch === '#';
  }

  function isGoal(ch) {
    return ch === 'G';
  }

  function isSpike(ch) {
    return ch === '^';
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function moveEntity(ent, dx, dy) {
    ent.x += dx;
    const box = { x: ent.x, y: ent.y, w: ent.w, h: ent.h };
    const x0 = Math.floor(box.x / TILE);
    const x1 = Math.floor((box.x + box.w - 0.01) / TILE);
    const y0 = Math.floor(box.y / TILE);
    const y1 = Math.floor((box.y + box.h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        const ch = tileAt(tx, ty);
        if (!isSolid(ch)) continue;
        const txp = tx * TILE;
        const typ = ty * TILE;
        if (dx > 0) ent.x = txp - ent.w;
        else if (dx < 0) ent.x = txp + TILE;
      }
    }

    ent.y += dy;
    let grounded = false;
    box.x = ent.x;
    box.y = ent.y;
    const nx0 = Math.floor(box.x / TILE);
    const nx1 = Math.floor((box.x + box.w - 0.01) / TILE);
    const ny0 = Math.floor(box.y / TILE);
    const ny1 = Math.floor((box.y + box.h - 0.01) / TILE);
    for (let ty = ny0; ty <= ny1; ty++) {
      for (let tx = nx0; tx <= nx1; tx++) {
        const ch = tileAt(tx, ty);
        if (!isSolid(ch)) continue;
        const typ = ty * TILE;
        if (dy > 0) {
          ent.y = typ - ent.h;
          grounded = true;
        } else if (dy < 0) {
          ent.y = typ + TILE;
        }
      }
    }
    return grounded;
  }

  function updatePlayer() {
    const spd = moveSpeed;
    player.vx = 0;
    if (keys.left) {
      player.vx = -spd;
      player.facing = -1;
    }
    if (keys.right) {
      player.vx = spd;
      player.facing = 1;
    }

    if (keys.jump && player.onGround) {
      player.vy = jumpV;
      player.onGround = false;
      if (typeof Sfx !== 'undefined' && Sfx.platformJump) Sfx.platformJump();
    }

    player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
    player.onGround = moveEntity(player, player.vx, player.vy);

    if (player.y > mapH * TILE + 40) {
      hurtPlayer();
      return;
    }

    const px0 = Math.floor(player.x / TILE);
    const py0 = Math.floor((player.y + player.h - 1) / TILE);
    for (let ty = py0; ty <= Math.floor((player.y + player.h) / TILE); ty++) {
      for (let tx = px0; tx <= Math.floor((player.x + player.w) / TILE); tx++) {
        if (isSpike(tileAt(tx, ty))) {
          hurtPlayer();
          return;
        }
        if (isGoal(tileAt(tx, ty))) {
          levelClear();
          return;
        }
      }
    }

    coins.forEach((c) => {
      if (c.taken) return;
      const dx = player.x + player.w / 2 - c.x;
      const dy = player.y + player.h / 2 - c.y;
      if (dx * dx + dy * dy < 400) {
        c.taken = true;
        score += Math.round(100 * config.scoreMult);
        if (typeof Sfx !== 'undefined' && Sfx.platformCoin) Sfx.platformCoin();
      }
    });

    if (keys.fire && player.fireCd <= 0) {
      player.fireCd = 18;
      bullets.push({
        x: player.facing > 0 ? player.x + player.w : player.x - 8,
        y: player.y + 8,
        w: 10,
        h: 4,
        vx: player.facing * 6.5,
        life: 45,
      });
      if (typeof Sfx !== 'undefined' && Sfx.shoot) Sfx.shoot();
    }
    if (player.fireCd > 0) player.fireCd--;
  }

  function hurtPlayer() {
    if (invuln > 0) return;
    lives--;
    updateHUD();
    if (typeof Sfx !== 'undefined' && Sfx.platformHit) Sfx.platformHit();
    if (lives <= 0) {
      endGame(false);
      return;
    }
    invuln = 90;
    banner = 'HIT!';
    bannerTimer = 40;
    player.vy = -6;
    player.vx = -player.facing * 3;
  }

  function stompEnemy(en, fromAbove) {
    if (!en.alive) return false;
    if (fromAbove && player.vy > 0) {
      en.alive = false;
      player.vy = -7;
      score += Math.round(200 * config.scoreMult);
      spawnParticles(en.x + en.w / 2, en.y + en.h / 2, '#ff4466');
      if (typeof Sfx !== 'undefined' && Sfx.hit) Sfx.hit();
      return true;
    }
    return false;
  }

  function updateEnemies() {
    enemies.forEach((en) => {
      if (!en.alive) return;
      en.x += en.vx;
      if (en.x <= en.minX || en.x + en.w >= en.maxX) en.vx *= -1;
      en.y += 2;
      let grounded = false;
      for (let tx = Math.floor(en.x / TILE); tx <= Math.floor((en.x + en.w) / TILE); tx++) {
        const ty = Math.floor((en.y + en.h) / TILE);
        if (isSolid(tileAt(tx, ty))) {
          en.y = ty * TILE - en.h;
          grounded = true;
          break;
        }
      }
      if (!grounded) en.y -= 2;

      const pb = { x: player.x, y: player.y, w: player.w, h: player.h };
      const eb = { x: en.x, y: en.y, w: en.w, h: en.h };
      if (!rectsOverlap(pb, eb)) return;
      const stomp = player.vy > 0 && player.y + player.h - en.y < 12;
      if (stompEnemy(en, stomp)) return;
      if (invuln <= 0) hurtPlayer();
    });
  }

  function updateBullets() {
    bullets = bullets.filter((b) => {
      b.x += b.vx;
      b.life--;
      if (b.life <= 0) return false;
      const tx = Math.floor((b.x + b.w / 2) / TILE);
      const ty = Math.floor((b.y + b.h / 2) / TILE);
      if (isSolid(tileAt(tx, ty))) return false;
      let hit = false;
      enemies.forEach((en) => {
        if (!en.alive || hit) return;
        if (rectsOverlap(b, en)) {
          en.alive = false;
          hit = true;
          score += Math.round(150 * config.scoreMult);
          spawnParticles(en.x + en.w / 2, en.y + en.h / 2, '#00f5ff');
          if (typeof Sfx !== 'undefined' && Sfx.hit) Sfx.hit();
        }
      });
      return !hit;
    });
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 5,
        vy: (Math.random() - 0.5) * 5,
        life: 20 + Math.random() * 10,
        color,
      });
    }
  }

  function updateParticles() {
    particles = particles.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.2;
      p.life--;
      return p.life > 0;
    });
  }

  function levelClear() {
    const maxLv = config.endless ? 999 : config.totalLevels;
    if (level >= maxLv) {
      endGame(true);
      return;
    }
    level++;
    banner = `STAGE ${level}`;
    bannerTimer = 70;
    score += Math.round(500 * config.scoreMult);
    parseLevel(level - 1);
    invuln = 60;
    updateHUD();
    if (typeof Sfx !== 'undefined' && Sfx.portal) Sfx.portal();
  }

  function endGame(victory) {
    if (isOver) return;
    isOver = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    draw();
    if (onGameOverCb) {
      onGameOverCb(score, {
        victory,
        mode,
        modeLabel: config.label,
        level: victory ? level : Math.max(1, level),
      });
    }
  }

  function updateHUD() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (livesEl) livesEl.textContent = String(lives);
    if (levelEl) levelEl.textContent = String(level);
    if (modeLabelEl) modeLabelEl.textContent = config.label || '—';
  }

  function update() {
    if (isOver) return;
    if (bannerTimer > 0) bannerTimer--;
    if (invuln > 0) invuln--;

    updatePlayer();
    if (isOver) return;
    updateEnemies();
    updateBullets();
    updateParticles();

    const targetCam = player.x + player.w / 2 - W * 0.35;
    camX += (targetCam - camX) * 0.12;
    camX = Math.max(0, Math.min(camX, mapW * TILE - W));

    updateHUD();
    draw();
    rafId = requestAnimationFrame(update);
  }

  function drawTile(x, y, ch, cell) {
    const px = x * cell - camX;
    const py = y * cell;
    if (px + cell < 0 || px > W || py + cell < 0 || py > H) return;
    if (ch === '#') {
      ctx.fillStyle = '#1a2a5c';
      ctx.fillRect(px, py, cell, cell);
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 1;
      ctx.strokeRect(px + 0.5, py + 0.5, cell - 1, cell - 1);
      ctx.fillStyle = 'rgba(0,245,255,0.15)';
      ctx.fillRect(px + 2, py + 2, cell - 4, 4);
    } else if (ch === 'G') {
      ctx.fillStyle = 'rgba(0,255,136,0.25)';
      ctx.fillRect(px, py, cell, cell);
      ctx.strokeStyle = '#00ff88';
      ctx.strokeRect(px + 2, py + 2, cell - 4, cell - 4);
      ctx.fillStyle = '#00ff88';
      ctx.font = `bold ${cell * 0.45}px monospace`;
      ctx.fillText('▶', px + cell * 0.28, py + cell * 0.72);
    } else if (ch === '^') {
      ctx.fillStyle = '#ff4466';
      ctx.beginPath();
      ctx.moveTo(px + cell / 2, py + 4);
      ctx.lineTo(px + cell - 4, py + cell - 2);
      ctx.lineTo(px + 4, py + cell - 2);
      ctx.closePath();
      ctx.fill();
    }
  }

  function draw() {
    if (!ctx) return;
    const cell = TILE;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#050818');
    grad.addColorStop(1, '#0a1030');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const ch = map[y][x];
        if (ch !== '.' && ch !== 'P' && ch !== 'E' && ch !== 'C') drawTile(x, y, ch, cell);
      }
    }

    coins.forEach((c) => {
      if (c.taken) return;
      const px = c.x - camX;
      const py = c.y;
      if (px < -20 || px > W + 20) return;
      ctx.fillStyle = '#ffb347';
      ctx.beginPath();
      ctx.arc(px, py, c.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 2;
      ctx.stroke();
    });

    enemies.forEach((en) => {
      if (!en.alive) return;
      const px = en.x - camX;
      const py = en.y;
      ctx.fillStyle = '#ff4466';
      ctx.fillRect(px, py, en.w, en.h);
      ctx.fillStyle = '#fff';
      ctx.fillRect(px + 4, py + 4, 5, 5);
      ctx.fillRect(px + en.w - 9, py + 4, 5, 5);
      ctx.fillStyle = '#200';
      ctx.fillRect(px + 5, py + 5, 3, 3);
      ctx.fillRect(px + en.w - 8, py + 5, 3, 3);
    });

    bullets.forEach((b) => {
      ctx.fillStyle = '#00f5ff';
      ctx.fillRect(b.x - camX, b.y, b.w, b.h);
    });

    if (!(invuln > 0 && Math.floor(invuln / 4) % 2 === 0)) {
      const px = player.x - camX;
      const py = player.y;
      ctx.fillStyle = '#ffe066';
      ctx.fillRect(px, py, player.w, player.h);
      ctx.fillStyle = '#0a0e1a';
      const eyeX = player.facing > 0 ? px + player.w - 8 : px + 4;
      ctx.fillRect(eyeX, py + 6, 4, 4);
      ctx.fillStyle = '#00f5ff';
      ctx.fillRect(eyeX + 1, py + 7, 2, 2);
    }

    particles.forEach((p) => {
      ctx.globalAlpha = p.life / 30;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - camX, p.y, 3, 3);
      ctx.globalAlpha = 1;
    });

    if (bannerTimer > 0 && banner) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#00f5ff';
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(banner, W / 2, H / 2);
      ctx.textAlign = 'left';
    }

    if (isOver) {
      ctx.fillStyle = 'rgba(2, 4, 8, 0.5)';
      ctx.fillRect(0, 0, W, H);
    }
  }

  function reset(full) {
    config = MODES[mode] || MODES.classic;
    moveSpeed = BASE_MOVE * config.speed;
    jumpV = JUMP_V * (0.92 + config.speed * 0.04);
    keys = { left: false, right: false, jump: false, fire: false };
    if (full) {
      score = 0;
      lives = config.lives;
      level = 1;
    }
    invuln = 0;
    banner = full ? '' : 'READY';
    bannerTimer = full ? 0 : 50;
    isOver = false;
    camX = 0;
    parseLevel(level - 1);
    updateHUD();
  }

  function init(cvs, elements, gameMode, onGameOver) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    W = canvas.width;
    H = canvas.height;
    scoreEl = elements.score;
    livesEl = elements.lives;
    levelEl = elements.level;
    modeLabelEl = elements.modeLabel;
    statusEl = elements.status;
    onGameOverCb = onGameOver;
    mode = MODES[gameMode] ? gameMode : 'classic';
    reset(true);
    if (statusEl) statusEl.textContent = '';
    draw();
    rafId = requestAnimationFrame(update);
  }

  function destroy() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = null;
    canvas = null;
    ctx = null;
    onGameOverCb = null;
    isOver = false;
  }

  function restart() {
    reset(true);
    if (rafId) cancelAnimationFrame(rafId);
    draw();
    rafId = requestAnimationFrame(update);
  }

  function handleInput(action, pressed) {
    if (isOver) return;
    const on = pressed !== false;
    if (action === 'left') keys.left = on;
    else if (action === 'right') keys.right = on;
    else if (action === 'up' || action === 'jump') keys.jump = on;
    else if (action === 'fire') keys.fire = on;
  }

  return { init, destroy, restart, handleInput };
})();
