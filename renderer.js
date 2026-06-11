// ==================== RENDERING ORCHESTRATION ====================
import { GRID, TEXT_C, GRID_LINE, COLORS } from './constants.js';
import { S } from './state.js';
import { ctx, W, H, canvas, dpr } from './canvas.js';
import { drawCell, drawPieceShape, drawButton, drawGlassPanel, drawBgGradient, boundingBox } from './draw.js';
import { BA } from './bomb-adapter.js';
import { canPlace } from './grid.js';
import { drawParticles, drawScorePopups } from './particles.js';

// Offscreen grid cache — key perf optimization: avoids redrawing 100 cells/frame during drag
let gCache = null, gCacheSize = 0, cacheDpr = 0;

function ensureCache() {
  const sz = S.cellSize * GRID + 12;
  if (gCache && gCacheSize === sz && cacheDpr === dpr) return;
  gCache = document.createElement('canvas');
  gCache.width = sz * dpr; gCache.height = sz * dpr;
  gCacheSize = sz; cacheDpr = dpr;
  polyfillRoundRect(gCache.getContext('2d'));
  S.gridDirty = true;
}

function polyfillRoundRect(gc) {
  if (gc.roundRect) return;
  gc.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    gc.beginPath();
    gc.moveTo(x + r.tl, y); gc.lineTo(x + w - r.tr, y);
    gc.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    gc.lineTo(x + w, y + h - r.br);
    gc.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    gc.lineTo(x + r.bl, y + h);
    gc.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    gc.lineTo(x, y + r.tl);
    gc.quadraticCurveTo(x, y, x + r.tl, y);
    gc.closePath();
  };
}

function rebuildCache() {
  ensureCache();
  const gc = gCache.getContext('2d');
  gc.setTransform(1, 0, 0, 1, 0, 0);
  gc.clearRect(0, 0, gCache.width, gCache.height);
  gc.scale(dpr, dpr);
  const gp = S.cellSize * GRID;
  const ox = 6, oy = 6;
  // Draw board bg
  gc.fillStyle = 'rgba(25,20,50,0.2)';
  gc.beginPath(); gc.roundRect(ox - 4, oy - 4, gp + 8, gp + 8, 10); gc.fill();
  gc.strokeStyle = 'rgba(180,160,255,0.12)'; gc.lineWidth = 1;
  gc.beginPath(); gc.roundRect(ox - 4, oy - 4, gp + 8, gp + 8, 10); gc.stroke();
  // Grid lines
  gc.strokeStyle = GRID_LINE; gc.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    const x = ox + i * S.cellSize, y = oy + i * S.cellSize;
    gc.beginPath(); gc.moveTo(x, oy); gc.lineTo(x, oy + gp); gc.stroke();
    gc.beginPath(); gc.moveTo(ox, y); gc.lineTo(ox + gp, y); gc.stroke();
  }
  // Draw cells onto cache
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (S.grid[r][c] !== 0) {
        drawCellGrid(gc, ox + c * S.cellSize, oy + r * S.cellSize, S.cellSize, S.grid[r][c]);
      }
    }
  }
  S.gridDirty = false;
}

