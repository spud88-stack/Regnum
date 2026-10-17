// Classic (non-LLM) strategic AI.
import { G } from '../state.js';
import { TRAITS, BUILDINGS, MAA, ACTIVITIES } from '../data/traits.js';
import { ch, T, idx, rankOf, isPlayer, domainOf, courtiersOf, vassalsOf, realmProvs, topOf, opinion, mods, stat, domainLimit, isAdult, age, giveTitle, setLiege } from './core.js';
import { availableCBs, declareWar, atWar, realmStrength, alliesOf, adjacentRealms, raiseArmy, canAfford, allied, canRaid } from './war.js';
import { recruitMaa, maaCap, availableMaa, startBuilding, buildCost } from './economy.js';
import { allianceAcceptance, makeAlliance, breakAlliance, startScheme, grantTitle } from './intrigue.js';
import { startActivity, canStartActivity } from './events.js';
import { isLLMActive } from './llm.js';
import { rand, chance, pick, randi } from '../util.js';

export function personality(c) {
  const p = { boldness: 0, greed: 0, honor: 0, compassion: 0, rationality: 0, energy: 0, sociability: 0, vengefulness: 0, zeal: 0 };
  for (const t of c.traits) for (const [k, v] of Object.entries(TRAITS[t]?.ai || {})) p[k] += v;
  return p;
}
export function strengthWithAllies(id) { return realmStrength(id) + alliesOf(id).reduce((s, a) => s + realmStrength(a) * 0.5, 0); }

export function monthlyAI() {
  const I = idx(); const m = Math.floor(G.s.day / 30);
  for (const id of I.rulers) {
    const c = ch(id); if (!c || c.dead || isPlayer(c)) continue;
    if ((id + m) % 3) continue;
    const llmDriven = c.llm && isLLMActive();
    aiEconomy(c);
    if (!llmDriven) {
      if (!c.liege && realmProvs(id).length) aiWar(c);
      aiDiplomacy(c);
      aiPersonal(c);
    }
    aiManage(c);
  }
}

function aiEconomy(c) {
  const r = rankOf(c);
  const reserve = 60 + r * 60;
  if (c.gold < reserve) return;
  const regs = Object.values(c.maa || {}).reduce((a, b) => a + b, 0);
  if (regs < maaCap(c) && chance(0.6)) {
    const opts = availableMaa(c); const t = chance(0.5) ? opts[0] : pick(opts.filter(x => x !== 'siege'));
    if (c.gold - MAA[t].cost > reserve * 0.6) { recruitMaa(c, t, 1); return; }
  }
  const dom = domainOf(c.id); if (!dom.length) return;
  const pid = pick(dom); const p = G.s.provs[pid]; if (p.build) return;
  const pref = ['farms', 'market', 'barracks', 'walls', 'temple', 'stables', 'university'];
  for (const b of pref) { const lv = p.b?.[b] || 0; if (lv < 3 && c.gold - buildCost(c, b, lv) > reserve * 0.5) { startBuilding(c, pid, b); return; } }
}

function aiWar(c) {
  if (atWar(c.id)) return;
  const pers = personality(c);
  const p = 0.07 * (1 + pers.boldness / 60 + pers.energy / 80 + pers.greed / 120 + pers.zeal / 150) * (c.traits.includes('conqueror') ? 2 : 1) * (c.gold < -50 ? 0.3 : 1);
  if (!chance(Math.max(0.01, p))) return;
  const mine = strengthWithAllies(c.id);
  let best = null, bs = -Infinity;
  for (const t of adjacentRealms(c.id)) {
    const tc = ch(t); if (!tc || tc.dead || allied(c.id, t)) continue;
    const cbs = availableCBs(c, tc).filter(cb => canAfford(c, cb.cost));
    if (!cbs.length) continue;
    const theirs = strengthWithAllies(t);
    const ratio = mine / Math.max(100, theirs);
    if (ratio < 1.35 - pers.boldness * 0.004) continue;
    for (const cb of cbs) {
      let sc = ratio * 20 + (cb.cb === 'claim' ? 30 : cb.cb === 'conquest' ? 20 : cb.cb === 'holy_war' ? 15 + pers.zeal / 3 : cb.cb === 'subjugation' ? 25 : 5) - opinion(c, tc) / 4 + rand() * 15;
      if (tc.id === G.s.player) sc += 5;
      if (sc > bs) { bs = sc; best = { tc, cb }; }
    }
  }
  if (best) declareWar(c, best.tc, best.cb);
}

function aiDiplomacy(c) {
  if (c.liege) return;
  if (chance(0.04)) {
    const n = adjacentRealms(c.id).map(ch).filter(x => x && !x.liege && !isPlayer(x) && !allied(c.id, x.id) && opinion(c, x) > 20);
    const t = n.length ? pick(n) : null;
    if (t && allianceAcceptance(c, t) > 0 && alliesOf(c.id).length < 3) makeAlliance(c, t);
  }
  for (const a of alliesOf(c.id)) { const ac = ch(a); if (ac && opinion(c, ac) < -40 && chance(0.1) && !isPlayer(ac)) breakAlliance(c, ac); }
}

function aiPersonal(c) {
  const pers = personality(c);
  if (c.stress > 50 && chance(0.3)) { const t = chance(0.5) ? 'feast' : 'hunt'; if (canStartActivity(c, t)) startActivity(c, t); }
  if (rankOf(c) >= 3 && chance(0.03) && canStartActivity(c, 'tournament') && c.gold > 300) startActivity(c, 'tournament');
  if (chance(0.015) && canStartActivity(c, 'pilgrimage') && pers.zeal > 20) startActivity(c, 'pilgrimage');
  // schemes
  if (chance(0.02 + Math.max(0, -pers.honor) / 2000 + Math.max(0, -pers.compassion) / 2000)) {
    const rivals = c.rel.rivals.map(ch).filter(x => x && !x.dead);
    if (rivals.length && pers.honor < 20) startScheme(c, pick(rivals), 'murder');
  }
  if (chance(0.015) && c.traits.includes('lustful')) { const t = pick(courtiersOf(c.id).map(ch).filter(x => x && x.f !== c.f && isAdult(x))); if (t) startScheme(c, t, 'seduce'); }
  if (chance(0.02) && c.liege) startScheme(c, ch(c.liege), 'sway');
  // raids
  if (!atWar(c.id) && canRaid(c) && chance(0.05) && c.gold < 200 && !G.s.armies.some(a => a.owner === c.id)) { const a = raiseArmy(c); if (a) a.raid = true; }
}

function aiManage(c) {
  // grant counties if over domain limit
  const dom = domainOf(c.id); const over = dom.length - domainLimit(c);
  if (over > 0 && chance(0.4)) {
    const cand = courtiersOf(c.id).map(ch).filter(x => x && isAdult(x) && !x.imprisoned && (x.dyn && x.dyn !== c.dyn || age(x) > 20)).sort((a, b) => (b.dyn === c.dyn ? 1 : 0) - (a.dyn === c.dyn ? 1 : 0))[0];
    const pid = dom.filter(p => p !== c.capital).pop();
    if (cand && pid !== undefined) grantTitle(c, cand, G.world.provinces[pid].key);
  }
  // chaplain converts heathen domain counties
  if (c.councilTasks && domainOf(c.id).some(p => G.s.provs[p].fai !== c.fai)) c.councilTasks.chaplain = 'convert';
  if (c.councilTasks && !c.liege && chance(0.1)) c.councilTasks.chancellor = chance(0.4) ? 'claim' : 'domestic';
}
