// Map renderer: per-pixel styled base layer, animated overlays, labels, armies, camera.
import { G, emit } from '../state.js';
import { TERRAIN } from '../data/geography.js';
import { CULTURES } from '../data/cultures.js';
import { ch, T, idx, topOf, culture, faith, rankOf, primary, titleName, realmProvs, isPlayer, displayName } from '../engine/core.js';
import { armyPos, armyPower, areEnemies, allied, hasTruce, armyAtSea, sideOf } from '../engine/war.js';
import { hexToRgb, hash, clamp, lerp, fmtNum, mulberry32, hslToHex } from '../util.js';

export const STYLES = {
  parchment: { name: 'Royal Parchment', desc: 'Sepia vellum, watercolor realms, inked coasts.', icon: '📜' },
  illuminated: { name: 'Illuminated Manuscript', desc: 'Jewel colors, gold-leaf borders, ultramarine seas.', icon: '✨' },
  topographic: { name: 'Living Terrain', desc: 'Satellite-like relief with realm tints and seasons.', icon: '🏔' },
  stained: { name: 'Stained Glass', desc: 'Leaded panes of glowing color.', icon: '⛪' },
  ink: { name: 'Cartographer\'s Ink', desc: 'Monochrome hatching, like a master\'s sketch.', icon: '🖋' },
  nightfire: { name: 'Imperial Night', desc: 'A dark world of glowing borders and city lights.', icon: '🌙' },
};
export const MODES = {
  realm: { name: 'Realms', icon: '👑', key: 'R' }, dejure: { name: 'De Jure', icon: '📜', key: 'J' }, culture: { name: 'Culture', icon: '🎭', key: 'C' }, faith: { name: 'Faith', icon: '✝', key: 'F' },
  terrain: { name: 'Terrain', icon: '🏔', key: 'T' }, development: { name: 'Development', icon: '🏗', key: 'V' }, dynasty: { name: 'Houses', icon: '🌳', key: 'H' }, diplomacy: { name: 'Diplomacy', icon: '🤝', key: 'P' },
};

const R = { canvas: null, ctx: null, base: null, bctx: null, img: null, sea: null, fx: null, fxctx: null, cam: { x: 0, y: 0, z: 0.5 }, target: { x: 0, y: 0, z: 0.5 }, dpr: 1, w: 0, h: 0, labels: [], hover: -1, hoverMask: null, selMask: null, selPid: -1, t: 0, drag: null, particles: [], lastRecolor: 0, cityLights: null, pattern: null, patternStyle: '' };
export const renderer = R;

export function initMap(canvas) {
  R.canvas = canvas; R.ctx = canvas.getContext('2d');
  const W = G.world;
  R.base = document.createElement('canvas'); R.base.width = W.W; R.base.height = W.H; R.bctx = R.base.getContext('2d');
  R.img = R.bctx.createImageData(W.W, W.H);
  // sea mask for animated water
  R.sea = document.createElement('canvas'); R.sea.width = W.W; R.sea.height = W.H;
  const sctx = R.sea.getContext('2d'); const sim = sctx.createImageData(W.W, W.H);
  for (let i = 0; i < W.N; i++) { if (W.prov[i] === -1) { sim.data[i * 4 + 3] = W.seaDist[i] < 3 ? 120 : 255; } }
  sctx.putImageData(sim, 0, 0);
  R.fx = document.createElement('canvas'); R.fxctx = R.fx.getContext('2d');
  resize();
  window.addEventListener('resize', resize);
  bindInput();
  fitView();
}
export function resize() {
  R.dpr = Math.min(2, window.devicePixelRatio || 1);
  R.w = window.innerWidth; R.h = window.innerHeight;
  R.canvas.width = R.w * R.dpr; R.canvas.height = R.h * R.dpr;
  R.canvas.style.width = R.w + 'px'; R.canvas.style.height = R.h + 'px';
  R.fx.width = R.w; R.fx.height = R.h;
}
export function fitView() {
  const W = G.world; const z = Math.max(R.w / W.W, R.h / W.H) * 1.0;
  R.cam.z = R.target.z = z; R.cam.x = R.target.x = (W.W - R.w / z) / 2; R.cam.y = R.target.y = (W.H - R.h / z) / 2;
}
export function focusOn(x, y, z) { R.target.z = z || Math.max(R.target.z, 1.4); R.target.x = x - R.w / 2 / R.target.z; R.target.y = y - R.h / 2 / R.target.z; }
export function focusProv(pid, z) { const p = G.world.provinces[pid]; if (p) focusOn(p.ax, p.ay, z); }
const toWorld = (sx, sy) => [R.cam.x + sx / R.cam.z, R.cam.y + sy / R.cam.z];
const toScreen = (wx, wy) => [(wx - R.cam.x) * R.cam.z, (wy - R.cam.y) * R.cam.z];
export function provAt(sx, sy) { const [x, y] = toWorld(sx, sy); const W = G.world; const xi = Math.floor(x), yi = Math.floor(y); if (xi < 0 || yi < 0 || xi >= W.W || yi >= W.H) return -1; return W.prov[yi * W.W + xi]; }

// ---------- Color LUTs ----------
function dynColor(id) { return hslToHex(hash(id) % 360, 45 + hash(id + 'x') % 30, 40 + hash(id + 'y') % 20); }
export function provColor(pid, mode) {
  const s = G.s, I = idx(), W = G.world, wp = W.provinces[pid], p = s.provs[pid];
  switch (mode) {
    case 'dejure': return T(wp.duchy)?.color || '#888';
    case 'culture': return (CULTURES[p.cul] || s.customCultures[p.cul])?.color || '#888';
    case 'faith': return faith(p.fai).color;
    case 'terrain': return TERRAIN[wp.terrain].color;
    case 'development': { const t = clamp(p.dev / 50, 0, 1); return hslToHex(lerp(40, 130, t), 55, lerp(75, 35, t)); }
    case 'dynasty': { const h = ch(I.provTop[pid]); return h && h.dyn ? dynColor(h.dyn) : '#777'; }
    case 'diplomacy': {
      const top = I.provTop[pid]; const pl = s.player; if (!top) return '#666';
      if (top === pl) { const h = I.provOwner[pid]; return h === pl ? '#e8c050' : '#c8a848'; }
      if (topOf(pl) === top) return '#b0a070';
      if (areEnemies(top, pl)) return '#c03030';
      if (allied(top, pl)) return '#3070c0';
      if (hasTruce(top, pl)) return '#909090';
      const c = ch(top); const me = ch(pl); if (!c || !me) return '#777';
      return c.liege === pl ? '#d0b060' : '#6a7a6a';
    }
    default: { const top = ch(I.provTop[pid]); if (!top) return '#777'; return T(top.primary)?.color || '#777'; }
  }
}

