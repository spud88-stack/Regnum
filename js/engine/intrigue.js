// Intrigue: schemes, council tasks, factions, hooks, character interactions.
import { G, emit, markDirty } from '../state.js';
import { COUNCIL } from '../data/traits.js';
import { faithHostility } from '../data/cultures.js';
import { ch, T, idx, age, isAdult, isRuler, rankOf, primary, giveTitle, setLiege, vassalsOf, courtiersOf, domainOf, mods, stat, addTrait, opinion, addOpinion, log, notify, isPlayer, displayName, titleName, isKin, involvesPlayer, topOf, addPrestige, addPiety, realmProvs, liegeOf, faith, prowess } from './core.js';
import { kill } from './life.js';
import { realmStrength, declareWar, bordersProv, atWar, allied, adjacentRealms } from './war.js';
import { rand, randi, chance, pick, clamp } from '../util.js';

export const SCHEMES = {
  murder: { name: 'Murder', icon: '🗡', stat: 'int', hostile: true, desc: 'Arrange an untimely death.' },
  seduce: { name: 'Seduce', icon: '💋', stat: 'int', hostile: false, desc: 'Become their lover.' },
  befriend: { name: 'Befriend', icon: '🤝', stat: 'dip', hostile: false, desc: 'Become their friend.' },
  sway: { name: 'Sway', icon: '🌹', stat: 'dip', hostile: false, desc: 'Improve their opinion of you.' },
  fabricate: { name: 'Fabricate Claim', icon: '📜', stat: 'dip', hostile: true, desc: 'Forge documents proving your right to a title.' },
};

