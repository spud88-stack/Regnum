// Life cycle: births, aging, health, stress, death, succession, marriage, courts and councils.
import { G, emit, on, markDirty } from '../state.js';
import { TRAITS, COUNCIL } from '../data/traits.js';
import { faithHostility, FAITHS } from '../data/cultures.js';
import { updateEpithet } from './core.js';
import { ch, T, idx, age, isAdult, isRuler, rankOf, primary, updatePrimary, giveTitle, setLiege, vassalsOf, courtiersOf, domainOf, mods, stat, addTrait, removeTrait, hasTrait, createChar, marry, randomName, opinion, addOpinion, log, notify, isPlayer, displayName, fullName, titleName, kidsOf, siblings, isKin, involvesPlayer, educationFor, randomPersonality, invalidateMods, addPrestige, faith, culture, createDynasty, randomDynName, topOf, rankName, transferArtifact, STATS } from './core.js';
import { rand, randi, chance, pick, clamp, shuffle, roman } from '../util.js';

on('killChar', ({ c, cause, killer }) => kill(c, cause, killer));

// ---------- Death ----------
export const CAUSES = { old_age: 'of old age', illness: 'of illness', battle: 'in battle', murder: 'murdered', childbirth: 'in childbirth', accident: 'in an accident', execution: 'by execution', plague: 'of the plague', infancy: 'in infancy', wounds: 'of wounds', duel: 'in a duel', hunt: 'in a hunting accident', stress: 'of a broken heart' };
export function kill(c, cause = 'illness', killerId = 0) {
  if (!c || c.dead) return;
  c.dead = G.s.day; c.cause = cause; c.killer = killerId || 0;
  const sp = ch(c.spouse); if (sp && !sp.dead) { sp.spouse = 0; sp.widowed = c.id; sp.stress += 20; }
  for (const k of kidsOf(c)) if (!k.dead) k.stress += 10;
  // armies commanded
  for (const a of G.s.armies) if (a.cmdr === c.id) a.cmdr = a.owner;
  G.s.schemes = G.s.schemes.filter(s => s.owner !== c.id && s.target !== c.id);
  for (const r of idx().rulers) { const ru = ch(r); if (ru.councilMembers) for (const k in ru.councilMembers) if (ru.councilMembers[k] === c.id) ru.councilMembers[k] = 0; }
  const killer = ch(killerId);
  if (killer && cause === 'murder') { addOpinion(ch(c.spouse) || c, killer, -60, 'Murdered my spouse', 240); for (const k of kidsOf(c)) addOpinion(k, killer, -80, 'Murdered my parent', 360); }
  const wasPlayer = isPlayer(c);
  if (isRuler(c) || wasPlayer) updateEpithet(c);
  const notable = isRuler(c) && (rankOf(c) >= 2 || involvesPlayer(c.id));
  if (isRuler(c)) succession(c);
  else if (c.artifacts?.length) { const h = ch(c.court) || ch(c.father); for (const a of [...c.artifacts]) transferArtifact(a, h, `Inherited from ${c.name}`); }
  if (notable || involvesPlayer(c.id) || wasPlayer) {
    const txt = `${displayName(c)} has died ${CAUSES[cause] || cause} at the age of ${age(c)}.`;
    log(txt, { type: 'death', ids: [c.id], icon: '✝' });
    if (!wasPlayer && (involvesPlayer(c.id) || rankOf(c) >= 3)) notify(txt, { type: 'death', icon: '✝', ids: [c.id], sound: 'death' });
  }
  markDirty(); invalidateMods(c.id);
  emit('death', { c, cause, wasPlayer });
}

