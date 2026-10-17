// Warfare: casus belli, wars, armies, movement, battles, sieges, raids, peace.
import { G, emit, markDirty } from '../state.js';
import { TERRAIN } from '../data/geography.js';
import { MAA } from '../data/traits.js';
import { faithHostility, FAITHS } from '../data/cultures.js';
import { findPath, edgeInfo } from '../world.js';
import { realmProvsOf } from './core.js';
import { ch, T, idx, topOf, rankOf, primary, domainOf, vassalsOf, allVassals, realmProvs, isRuler, mods, stat, prowess, giveTitle, setLiege, addPrestige, addPiety, addOpinion, opinion, log, notify, isPlayer, fullName, displayName, titleName, courtiersOf, faith, age, deJureCounties, involvesPlayer, liegeOf, rankName, createArtifact } from './core.js';
import { fortLevel, raidLoot, levyMax } from './economy.js';
import { rand, randi, chance, clamp, pick, ordinal, fmtNum } from '../util.js';

// ---------- War helpers ----------
// The war participant a character fights for: itself, or the nearest liege that is a participant.
export function partyOf(w, id) {
  let c = ch(id), g = 0;
  while (c && g++ < 12) { if (w.att.includes(c.id) || w.def.includes(c.id)) return c.id; if (!c.liege) break; c = ch(c.liege); }
  return 0;
}
export function sideOf(w, id) { const p = partyOf(w, id); if (!p) return null; return w.att.includes(p) ? 'att' : 'def'; }
export function warsOf(id) { return G.s.wars.filter(w => partyOf(w, id)); }
export function participantProvs(id) { const c = ch(id); if (!c) return []; return c.liege ? realmProvsOf(id) : realmProvs(id); }
export function areEnemies(a, b) {
  if (!a || !b) return false;
  const ta = topOf(a), tb = topOf(b); if (ta === tb) return false;
  for (const w of G.s.wars) { const sa = sideOf(w, a), sb = sideOf(w, b); if (sa && sb && sa !== sb) return w; }
  return false;
}
export function atWar(id) { return warsOf(id).length > 0; }
export function hasTruce(a, b) { const ta = topOf(a), tb = topOf(b); return G.s.truces.some(t => ((t.a === ta && t.b === tb) || (t.a === tb && t.b === ta)) && t.until > G.s.day); }
export function allied(a, b) { const ta = topOf(a), tb = topOf(b); return G.s.alliances.some(x => (x.a === ta && x.b === tb) || (x.a === tb && x.b === ta)); }
export function alliesOf(id) { const t = topOf(id); return G.s.alliances.filter(x => x.a === t || x.b === t).map(x => (x.a === t ? x.b : x.a)).filter(x => ch(x) && !ch(x).dead); }
export function adjacentRealms(id) {
  const I = idx(); const top = topOf(id); const set = new Set();
  for (const pid of realmProvs(top)) {
    const wp = G.world.provinces[pid];
    for (const n of wp.neighbors) { const t = I.provTop[n]; if (t && t !== top) set.add(t); }
    for (const l of wp.sea) if (l.d < 110) { const t = I.provTop[l.to]; if (t && t !== top) set.add(t); }
  }
  return [...set];
}
export function bordersProv(id, pid) {
  const I = idx(); const top = topOf(id); const wp = G.world.provinces[pid];
  return wp.neighbors.some(n => I.provTop[n] === top) || wp.sea.some(l => l.d < 110 && I.provTop[l.to] === top);
}

// ---------- Military strength ----------
export function perManPower(type) { if (!type || type === 'levy') return 1; const d = MAA[type]; return d ? (d.dmg + d.tough) / 20 : 1; }
export function armyPower(a) {
  let p = a.men; for (const [t, n] of Object.entries(a.maa)) p += n * perManPower(t);
  if (a.knights) p += a.knights;
  return p;
}
export function realmStrength(id) { // potential (not raised)
  const c = ch(id); if (!c) return 0;
  let p = c.levyMaxRaw || levyMax(c).total;
  for (const [t, n] of Object.entries(c.maa || {})) p += n * (MAA[t]?.size || 100) * perManPower(t);
  p += knightPower(c);
  return p;
}
export function currentStrength(id) {
  const c = ch(id); if (!c) return 0;
  let p = c.levyCur || 0; for (const [t, n] of Object.entries(c.maaCur || {})) p += n * perManPower(t);
  for (const a of G.s.armies) if (a.owner === id) p += armyPower(a);
  return p;
}
export function knights(c) {
  const pool = [...courtiersOf(c.id), ...vassalsOf(c.id)].map(ch).filter(k => k && !k.dead && age(k) >= 16 && age(k) < 65 && (!k.f || c.fai === 'norse_pagan' || k.traits.includes('brave')) && !k.imprisoned);
  if (age(c) >= 16 && age(c) < 65 && !c.f) pool.push(c);
  pool.sort((a, b) => prowess(b) - prowess(a));
  return pool.slice(0, 4 + rankOf(c) * 3);
}
export function knightPower(c) { const m = mods(c); return knights(c).reduce((s, k) => s + prowess(k) * 12, 0) * (1 + (m.knightEff || 0)); }

// ---------- Casus belli ----------
const CB_DEFS = {
  claim: { name: 'Press Claim', icon: '📜', desc: 'Enforce your claim on a title.' },
  conquest: { name: 'Duchy Conquest', icon: '⚔', desc: 'Conquer a duchy de jure part of your realm or bordering it.' },
  county: { name: 'County Conquest', icon: '🗡', desc: 'Seize a single bordering county.' },
  holy_war: { name: 'Holy War', icon: '✝', desc: 'Wage war on the infidel for a bordering duchy.' },
  subjugation: { name: 'Subjugation', icon: '⛓', desc: 'Force a ruler to become your vassal.' },
  independence: { name: 'Independence', icon: '🗽', desc: 'Throw off the yoke of your liege.' },
  crusade: { name: 'Great Holy War', icon: '✠', desc: 'A holy war for an entire kingdom, called by the head of faith.' },
  adventure: { name: 'Adventurer\'s Conquest', icon: '🧭', desc: 'A landless adventurer seizes a realm by the sword.' },
};
export const CB = CB_DEFS;

