// Procedural medieval music: a drone, a wandering modal melody on a plucked "lute", and war drums.
import { G } from '../state.js';

const MODES = {
  peace: { root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10, 12, 14, 15], tempo: 0.62, drums: false },   // D dorian
  war: { root: 138.59, scale: [0, 1, 3, 5, 7, 8, 10, 12, 13, 15], tempo: 0.42, drums: true },      // C# phrygian
  menu: { root: 130.81, scale: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16], tempo: 0.85, drums: false },    // C mixolydian
};
const M = { ctx: null, master: null, drone: [], mood: 'menu', timer: null, step: 0, deg: 4, phrase: 0, on: false };

function ensure() {
  if (M.ctx) return true;
  try {
    M.ctx = new (window.AudioContext || window.webkitAudioContext)();
    M.master = M.ctx.createGain(); M.master.gain.value = 0;
    const conv = M.ctx.createConvolver(); const len = M.ctx.sampleRate * 2.4; const buf = M.ctx.createBuffer(2, len, M.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    conv.buffer = buf; const wet = M.ctx.createGain(); wet.gain.value = 0.35;
    M.master.connect(M.ctx.destination); M.master.connect(conv); conv.connect(wet); wet.connect(M.ctx.destination);
    return true;
  } catch (e) { return false; }
}
function targetVol() { return G.settings?.music ? (G.settings.musicVolume ?? 0.35) * 0.5 : 0; }
function startDrone() {
  const c = M.ctx; M.drone.forEach(o => { try { o.stop(); } catch (e) { } }); M.drone = [];
  const md = MODES[M.mood];
  for (const [mult, vol] of [[0.5, 0.05], [0.75, 0.03], [1, 0.02]]) {
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = md.root * mult;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
    const g = c.createGain(); g.gain.value = vol;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07 + Math.random() * 0.05; const lg = c.createGain(); lg.gain.value = vol * 0.6; lfo.connect(lg); lg.connect(g.gain); lfo.start();
    o.connect(f); f.connect(g); g.connect(M.master); o.start(); M.drone.push(o, lfo);
  }
}
function pluck(freq, t, dur = 1.4, vol = 0.18) {
  const c = M.ctx; const o = c.createOscillator(), o2 = c.createOscillator(); o.type = 'triangle'; o2.type = 'square';
  o.frequency.value = freq; o2.frequency.value = freq * 2.003;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3200, t); f.frequency.exponentialRampToValueAtTime(500, t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
  const g2 = c.createGain(); g2.gain.value = 0.15;
  o.connect(f); o2.connect(g2); g2.connect(f); f.connect(g); g.connect(M.master);
  o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
}
function drum(t, vol = 0.35) {
  const c = M.ctx; const len = c.sampleRate * 0.4; const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = c.createBufferSource(); src.buffer = buf; const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 160;
  const o = c.createOscillator(); o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3); const og = c.createGain(); og.gain.setValueAtTime(vol, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  const g = c.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(M.master); o.connect(og); og.connect(M.master);
  src.start(t); o.start(t); o.stop(t + 0.4);
}
function tick() {
  if (!M.on) return;
  const md = MODES[M.mood]; const c = M.ctx; const t = c.currentTime + 0.05;
  M.master.gain.setTargetAtTime(targetVol(), t, 1.5);
  // melody: random walk over the scale, phrases with rests and cadences back to the tonic
  M.step++;
  const inPhrase = M.step % 16;
  if (inPhrase === 15) { M.deg = 0; pluck(md.root * 2, t, 2.6, 0.16); pluck(md.root * 3, t + 0.02, 2.6, 0.06); }
  else if (Math.random() < (inPhrase % 4 === 3 ? 0.35 : 0.82)) {
    M.deg = Math.max(0, Math.min(md.scale.length - 1, M.deg + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
    const f = md.root * 2 * Math.pow(2, md.scale[M.deg] / 12);
    pluck(f, t, md.tempo * 2.4, 0.13 + Math.random() * 0.05);
    if (Math.random() < 0.18) pluck(f * Math.pow(2, 7 / 12) / 2, t, 1.8, 0.05);
  }
  if (md.drums && (inPhrase % 4 === 0 || (inPhrase % 4 === 3 && Math.random() < 0.5))) drum(t, inPhrase % 8 === 0 ? 0.4 : 0.25);
  M.timer = setTimeout(tick, md.tempo * 1000 * (0.9 + Math.random() * 0.2));
}
export function startMusic() {
  if (M.on || !G.settings?.music) return;
  if (!ensure()) return;
  if (M.ctx.state === 'suspended') M.ctx.resume();
  M.on = true; startDrone(); tick();
}
export function stopMusic() { M.on = false; clearTimeout(M.timer); if (M.master) M.master.gain.setTargetAtTime(0, M.ctx.currentTime, 0.5); setTimeout(() => { if (!M.on) M.drone.forEach(o => { try { o.stop(); } catch (e) { } }); }, 1500); }
export function setMood(mood) {
  if (!MODES[mood] || mood === M.mood) return;
  M.mood = mood; if (M.on) { M.master.gain.setTargetAtTime(0.0, M.ctx.currentTime, 0.6); setTimeout(() => { if (M.on) startDrone(); }, 1600); }
}
export function refreshMusic() { if (G.settings.music) startMusic(); else stopMusic(); }
// Browsers require a user gesture before audio can start.
window.addEventListener('pointerdown', () => { if (G.settings?.music) startMusic(); }, { once: false, passive: true });
