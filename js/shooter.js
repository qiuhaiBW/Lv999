/**
 * Lv999 弹幕射击 - 完全修复版
 */
const ShooterGame = (function () {
  const MAX_BULLET_LV = 5;
  const MAX_BOMBS_START = 3;
  const MAX_HOSTILE_BULLETS = 96;
  const MAX_PARTICLES = 72;

  const BOSS_NAMES = {
    classic: ['协议哨兵', '重装猎犬', '星核卫士', '深渊母舰', 'Lv999主脑'],
    easy: ['训练机甲', '巡逻艇', '练习核心', '结业考官'],
    hard: ['炼狱先锋', '弹幕骑士', '熔毁核心', '终焉裁决', '虚空帝王'],
    danmaku: ['符卡精灵', '螺旋魔女', '结界主', '梦魇女王', '全弹教父'],
    survival: ['追猎者', '绞肉机', '生存考验', '无尽幻影', '死神代行', '虚空蠕虫', '终焉试炼', '不灭核心'],
    strike: ['闪击小队', '突击隼', '瞄准者', '疾风将', '王牌歼灭'],
  };

  const BOSS_PATTERNS = {
    classic: ['spread', 'wave', 'ring', 'cross', 'combo'],
    easy: ['straight', 'spread', 'spread', 'straight'],
    hard: ['wave', 'spread', 'ring', 'spiral', 'combo'],
    danmaku: ['ring', 'spiral', 'ring', 'spiral', 'combo'],
    survival: ['straight', 'spread', 'wave', 'ring', 'spiral', 'straight', 'combo', 'combo'],
    strike: ['straight', 'spread', 'spread', 'wave', 'combo'],
  };

  const MODES = {
    classic: { label: '经典', lives: 3, totalStages: 5, killsPerStage: [15, 20, 25, 30, 0], bossHp: [30, 40, 50, 60, 80], spawnMs: 2000, enemySpeed: 0.3, bulletSpeed: 0.7, fireRate: 300, scoreMult: 1 },
    easy: { label: '休闲', lives: 5, totalStages: 4, killsPerStage: [12, 15, 18, 0], bossHp: [20, 28, 38, 48], spawnMs: 2500, enemySpeed: 0.25, bulletSpeed: 0.5, fireRate: 350, scoreMult: 1 },
    hard: { label: '炼狱', lives: 2, totalStages: 5, killsPerStage: [20, 25, 30, 35, 0], bossHp: [35, 45, 55, 65, 85], spawnMs: 1600, enemySpeed: 0.4, bulletSpeed: 0.9, fireRate: 250, scoreMult: 2 },
    danmaku: { label: '弹幕', lives: 2, totalStages: 5, killsPerStage: [15, 20, 25, 30, 0], bossHp: [32, 42, 52, 62, 80], spawnMs: 1800, enemySpeed: 0.35, bulletSpeed: 0.8, fireRate: 280, scoreMult: 2 },
    survival: { label: '生存', lives: 1, totalStages: 8, killsPerStage: [12, 15, 18, 20, 22, 25, 28, 0], bossHp: [25, 32, 40, 48, 55, 62, 70, 85], spawnMs: 1800, enemySpeed: 0.32, bulletSpeed: 0.75, fireRate: 290, escalate: true, scoreMult: 1.5 },
    strike: { label: '突击', lives: 3, totalStages: 5, killsPerStage: [15, 20, 25, 30, 0], bossHp: [30, 40, 50, 60, 80], spawnMs: 1700, enemySpeed: 0.38, bulletSpeed: 0.85, fireRate: 260, scoreMult: 1.8 },
  };

  let canvas, ctx;
  let rafId = null;
  let scoreEl, modeLabelEl, livesEl, bombsEl, levelEl, stageEl;
  let onGameOverCb = null;
  let keydownHandler = null;

  let W, H, mode, config, isOver, isVictory;
  let player, bullets, enemies, particles, pickups, killEffects;
  let score, lives, bombs, bulletLevel, frame, spawnTimer, difficulty;
  let bombFlash, cheatBuf;
  let gameStage, stageKills, stagePhase, intermissionTimer, stageBanner, stageBannerTimer;
  let keys = { up: false, down: false, left: false, right: false, fire: false, bomb: false };

  const ENEMY_CONFIG = {
    small: { size: 14, hp: 2, speed: 1.3, reward: 100, color: '#ff66ff', fireRate: 1.0, shape: 'arrow' },
    medium: { size: 20, hp: 3, speed: 1.0, reward: 150, color: '#ff44aa', fireRate: 1.0, shape: 'triangle' },
    large: { size: 28, hp: 4, speed: 0.75, reward: 200, color: '#ff22cc', fireRate: 1.0, shape: 'diamond' },
    elite: { size: 24, hp: 4, speed: 0.85, reward: 300, color: '#ff0066', fireRate: 0.6, shape: 'star' },
  };

  function getBossPattern() { return BOSS_PATTERNS[mode]?.[gameStage - 1] || 'spread'; }
  function getBossName() { return BOSS_NAMES[mode]?.[gameStage - 1] || `BOSS-${gameStage}`; }
  function getStageKillGoal() { return config.killsPerStage?.[gameStage - 1] || 5; }
  function getStageHp() { return config.bossHp?.[gameStage - 1] || 50; }

  function getRandomEnemyType() {
    const rand = Math.random();
    if (rand < 0.35) return 'small';
    if (rand < 0.60) return 'medium';
    if (rand < 0.80) return 'large';
    return 'elite';
  }

  function createEnemy(type, x, y) {
    const cfg = ENEMY_CONFIG[type];
    const baseSpeed = config.enemySpeed * (config.escalate ? 0.85 + difficulty * 0.08 : 1);
    
    return {
      x: x ?? (60 + Math.random() * (W - 120)),
      y: y ?? -cfg.size * 2,
      type,
      size: cfg.size,
      hp: cfg.hp,
      maxHp: cfg.hp,
      speed: baseSpeed * cfg.speed,
      reward: cfg.reward,
      color: cfg.color,
      fireRate: config.fireRate * cfg.fireRate,
      shape: cfg.shape,
      isBoss: false,
      hasFired: false,
      fireTimer: Math.floor(30 + Math.random() * 40),
      moveTimer: 0,
      movePattern: ['straight', 'zigzag', 'wave'][Math.floor(Math.random() * 3)],
      moveOffset: Math.random() * Math.PI * 2,
      moveAmplitude: 30 + Math.random() * 30,
      targetX: 0,
      entered: false,
    };
  }

  function createBoss() {
    return {
      x: W / 2,
      y: -80,
      targetY: 100,
      hp: getStageHp(),
      maxHp: getStageHp(),
      size: 45,
      color: '#ff22cc',
      isBoss: true,
      pattern: getBossPattern(),
      reward: 500 * gameStage,
      state: 'entering',
      fireTimer: 90,
      moveTimer: 0,
      moveDir: 1,
      moveSpeed: 0.6,
      phase: 0,
      lastFireTime: 0,
    };
  }

  function updateEnemy(en) {
    if (en.isBoss) {
      updateBoss(en);
      return;
    }

    en.moveTimer++;

    switch (en.movePattern) {
      case 'straight':
        en.y += en.speed;
        break;
      case 'zigzag':
        en.y += en.speed;
        en.x += Math.sin(en.moveTimer * 0.08 + en.moveOffset) * 2;
        break;
      case 'wave':
        en.y += en.speed * 0.9;
        en.x += Math.sin(en.moveTimer * 0.05 + en.moveOffset) * en.moveAmplitude * 0.02;
        break;
    }

    en.x = Math.max(en.size + 10, Math.min(W - en.size - 10, en.x));

    if (en.y > H + en.size + 30) {
      en.hp = 0;
    }

    en.fireTimer--;
    if (en.fireTimer <= 0) {
      fireEnemyBullet(en);
      en.hasFired = true;
      en.fireTimer = Math.floor(en.fireRate * (0.6 + Math.random() * 0.4));
    }
  }

  function updateBoss(en) {
    en.moveTimer++;
    en.phase += 0.02;

    if (en.state === 'entering') {
      en.y += 0.7;
      if (en.y >= en.targetY) {
        en.state = 'attacking';
        en.fireTimer = 30;
      }
      return;
    }

    const hpRatio = en.hp / en.maxHp;
    const speedMult = hpRatio < 0.3 ? 1.5 : (hpRatio < 0.6 ? 1.2 : 1.0);

    en.x += en.moveDir * en.moveSpeed * speedMult;
    if (en.x < en.size + 50) { en.x = en.size + 50; en.moveDir = 1; }
    if (en.x > W - en.size - 50) { en.x = W - en.size - 50; en.moveDir = -1; }

    en.fireTimer--;
    if (en.fireTimer <= 0) {
      fireBossBullet(en);
      en.fireTimer = Math.floor(config.fireRate * (hpRatio < 0.3 ? 0.4 : hpRatio < 0.6 ? 0.6 : 0.8));
    }
  }

  function shootPlayer() {
    const py = player.y - 14;
    const spd = -6 - Math.min(bulletLevel - 1, 2) * 0.45;
    const colors = ['#00f5ff', '#00ffcc', '#66ffaa', '#aaff66', '#ffe066'];
    const color = colors[bulletLevel - 1] || '#00f5ff';
    const r = 2.2 + bulletLevel * 0.35;

    const addShot = (x, vx, vy, br = r) => {
      bullets.push({ x, y: py, vx, vy: vy || spd, r: br, friendly: true, color });
    };

    switch (bulletLevel) {
      case 1:
        addShot(player.x, 0);
        break;
      case 2:
        addShot(player.x - 9, 0);
        addShot(player.x + 9, 0);
        break;
      case 3:
        addShot(player.x, 0);
        addShot(player.x - 11, -0.7);
        addShot(player.x + 11, 0.7);
        break;
      case 4:
        addShot(player.x, 0, spd * 1.05, r + 0.5);
        for (let i = -1; i <= 1; i++) addShot(player.x + i * 12, i * 0.55);
        break;
      default:
        for (let i = -2; i <= 2; i++) addShot(player.x + i * 9, i * 0.65, spd, r + 0.8);
        break;
    }
    if (Sfx?.shoot) Sfx.shoot();
  }

  function fireIntervalForLevel() {
    return Math.max(4, 9 - bulletLevel);
  }

  function useBomb() {
    if (bombs <= 0 || isOver) return false;
    bombs--;
    bombFlash = 30;
    player.invuln = Math.max(player.invuln, 90);
    if (Sfx?.bomb) Sfx.bomb();
    bullets = bullets.filter(b => b.friendly);
    enemies.forEach(en => {
      if (!en.isBoss) {
        addKillEffect(en.x, en.y, en.color, true);
        en.hp = 0;
      } else {
        en.hp = Math.max(1, en.hp - 15);
      }
    });
    burst(player.x, player.y, '#ffffff', 40);
    updateHUD();
    return true;
  }

  function fireEnemyBullet(en) {
    const baseSpeed = config.bulletSpeed * (config.escalate ? 0.85 + difficulty * 0.08 : 1);
    
    if (en.type === 'elite') {
      for (let i = -2; i <= 2; i++) {
        const angle = Math.PI / 2 + i * 0.12;
        bullets.push({
          x: en.x,
          y: en.y + 8,
          vx: Math.cos(angle) * baseSpeed,
          vy: Math.sin(angle) * baseSpeed,
          r: 4,
          friendly: false,
          color: en.color,
        });
      }
    } else {
      bullets.push({ x: en.x - 5, y: en.y + 8, vx: 0, vy: baseSpeed, r: 4, friendly: false, color: en.color });
      bullets.push({ x: en.x + 5, y: en.y + 8, vx: 0, vy: baseSpeed, r: 4, friendly: false, color: en.color });
    }
  }

  function fireBossBullet(en) {
    const speed = config.bulletSpeed * 1.3 * (config.escalate ? 0.85 + difficulty * 0.08 : 1);
    const bx = en.x;
    const by = en.y + 25;

    const addBullet = (x, y, vx, vy, r = 5) => {
      bullets.push({ x, y, vx, vy, r, friendly: false, color: en.color });
    };

    switch (en.pattern) {
      case 'straight':
        for (let i = -2; i <= 2; i++) addBullet(bx + i * 12, by, 0, speed);
        break;
      case 'spread':
        for (let i = 0; i < 7; i++) {
          const angle = Math.PI / 2 + (i - 3) * 0.18;
          addBullet(bx, by, Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
        break;
      case 'wave':
        for (let i = 0; i < 5; i++) {
          addBullet(bx + Math.sin(en.phase + i * 0.8) * 20, by + i * 15, 0, speed * 0.8);
        }
        break;
      case 'ring':
        for (let i = 0; i < 12; i++) {
          const angle = (Math.PI * 2 * i) / 12;
          addBullet(bx, by, Math.cos(angle) * speed, Math.sin(angle) * speed + speed * 0.5);
        }
        break;
      case 'spiral':
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8 + en.phase * 2;
          addBullet(bx, by, Math.cos(angle) * speed * 0.5, Math.sin(angle) * speed * 0.5 + speed * 0.6);
        }
        break;
      case 'cross':
        for (let i = -2; i <= 2; i++) {
          const angle = Math.PI / 2 + i * 0.2;
          addBullet(bx, by, Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
        break;
      case 'combo':
        for (let i = -3; i <= 3; i++) {
          const angle = Math.PI / 2 + i * 0.15;
          addBullet(bx, by, Math.cos(angle) * speed, Math.sin(angle) * speed);
        }
        break;
    }
  }

  function addKillEffect(x, y, color, isBomb = false) {
    killEffects.push({
      x, y, color,
      timer: isBomb ? 15 : 30,
      particles: [],
      isBomb,
    });
  }

  function updateKillEffects() {
    killEffects = killEffects.filter(effect => {
      effect.timer--;
      if (effect.timer > 0) {
        if (effect.timer === 29 || effect.timer === 14) {
          for (let i = 0; i < (effect.isBomb ? 20 : 10); i++) {
            const a = (Math.PI * 2 * i) / 10 + Math.random() * 0.5;
            const speed = 2 + Math.random() * 3;
            effect.particles.push({
              x: effect.x, y: effect.y,
              vx: Math.cos(a) * speed,
              vy: Math.sin(a) * speed,
              life: 20 + Math.random() * 10,
              color: effect.color,
            });
          }
        }
        effect.particles = effect.particles.filter(p => {
          p.x += p.vx;
          p.y += p.vy;
          p.vx *= 0.94;
          p.vy *= 0.94;
          p.life--;
          return p.life > 0;
        });
        return true;
      }
      return false;
    });
  }

  function onEnemyKilled(en) {
    if (en.isBoss) {
      onBossDefeated(en);
      return;
    }
    stageKills++;
    score += en.reward * config.scoreMult;
    addKillEffect(en.x, en.y, en.color);
    
    if (Math.random() < 0.2) {
      const types = ['power', 'bomb', 'heal'];
      pickups.push({ x: en.x, y: en.y, type: types[Math.floor(Math.random() * types.length)] });
    }
    
    updateHUD();
  }

  function onBossDefeated(en) {
    score += en.reward;
    addKillEffect(en.x, en.y, en.color, true);
    if (Sfx?.explode) Sfx.explode();
    
    if (Math.random() < 0.6) {
      for (let i = 0; i < 4; i++) {
        pickups.push({
          x: en.x + (Math.random() - 0.5) * 60,
          y: en.y + (Math.random() - 0.5) * 60,
          type: Math.random() < 0.6 ? 'power' : (Math.random() < 0.5 ? 'bomb' : 'heal'),
        });
      }
    }
    updateHUD();
  }

  function hitPlayer() {
    if (player.invuln > 0 || isOver || cheatBuf === '999') return;
    lives--;
    if (bulletLevel > 1) bulletLevel--;
    player.invuln = 120;
    if (Sfx?.hit) Sfx.hit();
    burst(player.x, player.y, '#00f5ff', 15);
    setBanner(bulletLevel > 0 ? `PWR Lv${bulletLevel}` : 'HIT!', 45);
    updateHUD();
    if (lives <= 0) gameOver();
  }

  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.5;
      particles.push({
        x, y,
        vx: Math.cos(a) * (1.5 + Math.random() * 3),
        vy: Math.sin(a) * (1.5 + Math.random() * 3),
        life: 20 + Math.random() * 20,
        color,
        size: 2 + Math.random() * 2,
      });
    }
  }

  function collide(ax, ay, ar, bx, by, br) {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy < (ar + br) * (ar + br);
  }

  function activateCheat() {
    lives = 999;
    bombs = 999;
    bulletLevel = MAX_BULLET_LV;
    player.invuln = 300;
    updateHUD();
    burst(player.x, player.y, '#ffff00', 30);
    if (Sfx?.explode) Sfx.explode();
  }

  function onDigit(d) {
    if (isOver) return;
    cheatBuf = (cheatBuf + d).slice(-3);
    if (cheatBuf === '999') {
      activateCheat();
      cheatBuf = '';
    }
  }

  function victory() {
    if (isOver) return;
    isOver = true;
    isVictory = true;
    setBanner('ALL STAGES CLEAR', 240);
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (onGameOverCb) onGameOverCb(Math.floor(score), { victory: true });
  }

  function gameOver() {
    if (isOver) return;
    isOver = true;
    isVictory = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (onGameOverCb) onGameOverCb(Math.floor(score), { victory: false });
  }

  function update() {
    if (isOver) return;
    frame++;

    if (player.invuln > 0) player.invuln--;
    if (bombFlash > 0) bombFlash--;

    const spd = 4;
    if (keys.up && player.y > 25) player.y -= spd;
    if (keys.down && player.y < H - 25) player.y += spd;
    if (keys.left && player.x > 25) player.x -= spd;
    if (keys.right && player.x < W - 25) player.x += spd;

    if (frame % fireIntervalForLevel() === 0) shootPlayer();

    if (keys.bomb && bombs > 0) {
      keys.bomb = false;
      useBomb();
    }

    enemies.forEach(en => updateEnemy(en));
    enemies = enemies.filter(en => en.hp > 0);

    bullets = bullets.filter(b => {
      b.x += b.vx;
      b.y += b.vy;

      if (b.friendly) {
        enemies.forEach(en => {
          if (!en.isBoss && !en.hasFired) return;
          if (collide(b.x, b.y, b.r, en.x, en.y, en.size * 0.8)) {
            en.hp--;
            b.r = -999;
            if (en.hp <= 0) onEnemyKilled(en);
          }
        });
      } else {
        if (collide(b.x, b.y, b.r, player.x, player.y, 7)) {
          hitPlayer();
          b.r = -999;
        }
      }

      return b.r > 0 && b.y > -30 && b.y < H + 30 && b.x > -30 && b.x < W + 30;
    });

    let hostileCount = 0;
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (bullets[i].friendly) continue;
      hostileCount++;
      if (hostileCount > MAX_HOSTILE_BULLETS) bullets.splice(i, 1);
    }

    particles = particles.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life--;
      return p.life > 0;
    });
    if (particles.length > MAX_PARTICLES) {
      particles.splice(0, particles.length - MAX_PARTICLES);
    }

    updateKillEffects();

    pickups = pickups.filter(p => {
      p.y += 1;
      if (collide(p.x, p.y, 10, player.x, player.y, 10)) {
        if (p.type === 'power') {
          if (bulletLevel < MAX_BULLET_LV) {
            bulletLevel++;
            setBanner(`PWR UP · Lv${bulletLevel}`, 75);
            burst(player.x, player.y, '#00ff88', 14);
            if (Sfx?.powerup) Sfx.powerup();
          } else {
            score += 500;
            setBanner('MAX PWR +500', 50);
            if (Sfx?.powerup) Sfx.powerup();
          }
        } else if (p.type === 'bomb' && bombs < 6) {
          bombs++;
        } else if (p.type === 'heal') {
          lives = Math.min(lives + 1, 6);
        }
        updateHUD();
        return false;
      }
      return p.y < H + 20;
    });

    if (stagePhase === 'intermission') {
      intermissionTimer--;
      if (intermissionTimer <= 0) {
        stagePhase = 'fighting';
        gameStage++;
        stageKills = 0;
        difficulty = (gameStage - 1) * 0.1;
        spawnTimer = 0;
        updateHUD();
      }
    } else if (stagePhase === 'fighting') {
      const goal = getStageKillGoal();
      if (goal === 0) {
        stagePhase = 'boss';
        enemies.push(createBoss());
        setBanner(`${getBossName()} 出现！`, 150);
      } else {
        const activeEnemies = enemies.filter(e => !e.isBoss).length;
        
        spawnTimer -= config.spawnMs;
        if (spawnTimer <= 0 && activeEnemies < 5 && stageKills < goal) {
          enemies.push(createEnemy(getRandomEnemyType()));
          spawnTimer = config.spawnMs;
        }

        if (stageKills >= goal) {
          stagePhase = 'boss';
          enemies.push(createBoss());
          setBanner(`${getBossName()} 出现！`, 150);
        }
      }
    } else if (stagePhase === 'boss') {
      if (enemies.filter(e => e.isBoss).length === 0) {
        if (gameStage >= config.totalStages) {
          victory();
        } else {
          stagePhase = 'intermission';
          intermissionTimer = 180;
          setBanner(`第 ${gameStage} 关 完成！`, 120);
        }
      }
    }

    render();
    rafId = requestAnimationFrame(update);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    ctx.strokeStyle = 'rgba(255, 102, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    particles.forEach(p => {
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 2, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    killEffects.forEach(effect => {
      effect.particles.forEach(p => {
        ctx.globalAlpha = p.life / 30;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
      });
      
      if (effect.timer > 0) {
        ctx.globalAlpha = effect.timer / 30;
        ctx.fillStyle = effect.color;
        ctx.beginPath(); ctx.arc(effect.x, effect.y, 15 - effect.timer * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    });
    ctx.globalAlpha = 1;

    bullets.filter(b => !b.friendly).forEach(b => {
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    });

    enemies.forEach(en => {
      if (en.isBoss) {
        renderBoss(en);
      } else {
        renderEnemy(en);
      }
    });

    pickups.forEach(p => {
      const colors = { power: '#00ff88', bomb: '#ffaa00', heal: '#ff4488' };
      const color = colors[p.type] || '#ffaa00';
      
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(p.type === 'power' ? 'L' : p.type === 'bomb' ? 'B' : '+', p.x, p.y + 4);
    });

    bullets.filter(b => b.friendly).forEach(b => {
      ctx.fillStyle = b.color;
      ctx.shadowColor = b.color;
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    });

    renderPlayer();

    if (bombFlash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${bombFlash / 30 * 0.4})`;
      ctx.fillRect(0, 0, W, H);
    }

    if (stageBanner && stageBannerTimer > 0) {
      stageBannerTimer--;
      const alpha = stageBannerTimer > 60 ? 1 : stageBannerTimer / 60;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(0, H / 2 - 40, W, 80);
      ctx.fillStyle = '#00f5ff';
      ctx.font = 'bold 32px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(stageBanner, W / 2, H / 2 + 10);
      ctx.globalAlpha = 1;
    }
  }

  function renderEnemy(en) {
    const px = en.x;
    const py = en.y;
    const s = en.size;
    const hpRatio = en.hp / en.maxHp;

    ctx.fillStyle = en.color;
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;

    switch (en.shape) {
      case 'arrow':
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px + s * 0.7, py + s * 0.7);
        ctx.lineTo(px, py + s * 0.2);
        ctx.lineTo(px - s * 0.7, py + s * 0.7);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,150,255,0.7)';
        ctx.beginPath(); ctx.arc(px, py + s * 0.4, 3, 0, Math.PI * 2); ctx.fill();
        break;

      case 'triangle':
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px + s * 0.9, py + s * 0.8);
        ctx.lineTo(px, py + s * 0.3);
        ctx.lineTo(px - s * 0.9, py + s * 0.8);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,180,255,0.8)';
        ctx.beginPath(); ctx.arc(px, py - s * 0.1, s * 0.2, 0, Math.PI * 2); ctx.fill();
        break;

      case 'diamond':
        ctx.beginPath();
        ctx.moveTo(px, py - s);
        ctx.lineTo(px + s * 0.8, py);
        ctx.lineTo(px, py + s);
        ctx.lineTo(px - s * 0.8, py);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = 'rgba(255,160,255,0.7)';
        ctx.beginPath(); ctx.arc(px, py, s * 0.25, 0, Math.PI * 2); ctx.fill();
        break;

      case 'star':
        ctx.shadowColor = en.color;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
          const x = px + Math.cos(angle) * s;
          const y = py + Math.sin(angle) * s;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(px, py, s * 0.35, 0, Math.PI * 2); ctx.fill();
        
        ctx.strokeStyle = 'rgba(255,0,102,0.7)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(px, py, s * 0.5, 0, Math.PI * 2); ctx.stroke();
        ctx.shadowBlur = 0;
        break;
    }

    if (hpRatio < 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(px - s, py - s - 10, s * 2, 4);
      ctx.fillStyle = '#00ff88';
      ctx.fillRect(px - s, py - s - 10, s * 2 * hpRatio, 4);
    }

    if (!en.hasFired) {
      ctx.strokeStyle = 'rgba(0,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py, s + 5, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function renderBoss(en) {
    const px = en.x;
    const py = en.y;
    const s = en.size;
    const hpRatio = Math.max(0, en.hp / en.maxHp);
    const hue = 280 + hpRatio * 50;

    ctx.fillStyle = `hsl(${hue}, 85%, ${40 + hpRatio * 20}%)`;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 3;

    ctx.beginPath();
    ctx.moveTo(px, py - s);
    ctx.lineTo(px + s * 0.3, py - s * 0.6);
    ctx.lineTo(px + s * 0.9, py - s * 0.7);
    ctx.lineTo(px + s * 1.1, py - s * 0.2);
    ctx.lineTo(px + s * 1.0, py + s * 0.3);
    ctx.lineTo(px + s * 0.7, py + s * 0.7);
    ctx.lineTo(px + s * 0.3, py + s * 0.85);
    ctx.lineTo(px, py + s * 0.6);
    ctx.lineTo(px - s * 0.3, py + s * 0.85);
    ctx.lineTo(px - s * 0.7, py + s * 0.7);
    ctx.lineTo(px - s * 1.0, py + s * 0.3);
    ctx.lineTo(px - s * 1.1, py - s * 0.2);
    ctx.lineTo(px - s * 0.9, py - s * 0.7);
    ctx.lineTo(px - s * 0.3, py - s * 0.6);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = `hsla(${hue}, 100%, 85%, 0.9)`;
    ctx.beginPath(); ctx.arc(px, py - s * 0.1, s * 0.3, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(px - 60, py - s - 35, 120, 15);
    ctx.fillStyle = `hsl(${hpRatio * 120}, 85%, 55%)`;
    ctx.fillRect(px - 60, py - s - 35, 120 * hpRatio, 15);
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px - 60, py - s - 35, 120, 15);

    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(getBossName(), px, py - s - 45);
    ctx.fillText(`${Math.floor(hpRatio * 100)}%`, px, py - s - 18);
  }

  function renderPlayer() {
    if (player.invuln > 0 && Math.floor(frame / 5) % 2 === 0) return;

    const px = player.x;
    const py = player.y;

    ctx.fillStyle = '#00f5ff';
    ctx.strokeStyle = 'rgba(0,245,255,0.9)';
    ctx.lineWidth = 2;

    if (bulletLevel >= 3) {
      ctx.strokeStyle = `rgba(0,255,136,${0.25 + bulletLevel * 0.12})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px, py + 2, 14 + bulletLevel * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,245,255,0.9)';
    }

    ctx.beginPath();
    ctx.moveTo(px, py - 18);
    ctx.lineTo(px + 7, py - 3);
    ctx.lineTo(px + 11, py + 10);
    ctx.lineTo(px + 4, py + 14);
    ctx.lineTo(px, py + 9);
    ctx.lineTo(px - 4, py + 14);
    ctx.lineTo(px - 11, py + 10);
    ctx.lineTo(px - 7, py - 3);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = '#00c8d8';
    ctx.beginPath();
    ctx.moveTo(px - 6, py - 1);
    ctx.lineTo(px - 20, py + 12);
    ctx.lineTo(px - 15, py + 16);
    ctx.lineTo(px - 4, py + 9);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(px + 6, py - 1);
    ctx.lineTo(px + 20, py + 12);
    ctx.lineTo(px + 15, py + 16);
    ctx.lineTo(px + 4, py + 9);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath(); ctx.ellipse(px, py - 5, 3, 6, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(0,245,255,0.8)';
    ctx.beginPath(); ctx.arc(px, py + 13, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px - 11, py + 13, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 11, py + 13, 2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = 'rgba(0,245,255,0.5)';
    ctx.beginPath();
    ctx.moveTo(px - 2, py + 15);
    ctx.lineTo(px, py + 24 + Math.sin(frame * 0.3) * 4);
    ctx.lineTo(px + 2, py + 15);
    ctx.closePath();
    ctx.fill();
  }

  function setBanner(text, duration) {
    stageBanner = text;
    stageBannerTimer = duration;
  }

  function updateHUD() {
    if (scoreEl) scoreEl.textContent = String(Math.floor(score));
    if (livesEl) livesEl.textContent = String(lives);
    if (bombsEl) bombsEl.textContent = String(bombs);
    if (levelEl) levelEl.textContent = String(bulletLevel);
    if (stageEl) stageEl.textContent = `${gameStage}/${config.totalStages}`;
    if (modeLabelEl) modeLabelEl.textContent = config.label;
  }

  function init(cvs, elements, gameMode, onGameOver) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    scoreEl = elements.score;
    livesEl = elements.lives;
    bombsEl = elements.bombs;
    levelEl = elements.level;
    stageEl = elements.stage;
    modeLabelEl = elements.modeLabel;
    onGameOverCb = onGameOver;

    mode = gameMode || 'classic';
    config = { ...MODES[mode] };

    score = 0;
    lives = config.lives;
    bombs = MAX_BOMBS_START;
    bulletLevel = 1;
    frame = 0;
    difficulty = 0;
    gameStage = 1;
    stageKills = 0;
    stagePhase = 'fighting';
    intermissionTimer = 0;
    bombFlash = 0;
    cheatBuf = '';
    isOver = false;
    isVictory = false;
    spawnTimer = 0;

    W = canvas.width;
    H = canvas.height;
    player = { x: W / 2, y: H - 70, invuln: 120 };
    bullets = [];
    enemies = [];
    particles = [];
    pickups = [];
    killEffects = [];

    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('keyup', handleKeyUp);
    }
    keydownHandler = handleKeyDown;
    document.addEventListener('keydown', keydownHandler);
    document.addEventListener('keyup', handleKeyUp);

    updateHUD();
    setBanner(`${config.label} 模式开始`, 150);
    rafId = requestAnimationFrame(update);
  }

  function restart() {
    if (!canvas) return;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    init(canvas, { score: scoreEl, lives: livesEl, bombs: bombsEl, level: levelEl, stage: stageEl, modeLabel: modeLabelEl }, mode, onGameOverCb);
  }

  function handleKeyDown(e) {
    switch (e.key.toLowerCase()) {
      case 'arrowup': case 'w': keys.up = true; break;
      case 'arrowdown': case 's': keys.down = true; break;
      case 'arrowleft': case 'a': keys.left = true; break;
      case 'arrowright': case 'd': keys.right = true; break;
      case 'z': case ' ': keys.fire = true; break;
      case 'x': keys.bomb = true; break;
    }
    if (e.key >= '0' && e.key <= '9') onDigit(e.key);
    e.preventDefault();
  }

  function handleKeyUp(e) {
    switch (e.key.toLowerCase()) {
      case 'arrowup': case 'w': keys.up = false; break;
      case 'arrowdown': case 's': keys.down = false; break;
      case 'arrowleft': case 'a': keys.left = false; break;
      case 'arrowright': case 'd': keys.right = false; break;
      case 'z': case ' ': keys.fire = false; break;
      case 'x': keys.bomb = false; break;
    }
  }

  function destroy() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (keydownHandler) {
      document.removeEventListener('keydown', keydownHandler);
      document.removeEventListener('keyup', handleKeyUp);
      keydownHandler = null;
    }
    isOver = true;
  }

  return { init, restart, destroy, handleInput: (a, p) => { if (!isOver) keys[a] = p; }, getMode: () => mode, isOver: () => isOver, isVictory: () => isVictory };
})();