export function cbCost(cb, att, target) {
  const r = rankOf(att);
  switch (cb) {
    case 'claim': return { prestige: 50 * Math.max(1, T(target)?.rank || 1) };
    case 'conquest': return { prestige: att.gov === 'tribal' || att.gov === 'nomadic' ? 150 : 300 };
    case 'county': return { prestige: att.gov === 'tribal' || att.gov === 'nomadic' ? 60 : 120 };
    case 'holy_war': return { piety: G.s.struggle?.phase === 'hostility' && G.s.struggle.faiths?.includes(att.fai) ? 100 : 200 };
    case 'subjugation': return { prestige: 500 + r * 100 };
    case 'adventure': return { prestige: 400, gold: 100 };
    default: return {};
  }
}
export function canAfford(c, cost) { return (cost.prestige || 0) <= c.prestige && (cost.piety || 0) <= c.piety && (cost.gold || 0) <= c.gold; }

export function availableCBs(att, def) {
  const out = [];
  if (!att || !def || att.id === def.id || def.dead) return out;
  const ta = topOf(att.id), td = topOf(def.id);
  if (ta === td && att.liege !== def.id) return out; // same realm, not vs own liege
  const defTop = ch(td);
  // independence vs liege
  if (att.liege && att.liege === def.id) { out.push({ cb: 'independence', target: att.primary, label: 'Independence' }); return out; }
  if (att.liege) return out; // vassals cannot wage external wars (simplification)
  if (def.liege && td !== def.id) { /* target is a vassal: wars go to the top liege */ return availableCBs(att, defTop); }
  if (hasTruce(att.id, def.id)) return out;
  const I = idx();
  const defProvs = realmProvs(td);
  // claims
  for (const tid of att.claims || []) {
    const t = T(tid); if (!t) continue;
    const held = t.rank === 1 ? I.provTop[t.prov] === td : deJureCounties(tid).some(p => I.provTop[p] === td) || (t.holder && topOf(t.holder) === td);
    if (held) out.push({ cb: 'claim', target: tid, label: `Claim on ${titleName(t)}` });
  }
  // claims of family members (claimant wars)
  const fam = [...(att.kids || []), att.spouse].map(ch).filter(x => x && !x.dead);
  for (const k of fam) for (const tid of k.claims || []) {
    const t = T(tid); if (!t || !t.holder || topOf(t.holder) !== td) continue;
    out.push({ cb: 'claim', target: tid, claimant: k.id, label: `${k.name}'s claim on ${titleName(t)}` });
  }
  const bordering = defProvs.filter(p => bordersProv(att.id, p));
  // de jure duchy conquest: duchies where att holds a county, or bordering duchies for tribal/nomad
  const duchies = new Set();
  for (const p of bordering) duchies.add(G.world.provinces[p].duchy);
  const attProvs = realmProvs(ta);
  const attDuchies = new Set(attProvs.map(p => G.world.provinces[p].duchy));
  const attKingdoms = new Set(attProvs.map(p => G.world.provinces[p].kingdom));
  for (const d of duchies) {
    const inDuchy = deJureCounties(d).filter(p => I.provTop[p] === td);
    if (!inDuchy.length) continue;
    const dejure = attDuchies.has(d) || attKingdoms.has(G.world.provinces[inDuchy[0]].kingdom);
    if (dejure || att.gov === 'tribal' || att.gov === 'nomadic' || att.traits.includes('conqueror'))
      out.push({ cb: 'conquest', target: d, label: `Conquest of ${T(d).name}` });
    if (faithHostility(att.fai, defTop.fai) >= 2 || (faithHostility(att.fai, defTop.fai) >= 1 && faith(att.fai).family === 'pagan' && att.gov === 'tribal'))
      out.push({ cb: 'holy_war', target: d, label: `Holy War for ${T(d).name}` });
  }
  for (const p of bordering.slice(0, 12)) out.push({ cb: 'county', target: G.world.provinces[p].key, label: `Seize ${G.world.provinces[p].name}` });
  if ((att.gov === 'tribal' || att.gov === 'nomadic' || rankOf(att) >= 4) && rankOf(att) > rankOf(defTop) && bordering.length)
    out.push({ cb: 'subjugation', target: defTop.primary, label: `Subjugate ${displayName(defTop)}` });
  return out.map(o => ({ ...o, cost: cbCost(o.cb, att, o.target), ...CB_DEFS[o.cb] }));
}

// ---------- Declaring ----------
export function warName(w) {
  const a = ch(w.attLeader), d = ch(w.defLeader); const t = T(w.target);
  switch (w.cb) {
    case 'claim': return `War for ${titleName(t)}`;
    case 'conquest': return `Conquest of ${t?.name}`;
    case 'county': return `Seizure of ${t?.name}`;
    case 'holy_war': return `Holy War for ${t?.name}`;
    case 'subjugation': return `Subjugation of ${primary(d)?.name || d?.name}`;
    case 'independence': return `${primary(a)?.name || a.name}'s War of Independence`;
    case 'crusade': return `The ${ordinal(w.n || 1)} ${faith(a.fai).family === 'islamic' ? 'Jihad' : 'Crusade'} for ${t?.name}`;
    case 'adventure': return `${a.name}'s Adventure`;
    default: return 'War';
  }
}
export function declareWar(att, def, cbo, opts = {}) {
  if (!att || !def) return null;
  const cost = cbo.cost || cbCost(cbo.cb, att, cbo.target);
  if (!opts.free && !canAfford(att, cost)) return null;
  if (!opts.free) { att.prestige -= cost.prestige || 0; att.piety -= cost.piety || 0; att.gold -= cost.gold || 0; }
  const defLeader = cbo.cb === 'independence' ? def : ch(topOf(def.id));
  if (cbo.cb === 'independence') { att.rebelOf = att.liege; setLiege(att, 0); }
  const w = { id: G.s.nextId++, cb: cbo.cb, target: cbo.target, claimant: cbo.claimant || att.id, att: [att.id], def: [defLeader.id], attLeader: att.id, defLeader: defLeader.id, start: G.s.day, ws: 0, battle: 0, tick: 0, n: cbo.n, contrib: {}, events: [] };
  w.name = warName(w);
  G.s.wars.push(w);
  // allies join
  for (const side of ['att', 'def']) {
    const leader = ch(side === 'att' ? w.attLeader : w.defLeader);
    for (const al of alliesOf(leader.id)) {
      if (w.att.includes(al) || w.def.includes(al)) continue;
      const ac = ch(al); if (!ac || ac.liege) continue;
      const other = ch(side === 'att' ? w.defLeader : w.attLeader);
      if (allied(al, other.id)) continue;
      const wants = ac.llm ? true : opinion(ac, leader) + randi(-20, 40) > 10;
      if (wants || isPlayer(ac)) {
        if (isPlayer(ac)) { emit('callToArms', { war: w, ally: ac, side }); continue; }
        w[side].push(al); log(`${displayName(ac)} answered the call to arms of ${displayName(leader)}.`, { type: 'war', ids: [al, leader.id] });
      } else { addOpinion(leader, ac, -25, 'Refused call to arms', 60); }
    }
  }
  markDirty();
  const msg = `${displayName(att)} has declared war on ${displayName(defLeader)}: ${w.name}!`;
  log(msg, { type: 'war', ids: [att.id, defLeader.id], icon: '⚔' });
  addOpinion(defLeader, att, -40, 'Declared war on me', 120);
  if (involvesPlayer(att.id, defLeader.id) || w.att.includes(G.s.player) || w.def.includes(G.s.player)) notify(msg, { type: 'war', icon: '⚔', sound: 'war', important: true, ids: [att.id, defLeader.id] });
  emit('war', w);
  return w;
}
export function joinWar(w, id, side) { if (!w[side].includes(id)) { w[side].push(id); markDirty(); log(`${displayName(ch(id))} joined ${w.name}.`, { type: 'war', ids: [id] }); } }

