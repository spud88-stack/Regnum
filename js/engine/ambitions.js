// Ambitions: personal goals the player pursues for rewards.
import { G, emit } from '../state.js';
import { ch, T, rankOf, realmProvs, kidsOf, age, isAdult, grandeurLevel, prestigeLevel, pietyLevel, addPrestige, addPiety, notify, log, domainOf, mods, invalidateMods, createArtifact } from './core.js';
import { allied, alliesOf } from './war.js';
import { chance, pick } from '../util.js';

const counties = c => realmProvs(c.id).length;
const builtCount = c => domainOf(c.id).reduce((s, p) => s + Object.values(G.s.provs[p].b || {}).reduce((a, b) => a + b, 0), 0);
// Each ambition: snapshot(c) -> base values, goal(c, base) -> target number, value(c, base) -> current number
export const AMBITIONS = {
  expand: { name: 'Expand the Realm', icon: '🗺', desc: 'Bring three more counties under your rule.', snap: c => counties(c), target: (c, b) => b + 3, value: c => counties(c), reward: { prestige: 300, renown: 150 }, ok: c => rankOf(c) >= 1 },
  coffers: { name: 'Fill the Coffers', icon: '💰', desc: 'Amass a great treasury.', snap: c => c.gold, target: (c, b) => Math.max(300, Math.round(b + 200 + rankOf(c) * 150)), value: c => c.gold, reward: { prestige: 200, stress: -30 }, ok: () => true },
  heirs: { name: 'Secure the Line', icon: '👶', desc: 'Have three living children.', snap: () => 0, target: () => 3, value: c => kidsOf(c).filter(k => !k.dead).length, reward: { prestige: 150, renown: 200 }, ok: c => age(c) < 50 && kidsOf(c).filter(k => !k.dead).length < 3 },
  wedding: { name: 'A Good Match', icon: '💍', desc: 'See two of your children married.', snap: () => 0, target: () => 2, value: c => kidsOf(c).filter(k => !k.dead && k.spouse).length, reward: { prestige: 250, renown: 150 }, ok: c => kidsOf(c).filter(k => !k.dead && !k.spouse).length >= 2 },
  crown: { name: 'Forge a Crown', icon: '👑', desc: 'Hold a title of higher rank than you do now.', snap: c => rankOf(c), target: (c, b) => b + 1, value: c => rankOf(c), reward: { prestige: 500, renown: 400 }, ok: c => rankOf(c) >= 1 && rankOf(c) < 4 },
  warlord: { name: 'Master of War', icon: '⚔', desc: 'Win three battles.', snap: c => c.wins || 0, target: (c, b) => b + 3, value: c => c.wins || 0, reward: { prestige: 350, trait: 'strategist' }, ok: c => rankOf(c) >= 1 },
  builder: { name: 'Build a Legacy in Stone', icon: '🏗', desc: 'Complete three building projects in your domain.', snap: c => builtCount(c), target: (c, b) => b + 3, value: c => builtCount(c), reward: { prestige: 200, grandeur: 6 }, ok: c => domainOf(c.id).length > 0 },
  court: { name: 'A Glittering Court', icon: '🏛', desc: 'Raise your court grandeur to level 3.', snap: () => 0, target: () => 3, value: c => grandeurLevel(c), reward: { prestige: 300, artifact: 'tapestry' }, ok: c => rankOf(c) >= 2 && grandeurLevel(c) < 3 },
  devout: { name: 'Walk with God', icon: '🙏', desc: 'Earn a great store of piety.', snap: c => c.piety, target: (c, b) => Math.round(b + 600), value: c => c.piety, reward: { piety: 300, trait: 'pilgrim' }, ok: () => true },
  learned: { name: 'Pursuit of Mastery', icon: '📘', desc: 'Unlock two lifestyle perks.', snap: c => c.perks.length, target: (c, b) => b + 2, value: c => c.perks.length, reward: { prestige: 150, stress: -20 }, ok: () => true },
  friends: { name: 'Friends in High Places', icon: '🤝', desc: 'Have two allies.', snap: () => 0, target: () => 2, value: c => alliesOf(c.id).length, reward: { prestige: 250 }, ok: c => !c.liege && alliesOf(c.id).length < 2 },
  renown: { name: 'Name for the Ages', icon: '🌟', desc: 'Gain great renown for your house.', snap: c => G.s.dyns[c.dyn]?.renown || 0, target: (c, b) => Math.round(b + 500), value: c => G.s.dyns[c.dyn]?.renown || 0, reward: { prestige: 200, legacyDiscount: true }, ok: c => !!c.dyn },
};

