// Builds a new game state from a bookmark.
import { G, markDirty } from '../state.js';
import { BOOKMARKS, SHATTERED, EXTRA_CULTURES } from '../data/bookmarks.js';
import { CULTURES, FAITHS, GROUPS } from '../data/cultures.js';
import { INNOVATIONS, WONDERS, MAA, TRAITS } from '../data/traits.js';
import { ch, T, idx, createChar, createDynasty, findOrCreateDynasty, giveTitle, setLiege, marry, randomDynName, rankOf, culture, defaultGov, defaultLaws, stat, domainLimit, addTrait, isAdult, age, createArtifact, invalidateMods } from './core.js';
import { autoCouncil } from './life.js';
import { declareWar, raiseArmy } from './war.js';
import { levyMax, monthlyEconomy } from './economy.js';
import { seedRng, rand, randi, chance, pick, shuffle, dateToDay, hash, clamp } from '../util.js';

Object.assign(CULTURES, EXTRA_CULTURES);

const BIG_CITIES = { Constantinople: 30, Rome: 14, Baghdad: 28, Cairo: 26, 'Córdoba': 22, Paris: 10, Venice: 14, Damascus: 16, Alexandria: 18, Antioch: 12, Kiev: 8, Milan: 10, Seville: 12, Toledo: 10, Aleppo: 12, Jerusalem: 10, Tabriz: 10, Palermo: 12, London: 8, Cologne: 8, Kairouan: 12, Fez: 10, Thessalonica: 12, Genoa: 8, Florence: 8, Naples: 8, Novgorod: 6, Smyrna: 8, Granada: 8, Mosul: 10, Hamadan: 8, Bruges: 6 };
const HEAD_TITLES = { catholic: ['k_papacy', 'Papacy'], nicene: ['k_papacy', 'Papacy'], orthodox: ['k_patriarchate', 'Ecumenical Patriarchate'], sunni: ['k_caliphate', 'Caliphate'], shia: ['k_imamate', 'Imamate'], zoroastrian: ['k_mobad', 'Mobadan Mobad'] };
const HEAD_REALM = { k_imamate: ['e_fatimid'], k_caliphate: ['k_caliphate', 'e_abbasid'], k_papacy: ['k_papacy'], k_patriarchate: [], k_mobad: ['e_persia'] };

export function allBookmarks() { return [...BOOKMARKS, SHATTERED]; }
function parseR(str) { const [name, dyn, a, x, y] = str.split('|'); const female = x === 'f' || y === 'f'; const traits = (x === 'f' ? y : x) || ''; return { name, dyn, age: +a, traits: traits.split(/\s+/).filter(t => TRAITS[t]), female }; }
function parseKid(str) { const [name, a, f, traits] = str.split('|'); return { name, age: +a, female: f === 'f', traits: (traits || '').split(/\s+/).filter(t => TRAITS[t]) }; }
function parseSpouse(str) { const [name, dyn, a, f, traits] = str.split('|'); return { name, dyn, age: +a, female: f === 'f', traits: (traits || '').split(/\s+/).filter(t => TRAITS[t]) }; }