// ---------- War score ----------
export function warTargets(w) {
  const I = idx(); const def = w.defLeader;
  if (w.cb === 'subjugation' || w.cb === 'independence') { const d = domainOf(def); return d.length ? d : realmProvs(def).slice(0, 3); }
  const t = T(w.target); if (!t) return [];
  if (t.rank === 1) return [t.prov];
  const cs = deJureCounties(w.target).filter(p => I.provOwner[p] && sideOf(w, I.provOwner[p]) === 'def');
  return cs.length ? cs : (t.holder ? domainOf(t.holder) : []);
}
export function updateWarscore(w) {
  const I = idx(); const targets = warTargets(w);
  let occ = 0; for (const p of targets) { const ctrl = G.s.provs[p].ctrl; if (ctrl && sideOf(w, ctrl) === 'att') occ++; }
  const occScore = targets.length ? 70 * occ / targets.length : 0;
  // defenders occupying attacker land
  let dOcc = 0, aTot = 0;
  for (const a of w.att) for (const p of participantProvs(a)) { aTot++; const ctrl = G.s.provs[p].ctrl; if (ctrl && sideOf(w, ctrl) === 'def') dOcc++; }
  const dScore = aTot ? 70 * dOcc / aTot : 0;
  const attCap = ch(w.attLeader)?.capital, defCap = ch(w.defLeader)?.capital;
  let cap = 0;
  if (defCap !== null && defCap !== undefined && G.s.provs[defCap]?.ctrl && sideOf(w, G.s.provs[defCap].ctrl) === 'att') cap += 10;
  if (attCap !== null && attCap !== undefined && G.s.provs[attCap]?.ctrl && sideOf(w, G.s.provs[attCap].ctrl) === 'def') cap -= 10;
  w.occ = occ; w.targetsN = targets.length;
  w.ws = clamp(Math.round(occScore - dScore + w.battle + w.tick + cap), -100, 100);
  return w.ws;
}
export function monthlyWars() {
  for (const w of [...G.s.wars]) {
    const targets = warTargets(w);
    if (!targets.length && w.cb !== 'independence' && w.cb !== 'subjugation') { endWar(w, 'white', 'The war goal vanished'); continue; }
    const ageM = (G.s.day - w.start) / 30;
    if (w.occ && w.occ === w.targetsN) w.tick = Math.min(40, w.tick + 2);
    else if (w.occ && w.occ >= w.targetsN / 2) w.tick = Math.min(30, w.tick + 1);
    else if (ageM > 12 && !w.occ) w.tick = Math.max(-40, w.tick - 1);
    updateWarscore(w);
    const att = ch(w.attLeader), def = ch(w.defLeader);
    if (!att || att.dead || !def || def.dead) { endWar(w, 'white'); continue; }
    if (!isRuler(att)) { endWar(w, 'def', 'The attacker lost all titles'); continue; }
    if (!isRuler(def)) { endWar(w, 'att', 'The defender lost all titles'); continue; }
    // AI peace decisions
    const playerSide = sideOf(w, G.s.player);
    if (w.ws >= 100 && !(playerSide === 'att' && isPlayer(att))) { endWar(w, 'att', 'Demands enforced'); continue; }
    if (w.ws <= -100 && !(playerSide === 'def' && isPlayer(def))) { endWar(w, 'def', 'Demands enforced'); continue; }
    if (playerSide !== 'def' && !def.llm && (w.ws >= 99 || (w.ws >= 80 && chance(0.4)) || (w.ws >= 50 && ageM > 30 && chance(0.15)))) { endWar(w, 'att'); continue; }
    if (playerSide !== 'att' && !att.llm && (w.ws <= -99 || (w.ws <= -80 && chance(0.4)) || (w.ws <= -50 && ageM > 30 && chance(0.15)))) { endWar(w, 'def'); continue; }
    if (!playerSide && Math.abs(w.ws) < 25 && ageM > 60 && chance(0.1)) { endWar(w, 'white'); continue; }
  }
}
export function peaceAcceptance(w, proposerId, type) {
  const side = sideOf(w, proposerId); const ws = side === 'att' ? w.ws : -w.ws; // proposer's perspective
  const ageM = (G.s.day - w.start) / 30;
  if (type === 'enforce') return ws >= 100 ? 100 : -100;
  if (type === 'surrender') return 100; // proposer surrenders
  if (type === 'demand') return clamp(Math.round(ws * 1.2 - 50 + ageM * 0.5), -100, 100); // other side surrenders
  if (type === 'white') return clamp(Math.round(ws + ageM * 0.6 - 10), -100, 100);
  return 0;
}

