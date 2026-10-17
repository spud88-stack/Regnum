// Economy: taxes, levies, men-at-arms, buildings, development, innovations, lifestyle progress.
import { G } from '../state.js';
import { TERRAIN } from '../data/geography.js';
import { BUILDINGS, MAA, BASE_MAA, CROWN_AUTHORITY, INNOVATIONS, LIFESTYLES, PERK_INDEX, ERAS } from '../data/traits.js';
import { CULTURES } from '../data/cultures.js';
import { ch, T, idx, domainOf, vassalsOf, rankOf, mods, stat, isRuler, culture, addPrestige, addPiety, domainLimit, addTrait, log, notify, isPlayer, age, invalidateMods } from './core.js';
import { clamp, rand, pick, chance } from '../util.js';

export const GOV_TAX = { feudal: 1, clan: 0.8, tribal: 0.5, republic: 1.3, theocracy: 0.9, nomadic: 0.6, imperial: 1.15 };
export const GOV_LEVY = { feudal: 1, clan: 1.1, tribal: 1.35, republic: 0.6, theocracy: 0.8, nomadic: 1.5, imperial: 0.9 };

export function countyTax(pid) {
  const p = G.s.provs[pid], wp = G.world.provinces[pid];
  let t = (0.45 + p.dev * 0.055) * (TERRAIN[wp.terrain]?.tax || 1);
  for (const [b, lv] of Object.entries(p.b || {})) for (let i = 0; i < lv; i++) t += BUILDINGS[b]?.tax?.[i] || 0;
  if (p.ctrl) t *= 0.25; // occupied
  if (p.raided && p.raided > G.s.day) t *= 0.5;
  return t;
}
export function countyLevy(pid) {
  const p = G.s.provs[pid], wp = G.world.provinces[pid];
  let l = (130 + p.dev * 13) * (TERRAIN[wp.terrain]?.levy || 1);
  for (const [b, lv] of Object.entries(p.b || {})) for (let i = 0; i < lv; i++) l += BUILDINGS[b]?.levy?.[i] || 0;
  if (p.ctrl) l *= 0.2;
  return l;
}
export function fortLevel(pid) {
  const p = G.s.provs[pid];
  let f = 1 + (p.b?.walls || 0);
  if (p.wonderFort) f += p.wonderFort;
  const holder = ch(T(G.world.provinces[pid].key)?.holder);
  if (holder) f += mods(holder).fort || 0;
  if (holder && holder.capital === pid) f += 1;
  return f;
}

// Vassal obligation rates
export function vassalTaxRate(v) { const l = ch(v.liege); if (!l) return 0; const ca = CROWN_AUTHORITY[l.laws?.crown ?? 1]; return ca.tax * (v.gov === 'theocracy' ? 0.7 : v.gov === 'republic' ? 1.4 : 1); }
export function vassalLevyRate(v, opinionVal) { const l = ch(v.liege); if (!l) return 0; const ca = CROWN_AUTHORITY[l.laws?.crown ?? 1]; return clamp(ca.levy + (opinionVal ?? 0) / 400, 0.05, 0.8); }

// Income breakdown for a ruler (monthly)
export function income(c) {
  const m = mods(c);
  let domain = 0; for (const pid of domainOf(c.id)) domain += countyTax(pid);
  const over = Math.max(0, domainOf(c.id).length - domainLimit(c));
  const domainMult = (1 + (m.taxMult || 0) + stat(c, 'ste') * 0.02) * (GOV_TAX[c.gov] || 1) * Math.max(0.3, 1 - over * 0.12);
  domain *= domainMult;
  let fromVassals = 0; for (const v of vassalsOf(c.id)) { const vc = ch(v); fromVassals += (vc.grossIncome || 0) * vassalTaxRate(vc); }
  const flat = m.taxFlat || 0;
  const gross = domain + fromVassals + flat;
  const toLiege = c.liege ? gross * vassalTaxRate(c) : 0;
  // expenses
  let maa = 0; for (const [t, n] of Object.entries(c.maa || {})) maa += (MAA[t]?.upkeep || 0) * n;
  maa *= Math.max(0.4, 1 + (m.maaUpkeep || 0));
  let armies = 0; for (const a of G.s.armies) if (a.owner === c.id) { armies += a.men * 0.0018; for (const [t, n] of Object.entries(a.maa)) armies += (MAA[t]?.upkeep || 0) * (n / (MAA[t]?.size || 100)); }
  let court = 0; const am = c.amenities; if (am) court = (am.food + am.servants + am.fashion + am.lodging - 4) * 0.35 * Math.max(1, rankOf(c) - 1);
  const merc = (c.mercs || []).reduce((s, x) => s + x.upkeep, 0);
  const expenses = maa + armies + Math.max(0, court) + merc;
  return { domain, fromVassals, flat, gross, toLiege, maa, armies, court: Math.max(0, court), merc, expenses, net: gross - toLiege - expenses };
}

