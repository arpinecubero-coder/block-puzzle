// ==================== INPUT HANDLING ====================
import { GRID } from './constants.js';
import { S } from './state.js';
import { W, H } from './canvas.js';
import { canPlace } from './grid.js';
import { boundingBox } from './draw.js';
import { initAudio, toggleMusic, sfxButton, stopMusic } from './audio.js';
import { commitPlacement, doUndo, doBomb, showResetDialog, endGame, startGame, calcLayout, toggleBombCheat } from './game.js';
import { render } from './renderer.js';

export let nameInputOpenTime = 0;

export function setDomRefs(no, ni, nb) { nameOverlay = no; nameInp = ni; nameBtn = nb; }

export function getTouchPiece(tx, ty) {
  if (S.pieces.length===0) return null;
  const cs=S.candCS, totalW=S.pieces.length*5*cs+(S.pieces.length-1)*12, startX=(W-totalW)/2, cy=S.candY;
  for (let i=0;i<S.pieces.length;i++) {
    const sx=startX+i*(5*cs+12);
    if (tx>=sx-8&&tx<=sx+5*cs+8&&ty>=cy-8&&ty<=cy+5*cs+8) {
      const cells=S.pieces[i].baseCells;
      const bb={rows:Math.max(...cells.map(([r])=>r))+1,cols:Math.max(...cells.map(([,c])=>c))+1};
      const px=sx+(5*cs-bb.cols*cs)/2,py=cy+(5*cs-bb.rows*cs)/2;
      return {idx:i, cellR:Math.floor((ty-py)/cs), cellC:Math.floor((tx-px)/cs),
        fracR:(ty-py)/cs-Math.floor((ty-py)/cs), fracC:(tx-px)/cs-Math.floor((tx-px)/cs)};
    }
  }
  return null;
}

export function getGridCell(tx, ty) {
  const gc = Math.floor((tx - S.gridX) / S.cellSize);
  const gr = Math.floor((ty - S.gridY) / S.cellSize);
  if (gr < 0 || gr >= GRID || gc < 0 || gc >= GRID) return null;
  return { r: gr, c: gc };
}

function isInToolbar(tx, ty) {
  const by = S.toolY;
  const bh = Math.max(46, Math.floor(S.cellSize * 1.2));
  const bw = Math.floor(bh * 1.35);
  const gap = 8;
  const totalW = bw * 5 + gap * 4;
  const startX = Math.floor((W - totalW) / 2);
  if (ty >= by && ty <= by + bh) {
    if (tx >= startX && tx <= startX + bw) return 'undo';
    if (tx >= startX + bw + gap && tx <= startX + bw + gap + bw) return 'reset';
    if (tx >= startX + (bw + gap) * 2 && tx <= startX + (bw + gap) * 2 + bw) return 'bomb';
    if (tx >= startX + (bw + gap) * 3 && tx <= startX + (bw + gap) * 3 + bw) return 'share';
    if (tx >= startX + (bw + gap) * 4 && tx <= startX + (bw + gap) * 4 + bw) return 'end';
  }
  return null;
}

function isFreeToggle(tx, ty) {
  const freeX = 70, freeY = 3, freeW = 40, freeH = 20;
  return tx >= freeX && tx <= freeX + freeW && ty >= freeY && ty <= freeY + freeH;
}

function isMuteButton(tx, ty) {
  const muteX = W - 42, muteY = 10, muteS = 30;
  return tx >= muteX && tx <= muteX + muteS && ty >= muteY && ty <= muteY + muteS;
}

function startDrag(idx, cellR, cellC, fracR, fracC) {
  const p = S.pieces[idx];
  S.drag = { idx, cells: p.baseCells, color: p.color, offCellR: cellR, offCellC: cellC, offFracR: fracR, offFracC: fracC,
    startX: null, startY: null, gridR: null, gridC: null, valid: false, active: false };
  S.kbSel = -1; S.bombMode = false;
}

function endDrag() {
  if (!S.drag) return;
  if (S.drag.valid) commitPlacement(S.drag.idx, S.drag.cells, S.drag.color, S.drag.gridR, S.drag.gridC);
  S.drag = null; render();
}