// Lightweight grid cell draw (no dynamic sparkle — cache is static)
function lighten(h, a) { const n = parseInt(h.slice(1), 16); return `rgb(${Math.min(255,(n>>16)+a)},${Math.min(255,((n>>8)&0xff)+a)},${Math.min(255,(n&0xff)+a)})`; }
function darken(h, a) { const n = parseInt(h.slice(1), 16); return `rgb(${Math.max(0,(n>>16)-a)},${Math.max(0,((n>>8)&0xff)-a)},${Math.max(0,(n&0xff)-a)})`; }
function drawCellGrid(gc, x, y, s, clr) {
  if (clr === 0) return;
  const hex = COLORS[clr - 1], sz = s - 2, ox = x + 1, oy = y + 1, r = Math.max(1.5, sz * 0.1);
  gc.fillStyle = 'rgba(0,0,0,0.4)'; gc.beginPath(); gc.roundRect(ox + 1.5, oy + 2.5, sz, sz, r); gc.fill();
  gc.fillStyle = darken(hex, 85); gc.beginPath(); gc.roundRect(ox, oy, sz, sz, r + 1); gc.fill();
  gc.fillStyle = lighten(hex, 80); gc.beginPath(); gc.roundRect(ox - 0.5, oy - 0.5, sz, sz, r + 1); gc.fill();
  gc.fillStyle = hex; gc.beginPath(); gc.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); gc.fill();
  gc.save(); gc.beginPath(); gc.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); gc.clip();
  gc.beginPath(); gc.moveTo(ox, oy); gc.lineTo(ox + sz * 0.7, oy); gc.lineTo(ox, oy + sz * 0.7); gc.closePath();
  const g1 = gc.createLinearGradient(ox, oy, ox + sz * 0.5, oy + sz * 0.5);
  g1.addColorStop(0, lighten(hex, 60)); g1.addColorStop(0.6, lighten(hex, 20)); g1.addColorStop(1, hex);
  gc.fillStyle = g1; gc.fill(); gc.restore();
  gc.save(); gc.beginPath(); gc.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); gc.clip();
  gc.beginPath(); gc.moveTo(ox + sz, oy + sz * 0.4); gc.lineTo(ox + sz, oy + sz); gc.lineTo(ox + sz * 0.4, oy + sz); gc.closePath();
  const g2 = gc.createLinearGradient(ox + sz * 0.3, oy + sz * 0.3, ox + sz, oy + sz);
  g2.addColorStop(0, hex); g2.addColorStop(0.5, darken(hex, 20)); g2.addColorStop(1, darken(hex, 55));
  gc.fillStyle = g2; gc.fill(); gc.restore();
  gc.save(); gc.beginPath(); gc.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); gc.clip();
  gc.strokeStyle = lighten(hex, 100); gc.lineWidth = Math.max(1, sz * 0.08);
  gc.beginPath(); gc.roundRect(ox + 1.5, oy + 1.5, sz - 3, sz - 3, r - 0.5); gc.stroke(); gc.restore();
  const cx = ox + sz * 0.28, cy = oy + sz * 0.28, spk = Math.max(2, sz * 0.4);
  const sg = gc.createRadialGradient(cx, cy, 0, cx, cy, spk);
  sg.addColorStop(0, 'rgba(255,255,255,0.7)'); sg.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  sg.addColorStop(0.5, 'rgba(255,255,255,0.06)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  gc.fillStyle = sg; gc.beginPath(); gc.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); gc.fill();
}

export function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.scale(dpr, dpr);
  if (S.screen === 'splash') { drawBgGradient(W, H); drawSplash(); }
  else drawGame();
}