// ---------- Ending ----------
function transferCounty(pid, toId) {
  const key = G.world.provinces[pid].key; const t = T(key); const holder = ch(t.holder);
  if (holder && holder.id === toId) return;
  // if the holder is a vassal whose whole domain is being transferred, swap liege instead
  giveTitle(key, toId, { how: 'conquered' });
}
export function endWar(w, result, why) {
  const att = ch(w.attLeader), def = ch(w.defLeader);
  const I = idx(); const s = G.s;
  G.s.wars = G.s.wars.filter(x => x !== w);
  let text = '';
  const benef = ch(w.claimant) && !ch(w.claimant).dead ? ch(w.claimant) : att;
  if (result === 'att' && att && def) {
    switch (w.cb) {
      case 'claim': case 'conquest': case 'county': case 'holy_war': case 'crusade': case 'adventure': {
        let winner = benef;
        if (w.cb === 'crusade') { const best = Object.entries(w.contrib).sort((a, b) => b[1] - a[1])[0]; if (best && ch(+best[0])) winner = ch(+best[0]); }
        const t = T(w.target);
        const counties = t.rank === 1 ? [t.prov] : deJureCounties(w.target).filter(p => I.provOwner[p] && sideOf(w, I.provOwner[p]) === 'def');
        // vassals entirely inside the target swear fealty to the winner
        const vassalsInside = new Set();
        for (const p of counties) { const h = ch(I.provOwner[p]); if (h && h.id !== def.id && h.liege) vassalsInside.add(h.id); }
        for (const vid of vassalsInside) { const v = ch(vid); if (domainOf(vid).every(p => counties.includes(p))) { setLiege(v, winner.id); } }
        for (const p of counties) { const h = I.provOwner[p]; if (!vassalsInside.has(h) || !domainOf(h).every(q => counties.includes(q))) transferCounty(p, winner.id); }
        if (t.rank > 1 && (!t.holder || w.def.includes(topOf(t.holder)) || topOf(t.holder) === def.id)) giveTitle(w.target, winner.id, { how: 'conquered' });
        if (winner.id !== att.id && winner.liege !== att.id && w.cb === 'claim' && winner.id !== topOf(att.id) && rankOf(winner) < rankOf(att)) setLiege(winner, att.id);
        if (w.cb === 'holy_war' || w.cb === 'crusade') { addPiety(winner, 300); }
        addPrestige(winner, 150 + 50 * (t.rank || 1)); winner.conquests = (winner.conquests || 0) + counties.length;
        text = `${displayName(winner)} won ${w.name}. ${titleName(t)} changes hands.`;
        if (w.cb === 'crusade' || w.cb === 'holy_war') { const fs = G.s.faiths[winner.fai]; if (fs) fs.fervor = clamp((fs.fervor || 50) + 15, 0, 100); }
        break;
      }
      case 'subjugation': setLiege(def, att.id); addPrestige(att, 300); text = `${displayName(def)} has bent the knee to ${displayName(att)}.`; break;
      case 'independence': att.rebelOf = 0; addPrestige(att, 200); addPrestige(def, -150); text = `${displayName(att)} has won independence from ${displayName(def)}!`; break;
    }
    if (att) addPrestige(att, 100);
    if (def) addPrestige(def, -100);
  } else if (result === 'def' && att && def) {
    const rep = Math.min(Math.max(0, att.gold), 40 * Math.max(1, rankOf(att)));
    att.gold -= rep; def.gold += rep; addPrestige(def, 120); addPrestige(att, -150);
    if (w.cb === 'independence') { setLiege(att, def.id); att.rebelOf = 0; addOpinion(def, att, -50, 'Rebelled against me', 120); }
    text = `${displayName(def)} has defended against ${w.name}. ${displayName(att)} pays ${Math.round(rep)} gold.`;
  } else {
    if (w.cb === 'independence' && att) { setLiege(att, def.id); att.rebelOf = 0; }
    text = `${w.name} ended in a white peace.`;
    if (att) addPrestige(att, -50);
  }
  // clear occupations
  for (const pid in s.provs) { const p = s.provs[pid]; if (p.ctrl && (sideOf(w, p.ctrl) || !G.s.chars[p.ctrl] || G.s.chars[p.ctrl].dead)) { if (!areEnemies(p.ctrl, I.provOwner[+pid] || I.provTop[+pid])) { p.ctrl = 0; p.siege = 0; } } }
  if (att && def) G.s.truces.push({ a: topOf(att.id), b: topOf(def.id), until: G.s.day + 365 * 5 });
  G.s.battles = G.s.battles.filter(b => G.s.armies.some(a => b.A.includes(a.id)) && G.s.armies.some(a => b.D.includes(a.id)));
  log(text + (why ? ` (${why})` : ''), { type: 'war', ids: [w.attLeader, w.defLeader], icon: '🕊' });
  if (w.att.includes(G.s.player) || w.def.includes(G.s.player) || involvesPlayer(w.attLeader, w.defLeader)) notify(text, { type: (result === 'att' && sideOf(w, G.s.player) === 'att') || (result === 'def' && sideOf(w, G.s.player) === 'def') ? 'good' : result === 'white' ? 'info' : 'bad', icon: '🕊', important: true });
  markDirty(); emit('peace', { w, result });
}