function spymasterOf(c) { const host = isRuler(c) ? c : ch(c.court); return host?.councilMembers?.spymaster ? ch(host.councilMembers.spymaster) : null; }
export function schemePower(type, owner, target) {
  const m = mods(owner); const def = SCHEMES[type];
  let p = stat(owner, def.stat) * 1.2 + (m.schemePower || 0) * 20;
  const sm = spymasterOf(owner); if (sm && sm.id !== owner.id) p += stat(sm, 'int') * 0.3;
  if (owner.councilTasks?.spymaster === 'network') p += 4;
  if (type === 'seduce') p += (m.seduce || 0) * 15 + (target.traits.includes('lustful') ? 6 : 0) - (target.traits.includes('chaste') ? 10 : 0) + (owner.traits.includes('beautiful') ? 6 : 0);
  if (type === 'befriend' || type === 'sway') p += (target.traits.includes('gregarious') ? 4 : 0) + opinion(target, owner) / 10;
  return Math.max(1, p);
}
export function schemeResist(type, target) {
  const m = mods(target); let r = stat(target, 'int') * (type === 'murder' ? 1 : 0.5) + (m.schemeDef || 0) * 20;
  const sm = spymasterOf(target); if (sm) r += stat(sm, 'int') * 0.5;
  const host = isRuler(target) ? target : ch(target.court);
  if (host?.councilTasks?.spymaster === 'disrupt') r += 5;
  if (type === 'murder') r += rankOf(target) * 3;
  return Math.max(1, r);
}
export function canScheme(owner, target, type) {
  if (!owner || !target || owner.id === target.id || target.dead) return false;
  if (G.s.schemes.some(s => s.owner === owner.id && s.type === type && s.target === target.id)) return false;
  if (G.s.schemes.filter(s => s.owner === owner.id).length >= 2 + Math.floor(stat(owner, 'int') / 10)) return false;
  if (type === 'seduce' && (owner.f === target.f || age(target) < 16 || owner.rel.lovers.includes(target.id) || isKin(owner, target))) return false;
  if (type === 'befriend' && owner.rel.friends.includes(target.id)) return false;
  if (type === 'fabricate') return false;
  return true;
}
export function startScheme(owner, target, type) {
  if (!canScheme(owner, target, type)) return null;
  const s = { id: G.s.nextId++, type, owner: owner.id, target: target.id, prog: 0, start: G.s.day, secrecy: 0.5 + stat(owner, 'int') / 60 };
  G.s.schemes.push(s);
  if (isPlayer(owner)) log(`You began a scheme to ${SCHEMES[type].name.toLowerCase()} ${displayName(target)}.`, { type: 'scheme', ids: [target.id], icon: SCHEMES[type].icon });
  return s;
}
export function schemeOdds(s) {
  const o = ch(s.owner), t = ch(s.target); if (!o || !t) return 0;
  return clamp(Math.round(45 + (schemePower(s.type, o, t) - schemeResist(s.type, t)) * 2.5), 5, 95);
}
export function monthlySchemes() {
  for (const s of [...G.s.schemes]) {
    const o = ch(s.owner), t = ch(s.target);
    if (!o || !t || o.dead || t.dead) { G.s.schemes = G.s.schemes.filter(x => x !== s); continue; }
    const pw = schemePower(s.type, o, t), rs = schemeResist(s.type, t);
    s.prog += clamp(4 + (pw - rs) * 0.6, 1.5, 14);
    // discovery
    if (!s.discovered && SCHEMES[s.type].hostile && chance(0.035 * (1 - s.secrecy) * (rs / Math.max(5, pw)))) {
      s.discovered = true;
      addOpinion(t, o, s.type === 'murder' ? -80 : -30, s.type === 'murder' ? 'Plotted my murder' : 'Schemed against me', 240);
      t.hooks = t.hooks || {}; t.hooks[o.id] = 'strong';
      if (isPlayer(t)) notify(`Your spymaster has uncovered a plot: ${displayName(o)} is scheming to ${SCHEMES[s.type].name.toLowerCase()} you!`, { type: 'bad', icon: '🕵', ids: [o.id], important: true });
      if (isPlayer(o)) notify(`Your scheme against ${displayName(t)} has been discovered!`, { type: 'bad', icon: '🕵', ids: [t.id] });
      if (chance(0.5)) { G.s.schemes = G.s.schemes.filter(x => x !== s); continue; }
    }
    if (s.prog >= 100) { G.s.schemes = G.s.schemes.filter(x => x !== s); resolveScheme(s, o, t); }
  }
}
function resolveScheme(s, o, t) {
  const ok = chance(schemeOdds(s) / 100);
  const pl = isPlayer(o) || isPlayer(t);
  switch (s.type) {
    case 'murder':
      if (ok) {
        kill(t, 'murder', o.id); o.stress += o.traits.includes('compassionate') ? 40 : o.traits.includes('callous') || o.traits.includes('sadistic') ? 0 : 15;
        if (chance(0.3)) { addTrait(o, 'murderer'); o.secrets = o.secrets || []; }
        else { o.secrets = o.secrets || []; o.secrets.push({ type: 'murder', about: t.id, day: G.s.day }); }
        if (isKin(o, t)) addTrait(o, 'kinslayer');
        if (isPlayer(o)) notify(`${displayName(t)} is dead. No one suspects you... yet.`, { type: 'good', icon: '🗡', ids: [t.id], important: true });
      } else {
        addOpinion(t, o, -60, 'Attempted to murder me', 240);
        if (isPlayer(o)) notify(`Your assassins failed to kill ${displayName(t)}.`, { type: 'bad', icon: '🗡' });
        if (isPlayer(t)) notify(`An assassin sent by ${displayName(o)} was caught in your chambers!`, { type: 'bad', icon: '🗡', ids: [o.id], important: true });
      }
      break;
    case 'seduce':
      if (ok) { o.rel.lovers.push(t.id); t.rel.lovers.push(o.id); if (t.traits.includes('chaste')) t.stress += 20; if (pl) notify(`${o.name} and ${t.name} have become lovers.`, { type: isPlayer(o) ? 'good' : 'info', icon: '💋', ids: [o.id, t.id] }); }
      else { addOpinion(t, o, -15, 'Rebuffed advances', 60); if (isPlayer(o)) notify(`${t.name} rejected your advances.`, { type: 'bad', icon: '💔' }); }
      break;
    case 'befriend':
      if (ok) { o.rel.friends.push(t.id); t.rel.friends.push(o.id); if (pl) notify(`${o.name} and ${t.name} are now friends.`, { type: 'good', icon: '🤝', ids: [t.id] }); }
      else if (isPlayer(o)) notify(`Your attempt to befriend ${t.name} came to nothing.`, { type: 'info', icon: '🤝' });
      break;
    case 'sway':
      addOpinion(t, o, ok ? 35 : 10, 'Swayed', 120);
      if (isPlayer(o)) notify(ok ? `${t.name} has been swayed in your favor.` : `${t.name} was only mildly impressed.`, { type: ok ? 'good' : 'info', icon: '🌹' });
      break;
  }
}

