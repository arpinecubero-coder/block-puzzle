// ==================== AUDIO SYSTEM 2.0 — Rich Synthesis ====================
import { SCALE } from './constants.js';
import { S } from './state.js';

export function initAudio() {
  if (S.actx) { S.actx.resume(); return; }
  try {
    S.actx = new (window.AudioContext || window.webkitAudioContext)();
    S.masterGain = S.actx.createGain(); S.masterGain.gain.value = 0.85;
    S.masterGain.connect(S.actx.destination);
    S.musicGain = S.actx.createGain(); S.musicGain.gain.value = 0.14;
    S.musicGain.connect(S.masterGain);
    S.sfxGain = S.actx.createGain(); S.sfxGain.gain.value = 0.55;
    S.sfxGain.connect(S.masterGain);
  } catch(e) {}
}

export function resumeCtx() {
  if (S.actx && S.actx.state === 'suspended') S.actx.resume();
}

// ─── Synth building blocks ───

function osc(freq, t, dur, gainNode, vol, type) {
  if (!S.actx) return;
  const o = S.actx.createOscillator();
  o.type = type; o.frequency.value = freq;
  const g = S.actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(gainNode || S.masterGain);
  o.start(t); o.stop(t + dur);
}

function noise(t, dur, gainNode, vol) {
  if (!S.actx) return;
  const bufSize = S.actx.sampleRate * dur;
  const buf = S.actx.createBuffer(1, bufSize, S.actx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = S.actx.createBufferSource();
  src.buffer = buf;
  const g = S.actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  // Bandpass for "click" character
  const bp = S.actx.createBiquadFilter();
  bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.8;
  src.connect(bp); bp.connect(g); g.connect(gainNode || S.masterGain);
  src.start(t); src.stop(t + dur);
}

function sweep(startFreq, endFreq, t, dur, gainNode, vol, type) {
  if (!S.actx) return;
  const o = S.actx.createOscillator();
  o.type = type; o.frequency.setValueAtTime(startFreq, t);
  o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = S.actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(gainNode || S.masterGain);
  o.start(t); o.stop(t + dur);
}

function hit(t, freq, gainNode, vol) {
  // Layered impact: noise click + bass thud + resonance
  noise(t, 0.04, gainNode, vol * 1.2);
  osc(freq, t, 0.08, gainNode, vol * 0.9, 'sine');
  osc(freq * 0.5, t + 0.005, 0.06, gainNode, vol * 0.6, 'triangle');
  // High spark
  osc(freq * 6, t + 0.01, 0.05, gainNode, vol * 0.4, 'sine');
}

// ─── SFX ───

export function sfxPlace() {
  if (!S.actx) return;
  resumeCtx();
  const t = S.actx.currentTime;
  // Layered thump + sparkle
  noise(t, 0.03, S.sfxGain, 0.6);
  osc(80, t, 0.07, S.sfxGain, 0.7, 'sine');
  osc(60, t + 0.005, 0.05, S.sfxGain, 0.4, 'triangle');
  // Ascending sparkle triad
  osc(660, t + 0.015, 0.1, S.sfxGain, 0.45, 'sine');
  osc(880, t + 0.03, 0.08, S.sfxGain, 0.35, 'sine');
  osc(1100, t + 0.04, 0.06, S.sfxGain, 0.25, 'triangle');
  // Very high sparkle
  osc(2200, t + 0.05, 0.04, S.sfxGain, 0.15, 'sine');
}

export function sfxClear(count) {
  if (!S.actx) return;
  resumeCtx();
  const steps = Math.min(count, 6);
  const t = S.actx.currentTime;

  // Noise crash — bigger for more lines
  noise(t, 0.06 + steps * 0.02, S.sfxGain, 0.3 + steps * 0.06);

  // Rising sweep — "woosh"
  sweep(150, 1800, t + 0.01, 0.2 + steps * 0.03, S.sfxGain, 0.2, 'sawtooth');

  // Low impact
  osc(50, t, 0.12, S.sfxGain, 0.5, 'sine');

  // Ascending arpeggio — pitch scales with line count
  const base = 2 + steps;
  for (let i = 0; i < steps; i++) {
    const note = SCALE[Math.min(base + i, SCALE.length - 1)];
    const dt = t + 0.04 + i * 0.06;
    osc(note, dt, 0.16, S.sfxGain, 0.5, 'triangle');
    osc(note * 2, dt + 0.015, 0.1, S.sfxGain, 0.3, 'sine');
    osc(note * 3, dt + 0.025, 0.06, S.sfxGain, 0.18, 'sine');
  }

  // Sparkle tail — randomized for variety
  const shimmerCount = 8 + steps * 3;
  for (let i = 0; i < shimmerCount; i++) {
    const freq = 800 + Math.random() * 2000;
    osc(freq, t + steps * 0.06 + i * 0.02, 0.04 + Math.random() * 0.03, S.sfxGain, 0.08 + Math.random() * 0.08, 'sine');
  }
}

export function sfxGameOver() {
  if (!S.actx) return;
  resumeCtx();
  const t = S.actx.currentTime;
  // Noise pad fade
  noise(t, 0.8, S.sfxGain, 0.15);
  // Descending minor melody
  const notes = [440, 392, 330, 262, 196, 165];
  for (let i = 0; i < notes.length; i++) {
    const dur = 0.25 + i * 0.08;
    osc(notes[i], t + i * 0.16, dur, S.sfxGain, 0.4 - i * 0.04, 'triangle');
    osc(notes[i] * 0.5, t + i * 0.16 + 0.01, dur * 0.7, S.sfxGain, 0.2, 'sine');
  }
  // Low final thud
  osc(40, t + notes.length * 0.16, 0.4, S.sfxGain, 0.35, 'sine');
}

export function sfxButton() {
  if (!S.actx) return;
  resumeCtx();
  const t = S.actx.currentTime;
  noise(t, 0.015, S.sfxGain, 0.3);
  osc(1200, t, 0.03, S.sfxGain, 0.3, 'sine');
  osc(1800, t + 0.008, 0.02, S.sfxGain, 0.2, 'sine');
}

// ─── BGM: Canon in D ───

function playNote(freq, startTime, dur, gainNode, vol, type) {
  if (!S.actx) return;
  const t = startTime || S.actx.currentTime;
  const o = S.actx.createOscillator();
  o.type = type; o.frequency.value = freq;
  const g = S.actx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(gainNode || S.masterGain);
  o.start(t); o.stop(t + dur);
}

function playChord(notes, startTime, dur) {
  if (!S.actx || S.musicMuted) return;
  // Canon voicing: 3 notes spread across octaves
  notes.forEach((ni, i) => {
    if (ni >= 0 && ni < SCALE.length) {
      const f = SCALE[ni];
      // Main chord tone
      playNote(f, startTime, dur, S.musicGain, 0.35, 'sine');
      // Soft harmonic
      playNote(f * 1.003, startTime + 0.02, dur * 0.8, S.musicGain, 0.15, 'triangle');
      // Octave sparkle on root
      if (i === 0) playNote(f * 2, startTime + 0.03, dur * 0.4, S.musicGain, 0.1, 'sine');
    }
  });
}

function playBass(freq, startTime, dur) {
  if (!S.actx || S.musicMuted) return;
  // Richer bass: fundamental + octave harmonic
  playNote(freq, startTime, dur, S.musicGain, 0.55, 'triangle');
  playNote(freq * 0.5, startTime + 0.01, dur * 0.6, S.musicGain, 0.25, 'sine');
}

function scheduleMusicCycle(startTime, idx) {
  const m = S.activeMusic || { chords: [[7,9,11]], melody: [7], bass: [0], chrd: [0], stepDur: 0.75 };
  const dur = m.stepDur;
  if (!S.actx || S.musicMuted) { scheduleNextCycle(startTime + 16 * dur, idx); return; }
  resumeCtx();
  for (let j = 0; j < 16; j++) {
    const i = (idx + j) % 16;
    const t = startTime + j * dur;
    const ci = m.chrd[i] % m.chords.length;
    playChord(m.chords[ci], t, dur * 0.9);
    playBass(SCALE[m.bass[i]] * 0.5, t + 0.02, dur * 0.6);
    const mn = m.melody[i];
    if (mn > 0 && mn < SCALE.length) playNote(SCALE[mn], t + 0.06, dur * 0.35, S.musicGain, 0.35, 'sine');
  }
  scheduleNextCycle(startTime + 16 * dur, idx);
}

function scheduleNextCycle(nextStart, idx) {
  const nextIdx = (idx + 16) % 16;
  const delayMs = Math.max(0, (nextStart - S.actx.currentTime) * 1000 - 60);
  if (S.musicPlaying && S.actx) {
    S.musicTimer = setTimeout(() => {
      if (!S.musicPlaying || !S.actx) return;
      scheduleMusicCycle(nextStart, nextIdx);
    }, delayMs);
  }
}

export function startMusic() {
  if (!S.actx || S.musicPlaying) return;
  resumeCtx();
  S.musicPlaying = true; S.musicMuted = false;
  scheduleMusicCycle(S.actx.currentTime + 0.15, 0);
}

export function stopMusic() { S.musicPlaying = false; clearTimeout(S.musicTimer); }

export function toggleMusic() {
  S.musicMuted = !S.musicMuted;
  S.musicGain.gain.setValueAtTime(S.musicMuted ? 0 : 0.08, S.actx.currentTime);
}
