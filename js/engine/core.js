// Core model: characters, titles, realms, modifiers, opinion.
import { G, emit, markDirty } from '../state.js';
import { TRAITS, PERSONALITY, CONGENITAL, PERK_INDEX, LEGACIES, INNOVATIONS, CROWN_AUTHORITY, ARTIFACT_TYPES, RARITY, WONDERS } from '../data/traits.js';
import { CULTURES, GROUPS, FAITHS, faithHostility } from '../data/cultures.js';
import { rand, randi, pick, chance, clamp, shuffle, fmtDate, hash, mulberry32 } from '../util.js';

export const STATS = ['dip', 'mar', 'ste', 'int', 'lea'];
export const STAT_NAMES = { dip: 'Diplomacy', mar: 'Martial', ste: 'Stewardship', int: 'Intrigue', lea: 'Learning', pro: 'Prowess' };
export const STAT_ICONS = { dip: '🗣', mar: '⚔', ste: '🪙', int: '🕸', lea: '📖', pro: '💪' };

export const ch = id => G.s.chars[id];
export const T = id => G.s.titles[id];
export const now = () => G.s.day;
export const age = c => Math.floor((G.s.day - c.born) / 365);
export const alive = c => c && !c.dead;
export const isAdult = c => age(c) >= 16;
export const culture = id => CULTURES[id] || G.s.customCultures?.[id] || CULTURES.french;
export const faith = id => FAITHS[id] || G.s.customFaiths?.[id] || FAITHS.catholic;
export const cultureGroup = c => GROUPS[culture(c.cul).group] || GROUPS.frankish;

// ---------- Indices ----------
export function idx() {
  if (!G.dirty && G.idx) return G.idx;
  const s = G.s;
  const I = { vassals: new Map(), domain: new Map(), top: new Map(), realmProvs: new Map(), courtiers: new Map(), rulers: [], independent: [], provOwner: new Int32Array(G.world.provinces.length), provTop: new Int32Array(G.world.provinces.length), dynMembers: new Map(), living: [] };
  for (const id in s.chars) {
    const c = s.chars[id]; if (c.dead) continue;
    I.living.push(c.id);
    if (c.titles.length) {
      I.rulers.push(c.id);
      if (c.liege) { if (!I.vassals.has(c.liege)) I.vassals.set(c.liege, []); I.vassals.get(c.liege).push(c.id); }
      else I.independent.push(c.id);
    } else if (c.court) { if (!I.courtiers.has(c.court)) I.courtiers.set(c.court, []); I.courtiers.get(c.court).push(c.id); }
    if (c.dyn) { if (!I.dynMembers.has(c.dyn)) I.dynMembers.set(c.dyn, []); I.dynMembers.get(c.dyn).push(c.id); }
  }
  const topOf = id => { let c = s.chars[id], guard = 0; while (c && c.liege && guard++ < 20) { const l = s.chars[c.liege]; if (!l || l.dead) break; c = l; } return c ? c.id : id; };
  for (const id of I.rulers) I.top.set(id, topOf(id));
  G.world.provinces.forEach(p => {
    const t = s.titles[p.key]; const h = t ? t.holder : 0;
    I.provOwner[p.id] = h || 0;
    const top = h ? (I.top.get(h) || h) : 0;
    I.provTop[p.id] = top;
    if (h) { if (!I.domain.has(h)) I.domain.set(h, []); I.domain.get(h).push(p.id); }
    if (top) { if (!I.realmProvs.has(top)) I.realmProvs.set(top, []); I.realmProvs.get(top).push(p.id); }
  });
  G.idx = I; G.dirty = false;
  return I;
}
export const vassalsOf = id => idx().vassals.get(id) || [];
export const domainOf = id => idx().domain.get(id) || [];
export const topOf = id => idx().top.get(id) || id;
export const realmProvs = id => idx().realmProvs.get(topOf(id)) || [];
export const courtiersOf = id => idx().courtiers.get(id) || [];
export function allVassals(id, out = []) { for (const v of vassalsOf(id)) { out.push(v); allVassals(v, out); } return out; }
export function realmProvsOf(id) { // counties under this character (domain + all vassals)
  const out = [...domainOf(id)]; for (const v of allVassals(id)) out.push(...domainOf(v)); return out;
}
export const isRuler = c => c && c.titles && c.titles.length > 0;
export const isLanded = c => isRuler(c) && domainOf(c.id).length > 0;
export const isIndependent = c => isRuler(c) && !c.liege;
export const liegeOf = c => c && c.liege ? ch(c.liege) : null;
export const topLiege = c => ch(topOf(c.id)) || c;
export function hostOf(c) { if (isRuler(c)) return c; return c.court ? ch(c.court) : null; }
export function realmTopOf(c) { const h = isRuler(c) ? c : hostOf(c); return h ? topLiege(h) : null; }

export function rankOf(c) { if (!c || !c.titles.length) return 0; let r = 0; for (const t of c.titles) r = Math.max(r, T(t)?.rank || 0); return r; }
export const primary = c => c && c.primary ? T(c.primary) : null;
export function updatePrimary(c) {
  if (!c.titles.length) { c.primary = null; return; }
  let best = c.primary && c.titles.includes(c.primary) ? T(c.primary) : null;
  for (const t of c.titles) { const tt = T(t); if (!best || tt.rank > best.rank) best = tt; }
  c.primary = best.id;
}

