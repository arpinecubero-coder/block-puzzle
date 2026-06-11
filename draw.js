// ==================== DRAWING PRIMITIVES ====================
import { COLORS } from './constants.js';
import { ctx } from './canvas.js';

export function lighten(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.min(255,(n>>16)+a)},${Math.min(255,((n>>8)&0xff)+a)},${Math.min(255,(n&0xff)+a)})`;
}

export function darken(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${Math.max(0,(n>>16)-a)},${Math.max(0,((n>>8)&0xff)-a)},${Math.max(0,(n&0xff)-a)})`;
}

export function boundingBox(cells) {
  let mr = 0, mc = 0;
  for (const [r, c] of cells) { mr = Math.max(mr, r); mc = Math.max(mc, c); }
  return { rows: mr + 1, cols: mc + 1 };
}

export function drawCell(x, y, s, colorIdx, alpha = 1) {
  const t = Date.now() / 1000;
  if (colorIdx === 0) return;
  const hex = COLORS[colorIdx - 1];
  const sz = s - 2, ox = x + 1, oy = y + 1;
  const r = Math.max(1.5, sz * 0.1);
  ctx.globalAlpha = alpha;

  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath(); ctx.roundRect(ox + 1.5, oy + 2.5, sz, sz, r); ctx.fill();

  ctx.fillStyle = darken(hex, 85);
  ctx.beginPath(); ctx.roundRect(ox, oy, sz, sz, r + 1); ctx.fill();

  ctx.fillStyle = lighten(hex, 80);
  ctx.beginPath(); ctx.roundRect(ox - 0.5, oy - 0.5, sz, sz, r + 1); ctx.fill();

  ctx.fillStyle = hex;
  ctx.beginPath(); ctx.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); ctx.fill();

  ctx.save();
  ctx.beginPath(); ctx.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(ox, oy); ctx.lineTo(ox + sz * 0.7, oy); ctx.lineTo(ox, oy + sz * 0.7); ctx.closePath();
  const g1 = ctx.createLinearGradient(ox, oy, ox + sz * 0.5, oy + sz * 0.5);
  g1.addColorStop(0, lighten(hex, 60)); g1.addColorStop(0.6, lighten(hex, 20)); g1.addColorStop(1, hex);
  ctx.fillStyle = g1; ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); ctx.clip();
  ctx.beginPath();
  ctx.moveTo(ox + sz, oy + sz * 0.4); ctx.lineTo(ox + sz, oy + sz);
  ctx.lineTo(ox + sz * 0.4, oy + sz); ctx.closePath();
  const g2 = ctx.createLinearGradient(ox + sz * 0.3, oy + sz * 0.3, ox + sz, oy + sz);
  g2.addColorStop(0, hex); g2.addColorStop(0.5, darken(hex, 20)); g2.addColorStop(1, darken(hex, 55));
  ctx.fillStyle = g2; ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); ctx.clip();
  ctx.strokeStyle = lighten(hex, 100);
  ctx.lineWidth = Math.max(1, sz * 0.08);
  ctx.beginPath(); ctx.roundRect(ox + 1.5, oy + 1.5, sz - 3, sz - 3, r - 0.5); ctx.stroke();
  ctx.restore();

  const cx = ox + sz * 0.28 + Math.sin(t * 2 + colorIdx) * sz * 0.04;
  const cy = oy + sz * 0.28 + Math.cos(t * 2.5 + colorIdx) * sz * 0.04;
  const sparkSize = Math.max(2, sz * 0.4);
  const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, sparkSize);
  sg.addColorStop(0, 'rgba(255,255,255,0.7)'); sg.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  sg.addColorStop(0.5, 'rgba(255,255,255,0.06)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); ctx.fill();

  const cx2 = ox + sz * 0.45 + Math.cos(t * 1.7 + colorIdx) * sz * 0.03;
  const cy2 = oy + sz * 0.35 + Math.sin(t * 2.3 + colorIdx) * sz * 0.03;
  const sg2 = ctx.createRadialGradient(cx2, cy2, 0, cx2, cy2, sparkSize * 0.5);
  sg2.addColorStop(0, 'rgba(255,255,255,0.35)'); sg2.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  sg2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sg2;
  ctx.beginPath(); ctx.roundRect(ox + 1, oy + 1, sz - 2, sz - 2, r); ctx.fill();

  ctx.globalAlpha = 1;
}

export function drawPieceShape(cells, ox, oy, cs, colorIdx, alpha = 1, hl = false) {
  if (hl) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2; ctx.setLineDash([3, 3]);
    const bb = boundingBox(cells);
    ctx.beginPath(); ctx.roundRect(ox - 3, oy - 3, bb.cols * cs + 6, bb.rows * cs + 6, 5); ctx.stroke();
    ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  for (const [r, c] of cells) drawCell(ox + c * cs, oy + r * cs, cs, colorIdx, alpha);
}

export function drawButton(x, y, w, h, text, accent = false, active = false, disabled = false) {
  const alpha = disabled ? 0.3 : 1;
  ctx.globalAlpha = alpha;
  // Background
  const bgAlpha = active ? 0.45 : 0.08;
  ctx.fillStyle = accent
    ? `rgba(255,107,107,${bgAlpha + 0.12})`
    : `rgba(255,255,255,${bgAlpha})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
  // Border
  const borderAlpha = active ? 0.55 : 0.12;
  ctx.strokeStyle = accent
    ? `rgba(255,107,107,${borderAlpha + 0.15})`
    : `rgba(180,160,255,${borderAlpha})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.stroke();
  // Text
  const fontSize = Math.max(12, Math.floor(h * 0.33));
  ctx.font = `${fontSize}px -apple-system,"PingFang SC","Microsoft YaHei",sans-serif`;
  ctx.fillStyle = active ? '#fff' : (accent ? '#ffb3b3' : 'rgba(255,255,255,0.8)');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'start';
  ctx.globalAlpha = 1;
}

export function drawGlassPanel(x, y, w, h, r, alpha = 0.12) {
  ctx.fillStyle = `rgba(25,20,50,${alpha + 0.08})`;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  // Diagonal sheen
  const sg = ctx.createLinearGradient(x, y, x + w, y + h);
  sg.addColorStop(0, 'rgba(255,255,255,0.03)');
  sg.addColorStop(0.4, 'rgba(255,255,255,0)');
  sg.addColorStop(0.6, 'rgba(255,255,255,0)');
  sg.addColorStop(1, 'rgba(255,255,255,0.02)');
  ctx.fillStyle = sg;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = `rgba(180,160,255,${alpha})`;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.stroke();
}

export function drawBgGradient(W, H) {
  const grad = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H, Math.max(W, H));
  grad.addColorStop(0, '#1a1540'); grad.addColorStop(0.5, '#0f0d28'); grad.addColorStop(1, '#060510');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
}