// ---------- Armies ----------
export function raiseArmy(c, at, opts = {}) {
  const loc = at ?? c.capital ?? domainOf(c.id)[0] ?? realmProvs(c.id)[0];
  if (loc === undefined || loc === null) return null;
  const men = Math.floor(opts.levies === false ? 0 : (c.levyCur || 0));
  const maa = {}; for (const [t, n] of Object.entries(c.maaCur || {})) { if (n >= 1) { maa[t] = Math.floor(n); c.maaCur[t] -= Math.floor(n); } }
  if (men < 20 && !Object.keys(maa).length) return null;
  c.levyCur = (c.levyCur || 0) - men;
  const cmd = bestCommander(c);
  const a = { id: G.s.nextId++, owner: c.id, men, maa, loc, path: [], prog: 0, cmdr: cmd?.id || c.id, ready: G.s.day + (opts.instant ? 0 : 5), raid: false, loot: 0, siege: 0, start: men + Object.values(maa).reduce((x, y) => x + y, 0) };
  const main = !G.s.armies.some(x => x.owner === c.id);
  if (main) a.knights = knightPower(c);
  G.s.armies.push(a);
  return a;
}
export function bestCommander(c) {
  const pool = [c, ...courtiersOf(c.id).map(ch), ...vassalsOf(c.id).map(ch)].filter(k => k && !k.dead && age(k) >= 16 && !k.imprisoned && (!k.f || c.fai === 'norse_pagan' || k.id === c.id));
  pool.sort((a, b) => stat(b, 'mar') + (mods(b).advantage || 0) / 2 - stat(a, 'mar') - (mods(a).advantage || 0) / 2);
  return pool[0];
}
export function disbandArmy(a) {
  const c = ch(a.owner);
  if (c) { c.levyCur = (c.levyCur || 0) + a.men; c.maaCur = c.maaCur || {}; for (const [t, n] of Object.entries(a.maa)) c.maaCur[t] = (c.maaCur[t] || 0) + n; if (a.loot) { c.gold += a.loot; if (isPlayer(c)) notify(`Your raiders return with ${Math.round(a.loot)} gold in plunder!`, { type: 'good', icon: '💰' }); } }
  G.s.armies = G.s.armies.filter(x => x !== a);
  G.s.battles.forEach(b => { b.A = b.A.filter(x => x !== a.id); b.D = b.D.filter(x => x !== a.id); });
}
export function moveArmy(a, dest) {
  if (a.battle) return false;
  const path = findPath(G.world, a.loc, dest);
  if (!path) return false;
  a.path = path; a.prog = 0; a.siege = 0; a.retreat = false;
  return true;
}
export function splitArmy(a) {
  if (a.men < 100) return null;
  const b = { ...a, id: G.s.nextId++, men: Math.floor(a.men / 2), maa: {}, path: [], prog: 0, knights: 0, loot: 0 };
  a.men -= b.men;
  for (const [t, n] of Object.entries(a.maa)) { const h = Math.floor(n / 2); b.maa[t] = h; a.maa[t] -= h; }
  G.s.armies.push(b); return b;
}
export function mergeArmies(a, b) {
  if (a.loc !== b.loc || a.owner !== b.owner) return false;
  a.men += b.men; for (const [t, n] of Object.entries(b.maa)) a.maa[t] = (a.maa[t] || 0) + n; a.knights = Math.max(a.knights || 0, b.knights || 0); a.loot += b.loot;
  G.s.armies = G.s.armies.filter(x => x !== b); return true;
}
export function armyPos(a) {
  const P = G.world.provinces; const cur = P[a.loc];
  if (!a.path.length || a.prog <= 0) return [cur.hx, cur.hy];
  const nxt = P[a.path[0]]; const e = edgeInfo(G.world, a.loc, a.path[0]);
  if (e.sea) { const [ax, ay] = e.link.a, [bx, by] = e.link.b; const t = a.prog; if (t < 0.15) return [cur.hx + (ax - cur.hx) * t / 0.15, cur.hy + (ay - cur.hy) * t / 0.15]; if (t > 0.85) { const u = (t - 0.85) / 0.15; return [bx + (nxt.hx - bx) * u, by + (nxt.hy - by) * u]; } const u = (t - 0.15) / 0.7; return [ax + (bx - ax) * u, ay + (by - ay) * u]; }
  return [cur.hx + (nxt.hx - cur.hx) * a.prog, cur.hy + (nxt.hy - cur.hy) * a.prog];
}
export function armyAtSea(a) { if (!a.path.length || a.prog <= 0.12 || a.prog >= 0.88) return false; return edgeInfo(G.world, a.loc, a.path[0]).sea; }
export function provController(pid) { const p = G.s.provs[pid]; return p.ctrl || idx().provTop[pid]; }
export function canRaid(c) { return c.gov === 'tribal' || c.gov === 'nomadic' || faith(c.fai).family === 'pagan' || c.traits.includes('viking'); }

