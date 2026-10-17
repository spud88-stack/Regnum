// Decisions & realm-level actions: titles, laws, faith, culture, crusades, legacies.
import { G, emit, markDirty } from '../state.js';
import { FAITHS, CULTURES, GROUPS, faithHostility } from '../data/cultures.js';
import { LEGACIES, LEGACY_COST, CROWN_AUTHORITY, SUCCESSION } from '../data/traits.js';
import { ch, T, idx, rankOf, primary, giveTitle, setLiege, vassalsOf, domainOf, realmProvs, topOf, titleCountiesHeld, deJureCounties, addPrestige, addPiety, opinion, addOpinion, log, notify, isPlayer, displayName, titleName, faith, culture, kidsOf, removeTrait, addTrait, invalidateMods, age, isRuler, liegeOf } from './core.js';
import { declareWar, atWar, warsOf, realmStrength, joinWar } from './war.js';
import { randi, chance, pick, mixHex, hslToHex, hash, clamp } from '../util.js';

const THRESH = { 2: 0.51, 3: 0.7, 4: 0.8 };
const CREATE_COST = { 2: { gold: 120, prestige: 200 }, 3: { gold: 350, prestige: 700 }, 4: { gold: 700, prestige: 1500 } };
export function creatableTitles(c) {
  const out = [];
  if (!isRuler(c)) return out;
  const top = topOf(c.id); const provs = realmProvs(top);
  const cands = new Set();
  for (const p of provs) { const wp = G.world.provinces[p]; cands.add(wp.duchy); cands.add(wp.kingdom); cands.add(wp.empire); }
  const liege = liegeOf(c);
  for (const tid of cands) {
    const t = T(tid); if (!t) continue;
    if (t.holder === c.id) continue;
    if (liege && t.rank >= rankOf(liege)) continue;
    const frac = myFraction(c, tid);
    const need = THRESH[t.rank];
    const usurp = !!t.holder;
    if (usurp && (t.holder === c.liege || topOf(t.holder) === top)) continue;
    if (frac < need * 0.6) continue;
    const cost = CREATE_COST[t.rank];
    out.push({ tid, t, frac, need, ok: frac >= need && c.gold >= cost.gold && c.prestige >= cost.prestige, cost, usurp });
  }
  return out.sort((a, b) => b.t.rank - a.t.rank || b.frac - a.frac);
}
export function myFraction(c, tid) {
  const cs = deJureCounties(tid); if (!cs.length) return 0;
  const I = idx(); const mine = new Set([c.id]);
  // counties held by me or my vassals (if independent: whole realm)
  const top = topOf(c.id);
  let n = 0;
  for (const p of cs) { const h = I.provOwner[p]; if (!h) continue; if (c.liege ? (h === c.id || isUnder(h, c.id)) : I.provTop[p] === top) n++; }
  return n / cs.length;
}
function isUnder(h, id) { let x = ch(h), g = 0; while (x && x.liege && g++ < 10) { if (x.liege === id) return true; x = ch(x.liege); } return false; }
export function createTitle(c, tid) {
  const t = T(tid); const cost = CREATE_COST[t.rank];
  if (c.gold < cost.gold || c.prestige < cost.prestige) return false;
  c.gold -= cost.gold; c.prestige -= cost.prestige;
  const prev = ch(t.holder);
  giveTitle(tid, c.id, { how: prev ? 'usurped' : 'created' });
  t.realmName = null;
  if (prev) addOpinion(prev, c, -60, 'Usurped my title', 240);
  addPrestige(c, 100 * t.rank);
  // vassals within de jure come under the new title holder if they were under my liege
  const I = idx();
  for (const p of deJureCounties(tid)) { const h = ch(I.provOwner[p]); if (h && h.id !== c.id && h.liege && h.liege === c.liege && rankOf(h) < t.rank && topOf(h.id) === topOf(c.id)) setLiege(h, c.id); }
  const msg = `${displayName(c)} has ${prev ? 'usurped' : 'created'} the ${titleName(t)}!`;
  log(msg, { type: 'title', ids: [c.id], icon: '👑' });
  notify(msg, { type: isPlayer(c) ? 'good' : 'info', icon: '👑', important: t.rank >= 3, sound: 'fanfare', title: tid });
  if (t.rank >= 3 && c.dyn) { const d = G.s.dyns[c.dyn]; if (d) d.renown += 300 * (t.rank - 2); }
  markDirty(); emit('titleCreated', { c, t });
  return true;
}

// Laws
export function changeSuccession(c, law) {
  const cost = 500;
  if (c.prestige < cost || atWar(c.id) || c.laws.succ === law) return false;
  if (law === 'primogeniture' && G.s.cultures[c.cul]?.era < 2 && G.s.era < 2) return false;
  c.prestige -= cost; c.laws.succ = law;
  for (const v of vassalsOf(c.id)) addOpinion(ch(v), c, law === 'primogeniture' ? -10 : 5, 'Changed succession law', 60);
  return true;
}
export function changeCrown(c, level) {
  const cur = c.laws.crown ?? 1; if (level === cur) return false;
  const cost = level > cur ? 300 * level : 0;
  if (c.prestige < cost) return false;
  if (level > cur && vassalsOf(c.id).some(v => opinion(ch(v), c) < 0)) return false;
  c.prestige -= cost; c.laws.crown = level; markDirty(); return true;
}
export function changeGender(c, law) { if (c.prestige < 300) return false; c.prestige -= 300; c.laws.gender = law; return true; }