// ---------- Council tasks ----------
export function councillor(c, post) { const id = c.councilMembers?.[post]; const m = ch(id); return m && !m.dead ? m : null; }
export function monthlyCouncil() {
  const I = idx();
  for (const id of I.rulers) {
    const c = ch(id); if (rankOf(c) < 2 || !c.councilMembers) continue;
    const tasks = c.councilTasks || {};
    const chan = councillor(c, 'chancellor'), mar = councillor(c, 'marshal'), stew = councillor(c, 'steward'), spy = councillor(c, 'spymaster'), chap = councillor(c, 'chaplain');
    if (chan) {
      const sk = stat(chan, 'dip');
      if (tasks.chancellor === 'domestic') for (const v of vassalsOf(id)) { const vc = ch(v); if (chance(0.3)) addOpinion(vc, c, 1, 'Chancellor\'s diplomacy', 24); const l = vc.op?.[c.id]?.find(x => x.r === 'Chancellor\'s diplomacy'); if (l) l.v = Math.min(l.v, 5 + sk / 2); }
      else if (tasks.chancellor === 'relations') { const n = adjacentRealms(id); if (n.length) { const t = ch(pick(n)); addOpinion(t, c, 2, 'Chancellor\'s envoy', 36); const l = t.op?.[c.id]?.find(x => x.r === 'Chancellor\'s envoy'); if (l) l.v = Math.min(l.v, 10 + sk); } }
      else if (tasks.chancellor === 'claim') fabricateProgress(c, chan);
    }
    if (spy) {
      if (tasks.spymaster === 'secrets' && chance(0.02 + stat(spy, 'int') * 0.003)) {
        const pool = [...vassalsOf(id), ...courtiersOf(id), ...adjacentRealms(id)].map(ch).filter(x => x && x.secrets?.length);
        const t = pool.length ? pick(pool) : null;
        if (t) { c.hooks = c.hooks || {}; c.hooks[t.id] = 'strong'; if (isPlayer(c)) notify(`Your spymaster discovered a dark secret about ${displayName(t)}. You now hold a strong hook on them.`, { type: 'good', icon: '🕵', ids: [t.id] }); }
        else if (chance(0.3)) { const any = [...vassalsOf(id), ...courtiersOf(id)].map(ch).filter(Boolean); if (any.length) { const x = pick(any); c.hooks = c.hooks || {}; if (!c.hooks[x.id]) { c.hooks[x.id] = 'weak'; if (isPlayer(c)) notify(`Your spymaster found compromising letters of ${displayName(x)}: weak hook gained.`, { type: 'good', icon: '🕵', ids: [x.id] }); } } }
      }
    }
    if (chap) {
      if (tasks.chaplain === 'convert') {
        const target = domainOf(id).find(p => G.s.provs[p].fai !== c.fai);
        if (target !== undefined) {
          const p = G.s.provs[target]; p.conv = (p.conv || 0) + 1.5 + stat(chap, 'lea') * 0.25 + (mods(c).conversion || 0) * 3;
          if (p.conv >= 100) { p.conv = 0; p.fai = c.fai; markDirty(); if (isPlayer(c)) notify(`${G.world.provinces[target].name} has converted to ${faith(c.fai).name}.`, { type: 'good', icon: faith(c.fai).icon }); }
        }
      } else if (tasks.chaplain === 'piety') addPiety(c, 0.5 + stat(chap, 'lea') * 0.08);
      else if (tasks.chaplain === 'relations') for (const v of vassalsOf(id)) { const vc = ch(v); if (vc.gov === 'theocracy') addOpinion(vc, c, 1, 'Clergy relations', 24); }
    }
    if (mar && tasks.marshal === 'train' && chance(0.15)) { const ks = courtiersOf(id).map(ch).filter(k => k && isAdult(k) && !k.f); if (ks.length) pick(ks).base.pro += 1; }
  }
}
function fabricateProgress(c, chan) {
  if (!c.fab || !T(c.fab.target) || T(c.fab.target).holder && topOf(T(c.fab.target).holder) === topOf(c.id)) {
    const I = idx(); const top = topOf(c.id);
    const cands = [];
    for (const pid of realmProvs(top)) for (const n of G.world.provinces[pid].neighbors) { const t = I.provTop[n]; if (t && t !== top) cands.push(G.world.provinces[n].key); }
    if (!cands.length) { c.fab = null; return; }
    c.fab = { target: c.fabPick && cands.includes(c.fabPick) ? c.fabPick : pick(cands), prog: 0 };
  }
  c.fab.prog += 1 + stat(chan, 'dip') * 0.18;
  if (c.fab.prog >= 100) {
    c.claims = c.claims || []; if (!c.claims.includes(c.fab.target)) c.claims.push(c.fab.target);
    if (isPlayer(c)) notify(`Your chancellor has fabricated a claim on ${titleName(T(c.fab.target))}!`, { type: 'good', icon: '📜', title: c.fab.target, important: true });
    c.fab = null;
  }
}