// ---------- Daily military tick ----------
export function dailyArmies() {
  const s = G.s, P = G.world.provinces;
  for (const a of [...s.armies]) {
    if (!s.armies.includes(a)) continue;
    const owner = ch(a.owner);
    if (!owner || owner.dead || !isRuler(owner)) { s.armies = s.armies.filter(x => x !== a); continue; }
    if (a.men + Object.values(a.maa).reduce((x, y) => x + y, 0) < 15) { disbandArmy(a); continue; }
    if (a.battle) continue;
    if (s.day < a.ready) continue;
    // movement
    if (a.path.length) {
      const next = a.path[0]; const e = edgeInfo(G.world, a.loc, next);
      const terr = TERRAIN[P[next].terrain]?.move || 1;
      const winter = isWinter(next) ? 0.8 : 1;
      const spd = 11 * (e.sea ? 1.1 : terr) * winter * (1 + (mods(owner).moveSpeed || 0)) * (a.retreat ? 1.3 : 1);
      a.prog += spd / Math.max(20, e.len);
      if (a.prog >= 1) {
        a.loc = next; a.path.shift(); a.prog = 0;
        if (a.retreat && !a.path.length) a.retreat = false;
        enterProvince(a);
      }
      continue;
    }
    // stationary: sieges / raids
    const ctrl = provController(a.loc);
    const war = areEnemies(a.owner, ctrl);
    const p = s.provs[a.loc];
    if (war) {
      const enemyHere = s.armies.some(o => o.loc === a.loc && !o.path.length && areEnemies(o.owner, a.owner));
      if (enemyHere) continue;
      // liberation or siege
      const fl = fortLevel(a.loc);
      const siegeMen = a.men + Object.entries(a.maa).reduce((x, [t, n]) => x + n * (t === 'siege' ? 30 : 1), 0);
      const rate = Math.min(0.06, (siegeMen / (fl * 900 + 600)) * 0.012 * (1 + (mods(owner).siegeSpeed || 0)));
      p.siege = Math.min(1, (p.siege || 0) + rate); p.sieger = a.id;
      if (p.siege >= 1) {
        const origTop = idx().provTop[a.loc], origOwner = idx().provOwner[a.loc] || origTop;
        const liberating = !!p.ctrl && !areEnemies(a.owner, origOwner);
        const party = war ? partyOf(war, a.owner) || topOf(a.owner) : topOf(a.owner);
        p.ctrl = liberating ? 0 : party; p.siege = 0; p.sieger = 0;
        const loot = raidLoot(a.loc) * 0.6; a.loot += loot;
        const w = war; if (w) { w.contrib[party] = (w.contrib[party] || 0) + 10; updateWarscore(w); }
        const msg = liberating ? `${P[a.loc].name} has been liberated.` : `${P[a.loc].name} has fallen to the armies of ${displayName(ch(party))}.`;
        const mineA = party === G.s.player || topOf(a.owner) === G.s.player;
        if (involvesPlayer(a.owner, origTop, origOwner) || mineA || origTop === G.s.player) notify(msg, { type: mineA ? 'good' : 'bad', icon: '🏰', prov: a.loc });
        emit('siegeDone', { prov: a.loc, army: a });
        markDirty(); G.mapDirty = true;
      }
    } else if (a.raid && canRaid(owner) && ctrl && topOf(ctrl) !== topOf(a.owner) && !allied(ctrl, a.owner) && !(p.raided > s.day)) {
      const rate = 0.035 * (1 + (mods(owner).raidSpeed || 0));
      p.siege = Math.min(1, (p.siege || 0) + rate); p.sieger = a.id;
      if (p.siege >= 1) {
        const loot = raidLoot(a.loc); a.loot += loot; p.siege = 0; p.raided = s.day + 365 * 2; p.dev = Math.max(0, p.dev - 1.5);
        const victim = ch(topOf(ctrl));
        if (victim) { addOpinion(victim, owner, -20, 'Raided my lands', 60); if (victim.id === G.s.player) notify(`${displayName(owner)}'s raiders have plundered ${P[a.loc].name}!`, { type: 'bad', icon: '🔥', prov: a.loc }); }
        addPrestige(owner, 15);
        if (owner.id === G.s.player) notify(`Your raiders sacked ${P[a.loc].name}: +${Math.round(loot)} gold of loot.`, { type: 'good', icon: '💰' });
        if (chance(0.15) && !owner.traits.includes('viking') && faith(owner.fai).family === 'pagan') { owner.traits.push('viking'); }
      }
    } else if (a.loot > 0 && topOf(ctrl) === topOf(a.owner)) {
      owner.gold += a.loot; if (isPlayer(owner)) notify(`Plunder deposited: +${Math.round(a.loot)} gold.`, { type: 'good', icon: '💰' }); a.loot = 0;
    } else if (p.siege && p.sieger === a.id) { p.siege = Math.max(0, p.siege - 0.02); }
  }
  dailyBattles();
}
export function isWinter(pid) { const m = Math.floor((G.s.day % 365) / 30.4); const lat = G.world.provinces[pid].lat; return (m === 11 || m <= 1) && lat > 50; }

function enterProvince(a) {
  const s = G.s;
  const enemies = s.armies.filter(o => o !== a && o.loc === a.loc && !o.retreat && areEnemies(o.owner, a.owner) && !(o.path.length && o.prog > 0));
  if (enemies.length && !a.retreat) startBattle(a.loc, [a], enemies);
  // reset siege progress if someone else was sieging
  const p = s.provs[a.loc];
  if (p.sieger && !s.armies.some(x => x.id === p.sieger)) { p.siege = 0; p.sieger = 0; }
}