export function newGame(bmId, seed = Date.now() % 1e9) {
  const bm = allBookmarks().find(b => b.id === bmId) || BOOKMARKS[3];
  seedRng(seed);
  const W = G.world;
  const s = G.s = {
    version: 1, bookmark: bm.id, seed, day: dateToDay(bm.year, bm.month, bm.day), startDay: dateToDay(bm.year, bm.month, bm.day), era: bm.era,
    player: 0, chars: {}, titles: {}, provs: [], dyns: {}, wars: [], armies: [], battles: [], schemes: [], truces: [], alliances: [], log: [], history: [], artifacts: {},
    cultures: {}, faiths: {}, customCultures: {}, customFaiths: {}, nextId: 1, flags: { autoArmy: false }, activities: [], letters: [], eventQueue: [], chronicle: [], llm: { rulers: [], diaries: {}, pending: 0 }, struggle: null, generation: 1, crusades: 0, stats: { battlesWon: 0, battlesLost: 0 },
  };
  G.dirty = true;
  // titles
  for (const t of Object.values(W.dejure)) s.titles[t.id] = { id: t.id, name: t.name, rank: t.rank, parent: t.parent, color: t.color, counties: t.counties, prov: t.prov, holder: 0, history: [] };
  for (const [id, def] of Object.entries(bm.titles || {})) {
    if (s.titles[id]) { s.titles[id].realmName = def.name; continue; }
    s.titles[id] = { id, name: def.name.replace(/^(Kingdom|Empire|Duchy|County|Republic|Sultanate|Emirate|Principality|Grand Principality|Khanate|Taifa) of (the )?/, ''), realmName: def.name, rank: def.rank, parent: null, color: '#888', counties: [], holder: 0, custom: true, history: [] };
  }
  // provinces
  const lookup = (map, p) => map?.[p.key] ?? map?.[p.duchy] ?? map?.[p.kingdom] ?? map?.[p.empire];
  const preSchism = bm.year < 1054, preIslam = bm.year < 632;
  W.provinces.forEach(p => {
    let cul = lookup(bm.cul, p) || p.cul, fai = lookup(bm.fai, p) || p.fai;
    if (preSchism && (fai === 'catholic' || fai === 'orthodox')) fai = 'nicene';
    if (preIslam && (fai === 'sunni' || fai === 'shia')) fai = p.empire === 'e_persia' ? 'zoroastrian' : 'nicene';
    if (bm.year >= 1300 && cul === 'norman') cul = 'french';
    const lo = [3, 5, 8, 12][bm.era] ?? 8, hi = lo + 7;
    const dev = randi(lo, hi) + (BIG_CITIES[p.name] || 0) * (0.6 + bm.era * 0.15);
    const wonders = WONDERS.filter(w => w.county === p.name && bm.year >= w.from && bm.year < w.to);
    s.provs.push({ dev, cul, fai, b: {}, ctrl: 0, siege: 0, build: null, wonders: wonders.map(w => w.name), wonderFort: wonders.reduce((a, w) => a + (w.mods.fort || 0), 0) });
  });
  if (bm.shattered) scramble();
  const P = s.provs;
  // starting buildings by era
  W.provinces.forEach(p => { const pr = P[p.id]; if (bm.era >= 1 && chance(0.4)) pr.b.walls = 1; if (bm.era >= 2 && chance(0.4)) pr.b.farms = 1; if (pr.dev > 20 && chance(0.6)) pr.b.market = 1; if (bm.era >= 2 && chance(0.25)) pr.b.temple = 1; });

  // assign counties to realms
  const owner = new Array(W.provinces.length).fill(-1);
  const expand = id => { if (id.startsWith('c_')) { const pid = W.byKey[id]; return pid === undefined ? [] : [pid]; } return s.titles[id]?.counties || []; };
  bm.realms.forEach((r, ri) => {
    for (const tok of r.holdings.split(/\s+/).filter(Boolean)) {
      const neg = tok.startsWith('-'); const ids = expand(neg ? tok.slice(1) : tok);
      for (const pid of ids) { if (neg) { if (owner[pid] === ri) owner[pid] = -1; } else owner[pid] = ri; }
    }
  });
  // create rulers
  const rulerOf = {};
  bm.realms.forEach((r, ri) => {
    const counties = W.provinces.filter(p => owner[p.id] === ri).map(p => p.id);
    const t = s.titles[r.title];
    if (!t) { console.warn('missing title', r.title); return; }
    t.color = r.color; t.realmName = r.name;
    const R = parseR(r.ruler);
    const capName = r.capital && W.byName[r.capital] !== undefined && counties.includes(W.byName[r.capital]) ? W.byName[r.capital] : counties[0];
    const cul = r.cul || (capName !== undefined ? P[capName].cul : 'french');
    const fai = r.fai || (capName !== undefined ? P[capName].fai : 'catholic');
    const dyn = findOrCreateDynasty(R.dyn, cul);
    const c = createChar({ name: R.name, female: R.female, age: R.age, cul, fai, dyn: dyn.id, traits: R.traits });
    c.gov = r.gov || defaultGov(c);
    c.laws = defaultLaws(c); if (r.law) c.laws.succ = r.law;
    if (r.feat) { c.featured = r.feat; }
    giveTitle(r.title, c.id, { how: 'founded' });
    if (capName !== undefined) c.capital = capName;
    dyn.head = dyn.head || c.id;
    rulerOf[r.title] = c;
    r._counties = counties; r._cap = capName; r._char = c;
    // family
    if (r.spouse) { const sp = parseSpouse(r.spouse); const sc = createChar({ name: sp.name, female: sp.female, age: sp.age, cul, fai, dyn: findOrCreateDynasty(sp.dyn, cul).id, traits: sp.traits }); marry(c, sc); }
    else if (R.age >= 20 && chance(0.8) && c.gov !== 'theocracy') { const sc = createChar({ female: !c.f, age: clamp(R.age + (c.f ? 3 : -randi(2, 12)), 16, 70), cul, fai, dyn: createDynasty(randomDynName(cul), cul).id }); marry(c, sc); }
    const sp = ch(c.spouse);
    const kids = (r.kids || []).map(parseKid).filter(k => k.age >= 0);
    if (!r.kids && sp && R.age >= 22) { const n = randi(0, Math.min(5, Math.floor((Math.min(R.age, age(sp) + 10) - 18) / 4))); for (let i = 0; i < n; i++) kids.push({ name: null, age: randi(0, Math.max(0, Math.min(R.age, age(sp)) - 18)), female: chance(0.5), traits: [] }); }
    for (const k of kids) {
      const kc = createChar({ name: k.name || undefined, female: k.female, age: k.age, cul, fai, dyn: c.dyn, father: c.f ? (sp?.id || 0) : c.id, mother: c.f ? c.id : (sp?.id || 0), court: c.id, traits: k.traits });
      if (rankOf(c) >= 4 && !kc.traits.includes('born_purple')) addTrait(kc, 'born_purple');
    }
    if (r.sibs) {
      const fa = createChar({ female: false, age: R.age + 28, cul, fai, dyn: c.dyn, noRandomTraits: true }); fa.dead = s.day - randi(200, 3000); fa.cause = 'illness';
      c.father = fa.id; fa.kids.push(c.id);
      for (const sstr of r.sibs) { const k = parseKid(sstr); createChar({ name: k.name, female: k.female, age: k.age, cul, fai, dyn: c.dyn, father: fa.id, court: c.id, traits: k.traits }); }
    }
  });
  // vassal links and family links between realms
  bm.realms.forEach(r => {
    const c = r._char; if (!c) return;
    if (r.liege && rulerOf[r.liege]) setLiege(c, rulerOf[r.liege].id);
    if (r.father && rulerOf[r.father]) { const f = rulerOf[r.father]; c.father = f.f ? 0 : f.id; if (!c.father) c.mother = f.id; else if (f.spouse) c.mother = f.spouse; f.kids.push(c.id); const m = ch(c.mother); if (m && m !== f) m.kids.push(c.id); c.dyn = f.dyn; }
  });
  // distribute counties
  bm.realms.forEach(r => { if (r._char) distribute(r._char, r._counties, r._cap); });
  // unassigned counties -> independent petty realms
  const byDuchy = {};
  W.provinces.forEach(p => { if (owner[p.id] === -1) (byDuchy[p.duchy] ||= []).push(p.id); });
  for (const [did, pids] of Object.entries(byDuchy)) {
    const groups = splitConnected(pids);
    for (const g of groups) {
      const cul = P[g[0]].cul, fai = P[g[0]].fai;
      const dyn = createDynasty(randomDynName(cul), cul);
      const c = createChar({ cul, fai, dyn: dyn.id, age: randi(20, 55), female: chance(0.06) });
      c.gov = defaultGov(c); c.laws = defaultLaws(c);
      const full = g.length === s.titles[did].counties.length && g.length >= 2;
      if (full) giveTitle(did, c.id, { how: 'founded' });
      c.capital = g[0]; dyn.head = c.id;
      distribute(c, g, g[0]);
      if (isAdult(c) && chance(0.75)) { const sp = createChar({ female: !c.f, age: clamp(age(c) - randi(0, 10), 16, 60), cul, fai, dyn: createDynasty(randomDynName(cul), cul).id }); marry(c, sp); const n = randi(0, 4); for (let i = 0; i < n; i++) createChar({ female: chance(0.5), age: randi(0, Math.max(0, age(sp) - 17)), cul, fai, dyn: c.dyn, father: c.f ? sp.id : c.id, mother: c.f ? c.id : sp.id, court: c.id }); }
    }
  }
  // faith heads
  const present = new Set(P.map(p => p.fai));
  for (const [fid, [tid, tname]] of Object.entries(HEAD_TITLES)) {
    if (!present.has(fid)) continue;
    if (fid === 'catholic' && present.has('nicene')) continue;
    if (!s.titles[tid]) s.titles[tid] = { id: tid, name: tname, realmName: tname, rank: 3, parent: null, color: FAITHS[fid].color, counties: [], holder: 0, custom: true, history: [] };
    const t = s.titles[tid]; t.faithHead = t.faithHead || fid;
    if (t.holder) continue;
    const via = (HEAD_REALM[tid] || []).map(x => rulerOf[x]).find(Boolean);
    if (via && via.fai === fid) { giveTitle(tid, via.id, { how: 'founded' }); continue; }
    const site = FAITHS[fid].holy.map(n => W.byName[n]).find(x => x !== undefined);
    const cul = site !== undefined ? P[site].cul : 'italian';
    const head = createChar({ cul, fai: fid, age: randi(50, 70), traits: ['zealous'], female: false });
    head.gov = 'theocracy'; head.laws = { succ: 'elective', gender: 'agnatic', crown: 1 };
    giveTitle(tid, head.id, { how: 'founded' });
    head.capital = null; head.seat = site;
  }
  for (const t of Object.values(s.titles)) if (t.faithHead === undefined && Object.values(HEAD_TITLES).some(([id]) => id === t.id)) t.faithHead = Object.entries(HEAD_TITLES).find(([, [id]]) => id === t.id)[0];
  // dynasty renown, gold, prestige, armies, courts
  const I = idx();
  for (const id of I.rulers) {
    const c = ch(id); const r = rankOf(c);
    c.gold = Math.round([0, 30, 100, 280, 600][r] * (0.6 + rand() * 0.8));
    c.prestige = [0, 80, 250, 600, 1100][r] + randi(0, 200); c.fame = c.prestige * 2;
    c.piety = randi(40, 300) + (c.gov === 'theocracy' ? 600 : 0); c.devotion = c.piety;
    c.amenities = { food: r >= 3 ? 2 : 1, servants: r >= 3 ? 2 : 1, fashion: r >= 4 ? 2 : 1, lodging: r >= 4 ? 2 : 1 };
    const cm = culture(c.cul).maa;
    const nReg = [0, 1, 2, 4, 7][r];
    c.maa = {};
    if (nReg) {
      c.maa[MAA[cm] ? cm : 'heavy_infantry'] = Math.ceil(nReg / 2);
      const second = pick(['archers', 'heavy_infantry', 'light_cavalry', 'pikemen']);
      if (nReg > 1) c.maa[second] = (c.maa[second] || 0) + Math.floor(nReg / 2);
    }
    c.maaCur = {}; for (const [t, n] of Object.entries(c.maa)) c.maaCur[t] = n * MAA[t].size;
    const d = s.dyns[c.dyn]; if (d) d.renown += r * r * 60;
    // courtiers
    for (let k = 0; k < r * 2; k++) { const cul = chance(0.75) ? c.cul : P[I.domain.get(id)?.[0] ?? 0]?.cul || c.cul; createChar({ cul, fai: c.fai, age: randi(18, 50), female: chance(0.3), court: id, dyn: chance(0.5) ? createDynasty(randomDynName(cul), cul).id : 0 }); }
  }
  // cultures and innovations
  for (const cid of new Set(P.map(p => p.cul))) {
    const inn = {}; for (const i of INNOVATIONS) inn[i.id] = i.era < bm.era ? 100 : i.era === bm.era ? (chance(0.4) ? 100 : randi(0, 60)) : 0;
    s.cultures[cid] = { inn, era: bm.era };
  }
  for (const f of new Set(P.map(p => p.fai))) s.faiths[f] = { fervor: randi(40, 70) };
  // struggle
  if (bm.year >= 711 && bm.year < 1492) {
    const faiths = new Set(W.provinces.filter(p => p.empire === 'e_spain').map(p => P[p.id].fai));
    if (faiths.size > 1) s.struggle = { name: 'The Iberian Struggle', region: 'e_spain', phase: 'opportunity', prog: 30, faiths: [...faiths], catalysts: [] };
  }
  // famous artifacts
  seedArtifacts(bm, rulerOf);
  markDirty();
  idx();
  // economy warmup so levies/incomes exist
  for (const id of idx().rulers) autoCouncil(ch(id));
  monthlyEconomy(); monthlyEconomy();
  for (const id of idx().rulers) { const c = ch(id); c.levyCur = c.levyMax || 0; c.gold = Math.max(c.gold, 0); }
  // bookmark wars and armies
  for (const w of bm.wars || []) {
    const a = rulerOf[w.att], d = rulerOf[w.def]; if (!a || !d) continue;
    if (w.cb === 'claim') { a.claims.push(w.target); }
    declareWar(a, d, { cb: w.cb, target: w.target }, { free: true });
  }
  for (const ar of bm.armies || []) {
    const o = rulerOf[ar.owner]; if (!o) continue; const loc = W.byName[ar.at]; if (loc === undefined) continue;
    const army = { id: s.nextId++, owner: o.id, men: ar.men, maa: {}, loc, path: [], prog: 0, cmdr: o.id, ready: s.day, raid: false, loot: 0, siege: 0, knights: 0, start: ar.men };
    for (const [t, n] of Object.entries(ar.maa || {})) if (MAA[t]) army.maa[t] = n * MAA[t].size;
    s.armies.push(army);
  }
  s.history.push(snapshot());
  invalidateMods();
  return s;
}