function drawSplash() {
  const t = Date.now() / 1000;
  for (let i = 0; i < S.decoPieces.length; i++) {
    const dp = S.decoPieces[i]; dp.y += dp.speed;
    if (dp.y > H + 100) { dp.y = -100; dp.x = Math.random() * W; }
    drawPieceShape(dp.cells, dp.x, dp.y, dp.scale, dp.color, 0.06 + 0.03 * Math.sin(t * dp.wobble + i));
  }
  const cardW = Math.min(360, W * 0.88), cardH = 320;
  const cx = (W - cardW) / 2, cy = Math.max(10, (H - cardH) / 2 - 30);
  drawGlassPanel(cx, cy, cardW, cardH, 20, 0.15);
  ctx.fillStyle = '#c084fc'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.min(30, W*0.07)}px sans-serif`;
  ctx.fillText('block-puzzle', W/2, cy+60);
  const grad = ctx.createLinearGradient(cx+30, 0, cx+cardW-30, 0);
  grad.addColorStop(0, 'rgba(167,139,250,0)'); grad.addColorStop(0.5, 'rgba(167,139,250,0.4)');
  grad.addColorStop(1, 'rgba(167,139,250,0)');
  ctx.strokeStyle = grad; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx+30, cy+74); ctx.lineTo(cx+cardW-30, cy+74); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = `${Math.min(12, W*0.028)}px sans-serif`;
  ctx.fillText('作者：李琥珀', W/2, cy+94);
  if (S.leaderboard.length > 0) {
    const lby = cy+158;
    ctx.fillStyle = 'rgba(200,190,240,0.5)'; ctx.font = `bold ${Math.min(12,W*0.028)}px sans-serif`;
    ctx.fillText('🏆 排行榜', W/2, lby);
    const maxShow = Math.min(5, S.leaderboard.length);
    ctx.font = `${Math.min(11,W*0.025)}px sans-serif`;
    for (let i = 0; i < maxShow; i++) {
      const e = S.leaderboard[i], ry = lby+16+i*17;
      ctx.fillStyle = i===0?'#ffd93d':i===1?'#c0c0c0':i===2?'#cd7f32':'rgba(255,255,255,0.4)';
      ctx.textAlign = 'left'; ctx.fillText(`${i+1}. ${e.name}`, cx+45, ry);
      ctx.textAlign = 'right'; ctx.fillText(`${e.score}分`, cx+cardW-45, ry);
    }
    ctx.textAlign = 'center';
  }
  const saved = (() => { try { return localStorage.getItem('bp_player_name') || ''; } catch(e) { return ''; } })();
  const bwx=150,bhx=44,bxx=(W-bwx)/2,byx=cy+cardH-60;
  ctx.fillStyle = 'rgba(139,92,246,0.25)'; ctx.beginPath(); ctx.roundRect(bxx,byx,bwx,bhx,bhx/2); ctx.fill();
  ctx.strokeStyle = 'rgba(139,92,246,0.5)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.roundRect(bxx,byx,bwx,bhx,bhx/2); ctx.stroke();
  ctx.fillStyle = '#a78bfa'; ctx.font = `bold ${Math.min(16,W*0.038)}px sans-serif`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  const btnLabel = saved ? `以 ${saved} 开始` : '开始游戏';
  ctx.fillText(btnLabel, bxx+bwx/2, byx+bhx/2);
  ctx.textBaseline='alphabetic'; ctx.textAlign='start';
  // Switch name link (only if saved name exists)
  if (saved) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = `${Math.min(12,W*0.028)}px sans-serif`;
    ctx.textAlign='center'; ctx.fillText('切换名字', W/2, byx+bhx+18);
    ctx.textAlign='start';
    S._switchY = byx+bhx+6; S._switchH = 20;
  } else {
    S._switchY = -1; S._switchH = 0;
  }
}

function drawGameDecos() {
  const t = Date.now() / 1000;
  for (let i = 0; i < S.gameDecos.length; i++) {
    const gd = S.gameDecos[i];
    gd.y += gd.speed;
    if (gd.y > H + 80) { gd.y = -80; gd.x = Math.random() * W; }
    drawPieceShape(gd.cells, gd.x, gd.y, gd.scale, gd.color, 0.025 + 0.015 * Math.sin(t * gd.wobble + i));
  }
}

function drawGame() {
  drawBgGradient(W, H);

  // Rebuild static grid cache when dirty
  if (S.gridDirty) rebuildCache();

  // Game BG decorations — subtle floating pieces
  drawGameDecos();

  // Top bar — clean layout
  drawGlassPanel(0, 0, W, 50, 0, 0.1);
  const fs = Math.max(12, S.cellSize * 0.46);

  // Left: bomb + reroll info
  ctx.textAlign = 'left';
  const bombText = S.bombCheat ? '💣 ∞' : `💣 ${S.bombsLeft}`;
  ctx.fillStyle = S.bombCheat ? '#ff6b6b' : '#90c8ff';
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.fillText(bombText, 10, 18);
  // +N flash for bomb
  if (Date.now() - S.bombFlash < 1200) {
    const alpha = Math.max(0, 1 - (Date.now() - S.bombFlash) / 1200);
    ctx.globalAlpha = alpha; ctx.fillStyle = '#ffd93d';
    ctx.font = `bold ${Math.floor(fs*1.3)}px sans-serif`;
    ctx.fillText('+' + S.bombFlashN, 10 + ctx.measureText(bombText).width + 6, 18);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `bold ${fs}px sans-serif`;
  ctx.fillText(`🔄 ${S.rerollsLeft}`, 10, 38);
  // +N flash for reroll
  if (Date.now() - S.rerollFlash < 1200) {
    const alpha = Math.max(0, 1 - (Date.now() - S.rerollFlash) / 1200);
    ctx.globalAlpha = alpha; ctx.fillStyle = '#ffd93d';
    ctx.font = `bold ${Math.floor(fs*1.3)}px sans-serif`;
    const rtext = `🔄 ${S.rerollsLeft}`;
    ctx.fillText('+' + S.rerollFlashN, 10 + ctx.measureText(rtext).width + 6, 38);
    ctx.globalAlpha = 1;
  }

  // FREE toggle button — aligned with bomb text row
  const freeX = 70, freeY = 3, freeW = 40, freeH = 20;
  ctx.fillStyle = S.bombCheat ? 'rgba(255,80,80,0.35)' : 'rgba(255,255,255,0.08)';
  ctx.beginPath(); ctx.roundRect(freeX, freeY, freeW, freeH, freeH/2); ctx.fill();
  ctx.strokeStyle = S.bombCheat ? 'rgba(255,80,80,0.6)' : 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(freeX, freeY, freeW, freeH, freeH/2); ctx.stroke();
  ctx.fillStyle = S.bombCheat ? '#fff' : 'rgba(255,255,255,0.5)';
  ctx.font = `${Math.max(8, fs*0.32)}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('FREE', freeX + freeW/2, freeY + freeH/2);
  ctx.textBaseline = 'alphabetic';

  // Center: name + score
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.font = `${Math.max(10, fs*0.8)}px sans-serif`;
  ctx.fillText(`${S.playerName}`, W/2, 16);
  ctx.fillStyle = '#ffd93d'; ctx.font = `bold ${Math.max(14, fs*0.9)}px sans-serif`;
  ctx.fillText(`${S.score}`, W/2, 38);

  // Right: music toggle only
  ctx.textAlign = 'right';
  const muteX = W-42, muteY=10, muteS=30;
  ctx.fillStyle = S.musicMuted ? 'rgba(255,255,255,0.06)' : 'rgba(139,92,246,0.2)';
  ctx.beginPath(); ctx.roundRect(muteX, muteY, muteS, muteS, muteS/2); ctx.fill();
  ctx.fillStyle = S.musicMuted ? 'rgba(255,255,255,0.35)' : '#a78bfa';
  ctx.font = '13px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(S.musicMuted ? '🔇' : '🎵', muteX+muteS/2, muteY+muteS/2);
  ctx.textBaseline='alphabetic'; ctx.textAlign='start';

  if (S.comboText) {
    ctx.fillStyle = '#ffd93d'; ctx.font = `bold ${Math.max(12, fs*0.9)}px sans-serif`;
    ctx.textAlign='center'; ctx.fillText(S.comboText, W/2, 52); ctx.textAlign='start';
  }

  // Draw cached grid (full offscreen canvas → logical rect on main canvas)
  if (gCache) {
    const cacheDrawX = S.gridX - 6, cacheDrawY = S.gridY - 6;
    ctx.drawImage(gCache, cacheDrawX, cacheDrawY, gCacheSize, gCacheSize);
  }

  // Clearing flash overlay (drawn on top of cache)
  if (S.clearing) {
    for (const key of S.clearing) {
      const [r, c] = key.split(',').map(Number);
      const p = (Date.now() % 300) / 300;
      const b = p < 0.5 ? p * 2 : 2 - p * 2;
      ctx.fillStyle = `rgba(255,255,255,${0.5 + b * 0.5})`;
      ctx.beginPath(); ctx.roundRect(S.gridX+c*S.cellSize+1, S.gridY+r*S.cellSize+1, S.cellSize-2, S.cellSize-2, 3); ctx.fill();
    }
  }

  drawNotifications();
  drawPlacementAnim(); // keep drawNotifications for share messages
  drawParticles();
  drawScorePopups();
  drawBombPreview();
  drawGhost();
  drawToolbar();
  drawCandidates();
  drawFloatPiece();
  if (S.showTutorial && !S.tutorialDismissed) drawTutorial();