// ---------- Battles ----------
function sidePower(ids) { return ids.map(id => G.s.armies.find(a => a.id === id)).filter(Boolean).reduce((s, a) => s + armyPower(a), 0); }
function sideCmdr(ids) { let best = null; for (const id of ids) { const a = G.s.armies.find(x => x.id === id); const c = a && ch(a.cmdr); if (c && (!best || stat(c, 'mar') > stat(best, 'mar'))) best = c; } return best; }
export function startBattle(pid, A, D) {
  const s = G.s;
  const existing = s.battles.find(b => b.prov === pid);
  if (existing) { for (const a of A) { const sideA = existing.A.some(id => { const x = s.armies.find(y => y.id === id); return x && !areEnemies(x.owner, a.owner); }); (sideA ? existing.A : existing.D).push(a.id); a.battle = existing.id; a.path = []; } return existing; }
  const b = { id: s.nextId++, prov: pid, A: A.map(a => a.id), D: D.map(a => a.id), start: s.day, day: 0, log: [] };
  for (const a of [...A, ...D]) { a.battle = b.id; a.path = []; a.prog = 0; }
  b.powA0 = sidePower(b.A); b.powD0 = sidePower(b.D);
  b.menA0 = A.reduce((x, a) => x + a.men + Object.values(a.maa).reduce((p, q) => p + q, 0), 0);
  b.menD0 = D.reduce((x, a) => x + a.men + Object.values(a.maa).reduce((p, q) => p + q, 0), 0);
  s.battles.push(b);
  const pa = ch(A[0].owner), pd = ch(D[0].owner);
  if (topOf(pa.id) === G.s.player || topOf(pd.id) === G.s.player) notify(`Battle has begun at ${G.world.provinces[pid].name}!`, { type: 'war', icon: '⚔', prov: pid, sound: 'battle' });
  emit('battleStart', b);
  return b;
}
function applyLoss(a, powLoss) {
  const total = armyPower(a); if (total <= 0) return;
  const f = Math.min(1, powLoss / total);
  a.men = Math.max(0, a.men - a.men * f * 1.15);
  for (const t of Object.keys(a.maa)) a.maa[t] = Math.max(0, a.maa[t] - a.maa[t] * f * (40 / (MAA[t]?.tough + 20 || 40)));
  if (a.knights) a.knights *= (1 - f * 0.5);
}
function counterBonus(own, enemy) {
  let bonus = 0, tot = 0;
  for (const a of own) for (const [t, n] of Object.entries(a.maa)) { tot += n; const d = MAA[t]; if (!d) continue; for (const e of enemy) for (const [et, en] of Object.entries(e.maa)) if (d.counters.includes(MAA[et]?.type)) bonus += Math.min(n, en) * 0.5; }
  return tot ? bonus / tot : 0;
}
function dailyBattles() {
  const s = G.s;
  for (const b of [...s.battles]) {
    const A = b.A.map(id => s.armies.find(a => a.id === id)).filter(Boolean), D = b.D.map(id => s.armies.find(a => a.id === id)).filter(Boolean);
    if (!A.length || !D.length) { s.battles = s.battles.filter(x => x !== b); for (const a of [...A, ...D]) a.battle = 0; continue; }
    b.day++;
    const ca = sideCmdr(b.A), cd = sideCmdr(b.D);
    const terr = TERRAIN[G.world.provinces[b.prov].terrain];
    const defHome = topOf(D[0].owner) === idx().provTop[b.prov] ? 1 : 0;
    let advA = (ca ? stat(ca, 'mar') + (mods(ca).advantage || 0) : 0) - (cd ? stat(cd, 'mar') + (mods(cd).advantage || 0) : 0);
    advA -= (terr?.def || 0) * 20 * (defHome ? 1 : 0.5);
    const pa = A.reduce((x, a) => x + armyPower(a), 0), pd = D.reduce((x, a) => x + armyPower(a), 0);
    const ka = 1 + clamp(advA, -30, 30) * 0.025 + counterBonus(A, D) * 0.2, kd = 1 - clamp(advA, -30, 30) * 0.02 + counterBonus(D, A) * 0.2;
    const dmgToD = pa * 0.035 * Math.max(0.3, ka) * (0.8 + rand() * 0.4), dmgToA = pd * 0.035 * Math.max(0.3, kd) * (0.8 + rand() * 0.4);
    for (const a of A) applyLoss(a, dmgToA * armyPower(a) / Math.max(1, pa));
    for (const d of D) applyLoss(d, dmgToD * armyPower(d) / Math.max(1, pd));
    const ra = A.reduce((x, a) => x + armyPower(a), 0) / Math.max(1, b.powA0), rd = D.reduce((x, a) => x + armyPower(a), 0) / Math.max(1, b.powD0);
    b.ra = ra; b.rd = rd;
    if (ra < 0.45 || rd < 0.45 || b.day >= 14) finishBattle(b, A, D, ra >= rd ? 'A' : 'D', ca, cd);
  }
}
function finishBattle(b, A, D, win, ca, cd) {
  const s = G.s;
  s.battles = s.battles.filter(x => x !== b);
  const W = win === 'A' ? A : D, L = win === 'A' ? D : A;
  const wc = win === 'A' ? ca : cd, lc = win === 'A' ? cd : ca;
  // pursuit
  const pursuit = W.reduce((x, a) => x + Object.entries(a.maa).reduce((p, [t, n]) => p + n * (MAA[t]?.pursuit || 0), 0), 0);
  for (const l of L) applyLoss(l, armyPower(l) * Math.min(0.5, 0.12 + pursuit / 40000));
  for (const a of [...A, ...D]) a.battle = 0;
  const menL0 = win === 'A' ? b.menD0 : b.menA0, menW0 = win === 'A' ? b.menA0 : b.menD0;
  const menL = L.reduce((x, a) => x + a.men + Object.values(a.maa).reduce((p, q) => p + q, 0), 0), menW = W.reduce((x, a) => x + a.men + Object.values(a.maa).reduce((p, q) => p + q, 0), 0);
  const war = areEnemies(W[0].owner, L[0].owner);
  const winner = ch(war ? partyOf(war, W[0].owner) : topOf(W[0].owner)) || ch(W[0].owner), loser = ch(war ? partyOf(war, L[0].owner) : topOf(L[0].owner)) || ch(L[0].owner);
  const importance = Math.round(clamp(100 * (menL0 - menL) / Math.max(2500, menL0 + menW0) * 1.6, 3, 35));
  if (war) { const side = sideOf(war, W[0].owner); war.battle = clamp(war.battle + (side === 'att' ? importance : -importance), -50, 50); war.contrib[winner.id] = (war.contrib[winner.id] || 0) + importance; updateWarscore(war); }
  addPrestige(winner, 20 + importance * 3); addPrestige(loser, -10);
  winner.wins = (winner.wins || 0) + 1; if (wc && wc !== winner) wc.wins = (wc.wins || 0) + 1;
  if (wc && wc.id !== winner.id) addPrestige(wc, 15);
  // casualties among commanders and knights
  const fates = [];
  if (lc && chance(0.08)) { killInBattle(lc, wc); fates.push(`${lc.name} fell in battle`); }
  else if (lc && chance(0.18)) { addTraitSafe(lc, 'wounded'); fates.push(`${lc.name} was wounded`); }
  if (wc && chance(0.03)) { killInBattle(wc, lc); fates.push(`${wc.name} fell in battle`); }
  else if (wc && chance(0.1)) { addTraitSafe(wc, chance(0.5) ? 'scarred' : 'wounded'); }
  if (wc && !wc.dead && chance(0.04) && rankOf(winner) >= 2) { const a = createArtifact(winner, chance(0.5) ? 'banner' : 'sword', chance(0.2) ? 1 : 0, `${pick(['Banner', 'Standard', 'Blade'])} of ${G.world.provinces[b.prov].name}`, { origin: `Taken at the Battle of ${G.world.provinces[b.prov].name}` }); fates.push(`${a.name} was captured`); }
  // retreat losers
  for (const l of L) {
    const dest = retreatDest(l);
    if (dest !== null && dest !== l.loc) { moveArmy(l, dest); l.retreat = true; } else disbandArmy(l);
  }
  const pn = G.world.provinces[b.prov].name;
  const text = `Battle of ${pn}: ${displayName(winner)} defeated ${displayName(loser)}. Losses — victors ${fmtNum(menW0 - menW)}, vanquished ${fmtNum(menL0 - menL)}.${fates.length ? ' ' + fates.join('; ') + '.' : ''}`;
  log(text, { type: 'battle', ids: [winner.id, loser.id], icon: '⚔' });
  const pTop = G.s.player;
  if (winner.id === pTop || loser.id === pTop || topOf(W[0].owner) === pTop || topOf(L[0].owner) === pTop || involvesPlayer(winner.id, loser.id)) notify(text, { type: winner.id === pTop ? 'good' : 'bad', icon: '⚔', prov: b.prov, important: true, sound: winner.id === pTop ? 'victory' : 'defeat' });
  emit('battleEnd', { b, winner, loser, prov: b.prov, menW0, menW, menL0, menL, wc: wc?.id, lc: lc?.id, fates, playerWon: winner.id === pTop || topOf(W[0].owner) === pTop, playerIn: winner.id === pTop || loser.id === pTop || topOf(W[0].owner) === pTop || topOf(L[0].owner) === pTop });
  // winners resume siege automatically
  for (const w of W) if (!w.path.length) enterProvince(w);
}
function addTraitSafe(c, t) { if (!c.traits.includes(t)) c.traits.push(t); }
function killInBattle(c, by) { emit('killChar', { c, cause: 'battle', killer: by?.id }); }
function retreatDest(a) {
  const I = idx(); const top = topOf(a.owner);
  let best = null, bd = Infinity; const from = G.world.provinces[a.loc];
  for (const pid of realmProvs(top)) {
    if (G.s.provs[pid].ctrl) continue;
    if (G.s.armies.some(o => o.loc === pid && areEnemies(o.owner, a.owner))) continue;
    const p = G.world.provinces[pid]; const d = Math.hypot(p.ax - from.ax, p.ay - from.ay);
    if (d < bd && pid !== a.loc) { bd = d; best = pid; }
  }
  return best;
}