// ---------- Names & titles ----------
const RANK_M = { 4: 'Emperor', 3: 'King', 2: 'Duke', 1: 'Count' };
const RANK_F = { 4: 'Empress', 3: 'Queen', 2: 'Duchess', 1: 'Countess' };
export function rankName(c, rank = rankOf(c)) {
  if (!rank) return '';
  const fam = faith(c.fai).family, grp = culture(c.cul).group, gov = c.gov, f = c.f;
  const pt = primary(c);
  if (pt && pt.id === 'k_papacy') return 'Pope';
  if (pt && (pt.id === 'k_caliphate' || /Caliphate/.test(pt.realmName || ''))) return f ? 'Caliphess' : 'Caliph';
  if (pt && pt.id === 'k_patriarchate') return 'Patriarch';
  if (pt && pt.id === 'k_imamate') return 'Imam';
  if (pt && pt.id === 'k_mobad') return 'High Priest';
  if (gov === 'theocracy') return rank >= 3 ? (f ? 'Grand Abbess' : 'Grand Master') : rank === 2 ? 'Bishop' : 'Abbot';
  if (gov === 'republic') return rank >= 2 || !c.liege ? (f ? 'Dogaressa' : 'Doge') : (f ? 'Mayoress' : 'Mayor');
  if (gov === 'nomadic' || grp === 'mongolic') return rank >= 4 ? (f ? 'Khatun' : 'Khagan') : rank === 3 ? (f ? 'Khatun' : 'Khan') : rank === 2 ? 'Bey' : 'Noyan';
  if (fam === 'islamic') return rank >= 4 ? (f ? 'Sultana' : 'Sultan') : rank === 3 ? (f ? 'Sultana' : 'Sultan') : rank === 2 ? (f ? 'Emira' : 'Emir') : (f ? 'Shaykha' : 'Shaykh');
  if (grp === 'iranian' || fam === 'zoroastrian') return rank >= 4 ? (f ? 'Banbishn' : 'Shahanshah') : rank === 3 ? (f ? 'Shahbanu' : 'Shah') : rank === 2 ? 'Marzban' : 'Dehqan';
  if (grp === 'turkic') return rank >= 4 ? (f ? 'Khatun' : 'Khagan') : rank === 3 ? (f ? 'Khatun' : 'Khan') : rank === 2 ? 'Bey' : 'Tarkhan';
  if (grp === 'norse' && gov === 'tribal') return rank >= 3 ? (f ? 'Queen' : 'King') : rank === 2 ? (f ? 'Jarl' : 'Jarl') : 'Hersir';
  if (grp === 'slavic' && fam !== 'pagan') return rank >= 4 ? (f ? 'Tsaritsa' : 'Tsar') : rank === 3 ? (f ? 'Queen' : (c.cul === 'russian' ? 'Grand Prince' : 'King')) : rank === 2 ? (f ? 'Princess' : 'Prince') : (f ? 'Lady' : 'Lord');
  if (grp === 'slavic' || grp === 'baltic') return rank >= 3 ? (f ? 'Queen' : 'King') : rank === 2 ? (f ? 'Princess' : 'Prince') : (f ? 'Lady' : 'Chieftain');
  if (grp === 'greek' && rank >= 4) return f ? 'Basilissa' : 'Basileus';
  if (gov === 'tribal' && rank <= 2) return rank === 2 ? (f ? 'Chieftess' : 'Chieftain') : (f ? 'Lady' : 'Headman');
  return (f ? RANK_F : RANK_M)[rank];
}
const TNOUN = { 4: 'Empire', 3: 'Kingdom', 2: 'Duchy', 1: 'County' };
export function titleName(t, full = true) {
  if (!t) return '';
  if (t.realmName) return t.realmName;
  if (!full) return t.name;
  const h = t.holder ? ch(t.holder) : null;
  let noun = TNOUN[t.rank];
  if (h) {
    const fam = faith(h.fai).family, grp = culture(h.cul).group;
    if (h.gov === 'republic') noun = 'Republic'; else if (h.gov === 'theocracy') noun = t.rank >= 2 ? 'Bishopric' : 'Abbacy';
    else if (fam === 'islamic') noun = t.rank >= 3 ? 'Sultanate' : t.rank === 2 ? 'Emirate' : 'Shaykhdom';
    else if (h.gov === 'nomadic' || grp === 'turkic' || grp === 'mongolic') noun = t.rank >= 4 ? 'Khaganate' : t.rank === 3 ? 'Khanate' : t.rank === 2 ? 'Beylik' : 'Domain';
    else if (h.gov === 'tribal' && t.rank <= 2) noun = t.rank === 2 ? 'Chiefdom' : 'Domain';
    else if (grp === 'slavic' && t.rank === 2) noun = 'Principality';
  }
  return `${noun} of ${t.name}`;
}
export function realmShort(t) {
  if (!t) return '';
  if (!t.realmName) return t.name;
  const m = t.realmName.match(/^(?:Kingdom|Empire|Duchy|County|Republic|Sultanate|Emirate|Principality|Grand Principality|Grand Duchy|Khanate|Taifa|Despotate|Lordship|Banate|Domain|Ulus) of (?:the )?(.+)$/i);
  if (m) return m[1];
  return /\b(Caliphate|Empire|Sultanate|Khaganate|Khanate|Kingdom|Republic|Despotate|Horde|Order|Confederation|League|State|Emirate|Imamate|Atabegate|Remnant|Franks|Principality|Duchy|Beylik|Lordship|Patriarchate|Papacy|Taifa)\b/.test(t.realmName) && !/^(Kingdom|Empire|Duchy)\b/.test(t.realmName) ? 'the ' + t.realmName : t.realmName;
}
export function dynName(c) { const d = G.s.dyns[c.dyn]; return d ? d.name : ''; }
export function shortName(c) { return c ? c.name : '?'; }
export function fullName(c, withTitle = true) {
  if (!c) return 'Nobody';
  const pt = primary(c);
  const regnal = c.regnal ? ' ' + c.regnal : '';
  if (withTitle && pt) {
    if (['k_papacy'].includes(pt.id)) return `Pope ${c.name}${regnal}`;
    return `${rankName(c)} ${c.name}${regnal}${c.epithet ? ' ' + c.epithet : ''} of ${realmShort(pt)}`;
  }
  if (c.epithet) return `${c.name}${regnal} ${c.epithet}`;
  const d = dynName(c);
  return d ? `${c.name} ${d.startsWith('de ') || d.startsWith('von ') || d.startsWith('of ') || d.startsWith('d\'') || d.startsWith('della ') || d.startsWith('ap ') || d.startsWith('ab ') || d.startsWith('Ua ') || d.startsWith('Banu') ? d : d}` : c.name;
}
// Epithets: earned through deeds, reputation and personality.
export function computeEpithet(c) {
  const t = x => c.traits.includes(x);
  const a = age(c), reign = c.reignStart !== undefined ? (G.s.day - c.reignStart) / 365 : 0;
  const pl = prestigeLevel(c);
  const opts = [];
  if ((c.conquests || 0) >= 6 || t('conqueror')) opts.push([90, 'the Conqueror']);
  if (pl >= 5) opts.push([80, 'the Great']);
  if ((c.wins || 0) >= 8) opts.push([70, 'the Victorious']);
  if (t('kinslayer')) opts.push([75, 'the Kinslayer']);
  if (t('sadistic') || (c.dreadBase || 0) > 40) opts.push([65, 'the Cruel']);
  if ((c.tyranny || 0) > 40) opts.push([60, 'the Tyrant']);
  if (t('crusader') || t('ghazi')) opts.push([55, 'the Crusader']);
  if (pietyLevel(c) >= 4 || (t('zealous') && t('chaste'))) opts.push([55, 'the Pious']);
  if (t('scholar') || t('edu_lea_4') || t('genius')) opts.push([50, 'the Wise']);
  if (t('just') && t('honest')) opts.push([48, 'the Just']);
  if (t('brave') && (c.wins || 0) >= 3) opts.push([47, 'the Bold']);
  if (t('strong') || t('giant')) opts.push([45, t('giant') ? 'the Tall' : 'the Strong']);
  if (t('generous') && t('gregarious')) opts.push([40, 'the Magnanimous']);
  if (t('lustful') && (c.rel?.lovers?.length || 0) >= 2) opts.push([40, 'the Lusty']);
  if (t('wrathful') && t('vengeful')) opts.push([38, 'the Wrathful']);
  if (t('gluttonous') || t('comfort_eater')) opts.push([35, 'the Fat']);
  if (t('lazy') && t('content')) opts.push([33, 'the Idle']);
  if (t('craven')) opts.push([32, 'the Timid']);
  if (t('ugly')) opts.push([30, 'the Ugly']); if (t('beautiful')) opts.push([30, 'the Fair']);
  if (t('lunatic') || t('possessed')) opts.push([45, 'the Mad']);
  if (t('blind')) opts.push([40, 'the Blind']);
  if (t('leper')) opts.push([50, 'the Leper']);
  if (t('greedy') && t('avaricious')) opts.push([36, 'the Miser']);
  if (t('physician') || t('mystic')) opts.push([30, 'the Learned']);
  if (reign > 40) opts.push([28, 'the Old']);
  if (c.dead && a < 22 && isRuler(c)) opts.push([27, 'the Young']);
  if (c.cause === 'murder') opts.push([52, 'the Martyr']);
  if (!opts.length) return null;
  opts.sort((x, y) => y[0] - x[0]);
  return opts[0][1];
}
export function updateEpithet(c) {
  if (!c || !isRuler(c) && !c.dead) return;
  if (c.epithetLocked) return;
  const reign = c.reignStart !== undefined ? (G.s.day - c.reignStart) / 365 : age(c) - 20;
  if (!c.dead && (age(c) < 25 || reign < 5)) return;
  const e = computeEpithet(c); if (!e) return;
  if (e !== c.epithet) { const had = c.epithet; c.epithet = e; if (isPlayer(c) && !had) notify(`The people have begun to call you "${c.name} ${e}".`, { type: 'good', icon: '📯', important: true }); }
  if (c.dead) c.epithetLocked = true;
}
export function displayName(c) { if (!c) return '—'; const pt = primary(c); return pt ? `${rankName(c)} ${c.name}${c.regnal ? ' ' + c.regnal : ''}` : `${c.name} ${dynName(c)}`.trim(); }