// Faith
export function canReform(c) {
  const f = faith(c.fai); if (!f.reformable || G.s.customFaiths[c.fai]) return false;
  return c.piety >= 1000;
}
export function reformFaith(c, name, doctrines) {
  if (!canReform(c)) return false;
  c.piety -= 1000;
  const base = faith(c.fai); const id = 'ref_' + c.fai + '_' + (G.s.nextId++);
  G.s.customFaiths[id] = { ...base, name: name || `Reformed ${base.name}`, reformable: false, reformed: true, color: mixHex(base.color, '#ffffff', 0.25), doctrines: doctrines || base.doctrines.filter(d => d !== 'Unreformed').concat(['Reformed', 'Organized Clergy']), head: null, founder: c.id };
  G.s.faiths[id] = { fervor: 90 };
  const convert = x => { if (x && x.fai === c.fai) x.fai = id; };
  const old = c.fai;
  convert(c); for (const k of kidsOf(c)) convert(k); convert(ch(c.spouse));
  for (const v of vassalsOf(c.id)) if (ch(v).fai === old) ch(v).fai = id;
  for (const p of realmProvs(c.id)) if (G.s.provs[p].fai === old) G.s.provs[p].fai = id;
  addPrestige(c, 500);
  log(`${displayName(c)} has reformed the old faith as ${G.s.customFaiths[id].name}!`, { type: 'faith', ids: [c.id], icon: '✨' });
  notify(`The ${G.s.customFaiths[id].name} has been founded!`, { type: 'good', icon: '✨', important: true, sound: 'fanfare' });
  markDirty(); return true;
}
export function conversionCost(c, fid) { const fam = faith(fid).family, my = faith(c.fai).family; return my === 'pagan' && fam !== 'pagan' ? 150 : fam === my ? 300 : 600; }
export function convertFaith(c, fid) {
  const cost = conversionCost(c, fid); if (c.piety < cost) return false;
  c.piety -= cost; const old = c.fai; c.fai = fid;
  for (const k of kidsOf(c)) if (age(k) < 16) k.fai = fid;
  if (c.capital !== null && c.capital !== undefined) G.s.provs[c.capital].fai = fid;
  for (const v of vassalsOf(c.id)) addOpinion(ch(v), c, ch(v).fai === fid ? 20 : -30, 'Converted', 120);
  log(`${displayName(c)} has converted from ${faith(old).name} to ${faith(fid).name}.`, { type: 'faith', ids: [c.id], icon: faith(fid).icon });
  markDirty(); return true;
}

// Culture
export function hybridize(c, other, name) {
  if (c.prestige < 1000) return false;
  c.prestige -= 1000;
  const A = culture(c.cul), B = culture(other);
  const id = 'hyb_' + (G.s.nextId++);
  G.s.customCultures[id] = { name: name || (A.name.slice(0, Math.ceil(A.name.length / 2)) + B.name.slice(Math.floor(B.name.length / 2)).toLowerCase()), group: A.group, color: mixHex(A.color, B.color, 0.5), maa: chance(0.5) ? A.maa : B.maa, ethos: A.ethos, hybrid: [c.cul, other] };
  G.s.cultures[id] = { inn: { ...(G.s.cultures[c.cul]?.inn || {}) }, era: Math.max(G.s.cultures[c.cul]?.era || 0, G.s.cultures[other]?.era || 0) };
  for (const [k, v] of Object.entries(G.s.cultures[other]?.inn || {})) G.s.cultures[id].inn[k] = Math.max(G.s.cultures[id].inn[k] || 0, v);
  const old = c.cul; c.cul = id;
  for (const k of kidsOf(c)) k.cul = id;
  for (const p of domainOf(c.id)) if (G.s.provs[p].cul === old || G.s.provs[p].cul === other) G.s.provs[p].cul = id;
  log(`${displayName(c)} has forged a new culture: the ${G.s.customCultures[id].name}.`, { type: 'culture', ids: [c.id], icon: '🎭' });
  notify(`A new culture is born: ${G.s.customCultures[id].name}!`, { type: 'good', icon: '🎭', important: true });
  markDirty(); return true;
}