if (S.dialog) drawDialog();
  if (S.screen === 'gameover') drawGameOver();
}

function drawPlacementAnim() {
  const now = Date.now();
  for (let i = S.placedAnim.length - 1; i >= 0; i--) {
    const a = S.placedAnim[i];
    const elapsed = (now - a.t) / 1000;
    if (elapsed > 0.35) { S.placedAnim.splice(i, 1); continue; }
    // Scale bounce: 1.3 → 0.95 → 1.0
    const p = elapsed / 0.35;
    const scale = 1 + 0.3 * Math.exp(-p * 5) * Math.cos(p * 8);
    const cs = S.cellSize;
    const x = S.gridX + a.c * cs, y = S.gridY + a.r * cs;
    ctx.save();
    ctx.translate(x + cs / 2, y + cs / 2);
    ctx.scale(scale, scale);
    ctx.globalAlpha = 1 - p;
    drawCell(-cs / 2, -cs / 2, cs, a.color, 1);
    ctx.restore();
  }
}

function drawNotifications() {
  const now = Date.now();
  for (let i = S.notifications.length - 1; i >= 0; i--) {
    const n = S.notifications[i];
    const elapsed = (now - n.t) / 1000;
    if (elapsed > 2) { S.notifications.splice(i, 1); continue; }
    const alpha = elapsed < 0.3 ? elapsed / 0.3 : (elapsed > 1.5 ? (2 - elapsed) / 0.5 : 1);
    const y = S.gridY - 20 - (S.notifications.length - 1 - i) * 26;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(n.text, W/2, y);
    ctx.textAlign = 'start';
  }
  ctx.globalAlpha = 1;
}

