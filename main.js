// ==================== ENTRY POINT ====================
import { GRID, SHAPES, COLORS } from './constants.js';
import { S, loadLeaderboard, requestRender } from './state.js';
import { setCanvas, setCtx, setDims, canvas } from './canvas.js';
import { initAudio } from './audio.js';
import { startGame, calcLayout } from './game.js';
import { render } from './renderer.js';
import { updateParticles, updateScorePopups } from './particles.js';
import { setDomRefs, nameInputOpenTime, handleClick, handlePointerMove, handlePointerUp, handlePointerLeave, handleKeyDown } from './input.js';
import { canPlace } from './grid.js';

const canvasEl = document.getElementById('c');
setCanvas(canvasEl);
const ctx2d = canvasEl.getContext('2d');
setCtx(ctx2d);

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  W = window.innerWidth;
  H = window.innerHeight;
  canvasEl.width = W * dpr;
  canvasEl.height = H * dpr;
  canvasEl.style.width = W + 'px';
  canvasEl.style.height = H + 'px';
  setDims(W, H, dpr);
  if (S.screen !== 'splash') calcLayout();
  for (const dp of S.decoPieces) { dp.x = Math.min(dp.x, W - 20); dp.y = Math.min(dp.y, H - 20); }
  if (S.drag && S.pieces[S.drag.idx]) {
    S.drag.cells = S.pieces[S.drag.idx].baseCells;
    S.drag.valid = canPlace(S.drag.cells, S.drag.gridR, S.drag.gridC);
  }
}

// DOM refs (let for compatibility with bundled build)
let nameOverlay = document.getElementById('nameOverlay');
let nameInp = document.getElementById('nameInp');
let nameBtn = document.getElementById('nameBtn');
setDomRefs(nameOverlay, nameInp, nameBtn);

// Event listeners
canvasEl.addEventListener('pointerdown', e => { initAudio(); handleClick(e.clientX, e.clientY); });
canvasEl.addEventListener('pointermove', e => { e.preventDefault(); handlePointerMove(e.clientX, e.clientY); });
canvasEl.addEventListener('pointerup', e => { e.preventDefault(); handlePointerUp(e.clientX, e.clientY); });
canvasEl.addEventListener('pointerleave', () => handlePointerLeave());

window.addEventListener('keydown', handleKeyDown);

// Name input
const savedName = (() => { try { return localStorage.getItem('bp_player_name') || ''; } catch(e) { return ''; } })();
nameInp.placeholder = savedName || '玩家';
nameBtn.addEventListener('click', () => {
  const name = nameInp.value.trim() || savedName || '玩家';
  S.playerName = name;
  try { localStorage.setItem('bp_player_name', name); } catch(e) {}
  nameOverlay.style.display = 'none';
  nameInp.blur();
  startGame();
});

nameInp.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (Date.now() - nameInputOpenTime < 250) return;
    nameBtn.click();
  }
});

function initGameDecos() {
  S.gameDecos = [];
  for (let i = 0; i < 8; i++) {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    S.gameDecos.push({
      cells: shape, color: Math.floor(Math.random() * COLORS.length) + 1,
      x: Math.random() * 800, y: Math.random() * 900,
      scale: 6 + Math.random() * 10, speed: 0.08 + Math.random() * 0.15,
      wobble: 0.3 + Math.random() * 0.8,
    });
  }
}

function initSplashDecorations() {
  S.decoPieces = [];
  for (let i = 0; i < 12; i++) {
    const shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    S.decoPieces.push({
      cells: shape, color: Math.floor(Math.random() * COLORS.length) + 1,
      x: Math.random() * 500, y: Math.random() * 800,
      scale: 8 + Math.random() * 14,
      speed: 0.1 + Math.random() * 0.3,
      wobble: 0.5 + Math.random() * 1.5,
    });
  }
}

// Frame loop
function frameLoop() {
  if (S.screen === 'splash') {
    render();
  } else {
    // Always render in game/gameover for smooth animation
    updateParticles();
    updateScorePopups();
    render();
    S.needsRender = false;
  }
  requestAnimationFrame(frameLoop);
}

function init() {
  resize();
  calcLayout();
  loadLeaderboard();
  initSplashDecorations();
  initGameDecos();
  for (const dp of S.decoPieces) { dp.x = Math.random() * W; dp.y = Math.random() * H; }
  render();
  window.addEventListener('resize', () => { resize(); render(); });
  frameLoop();
}

init();