// ---------- Succession ----------
function genderOk(law, x, tier) {
  if (law === 'agnatic') return !x.f;
  if (law === 'enatic') return x.f;
  return true;
}
function childOrder(p, gender) {
  const kids = kidsOf(p).filter(k => !k.dead || k.kids.length);
  const pref = gender === 'agnatic_cognatic' || gender === 'agnatic' ? (k => k.f ? 1 : 0) : gender === 'enatic_cognatic' ? (k => k.f ? 0 : 1) : (() => 0);
  return kids.sort((a, b) => pref(a) - pref(b) || a.born - b.born);
}
function lineOf(p, gender, out = [], depth = 0) {
  if (depth > 4) return out;
  for (const k of childOrder(p, gender)) { out.push(k); lineOf(k, gender, out, depth + 1); }
  return out;
}
export function heirList(c) {
  const laws = c.laws || { succ: 'partition', gender: 'agnatic_cognatic' };
  const ok = x => x && !x.dead && !x.traits.includes('bastard') && genderOk(laws.gender, x) && !x.imprisoned;
  if (laws.succ === 'seniority') {
    const dyn = (idx().dynMembers.get(c.dyn) || []).map(ch).filter(x => ok(x) && x.id !== c.id && isAdult(x));
    return dyn.sort((a, b) => a.born - b.born);
  }
  let line = lineOf(c, laws.gender);
  let anc = c, guard = 0;
  while (guard++ < 3) { const f = ch(anc.father) || ch(anc.mother); if (!f) break; for (const x of lineOf(f, laws.gender)) if (!line.includes(x) && x.id !== c.id) line.push(x); anc = f; }
  line = line.filter(ok);
  if (laws.succ === 'tanistry' || laws.succ === 'elective') {
    const dyn = (idx().dynMembers.get(c.dyn) || []).map(ch).filter(x => ok(x) && x.id !== c.id && isAdult(x));
    const cands = [...new Set([...line.filter(isAdult), ...dyn])];
    if (laws.succ === 'elective') for (const v of vassalsOf(c.id).map(ch)) if (ok(v) && rankOf(v) >= 2 && isAdult(v)) cands.push(v);
    const score = x => STATS.reduce((s, k) => s + stat(x, k), 0) + (x.dyn === c.dyn ? 15 : 0) + (x.father === c.id || x.mother === c.id ? 20 : 0) + rankOf(x) * 8 + (age(x) > 60 ? -10 : 0) + randi(0, 6);
    cands.sort((a, b) => score(b) - score(a));
    if (cands.length) return [cands[0], ...line.filter(x => x !== cands[0])];
  }
  return line;
}
export function heirOf(c) { if (c.gov === 'theocracy' || c.gov === 'republic') return null; return heirList(c)[0] || null; }

function newRulerFor(c) {
  const capP = c.capital ?? domainOf(c.id)[0];
  const p = capP !== undefined && capP !== null ? G.s.provs[capP] : null;
  const cul = p?.cul || c.cul, fai = c.gov === 'theocracy' ? c.fai : (p?.fai || c.fai);
  const dyn = c.gov === 'theocracy' ? 0 : createDynasty(randomDynName(cul), cul).id;
  const n = createChar({ cul, fai, dyn, age: c.gov === 'theocracy' ? randi(45, 70) : randi(22, 45), female: false, traits: c.gov === 'theocracy' ? ['zealous'] : [] });
  n.gold = 0; n.gov = c.gov; n.laws = c.laws ? { ...c.laws } : null;
  return n;
}

