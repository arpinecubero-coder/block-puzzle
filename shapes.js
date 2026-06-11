// ==================== SHAPE GENERATION ====================
import { SHAPES, COLORS } from './constants.js';
import { S } from './state.js';
import { canPlaceAny } from './grid.js';

export function randomPiece() {
  const diff = Math.min(1, S.score / 400);
  const weights = SHAPES.map(s => {
    const sz = s.length;
    let base;
    if (sz <= 2) base = 3;
    else if (sz <= 4) base = 2 + diff;
    else if (sz <= 6) base = 1 + diff * 2;
    else base = 0.5 + diff * 3;
    return Math.max(0.3, base);
  });
  let total = 0;
  for (const w of weights) total += w;
  const r = Math.random() * total;
  let idx = 0, sum = 0;
  while (idx < weights.length) { sum += weights[idx]; if (sum >= r) break; idx++; }
  idx = Math.min(idx, SHAPES.length - 1);
  const baseCells = SHAPES[idx];
  return { id: idx + 1, baseCells: baseCells.map(([r,c])=>[r,c]), color: Math.floor(Math.random()*COLORS.length)+1 };
}

function createPieceFromId(id) {
  const baseCells = SHAPES[id-1].map(([r,c])=>[r,c]);
  return { id, baseCells, color: Math.floor(Math.random()*COLORS.length)+1 };
}

// Generate 3 pieces: all distinct IDs, none matching prevIds, at least 1 placeable
export function generatePieces() {
  const prevSet = new Set(S.prevPieceIds);
  const arr = [];
  const usedIds = new Set();
  for (let i = 0; i < 3; i++) {
    let piece = null;
    for (let tries = 0; tries < 60; tries++) {
      const p = randomPiece();
      if (!usedIds.has(p.id) && !prevSet.has(p.id)) { piece = p; break; }
    }
    // Fallback: pick from remaining valid ids
    if (!piece) {
      const remaining = SHAPES.map((_,idx)=>idx+1).filter(id => !usedIds.has(id) && !prevSet.has(id));
      if (remaining.length === 0) {
        // All shapes excluded, just pick any non-duplicate
        const anyRemaining = SHAPES.map((_,idx)=>idx+1).filter(id => !usedIds.has(id));
        const id = anyRemaining[Math.floor(Math.random()*anyRemaining.length)];
        piece = createPieceFromId(id);
      } else {
        const id = remaining[Math.floor(Math.random()*remaining.length)];
        piece = createPieceFromId(id);
      }
    }
    usedIds.add(piece.id);
    arr.push(piece);
  }
  // Remember for next batch
  S.prevPieceIds = arr.map(p => p.id);
  return arr;
}

// Ensure at least one piece is placeable. If not, replace the largest piece.
export function ensurePlayable(pieces) {
  if (pieces.some(p => canPlaceAny(p))) return pieces;
  // Replace largest piece with a smaller guaranteed-placeable one
  const sorted = pieces.map((p,i) => ({p,i})).sort((a,b) => b.p.baseCells.length - a.p.baseCells.length);
  for (const {i} of sorted) {
    for (let tries = 0; tries < 30; tries++) {
      const np = randomPiece();
      if (canPlaceAny(np)) { pieces[i] = np; S.prevPieceIds[i] = np.id; return pieces; }
    }
  }
  // Last resort: regenerate entirely
  return generatePieces();
}

export function getCells(piece) { return piece.baseCells; }