function scramble() {
  const s = G.s, W = G.world;
  const duchies = Object.values(W.dejure).filter(t => t.rank === 2);
  const cults = shuffle(duchies.map(d => d.cul));
  const faithPool = ['catholic', 'orthodox', 'sunni', 'shia', 'norse_pagan', 'slavic_pagan', 'tengri', 'baltic_pagan', 'zoroastrian', 'jewish', 'hellenic', 'finnic_pagan', 'germanic_pagan'];
  duchies.forEach((d, i) => { const f = pick(faithPool); for (const pid of d.counties) { s.provs[pid].cul = cults[i]; s.provs[pid].fai = f; } });
}

function splitConnected(pids) {
  const set = new Set(pids), seen = new Set(), out = [];
  for (const p of pids) {
    if (seen.has(p)) continue; const g = []; const st = [p]; seen.add(p);
    while (st.length) { const x = st.pop(); g.push(x); for (const n of G.world.provinces[x].neighbors) if (set.has(n) && !seen.has(n)) { seen.add(n); st.push(n); } }
    out.push(g);
  }
  return out;
}

function vassalGov(ruler) { return ruler.gov === 'imperial' || ruler.gov === 'republic' ? 'feudal' : ruler.gov; }
function makeVassal(ruler, pids, opts = {}) {
  const P = G.s.provs;
  const cul = P[pids[0]].cul, fai = ruler.gov === 'theocracy' ? ruler.fai : P[pids[0]].fai;
  const theo = ruler.gov === 'theocracy';
  const dyn = theo ? 0 : createDynasty(randomDynName(cul), cul).id;
  const v = createChar({ cul, fai, dyn, age: randi(20, 60), female: chance(0.05) && !theo, traits: theo ? ['zealous'] : [] });
  v.gov = theo ? 'theocracy' : vassalGov(ruler); v.laws = defaultLaws(v);
  setLiege(v, ruler.id);
  if (!theo && isAdult(v) && chance(0.7)) { const sp = createChar({ female: !v.f, age: clamp(age(v) - randi(0, 8), 16, 60), cul, fai, dyn: createDynasty(randomDynName(cul), cul).id }); marry(v, sp); const n = randi(0, 3); for (let i = 0; i < n; i++) createChar({ female: chance(0.5), age: randi(0, Math.max(0, age(sp) - 17)), cul, fai, dyn: v.dyn, father: v.f ? sp.id : v.id, mother: v.f ? v.id : sp.id, court: v.id }); }
  return v;
}