export function succession(c) {
  const s = G.s;
  const titles = [...c.titles].map(T).sort((a, b) => b.rank - a.rank || (a.id === c.primary ? -1 : 1));
  if (!titles.length) return;
  const prim = T(c.primary) || titles[0];
  const vassals = vassalsOf(c.id).map(ch);
  const courtiers = courtiersOf(c.id).map(ch);
  let heirs = [];
  const law = c.laws?.succ || 'partition';
  if (c.gov === 'theocracy' || c.gov === 'republic') {
    const fam = c.gov === 'republic' ? heirList(c).filter(isAdult) : [];
    heirs = [fam.length && chance(0.5) ? fam[0] : newRulerFor(c)];
  } else {
    const list = heirList(c);
    if (law === 'partition' && list.length) {
      let kids = childOrder(c, c.laws?.gender).filter(k => !k.dead && !k.traits.includes('bastard') && genderOk(c.laws?.gender, k));
      const g = c.laws?.gender;
      if ((g === 'agnatic_cognatic' || g === 'agnatic') && kids.some(k => !k.f)) kids = kids.filter(k => !k.f);
      if (g === 'enatic_cognatic' && kids.some(k => k.f)) kids = kids.filter(k => k.f);
      heirs = kids.length ? kids.slice(0, 4) : [list[0]];
    } else if (list.length) heirs = [list[0]];
  }
  if (!heirs.length) {
    const l = ch(c.liege);
    if (l && !l.dead) heirs = [l];
    else {
      const strongest = vassals.filter(v => isAdult(v)).sort((a, b) => rankOf(b) - rankOf(a) || domainOf(b.id).length - domainOf(a.id).length)[0];
      heirs = [strongest && chance(0.6) ? strongest : newRulerFor(c)];
    }
  }
  const main = heirs[0];
  for (const h of heirs) if (!isRuler(h)) h.reignStart = s.day;
  const prevLiegeOfMain = main.liege;
  const mainWasRuler = isRuler(main);
  // distribute titles
  const assign = new Map(heirs.map(h => [h.id, []]));
  assign.get(main.id).push(prim);
  const rest = titles.filter(t => t !== prim);
  const capKey = c.capital !== null && c.capital !== undefined ? G.world.provinces[c.capital]?.key : null;
  let rr = heirs.length > 1 ? 1 : 0;
  for (const t of rest) {
    if (t.id === capKey) { assign.get(main.id).push(t); continue; }
    const h = heirs[rr % heirs.length]; assign.get(h.id).push(t); rr++;
    if (rr % heirs.length === 0 && heirs.length > 1) rr = 1; // primary heir gets capital + primary, others share the rest
  }
  for (const [hid, ts] of assign) for (const t of ts) giveTitle(t.id, hid, { how: 'inherited' });
  // regnal numbers
  for (const h of heirs) {
    const pt = primary(h); if (!pt || h.regnal) continue;
    const prev = (pt.history || []).filter(x => x.holder && ch(x.holder)?.name === h.name && x.holder !== h.id).map(x => x.holder);
    const n = new Set(prev).size + 1; if (n > 1 || rankOf(h) >= 3) h.regnal = roman(n);
  }
  // inheritance of realm attributes
  if (!mainWasRuler || !main.laws) { main.laws = c.laws ? { ...c.laws } : main.laws; }
  if (!main.gov || !mainWasRuler) main.gov = c.gov;
  main.amenities = main.amenities || c.amenities; main.councilTasks = main.councilTasks || c.councilTasks;
  main.maa = main.maa || {}; for (const [k, v] of Object.entries(c.maa || {})) main.maa[k] = (main.maa[k] || 0) + v;
  main.maaCur = main.maaCur || {}; for (const [k, v] of Object.entries(c.maaCur || {})) main.maaCur[k] = (main.maaCur[k] || 0) + v;
  main.levyCur = (main.levyCur || 0) + (c.levyCur || 0);
  main.gold += Math.max(0, c.gold) / (heirs.length > 1 ? 1.5 : 1); if (c.gold < 0) main.gold += c.gold;
  main.mercs = [...(main.mercs || []), ...(c.mercs || [])];
  for (const a of [...(c.artifacts || [])]) transferArtifact(a, main, `Inherited from ${c.name}`);
  if (!main.councilMembers) main.councilMembers = c.councilMembers ? { ...c.councilMembers } : null;
  if (main.capital === null || main.capital === undefined || !domainOf(main.id).includes(main.capital)) main.capital = c.capital;
  // other heirs become vassals of main (if lower rank)
  for (const h of heirs.slice(1)) { if (rankOf(h) < rankOf(main) && !h.liege) setLiege(h, main.id); else if (rankOf(h) < rankOf(main) && h.liege === c.id) setLiege(h, main.id); }
  // liege relationship of main
  if (main.liege === c.id) setLiege(main, 0);
  if (c.liege && c.liege !== main.id && !mainWasRuler) setLiege(main, c.liege);
  if (main.liege && rankOf(main) >= rankOf(ch(main.liege))) setLiege(main, 0);
  // vassals follow the main heir unless they are other heirs
  for (const v of vassals) { if (v.dead || heirs.includes(v)) continue; if (v.liege === c.id) setLiege(v, main.id); }
  for (const v of vassalsOf(c.id)) { const vc = ch(v); if (vc && vc.liege === c.id) setLiege(vc, main.id); }
  // courtiers move
  for (const k of courtiers) if (!k.dead && !isRuler(k)) k.court = (k.father === c.id || k.mother === c.id) ? main.id : (heirs.find(h => h.id === k.father) ? k.court : main.id);
  // wars, armies, alliances
  for (const w of s.wars) {
    for (const side of ['att', 'def']) w[side] = w[side].map(x => (x === c.id ? main.id : x));
    if (w.attLeader === c.id) w.attLeader = main.id; if (w.defLeader === c.id) w.defLeader = main.id; if (w.claimant === c.id) w.claimant = main.id;
  }
  for (const a of s.armies) if (a.owner === c.id) a.owner = main.id;
  s.alliances = s.alliances.filter(x => x.a !== c.id && x.b !== c.id);
  // claims for passed-over children under primogeniture
  if (heirs.length === 1) for (const k of kidsOf(c)) if (!k.dead && k !== main && !k.traits.includes('bastard')) { k.claims = k.claims || []; if (!k.claims.includes(prim.id)) k.claims.push(prim.id); }
  if (c.llm) { main.llm = true; main.persona = c.persona; addTrait(main, 'ai_mind'); }
  // dynasty head
  const d = s.dyns[c.dyn]; if (d && d.head === c.id) { const m = (idx().dynMembers.get(c.dyn) || []).map(ch).filter(x => x && !x.dead).sort((a, b) => rankOf(b) - rankOf(a) || a.born - b.born)[0]; d.head = m ? m.id : 0; }
  // player
  if (isPlayer(c)) {
    if (main && main.dyn === c.dyn && !main.dead) { s.player = main.id; s.generation = (s.generation || 1) + 1; }
    else {
      const alt = (idx().dynMembers.get(c.dyn) || []).map(ch).filter(x => x && !x.dead && isRuler(x)).sort((a, b) => rankOf(b) - rankOf(a))[0];
      const kid = kidsOf(c).filter(k => !k.dead).sort((a, b) => a.born - b.born)[0];
      s.player = alt ? alt.id : kid ? kid.id : 0;
      if (s.player) s.generation = (s.generation || 1) + 1;
    }
    if (s.player) { (s.lineage ||= []).push(s.player); const h = ch(s.player); if (h) h.reignStart = s.day; }
    s.ambition = null;
    emit('playerSuccession', { old: c, heir: ch(s.player), heirs });
  }
  markDirty();
  if (rankOf(main) >= 2 || involvesPlayer(main.id)) log(`${displayName(main)} inherits ${titleName(prim)}${heirs.length > 1 ? `, sharing the realm with ${heirs.slice(1).map(h => h.name).join(', ')}` : ''}.`, { type: 'succession', ids: [main.id, c.id], icon: '👑' });
}