// ---------- Traits & modifiers ----------
export const hasTrait = (c, t) => c.traits.includes(t);
export function addTrait(c, t) {
  if (!TRAITS[t] || c.traits.includes(t)) return false;
  const tr = TRAITS[t];
  c.traits = c.traits.filter(x => !tr.opp.includes(x) && !(TRAITS[x]?.opp || []).includes(t));
  if (tr.cat === 'education') c.traits = c.traits.filter(x => TRAITS[x]?.cat !== 'education');
  c.traits.push(t); modCache.delete(c.id); return true;
}
export function removeTrait(c, t) { const i = c.traits.indexOf(t); if (i >= 0) { c.traits.splice(i, 1); modCache.delete(c.id); return true; } return false; }

const modCache = new Map();
export function invalidateMods(id) { if (id === undefined) modCache.clear(); else modCache.delete(id); }
export function mods(c) {
  const k = modCache.get(c.id);
  if (k && k.day === G.s.day) return k.m;
  const m = {};
  const add = obj => { if (!obj) return; for (const key in obj) m[key] = (m[key] || 0) + obj[key]; };
  for (const t of c.traits) { const tr = TRAITS[t]; if (!tr) continue; add(tr.mods); add(tr.stats); }
  for (const p of c.perks || []) add(PERK_INDEX[p]?.mods);
  const d = G.s.dyns[c.dyn];
  if (d) for (const [tk, lv] of Object.entries(d.legacies || {})) for (let i = 0; i < lv; i++) add(LEGACIES[tk]?.levels[i]?.mods);
  if (isRuler(c)) {
    const cs = G.s.cultures[c.cul]; if (cs) for (const inn of INNOVATIONS) if (cs.inn[inn.id] >= 100) add(inn.mods);
    for (const aid of equippedArtifacts(c)) add(G.s.artifacts[aid]?.mods);
    const gl = grandeurLevel(c); if (gl >= 2) add({ prestigeGain: (gl - 1) * 0.3, vassalOpinion: (gl - 2) * 3 });
    for (const pid of domainOf(c.id)) for (const w of G.s.provs[pid].wonders || []) { const wm = WONDERS.find(x => x.name === w)?.mods; if (wm) add({ ...wm, fort: 0 }); }
  }
  modCache.set(c.id, { day: G.s.day, m });
  return m;
}
export function stat(c, s) {
  const m = mods(c);
  let v = (c.base[s] || 0) + (m[s] || 0);
  const a = age(c);
  if (a < 16) v = v * Math.max(0.15, a / 16);
  if (a > 60 && (s === 'mar' || s === 'pro')) v -= Math.floor((a - 60) / 8);
  if (c.stress > 66) v -= 1;
  return Math.max(0, Math.round(v));
}
export function prowess(c) { return stat(c, 'pro'); }