function updateDragPos(mx, my) {
  if (!S.drag) return;
  // Record start position on first move
  if (S.drag.startX == null) { S.drag.startX = mx; S.drag.startY = my; S.drag.mx = mx; S.drag.my = my; return; }
  const dx = mx - S.drag.startX, dy = my - S.drag.startY;
  // Minimum 8px drag distance before activating ghost/placement
  if (!S.drag.active && Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
  S.drag.active = true; S.hasDragged = true;
  S.drag.mx = mx; S.drag.my = my;
  const ax = mx - S.drag.offFracC * S.cellSize - S.drag.offCellC * S.cellSize;
  const ay = my - S.drag.offFracR * S.cellSize - S.drag.offCellR * S.cellSize;
  S.drag.fx = (ax - S.gridX) / S.cellSize;
  S.drag.fy = (ay - S.gridY) / S.cellSize;
  const bb = boundingBox(S.drag.cells);
  S.drag.gridC = Math.max(0, Math.min(GRID - bb.cols, Math.round(S.drag.fx)));
  S.drag.gridR = Math.max(0, Math.min(GRID - bb.rows, Math.round(S.drag.fy)));
  S.drag.valid = canPlace(S.drag.cells, S.drag.gridR, S.drag.gridC);
}


export function handleClick(tx, ty) {
  if (S.screen === 'splash') {
    const cardW = Math.min(360, W * 0.88), cardH = 320;
    const cx = (W - cardW) / 2, cy = Math.max(10, (H - cardH) / 2 - 30);
    const bbx = (W - 150) / 2, bby = cy + cardH - 60;
    // Switch name link
    if (S._switchY > 0 && tx >= bbx && tx <= bbx + 150 && ty >= S._switchY && ty <= S._switchY + S._switchH) {
      sfxButton();
      nameOverlay.style.display = 'flex';
      nameInp.value = '';
      nameInputOpenTime = Date.now();
      setTimeout(() => nameInp.focus(), 150);
      return;
    }
    // Start button
    if (tx >= bbx && tx <= bbx + 150 && ty >= bby && ty <= bby + 44) {
      sfxButton();
      const saved = (() => { try { return localStorage.getItem('bp_player_name') || ''; } catch(e) { return ''; } })();
      if (saved) {
        S.playerName = saved;
        startGame();
      } else {
        nameOverlay.style.display = 'flex';
        nameInp.value = '';
        nameInputOpenTime = Date.now();
        setTimeout(() => nameInp.focus(), 150);
      }
    }
    return;
  }
  if (S.screen === 'gameover') { sfxButton(); returnToSplash(); return; }
  if (S.inputLocked) return;

  if (S.dialog && S.dialog._bx1) {
    const { _bx1, _bx2, _by, _bw, _bh } = S.dialog;
    if (ty >= _by && ty <= _by + _bh) {
      if (tx >= _bx1 && tx <= _bx1 + _bw) { S.dialog = null; render(); return; }
      if (tx >= _bx2 && tx <= _bx2 + _bw) {
        const cb = S.dialog.onOk; S.dialog = null; if (cb) cb(); render(); return;
      }
    }
    S.dialog = null; render(); return;
  }

  if (isMuteButton(tx, ty)) { toggleMusic(); render(); return; }
  if (isFreeToggle(tx, ty)) { toggleBombCheat(); render(); return; }

  const tool = isInToolbar(tx, ty);
  if (tool === 'undo') { doUndo(); render(); return; }
  if (tool === 'reset') { showResetDialog(); render(); return; }
  if (tool === 'share') { shareScore(); render(); return; }
  if (tool === 'bomb') {
    S.bombMode = !S.bombMode; S.bombR = -1; S.bombC = -1; S.bombConfirmed = false;
    S.drag = null; S.kbSel = -1; render(); return;
  }
  if (tool === 'end') {
    S.dialog = { msg: '确定要结束游戏吗？', okText: '结束', cancelText: '继续', onOk: () => { endGame(); } };
    render(); return;
  }

  if (S.bombMode) {
    const cell = getGridCell(tx, ty);
    if (!cell) { S.bombMode = false; S.bombConfirmed = false; render(); return; }
    if (S.bombConfirmed && cell.r === S.bombR && cell.c === S.bombC) {
      doBomb(cell.r, cell.c); S.bombConfirmed = false;
    } else {
      S.bombR = cell.r; S.bombC = cell.c; S.bombConfirmed = true;
    }
    render(); return;
  }

  const info = getTouchPiece(tx, ty);
  if (info) {
    startDrag(info.idx, info.cellR, info.cellC, info.fracR, info.fracC);
    render(); return;
  }
  S.kbSel = -1; render();
}

export function handlePointerMove(tx, ty) {
  if (S.drag) { updateDragPos(tx, ty); S.needsRender = true; }
  if (S.bombMode && !S.bombConfirmed) {
    const cell = getGridCell(tx, ty);
    if (cell) { S.bombR = cell.r; S.bombC = cell.c; }
    else { S.bombR = -1; S.bombC = -1; }
    S.needsRender = true;
  }
}

export function handlePointerUp(tx, ty) {
  if (S.drag) endDrag();
}

export function handlePointerLeave() {
  if (S.drag) { S.drag = null; render(); }
  if (S.bombMode) { S.bombR = -1; S.bombC = -1; S.bombConfirmed = false; render(); }
}

export function handleKeyDown(e) {
  if (S.screen === 'splash' && e.key === 'Enter') {
    e.preventDefault();
    nameOverlay.style.display = 'flex';
    nameInp.value = S.playerName || '';
    nameInputOpenTime = Date.now();
    setTimeout(() => nameInp.focus(), 150);
    return;
  }
  if (S.screen === 'gameover') {
    if (e.key === 'Enter' || e.key === ' ') returnToSplash();
    return;
  }
  if (S.dialog) {
    if (e.key === 'Escape') { S.dialog = null; render(); }
    if (e.key === 'Enter' && S.dialog.onOk) { const cb = S.dialog.onOk; S.dialog = null; cb(); render(); }
    return;
  }
  if (S.inputLocked || S.screen !== 'game') return;

  if (e.key >= '1' && e.key <= '3') {
    const idx = parseInt(e.key) - 1;
    if (idx < S.pieces.length) {
      S.kbSel = idx; S.drag = null; S.bombMode = false; S.pendingAuto = null;
      const cells = S.pieces[idx].baseCells;
      const bb = { rows: Math.max(...cells.map(([r])=>r)) + 1, cols: Math.max(...cells.map(([,c])=>c)) + 1 };
      S.kbR = Math.max(0, Math.floor((GRID - bb.rows) / 2));
      S.kbC = Math.max(0, Math.floor((GRID - bb.cols) / 2));
      render();
    }
    return;
  }

  if (S.kbSel >= 0) {
    if (e.key === 'ArrowLeft') S.kbC = Math.max(0, S.kbC - 1);
    else if (e.key === 'ArrowRight') S.kbC = Math.min(GRID - 1, S.kbC + 1);
    else if (e.key === 'ArrowUp') S.kbR = Math.max(0, S.kbR - 1);
    else if (e.key === 'ArrowDown') S.kbR = Math.min(GRID - 1, S.kbR + 1);
    else return;
    const cells = S.pieces[S.kbSel].baseCells;
    const bb = { rows: Math.max(...cells.map(([r])=>r)) + 1, cols: Math.max(...cells.map(([,c])=>c)) + 1 };
    S.kbR = Math.min(S.kbR, GRID - bb.rows);
    S.kbC = Math.min(S.kbC, GRID - bb.cols);
    render(); return;
  }

  if ((e.key === 'Enter' || e.key === ' ') && S.kbSel >= 0) {
    const cells = S.pieces[S.kbSel].baseCells;
    if (canPlace(cells, S.kbR, S.kbC)) {
      commitPlacement(S.kbSel, cells, S.pieces[S.kbSel].color, S.kbR, S.kbC);
    }
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); doUndo(); render(); return; }
  if (e.key === 'r' || e.key === 'R') { showResetDialog(); render(); return; }
  if (e.key === 'b' || e.key === 'B') {
    S.bombMode = !S.bombMode; S.bombR = -1; S.bombC = -1; S.bombConfirmed = false;
    S.drag = null; S.kbSel = -1; render(); return;
  }
  if (e.key === 'm' || e.key === 'M') { toggleMusic(); render(); return; }
  if (e.key === 'Escape') { S.bombMode = false; S.kbSel = -1; S.drag = null; S.pendingAuto = null; render(); }
}

