// ==================== PARTICLES & SCORE POPUPS ====================
import { COLORS } from './constants.js';
import { ctx, W } from './canvas.js';
import { S } from './state.js';

export function spawnFlashParticle(r, c) {
  const cx = S.gridX + c * S.cellSize + S.cellSize / 2;
  const cy = S.gridY + r * S.cellSize + S.cellSize / 2;
  S.particles.push({
    x: cx, y: cy,
    vx: (Math.random() - 0.5) * 1.5,
    vy: (Math.random() - 0.5) * 1.5 - 1,
    life: 1, decay: 0.04 + Math.random() * 0.04,
    color: '#ffffff', size: 2 + Math.random() * 3
  });
}

export function spawnParticles(r, c, colorIdx) {
  const hex = COLORS[colorIdx - 1] || '#fff';
  const cx = S.gridX + c * S.cellSize + S.cellSize / 2;
  const cy = S.gridY + r * S.cellSize + S.cellSize / 2;
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.3;
    const speed = 1.5 + Math.random() * 3;
    S.particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1, decay: 0.015 + Math.random() * 0.025,
      color: hex, size: 2 + Math.random() * 4
    });
  }
}

export function updateParticles() {
  for (let i = S.particles.length - 1; i >= 0; i--) {
    const p = S.particles[i];
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05;
    p.life -= p.decay;
    if (p.life <= 0) S.particles.splice(i, 1);
  }
}

export function drawParticles() {
  for (const p of S.particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function addBigCombo(combo, pts) {
  S.scorePopups.push({
    x: W / 2, y: S.gridY + S.cellSize * 5,
    text: `🔥 ${combo}x Combo! +${pts}`,
    life: 1.5, decay: 0.012, big: true
  });
}

export function addScorePopup(r, c, text) {
  S.scorePopups.push({
    x: S.gridX + c * S.cellSize + S.cellSize / 2,
    y: S.gridY + r * S.cellSize,
    text, life: 1, decay: 0.02
  });
}

export function updateScorePopups() {
  for (let i = S.scorePopups.length - 1; i >= 0; i--) {
    const p = S.scorePopups[i];
    p.y -= 1.2; p.life -= p.decay;
    if (p.life <= 0) S.scorePopups.splice(i, 1);
  }
}

export function drawScorePopups() {
  for (const p of S.scorePopups) {
    ctx.globalAlpha = Math.min(1, p.life);
    if (p.big) {
      const scale = 1 + (1.5 - Math.min(1.5, p.life)) * 0.4;
      ctx.fillStyle = '#ffd93d';
      ctx.font = `bold ${Math.floor(22 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(255,150,0,0.6)'; ctx.shadowBlur = 20;
      ctx.fillText(p.text, p.x, p.y);
      ctx.shadowBlur = 0;
    } else {
      ctx.fillStyle = '#ffd93d'; ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center'; ctx.fillText(p.text, p.x, p.y);
    }
  }
  ctx.globalAlpha = 1;
}