function distribute(ruler, counties, capPid) {
  if (!counties.length) return;
  const W = G.world, s = G.s;
  const rank = rankOf(ruler);
  const cap = counties.includes(capPid) ? capPid : counties[0];
  ruler.capital = cap;
  const lim = ruler.gov === 'republic' ? 3 : Math.max(2, Math.min(6, 1 + Math.floor((ruler.base.ste + 4) / 5) + Math.max(0, rank - 1)));
  const capDuchy = W.provinces[cap].duchy;
  const d2 = p => Math.hypot(W.provinces[p].ax - W.provinces[cap].ax, W.provinces[p].ay - W.provinces[cap].ay);
  const sorted = [...counties].sort((a, b) => (W.provinces[a].duchy === capDuchy ? 0 : 1) - (W.provinces[b].duchy === capDuchy ? 0 : 1) || d2(a) - d2(b));
  const domain = rank <= 1 ? sorted.slice(0, 4) : sorted.slice(0, lim);
  for (const p of domain) giveTitle(W.provinces[p].key, ruler.id, { how: 'founded' });
  ruler.capital = cap;
  const remaining = counties.filter(p => !domain.includes(p));
  // capital duchy title
  if (rank >= 3) { const dt = s.titles[capDuchy]; if (!dt.holder && dt.counties.filter(p => counties.includes(p)).length >= Math.ceil(dt.counties.length / 2)) giveTitle(capDuchy, ruler.id, { how: 'founded' }); }
  if (!remaining.length) return;
  if (rank >= 3) {
    const groups = {};
    for (const p of remaining) (groups[W.provinces[p].duchy] ||= []).push(p);
    for (const [did, pids] of Object.entries(groups)) {
      const dt = s.titles[did];
      if (pids.length >= 2 && !dt.holder) {
        const duke = makeVassal(ruler, pids);
        giveTitle(did, duke.id, { how: 'granted' });
        const keep = pids.slice(0, pids.length >= 4 ? 2 : 1);
        for (const p of keep) giveTitle(W.provinces[p].key, duke.id, { how: 'granted' });
        duke.capital = keep[0];
        for (const p of pids.slice(keep.length)) { const cnt = makeVassal(duke, [p]); giveTitle(W.provinces[p].key, cnt.id, { how: 'granted' }); cnt.capital = p; }
      } else {
        for (const p of pids) { const cnt = makeVassal(ruler, [p]); giveTitle(W.provinces[p].key, cnt.id, { how: 'granted' }); cnt.capital = p; }
      }
    }
  } else {
    for (const p of remaining) { const cnt = makeVassal(ruler, [p]); giveTitle(W.provinces[p].key, cnt.id, { how: 'granted' }); cnt.capital = p; }
  }
}

