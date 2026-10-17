// Map generation: rasterizes coastlines, assigns pixels to provinces with organic borders,
// builds adjacency (land + sea lanes), terrain elevation and shading.
import { PROJ, LAND, SEAS, WASTES, DEJURE, TERRAIN, STRAITS, slug } from './data/geography.js';
import { makeNoise, varyHex, hash, clamp } from './util.js';

export const W = 2000;
export const S = W / ((PROJ.lon1 - PROJ.lon0) * PROJ.kx);
export const H = Math.ceil((PROJ.lat1 - PROJ.lat0) * S);
export const project = (lon, lat) => [(lon - PROJ.lon0) * PROJ.kx * S, (PROJ.lat1 - lat) * S];

const ELEV = { plains: [0.12, 0.05], farmland: [0.1, 0.03], hills: [0.38, 0.14], mountains: [0.78, 0.32], forest: [0.2, 0.07], taiga: [0.22, 0.07], wetlands: [0.04, 0.02], steppe: [0.12, 0.04], drylands: [0.25, 0.1], desert: [0.2, 0.12], floodplains: [0.05, 0.02], waste: [0.45, 0.25] };

// Static title hierarchy & province list from the de jure data.
export function buildStatic() {
  const provinces = [];
  const dejure = {};
  for (const [eid, e] of Object.entries(DEJURE)) {
    dejure[eid] = { id: eid, name: e.name, rank: 4, parent: null, color: e.color, children: [], counties: [] };
    for (const [kid, k] of Object.entries(e.kingdoms)) {
      dejure[kid] = { id: kid, name: k.name, rank: 3, parent: eid, color: k.color, children: [], counties: [] };
      dejure[eid].children.push(kid);
      let di = 0;
      for (const [did, d] of Object.entries(k.duchies)) {
        const dcol = varyHex(k.color, hash(did), 9);
        dejure[did] = { id: did, name: d.name, rank: 2, parent: kid, color: dcol, children: [], counties: [], cul: d.cul, fai: d.fai };
        dejure[kid].children.push(did);
        for (const c of d.counties) {
          const [name, lon, lat, terrain] = c;
          const key = 'c_' + slug(name);
          const id = provinces.length;
          provinces.push({ id, key, name, lon, lat, terrain, duchy: did, kingdom: kid, empire: eid, cul: d.cul, fai: d.fai });
          dejure[key] = { id: key, name, rank: 1, parent: did, color: varyHex(dcol, hash(key), 6), children: [], counties: [id], prov: id };
          dejure[did].children.push(key);
          dejure[did].counties.push(id); dejure[kid].counties.push(id); dejure[eid].counties.push(id);
        }
        di++;
      }
    }
  }
  const byKey = {}; const byName = {};
  provinces.forEach(p => { byKey[p.key] = p.id; byName[p.name] = p.id; });
  return { provinces, dejure, byKey, byName };
}

