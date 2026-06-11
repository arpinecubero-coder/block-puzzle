// ==================== GAME LOGIC ====================
import { GRID, MUSIC_LIBRARY } from './constants.js';
import { S, getHighScore, saveScore, loadLeaderboard } from './state.js';
import { generatePieces, ensurePlayable } from './shapes.js';
import { placePiece, findFullLines, clearLines, canPlaceAny, canPlace } from './grid.js';
import { sfxPlace, sfxClear, sfxGameOver, startMusic, stopMusic } from './audio.js';
import { spawnParticles, spawnFlashParticle, addScorePopup, addBigCombo } from './particles.js';
import { boundingBox } from './draw.js';
import { W, H, refreshDims } from './canvas.js';
import { render } from './renderer.js';

export function calcLayout() {
  const availH = H - 310;
  const availW = W - 20;
  S.cellSize = Math.min(Math.floor(availW / GRID), Math.floor(availH / GRID));
  S.cellSize = Math.max(22, Math.min(48, S.cellSize));
  const gp = S.cellSize * GRID;
  S.gridX = (W - gp) / 2;
  S.gridY = 58;
  // Candidate area: must fit 3 pieces within screen width
  const candNeedW = 3 * 5 * S.cellSize + 24;
  S.candCS = (candNeedW > W - 16) ? Math.floor((W - 40) / 15) : S.cellSize;
  S.candCS = Math.max(16, S.candCS);
  S.candY = S.gridY + gp + 10;
  S.toolY = S.candY + 5 * S.candCS + 32;
}

export function checkGameOver() {
  for (const p of S.pieces) { if (canPlaceAny(p)) return false; }
  return true;
}

export function startGame() {
  S.screen = 'game'; S.gameOver = false;
  S.activeMusic = MUSIC_LIBRARY[Math.floor(Math.random() * MUSIC_LIBRARY.length)];
  startMusic();
  S.highScore = getHighScore(S.playerName);
  S.grid = Array.from({ length: GRID }, () => new Array(GRID).fill(0));
  S.gridDirty = true;
  S.prevPieceIds = [];
  S.pieces = ensurePlayable(generatePieces());
  S.score = 0; S.bombsLeft = 3; S.rerollsLeft = 5;
  S.bombMilestone = 0; S.rerollMilestone = 0; S.bombCheat = false;
  S.bombFlash = 0; S.bombFlashN = 0; S.rerollFlash = 0; S.rerollFlashN = 0;
  S.drag = null; S.kbSel = -1; S.kbR = 0; S.kbC = 0;
  S.clearing = null; S.inputLocked = false;
  S.bombMode = false; S.bombR = -1; S.bombC = -1; S.bombConfirmed = false;
  S.dialog = null; S.combo = 0; S.comboText = '';
  S.particles = []; S.scorePopups = []; S.placedAnim = []; S.notifications = [];
  S.hasDragged = false;
  try { S.showTutorial = !localStorage.getItem('bp_tutorial_done'); } catch(e) { S.showTutorial = true; }
  S.tutorialDismissed = false;
  S.undoGrid = null; S.undoScore = 0; S.undoPieces = null;
  refreshDims(); calcLayout(); render();
}

function checkMilestones() {
  let bombEarned = 0, rerollEarned = 0;
  while (S.score >= S.bombMilestone + 500) { S.bombMilestone += 500; S.bombsLeft++; bombEarned++; }
  while (S.score >= S.rerollMilestone + 100) { S.rerollMilestone += 100; S.rerollsLeft++; rerollEarned++; }
  if (bombEarned > 0) { S.bombFlash = Date.now(); S.bombFlashN = bombEarned; }
  if (rerollEarned > 0) { S.rerollFlash = Date.now(); S.rerollFlashN = rerollEarned; }
}

export function showResetDialog() {
  S.dialog = {
    msg: `换一批方块？(剩余 ${S.rerollsLeft} 次)`,
    okText: '确定', cancelText: '取消',
    onOk: () => {
      if (S.rerollsLeft <= 0) return;
      S.rerollsLeft--;
      S.prevPieceIds = S.pieces.map(p => p.id);
      S.pieces = ensurePlayable(generatePieces());
      S.kbSel = -1;
    },
  };
}