function shareScore() {
  const text = `block-puzzle — 我获得了 ${S.score} 分！来挑战我吧！`;
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
  if (isWeChat) {
    S.notifications.push({ text: '请点击右上角 ··· 分享给朋友', t: Date.now() });
  } else if (navigator.share) {
    navigator.share({ title: 'block-puzzle', text }).catch(() => { copyShare(text); });
  } else {
    copyShare(text);
  }
}

function copyShare(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      S.notifications.push({ text: '已复制战绩到剪贴板!', t: Date.now() });
    }).catch(() => {
      S.notifications.push({ text: text, t: Date.now() });
    });
  } else {
    S.notifications.push({ text: text, t: Date.now() });
  }
}

function returnToSplash() {
  S.screen = 'splash'; S.gameOver = false;
  stopMusic();
  nameOverlay.style.display = 'none';
  S.grid = []; S.pieces = []; S.drag = null; S.kbSel = -1;
  S.clearing = null; S.inputLocked = false; S.bombMode = false;
  S.bombR = -1; S.bombC = -1; S.dialog = null;
  S.combo = 0; S.comboText = ''; S.pendingAuto = null;
  S.undoGrid = null; S.undoScore = 0; S.undoPieces = null;
  S.redoGrid = null; S.redoScore = 0; S.redoPieces = null;
  S.particles = []; S.scorePopups = []; S.notifications = [];
  render();
}