// ---------- Monthly life ----------
export function monthlyLife() {
  const s = G.s; const I = idx();
  for (const id of I.living) {
    const c = ch(id); if (!c || c.dead) continue;
    const a = age(c);
    const m = mods(c);
    // pregnancy
    if (c.preg && s.day >= c.preg.due) giveBirth(c);
    // conception
    if (c.f && !c.preg && a >= 16 && a <= 45) {
      const sp = ch(c.spouse);
      const lover = c.rel.lovers.map(ch).find(x => x && !x.dead && !x.f);
      const fert = 1 + (m.fertility || 0) + (sp ? mods(sp).fertility || 0 : 0);
      const ageF = a > 38 ? 0.4 : a > 32 ? 0.75 : 1;
      const nk = kidsOf(c).filter(k => !k.dead).length;
      const damp = nk >= 6 ? 0.15 : nk >= 4 ? 0.35 : nk >= 2 ? 0.7 : 1;
      const lowborn = !c.dyn && !(sp && sp.dyn) ? 0.35 : (isRuler(c) || isRuler(sp) || (sp && (ch(sp.court)?.kids || []).includes(sp.id))) ? 1 : 0.6;
      if (sp && !sp.dead && !sp.f && chance(0.02 * fert * ageF * damp * lowborn)) c.preg = { due: s.day + 270, father: sp.id };
      else if (lover && chance(0.008 * fert * ageF)) c.preg = { due: s.day + 270, father: lover.id, bastard: !sp || sp.id !== lover.id };
    }
    // health & death
    const hEff = c.health + (m.health || 0);
    let p;
    if (a < 3) p = 0.0035; else if (a < 16) p = 0.0006;
    else p = Math.exp((a - 78) / 8.5) / 60 + 0.0002;
    p *= Math.pow(1.55, 5 - hEff);
    if (c.traits.includes('wounded')) { p += 0.004; if (chance(0.12)) removeTrait(c, 'wounded'); }
    if (c.traits.includes('ill')) { p += 0.005; if (chance(0.2)) removeTrait(c, 'ill'); else if (chance(0.03)) { removeTrait(c, 'ill'); addTrait(c, 'pneumonic'); } }
    if (c.traits.includes('pneumonic')) { p += 0.03; if (chance(0.12)) removeTrait(c, 'pneumonic'); }
    if (c.traits.includes('plague')) { p += 0.12; if (chance(0.25)) removeTrait(c, 'plague'); }
    if (chance(p)) { kill(c, a < 5 ? 'infancy' : a > 60 ? (chance(0.6) ? 'old_age' : 'illness') : c.traits.includes('wounded') ? 'wounds' : c.traits.includes('plague') ? 'plague' : 'illness'); continue; }
    if (a > 16 && chance(0.0025)) addTrait(c, 'ill');
    if (a >= 65 && chance(0.01) && !c.traits.includes('infirm')) addTrait(c, 'infirm');
    if (a > 30) c.health -= 0.0025 * (a > 55 ? 3 : 1);
    // stress
    c.stress = Math.max(0, c.stress - 1.5 * (1 + (m.stressLoss || 0)));
    if (c.stress >= 100 && !c.breaking) { c.breaking = true; emit('stressBreak', c); }
    if (c.stress < 80) c.breaking = false;
    // growing up
    const bd = (s.day - c.born) % 365;
    if (bd < 31) {
      if (a === 6 || a === 10 || a === 13) c.traits = randomPersonality(a === 6 ? 1 : a === 10 ? 2 : 3, c.traits);
      if (a === 16 && !c.educated) { c.educated = true; c.traits = randomPersonality(3, c.traits); educate(c); }
    }
    // lifestyle
    if (isRuler(c) || isPlayer(c)) { if (!c.focus && a >= 16) c.focus = pickFocus(c); }
    // opinion modifier cleanup
    if (c.op && chance(0.1)) for (const k in c.op) { c.op[k] = c.op[k].filter(x => x.u > s.day); if (!c.op[k].length) delete c.op[k]; }
  }
}
function pickFocus(c) { const best = STATS.reduce((a, s) => (stat(c, s) > stat(c, a) ? s : a), 'dip'); return { dip: 'diplomacy', mar: 'martial', ste: 'stewardship', int: 'intrigue', lea: 'learning' }[best]; }
export function educate(c) {
  const host = ch(c.court) || ch(c.father) || ch(c.mother);
  const focus = c.eduFocus || STATS.reduce((a, s) => (c.base[s] > c.base[a] ? s : a), 'dip');
  let lv = 1 + (rand() < 0.55 ? 1 : 0) + (rand() < 0.3 ? 1 : 0) + (rand() < 0.08 ? 1 : 0);
  if (host && stat(host, focus) >= 12) lv++;
  if (c.traits.includes('genius')) lv++; if (c.traits.includes('slow') || c.traits.includes('imbecile')) lv--;
  lv = clamp(lv, 1, 4);
  addTrait(c, `edu_${focus}_${lv}`);
  c.base[focus] += lv;
  if (involvesPlayer(c.id) || c.father === G.s.player || c.mother === G.s.player) notify(`${c.name} has come of age with the trait ${TRAITS[`edu_${focus}_${lv}`].name}.`, { type: 'info', icon: TRAITS[`edu_${focus}_${lv}`].icon, ids: [c.id] });
}