export function levyMax(c) {
  const m = mods(c);
  let own = 0; for (const pid of domainOf(c.id)) own += countyLevy(pid);
  own *= (1 + (m.levyMult || 0)) * (GOV_LEVY[c.gov] || 1);
  let fromV = 0; for (const v of vassalsOf(c.id)) { const vc = ch(v); fromV += (vc.levyMaxRaw || 0) * vassalLevyRate(vc, vc.opinionOfLiege || 0); }
  return { own, fromV, total: own + fromV };
}

export function maaMen(c) { let n = 0; for (const [t, r] of Object.entries(c.maa || {})) n += r * (MAA[t]?.size || 100); return n; }
export function availableMaa(c) {
  const out = [...BASE_MAA]; const cm = culture(c.cul).maa; if (cm && MAA[cm] && !out.includes(cm)) out.unshift(cm);
  return out.filter(t => t !== 'camel' || ['arabic', 'berber'].includes(culture(c.cul).group));
}
export function maaCap(c) { return 2 + rankOf(c) * 2 + Math.floor(stat(c, 'mar') / 6); }
export function recruitMaa(c, type, n = 1) {
  const def = MAA[type]; if (!def) return false;
  const cur = Object.values(c.maa || {}).reduce((a, b) => a + b, 0);
  if (cur + n > maaCap(c) * 3) return false;
  const cost = def.cost * n; if (c.gold < cost) return false;
  c.gold -= cost; c.maa = c.maa || {}; c.maa[type] = (c.maa[type] || 0) + n;
  c.maaCur = c.maaCur || {}; c.maaCur[type] = (c.maaCur[type] || 0) + n * def.size * 0.5;
  return true;
}
export function disbandMaa(c, type, n = 1) { if (!c.maa?.[type]) return; c.maa[type] = Math.max(0, c.maa[type] - n); if (!c.maa[type]) delete c.maa[type]; if (c.maaCur?.[type]) c.maaCur[type] = Math.min(c.maaCur[type], (c.maa[type] || 0) * MAA[type].size); }

// Buildings
export function buildCost(c, b, level) { return Math.round(BUILDINGS[b].cost[level] * Math.max(0.4, 1 + (mods(c).buildCost || 0))); }
export function canBuild(c, pid, b) {
  const p = G.s.provs[pid]; const lv = p.b?.[b] || 0;
  if (lv >= 3 || p.build) return false;
  return c.gold >= buildCost(c, b, lv);
}
export function startBuilding(c, pid, b) {
  const p = G.s.provs[pid]; const lv = p.b?.[b] || 0; if (lv >= 3 || p.build) return false;
  const cost = buildCost(c, b, lv); if (c.gold < cost) return false;
  c.gold -= cost; p.build = { b, lvl: lv + 1, done: G.s.day + 120 + lv * 90, start: G.s.day };
  return true;
}

// ---------- Monthly processing ----------
export function monthlyEconomy() {
  const I = idx();
  // depth ordering: deepest vassals first so gross income flows upward
  const depth = id => { let d = 0, c = ch(id); while (c && c.liege && d < 10) { c = ch(c.liege); d++; } return d; };
  const rulers = I.rulers.map(id => [id, depth(id)]).sort((a, b) => b[1] - a[1]).map(x => ch(x[0]));
  for (const c of rulers) {
    // levies raw
    const lm = levyMax(c); c.levyMaxRaw = lm.total;
    if (c.liege) c.opinionOfLiege = G.opinionCache?.get(c.id) ?? 0;
    const inc = income(c); c.grossIncome = inc.gross; c.lastIncome = inc;
    c.gold += inc.net;
    // prestige / piety
    const m = mods(c); const r = rankOf(c);
    addPrestige(c, 0.15 * r * r + (m.prestigeGain || 0) + (c.gold < 0 ? -1 : 0));
    let piety = 0.25 + stat(c, 'lea') * 0.03 + (m.pietyGain || 0);
    for (const pid of I.domain.get(c.id) || []) piety += [0, 0.15, 0.25, 0.4][G.s.provs[pid].b?.temple || 0];
    if (c.gov === 'theocracy') piety += 1;
    addPiety(c, piety);
    if (c.gold < -100 && chance(0.1)) { c.stress += 5; if (isPlayer(c)) notify('Your treasury is deep in debt! Vassals and soldiers grow restless.', { type: 'bad' }); }
  }
  // levy regeneration & maa reinforcement for independent realms (levies flow to the top)
  for (const id of I.rulers) {
    const c = ch(id);
    const max = c.liege ? c.levyMaxRaw * (1 - vassalLevyRate(c, c.opinionOfLiege || 0)) : c.levyMaxRaw;
    c.levyMax = max;
    const raised = G.s.armies.filter(a => a.owner === id).reduce((s, a) => s + a.men, 0);
    const cap = Math.max(0, max - raised);
    c.levyCur = Math.min(cap, (c.levyCur ?? cap) + max * 0.06 * (1 + (mods(c).levyRegen || 0)));
    // maa reinforcement
    for (const [t, n] of Object.entries(c.maa || {})) {
      const full = n * MAA[t].size; c.maaCur = c.maaCur || {};
      const inField = G.s.armies.filter(a => a.owner === id).reduce((s, a) => s + (a.maa[t] || 0), 0);
      c.maaCur[t] = Math.min(full - inField, (c.maaCur[t] || 0) + full * 0.1);
      if (c.maaCur[t] < 0) c.maaCur[t] = 0;
    }
    // mercenary contracts
    if (c.mercs) c.mercs = c.mercs.filter(m => m.until > G.s.day || G.s.armies.some(a => a.merc === m.id));
  }
  // development & buildings
  G.world.provinces.forEach(wp => {
    const p = G.s.provs[wp.id];
    const holder = ch(I.provOwner[wp.id]);
    let g = 0.006 + (holder ? stat(holder, 'ste') * 0.0006 + (mods(holder).devGrowth || 0) * 0.01 : 0);
    for (const [b, lv] of Object.entries(p.b || {})) for (let i = 0; i < lv; i++) g += (BUILDINGS[b]?.dev?.[i] || 0) * 0.1;
    if (holder && holder.capital === wp.id) g += 0.01;
    if (holder?.councilTasks?.steward === 'develop' && holder.capital === wp.id) g += 0.03;
    p.dev = clamp(p.dev + g * (1 - p.dev / 90), 0, 100);
    if (p.build && G.s.day >= p.build.done) {
      p.b = p.b || {}; p.b[p.build.b] = p.build.lvl;
      if (holder && isPlayer(holder)) notify(`${BUILDINGS[p.build.b].name} ${['I','II','III'][p.build.lvl - 1]} completed in ${wp.name}.`, { type: 'good', icon: BUILDINGS[p.build.b].icon });
      p.build = null;
    }
  });
}