export function endGame() {
  S.screen = 'gameover'; S.gameOver = true;
  stopMusic(); sfxGameOver();
  if (S.score > S.highScore) {
    S.highScore = S.score;
    try { localStorage.setItem('bp_high_' + S.playerName, S.highScore); } catch(e) {}
  }
  saveScore(S.playerName, S.score, S.bombCheat);
  loadLeaderboard();
  render();
}

export function commitPlacement(idx, cells, color, gr, gc) {
  S.undoGrid = S.grid.map(row => [...row]);
  S.undoScore = S.score;
  S.undoPieces = S.pieces.map(p => ({ ...p, baseCells: p.baseCells.map(([r,c])=>[r,c]) }));
  S.inputLocked = true;
  placePiece(cells, color, gr, gc);
  S.gridDirty = true;
  const now = Date.now();
  for (const [r, c] of cells) S.placedAnim.push({ r: gr + r, c: gc + c, color, t: now });
  S.score += cells.length;
  sfxPlace();
  const bb = boundingBox(cells);
  addScorePopup(gr + Math.floor(bb.rows / 2), gc + Math.floor(bb.cols / 2), '+' + cells.length);
  S.pieces.splice(idx, 1);
  S.kbSel = -1;

  const { rows, cols } = findFullLines();
  if (rows.length > 0 || cols.length > 0) {
    S.clearing = new Set();
    for (const r of rows) for (let c = 0; c < GRID; c++) S.clearing.add(`${r},${c}`);
    for (const c of cols) for (let r = 0; r < GRID; r++) S.clearing.add(`${r},${c}`);
    for (const key of S.clearing) { const [rr, cc] = key.split(',').map(Number); spawnFlashParticle(rr, cc); }
    setTimeout(() => {
      const cleared = clearLines(rows, cols); S.gridDirty = true;
      for (const key of S.clearing) {
        const [rr, cc] = key.split(',').map(Number);
        if (S.grid[rr] && S.grid[rr][cc] !== undefined) spawnParticles(rr, cc, 1);
      }
      if (cleared > 0) {
        sfxClear(cleared); S.combo++;
        let pts = cleared * 10;
        if (cleared >= 4) pts = Math.floor(pts * 3);
        else if (cleared >= 3) pts = Math.floor(pts * 2);
        else if (cleared >= 2) pts = Math.floor(pts * 1.5);
        pts += S.combo * 5; S.score += pts;
        S.comboText = S.combo > 1 ? `Combo x${S.combo}! +${pts}` : `+${pts}`;
        if (rows.length) addScorePopup(rows[0], 4, S.comboText);
        if (S.combo >= 2) addBigCombo(S.combo, pts);
      }
      S.clearing = null; afterPlace();
    }, 350);
  } else { S.combo = 0; S.comboText = ''; afterPlace(); }
}

function afterPlace() {
  checkMilestones();
  if (S.pieces.length === 0) {
    S.pieces = ensurePlayable(generatePieces());
  }
  if (checkGameOver()) { endGame(); return; }
  S.inputLocked = false;
}

export function doUndo() {
  if (!S.undoGrid) return;
  S.grid = S.undoGrid; S.score = S.undoScore; S.pieces = S.undoPieces;
  S.gridDirty = true; S.undoGrid = null; S.undoScore = 0; S.undoPieces = null;
  S.combo = 0; S.comboText = ''; S.drag = null; S.kbSel = -1;
  S.inputLocked = false; S.clearing = null;
}

export function doBomb(r, c) {
  if (!S.bombCheat && S.bombsLeft <= 0) { S.bombMode = false; return; }
  if (!S.bombCheat) S.bombsLeft--;
  for (let dr = -2; dr <= 2; dr++)
    for (let dc = -2; dc <= 2; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < GRID && nc >= 0 && nc < GRID) {
        if (S.grid[nr][nc] !== 0) spawnParticles(nr, nc, S.grid[nr][nc]);
        S.grid[nr][nc] = 0;
      }
    }
  S.gridDirty = true; S.bombMode = false; S.bombR = -1; S.bombC = -1; S.bombConfirmed = false;
  if (checkGameOver()) endGame();
}

export function toggleBombCheat() { S.bombCheat = !S.bombCheat; }