// ---------- Base recolor ----------
export function recolor(force) {
  const now = performance.now();
  if (!force && now - R.lastRecolor < 700) return;
  R.lastRecolor = now; G.mapDirty = false;
  const W = G.world, s = G.s, I = idx();
  const style = G.settings.mapStyle, mode = G.settings.mapMode;
  const P = W.provinces.length;
  const pr = new Uint8Array(P), pg = new Uint8Array(P), pb = new Uint8Array(P), top = new Int32Array(P), occ = new Int32Array(P);
  const m = Math.floor((s.day % 365) / 30.4);
  const winter = G.settings.seasons && (m === 11 || m <= 1) ? (m === 0 ? 1 : 0.7) : 0;
  for (let p = 0; p < P; p++) {
    let [r, g, b] = hexToRgb(provColor(p, mode));
    if (mode === 'realm' && style !== 'nightfire') { const v = (hash(I.provOwner[p] + 7) % 21 - 10) * 0.6; r += v; g += v; b += v; }
    if (style === 'stained') { const v = (hash(p * 13) % 31 - 15); r += v; g += v; b += v; }
    if (winter && W.provinces[p].lat > 47) { const k = clamp((W.provinces[p].lat - 47) / 12, 0, 0.55) * winter * (style === 'topographic' ? 1 : 0.5); r = lerp(r, 245, k); g = lerp(g, 248, k); b = lerp(b, 255, k); }
    pr[p] = clamp(r, 0, 255); pg[p] = clamp(g, 0, 255); pb[p] = clamp(b, 0, 255);
    top[p] = mode === 'dejure' ? hash(W.provinces[p].kingdom) : mode === 'culture' ? hash(s.provs[p].cul) : mode === 'faith' ? hash(s.provs[p].fai) : I.provTop[p];
    occ[p] = s.provs[p].ctrl || 0;
  }
  const occCol = {}; for (let p = 0; p < P; p++) if (occ[p] && !occCol[occ[p]]) { const c = ch(occ[p]); occCol[occ[p]] = hexToRgb(T(c?.primary)?.color || '#000'); }
  const d = R.img.data, prov = W.prov, shade = W.shade, grain = W.grain, seaDist = W.seaDist, landDist = W.landDist, elev = W.elev, N = W.N, WW = W.W;
  const terrCol = W.provinces.map(p => hexToRgb(TERRAIN[p.terrain].color));
  for (let i = 0; i < N; i++) {
    const p = prov[i]; const o = i * 4;
    let r, g, b;
    const gr = grain[i] - 128;
    if (p === -1) {
      const sd = seaDist[i];
      switch (style) {
        case 'parchment': { const t = Math.min(1, sd / 70); r = lerp(176, 132, t); g = lerp(188, 156, t); b = lerp(170, 158, t); if (sd < 48 && sd % 9 === 0) { r -= 22; g -= 22; b -= 18; } r += gr * 0.08; g += gr * 0.08; b += gr * 0.06; break; }
        case 'illuminated': { const t = Math.min(1, sd / 60); r = lerp(70, 22, t); g = lerp(110, 46, t); b = lerp(190, 140, t); if (sd < 30 && sd % 8 === 0) { r += 30; g += 30; b += 20; } break; }
        case 'topographic': { const t = Math.min(1, sd / 45); r = lerp(70, 14, t); g = lerp(150, 50, t); b = lerp(170, 96, t); r += gr * 0.05; g += gr * 0.05; b += gr * 0.07; break; }
        case 'stained': { const t = Math.min(1, sd / 80); r = lerp(30, 12, t); g = lerp(80, 36, t); b = lerp(100, 66, t); const ln = Math.abs(gr) < 3; if (ln) { r = g = b = 10; } else { r += gr * 0.25; g += gr * 0.3; b += gr * 0.35; } break; }
        case 'ink': { r = 236; g = 228; b = 206; if (sd < 60 && sd % 6 === 0) { const k = 1 - sd / 60; r -= 90 * k; g -= 90 * k; b -= 80 * k; } r += gr * 0.06; g += gr * 0.06; b += gr * 0.05; break; }
        case 'nightfire': { const t = Math.min(1, sd / 40); r = lerp(16, 4, t); g = lerp(26, 8, t); b = lerp(44, 18, t); break; }
      }
    } else if (p === -2) {
      const sh = shade[i];
      switch (style) {
        case 'nightfire': r = 22 + sh * 0.1; g = 20 + sh * 0.1; b = 24; break;
        case 'ink': r = 220 + sh * 0.3; g = 210 + sh * 0.3; b = 190 + sh * 0.3; if (((i % WW) + ((i / WW) | 0)) % 7 === 0) { r -= 40; g -= 40; b -= 40; } break;
        case 'stained': r = 60 + sh * 0.3; g = 55 + sh * 0.3; b = 50; break;
        case 'topographic': r = 205 + sh * 0.6 + gr * 0.05; g = 182 + sh * 0.6; b = 140 + sh * 0.5; break;
        default: r = 196 + sh * 0.35 + gr * 0.08; g = 176 + sh * 0.35 + gr * 0.08; b = 142 + sh * 0.3; break;
      }
    } else {
      const sh = shade[i]; const cr = pr[p], cg = pg[p], cb = pb[p]; const ld = landDist[i];
      switch (style) {
        case 'parchment': {
          const k = 0.5; r = lerp(226, cr, k); g = lerp(210, cg, k); b = lerp(170, cb, k);
          const f = 1 + sh * 0.0028; r *= f; g *= f; b *= f; r += gr * 0.14; g += gr * 0.13; b += gr * 0.1;
          if (ld < 3) { r -= 30; g -= 30; b -= 30; } else if (ld < 8) { r -= 8; g -= 8; b -= 6; }
          break;
        }
        case 'illuminated': {
          const f = 1 + sh * 0.0022; r = cr * f * 1.08; g = cg * f * 1.08; b = cb * f * 1.08; r += gr * 0.05; g += gr * 0.05; b += gr * 0.05;
          if (ld < 2) { r = 212; g = 175; b = 55; } else if (ld < 5) { r = lerp(r, 255, 0.2); g = lerp(g, 245, 0.2); b = lerp(b, 220, 0.2); }
          break;
        }
        case 'topographic': {
          const tc = terrCol[p]; const e = elev[i];
          let tr = tc[0], tg = tc[1], tb = tc[2];
          if (e > 170) { const k = clamp((e - 170) / 60, 0, 1); tr = lerp(tr, 240, k); tg = lerp(tg, 240, k); tb = lerp(tb, 245, k); }
          const k = mode === 'terrain' ? 0 : 0.33; r = lerp(tr, cr, k); g = lerp(tg, cg, k); b = lerp(tb, cb, k);
          const f = 1 + sh * 0.0055; r *= f; g *= f; b *= f; r += gr * 0.06; g += gr * 0.07; b += gr * 0.05;
          if (ld < 2) { r = lerp(r, 230, 0.4); g = lerp(g, 220, 0.4); b = lerp(b, 180, 0.4); }
          break;
        }
        case 'stained': {
          const glow = ld < 10 ? 0 : 0; const f = 1 + sh * 0.0015 + gr * 0.0012; r = cr * f * 1.15; g = cg * f * 1.15; b = cb * f * 1.15;
          r += 18; g += 14; b += 10;
          break;
        }
        case 'ink': {
          const x = i % WW, y = (i / WW) | 0; const lum = (cr * 0.3 + cg * 0.59 + cb * 0.11);
          const hp = hash(top[p]) % 4; const dens = 4 + (hp % 3) * 2;
          const line = hp === 0 ? (x + y) % dens === 0 : hp === 1 ? (x - y + 4096) % dens === 0 : hp === 2 ? y % dens === 0 : x % dens === 0;
          r = 238; g = 230; b = 210;
          if (line && lum < 200) { r -= 70; g -= 72; b -= 74; }
          const f = sh * 0.35; r += f; g += f; b += f; r += gr * 0.06; g += gr * 0.06; b += gr * 0.05;
          if (ld < 2) { r = 60; g = 50; b = 40; }
          break;
        }
        case 'nightfire': {
          r = cr * 0.22 + 8; g = cg * 0.22 + 8; b = cb * 0.22 + 12; const f = 1 + sh * 0.004; r *= f; g *= f; b *= f;
          if (ld < 2) { r += 30; g += 40; b += 60; }
          break;
        }
      }
      if (occ[p]) { const x = i % WW, y = (i / WW) | 0; if (((x + y) >> 3) & 1) { const oc = occCol[occ[p]]; r = lerp(r, oc[0], 0.6); g = lerp(g, oc[1], 0.6); b = lerp(b, oc[2], 0.6); } }
    }
    d[o] = r < 0 ? 0 : r > 255 ? 255 : r; d[o + 1] = g < 0 ? 0 : g > 255 ? 255 : g; d[o + 2] = b < 0 ? 0 : b > 255 ? 255 : b; d[o + 3] = 255;
  }
  // borders
  const BI = W.borderIdx;
  const bcol = { parchment: [70, 40, 20], illuminated: [212, 175, 55], topographic: [30, 30, 30], stained: [8, 8, 8], ink: [30, 20, 10], nightfire: [255, 210, 140] }[style];
  const subMode = mode === 'realm' || mode === 'diplomacy' || mode === 'dynasty';
  for (let k = 0; k < BI.length; k++) {
    const i = BI[k], p = prov[i];
    const q1 = prov[i + 1], q2 = prov[i + WW];
    const other = q1 >= 0 && q1 !== p ? q1 : q2;
    const realmEdge = top[p] !== top[other];
    const o = i * 4;
    if (realmEdge) {
      let c = bcol;
      if (style === 'nightfire') { c = [Math.min(255, pr[p] * 1.6 + 60), Math.min(255, pg[p] * 1.6 + 60), Math.min(255, pb[p] * 1.6 + 60)]; }
      const thick = style === 'stained' || style === 'illuminated' ? 2 : 1;
      for (let dy = -thick; dy <= thick; dy++) for (let dx = -thick; dx <= thick; dx++) { const j = (i + dy * WW + dx) * 4; if (j < 0 || j >= d.length || prov[i + dy * WW + dx] < 0) continue; d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; }
      if (style === 'nightfire') for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const j2 = i + dy * WW + dx; if (j2 < 0 || j2 >= N || prov[j2] < 0) continue; const j = j2 * 4; const f = 0.12 * (1 - Math.hypot(dx, dy) / 6); if (f > 0) { d[j] = Math.min(255, d[j] + c[0] * f); d[j + 1] = Math.min(255, d[j + 1] + c[1] * f); d[j + 2] = Math.min(255, d[j + 2] + c[2] * f); } }
    } else {
      const f = style === 'stained' ? 0.15 : style === 'nightfire' ? 1.25 : 0.72;
      const isDuchy = subMode ? I.provOwner[p] !== I.provOwner[other] : W.provinces[p].duchy !== W.provinces[other].duchy;
      const ff = style === 'stained' ? 0.15 : isDuchy ? f * 0.9 : (style === 'nightfire' ? 1.1 : 0.86);
      d[o] *= ff; d[o + 1] *= ff; d[o + 2] *= ff;
      if (style === 'stained') { const j = o + 4; d[j] *= 0.3; d[j + 1] *= 0.3; d[j + 2] *= 0.3; }
    }
  }
  R.bctx.putImageData(R.img, 0, 0);
  computeLabels();
  R.cityLights = null;
}