export function monthlyInnovations() {
  const totals = {};
  G.world.provinces.forEach(wp => { const p = G.s.provs[wp.id]; const t = totals[p.cul] || (totals[p.cul] = { dev: 0, n: 0 }); t.dev += p.dev; t.n++; });
  for (const [cid, t] of Object.entries(totals)) {
    const cs = G.s.cultures[cid] || (G.s.cultures[cid] = { inn: {}, era: G.s.era });
    const next = INNOVATIONS.find(i => (cs.inn[i.id] || 0) < 100 && i.era <= cs.era + 1);
    if (!next) continue;
    const rate = (0.35 + (t.dev / t.n) * 0.035) * (next.era > cs.era ? 0.6 : 1);
    cs.inn[next.id] = Math.min(100, (cs.inn[next.id] || 0) + rate);
    if (cs.inn[next.id] >= 100) {
      invalidateMods();
      const pc = ch(G.s.player);
      if (pc && pc.cul === cid) notify(`The ${CULTURES[cid]?.name || cid} culture has discovered ${next.name}!`, { type: 'good', icon: '💡' });
      const eraDone = INNOVATIONS.filter(i => i.era === cs.era).every(i => (cs.inn[i.id] || 0) >= 100);
      if (eraDone && cs.era < 3) { cs.era++; if (pc && pc.cul === cid) notify(`Your culture enters the ${ERAS[cs.era]}!`, { type: 'good', icon: '📜' }); }
    }
  }
}

export function perkCost(tier) { return 500 + tier * 300; }
export function monthlyLifestyle(c) {
  if (!c.focus || age(c) < 16) return;
  const L = LIFESTYLES[c.focus]; const m = mods(c);
  const gain = (8 + stat(c, L.stat) * 1.6) * (1 + (m.lifestyleXp || 0));
  c.xp[c.focus] = (c.xp[c.focus] || 0) + gain;
  // next perk
  const owned = c.perks.filter(p => PERK_INDEX[p]?.lifestyle === c.focus).length;
  const cost = perkCost(Math.min(3, Math.floor(owned / 2)));
  if (c.xp[c.focus] >= cost) {
    const avail = availablePerks(c, c.focus);
    if (avail.length) {
      c.xp[c.focus] -= cost;
      if (isPlayer(c)) { c.perkPoints = (c.perkPoints || 0) + 1; notify(`You may unlock a new ${L.name} perk!`, { type: 'good', icon: L.icon, action: 'lifestyle' }); }
      else unlockPerk(c, pick(avail));
    }
  }
}
export function availablePerks(c, ls) {
  const out = [];
  for (const tr of LIFESTYLES[ls].trees) { const next = tr.perks.find(p => !c.perks.includes(p.id)); if (next) out.push(next.id); }
  return out;
}
export function unlockPerk(c, pid) {
  const p = PERK_INDEX[pid]; if (!p || c.perks.includes(pid)) return;
  c.perks.push(pid); invalidateMods(c.id);
  if (p.trait) { addTrait(c, p.trait); }
}

export function raidLoot(pid) { return 8 + G.s.provs[pid].dev * 1.2 + (G.s.provs[pid].b?.market || 0) * 6; }