// ---------- Factions ----------
export function yearlyFactions() {
  const I = idx();
  for (const id of I.rulers) {
    const liege = ch(id); if (rankOf(liege) < 2) continue;
    const vs = vassalsOf(id).map(ch).filter(v => v && !v.dead && !atWar(v.id));
    if (G.s.wars.some(w => w.cb === 'independence' && w.defLeader === id)) continue;
    const angry = vs.filter(v => opinion(v, liege) < -35 && !isPlayer(v));
    liege.faction = null;
    if (!angry.length) continue;
    const power = angry.reduce((s, v) => s + realmStrength(v.id), 0);
    const lp = realmStrength(id) - power;
    const ratio = power / Math.max(1, lp);
    liege.faction = { members: angry.map(v => v.id), power: Math.round(ratio * 100) };
    if (ratio > 1.0 && chance(0.25)) {
      const leader = angry.sort((a, b) => realmStrength(b.id) - realmStrength(a.id))[0];
      const w = declareWar(leader, liege, { cb: 'independence', target: leader.primary }, { free: true });
      if (w) for (const m of angry) if (m !== leader) { m.rebelOf = m.liege; setLiege(m, 0); w.att.push(m.id); }
      if (isPlayer(liege)) notify(`An independence faction led by ${displayName(leader)} has risen in revolt!`, { type: 'bad', icon: '🔥', important: true, sound: 'war' });
    }
  }
}