// ---------- Labels ----------
function shortRealmName(c) {
  const t = T(c.primary); if (!t) return c.name;
  let n = t.realmName || t.name;
  n = n.replace(/^(Kingdom|Empire|Duchy|County|Republic|Sultanate|Emirate|Principality|Grand Principality|Khanate|Taifa|Despotate|Lordship|Banate|Grand Duchy|Domain|Ulus|Emirate|Despotate) of (the )?/i, '');
  return n;
}
function computeLabels() {
  const W = G.world, I = idx(); const groups = new Map();
  const mode = G.settings.mapMode;
  if (mode === 'culture' || mode === 'faith' || mode === 'dejure') {
    for (const p of W.provinces) { const key = mode === 'culture' ? G.s.provs[p.id].cul : mode === 'faith' ? G.s.provs[p.id].fai : p.kingdom; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(p); }
  } else {
    for (const p of W.provinces) { const t = I.provTop[p.id]; if (!t) continue; if (!groups.has(t)) groups.set(t, []); groups.get(t).push(p); }
  }
  const labels = [];
  for (const [key, ps] of groups) {
    let name;
    if (mode === 'culture') name = (CULTURES[key] || G.s.customCultures[key])?.name;
    else if (mode === 'faith') name = faith(key).name;
    else if (mode === 'dejure') name = T(key)?.name;
    else { const c = ch(key); if (!c) continue; name = shortRealmName(c); }
    if (!name) continue;
    // split disconnected groups: label the largest connected component
    const set = new Set(ps.map(p => p.id)); const seen = new Set(); let best = null, bestA = 0;
    for (const p of ps) { if (seen.has(p.id)) continue; const comp = []; const st = [p.id]; seen.add(p.id); while (st.length) { const x = st.pop(); comp.push(x); for (const n of W.provinces[x].neighbors) if (set.has(n) && !seen.has(n)) { seen.add(n); st.push(n); } } const a = comp.reduce((s, x) => s + W.provinces[x].area, 0); if (a > bestA) { bestA = a; best = comp; } }
    const pts = best.map(id => W.provinces[id]);
    let sw = 0, mx = 0, my = 0; for (const p of pts) { sw += p.area; mx += p.ax * p.area; my += p.ay * p.area; } mx /= sw; my /= sw;
    let cxx = 0, cxy = 0, cyy = 0; for (const p of pts) { const dx = p.ax - mx, dy = p.ay - my; cxx += dx * dx * p.area; cxy += dx * dy * p.area; cyy += dy * dy * p.area; }
    let ang = 0.5 * Math.atan2(2 * cxy, cxx - cyy);
    if (Math.abs(ang) > 1.1) ang = ang > 0 ? ang - Math.PI / 2 : ang + Math.PI / 2;
    if (pts.length === 1) ang = 0;
    const ux = Math.cos(ang), uy = Math.sin(ang);
    let umin = Infinity, umax = -Infinity; const uv = [];
    for (const p of pts) { const dx = p.ax - mx, dy = p.ay - my; const u = dx * ux + dy * uy, v = -dx * uy + dy * ux; uv.push([u, v, p.area]); const r = Math.sqrt(p.area / Math.PI) * 0.7; umin = Math.min(umin, u - r); umax = Math.max(umax, u + r); }
    // quadratic fit v = a u^2 + c (weighted)
    let s0 = 0, s2 = 0, s4 = 0, t0 = 0, t2 = 0;
    for (const [u, v, w] of uv) { s0 += w; s2 += w * u * u; s4 += w * u ** 4; t0 += w * v; t2 += w * v * u * u; }
    const det = s0 * s4 - s2 * s2; let a = det > 1e-6 ? (s0 * t2 - s2 * t0) / det : 0; let c0 = det > 1e-6 ? (t0 * s4 - s2 * t2) / det : t0 / s0;
    const len = (umax - umin) * 0.82;
    a = clamp(a, -1.2 / Math.max(60, len), 1.2 / Math.max(60, len));
    const txt = name.toUpperCase();
    const size = clamp(Math.min(len / (txt.length * 0.82 + 1), Math.sqrt(sw) * 0.3), 5, 120) * (pts.length === 1 ? 0.8 : 1);
    labels.push({ txt, mx, my, ux, uy, a, c0, len, size, area: sw, key });
  }
  labels.sort((p, q) => q.size - p.size);
  R.labels = labels;
}
function drawLabels(ctx) {
  const z = R.cam.z; const style = G.settings.mapStyle;
  const font = style === 'ink' || style === 'parchment' ? '"IM Fell English SC", "Cinzel", Georgia, serif' : '"Cinzel", "IM Fell English SC", Georgia, serif';
  const col = { parchment: ['rgba(60,30,12,0.85)', 'rgba(240,225,190,0.5)'], illuminated: ['rgba(255,240,200,0.95)', 'rgba(60,20,10,0.75)'], topographic: ['rgba(255,255,255,0.92)', 'rgba(0,0,0,0.6)'], stained: ['rgba(255,250,230,0.95)', 'rgba(0,0,0,0.85)'], ink: ['rgba(40,25,10,0.9)', 'rgba(240,232,212,0.8)'], nightfire: ['rgba(255,220,160,0.92)', 'rgba(0,0,0,0.8)'] }[style];
  const placed = [];
  for (const L of R.labels) {
    const px = L.size * z;
    if (px < 9 || px > 120 * (z < 1 ? 1.4 : 1)) continue;
    if (z > 2.5 && px > 60) continue;
    const [sx, sy] = toScreen(L.mx, L.my);
    const half = L.len * z / 2;
    if (sx + half < -50 || sx - half > R.w + 50 || sy < -80 || sy > R.h + 80) continue;
    const box = [sx - half, sy - px, sx + half, sy + px];
    if (placed.some(b => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1])) continue;
    placed.push(box);
    ctx.save();
    ctx.font = `${Math.round(px)}px ${font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const chars = [...L.txt]; const widths = chars.map(c => ctx.measureText(c).width); const spacing = px * 0.18;
    const total = widths.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1);
    const scale = Math.min(1, (L.len * z) / Math.max(1, total));
    let u = -total * scale / 2;
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, px * 0.12); ctx.strokeStyle = col[1]; ctx.fillStyle = col[0];
    for (let k = 0; k < chars.length; k++) {
      const w = widths[k] * scale; const uc = (u + w / 2) / z;
      const v = L.a * uc * uc + L.c0; const dv = 2 * L.a * uc;
      const wx = L.mx + L.ux * uc - L.uy * v, wy = L.my + L.uy * uc + L.ux * v;
      const [x, y] = toScreen(wx, wy); const ang = Math.atan2(L.uy, L.ux) + Math.atan(dv);
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(scale, scale);
      ctx.strokeText(chars[k], 0, 0); ctx.fillText(chars[k], 0, 0); ctx.restore();
      u += w + spacing * scale;
    }
    ctx.restore();
  }
  // county names when zoomed in
  if (z > 2.1) {
    ctx.font = `${Math.round(clamp(z * 4.2, 10, 16))}px "Cinzel", Georgia, serif`; ctx.textAlign = 'center';
    ctx.fillStyle = style === 'nightfire' || style === 'stained' ? 'rgba(255,240,210,0.85)' : 'rgba(40,25,10,0.85)';
    ctx.strokeStyle = style === 'nightfire' || style === 'stained' ? 'rgba(0,0,0,0.7)' : 'rgba(250,240,215,0.7)'; ctx.lineWidth = 3;
    for (const p of G.world.provinces) { const [x, y] = toScreen(p.ax, p.ay + 9); if (x < -40 || x > R.w + 40 || y < -20 || y > R.h + 20) continue; ctx.strokeText(p.name, x, y); ctx.fillText(p.name, x, y); }
  }
}

// ---------- Province masks ----------
function provMask(pid, rgba, edgeOnly) {
  const W = G.world, p = W.provinces[pid]; const [x0, y0, x1, y1] = p.bbox;
  const w = x1 - x0 + 3, h = y1 - y0 + 3;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); const im = c.createImageData(w, h);
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W.W + x; if (W.prov[i] !== pid) continue;
    const edge = W.prov[i - 1] !== pid || W.prov[i + 1] !== pid || W.prov[i - W.W] !== pid || W.prov[i + W.W] !== pid;
    if (edgeOnly && !edge) continue;
    const o = ((y - y0 + 1) * w + (x - x0 + 1)) * 4; im.data[o] = rgba[0]; im.data[o + 1] = rgba[1]; im.data[o + 2] = rgba[2]; im.data[o + 3] = edge ? 255 : rgba[3];
  }
  c.putImageData(im, 0, 0);
  return { cv, x: x0 - 1, y: y0 - 1 };
}
export function setHover(pid) { if (pid === R.hover) return; R.hover = pid; R.hoverMask = pid >= 0 ? provMask(pid, [255, 255, 240, 46]) : null; }
export function setSelectedProv(pid) { R.selPid = pid; R.selMask = pid >= 0 ? provMask(pid, [255, 230, 140, 30]) : null; }

// ---------- Overlays ----------
function wavePattern(ctx) {
  const style = G.settings.mapStyle;
  if (R.pattern && R.patternStyle === style) return R.pattern;
  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d');
  const col = { parchment: 'rgba(60,70,60,0.22)', illuminated: 'rgba(240,210,120,0.35)', topographic: 'rgba(255,255,255,0.10)', stained: 'rgba(160,220,255,0.10)', ink: 'rgba(40,30,20,0.18)', nightfire: 'rgba(120,160,255,0.08)' }[style];
  x.strokeStyle = col; x.lineWidth = style === 'illuminated' ? 1.4 : 1;
  for (let k = 0; k < 3; k++) { const ox = (k * 23) % 64, oy = 12 + k * 20; x.beginPath(); x.moveTo(ox - 8, oy); x.quadraticCurveTo(ox - 2, oy - 5, ox + 4, oy); x.quadraticCurveTo(ox + 10, oy + 5, ox + 16, oy); x.stroke(); }
  R.pattern = ctx.createPattern(c, 'repeat'); R.patternStyle = style; return R.pattern;
}
function drawSeaFx() {
  const f = R.fxctx; f.setTransform(1, 0, 0, 1, 0, 0); f.globalCompositeOperation = 'source-over'; f.clearRect(0, 0, R.w, R.h);
  const pat = wavePattern(f); const z = R.cam.z;
  const ox = (-R.cam.x * z + R.t * 6) % 64, oy = (-R.cam.y * z + Math.sin(R.t * 0.4) * 4) % 64;
  f.save(); f.translate(ox, oy); const s = clamp(z, 0.6, 2.5); f.scale(s, s); f.fillStyle = pat; f.fillRect(-ox / s - 64, -oy / s - 64, R.w / s + 128, R.h / s + 128); f.restore();
  f.globalCompositeOperation = 'destination-in';
  f.imageSmoothingEnabled = true;
  f.drawImage(R.sea, -R.cam.x * z, -R.cam.y * z, G.world.W * z, G.world.H * z);
  f.globalCompositeOperation = 'source-over';
  R.ctx.drawImage(R.fx, 0, 0, R.w, R.h);
}
function drawCityLights(ctx) {
  const z = R.cam.z; const t = R.t;
  for (const p of G.world.provinces) {
    const dev = G.s.provs[p.id].dev; const [x, y] = toScreen(p.hx, p.hy);
    if (x < -30 || y < -30 || x > R.w + 30 || y > R.h + 30) continue;
    const r = (3 + dev * 0.35) * clamp(z, 0.4, 2.5);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
    const flick = 0.85 + Math.sin(t * 3 + p.id) * 0.08;
    g.addColorStop(0, `rgba(255,230,160,${0.9 * flick})`); g.addColorStop(0.3, `rgba(255,170,70,${0.4 * flick})`); g.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2); ctx.fill();
  }
}
function castleIcon(ctx, x, y, s, fill, stroke) {
  ctx.beginPath();
  ctx.moveTo(x - s, y + s * 0.8); ctx.lineTo(x - s, y - s * 0.3); ctx.lineTo(x - s * 0.6, y - s * 0.3); ctx.lineTo(x - s * 0.6, y - s * 0.7); ctx.lineTo(x - s * 0.2, y - s * 0.7); ctx.lineTo(x - s * 0.2, y - s * 0.3);
  ctx.lineTo(x + s * 0.2, y - s * 0.3); ctx.lineTo(x + s * 0.2, y - s * 0.7); ctx.lineTo(x + s * 0.6, y - s * 0.7); ctx.lineTo(x + s * 0.6, y - s * 0.3); ctx.lineTo(x + s, y - s * 0.3); ctx.lineTo(x + s, y + s * 0.8); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = stroke; ctx.stroke();
}
function crownIcon(ctx, x, y, s, fill) {
  ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.5); ctx.lineTo(x - s, y - s * 0.4); ctx.lineTo(x - s * 0.5, y); ctx.lineTo(x, y - s * 0.7); ctx.lineTo(x + s * 0.5, y); ctx.lineTo(x + s, y - s * 0.4); ctx.lineTo(x + s, y + s * 0.5); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = 'rgba(40,20,0,0.8)'; ctx.lineWidth = 1; ctx.stroke();
}
function drawHoldings(ctx) {
  const z = R.cam.z; const I = idx(); const s = G.s;
  const style = G.settings.mapStyle;
  for (const p of G.world.provinces) {
    const [x, y] = toScreen(p.hx, p.hy);
    if (x < -20 || y < -20 || x > R.w + 20 || y > R.h + 20) continue;
    const owner = ch(I.provOwner[p.id]); const top = ch(I.provTop[p.id]);
    const isTopCap = top && top.capital === p.id;
    const sp = s.provs[p.id];
    if (z > 1.3 || (isTopCap && z > 0.55)) {
      const col = T(top?.primary)?.color || '#888';
      const sz = isTopCap ? clamp(z * 3.4, 4, 11) : clamp(z * 2.2, 3, 7);
      if (isTopCap && rankOf(top) >= 3) crownIcon(ctx, x, y - sz * 0.2, sz, '#e8c050');
      else castleIcon(ctx, x, y, sz, style === 'nightfire' ? '#ffd890' : col, 'rgba(20,10,0,0.8)');
    }
    if (sp.wonders?.length && z > 0.9) { ctx.fillStyle = '#ffd040'; ctx.font = `${clamp(z * 6, 8, 16)}px serif`; ctx.textAlign = 'center'; ctx.fillText('✦', x + clamp(z * 6, 6, 14), y - clamp(z * 4, 4, 10)); }
    if (sp.siege > 0 && sp.sieger) {
      const r = clamp(z * 7, 7, 18);
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
      const army = s.armies.find(a => a.id === sp.sieger);
      ctx.strokeStyle = army?.raid && !army?.war ? '#ff7020' : '#e04030'; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sp.siege); ctx.stroke();
      if (army?.raid) { for (let k = 0; k < 2; k++) spawnParticle(p.hx + (Math.random() - 0.5) * 8, p.hy - 3, 'fire'); }
    }
    if (sp.build && z > 1.6) { ctx.font = `${clamp(z * 4, 8, 13)}px serif`; ctx.fillText('🔨', x - clamp(z * 6, 6, 14), y - clamp(z * 3, 3, 8)); }
  }
}
function spawnParticle(x, y, kind) { if (R.particles.length > 400) return; R.particles.push({ x, y, vx: (Math.random() - 0.5) * 0.3, vy: -0.25 - Math.random() * 0.4, life: 1, kind, r: kind === 'smoke' ? 3 + Math.random() * 4 : 1.5 + Math.random() * 2 }); }
function drawParticles(ctx, dt) {
  const z = R.cam.z;
  for (const p of R.particles) {
    p.x += p.vx * dt * 30; p.y += p.vy * dt * 30; p.life -= dt * (p.kind === 'smoke' ? 0.5 : 1.1); p.r += dt * (p.kind === 'smoke' ? 3 : 0);
    const [x, y] = toScreen(p.x, p.y); const r = p.r * clamp(z, 0.5, 3);
    if (p.kind === 'fire') { ctx.fillStyle = `rgba(255,${Math.round(120 + 100 * p.life)},40,${p.life * 0.8})`; }
    else ctx.fillStyle = `rgba(200,195,185,${p.life * 0.35})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  R.particles = R.particles.filter(p => p.life > 0);
}
function drawArmies(ctx) {
  const z = R.cam.z; const s = G.s; const pl = s.player; const t = R.t;
  const sel = G.selected?.type === 'army' ? G.selected.id : null;
  // paths
  for (const a of s.armies) {
    if (!a.path.length) continue;
    const mine = topOf(a.owner) === pl || a.owner === pl;
    if (!mine && a.id !== sel && !areEnemies(a.owner, pl)) continue;
    const pts = [armyPos(a), ...a.path.map(id => [G.world.provinces[id].hx, G.world.provinces[id].hy])];
    ctx.save(); ctx.setLineDash([6, 5]); ctx.lineDashOffset = -t * 20; ctx.lineWidth = 2.2; ctx.strokeStyle = mine ? 'rgba(255,240,180,0.9)' : 'rgba(255,90,70,0.85)';
    ctx.beginPath(); pts.forEach(([x, y], k) => { const [sx, sy] = toScreen(x, y); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); ctx.restore();
    const [ex, ey] = toScreen(...pts[pts.length - 1]); ctx.fillStyle = mine ? '#fff0b0' : '#ff6050'; ctx.beginPath(); ctx.arc(ex, ey, 4, 0, Math.PI * 2); ctx.fill();
  }
  // stacks
  const groups = new Map();
  for (const a of s.armies) { const [x, y] = armyPos(a); const k = a.path.length && a.prog > 0 ? `m${a.id}` : `p${a.loc}`; if (!groups.has(k)) groups.set(k, { x, y, list: [] }); groups.get(k).list.push(a); }
  for (const g of groups.values()) {
    g.list.forEach((a, k) => {
      const [sx0, sy0] = toScreen(g.x, g.y); const sx = sx0 + k * 18 - (g.list.length - 1) * 9, sy = sy0 - 4;
      if (sx < -40 || sy < -40 || sx > R.w + 40 || sy > R.h + 40) return;
      const owner = ch(a.owner); const col = T(ch(topOf(a.owner))?.primary)?.color || '#888';
      const mine = topOf(a.owner) === pl; const enemy = areEnemies(a.owner, pl);
      const sc = clamp(z * 1.0, 0.75, 1.5); const sea = armyAtSea(a);
      ctx.save(); ctx.translate(sx, sy); ctx.scale(sc, sc);
      if (a.id === sel) { ctx.strokeStyle = `rgba(255,240,150,${0.6 + Math.sin(t * 6) * 0.3})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 6, 16, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(0, 6, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
      if (sea) { ctx.fillStyle = '#5a3a1a'; ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(12, 0); ctx.lineTo(8, 6); ctx.lineTo(-8, 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#e8dcc0'; ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(9, -4); ctx.lineTo(0, -4); ctx.closePath(); ctx.fill(); ctx.fillStyle = col; ctx.fillRect(-1, -22, 2, 22); }
      else {
        // pole + waving banner
        ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -24); ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, -24);
        for (let u = 0; u <= 16; u += 4) ctx.lineTo(u, -24 + Math.sin(t * 5 + u * 0.4 + a.id) * 1.6);
        for (let u = 16; u >= 0; u -= 4) ctx.lineTo(u, -12 + Math.sin(t * 5 + u * 0.4 + a.id) * 1.6);
        ctx.closePath(); ctx.fill(); ctx.strokeStyle = enemy ? '#ff4030' : mine ? '#ffe080' : 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = 'bold 8px serif'; ctx.textAlign = 'center'; ctx.fillText(a.raid ? '🔥' : (displayName(owner) || '?')[0], 8, -15);
      }
      // count plate
      const men = a.men + Object.values(a.maa).reduce((x, y) => x + y, 0);
      const txt = fmtNum(men);
      ctx.font = 'bold 10px "Cinzel", Georgia, serif'; const tw = ctx.measureText(txt).width + 8;
      ctx.fillStyle = enemy ? 'rgba(120,20,15,0.92)' : mine ? 'rgba(40,30,10,0.92)' : 'rgba(30,30,30,0.85)'; ctx.strokeStyle = enemy ? '#ff7060' : mine ? '#e8c050' : '#999'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(-tw / 2, 8, tw, 13, 3); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff4d8'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(txt, 0, 15);
      if (a.loot > 0) { ctx.fillText('💰', tw / 2 + 6, 15); }
      if (s.day < a.ready) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '9px serif'; ctx.fillText('mustering…', 0, 28); }
      ctx.restore();
      a._sx = sx; a._sy = sy;
    });
  }
  // battles
  for (const b of s.battles) {
    const p = G.world.provinces[b.prov]; const [x, y] = toScreen(p.hx, p.hy);
    if (Math.random() < 0.5) spawnParticle(p.hx + (Math.random() - 0.5) * 14, p.hy + (Math.random() - 0.5) * 6, 'smoke');
    const pulse = 1 + Math.sin(t * 8) * 0.12;
    ctx.save(); ctx.translate(x, y - 30); ctx.scale(pulse, pulse);
    ctx.font = '22px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('⚔', 0, 0);
    ctx.restore();
    const ra = b.ra ?? 1, rd = b.rd ?? 1; const tot = ra + rd || 1;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 26, y - 14, 52, 6);
    ctx.fillStyle = '#d04030'; ctx.fillRect(x - 25, y - 13, 50 * (ra / tot), 4); ctx.fillStyle = '#3070d0'; ctx.fillRect(x - 25 + 50 * (ra / tot), y - 13, 50 * (rd / tot), 4);
  }
}

// ---------- Frame ----------
let lastT = performance.now();
export function frame() {
  const now = performance.now(); const dt = Math.min(0.1, (now - lastT) / 1000); lastT = now; R.t += dt;
  // smooth camera
  const k = 1 - Math.pow(0.0001, dt);
  R.cam.z = lerp(R.cam.z, R.target.z, k); R.cam.x = lerp(R.cam.x, R.target.x, k); R.cam.y = lerp(R.cam.y, R.target.y, k);
  keyPan(dt);
  if (G.mapDirty) recolor();
  const ctx = R.ctx; const style = G.settings.mapStyle;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.fillStyle = { parchment: '#9aa49a', illuminated: '#16285a', topographic: '#0e2c50', stained: '#081820', ink: '#e8dfc8', nightfire: '#03060c' }[style];
  ctx.fillRect(0, 0, R.w, R.h);
  const z = R.cam.z;
  ctx.imageSmoothingEnabled = z < 2.2; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(R.base, -R.cam.x * z, -R.cam.y * z, G.world.W * z, G.world.H * z);
  drawSeaFx();
  drawEdges(ctx, style);
  if (style === 'nightfire') drawCityLights(ctx);
  if (R.selMask) { const m = R.selMask; ctx.globalAlpha = 0.55 + Math.sin(R.t * 4) * 0.35; ctx.imageSmoothingEnabled = false; ctx.drawImage(m.cv, (m.x - R.cam.x) * z, (m.y - R.cam.y) * z, m.cv.width * z, m.cv.height * z); ctx.globalAlpha = 1; }
  if (R.hoverMask) { const m = R.hoverMask; ctx.imageSmoothingEnabled = false; ctx.drawImage(m.cv, (m.x - R.cam.x) * z, (m.y - R.cam.y) * z, m.cv.width * z, m.cv.height * z); }
  if (G.settings.labels) drawLabels(ctx);
  drawHoldings(ctx);
  drawArmies(ctx);
  drawParticles(ctx, dt);
  drawVignette(ctx, style);
  if (R.pathPreview) { ctx.save(); ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); R.pathPreview.forEach(([x, y], k) => { const [sx, sy] = toScreen(x, y); k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); }); ctx.stroke(); ctx.restore(); }
}
function drawEdges(ctx, style) {
  const z = R.cam.z, W = G.world;
  const bg = { parchment: '154,164,154', illuminated: '22,40,90', topographic: '14,44,80', stained: '8,24,32', ink: '232,223,200', nightfire: '3,6,12' }[style];
  const x0 = -R.cam.x * z, y0 = -R.cam.y * z, x1 = (W.W - R.cam.x) * z, y1 = (W.H - R.cam.y) * z, f = 90 * Math.max(0.6, z);
  const band = (gx0, gy0, gx1, gy1, rx, ry, rw, rh) => { const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1); g.addColorStop(0, `rgba(${bg},1)`); g.addColorStop(1, `rgba(${bg},0)`); ctx.fillStyle = g; ctx.fillRect(rx, ry, rw, rh); };
  if (x1 < R.w + f) band(x1, 0, x1 - f, 0, x1 - f, 0, f, R.h);
  if (x0 > -f) band(x0, 0, x0 + f, 0, x0, 0, f, R.h);
  if (y0 > -f) band(0, y0, 0, y0 + f, 0, y0, R.w, f);
  if (y1 < R.h + f) band(0, y1, 0, y1 - f, 0, y1 - f, R.w, f);
  ctx.fillStyle = `rgb(${bg})`;
  if (x1 < R.w) ctx.fillRect(x1, 0, R.w - x1, R.h); if (x0 > 0) ctx.fillRect(0, 0, x0, R.h);
  if (y1 < R.h) ctx.fillRect(0, y1, R.w, R.h - y1); if (y0 > 0) ctx.fillRect(0, 0, R.w, y0);
}
function drawVignette(ctx, style) {
  if (!R.vig || R.vig.w !== R.w || R.vig.h !== R.h || R.vig.style !== style) {
    const c = document.createElement('canvas'); c.width = R.w; c.height = R.h; const x = c.getContext('2d');
    const g = x.createRadialGradient(R.w / 2, R.h / 2, Math.min(R.w, R.h) * 0.35, R.w / 2, R.h / 2, Math.max(R.w, R.h) * 0.75);
    const edge = { parchment: 'rgba(70,40,10,0.45)', illuminated: 'rgba(20,5,0,0.5)', topographic: 'rgba(0,0,0,0.35)', stained: 'rgba(0,0,0,0.6)', ink: 'rgba(90,70,40,0.35)', nightfire: 'rgba(0,0,0,0.7)' }[style];
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, edge); x.fillStyle = g; x.fillRect(0, 0, R.w, R.h);
    R.vig = { w: R.w, h: R.h, style, c };
  }
  ctx.drawImage(R.vig.c, 0, 0);
}

// ---------- Input ----------
const keys = new Set();
function keyPan(dt) {
  const sp = 700 * dt / R.target.z;
  if (keys.has('w') || keys.has('arrowup')) R.target.y -= sp;
  if (keys.has('s') || keys.has('arrowdown')) R.target.y += sp;
  if (keys.has('a') || keys.has('arrowleft')) R.target.x -= sp;
  if (keys.has('d') || keys.has('arrowright')) R.target.x += sp;
  clampCam();
}
function clampCam() {
  const W = G.world; const minZ = Math.min(R.w / W.W, R.h / W.H) * 0.9;
  R.target.z = clamp(R.target.z, minZ, 7);
  const vw = R.w / R.target.z, vh = R.h / R.target.z;
  R.target.x = clamp(R.target.x, -vw * 0.3, W.W - vw * 0.7); R.target.y = clamp(R.target.y, -vh * 0.3, W.H - vh * 0.7);
}
function bindInput() {
  const cv = R.canvas;
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0016);
    const [wx, wy] = [R.target.x + e.offsetX / R.target.z, R.target.y + e.offsetY / R.target.z];
    R.target.z *= f; clampCam();
    R.target.x = wx - e.offsetX / R.target.z; R.target.y = wy - e.offsetY / R.target.z; clampCam();
  }, { passive: false });
  cv.addEventListener('mousedown', e => { if (e.button === 0) R.drag = { x: e.clientX, y: e.clientY, cx: R.target.x, cy: R.target.y, moved: false }; });
  window.addEventListener('mousemove', e => {
    if (R.drag) { const dx = e.clientX - R.drag.x, dy = e.clientY - R.drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) R.drag.moved = true; if (R.drag.moved) { R.target.x = R.drag.cx - dx / R.target.z; R.target.y = R.drag.cy - dy / R.target.z; clampCam(); R.cam.x = R.target.x; R.cam.y = R.target.y; } }
    if (e.target === cv) { const pid = provAt(e.offsetX, e.offsetY); setHover(pid >= 0 ? pid : -1); emit('mapHover', { pid, x: e.clientX, y: e.clientY, army: armyAtScreen(e.offsetX, e.offsetY) }); }
    else if (R.hover !== -1) { setHover(-1); emit('mapHover', { pid: -1 }); }
  });
  window.addEventListener('mouseup', e => {
    if (R.drag && !R.drag.moved && e.target === cv && e.button === 0) {
      const army = armyAtScreen(e.offsetX, e.offsetY);
      if (army) emit('armyClick', army); else emit('provClick', provAt(e.offsetX, e.offsetY));
    }
    R.drag = null;
  });
  cv.addEventListener('contextmenu', e => { e.preventDefault(); emit('provRightClick', provAt(e.offsetX, e.offsetY)); });
  window.addEventListener('keydown', e => { if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return; keys.add(e.key.toLowerCase()); });
  window.addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur', () => keys.clear());
}
export function armyAtScreen(sx, sy) {
  let best = null, bd = 20;
  for (const a of G.s.armies) { if (a._sx === undefined) continue; const d = Math.hypot(a._sx + 4 - sx, a._sy - 6 - sy); if (d < bd) { bd = d; best = a; } }
  return best;
}
export function zoomBy(f) { const cx = R.w / 2, cy = R.h / 2; const wx = R.target.x + cx / R.target.z, wy = R.target.y + cy / R.target.z; R.target.z *= f; clampCam(); R.target.x = wx - cx / R.target.z; R.target.y = wy - cy / R.target.z; clampCam(); }