export function buildWorld(onProgress = () => {}) {
  const t0 = performance.now();
  const st = buildStatic();
  const { provinces } = st;
  const N = W * H;

  // 1. Rasterize land mask
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const cx = cv.getContext('2d');
  cx.fillStyle = '#000'; cx.fillRect(0, 0, W, H);
  const poly = (pts, col) => { cx.fillStyle = col; cx.beginPath(); pts.forEach(([lo, la], i) => { const [x, y] = project(lo, la); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.closePath(); cx.fill(); };
  LAND.forEach(p => poly(p, '#fff'));
  SEAS.forEach(p => poly(p, '#000'));
  const maskData = cx.getImageData(0, 0, W, H).data;
  const rawMask = new Uint8Array(N);
  for (let i = 0; i < N; i++) rawMask[i] = maskData[i * 4] > 127 ? 1 : 0;
  onProgress(0.15, 'Tracing the coastlines');

  // 2. Low-res warp fields
  const nA = makeNoise(1337), nB = makeNoise(7331), nC = makeNoise(4242), nD = makeNoise(9898);
  const STEP = 4, gw = Math.ceil(W / STEP) + 2, gh = Math.ceil(H / STEP) + 2;
  const cwx = new Float32Array(gw * gh), cwy = new Float32Array(gw * gh), bwx = new Float32Array(gw * gh), bwy = new Float32Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
    const x = gx * STEP, y = gy * STEP, k = gy * gw + gx;
    cwx[k] = nA.fbm(x / 55, y / 55, 5) * 13; cwy[k] = nB.fbm(x / 55, y / 55, 5) * 13;
    bwx[k] = nC.fbm(x / 80, y / 80, 4) * 26; bwy[k] = nD.fbm(x / 80, y / 80, 4) * 26;
  }
  const samp = (arr, x, y) => {
    const fx = x / STEP, fy = y / STEP, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, k = iy * gw + ix;
    return (arr[k] * (1 - tx) + arr[k + 1] * tx) * (1 - ty) + (arr[k + gw] * (1 - tx) + arr[k + gw + 1] * tx) * ty;
  };
  onProgress(0.3, 'Raising mountains');

  // 3. Seeds & buckets
  const seeds = provinces.map(p => { const [x, y] = project(p.lon, p.lat); return { x, y, id: p.id }; });
  WASTES.forEach(([lo, la]) => { const [x, y] = project(lo, la); seeds.push({ x, y, id: -2 }); });
  const CELL = 50, cw = Math.ceil(W / CELL) + 1, ch = Math.ceil(H / CELL) + 1;
  const buckets = Array.from({ length: cw * ch }, () => []);
  seeds.forEach((s, i) => { const bx = clamp(Math.floor(s.x / CELL), 0, cw - 1), by = clamp(Math.floor(s.y / CELL), 0, ch - 1); buckets[by * cw + bx].push(i); });

  const prov = new Int16Array(N).fill(-1);
  const MAXD2 = 155 * 155;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const mx = clamp(Math.round(x + samp(cwx, x, y)), 0, W - 1), my = clamp(Math.round(y + samp(cwy, x, y)), 0, H - 1);
      if (!rawMask[my * W + mx]) continue;
      const wx = x + samp(bwx, x, y), wy = y + samp(bwy, x, y);
      const bx = Math.floor(wx / CELL), by = Math.floor(wy / CELL);
      let best = -1, bd = 1e12;
      for (let r = 0; r <= 4; r++) {
        for (let yy = by - r; yy <= by + r; yy++) {
          if (yy < 0 || yy >= ch) continue;
          for (let xx = bx - r; xx <= bx + r; xx++) {
            if (xx < 0 || xx >= cw) continue;
            if (r > 0 && yy !== by - r && yy !== by + r && xx !== bx - r && xx !== bx + r) continue;
            const b = buckets[yy * cw + xx];
            for (let k = 0; k < b.length; k++) { const s = seeds[b[k]]; const dx = s.x - wx, dy = s.y - wy; const d = dx * dx + dy * dy; if (d < bd) { bd = d; best = b[k]; } }
          }
        }
        if (best >= 0 && r >= 2 && bd < (r * CELL) * (r * CELL)) break;
      }
      prov[i] = best < 0 || bd > MAXD2 ? -2 : seeds[best].id;
    }
  }
  onProgress(0.55, 'Drawing the borders of kings');

  // 4. Province stats, adjacency
  const P = provinces.length;
  const area = new Int32Array(P), sx = new Float64Array(P), sy = new Float64Array(P);
  const minx = new Int32Array(P).fill(W), miny = new Int32Array(P).fill(H), maxx = new Int32Array(P), maxy = new Int32Array(P);
  const nb = Array.from({ length: P }, () => new Set());
  const coastal = new Uint8Array(P);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = prov[i];
    if (p < 0) continue;
    area[p]++; sx[p] += x; sy[p] += y;
    if (x < minx[p]) minx[p] = x; if (x > maxx[p]) maxx[p] = x; if (y < miny[p]) miny[p] = y; if (y > maxy[p]) maxy[p] = y;
    if (x + 1 < W) { const q = prov[i + 1]; if (q >= 0 && q !== p) { nb[p].add(q); nb[q].add(p); } else if (q === -1) coastal[p] = 1; }
    if (y + 1 < H) { const q = prov[i + W]; if (q >= 0 && q !== p) { nb[p].add(q); nb[q].add(p); } else if (q === -1) coastal[p] = 1; }
    if (x > 0 && prov[i - 1] === -1) coastal[p] = 1;
    if (y > 0 && prov[i - W] === -1) coastal[p] = 1;
  }
  provinces.forEach(p => {
    p.area = area[p.id];
    p.cx = area[p.id] ? sx[p.id] / area[p.id] : project(p.lon, p.lat)[0];
    p.cy = area[p.id] ? sy[p.id] / area[p.id] : project(p.lon, p.lat)[1];
    p.bbox = [minx[p.id], miny[p.id], maxx[p.id], maxy[p.id]];
    p.coastal = !!coastal[p.id];
    const [px, py] = project(p.lon, p.lat); p.sx = px; p.sy = py;
  });
  // anchor = province pixel closest to centroid (for labels/markers), and seat (closest to seed)
  const bestA = new Float64Array(P).fill(1e18), bestS = new Float64Array(P).fill(1e18);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = prov[y * W + x]; if (p < 0) continue; const pr = provinces[p];
    const da = (x - pr.cx) ** 2 + (y - pr.cy) ** 2; if (da < bestA[p]) { bestA[p] = da; pr.ax = x; pr.ay = y; }
    const ds = (x - pr.sx) ** 2 + (y - pr.sy) ** 2; if (ds < bestS[p]) { bestS[p] = ds; pr.hx = x; pr.hy = y; }
  }
  provinces.forEach(p => { if (p.ax === undefined) { p.ax = p.cx; p.ay = p.cy; p.hx = p.sx; p.hy = p.sy; } p.neighbors = [...nb[p.id]]; });
  STRAITS.forEach(([a, b]) => { const A = st.byName[a], B = st.byName[b]; if (A !== undefined && B !== undefined && !nb[A].has(B)) { provinces[A].neighbors.push(B); provinces[B].neighbors.push(A); } });
  onProgress(0.65, 'Charting the seas');

  // 5. Sea components & distance fields
  const seaComp = new Int32Array(N).fill(-1);
  const queue = new Int32Array(N);
  let comps = 0;
  for (let i = 0; i < N; i++) {
    if (prov[i] !== -1 || seaComp[i] >= 0) continue;
    let qh = 0, qt = 0; queue[qt++] = i; seaComp[i] = comps;
    while (qh < qt) {
      const j = queue[qh++]; const x = j % W, y = (j / W) | 0;
      if (x > 0 && prov[j - 1] === -1 && seaComp[j - 1] < 0) { seaComp[j - 1] = comps; queue[qt++] = j - 1; }
      if (x < W - 1 && prov[j + 1] === -1 && seaComp[j + 1] < 0) { seaComp[j + 1] = comps; queue[qt++] = j + 1; }
      if (y > 0 && prov[j - W] === -1 && seaComp[j - W] < 0) { seaComp[j - W] = comps; queue[qt++] = j - W; }
      if (y < H - 1 && prov[j + W] === -1 && seaComp[j + W] < 0) { seaComp[j + W] = comps; queue[qt++] = j + W; }
    }
    comps++;
  }
  // distance from coast (sea side and land side)
  const seaDist = new Uint8Array(N).fill(255), landDist = new Uint8Array(N).fill(255);
  {
    let qh = 0, qt = 0;
    for (let i = 0; i < N; i++) {
      const x = i % W; const isSea = prov[i] === -1;
      const n1 = x > 0 ? prov[i - 1] : prov[i], n2 = x < W - 1 ? prov[i + 1] : prov[i], n3 = i >= W ? prov[i - W] : prov[i], n4 = i < N - W ? prov[i + W] : prov[i];
      const edge = isSea ? (n1 !== -1 || n2 !== -1 || n3 !== -1 || n4 !== -1) : (n1 === -1 || n2 === -1 || n3 === -1 || n4 === -1);
      if (edge) { if (isSea) seaDist[i] = 0; else landDist[i] = 0; queue[qt++] = i; }
    }
    while (qh < qt) {
      const j = queue[qh++]; const isSea = prov[j] === -1; const arr = isSea ? seaDist : landDist; const d = arr[j];
      if (d >= 254) continue;
      const x = j % W;
      const ns = [x > 0 ? j - 1 : -1, x < W - 1 ? j + 1 : -1, j - W, j + W];
      for (const k of ns) { if (k < 0 || k >= N) continue; if ((prov[k] === -1) !== isSea) continue; if (arr[k] > d + 1) { arr[k] = d + 1; queue[qt++] = k; } }
    }
  }
  // ports: for each coastal province and sea component, the coastal pixel nearest the seat
  const ports = Array.from({ length: P }, () => ({}));
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, p = prov[i]; if (p < 0) continue;
    for (const k of [i - 1, i + 1, i - W, i + W]) {
      if (prov[k] !== -1) continue; const c = seaComp[k]; const pr = provinces[p];
      const d = (x - pr.hx) ** 2 + (y - pr.hy) ** 2; const cur = ports[p][c];
      if (!cur || d < cur.d) ports[p][c] = { x, y, d };
    }
  }
  // sea lanes
  const seaLinks = Array.from({ length: P }, () => []);
  const coastalIds = provinces.filter(p => p.coastal).map(p => p.id);
  for (let a = 0; a < coastalIds.length; a++) for (let b = a + 1; b < coastalIds.length; b++) {
    const A = coastalIds[a], B = coastalIds[b];
    if (provinces[A].neighbors.includes(B)) continue;
    for (const c in ports[A]) {
      const pb = ports[B][c]; if (!pb) continue; const pa = ports[A][c];
      const dist = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (dist > 230) continue;
      let land = 0; const SAMPLES = 40;
      for (let s = 3; s < SAMPLES - 3; s++) { const t = s / SAMPLES; const xi = Math.round(pa.x + (pb.x - pa.x) * t), yi = Math.round(pa.y + (pb.y - pa.y) * t); if (prov[yi * W + xi] !== -1) land++; }
      if (land > 2) continue;
      seaLinks[A].push({ to: B, d: dist, a: [pa.x, pa.y], b: [pb.x, pb.y] }); seaLinks[B].push({ to: A, d: dist, a: [pb.x, pb.y], b: [pa.x, pa.y] });
      break;
    }
  }
  provinces.forEach(p => { p.sea = seaLinks[p.id]; });
  onProgress(0.8, 'Shading the highlands');

  // 6. Elevation (low-res blurred) + hillshade
  const EG = 6, ew = Math.ceil(W / EG) + 2, eh = Math.ceil(H / EG) + 2;
  let elev = new Float32Array(ew * eh);
  for (let gy = 0; gy < eh; gy++) for (let gx = 0; gx < ew; gx++) {
    const x = Math.min(W - 1, gx * EG), y = Math.min(H - 1, gy * EG), p = prov[y * W + x];
    elev[gy * ew + gx] = p === -1 ? -0.2 : p === -2 ? ELEV.waste[0] : ELEV[provinces[p].terrain][0];
  }
  for (let pass = 0; pass < 3; pass++) {
    const nx = new Float32Array(ew * eh);
    for (let gy = 1; gy < eh - 1; gy++) for (let gx = 1; gx < ew - 1; gx++) {
      const k = gy * ew + gx; nx[k] = (elev[k] * 4 + elev[k - 1] + elev[k + 1] + elev[k - ew] + elev[k + ew]) / 8;
    }
    elev = nx;
  }
  const nE = makeNoise(555), nR = makeNoise(777);
  const height = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, p = prov[i];
    const fx = x / EG, fy = y / EG, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy, k = iy * ew + ix;
    const base = (elev[k] * (1 - tx) + elev[k + 1] * tx) * (1 - ty) + (elev[k + ew] * (1 - tx) + elev[k + ew + 1] * tx) * ty;
    let rough = 0.05;
    if (p >= 0) rough = ELEV[provinces[p].terrain][1]; else if (p === -2) rough = ELEV.waste[1]; else rough = 0;
    const ridge = 1 - Math.abs(nR.fbm(x / 22, y / 22, 4));
    height[i] = base + (nE.fbm(x / 40, y / 40, 5) * 0.6 + ridge * ridge * 0.5) * rough * (1 + base);
  }
  const shade = new Int8Array(N);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x; if (prov[i] === -1) continue;
    const dx = height[i + 1] - height[i - 1], dy = height[i + W] - height[i - W];
    shade[i] = clamp(Math.round((-dx - dy) * 420), -127, 127);
  }
  // elevation quantized for styles (0..255)
  const elevQ = new Uint8Array(N);
  for (let i = 0; i < N; i++) elevQ[i] = clamp(Math.round(height[i] * 230 + 20), 0, 255);
  // paper grain
  const grain = new Uint8Array(N);
  const nG = makeNoise(31337);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const v = clamp(Math.round(128 + nG.fbm(x / 9, y / 9, 3) * 60 + nG(x / 120, y / 120) * 50), 0, 255);
    const i = y * W + x; grain[i] = v; if (x + 1 < W) grain[i + 1] = v; if (y + 1 < H) { grain[i + W] = v; if (x + 1 < W) grain[i + W + 1] = v; }
  }
  // border pixel list (province borders)
  const borderIdx = [];
  for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
    const i = y * W + x, p = prov[i]; if (p < 0) continue;
    const r = prov[i + 1], d = prov[i + W];
    if ((r >= 0 && r !== p) || (d >= 0 && d !== p)) borderIdx.push(i);
  }
  onProgress(1, 'The world is ready');
  console.log(`World built in ${(performance.now() - t0).toFixed(0)}ms: ${P} provinces, ${comps} seas`);
  return { W, H, N, prov, seaComp, seaDist, landDist, shade, elev: elevQ, grain, borderIdx: Int32Array.from(borderIdx), ...st };
}