function giveBirth(mom) {
  const s = G.s; const preg = mom.preg; mom.preg = null;
  const dad = ch(preg.father);
  const matri = isRuler(mom) && (!dad || rankOf(mom) > rankOf(dad));
  const n = chance(0.015) ? 2 : 1;
  for (let i = 0; i < n; i++) {
    const female = chance(0.49);
    const pool = [mom, dad, ch(mom.father), ch(mom.mother), dad && ch(dad.father), dad && ch(dad.mother)].filter(x => x && x.f === female && x.dyn);
    const name = pool.length && chance(0.4) ? pick(pool).name : randomName((matri ? mom : dad || mom).cul, female);
    const kid = createChar({ name, female, age: 0, born: s.day, cul: (matri ? mom.cul : dad?.cul) || mom.cul, fai: (matri ? mom.fai : dad?.fai) || mom.fai, dyn: preg.bastard ? (mom.dyn) : (matri ? mom.dyn : dad?.dyn || mom.dyn), father: preg.father || 0, mother: mom.id, court: isRuler(mom) ? mom.id : isRuler(dad) ? dad.id : (mom.court || dad?.court || 0) });
    if (preg.bastard) addTrait(kid, 'bastard');
    if (dad?.traits.includes('born_purple') || rankOf(dad) >= 4 || rankOf(mom) >= 4) addTrait(kid, 'born_purple');
    if (involvesPlayer(mom.id) || (dad && involvesPlayer(dad.id))) {
      notify(`${displayName(mom)} has given birth to a ${female ? 'daughter' : 'son'}, ${kid.name}.`, { type: 'good', icon: female ? '👶' : '👶', ids: [kid.id], sound: 'birth' });
      log(`${kid.name} was born to ${mom.name}${dad ? ' and ' + dad.name : ''}.`, { type: 'birth', ids: [kid.id] });
    }
    emit('birth', kid);
  }
  if (chance(0.012)) kill(mom, 'childbirth');
}