export function ambitionOptions(c) { return Object.entries(AMBITIONS).filter(([, a]) => a.ok(c)).map(([k]) => k); }
export function chooseAmbition(c, id) {
  const a = AMBITIONS[id]; if (!a) return;
  const base = a.snap(c);
  G.s.ambition = { id, char: c.id, base, target: a.target(c, base), start: G.s.day, until: G.s.day + 365 * 12 };
  log(`${c.name} vowed: ${a.name}.`, { type: 'ambition', ids: [c.id], icon: a.icon });
}
export function ambitionProgress() {
  const am = G.s?.ambition; if (!am) return null; const c = ch(am.char); const a = AMBITIONS[am.id]; if (!c || !a) return null;
  const v = a.value(c, am.base); const done = v >= am.target;
  const frac = Math.max(0, Math.min(1, (v - am.base) / Math.max(1, am.target - am.base)));
  return { a, am, c, v, frac, done };
}
export function monthlyAmbition() {
  const am = G.s.ambition; if (!am) return;
  const c = ch(am.char);
  if (!c || c.dead || c.id !== G.s.player) { G.s.ambition = null; return; }
  const p = ambitionProgress(); if (!p) return;
  if (p.done) {
    const r = p.a.reward;
    if (r.prestige) addPrestige(c, r.prestige);
    if (r.piety) addPiety(c, r.piety);
    if (r.stress) c.stress = Math.max(0, c.stress + r.stress);
    if (r.renown && G.s.dyns[c.dyn]) G.s.dyns[c.dyn].renown += r.renown;
    if (r.trait && !c.traits.includes(r.trait)) { c.traits.push(r.trait); invalidateMods(c.id); }
    if (r.grandeur) c.grandeurBonus = (c.grandeurBonus || 0) + r.grandeur;
    if (r.artifact) createArtifact(c, r.artifact, 2, null, { origin: 'Ambition fulfilled' });
    if (r.legacyDiscount && G.s.dyns[c.dyn]) G.s.dyns[c.dyn].renown += 300;
    G.s.ambitionsDone = (G.s.ambitionsDone || 0) + 1;
    log(`${c.name} fulfilled the ambition: ${p.a.name}.`, { type: 'ambition', ids: [c.id], icon: '🏅' });
    notify(`Ambition fulfilled: ${p.a.name}!`, { type: 'good', icon: '🏅', important: true, sound: 'fanfare' });
    emit('ambitionDone', p.a);
    G.s.ambition = null;
  } else if (G.s.day > am.until) {
    notify(`You have abandoned your ambition: ${p.a.name}.`, { type: 'bad', icon: '🥀' });
    c.stress += 15; G.s.ambition = null;
  }
}
export function rewardText(r) {
  return [r.prestige && `+${r.prestige} 👑`, r.piety && `+${r.piety} 🙏`, r.renown && `+${r.renown} 🌟`, r.stress && `${r.stress} 😰`, r.trait && `trait`, r.grandeur && `+${r.grandeur} grandeur`, r.artifact && `masterwork ${r.artifact}`, r.legacyDiscount && `+300 🌟`].filter(Boolean).join(' · ');
}
