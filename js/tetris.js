/**
 * Lv999 Tetris - 俄罗斯方块
 */
const TetrisGame = (function () {
  const COLS = 10;
  const ROWS = 20;
  const BASE_DROP = 800;
  const LINES_PER_LEVEL = 10;

  const SHAPES = {
    I: { color: '#00f5ff', cells: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]] },
    O: { color: '#ffff00', cells: [[1, 1], [1, 1]] },
    T: { color: '#ff00ea', cells: [[0, 1, 0], [1, 1, 1], [0, 0, 0]] },
    S: { color: '#00ff88', cells: [[0, 1, 1], [1, 1, 0], [0, 0, 0]] },
    Z: { color: '#ff4466', cells: [[1, 1, 0], [0, 1, 1], [0, 0, 0]] },
    J: { color: '#7b2fff', cells: [[1, 0, 0], [1, 1, 1], [0, 0, 0]] },
    L: { color: '#ff8800', cells: [[0, 0, 1], [1, 1, 1], [0, 0, 0]] },
  };

  const PIECE_KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
  const SCORE_TABLE = [0, 100, 300, 500, 800];

  let canvas, ctx;
  let dropTimer = null;
  let scoreEl, levelEl, linesEl, statusEl;
  let onGameOverCb = null;

  let board, piece, pieceType, pieceRow, pieceCol, score, level, lines, dropInterval;
  let paused = false;
  let isOver = false;

  function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  function reset() {
    board = emptyBoard();
    score = 0;
    level = 1;
    lines = 0;
    dropInterval = BASE_DROP;
    paused = false;
    isOver = false;
    updateHUD();
    if (statusEl) statusEl.textContent = '';
    spawnPiece();
  }

  function updateHUD() {
    if (scoreEl) scoreEl.textContent = String(score);
    if (levelEl) levelEl.textContent = String(level);
    if (linesEl) linesEl.textContent = String(lines);
  }

  function randomPiece() {
    const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
    return {
      type: key,
      matrix: SHAPES[key].cells.map((row) => row.slice()),
      color: SHAPES[key].color,
    };
  }

  function spawnPiece() {
    const p = randomPiece();
    pieceType = p.type;
    piece = p.matrix;
    const color = p.color;
    pieceRow = 0;
    pieceCol = Math.floor((COLS - piece[0].length) / 2);

    if (collides(piece, pieceRow, pieceCol)) {
      gameOver();
      return;
    }
    piece._color = color;
  }

  function rotateMatrix(m) {
    const rows = m.length;
    const cols = m[0].length;
    const result = Array.from({ length: cols }, () => Array(rows).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        result[c][rows - 1 - r] = m[r][c];
      }
    }
    return result;
  }

  function collides(mat, row, col) {
    for (let r = 0; r < mat.length; r++) {
      for (let c = 0; c < mat[r].length; c++) {
        if (!mat[r][c]) continue;
        const nr = row + r;
        const nc = col + c;
        if (nc < 0 || nc >= COLS || nr >= ROWS) return true;
        if (nr >= 0 && board[nr][nc]) return true;
      }
    }
    return false;
  }

  function mergePiece() {
    const color = piece._color || SHAPES[pieceType].color;
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (!piece[r][c]) continue;
        const nr = pieceRow + r;
        const nc = pieceCol + c;
        if (nr >= 0) board[nr][nc] = color;
      }
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every((cell) => cell !== null)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    if (cleared > 0) {
      score += SCORE_TABLE[cleared] * level;
      lines += cleared;
      level = Math.floor(lines / LINES_PER_LEVEL) + 1;
      dropInterval = Math.max(100, BASE_DROP - (level - 1) * 70);
      restartDropTimer();
      updateHUD();
      if (typeof Sfx !== 'undefined') Sfx.tetrisLine(cleared);
    }
  }

  function lockPiece() {
    mergePiece();
    clearLines();
    spawnPiece();
    draw();
  }

  function move(dx, dy, silent) {
    if (paused || !piece) return false;
    if (!collides(piece, pieceRow + dy, pieceCol + dx)) {
      pieceRow += dy;
      pieceCol += dx;
      draw();
      if (!silent && typeof Sfx !== 'undefined') Sfx.tetrisMove();
      return true;
    }
    return false;
  }

  function tryRotate() {
    if (paused || !piece) return;
    const rotated = rotateMatrix(piece);
    const kicks = [0, -1, 1, -2, 2];
    for (const k of kicks) {
      if (!collides(rotated, pieceRow, pieceCol + k)) {
        piece = rotated;
        pieceCol += k;
        draw();
        if (typeof Sfx !== 'undefined') Sfx.tetrisRotate();
        return;
      }
    }
  }

  function hardDrop() {
    if (paused || !piece) return;
    while (move(0, 1, true)) {
      score += 2;
    }
    if (typeof Sfx !== 'undefined') Sfx.tetrisDrop();
    lockPiece();
    updateHUD();
  }

  function softDrop() {
    if (paused || !piece || softDropLock) return;
    if (move(0, 1)) {
      score += 1;
      updateHUD();
    } else {
      lockPiece();
    }
  }

  function drop() {
    if (paused || !piece) return;
    if (!move(0, 1)) {
      lockPiece();
    }
  }

  function ghostPosition() {
    let gr = pieceRow;
    while (!collides(piece, gr + 1, pieceCol)) gr++;
    return gr;
  }

  function handleInput(action) {
    if (isOver) return;
    switch (action) {
      case 'left':
        move(-1, 0);
        break;
      case 'right':
        move(1, 0);
        break;
      case 'down':
        softDrop();
        break;
      case 'up':
      case 'rotate':
        tryRotate();
        break;
      case 'hardDrop':
        hardDrop();
        break;
      case 'pause':
        paused = !paused;
        if (statusEl) statusEl.textContent = paused ? 'PAUSED' : '';
        break;
      default:
        break;
    }
  }

  function gameOver() {
    if (isOver) return;
    isOver = true;
    if (dropTimer) {
      clearInterval(dropTimer);
      dropTimer = null;
    }
    piece = null;
    draw();
    if (onGameOverCb) onGameOverCb(score);
  }

  function drawCell(x, y, size, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha * 0.8;
    ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
    ctx.globalAlpha = 1;
  }

  function draw() {
    if (!ctx || !canvas) return;
    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / COLS;
    const cellH = h / ROWS;

    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(255, 0, 234, 0.08)';
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW, 0);
      ctx.lineTo(c * cellW, h);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH);
      ctx.lineTo(w, r * cellH);
      ctx.stroke();
    }

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (board[r][c]) {
          drawCell(c * cellW, r * cellH, cellW, board[r][c], 1);
        }
      }
    }

    if (!piece) return;
    const color = piece._color || SHAPES[pieceType].color;

    const ghostR = ghostPosition();
    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (!piece[r][c]) continue;
        drawCell(
          (pieceCol + c) * cellW,
          (ghostR + r) * cellH,
          cellW,
          color,
          0.2
        );
      }
    }

    for (let r = 0; r < piece.length; r++) {
      for (let c = 0; c < piece[r].length; c++) {
        if (!piece[r][c]) continue;
        const yr = pieceRow + r;
        if (yr < 0) continue;
        drawCell((pieceCol + c) * cellW, yr * cellH, cellW, color, 1);
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillRect((pieceCol + c) * cellW + 2, yr * cellH + 2, cellW - 4, cellH - 4);
        ctx.shadowBlur = 0;
      }
    }
  }

  function resizeCanvas() {
    if (!canvas) return;
    const maxW = Math.min(360, window.innerWidth - 140);
    const maxH = Math.min(640, window.innerHeight - 48);
    const aspect = COLS / ROWS;
    let w = maxW;
    let h = w / aspect;
    if (h > maxH) {
      h = maxH;
      w = h * aspect;
    }
    canvas.width = Math.floor(w);
    canvas.height = Math.floor(h);
    draw();
  }

  function restartDropTimer() {
    if (dropTimer) clearInterval(dropTimer);
    dropTimer = setInterval(drop, dropInterval);
  }

  function init(cvs, elements, onGameOver) {
    canvas = cvs;
    ctx = canvas.getContext('2d');
    scoreEl = elements.score;
    levelEl = elements.level;
    linesEl = elements.lines;
    statusEl = elements.status;
    onGameOverCb = onGameOver;

    reset();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    draw();
    restartDropTimer();
  }

  function restart() {
    if (!canvas) return;
    reset();
    draw();
    restartDropTimer();
  }

  function destroy() {
    if (dropTimer) {
      clearInterval(dropTimer);
      dropTimer = null;
    }
    window.removeEventListener('resize', resizeCanvas);
    canvas = null;
    ctx = null;
    piece = null;
    onGameOverCb = null;
    isOver = false;
  }

  return { init, destroy, restart, handleInput };
})();