// ---------- AI army control ----------
export function aiArmies() {
  const s = G.s; const I = idx();
  const owners = new Set(s.armies.map(a => a.owner));
  // raise armies for AI at war
  for (const w of s.wars) for (const id of [...w.att, ...w.def]) {
    const c = ch(id); if (!c || c.dead || (isPlayer(c) && !s.flags.autoArmy)) continue;
    const raised = s.armies.filter(a => a.owner === id).length;
    if (!raised && (c.levyCur > 200 || Object.values(c.maaCur || {}).some(n => n > 30))) raiseArmy(c);
    else if (raised && c.levyCur > (c.levyMax || 0) * 0.5 && c.levyCur > 1500 && raised < 3) raiseArmy(c);
  }
  for (const a of s.armies) {
    const c = ch(a.owner); if (!c || (isPlayer(c) && !s.flags.autoArmy)) continue;
    if (a.battle || a.retreat || s.day < a.ready) continue;
    const wars = warsOf(a.owner);
    if (!wars.length) {
      if (a.raid) { aiRaid(a, c); continue; }
      if (!a.path.length) disbandArmy(a);
      continue;
    }
    if (a.path.length && rand() < 0.7) continue; // keep course mostly
    const myPow = armyPower(a);
    // threats & opportunities
    let target = null, bestScore = -Infinity;
    for (const o of s.armies) {
      if (!areEnemies(o.owner, a.owner)) continue;
      const d = dist(a.loc, o.loc); if (d > 520) continue;
      const op = armyPower(o);
      if (op < myPow * 0.9) { const sc = 1000 - d + (myPow - op) * 0.02; if (sc > bestScore) { bestScore = sc; target = o.loc; } }
    }
    if (target === null) {
      // nearest enemy holding to siege (war targets prioritized)
      for (const w of wars) {
        const side = sideOf(w, a.owner); const enemies = side === 'att' ? w.def : w.att;
        const tg = side === 'att' ? warTargets(w) : [];
        const cand = new Set(tg);
        for (const e of enemies) for (const p of participantProvs(e)) cand.add(p);
        // liberate own occupied land
        for (const p of realmProvs(topOf(a.owner))) if (s.provs[p].ctrl) cand.add(p);
        for (const p of cand) {
          const ctrl = provController(p); if (!areEnemies(ctrl, a.owner) && !(s.provs[p].ctrl && topOf(a.owner) === I.provTop[p])) continue;
          const danger = s.armies.filter(o => areEnemies(o.owner, a.owner) && dist(o.loc, p) < 150).reduce((x, o) => x + armyPower(o), 0);
          if (danger > myPow * 1.1) continue;
          const sc = 800 - dist(a.loc, p) + (tg.includes(p) ? 300 : 0) + (s.provs[p].siege || 0) * 200 + (s.armies.some(x => x.loc === p && !areEnemies(x.owner, a.owner) && x !== a) ? -250 : 0);
          if (sc > bestScore) { bestScore = sc; target = p; }
        }
      }
    }
    // flee if a much stronger enemy is near
    const threat = s.armies.find(o => areEnemies(o.owner, a.owner) && dist(a.loc, o.loc) < 160 && armyPower(o) > myPow * 1.4);
    if (threat) { const r = retreatDest(a); if (r !== null && dist(r, threat.loc) > dist(a.loc, threat.loc)) target = r; }
    if (target !== null && target !== a.loc && (!a.path.length || a.path[a.path.length - 1] !== target)) moveArmy(a, target);
  }
}
function aiRaid(a, c) {
  if (a.path.length) return;
  const p = G.s.provs[a.loc];
  const ctrl = provController(a.loc);
  if (a.loot > 120 || (a.loot > 0 && rand() < 0.05)) { if (topOf(ctrl) !== topOf(c.id)) { const home = c.capital; if (home !== null) moveArmy(a, home); } else disbandArmy(a); return; }
  if (topOf(ctrl) !== topOf(c.id) && !(p.raided > G.s.day)) return; // keep raiding here
  // find raid target
  let best = null, bd = Infinity;
  for (const wp of G.world.provinces) {
    const t = idx().provTop[wp.id]; if (!t || t === topOf(c.id) || allied(t, c.id) || G.s.provs[wp.id].raided > G.s.day) continue;
    if (faith(ch(t).fai).family === faith(c.fai).family && c.fai === ch(t).fai) continue;
    const d = dist(a.loc, wp.id); if (d < bd && d < 600) { bd = d; best = wp.id; }
  }
  if (best !== null) moveArmy(a, best); else disbandArmy(a);
}
export function dist(a, b) { const P = G.world.provinces; return Math.hypot(P[a].ax - P[b].ax, P[a].ay - P[b].ay); }