// ---------- Yearly: marriages, courts, council ----------
export function yearlyLife() {
  const I = idx();
  aiMarriages();
  for (const id of I.rulers) { const c = ch(id); if (c.reignStart === undefined) c.reignStart = G.s.day; updateEpithet(c); }
  // court top-up
  for (const id of I.rulers) {
    const c = ch(id); const r = rankOf(c);
    const court = courtiersOf(id);
    const want = 1 + r * 2;
    if (court.length < want && chance(0.6)) {
      const cap = c.capital ?? domainOf(id)[0];
      const p = cap !== undefined && cap !== null ? G.s.provs[cap] : null;
      const cul = p && chance(0.7) ? p.cul : c.cul;
      const nc = createChar({ cul, fai: c.fai, age: randi(18, 45), female: chance(0.3), court: id, dyn: chance(0.5) ? createDynasty(randomDynName(cul), cul).id : 0 });
      if (chance(0.35)) nc.base.pro += randi(2, 6);
    }
    autoCouncil(c);
    // courtiers drift away from overcrowded courts
    if (court.length > want * 2 + 4) {
      const used = new Set(Object.values(c.councilMembers || {}));
      const leavers = court.map(ch).filter(x => x && !x.dyn && !x.kids.length && !x.spouse && !used.has(x.id) && x.father !== id && x.mother !== id && !x.imprisoned && !G.s.armies.some(a => a.cmdr === x.id));
      for (const x of leavers.slice(0, court.length - want * 2)) delete G.s.chars[x.id];
      if (leavers.length) markDirty();
    }
  }
  pruneDead();
}
export function autoCouncil(c) {
  if (rankOf(c) < 2) return;
  c.councilMembers = c.councilMembers || {};
  c.councilTasks = c.councilTasks || { chancellor: 'domestic', marshal: 'organize', steward: 'taxes', spymaster: 'disrupt', chaplain: 'piety' };
  const used = new Set(Object.values(c.councilMembers).filter(Boolean));
  const pool = [...courtiersOf(c.id), ...vassalsOf(c.id), c.spouse].map(ch).filter(x => x && !x.dead && isAdult(x) && !x.imprisoned);
  for (const [post, def] of Object.entries(COUNCIL)) {
    const cur = ch(c.councilMembers[post]);
    if (cur && !cur.dead && (cur.court === c.id || cur.liege === c.id || c.spouse === cur.id)) continue;
    if (isPlayer(c) && cur === undefined && c.councilMembers[post] === -1) continue;
    const cand = pool.filter(x => !used.has(x.id) && (post !== 'chaplain' || x.fai === c.fai)).sort((a, b) => stat(b, def.stat) - stat(a, def.stat))[0];
    c.councilMembers[post] = cand ? cand.id : 0; if (cand) used.add(cand.id);
  }
}
function aiMarriages() {
  const I = idx(); const s = G.s;
  const singles = I.living.map(ch).filter(c => !c.spouse && c.dyn && isAdult(c) && age(c) <= (c.f ? 40 : 60) && !c.imprisoned && !(c.f && c.preg) && (c.gov !== 'theocracy'));
  const player = ch(s.player);
  const playerFam = c => player && (c.id === player.id || c.court === player.id || c.father === player.id || c.mother === player.id);
  const men = shuffle(singles.filter(c => !c.f && !playerFam(c))), women = singles.filter(c => c.f && !playerFam(c));
  const famRank = c => Math.max(rankOf(c), rankOf(ch(c.court) || c) - (ch(c.court)?.kids.includes(c.id) ? 0 : 2));
  for (const m of men) {
    if (m.spouse || !chance(isRuler(m) ? 0.7 : 0.35)) continue;
    const mr = famRank(m);
    let best = null, bs = -Infinity;
    for (let k = 0; k < Math.min(25, women.length); k++) {
      const w = women[randi(0, women.length - 1)];
      if (w.spouse || isKin(m, w) || faithHostility(m.fai, w.fai) >= 2) continue;
      const sc = -Math.abs(famRank(w) - mr) * 10 + (m.fai === w.fai ? 10 : 0) + (m.cul === w.cul ? 5 : 0) - Math.abs(age(w) - age(m) + 6) * 0.5 + (isRuler(w) ? -20 : 0);
      if (sc > bs) { bs = sc; best = w; }
    }
    if (best && bs > -40) {
      marry(m, best);
      const hm = isRuler(m) ? m : ch(m.court), hw = isRuler(best) ? best : ch(best.court);
      if (hm && hw && hm.id !== hw.id && !hm.liege && !hw.liege && (hm.kids.includes(m.id) || hm === m) && (hw.kids.includes(best.id) || hw === best) && chance(0.6)) {
        if (!s.alliances.some(x => (x.a === hm.id && x.b === hw.id) || (x.b === hm.id && x.a === hw.id))) s.alliances.push({ a: hm.id, b: hw.id, since: s.day, via: [m.id, best.id] });
      }
      if (rankOf(hm) >= 3 || rankOf(hw) >= 3) log(`${displayName(m)} has married ${displayName(best)}.`, { type: 'marriage', ids: [m.id, best.id], icon: '💍' });
    }
  }
}
function pruneDead() {
  const s = G.s; const ids = Object.keys(s.chars);
  if (ids.length < 2500) return;
  const ref = new Set();
  for (const id of ids) { const c = s.chars[id]; if (c.dead) continue; ref.add(c.father); ref.add(c.mother); ref.add(c.spouse); const f = s.chars[c.father]; if (f) { ref.add(f.father); ref.add(f.mother); } }
  for (const t of Object.values(s.titles)) for (const h of t.history || []) ref.add(h.holder);
  let n = 0;
  for (const id of ids) { const c = s.chars[id]; if (c.dead && !ref.has(c.id) && s.day - c.dead > 365 * 30 && c.id !== s.player) { delete s.chars[id]; n++; } }
  if (n) markDirty();
}

// ---------- Interactions ----------
export function arrangeMarriage(a, b) { marry(a, b); }
export function marriageAcceptance(proposer, mine, theirs) {
  const host = isRuler(theirs) ? theirs : ch(theirs.court) || theirs;
  let v = opinion(host, proposer) / 2 + (rankOf(proposer) - rankOf(host)) * 15 + (mine.traits.includes('beautiful') ? 10 : 0) + (mods(proposer).marriageAccept || 0);
  if (isKin(mine, theirs)) v -= 1000;
  if (faithHostility(mine.fai, theirs.fai) >= 2) v -= 60;
  if (rankOf(mine) && isRuler(theirs)) v -= 15;
  if (theirs === host && isRuler(theirs)) v -= 20;
  if (age(mine) > 45 && mine.f === false && age(theirs) < 30) v -= 10;
  return Math.round(v + 20);
}