// ---------- Prestige & dread ----------
export const PRESTIGE_LEVELS = ['Unknown', 'Noted', 'Reputable', 'Distinguished', 'Illustrious', 'Exalted', 'Legendary'];
export function prestigeLevel(c) { const p = c.fame || 0; return p >= 30000 ? 6 : p >= 16000 ? 5 : p >= 8000 ? 4 : p >= 4000 ? 3 : p >= 2000 ? 2 : p >= 1000 ? 1 : 0; }
export const PIETY_LEVELS = ['Sinful', 'Faithful', 'Devout', 'Righteous', 'Holy', 'Saintly'];
export function pietyLevel(c) { const p = c.devotion || 0; return p >= 15000 ? 5 : p >= 6000 ? 4 : p >= 3000 ? 3 : p >= 1000 ? 2 : p >= 0 ? 1 : 0; }
export function dread(c) { const m = mods(c); return clamp((c.dreadBase || 0) + (m.dread || 0) * 40 + stat(c, 'mar') * 0.5, 0, 100); }
export function addPrestige(c, v) { c.prestige += v; if (v > 0) c.fame = (c.fame || 0) + v; const d = G.s.dyns[c.dyn]; if (d && v > 0) d.renown += v * 0.1; }
export function addPiety(c, v) { c.piety += v; if (v > 0) c.devotion = (c.devotion || 0) + v; }

// ---------- Artifacts & court ----------
export function equippedArtifacts(c) {
  const bySlot = {};
  for (const id of c.artifacts || []) { const a = G.s.artifacts[id]; if (!a) continue; const slot = ARTIFACT_TYPES[a.type]?.slot || a.type; if (!bySlot[slot] || G.s.artifacts[bySlot[slot]].rarity < a.rarity) bySlot[slot] = id; }
  return Object.values(bySlot);
}
export function grandeur(c) {
  if (!isRuler(c)) return 0;
  const am = c.amenities || { food: 1, servants: 1, fashion: 1, lodging: 1 };
  let g = (am.food + am.servants + am.fashion + am.lodging) * 6 + rankOf(c) * 4;
  for (const id of c.artifacts || []) { const a = G.s.artifacts[id]; if (a && a.type === 'tapestry') g += 6 * (a.rarity + 1); else if (a) g += 2 * (a.rarity + 1); }
  g += (c.grandeurBonus || 0);
  return Math.round(g);
}
export function grandeurLevel(c) { const g = grandeur(c); return g >= 90 ? 5 : g >= 70 ? 4 : g >= 50 ? 3 : g >= 30 ? 2 : g >= 15 ? 1 : 0; }
export function expectedGrandeur(c) { return [0, 12, 25, 45, 65][rankOf(c)] || 0; }