// Great Holy Wars
export function holyTargets(head) {
  const f = faith(head.fai); const I = idx(); const out = [];
  const sites = (f.holy || []).map(n => G.world.byName[n]).filter(x => x !== undefined);
  for (const pid of sites) {
    const top = ch(I.provTop[pid]); if (!top || faithHostility(top.fai, head.fai) < 2) continue;
    out.push({ kingdom: G.world.provinces[pid].kingdom, holder: top, site: pid });
  }
  return out;
}
export function callGreatHolyWar(head, tgt) {
  const k = tgt.kingdom; const def = tgt.holder;
  const I = idx();
  const faithful = I.independent.map(ch).filter(c => c && c.fai === head.fai && c.id !== def.id && rankOf(c) >= 2 && realmProvs(c.id).length);
  if (!faithful.length) return null;
  const leader = faithful.sort((a, b) => realmStrength(b.id) - realmStrength(a.id))[0];
  G.s.crusades = (G.s.crusades || 0) + 1;
  const w = declareWar(leader, def, { cb: 'crusade', target: k, n: G.s.crusades }, { free: true });
  if (!w) return null;
  for (const c of faithful) {
    if (c === leader) continue;
    if (isPlayer(c)) { emit('crusadeCall', { w, head }); continue; }
    if (chance(0.25 + (c.traits.includes('zealous') ? 0.4 : 0) + (opinion(c, head) / 300))) { joinWar(w, c.id, 'att'); addPiety(c, 100); if (!c.traits.includes('crusader') && faith(c.fai).family === 'christian') addTrait(c, 'crusader'); if (faith(c.fai).family === 'islamic') addTrait(c, 'ghazi'); }
  }
  // defenders of the same faith rally
  for (const c of I.independent.map(ch)) if (c && c.fai === def.fai && c.id !== def.id && chance(0.2) && realmProvs(c.id).length) joinWar(w, c.id, 'def');
  const fs = G.s.faiths[head.fai]; if (fs) fs.fervor = clamp((fs.fervor || 50) - 20, 0, 100);
  notify(`${displayName(head)} has called the faithful to a Great Holy War for ${T(k).name}!`, { type: 'war', icon: '✠', important: true, sound: 'war' });
  return w;
}

// Dynasty legacies
export function legacyCost(d, track) { const lv = d.legacies[track] || 0; return lv >= 3 ? null : LEGACY_COST[lv]; }
export function buyLegacy(c, track) {
  const d = G.s.dyns[c.dyn]; if (!d) return false;
  const cost = legacyCost(d, track); if (cost === null || d.renown < cost) return false;
  if (d.head && d.head !== c.id) return false;
  d.renown -= cost; d.legacies[track] = (d.legacies[track] || 0) + 1; invalidateMods();
  notify(`Your house unlocks ${LEGACIES[track].levels[d.legacies[track] - 1].name}!`, { type: 'good', icon: LEGACIES[track].icon });
  return true;
}
export function legitimize(c, kid) { if (c.prestige < 200 || !kid.traits.includes('bastard')) return false; c.prestige -= 200; removeTrait(kid, 'bastard'); addTrait(kid, 'legitimized'); kid.dyn = c.dyn; return true; }

// Yearly world decisions (AI)
export function yearlyDecisions() {
  const I = idx();
  for (const id of I.rulers) {
    const c = ch(id); if (isPlayer(c) || c.llm) continue;
    if (chance(0.3)) { const ct = creatableTitles(c).find(x => x.ok && (!x.usurp || x.t.rank > rankOf(c) || chance(0.3))); if (ct) createTitle(c, ct.tid); }
    if (canReform(c) && chance(0.15)) reformFaith(c);
  }
  // great holy wars
  for (const t of Object.values(G.s.titles)) {
    if (!t.faithHead || !t.holder) continue;
    const head = ch(t.holder); if (!head || head.dead) continue;
    if (G.s.wars.some(w => w.cb === 'crusade' && ch(w.attLeader)?.fai === head.fai)) continue;
    const fs = G.s.faiths[head.fai]; if (!fs || (fs.fervor || 50) < 45) continue;
    const tg = holyTargets(head); if (!tg.length) continue;
    if (isPlayer(head)) continue;
    if (chance(0.07)) callGreatHolyWar(head, pick(tg));
  }
  for (const fs of Object.values(G.s.faiths)) fs.fervor = clamp((fs.fervor || 50) + 3, 0, 100);
  // regional struggle
  const st = G.s.struggle;
  if (st && st.phase !== 'ended') {
    const W = G.world; const faiths = new Set(W.provinces.filter(p => p.empire === st.region).map(p => G.s.provs[p.id].fai));
    const holyWars = G.s.wars.filter(w => (w.cb === 'holy_war' || w.cb === 'crusade') && W.provinces.some(p => p.empire === st.region && T(w.target)?.counties?.includes(p.id))).length;
    st.prog = clamp(st.prog + (holyWars ? 6 : -3), 0, 100);
    const phase = st.prog > 70 ? 'hostility' : st.prog > 40 ? 'opportunity' : st.prog > 15 ? 'compromise' : 'conciliation';
    if (phase !== st.phase) { st.phase = phase; notify(`${st.name} enters a phase of ${phase[0].toUpperCase() + phase.slice(1)}.`, { type: 'info', icon: '⚖' }); }
    if (faiths.size <= 1) { st.phase = 'ended'; notify(`${st.name} has ended — one faith rules all.`, { type: 'info', icon: '⚖', important: true }); }
  }
}
