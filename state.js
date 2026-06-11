// ==================== STATE ====================
export const S = {
  screen: 'splash',
  playerName: '',
  grid: [],
  pieces: [],
  prevPieceIds: [],
  score: 0,
  gridDirty: false,
  highScore: 0,
  gameOver: false,
  drag: null,
  kbSel: -1, kbR: 0, kbC: 0,
  clearing: null,
  inputLocked: false,
  bombMode: false,
  bombR: -1, bombC: -1,
  bombConfirmed: false,  // two-step bomb: preview then confirm
  dialog: null,
  combo: 0,
  comboText: '',
  undoGrid: null, undoScore: 0, undoPieces: null,
  bombsLeft: 3,
  rerollsLeft: 5,
  bombMilestone: 0,   // last score at which a bomb was earned
  rerollMilestone: 0, // last score at which a reroll was earned
  bombCheat: false,   // true if FREE mode was toggled
  leaderboard: [],
  particles: [],
  scorePopups: [],
  decoPieces: [],
  gameDecos: [],
  placedAnim: [],
  notifications: [],
  hasDragged: false,    // hide hint after first drag

  cellSize: 0, gridX: 0, gridY: 0, candY: 0, candCS: 0, toolY: 0,

  actx: null, masterGain: null, musicGain: null, sfxGain: null,
  musicPlaying: false, musicTimer: 0, musicMuted: false,
  activeMusic: null,  // current music config from MUSIC_LIBRARY
  bombFlash: 0, bombFlashN: 0, rerollFlash: 0, rerollFlashN: 0,

  needsRender: false,
  showTutorial: false,
  tutorialDismissed: false,
};

export function loadLeaderboard() {
  try { S.leaderboard = JSON.parse(localStorage.getItem('bp_leaderboard2') || '[]'); }
  catch(e) { S.leaderboard = []; }
}

export function saveScore(name, sc, cheated) {
  loadLeaderboard();
  const entry = { name, score: sc, date: new Date().toLocaleDateString('zh-CN') };
  if (cheated) entry.cheat = true;
  S.leaderboard.push(entry);
  S.leaderboard.sort((a, b) => b.score - a.score);
  S.leaderboard = S.leaderboard.slice(0, 10);
  try { localStorage.setItem('bp_leaderboard2', JSON.stringify(S.leaderboard)); } catch(e) {}
}

export function getHighScore(name) {
  try { return parseInt(localStorage.getItem('bp_high_' + name)) || 0; } catch(e) { return 0; }
}

export function requestRender() { S.needsRender = true; }