// ---------- Interactions ----------
export function giftAmount(from) { return Math.max(15, Math.round((from.lastIncome?.gross || 5) * 6)); }
export function sendGift(from, to, amount) {
  amount = amount ?? giftAmount(from); if (from.gold < amount) return false;
  from.gold -= amount; to.gold += amount;
  addOpinion(to, from, clamp(Math.round(amount / Math.max(5, (to.lastIncome?.gross || 5)) * 4), 5, 40) + (to.traits.includes('greedy') ? 10 : 0), 'Received a gift', 60);
  return true;
}
export function allianceAcceptance(from, to) {
  if (allied(from.id, to.id)) return -999;
  const fam = isKin(from, to) || (from.kids.some(k => ch(k)?.spouse && (ch(ch(k).spouse)?.father === to.id || ch(ch(k).spouse)?.mother === to.id))) || (from.spouse && (ch(from.spouse)?.father === to.id));
  let v = opinion(to, from) - 10 + (fam ? 30 : -25) + (mods(from).allianceAccept || 0) + (realmStrength(from.id) / Math.max(1, realmStrength(to.id)) - 1) * 15;
  if (faithHostility(from.fai, to.fai) >= 2) v -= 50;
  return Math.round(v);
}
export function makeAlliance(a, b) { G.s.alliances.push({ a: a.id, b: b.id, since: G.s.day }); log(`${displayName(a)} and ${displayName(b)} have formed an alliance.`, { type: 'diplomacy', ids: [a.id, b.id], icon: '🤝' }); markDirty(); }
export function breakAlliance(a, b) { G.s.alliances = G.s.alliances.filter(x => !((x.a === a.id && x.b === b.id) || (x.a === b.id && x.b === a.id))); addOpinion(b, a, -30, 'Broke our alliance', 120); addPrestige(a, -100); }
export function vassalizeAcceptance(from, to) {
  if (to.liege || rankOf(to) >= rankOf(from)) return -999;
  const ratio = realmStrength(from.id) / Math.max(1, realmStrength(to.id));
  let v = opinion(to, from) + (ratio - 3) * 12 + (from.cul === to.cul ? 10 : -10) + (from.fai === to.fai ? 10 : -30) - rankOf(to) * 10;
  return Math.round(v);
}
export function imprison(by, target) {
  target.imprisoned = by.id; target.court = by.id;
  const crime = by.hooks?.[target.id] === 'strong' || target.traits.includes('murderer') || (target.rebelOf === by.id);
  if (!crime) { by.tyranny = (by.tyranny || 0) + 15; for (const v of vassalsOf(by.id)) addOpinion(ch(v), by, -10, 'Tyranny', 60); }
  addOpinion(target, by, -50, 'Imprisoned me', 240);
  for (const a of G.s.armies) if (a.cmdr === target.id) a.cmdr = a.owner;
  markDirty();
}
export function release(by, target) { target.imprisoned = 0; addOpinion(target, by, 15, 'Released me', 60); }
export function execute(by, target) {
  const crime = target.traits.includes('murderer') || target.rebelOf === by.id || by.hooks?.[target.id] === 'strong';
  by.dreadBase = (by.dreadBase || 0) + 15;
  if (!crime) { by.tyranny = (by.tyranny || 0) + 30; for (const v of vassalsOf(by.id)) addOpinion(ch(v), by, -20, 'Executed an innocent', 120); }
  if (isKin(by, target)) addTrait(by, 'kinslayer');
  kill(target, 'execution', by.id);
}
export function revokeTitle(by, vassal, tid) {
  const t = T(tid); if (!t || t.holder !== vassal.id) return;
  const crime = vassal.rebelOf === by.id || by.hooks?.[vassal.id] === 'strong';
  giveTitle(tid, by.id, { how: 'revoked' });
  if (!crime) { by.tyranny = (by.tyranny || 0) + 20; for (const v of vassalsOf(by.id)) addOpinion(ch(v), by, -15, 'Revoked titles', 120); }
  addOpinion(vassal, by, -60, 'Revoked my title', 240);
  if (!vassal.titles.length) { vassal.liege = 0; vassal.court = by.id; }
  markDirty();
}
export function grantTitle(by, to, tid) {
  const t = T(tid); if (!t || t.holder !== by.id || to.id === by.id) return;
  giveTitle(tid, to.id, { how: 'granted' });
  if (!to.liege || to.liege === by.id || to.court === by.id) setLiege(to, by.id);
  to.court = 0;
  if (!to.gov) to.gov = by.gov;
  addOpinion(to, by, 30 + t.rank * 10, 'Granted me a title', 240);
  markDirty();
}
export function inviteAcceptance(by, target) {
  if (isRuler(target)) return -999;
  const host = ch(target.court);
  let v = (host ? -opinion(target, host) / 2 : 20) + opinion(target, by) / 2 + rankOf(by) * 8 - (target.spouse ? 30 : 0) - (host && (host.kids.includes(target.id)) ? 60 : 0);
  return Math.round(v);
}
