// Shared utilities: RNG, noise, dates, colors, formatting.

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(str) {
  let h = 2166136261 >>> 0;
  str = String(str);
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Global game RNG (state persisted in G.s.rng)
let _rngState = 12345;
export function seedRng(s) { _rngState = s >>> 0; }
export function rngState() { return _rngState; }
export function rand() {
  _rngState = (_rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(_rngState ^ (_rngState >>> 15), 1 | _rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randi = (a, b) => a + Math.floor(rand() * (b - a + 1));
export const randf = (a, b) => a + rand() * (b - a);
export const chance = p => rand() < p;
export const pick = arr => arr[Math.floor(rand() * arr.length)];
export function shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
export function weighted(items, wfn) {
  let tot = 0; const ws = items.map(it => { const w = Math.max(0, wfn(it)); tot += w; return w; });
  if (tot <= 0) return null;
  let r = rand() * tot;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;

// Value noise + fbm
export function makeNoise(seed) {
  const r = mulberry32(seed);
  const P = new Uint8Array(512); const V = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; V[i] = r() * 2 - 1; }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = P[i]; P[i] = P[j]; P[j] = t; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const fade = t => t * t * (3 - 2 * t);
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const a = V[P[P[X] + Y]], b = V[P[P[X + 1] + Y]], c = V[P[P[X] + Y + 1]], d = V[P[P[X + 1] + Y + 1]];
    const u = fade(xf), v = fade(yf);
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
  }
  n2.fbm = (x, y, oct = 4) => { let s = 0, amp = 1, f = 1, norm = 0; for (let o = 0; o < oct; o++) { s += n2(x * f, y * f) * amp; norm += amp; amp *= 0.5; f *= 2.03; } return s / norm; };
  return n2;
}

// Calendar (365-day years)
export const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export const MDAYS = [31,28,31,30,31,30,31,31,30,31,30,31];
const CUM = MDAYS.reduce((a, d, i) => { a.push((a[i - 1] || 0) + (i ? MDAYS[i - 1] : 0)); return a; }, []);
export function dateToDay(y, m, d) { return y * 365 + CUM[m - 1] + (d - 1); }
export function dayToDate(day) {
  const y = Math.floor(day / 365); let r = day - y * 365; let m = 0;
  while (m < 11 && r >= MDAYS[m]) { r -= MDAYS[m]; m++; }
  return { y, m: m + 1, d: r + 1 };
}
export function fmtDate(day, short = false) {
  const { y, m, d } = dayToDate(day);
  return short ? `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}` : `${d} ${MONTHS[m - 1]} ${y}`;
}

// Colors
export function hexToRgb(h) {
  h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export const rgbToHex = (r, g, b) => '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
export function mixHex(a, b, t) { const A = hexToRgb(a), B = hexToRgb(b); return rgbToHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)); }
export function shadeHex(a, f) { const A = hexToRgb(a); return f >= 0 ? rgbToHex(A[0] + (255 - A[0]) * f, A[1] + (255 - A[1]) * f, A[2] + (255 - A[2]) * f) : rgbToHex(A[0] * (1 + f), A[1] * (1 + f), A[2] * (1 + f)); }
export function hslToHex(h, s, l) {
  s /= 100; l /= 100; const k = n => (n + h / 30) % 12; const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return rgbToHex(255 * f(0), 255 * f(8), 255 * f(4));
}
export function hexToHsl(hex) {
  let [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
  if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [h, s * 100, l * 100];
}
export function varyHex(hex, seed, amt = 10) {
  const [h, s, l] = hexToHsl(hex); const r = mulberry32(seed);
  return hslToHex((h + (r() - 0.5) * amt * 2 + 360) % 360, clamp(s + (r() - 0.5) * amt, 10, 95), clamp(l + (r() - 0.5) * amt, 15, 85));
}

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function fmtNum(n, dec = 0) {
  if (n === undefined || n === null || isNaN(n)) return '0';
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (a >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return dec ? n.toFixed(dec) : Math.round(n).toLocaleString('en-US');
}
export const sign = n => (n >= 0 ? '+' : '') + (Math.abs(n) < 10 && n % 1 !== 0 ? n.toFixed(1) : Math.round(n));
export const roman = n => { const m = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']]; let s = ''; for (const [v, r] of m) while (n >= v) { s += r; n -= v; } return s; };
export const ordinal = n => n + (['th','st','nd','rd'][((n % 100) - 20) % 10] || ['th','st','nd','rd'][n % 100] || 'th');
export const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
