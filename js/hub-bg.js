/**
 * 大厅背景：像素飞机、星球、列车
 */
const HubBg = (function () {
  let canvas, ctx, rafId, W, H, running;

  const planes = [];
  const planets = [];
  const gamepads = [];
  let train = null;

  function initPlane(i) {
    const fromLeft = i % 2 === 0;
    return {
      x: fromLeft ? -40 : W + 40,
      y: H * (0.15 + i * 0.12),
      vx: fromLeft ? 0.45 + i * 0.06 : -(0.45 + i * 0.06),
      vy: 0,
      angle: fromLeft ? 0 : Math.PI,
      targetAngle: fromLeft ? 0 : Math.PI,
      bank: 0,
      scale: 0.9 + (i % 3) * 0.15,
      hue: i % 2 === 0 ? '#00f5ff' : '#ff00ea',
      wander: Math.random() * Math.PI * 2,
    };
  }

  function initPlanets() {
    planets.length = 0;
    const configs = [
      { x: 0.12, y: 0.22, r: 28, color: '#7b2fff', ring: true },
      { x: 0.88, y: 0.28, r: 22, color: '#ff8800', ring: false },
      { x: 0.72, y: 0.72, r: 18, color: '#00ff88', ring: false },
    ];
    configs.forEach((c, i) => {
      planets.push({
        bx: c.x,
        by: c.y,
        r: c.r,
        color: c.color,
        ring: c.ring,
        phase: i * 1.2,
        driftX: 0.000025 * (i % 2 ? 1 : -1),
        driftY: 0.000018 * (i % 2 ? -1 : 1),
      });
    });
  }

  function initGamepads() {
    gamepads.length = 0;
    gamepads.push({ bx: 0.06, by: 0.62, phase: 0, flip: false, hue: '#00f5ff' });
    gamepads.push({ bx: 0.9, by: 0.66, phase: 1.8, flip: true, hue: '#ff00ea' });
  }

  function drawPixelGamepad(gp) {
    const x = gp.bx * W + Math.sin(gp.phase) * 10;
    const y = gp.by * H + Math.cos(gp.phase * 0.6) * 6;
    ctx.save();
    ctx.translate(x, y);
    if (gp.flip) ctx.scale(-1, 1);
    ctx.fillStyle = 'rgba(10, 14, 26, 0.75)';
    ctx.fillRect(-28, -10, 56, 22);
    ctx.strokeStyle = gp.hue;
    ctx.lineWidth = 2;
    ctx.strokeRect(-28, -10, 56, 22);
    ctx.fillStyle = gp.hue;
    ctx.fillRect(-22, -4, 10, 10);
    ctx.fillRect(8, -4, 6, 6);
    ctx.fillRect(16, -6, 6, 6);
    ctx.fillRect(8, 4, 6, 6);
    ctx.fillRect(16, 2, 6, 6);
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(20, -2, 5, 5);
    ctx.restore();
  }

  function initTrain() {
    train = {
      x: -200,
      dir: 1,
      speed: 0.65,
      cars: 5,
      wheelPhase: 0,
      y: 0,
    };
  }

  function resize() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    W = canvas.width = Math.floor(rect.width);
    H = canvas.height = Math.floor(rect.height);
    if (planes.length === 0) {
      for (let i = 0; i < 4; i++) planes.push(initPlane(i));
      initPlanets();
      initGamepads();
      initTrain();
    }
    train.y = H - 36;
  }

  function drawPixelPlane(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle + p.bank);
    ctx.scale(p.scale, p.scale);

    const body = p.hue;
    ctx.fillStyle = body;
    ctx.shadowColor = body;
    ctx.shadowBlur = 6;

    ctx.fillRect(-14, -3, 28, 6);
    ctx.fillRect(-6, -8, 12, 16);
    ctx.fillRect(-18, 0, 8, 4);
    ctx.fillRect(10, 0, 8, 4);
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(8, -2, 6, 4);

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawPlanet(pl) {
    const x = pl.bx * W + Math.sin(pl.phase) * 12;
    const y = pl.by * H + Math.cos(pl.phase * 0.7) * 8;
    ctx.fillStyle = pl.color;
    ctx.shadowColor = pl.color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(x, y, pl.r, 0, Math.PI * 2);
    ctx.fill();
    if (pl.ring) {
      ctx.strokeStyle = 'rgba(0, 245, 255, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(x, y, pl.r * 1.5, pl.r * 0.35, 0.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x - pl.r * 0.3, y - pl.r * 0.4, pl.r * 0.35, pl.r * 0.25);
  }

  function drawTrain() {
    const y = train.y;
    const carW = 36;
    const totalW = train.cars * carW + 20;

    ctx.fillStyle = 'rgba(90, 122, 154, 0.4)';
    ctx.fillRect(0, y + 14, W, 4);

    ctx.fillStyle = '#5a7a9a';
    for (let i = 0; i < W; i += 12) {
      ctx.fillRect(i, y + 15, 8, 2);
    }

    for (let c = 0; c < train.cars; c++) {
      const cx = train.x + c * carW;
      const hue = c % 2 === 0 ? '#00f5ff' : '#7b2fff';
      ctx.fillStyle = hue;
      ctx.fillRect(cx, y - 8, carW - 4, 18);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(cx + 4, y - 4, 10, 8);
      ctx.fillRect(cx + carW - 18, y - 4, 10, 8);

      const wx = cx + 8;
      const wx2 = cx + carW - 14;
      const rot = train.wheelPhase + c;
      [wx, wx2].forEach((wxp) => {
        ctx.save();
        ctx.translate(wxp, y + 12);
        ctx.rotate(rot);
        ctx.fillStyle = '#c8e6ff';
        ctx.fillRect(-4, -4, 8, 8);
        ctx.fillStyle = '#0a0e1a';
        ctx.fillRect(-1, -4, 2, 8);
        ctx.restore();
      });
    }

    ctx.fillStyle = '#ff00ea';
    ctx.fillRect(train.x - 12, y + 2, 10, 6);
  }

  function updatePlane(p) {
    p.wander += 0.008;
    const desiredVy = Math.sin(p.wander) * 0.18;
    const desiredVx = p.vx > 0 ? 0.55 : -0.55;

    p.vy += (desiredVy - p.vy) * 0.03;
    p.vx += (desiredVx - p.vx) * 0.015;

    p.x += p.vx;
    p.y += p.vy;

    const targetAngle = Math.atan2(p.vy, p.vx);
    let diff = targetAngle - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += diff * 0.05;
    p.bank = diff * 0.15;

    p.y = Math.max(H * 0.08, Math.min(H * 0.55, p.y));

    if (p.vx > 0 && p.x > W + 50) {
      p.x = -50;
      p.y = H * (0.12 + Math.random() * 0.35);
    } else if (p.vx < 0 && p.x < -50) {
      p.x = W + 50;
      p.y = H * (0.12 + Math.random() * 0.35);
    }
  }

  function update() {
    planes.forEach(updatePlane);
    gamepads.forEach((gp) => {
      gp.phase += 0.004;
    });

    planets.forEach((pl) => {
      pl.phase += 0.003;
      pl.bx += pl.driftX;
      pl.by += pl.driftY;
      if (pl.bx < 0.05 || pl.bx > 0.95) pl.driftX *= -1;
      if (pl.by < 0.1 || pl.by > 0.8) pl.driftY *= -1;
    });

    train.x += train.speed * train.dir;
    train.wheelPhase += 0.08 * train.dir;
    const totalW = train.cars * 36 + 40;
    if (train.x > W + 20) {
      train.x = -totalW;
    } else if (train.x < -totalW - 20) {
      train.x = W + 20;
      train.dir = 1;
    }
  }

  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);

    planets.forEach(drawPlanet);
    gamepads.forEach(drawPixelGamepad);
    planes.forEach(drawPixelPlane);
    drawTrain();
  }

  function loop() {
    if (!running) return;
    update();
    draw();
    rafId = requestAnimationFrame(loop);
  }

  function start(cvs) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    running = true;
    resize();
    window.addEventListener('resize', resize);
    loop();
  }

  function stop() {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener('resize', resize);
  }

  return { start, stop, resize };
})();
