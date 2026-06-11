// ==================== GRID OPERATIONS ====================
import { GRID } from './constants.js';
import { S } from './state.js';

export function canPlace(cells, gr, gc) {
  for (const [r, c] of cells) {
    const nr = gr + r, nc = gc + c;
    if (nr < 0 || nr >= GRID || nc < 0 || nc >= GRID) return false;
    if (S.grid[nr][nc] !== 0) return false;
  }
  return true;
}

export function placePiece(cells, color, gr, gc) {
  for (const [r, c] of cells) S.grid[gr + r][gc + c] = color;
}

export function findFullLines() {
  const rows = [], cols = [];
  for (let r = 0; r < GRID; r++) { if (S.grid[r].every(v => v !== 0)) rows.push(r); }
  for (let c = 0; c < GRID; c++) {
    let full = true;
    for (let r = 0; r < GRID; r++) { if (S.grid[r][c] === 0) { full = false; break; } }
    if (full) cols.push(c);
  }
  return { rows, cols };
}

export function clearLines(rows, cols) {
  const set = new Set();
  for (const r of rows) for (let c = 0; c < GRID; c++) set.add(`${r},${c}`);
  for (const c of cols) for (let r = 0; r < GRID; r++) set.add(`${r},${c}`);
  for (const key of set) {
    const [r, c] = key.split(',').map(Number);
    S.grid[r][c] = 0;
  }
  return rows.length + cols.length;
}

export function canPlaceAny(piece) {
  const cells = piece.baseCells;
  for (let r = 0; r < GRID; r++)
    for (let c = 0; c < GRID; c++)
      if (canPlace(cells, r, c)) return true;
  return false;
}

export function countValidPositions(cells) {
  let count = 0, bestR = 0, bestC = 0;
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      if (canPlace(cells, r, c)) { count++; bestR = r; bestC = c; }
      if (count > 1) return { count, r: -1, c: -1 };
    }
  }
  return { count, r: bestR, c: bestC };
}

export function gridFillPercent() {
  let f = 0;
  for (let r = 0; r < GRID; r++) for (let c = 0; c < GRID; c++) if (S.grid[r][c] !== 0) f++;
  return f;
}