export function createArtifact(owner, type, rarity, name, opts = {}) {
  const tp = ARTIFACT_TYPES[type]; const id = 'a' + (G.s.nextId++);
  const r = RARITY[rarity];
  const m = {}; const keys = shuffle([...tp.mods]).slice(0, rarity >= 2 ? 2 : 1);
  for (const k of keys) {
    const base = { prestigeGain: 0.3, pietyGain: 0.3, vassalOpinion: 3, dip: 1, mar: 1, ste: 1, int: 1, lea: 1, pro: 2, advantage: 2, stressLoss: 0.05, lifestyleXp: 0.05, levyMult: 0.05, grandeur: 3, opinion: 3 }[k] || 1;
    m[k] = Math.round(base * r.mult * 100) / 100;
  }
  const a = { id, type, rarity, name: name || `${pick(['The', ''])} ${pick(tp.names)} of ${owner ? (primary(owner)?.name || dynName(owner) || owner.name) : 'Old'}`.trim(), mods: m, owner: owner?.id || 0, created: G.s.day, history: [opts.origin || 'Forged'], desc: opts.desc || '' };
  G.s.artifacts[id] = a;
  if (owner) { owner.artifacts = owner.artifacts || []; owner.artifacts.push(id); invalidateMods(owner.id); }
  return a;
}
export function transferArtifact(aid, to, why) {
  const a = G.s.artifacts[aid]; if (!a) return;
  const from = ch(a.owner); if (from) { from.artifacts = (from.artifacts || []).filter(x => x !== aid); invalidateMods(from.id); }
  a.owner = to ? to.id : 0; if (to) { to.artifacts = to.artifacts || []; to.artifacts.push(aid); invalidateMods(to.id); }
  if (why) a.history.push(why);
}

// ---------- Family ----------
export const kidsOf = c => (c.kids || []).map(ch).filter(Boolean);
export function siblings(c) {
  const set = new Set(); for (const pid of [c.father, c.mother]) { const p = ch(pid); if (p) for (const k of p.kids) if (k !== c.id) set.add(k); }
  return [...set].map(ch).filter(Boolean);
}
export function isCloseFamily(a, b) {
  if (a.id === b.id) return true;
  if (a.father === b.id || a.mother === b.id || b.father === a.id || b.mother === a.id) return true;
  if ((a.father && a.father === b.father) || (a.mother && a.mother === b.mother)) return true;
  return false;
}
export function isKin(a, b) {
  if (isCloseFamily(a, b)) return true;
  const gp = x => [ch(x.father), ch(x.mother)].filter(Boolean).flatMap(p => [p.father, p.mother]).filter(Boolean);
  const ga = gp(a), gb = gp(b); if (ga.some(g => gb.includes(g))) return true;
  if (ga.includes(b.id) || gb.includes(a.id)) return true;
  return false;
}
export function relationTo(a, b) { // how b relates to a
  if (!a || !b) return '';
  if (a.id === b.id) return 'You';
  if (a.spouse === b.id) return b.f ? 'Wife' : 'Husband';
  if (a.father === b.id) return 'Father'; if (a.mother === b.id) return 'Mother';
  if (b.father === a.id || b.mother === a.id) return b.f ? 'Daughter' : 'Son';
  if ((a.father && a.father === b.father) || (a.mother && a.mother === b.mother)) return b.f ? 'Sister' : 'Brother';
  const pa = [ch(a.father), ch(a.mother)].filter(Boolean);
  if (pa.some(p => p.father === b.id || p.mother === b.id)) return b.f ? 'Grandmother' : 'Grandfather';
  if (kidsOf(a).some(k => k.kids.includes(b.id))) return b.f ? 'Granddaughter' : 'Grandson';
  if (pa.some(p => siblings(p).some(s => s.id === b.id))) return b.f ? 'Aunt' : 'Uncle';
  if (siblings(a).some(s => s.kids.includes(b.id))) return b.f ? 'Niece' : 'Nephew';
  if (pa.some(p => siblings(p).some(s => s.kids.includes(b.id)))) return 'Cousin';
  if (a.rel?.friends?.includes(b.id)) return 'Friend';
  if (a.rel?.rivals?.includes(b.id)) return 'Rival';
  if (a.rel?.lovers?.includes(b.id)) return 'Lover';
  if (a.liege === b.id) return 'Liege';
  if (b.liege === a.id) return 'Vassal';
  if (b.court === a.id) return 'Courtier';
  if (a.dyn && a.dyn === b.dyn) return 'House member';
  return '';
}