function drawBombPreview() {
  if (!S.bombMode || S.bombR < 0 || S.bombC < 0) return;
  const alpha = S.bombConfirmed ? 0.55 : 0.25;
  for (let r = S.bombR-2; r <= S.bombR+2; r++) {
    for (let c = S.bombC-2; c <= S.bombC+2; c++) {
      if (r<0||r>=GRID||c<0||c>=GRID) continue;
      const x = S.gridX+c*S.cellSize, y = S.gridY+r*S.cellSize;
      ctx.fillStyle = `rgba(255,70,70,${alpha})`;
      ctx.beginPath(); ctx.roundRect(x+1, y+1, S.cellSize-2, S.cellSize-2, 3); ctx.fill();
    }
  }
  if (S.bombConfirmed) {
    ctx.fillStyle = '#ff6b6b'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('再次点击引爆', S.gridX + S.cellSize * GRID / 2, S.gridY + S.cellSize * GRID + 16);
    ctx.textAlign = 'start';
  }
}

function drawGhost() {
  let cells, color, gr, gc, valid;
  if (S.drag) {
    if (S.drag.gridR == null) return; // don't show until finger moves
    cells=S.drag.cells;color=S.drag.color;gr=S.drag.gridR;gc=S.drag.gridC;valid=S.drag.valid;
  }
  else if (S.kbSel>=0&&S.kbSel<S.pieces.length) { cells=S.pieces[S.kbSel].baseCells;color=S.pieces[S.kbSel].color;gr=S.kbR;gc=S.kbC;valid=canPlace(cells,gr,gc); }
  else return;
  // Draw outer glow ring for valid placements
  if (valid) {
    const bb = boundingBox(cells);
    const gx = S.gridX + gc * S.cellSize, gy = S.gridY + gr * S.cellSize;
    ctx.strokeStyle = 'rgba(100,255,180,0.55)';
    ctx.lineWidth = 2.5; ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.roundRect(gx - 2, gy - 2, bb.cols * S.cellSize + 4, bb.rows * S.cellSize + 4, 6);
    ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  for (const [r,c] of cells) {
    const nr=gr+r,nc=gc+c;
    if (nr<0||nr>=GRID||nc<0||nc>=GRID) continue;
    if (S.grid[nr][nc]!==0) continue;
    const x=S.gridX+nc*S.cellSize,y=S.gridY+nr*S.cellSize;
    // More visible cell preview
    ctx.fillStyle = valid ? 'rgba(100,255,180,0.35)' : 'rgba(255,80,80,0.35)';
    ctx.beginPath();ctx.roundRect(x+1,y+1,S.cellSize-2,S.cellSize-2,3);ctx.fill();
    ctx.strokeStyle = valid ? 'rgba(100,255,180,0.7)' : 'rgba(255,80,80,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();ctx.roundRect(x+1,y+1,S.cellSize-2,S.cellSize-2,3);ctx.stroke();
    drawCell(x,y,S.cellSize,color,valid?0.65:0.3);
  }
}

function drawToolbar() {
  const by = S.toolY, bh = Math.max(46, Math.floor(S.cellSize*1.2)), bw = Math.floor(bh*1.35), gap=8;
  const totalW=bw*5+gap*4, startX=Math.floor((W-totalW)/2);
  drawButton(startX, by, bw, bh, '撤销', false, false, !S.undoGrid);
  drawButton(startX+bw+gap, by, bw, bh, '换一批', false, false);
  drawButton(startX+(bw+gap)*2, by, bw, bh, '炸弹', true, S.bombMode);
  drawButton(startX+(bw+gap)*3, by, bw, bh, '分享', false, false);
  drawButton(startX+(bw+gap)*4, by, bw, bh, '结束', false, false);
}

function drawCandidates() {
  if (S.pieces.length===0) return;
  const cs=S.candCS, totalW=S.pieces.length*5*cs+(S.pieces.length-1)*12, startX=(W-totalW)/2, cy=S.candY;
  if (!S.hasDragged) {
    ctx.fillStyle='rgba(255,255,255,0.25)';ctx.font=`${Math.max(10,cs*0.38)}px sans-serif`;
    ctx.textAlign='center';ctx.fillText('拖拽方块到棋盘',W/2,cy-8);
  }
  for (let i=0;i<S.pieces.length;i++) {
    const cells=S.pieces[i].baseCells,bb=boundingBox(cells);
    const px=startX+i*(5*cs+12)+(5*cs-bb.cols*cs)/2,py=cy+(5*cs-bb.rows*cs)/2;
    ctx.fillStyle='rgba(255,255,255,0.03)';
    ctx.beginPath();ctx.roundRect(startX+i*(5*cs+12)-2,cy-2,5*cs+4,5*cs+4,4);ctx.fill();
    const isDragged=S.drag&&S.drag.idx===i;
    drawPieceShape(cells,px,py,cs,S.pieces[i].color,isDragged?0.22:1);
  }
}

function drawTutorial() {
  // Auto-dismiss when player starts dragging
  if (S.hasDragged) {
    S.showTutorial = false; S.tutorialDismissed = true;
    try { localStorage.setItem('bp_tutorial_done', '1'); } catch(e) {}
    return;
  }
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
  const cx = W/2, cy = S.gridY + S.cellSize * GRID / 2;
  // Step circles
  const steps = [
    { y: S.candY + 2.5*S.candCS, text: '触摸这里拿起方块', arrow: 'up' },
    { y: cy, text: '拖到棋盘上', arrow: 'down' },
    { y: S.gridY - 10, text: '放满整行或整列消除', arrow: 'none' },
  ];
  const t = Date.now() / 1000;
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const pulse = 1 + Math.sin(t * 1.5 + i) * 0.08;
    // Circle number
    ctx.fillStyle = 'rgba(167,139,250,0.7)';
    ctx.beginPath(); ctx.arc(cx - 50, s.y, 14 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(i + 1, cx - 50, s.y);
    // Text
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '14px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(s.text, cx - 26, s.y);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'start';
  }
  // Item info line
  const hintAlpha = 0.3 + Math.sin(t * 0.8) * 0.1;
  ctx.fillStyle = `rgba(255,255,255,${hintAlpha})`;
  ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('💣 每500分+1 | 🔄 每100分+1 | 💣 点击两次引爆', cx, S.toolY + 48);
  ctx.fillText('开始拖拽后引导自动消失', cx, S.toolY + 64);
  ctx.textAlign = 'start';
}

function drawFloatPiece() {
  if (!S.drag||S.drag.fx==null) return;
  const cells=S.drag.cells,bb=boundingBox(cells),cs=S.cellSize;
  const fx=S.gridX+S.drag.fx*cs,fy=S.gridY+S.drag.fy*cs;
  ctx.fillStyle='rgba(0,0,0,0.3)';
  ctx.beginPath();ctx.roundRect(fx+2,fy+3,bb.cols*cs,bb.rows*cs,4);ctx.fill();
  const scale=1.08,scs=cs*scale,sox=(scs-cs)/2,soy=(scs-cs)/2;
  drawPieceShape(cells,fx-sox,fy-soy-2,scs,S.drag.color,1,false);
}

function drawDialog() {
  ctx.fillStyle='rgba(0,0,0,0.65)';ctx.fillRect(0,0,W,H);
  const dw=Math.min(280,W*0.75),dh=140,dx=(W-dw)/2,dy=(H-dh)/2;
  ctx.fillStyle='#1e1e36';ctx.beginPath();ctx.roundRect(dx,dy,dw,dh,14);ctx.fill();
  ctx.strokeStyle='rgba(255,255,255,0.15)';ctx.lineWidth=1;ctx.beginPath();ctx.roundRect(dx,dy,dw,dh,14);ctx.stroke();
  ctx.fillStyle='#fff';ctx.font='bold 17px sans-serif';ctx.textAlign='center';ctx.fillText(S.dialog.msg,W/2,dy+50);
  const bw=80,bh=36,bx1=dx+dw/2-bw-12,bx2=dx+dw/2+12,by=dy+dh-bh-18;
  ctx.fillStyle='rgba(255,255,255,0.08)';ctx.beginPath();ctx.roundRect(bx1,by,bw,bh,bh/2);ctx.fill();
  ctx.fillStyle='rgba(255,255,255,0.6)';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.fillText(S.dialog.cancelText||'取消',bx1+bw/2,by+bh/2);
  ctx.fillStyle='rgba(255,107,107,0.2)';ctx.beginPath();ctx.roundRect(bx2,by,bw,bh,bh/2);ctx.fill();
  ctx.fillStyle='#ff6b6b';ctx.fillText(S.dialog.okText||'确定',bx2+bw/2,by+bh/2);
  ctx.textBaseline='alphabetic';
  S.dialog._bx1=bx1;S.dialog._bx2=bx2;S.dialog._by=by;S.dialog._bw=bw;S.dialog._bh=bh;
}

function drawGameOver() {
  ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,0,W,H);
  const pw=Math.min(340,W*0.85),ph=260,px=(W-pw)/2,py=(H-ph)/2;
  drawGlassPanel(px,py,pw,ph,16,0.2);
  ctx.fillStyle='#fff';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText('游戏结束',W/2,py+42);
  ctx.font='15px sans-serif';ctx.fillStyle=TEXT_C;ctx.fillText(`得分: ${S.score}`,W/2,py+72);
  if(S.score>0&&S.score>=S.highScore){ctx.fillStyle='#ffd93d';ctx.font='bold 14px sans-serif';ctx.fillText('🏆 新纪录!',W/2,py+94);}
  else{ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='12px sans-serif';ctx.fillText(`最高分: ${S.highScore}`,W/2,py+94);}
  if(S.leaderboard.length>0){
    const lby=py+112;
    ctx.fillStyle='rgba(200,190,240,0.5)';ctx.font='bold 12px sans-serif';ctx.fillText('🏆 排行榜',W/2,lby);
    const maxShow=Math.min(5,S.leaderboard.length);ctx.font='11px sans-serif';
    for(let i=0;i<maxShow;i++){
      const e=S.leaderboard[i],ry=lby+16+i*16;
      ctx.fillStyle=i===0?'#ffd93d':i===1?'#c0c0c0':i===2?'#cd7f32':'rgba(255,255,255,0.4)';
      ctx.textAlign='left';ctx.fillText(`${i+1}. ${e.name}`,px+50,ry);ctx.textAlign='right';ctx.fillText(`${e.score}分`,px+pw-50,ry);
    }
    ctx.textAlign='center';
  }
  ctx.fillStyle='rgba(255,255,255,0.4)';ctx.font='13px sans-serif';ctx.fillText('点击返回主菜单',W/2,py+ph-20);
}