// Pathfinding over land neighbors + sea lanes (A*). Returns array of province ids (excluding start) or null.
export function findPath(world, from, to, opts = {}) {
  if (from === to) return [];
  const provs = world.provinces;
  const open = new Map(); const g = new Map([[from, 0]]); const came = new Map();
  const h = id => Math.hypot(provs[id].ax - provs[to].ax, provs[id].ay - provs[to].ay);
  open.set(from, h(from));
  let iter = 0;
  while (open.size && iter++ < 4000) {
    let cur = -1, bf = Infinity; for (const [k, f] of open) if (f < bf) { bf = f; cur = k; }
    if (cur === to) { const path = []; let c = to; while (c !== from) { path.push(c); c = came.get(c); } return path.reverse(); }
    open.delete(cur);
    const pc = provs[cur];
    const edges = pc.neighbors.map(n => [n, Math.hypot(provs[n].ax - pc.ax, provs[n].ay - pc.ay) / (TERRAIN[provs[n].terrain]?.move || 1)]);
    if (!opts.noSea) pc.sea.forEach(l => edges.push([l.to, l.d * 1.35 + 30]));
    for (const [n, c] of edges) {
      if (opts.block && opts.block(n) && n !== to) continue;
      const ng = g.get(cur) + c;
      if (ng < (g.get(n) ?? Infinity)) { g.set(n, ng); came.set(n, cur); open.set(n, ng + h(n)); }
    }
  }
  return null;
}

export function edgeInfo(world, a, b) {
  const pa = world.provinces[a];
  const sea = pa.sea.find(l => l.to === b);
  if (sea && !pa.neighbors.includes(b)) return { sea: true, len: sea.d * 1.2 + 25, link: sea };
  const pb = world.provinces[b];
  return { sea: false, len: Math.hypot(pb.ax - pa.ax, pb.ay - pa.ay) };
}