// ---------- Opinion ----------
export function addOpinion(a, b, v, reason, months = 60) {
  if (!a || !b || a.id === b.id) return;
  a.op = a.op || {};
  const list = a.op[b.id] || (a.op[b.id] = []);
  const ex = list.find(x => x.r === reason);
  if (ex) { ex.v = clamp(ex.v + v, -150, 150); ex.u = Math.max(ex.u, G.s.day + months * 30); }
  else list.push({ v, r: reason, u: G.s.day + months * 30 });
}
export function opinionBreakdown(a, b) {
  const out = [];
  if (!a || !b || a.id === b.id) return out;
  const push = (v, r) => { if (v) out.push([Math.round(v), r]); };
  const ap = a.traits.filter(t => TRAITS[t]?.cat === 'personality');
  let same = 0, opp = 0;
  for (const t of ap) { if (b.traits.includes(t)) same++; if ((TRAITS[t].opp || []).some(o => b.traits.includes(o))) opp++; }
  push(same * 10, 'Same personality'); push(-opp * 10, 'Opposed personality');
  const mb = mods(b);
  push(Math.min(25, mb.opinion || 0), 'Personal reputation');
  const rel = relationTo(a, b);
  if (a.spouse === b.id) push(20, 'Spouse');
  else if (['Father', 'Mother', 'Son', 'Daughter'].includes(rel)) push(25, rel);
  else if (['Brother', 'Sister'].includes(rel)) push(15, 'Sibling');
  if (a.rel?.friends?.includes(b.id)) push(60, 'Friend');
  if (a.rel?.lovers?.includes(b.id)) push(50, 'Lover');
  if (a.rel?.rivals?.includes(b.id)) push(-100, 'Rival');
  if (a.dyn && a.dyn === b.dyn) push(10 + (mb.dynastyOpinion || 0), 'Same house');
  const fh = faithHostility(a.fai, b.fai);
  push([0, -10, -20, -30][fh], fh ? 'Faith differences' : '');
  push(a.cul === b.cul ? 5 : -5, a.cul === b.cul ? 'Same culture' : 'Different culture');
  if (a.liege === b.id) {
    push(CROWN_AUTHORITY[b.laws?.crown ?? 1]?.opinion || 0, 'Crown authority');
    push(mb.vassalOpinion || 0, 'Liege\'s reputation');
    push(prestigeLevel(b) * 3, 'Liege\'s prestige');
    if (b.tyranny) push(-Math.round(b.tyranny), 'Tyranny');
    const over = Math.max(0, domainOf(b.id).length - domainLimit(b));
    push(-over * 8, 'Liege holds too many counties');
    if (b.cul !== a.cul) push(-5, 'Foreign liege');
    if (b.councilMembers && Object.values(b.councilMembers).includes(a.id)) push(10, 'On the council');
    if (a.gov === 'theocracy') push(mb.clergyOpinion || 0, 'Clergy relations');
  }
  if (a.liege && a.liege === b.liege) push(0, '');
  const list = a.op?.[b.id] || [];
  for (const m of list) if (m.u > G.s.day) push(m.v, m.r);
  return out.filter(x => x[1]);
}
export function opinion(a, b) {
  if (!a || !b) return 0;
  if (a.id === b.id) return 100;
  let o = 0; for (const [v] of opinionBreakdown(a, b)) o += v;
  return clamp(o, -100, 100);
}

// ---------- Domain / realm stats ----------
export function domainLimit(c) {
  const r = rankOf(c);
  return Math.max(1, 1 + Math.floor(stat(c, 'ste') / 5) + Math.max(0, r - 1) + (mods(c).domain || 0) + (c.gov === 'tribal' ? 1 : 0));
}
export function realmSize(c) { return realmProvs(c.id).length; }

// ---------- Titles ----------
export function giveTitle(tid, toId, opts = {}) {
  const t = T(tid); if (!t) return;
  const prev = t.holder ? ch(t.holder) : null;
  if (prev) { prev.titles = prev.titles.filter(x => x !== tid); if (prev.primary === tid) prev.primary = null; updatePrimary(prev); }
  t.holder = toId || 0;
  if (opts.how === 'conquered' && !t.custom && prev && toId && ch(toId).dyn !== prev.dyn) t.realmName = null;
  if (toId) {
    const to = ch(toId);
    if (!to.titles.includes(tid)) to.titles.push(tid);
    updatePrimary(to);
    if (!to.gov) to.gov = prev?.gov || defaultGov(to);
    if (!to.laws) to.laws = prev?.laws ? { ...prev.laws } : defaultLaws(to);
    if (!to.capital && t.rank === 1) to.capital = t.prov;
    if (to.court && isRuler(to)) to.court = 0;
    if (to.claims) to.claims = to.claims.filter(x => x !== tid);
    if (t.rank === 1 && G.s.provs[t.prov]) { /* no-op */ }
  }
  if (prev && !prev.titles.length) { prev.capital = null; }
  if (prev && prev.capital === t.prov && t.rank === 1) { const d = prev.titles.map(T).find(x => x.rank === 1); prev.capital = d ? d.prov : null; }
  t.history = t.history || []; t.history.push({ day: G.s.day, holder: toId, how: opts.how || 'inherited' });
  if (t.history.length > 40) t.history.shift();
  markDirty(); invalidateMods(toId); if (prev) invalidateMods(prev.id);
}
export function setLiege(c, liegeId) { if (c.id === liegeId) return; c.liege = liegeId || 0; markDirty(); }
export function defaultGov(c) {
  const fam = faith(c.fai).family; const grp = culture(c.cul).group;
  if (['khazar', 'cuman', 'pecheneg', 'avar', 'hunnic', 'mongol'].includes(c.cul)) return 'nomadic';
  if (fam === 'pagan') return 'tribal';
  if (G.s && G.s.era === 0) return 'tribal';
  return 'feudal';
}
export function defaultLaws(c) {
  const gov = c.gov || defaultGov(c); const era = G.s?.era ?? 2;
  const fam = faith(c.fai).family;
  let succ = era >= 3 ? 'primogeniture' : 'partition';
  if (gov === 'tribal' || gov === 'nomadic') succ = 'partition';
  if (gov === 'republic' || gov === 'theocracy') succ = 'elective';
  if (gov === 'imperial') succ = 'elective';
  if (culture(c.cul).group === 'celtic' && era <= 2) succ = 'tanistry';
  return { succ, gender: fam === 'islamic' ? 'agnatic' : 'agnatic_cognatic', crown: gov === 'tribal' || gov === 'nomadic' ? 0 : era >= 2 ? 1 : 0 };
}
// Collect all titles whose de jure lineage includes ancestor
export function deJureCounties(tid) { const t = T(tid); if (!t) return []; return t.counties || []; }
export function titleCountiesHeld(tid, charId) { // fraction of de jure counties within charId's realm
  const cs = deJureCounties(tid); if (!cs.length) return 0;
  const I = idx(); const top = topOf(charId); let n = 0;
  for (const p of cs) if (I.provTop[p] === top) n++;
  return n / cs.length;
}