function seedArtifacts(bm, rulerOf) {
  const give = (title, type, rarity, name, desc) => { const c = rulerOf[title]; if (c) createArtifact(c, type, rarity, name, { origin: 'Ancient treasure', desc }); };
  give('e_hre', 'crown', 3, 'Imperial Crown of the Holy Roman Empire', 'Octagonal, set with twelve stones for the apostles.');
  give('e_hre', 'relic', 3, 'The Holy Lance', 'The spear that pierced Christ, carried before the Emperor in battle.');
  give('k_france', 'relic', 2, 'The Holy Ampulla', 'The vial of chrism from which every French king is anointed.');
  give('k_franks', 'sword', 3, 'Joyeuse', 'The sword of Charlemagne, said to change colour thirty times a day.');
  give('e_byzantium', 'crown', 3, 'Crown of the Basileus', 'A domed stemma hung with pearl pendilia.');
  give('k_lombards', 'crown', 3, 'Iron Crown of Lombardy', 'Its inner band beaten from a nail of the True Cross.');
  give('k_italy', 'crown', 3, 'Iron Crown of Lombardy', 'Its inner band beaten from a nail of the True Cross.');
  give('k_england', 'crown', 2, 'Crown of Saint Edward', 'The crown of the Confessor.');
  give('e_angevin', 'crown', 2, 'Crown of Saint Edward', 'The crown of the Confessor.');
  give('k_norway', 'sword', 2, 'Hneitir', 'The sword of Saint Olaf.');
  give('e_abbasid', 'banner', 2, 'The Black Standard', 'Banner of the Abbasid revolution.');
  give('k_caliphate', 'relic', 3, 'The Burda', 'The mantle of the Prophet.');
  give('e_mongol', 'banner', 3, 'Spirit Banner of Genghis', 'Nine horse-tails — the soul of the Khan dwells in it.');
  give('e_ottoman', 'sword', 2, 'Sword of Osman', 'Girded on each new Sultan.');
  give('k_jerusalem', 'relic', 3, 'Fragment of the True Cross', 'Carried before the armies of Outremer.');
  give('k_castile', 'sword', 2, 'Tizona', 'The sword of El Cid.');
  give('k_papacy', 'relic', 3, 'Keys of Saint Peter', 'Symbol of the power to bind and loose.');
  give('k_scotland', 'relic', 2, 'Stone of Scone', 'The Stone of Destiny.');
  give('k_georgia', 'relic', 2, 'Cross of Saint Nino', 'Bound with her own hair.');
  give('k_wessex', 'book', 2, 'Book of Kells', 'Illuminated gospels of breathtaking beauty.');
  give('e_seljuk', 'banner', 2, 'Bow and Arrows of the Seljuks', 'The tamga of the Oghuz.');
}

export function snapshot() {
  const I = idx();
  const own = Array.from(I.provTop);
  const colors = {};
  for (const id of new Set(own)) { const c = ch(id); if (c) colors[id] = T(c.primary)?.color || '#777'; }
  return { day: G.s.day, own, colors };
}