// ---------- Logging & notifications ----------
export function log(text, opts = {}) {
  const e = { day: G.s.day, text, type: opts.type || 'info', ids: opts.ids || [], icon: opts.icon || '' };
  G.s.log.push(e); if (G.s.log.length > 1500) G.s.log.splice(0, 200);
  return e;
}
export function notify(text, opts = {}) { emit('notify', { text, ...opts }); }
export function involvesPlayer(...ids) { const p = G.s.player; if (!p) return false; const pc = ch(p); if (!pc) return false; return ids.some(id => id === p || (pc.spouse && id === pc.spouse) || pc.kids.includes(id) || (ch(id)?.liege === p) || id === pc.liege); }
export const isPlayer = c => c && c.id === G.s.player;

// ---------- Character creation ----------
export function createDynasty(name, cul, opts = {}) {
  const id = 'd' + (G.s.nextId++);
  G.s.dyns[id] = { id, name, cul, renown: opts.renown || 0, legacies: {}, coa: opts.coa || hash(name + cul), founded: G.s.day, head: 0 };
  return G.s.dyns[id];
}
export function findOrCreateDynasty(name, cul) {
  for (const d of Object.values(G.s.dyns)) if (d.name === name) return d;
  return createDynasty(name, cul);
}
export function randomName(cul, female) { const g = GROUPS[culture(cul).group] || GROUPS.frankish; return pick(female ? g.f : g.m); }
export function randomDynName(cul) {
  const g = GROUPS[culture(cul).group] || GROUPS.frankish;
  if (chance(0.5)) return pick(g.dyn);
  const provs = G.world.provinces.filter(p => G.s.provs[p.id].cul === cul);
  const p = provs.length ? pick(provs) : pick(G.world.provinces);
  const grp = culture(cul).group;
  const pre = { frankish: 'de ', germanic: 'von ', latin: 'da ', iberian: 'de ', anglo: 'of ', celtic: 'of ', norse: '', greek: '', slavic: '', arabic: 'al-', berber: 'Banu ', turkic: '', mongolic: '', iranian: '', magyar: '', vlach: '', caucasian: '', baltic: '', finnic: '', gothic: '' }[grp] ?? '';
  const suf = { norse: 'ing', greek: 'enos', slavic: 'ić', turkic: 'oğlu', magyar: 'i', baltic: 'aitis', finnic: 'nen', caucasian: 'eli', iranian: 'ids', mongolic: 'id', gothic: 'ing' }[grp] ?? '';
  return pre ? pre + p.name : (p.name.replace(/[aeiou]$/i, '') + suf);
}
const SKIN = [[255, 224, 196], [241, 194, 160], [224, 172, 135], [198, 145, 105], [160, 110, 75], [120, 80, 55]];
export function randomDna(cul, parents = []) {
  const g = GROUPS[culture(cul).group] || GROUPS.frankish;
  const r = mulberry32(randi(1, 1e9));
  if (parents.length === 2 && parents[0]?.dna && parents[1]?.dna) {
    const [a, b] = parents.map(p => p.dna); const m = (x, y) => r() < 0.5 ? x : y;
    return { skin: clamp((a.skin + b.skin) / 2 + (r() - 0.5) * 0.08, 0, 1), hair: m(a.hair, b.hair), hairStyle: randi(0, 5), beard: randi(0, 5), eyes: m(a.eyes, b.eyes), face: m(a.face, b.face), nose: m(a.nose, b.nose), brow: randi(0, 2), jaw: m(a.jaw, b.jaw) };
  }
  return { skin: clamp(g.skin[0] + r() * (g.skin[1] - g.skin[0]), 0, 1), hair: pick(g.hair), hairStyle: randi(0, 5), beard: randi(0, 5), eyes: pick(['#3a2a1a', '#2a4a7a', '#4a6a3a', '#5a3a1a', '#6a8aa0']), face: randi(0, 3), nose: randi(0, 3), brow: randi(0, 2), jaw: randi(0, 2) };
}
export function skinColor(dna) { const t = dna.skin * (SKIN.length - 1); const i = Math.floor(t), f = t - i; const a = SKIN[i], b = SKIN[Math.min(SKIN.length - 1, i + 1)]; return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(',')})`; }

export function randomPersonality(n, existing = []) {
  const out = [...existing];
  let guard = 0;
  while (out.filter(t => TRAITS[t]?.cat === 'personality').length < n && guard++ < 50) {
    const t = pick(PERSONALITY);
    if (out.includes(t)) continue;
    if (out.some(x => TRAITS[x].opp.includes(t) || TRAITS[t].opp.includes(x))) continue;
    out.push(t);
  }
  return out;
}
export function educationFor(c) {
  const best = STATS.reduce((a, s) => (c.base[s] > c.base[a] ? s : a), 'dip');
  const s = chance(0.6) ? best : pick(STATS);
  const lv = weightedLevel(c);
  return `edu_${s}_${lv}`;
}
function weightedLevel(c) { const r = rand() + (c.traits.includes('genius') ? 0.4 : c.traits.includes('quick') ? 0.2 : c.traits.includes('slow') ? -0.3 : 0); return r > 0.92 ? 4 : r > 0.6 ? 3 : r > 0.25 ? 2 : 1; }

export function createChar(o = {}) {
  const s = G.s;
  const id = s.nextId++;
  const female = !!o.female;
  const cul = o.cul || 'french', fai = o.fai || 'catholic';
  const born = o.born !== undefined ? o.born : s.day - Math.round((o.age ?? randi(18, 50)) * 365 + randi(0, 364));
  const c = {
    id, name: o.name || randomName(cul, female), f: female, dyn: o.dyn || 0, born, dead: 0, cul, fai,
    father: o.father || 0, mother: o.mother || 0, spouse: 0, kids: [], traits: [],
    base: { dip: randi(2, 8), mar: randi(2, 8), ste: randi(2, 8), int: randi(2, 8), lea: randi(2, 8), pro: randi(3, 10) },
    gold: o.gold || 0, prestige: o.prestige || 0, piety: o.piety || 0, fame: 0, devotion: 0, stress: 0, health: 5.5 + rand() * 1.5,
    titles: [], primary: null, liege: 0, court: o.court || 0, claims: [], op: {}, rel: { friends: [], rivals: [], lovers: [] },
    focus: null, xp: {}, perks: [], artifacts: [], dna: o.dna || randomDna(cul, [ch(o.father), ch(o.mother)]), hooks: {}, secrets: [],
    gov: o.gov || null, laws: null, capital: null, amenities: null, councilMembers: null, councilTasks: null, maa: null,
  };
  if (female && c.base.pro > 6) c.base.pro -= 2;
  s.chars[id] = c;
  if (o.traits) for (const t of o.traits) if (TRAITS[t]) addTrait(c, t);
  const a = age(c);
  // congenital inheritance
  const parents = [ch(c.father), ch(c.mother)].filter(Boolean);
  if (!o.noRandomTraits) {
    for (const t of CONGENITAL) {
      const pIn = parents.filter(p => p.traits.includes(t)).length;
      const p = pIn ? TRAITS[t].inherit * (pIn === 2 ? 2 : 1) : 0.012;
      if (!c.traits.some(x => TRAITS[x]?.cat === 'congenital' && (TRAITS[x].opp?.includes(t) || TRAITS[t].opp?.includes(x))) && chance(p)) addTrait(c, t);
    }
    const nP = a >= 16 ? 3 : a >= 10 ? 2 : a >= 6 ? 1 : 0;
    c.traits = randomPersonality(nP, c.traits);
    if (a >= 16 && !c.traits.some(t => TRAITS[t]?.cat === 'education')) addTrait(c, educationFor(c));
    if (a >= 16) c.educated = true;
  } else if (a >= 16) c.educated = true;
  if (c.father && ch(c.father)) ch(c.father).kids.push(id);
  if (c.mother && ch(c.mother)) ch(c.mother).kids.push(id);
  markDirty();
  return c;
}
export function marry(a, b) {
  if (!a || !b || a.dead || b.dead) return;
  if (a.spouse) { const o = ch(a.spouse); if (o) o.spouse = 0; }
  if (b.spouse) { const o = ch(b.spouse); if (o) o.spouse = 0; }
  a.spouse = b.id; b.spouse = a.id;
  // the non-ruler moves to the ruler's court; matrilineal if wife rules
  const [hostC, other] = isRuler(a) ? [a, b] : isRuler(b) ? [b, a] : [a.f ? b : a, a.f ? a : b];
  if (!isRuler(other)) other.court = hostC.id && isRuler(hostC) ? hostC.id : (hostC.court || other.court);
  addOpinion(a, b, 10, 'Newlyweds', 24); addOpinion(b, a, 10, 'Newlyweds', 24);
  markDirty();
}
