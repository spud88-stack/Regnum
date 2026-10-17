// Narrative events, activities and court petitions.
import { G, emit, markDirty } from '../state.js';
import { TRAITS, ACTIVITIES, LIFESTYLES, MAA } from '../data/traits.js';
import { FAITHS } from '../data/cultures.js';
import { ch, T, idx, age, isAdult, isRuler, rankOf, primary, vassalsOf, courtiersOf, domainOf, mods, stat, prowess, addTrait, removeTrait, hasTrait, createChar, opinion, addOpinion, log, notify, isPlayer, displayName, titleName, kidsOf, addPrestige, addPiety, faith, culture, createArtifact, randomDynName, createDynasty, realmProvs, liegeOf, grandeur, STATS, STAT_NAMES } from './core.js';
import { kill } from './life.js';
import { adjacentRealms } from './war.js';
import { rand, randi, chance, pick, clamp, weighted, fmtNum } from '../util.js';

// ---------- Effects ----------
export function applyFx(c, fx, x = {}) {
  for (const e of fx || []) {
    const [k, a, b, d] = e;
    switch (k) {
      case 'gold': c.gold += a; break;
      case 'prestige': addPrestige(c, a); break;
      case 'piety': addPiety(c, a); break;
      case 'stress': c.stress = Math.max(0, c.stress + a); break;
      case 'renown': { const dy = G.s.dyns[c.dyn]; if (dy) dy.renown += a; break; }
      case 'opinion': { const t = x[a]; if (t) addOpinion(t, c, b, d || 'Event', 60); break; }
      case 'opinionVassals': for (const v of vassalsOf(c.id)) addOpinion(ch(v), c, a, b || 'Event', 60); break;
      case 'trait': addTrait(a === 'self' ? c : x[a] || c, b || a); break;
      case 'traitOf': if (x[a]) addTrait(x[a], b); break;
      case 'rmtrait': removeTrait(c, a); break;
      case 'health': c.health += a; break;
      case 'xp': c.xp[c.focus || 'diplomacy'] = (c.xp[c.focus || 'diplomacy'] || 0) + a; break;
      case 'dev': { const p = x.p ?? c.capital; if (p !== null && p !== undefined) G.s.provs[p].dev = Math.max(0, G.s.provs[p].dev + a); break; }
      case 'artifact': createArtifact(c, a, b, d || undefined, { origin: x.origin || 'Acquired' }); break;
      case 'kill': if (x[a]) kill(x[a], b || 'accident', c.id); break;
      case 'die': kill(c, a || 'accident'); break;
      case 'wound': addTrait(c, chance(0.4) ? 'scarred' : 'wounded'); break;
      case 'friend': if (x[a] && !c.rel.friends.includes(x[a].id)) { c.rel.friends.push(x[a].id); x[a].rel.friends.push(c.id); } break;
      case 'rival': if (x[a] && !c.rel.rivals.includes(x[a].id)) { c.rel.rivals.push(x[a].id); x[a].rel.rivals.push(c.id); } break;
      case 'lover': if (x[a] && !c.rel.lovers.includes(x[a].id)) { c.rel.lovers.push(x[a].id); x[a].rel.lovers.push(c.id); } break;
      case 'hook': if (x[a]) { c.hooks = c.hooks || {}; c.hooks[x[a].id] = b || 'weak'; } break;
      case 'claim': { const tid = typeof a === 'string' && T(a) ? a : x[a]; if (tid && !c.claims.includes(tid)) c.claims.push(tid); break; }
      case 'levy': c.levyCur = Math.max(0, (c.levyCur || 0) + a); break;
      case 'grandeur': c.grandeurBonus = (c.grandeurBonus || 0) + a; break;
      case 'stat': c.base[a] = (c.base[a] || 0) + b; break;
      case 'tyranny': c.tyranny = (c.tyranny || 0) + a; break;
      case 'merc': hireMercs(c, a); break;
      case 'chance': if (chance(a)) applyFx(c, b, x); else applyFx(c, d, x); break;
      case 'fn': a(c, x); break;
    }
  }
}
const FXN = { gold: '🪙 Gold', prestige: '👑 Prestige', piety: '🙏 Piety', stress: '😰 Stress', renown: '🌟 Renown', health: '❤ Health', xp: '📘 Lifestyle XP', levy: '⚔ Levies', grandeur: '🏛 Grandeur' };
export function describeFx(fx, x = {}, depth = 0) {
  const parts = [];
  for (const e of fx || []) {
    const [k, a, b, d] = e;
    if (FXN[k]) parts.push(`${a > 0 ? '+' : ''}${fmtNum(a)} ${FXN[k]}`);
    else if (k === 'opinion') parts.push(`${x[a]?.name || 'They'}: ${b > 0 ? '+' : ''}${b} Opinion`);
    else if (k === 'opinionVassals') parts.push(`Vassals: ${a > 0 ? '+' : ''}${a} Opinion`);
    else if (k === 'trait') parts.push(`Gain trait ${TRAITS[b || a]?.icon || ''} ${TRAITS[b || a]?.name}`);
    else if (k === 'traitOf') parts.push(`${x[a]?.name}: gains ${TRAITS[b]?.name}`);
    else if (k === 'rmtrait') parts.push(`Lose ${TRAITS[a]?.name}`);
    else if (k === 'dev') parts.push(`${a > 0 ? '+' : ''}${a} Development`);
    else if (k === 'artifact') parts.push(`Gain an artifact`);
    else if (k === 'kill') parts.push(`${x[a]?.name} dies`);
    else if (k === 'die') parts.push(`☠ You die`);
    else if (k === 'wound') parts.push(`You may be wounded`);
    else if (k === 'friend') parts.push(`Become friends with ${x[a]?.name}`);
    else if (k === 'rival') parts.push(`Become rivals with ${x[a]?.name}`);
    else if (k === 'lover') parts.push(`Become lovers with ${x[a]?.name}`);
    else if (k === 'hook') parts.push(`Gain a ${b || 'weak'} hook on ${x[a]?.name}`);
    else if (k === 'claim') parts.push(`Gain a claim`);
    else if (k === 'stat') parts.push(`+${b} ${STAT_NAMES[a]}`);
    else if (k === 'tyranny') parts.push(`+${a} Tyranny`);
    else if (k === 'merc') parts.push(`Hire a mercenary company`);
    else if (k === 'chance') parts.push(`${Math.round(a * 100)}% chance: ${describeFx(b, x, depth + 1) || 'nothing'}${d ? ` — otherwise: ${describeFx(d, x, depth + 1) || 'nothing'}` : ''}`);
    else if (k === 'fn' && b) parts.push(b);
  }
  return parts.join(depth ? ', ' : ' · ');
}

// ---------- Helpers for event setup ----------
const vassal = c => { const v = vassalsOf(c.id).map(ch).filter(x => x && !x.dead); return v.length ? pick(v) : null; };
const courtier = (c, f) => { const v = courtiersOf(c.id).map(ch).filter(x => x && !x.dead && isAdult(x) && (!f || f(x))); return v.length ? pick(v) : null; };
const neighbor = c => { const n = adjacentRealms(c.id).map(ch).filter(Boolean); return n.length ? pick(n) : null; };
const capName = c => (c.capital !== null && c.capital !== undefined ? G.world.provinces[c.capital]?.name : 'your capital');
const child = c => { const k = kidsOf(c).filter(k => !k.dead && age(k) >= 6 && age(k) < 16); return k.length ? pick(k) : null; };
const he = x => (x?.f ? 'she' : 'he'), his = x => (x?.f ? 'her' : 'his'), him = x => (x?.f ? 'her' : 'him');

// ---------- Event library ----------
export const EVENTS = [
  { id: 'petition', title: 'A Peasant\'s Petition', scene: 'throne', w: c => 10,
    setup: c => ({}), desc: c => `A delegation of peasants from ${capName(c)} kneels before you, caps in hand. The harvest has failed in the lower fields, and they beg relief from this season's dues.`,
    opts: [ { t: 'Grant them relief.', fx: [['gold', -25], ['piety', 40], ['dev', 0.5]], ai: { generous: 3, compassionate: 3 } },
      { t: 'The law is the law.', trait: 'just', fx: [['prestige', 30]], ai: { just: 3, greedy: 1 } },
      { t: 'Have them whipped for their insolence.', fx: [['gold', 10], ['stress', -10], ['tyranny', 2], ['dev', -0.5]], ai: { sadistic: 4, callous: 2, wrathful: 2 } } ] },
  { id: 'heretic', title: 'A Heretical Preacher', scene: 'church', w: c => (faith(c.fai).family === 'christian' || faith(c.fai).family === 'islamic' ? 6 : 0),
    desc: c => `A wild-eyed preacher has been gathering crowds in the market square of ${capName(c)}, denouncing the clergy as corrupt and promising salvation through poverty alone.`,
    opts: [ { t: 'Burn the heretic!', trait: 'zealous', fx: [['piety', 80], ['stress', 0]], ai: { zealous: 4, wrathful: 1 } },
      { t: 'Debate him publicly.', fx: [['chance', 0.6, [['prestige', 60], ['piety', 40]], [['prestige', -40]]]], ai: { gregarious: 2, scholar: 3 } },
      { t: 'Ignore him. Words are wind.', trait: 'cynical', fx: [['piety', -40], ['stress', -5]], ai: { cynical: 3, lazy: 2 } } ] },
  { id: 'bandits', title: 'Bandits on the Roads', scene: 'road', w: c => (rankOf(c) >= 1 ? 7 : 0),
    desc: c => `Merchants report that a band of outlaws has taken to the forests near ${capName(c)}, robbing travelers and burning a mill. Trade is suffering.`,
    opts: [ { t: 'I will lead the hunt myself!', trait: 'brave', fx: [['chance', Math.min(0.85, 0.4), [['prestige', 80], ['gold', 30]], [['wound'], ['prestige', -20]]]], dyn: c => [['chance', clamp(0.25 + prowess(c) / 40, 0.2, 0.9), [['prestige', 80], ['gold', 30]], [['wound'], ['prestige', -20]]]], ai: { brave: 4, wrathful: 2 } },
      { t: 'Send the levies to clear the woods.', fx: [['gold', -20], ['levy', -100], ['prestige', 20]], ai: { diligent: 2, just: 1 } },
      { t: 'Pay them to move on.', fx: [['gold', -35], ['prestige', -30]], ai: { craven: 4, content: 1 } } ] },
  { id: 'guild', title: 'The Merchant Guild', scene: 'market', w: c => (G.s.provs[c.capital]?.dev > 8 ? 7 : 2),
    desc: c => `The wealthiest merchants of ${capName(c)} propose a guild charter: monopolies on wool and wine, in exchange for a generous "gift" to your treasury.`,
    opts: [ { t: 'Take their gold.', trait: 'greedy', fx: [['gold', 70], ['dev', -1]], ai: { greedy: 4 } },
      { t: 'Grant a charter that favors growth.', fx: [['gold', 20], ['dev', 2]], ai: { diligent: 2, just: 2 } },
      { t: 'Monopolies breed corruption. Refuse.', fx: [['prestige', 20], ['piety', 20]], ai: { honest: 3, stubborn: 2 } } ] },
  { id: 'comet', title: 'A Star with a Tail', scene: 'night', w: c => ([1066, 1145, 1222, 1301, 1378, 1456, 837, 989].some(y => Math.abs(G.s.day / 365 - y) < 0.6) ? 200 : 0.8), once: true,
    desc: c => `For seven nights a great star with a fiery tail has hung over the realm. The common folk whisper of doom; the astrologers of portents; the priests of God's judgement.`,
    opts: [ { t: 'It heralds my triumph!', trait: 'arrogant', fx: [['prestige', 80], ['stress', -5]], ai: { arrogant: 3, ambitious: 3 } },
      { t: 'We must pray and fast.', trait: 'zealous', fx: [['piety', 80], ['stress', 10]], ai: { zealous: 3, paranoid: 2 } },
      { t: 'A natural phenomenon. Study it.', fx: [['xp', 300], ['piety', -20]], ai: { cynical: 3, scholar: 3 } } ] },
  { id: 'feud', title: 'A Feud at Court', scene: 'feast', w: c => (vassalsOf(c.id).length >= 2 ? 7 : 0),
    setup: c => { const v = vassalsOf(c.id).map(ch).filter(Boolean); if (v.length < 2) return null; const a = pick(v); const b = pick(v.filter(x => x !== a)); return { x: a, y: b }; },
    desc: (c, x) => `At the high table, ${displayName(x.x)} and ${displayName(x.y)} come to blows over a disputed mill on their shared border. All eyes turn to you for judgement.`,
    opts: [ { t: (c, x) => `Rule for ${x.x.name}.`, fx: [['opinion', 'x', 20, 'Ruled in my favor'], ['opinion', 'y', -20, 'Ruled against me']], ai: { just: 1 } },
      { t: (c, x) => `Rule for ${x.y.name}.`, fx: [['opinion', 'y', 20, 'Ruled in my favor'], ['opinion', 'x', -20, 'Ruled against me']], ai: { just: 1 } },
      { t: 'Split the mill — and its profits — with the crown.', trait: 'greedy', fx: [['gold', 30], ['opinion', 'x', -10, 'Greedy judgement'], ['opinion', 'y', -10, 'Greedy judgement']], ai: { greedy: 3 } },
      { t: 'Settle it with a duel!', trait: 'wrathful', fx: [['prestige', 30], ['chance', 0.5, [['kill', 'x', 'duel']], [['kill', 'y', 'duel']]]], ai: { wrathful: 2, sadistic: 3 } } ] },
  { id: 'distant_spouse', title: 'A Cold Marriage Bed', scene: 'bedroom', w: c => (c.spouse && opinion(ch(c.spouse), c) < 10 ? 6 : 0),
    setup: c => ({ x: ch(c.spouse) }), desc: (c, x) => `${x.x.name} has grown distant. Meals pass in silence; ${he(x.x)} retires early and rises late. The servants have begun to gossip.`,
    opts: [ { t: 'Woo them anew with gifts.', fx: [['gold', -30], ['opinion', 'x', 30, 'Rekindled romance']], ai: { generous: 2, compassionate: 2 } },
      { t: 'Speak plainly about what troubles them.', trait: 'honest', fx: [['chance', 0.65, [['opinion', 'x', 25, 'Honest talk'], ['stress', -10]], [['opinion', 'x', -10, 'Harsh words']]]], ai: { honest: 3 } },
      { t: 'I have no time for this.', fx: [['opinion', 'x', -15, 'Neglected'], ['stress', 5]], ai: { callous: 3, ambitious: 1 } } ] },
  { id: 'tutor', title: 'The Tutor\'s Report', scene: 'study', w: c => (child(c) ? 6 : 0),
    setup: c => ({ x: child(c) }), desc: (c, x) => `${x.x.name}'s tutor bows low. "Your child has a quick mind, but it wanders. Tell me, in what arts shall I focus ${his(x.x)} education?"`,
    opts: STATS.map(s => ({ t: `${['dip','mar','ste','int','lea'].includes(s) ? ({ dip: 'Diplomacy — the art of men', mar: 'Martial — the art of war', ste: 'Stewardship — the art of coin', int: 'Intrigue — the art of secrets', lea: 'Learning — the art of truth' })[s] : s}`, fx: [['fn', (c, x) => { x.x.eduFocus = s; x.x.base[s] += 1; }, `${'{name}'} will be educated in ${STAT_NAMES[s]}`]] })) },
  { id: 'duel', title: 'A Challenge', scene: 'tournament', w: c => (isAdult(c) && !c.f && age(c) < 55 ? 4 : 0),
    setup: c => { const k = courtier(c, x => !x.f && prowess(x) > 6) || vassal(c); return k ? { x: k } : null; },
    desc: (c, x) => `Deep in his cups, ${displayName(x.x)} slams his goblet down and declares before the whole hall that you are a coward who hides behind your guards. He demands satisfaction.`,
    opts: [ { t: 'Draw steel!', trait: 'brave', dyn: (c, x) => { const p = clamp(0.5 + (prowess(c) - prowess(x.x)) * 0.05, 0.1, 0.92); return [['chance', p, [['prestige', 120], ['chance', 0.4, [['kill', 'x', 'duel']], [['opinion', 'x', -20, 'Beaten in a duel']]]], [['prestige', -60], ['chance', 0.25, [['die', 'duel']], [['wound']]]]]]; }, ai: { brave: 4, wrathful: 3 } },
      { t: 'Have him thrown in the dungeon.', fx: [['tyranny', 3], ['opinion', 'x', -40, 'Imprisoned'], ['fn', (c, x) => { x.x.imprisoned = c.id; x.x.court = c.id; }, 'He is imprisoned']], ai: { arbitrary: 3, paranoid: 2 } },
      { t: 'Laugh it off.', trait: 'calm', fx: [['prestige', -20], ['stress', -5]], ai: { calm: 3, craven: 3 } } ] },
  { id: 'relic_sale', title: 'A Relic for Sale', scene: 'church', w: c => (c.gold > 80 ? 4 : 0),
    desc: c => `A traveling friar offers you a reliquary of silver and crystal, containing — he swears — a finger bone of a great saint. He asks a hundred gold for it.`,
    opts: [ { t: 'Buy it.', fx: [['gold', -100], ['chance', 0.7, [['artifact', 'relic', 1]], [['piety', -30], ['prestige', -20]]]], ai: { zealous: 3, trusting: 2 } },
      { t: 'Have it examined by my chaplain first.', fx: [['gold', -15], ['chance', 0.5, [['gold', -85], ['artifact', 'relic', 1]], [['piety', 20]]]], ai: { paranoid: 2, scholar: 2 } },
      { t: 'Charlatan! Drive him out.', trait: 'cynical', fx: [['prestige', 10]], ai: { cynical: 3, greedy: 2 } } ] },
  { id: 'sleepless', title: 'Sleepless Nights', scene: 'night', w: c => (c.stress > 40 ? 8 : 0),
    desc: c => `You have not slept properly in weeks. The weight of the crown presses on your chest each night; every shadow seems to hold a dagger.`,
    opts: [ { t: 'Seek comfort in wine.', fx: [['stress', -30], ['chance', 0.3, [['trait', 'drunkard']]]] },
      { t: 'Pray until dawn.', fx: [['stress', -20], ['piety', 20], ['chance', 0.2, [['trait', 'flagellant']]]] },
      { t: 'Throw myself into my work.', fx: [['stress', -10], ['xp', 200]] },
      { t: 'Ride out alone into the hills.', fx: [['stress', -25], ['chance', 0.1, [['wound']]]] } ] },
  { id: 'land_request', title: 'An Ambitious Courtier', scene: 'throne', w: c => (domainOf(c.id).length > 2 && courtier(c, x => !x.f && x.dyn) ? 4 : 0),
    setup: c => { const k = courtier(c, x => !x.f && x.dyn); return k ? { x: k } : null; },
    desc: (c, x) => `${displayName(x.x)} has served you faithfully for years. Now ${he(x.x)} asks — humbly, but with a glint in ${his(x.x)} eye — for lands of ${his(x.x)} own.`,
    opts: [ { t: 'Promise land in time.', fx: [['opinion', 'x', 15, 'Promised land']] },
      { t: 'Refuse. Know your place.', fx: [['opinion', 'x', -30, 'Refused land'], ['prestige', 10]], ai: { arrogant: 2 } },
      { t: 'Grant a gift of gold instead.', fx: [['gold', -40], ['opinion', 'x', 25, 'Generous gift']], ai: { generous: 3 } } ] },
  { id: 'plague', title: 'Pestilence', scene: 'plague', w: c => (G.s.day / 365 >= 1346 && G.s.day / 365 <= 1353 ? 40 : 2),
    setup: c => { const d = domainOf(c.id); return d.length ? { p: pick(d) } : null; },
    desc: (c, x) => `Sickness has broken out in ${G.world.provinces[x.p].name}. Black swellings, fever, death within days. The people flee the towns.`,
    opts: [ { t: 'Seal the town. No one leaves.', trait: 'callous', fx: [['dev', -1.5], ['chance', 0.9, [], [['trait', 'self', 'plague']]]], ai: { callous: 3, paranoid: 2 } },
      { t: 'Send physicians and alms.', fx: [['gold', -40], ['dev', -0.5], ['piety', 40], ['chance', 0.75, [], [['trait', 'self', 'ill']]]], ai: { compassionate: 3 } },
      { t: 'Visit the sick to show courage.', trait: 'brave', fx: [['prestige', 80], ['dev', -1], ['chance', 0.5, [['trait', 'self', 'plague']], [['piety', 60]]]], ai: { brave: 2, zealous: 2 } } ] },
  { id: 'scholar', title: 'A Wandering Scholar', scene: 'study', w: c => 4,
    desc: c => `A threadbare scholar arrives with a satchel of manuscripts — translations of the ancients, star charts, a treatise on medicine. He seeks patronage.`,
    opts: [ { t: 'Become his patron.', fx: [['gold', -40], ['xp', 400], ['chance', 0.3, [['artifact', 'book', 1]]]], ai: { scholar: 4, diligent: 2 } },
      { t: 'Debate philosophy late into the night.', fx: [['stat', 'lea', 1], ['stress', -5]], ai: { gregarious: 2 } },
      { t: 'Books do not win wars.', fx: [['prestige', 5]], ai: { lazy: 2 } } ] },
  { id: 'mercs', title: 'Swords for Hire', scene: 'road', w: c => (G.s.wars.some(w => w.att.includes(c.id) || w.def.includes(c.id)) ? 6 : 1),
    desc: c => `A grizzled captain with a scarred face presents his company — five hundred veterans and a train of camp followers. "Our steel is yours, my lord, for the right price."`,
    opts: [ { t: 'Hire the company (150 gold + upkeep).', req: c => c.gold >= 150, fx: [['gold', -150], ['merc', 'company']], ai: { brave: 1, ambitious: 2 } },
      { t: 'Hire them for a single campaign (60 gold).', req: c => c.gold >= 60, fx: [['gold', -60], ['merc', 'small']] },
      { t: 'We have no need of sellswords.', fx: [] } ] },
  { id: 'minstrel', title: 'A Song of Your Deeds', scene: 'feast', w: c => 4,
    desc: c => `A minstrel performs a new song at your table — a ballad of your deeds, embellished to the point of legend. The hall roars with approval.`,
    opts: [ { t: 'Reward him handsomely.', fx: [['gold', -20], ['prestige', 60]], ai: { generous: 3, arrogant: 3 } },
      { t: 'Have him sing it across the land.', fx: [['gold', -45], ['prestige', 120], ['renown', 40]], ai: { ambitious: 3 } },
      { t: 'Such flattery is unseemly.', trait: 'humble', fx: [['piety', 30]], ai: { humble: 4 } } ] },
  { id: 'smith', title: 'The Master Smith', scene: 'market', w: c => (c.gold > 60 ? 3 : 0),
    desc: c => `A master smith from the east has settled in your capital. He claims he can forge a blade to rival the legendary swords of old — given ore, time and gold.`,
    opts: [ { t: 'Commission a masterwork blade.', req: c => c.gold >= 150, fx: [['gold', -150], ['artifact', 'sword', 2]], ai: { brave: 2, arrogant: 2 } },
      { t: 'Commission a crown instead.', req: c => c.gold >= 180, fx: [['gold', -180], ['artifact', 'crown', 2]], ai: { arrogant: 3, ambitious: 2 } },
      { t: 'A simple blade will do.', req: c => c.gold >= 50, fx: [['gold', -50], ['artifact', 'sword', 0]] },
      { t: 'Not now.', fx: [] } ] },
  { id: 'intercept', title: 'An Intercepted Letter', scene: 'night', w: c => (vassalsOf(c.id).length ? 4 : 0),
    setup: c => { const v = vassal(c); return v ? { x: v } : null; },
    desc: (c, x) => `Your guards have seized a courier carrying a sealed letter from ${displayName(x.x)} to a foreign court. The wax is still warm.`,
    opts: [ { t: 'Read it — and keep it.', trait: 'deceitful', fx: [['hook', 'x', 'weak'], ['stress', 0]], ai: { deceitful: 3, paranoid: 3 } },
      { t: 'Confront them with it.', fx: [['opinion', 'x', -15, 'Accused of treachery'], ['prestige', 20]], ai: { wrathful: 2, honest: 2 } },
      { t: 'Return it unopened.', trait: 'honest', fx: [['opinion', 'x', 30, 'Honorable conduct'], ['piety', 20]], ai: { honest: 4, trusting: 3 } } ] },
  { id: 'wolves', title: 'Wolves in the Hills', scene: 'forest', w: c => ([ 'taiga', 'forest', 'mountains', 'hills'].includes(G.world.provinces[c.capital]?.terrain) && isAdult(c) ? 4 : 0),
    desc: c => `A great grey wolf, larger than any the shepherds have seen, has been taking sheep and — some say — children from the hill villages.`,
    opts: [ { t: 'I will hunt the beast myself.', trait: 'brave', dyn: c => [['chance', clamp(0.3 + prowess(c) / 30, 0.2, 0.9), [['prestige', 90], ['stress', -10], ['chance', 0.3, [['trait', 'self', 'hunter']]]], [['wound']]]], ai: { brave: 3, hunter: 4 } },
      { t: 'Offer a bounty.', fx: [['gold', -25], ['prestige', 15]] },
      { t: 'The peasants can deal with it.', fx: [['dev', -0.3]], ai: { lazy: 3, callous: 2 } } ] },
  { id: 'ruins', title: 'Ancient Ruins', scene: 'road', w: c => 2.5,
    desc: c => `Farmers plowing near ${capName(c)} have struck worked stone. Your steward reports the outline of an ancient villa — mosaics, broken statues, and a sealed vault.`,
    opts: [ { t: 'Excavate the vault.', fx: [['gold', -30], ['chance', 0.5, [['artifact', pick(['tapestry', 'crown', 'book']), randi(1, 2)]], [['gold', 40]]]], ai: { ambitious: 2, scholar: 3 } },
      { t: 'Use the stone to build.', fx: [['dev', 1]], ai: { diligent: 2 } },
      { t: 'Pagan relics — bury them again.', trait: 'zealous', fx: [['piety', 40]], ai: { zealous: 3 } } ] },
  { id: 'prophet', title: 'The Mad Prophet', scene: 'church', w: c => 3,
    desc: c => `A ragged hermit forces his way into your hall and points a bony finger at you. "I have seen your death!" he shrieks. "Fire and water! Repent, before the year is out!"`,
    opts: [ { t: 'Ask him what else he saw.', trait: 'paranoid', fx: [['stress', 15], ['chance', 0.4, [['xp', 400], ['trait', 'self', 'mystic']]]], ai: { paranoid: 3, zealous: 2 } },
      { t: 'Throw him out.', fx: [['stress', -5], ['piety', -10]], ai: { cynical: 3, wrathful: 2 } },
      { t: 'Give him bread and a bed.', trait: 'compassionate', fx: [['gold', -5], ['piety', 40]], ai: { compassionate: 4 } } ] },
  { id: 'envoy', title: 'Envoys from Afar', scene: 'throne', w: c => (rankOf(c) >= 3 ? 3 : 0),
    desc: c => `Envoys from a distant land arrive bearing exotic gifts: silks, a caged leopard, spices that perfume the whole palace. They seek friendship and trade.`,
    opts: [ { t: 'Receive them with full honors.', fx: [['gold', -30], ['prestige', 100], ['grandeur', 2]], ai: { gregarious: 2, arrogant: 2 } },
      { t: 'Negotiate a trade agreement.', fx: [['gold', 60], ['prestige', 20]], ai: { greedy: 3 } },
      { t: 'Send them away with suspicion.', trait: 'paranoid', fx: [['stress', -5]], ai: { paranoid: 3 } } ] },
  { id: 'gamble', title: 'Dice at Midnight', scene: 'feast', w: c => (c.traits.includes('drunkard') || c.traits.includes('gregarious') ? 5 : 2),
    desc: c => `Late at night, your knights have started a game of dice. The stakes are rising, and they dare you to join.`,
    opts: [ { t: 'Roll the bones!', fx: [['chance', 0.5, [['gold', 60], ['stress', -15]], [['gold', -60], ['stress', 5]]]], ai: { gregarious: 3, impatient: 2 } },
      { t: 'Play cautiously.', fx: [['chance', 0.5, [['gold', 15]], [['gold', -15]]], ['stress', -5]] },
      { t: 'Gambling is a sin.', trait: 'zealous', fx: [['piety', 20]] } ] },
  { id: 'heir_trouble', title: 'Your Heir\'s Folly', scene: 'throne', w: c => (kidsOf(c).some(k => !k.dead && age(k) >= 16 && age(k) < 30 && k.court === c.id) ? 3 : 0),
    setup: c => { const k = kidsOf(c).filter(k => !k.dead && age(k) >= 16 && age(k) < 30 && k.court === c.id); return k.length ? { x: pick(k) } : null; },
    desc: (c, x) => `${x.x.name} has run up gambling debts with the Jewish and Lombard moneylenders, and was seen brawling in a tavern. The court is scandalized.`,
    opts: [ { t: 'Pay the debts quietly.', fx: [['gold', -50], ['opinion', 'x', 20, 'Paid my debts']], ai: { generous: 3, compassionate: 2 } },
      { t: 'A lesson in hard work: send them to the frontier.', fx: [['opinion', 'x', -20, 'Harsh lesson'], ['fn', (c, x) => { x.x.base.mar += 2; }, '+2 Martial for them']], ai: { stubborn: 2, just: 2 } },
      { t: 'Disown them publicly.', fx: [['opinion', 'x', -60, 'Disowned'], ['prestige', 20]], ai: { wrathful: 3, arrogant: 2 } } ] },
  { id: 'pagan_rite', title: 'The Blood Rite', scene: 'forest', w: c => (faith(c.fai).family === 'pagan' ? 6 : 0),
    desc: c => `The priests say the gods are hungry. The old rite demands a sacrifice at the sacred grove under the full moon — a stallion, or something more precious.`,
    opts: [ { t: 'Sacrifice a white stallion.', fx: [['gold', -20], ['piety', 60]], ai: { zealous: 2 } },
      { t: 'Sacrifice a captive.', trait: 'sadistic', fx: [['piety', 150], ['tyranny', 2], ['stress', 0]], ai: { sadistic: 4, zealous: 2 } },
      { t: 'The gods can wait.', fx: [['piety', -40]], ai: { cynical: 3 } } ] },
  { id: 'old_friend', title: 'An Old Friend Returns', scene: 'road', w: c => (c.rel.friends.length < 2 ? 3 : 0),
    setup: c => { const k = courtier(c) || vassal(c); return k ? { x: k } : null; },
    desc: (c, x) => `${displayName(x.x)} returns from a long journey, full of stories and laughter. You remember the old days, when you were both young and the world seemed simpler.`,
    opts: [ { t: 'Embrace them as a friend.', fx: [['friend', 'x'], ['stress', -15]] },
      { t: 'Keep a cordial distance.', fx: [['opinion', 'x', 10, 'Warm welcome']] } ] },
  { id: 'insult', title: 'An Insult Too Far', scene: 'throne', w: c => (adjacentRealms(c.id).length ? 3 : 0),
    setup: c => { const n = neighbor(c); return n ? { x: n } : null; },
    desc: (c, x) => `A letter arrives from ${displayName(x.x)}. Beneath the courtesies lies a barbed insult: a mocking reference to your ${c.traits.includes('bastard') ? 'birth' : 'ancestry'} that has the whole court sniggering.`,
    opts: [ { t: 'This means rivalry.', trait: 'vengeful', fx: [['rival', 'x'], ['prestige', 30]], ai: { vengeful: 4, wrathful: 3 } },
      { t: 'Reply with a sharper wit.', fx: [['chance', clamp(0.3, 0.3, 0.8), [['prestige', 80]], [['prestige', -30]]]], dyn: c => [['chance', clamp(stat(c, 'dip') / 20, 0.2, 0.85), [['prestige', 80]], [['prestige', -30]]]], ai: { gregarious: 2 } },
      { t: 'Ignore it with dignity.', trait: 'calm', fx: [['stress', 5], ['piety', 10]], ai: { calm: 3, forgiving: 3 } } ] },
  { id: 'remedy', title: 'The Physician\'s Remedy', scene: 'bedroom', w: c => (c.traits.some(t => ['ill', 'pneumonic', 'wounded', 'plague'].includes(t)) ? 30 : 0),
    desc: c => `Your physician hovers over your sickbed with a bowl of leeches and a foul-smelling poultice of goat dung and honey. "Trust me, my lord."`,
    opts: [ { t: 'Trust the physician.', fx: [['chance', 0.55, [['fn', c => { ['ill', 'pneumonic', 'wounded'].forEach(t => removeTrait(c, t)); }, 'Cured']], [['health', -0.3]]]] },
      { t: 'Pray for deliverance.', fx: [['piety', 30], ['chance', 0.35, [['fn', c => { ['ill', 'pneumonic', 'wounded'].forEach(t => removeTrait(c, t)); }, 'Cured']]]] },
      { t: 'Send for a famous physician (80 gold).', req: c => c.gold >= 80, fx: [['gold', -80], ['chance', 0.85, [['fn', c => { ['ill', 'pneumonic', 'wounded', 'plague'].forEach(t => removeTrait(c, t)); }, 'Cured']]]] } ] },
  { id: 'monastery', title: 'A Request from the Abbot', scene: 'church', w: c => (faith(c.fai).family === 'christian' ? 4 : 2),
    desc: c => `The abbot of a nearby monastery requests your patronage for a new scriptorium. In return the monks will pray for your soul — and record your reign favorably.`,
    opts: [ { t: 'Fund it generously.', fx: [['gold', -60], ['piety', 100], ['renown', 30]], ai: { zealous: 3, generous: 2 } },
      { t: 'A modest donation.', fx: [['gold', -20], ['piety', 35]] },
      { t: 'The Church is rich enough.', trait: 'greedy', fx: [['piety', -20]], ai: { greedy: 3, cynical: 2 } } ] },
  { id: 'raid_warning', title: 'Sails on the Horizon', scene: 'sea', w: c => (G.world.provinces[c.capital]?.coastal && G.s.era <= 2 ? 2 : 0),
    desc: c => `Lookouts report dragon-prowed ships off the coast. The fishermen are fleeing inland. Raiders — they will strike within days.`,
    opts: [ { t: 'Muster the levies on the shore.', fx: [['gold', -15], ['prestige', 30]], ai: { brave: 3 } },
      { t: 'Pay them tribute to go elsewhere.', fx: [['gold', -60]], ai: { craven: 3, content: 2 } },
      { t: 'Hide the treasures and pray.', fx: [['dev', -1.5], ['piety', 20]] } ] },
  { id: 'genius_child', title: 'A Prodigy', scene: 'study', w: c => (child(c) ? 0.8 : 0),
    setup: c => ({ x: child(c) }), desc: (c, x) => `${x.x.name}'s tutors are astonished. At ${age(x.x)}, the child reads Latin and Greek, solves geometry problems that baffle grown men, and argues theology with the bishop.`,
    opts: [ { t: 'Nurture this gift!', fx: [['traitOf', 'x', 'quick'], ['gold', -30]] }, { t: 'Pride goes before a fall.', fx: [['traitOf', 'x', 'quick']] } ] },
  { id: 'builders', title: 'The Builders\' Guild', scene: 'market', w: c => 3,
    desc: c => `The master masons of ${capName(c)} propose to rebuild your walls in stone. Their price is steep, but they promise a fortress worthy of legend.`,
    opts: [ { t: 'Build the walls (120 gold).', req: c => c.gold >= 120 && c.capital !== null, fx: [['gold', -120], ['fn', c => { const p = G.s.provs[c.capital]; p.b.walls = Math.min(3, (p.b.walls || 0) + 1); }, '+1 Curtain Walls level in your capital']] },
      { t: 'Too expensive.', fx: [] } ] },
  { id: 'tax_refusal', title: 'A Defiant Vassal', scene: 'throne', w: c => (vassalsOf(c.id).length ? 3 : 0),
    setup: c => { const v = vassalsOf(c.id).map(ch).filter(x => x && opinion(x, c) < 0); return v.length ? { x: pick(v) } : null; },
    desc: (c, x) => `${displayName(x.x)} has refused to send this year's dues, claiming poor harvests. Your steward insists the granaries are full.`,
    opts: [ { t: 'Demand payment — or else.', fx: [['gold', 40], ['opinion', 'x', -25, 'Extorted taxes']], ai: { greedy: 2, wrathful: 2 } },
      { t: 'Forgive the debt this once.', fx: [['opinion', 'x', 20, 'Forgave my debt'], ['prestige', -20]], ai: { forgiving: 3, generous: 2 } },
      { t: 'Take a hostage — their heir.', fx: [['hook', 'x', 'weak'], ['opinion', 'x', -30, 'Took my child hostage'], ['tyranny', 3]], ai: { deceitful: 2, callous: 2 } } ] },
];

// Activity & court events
export const ACT_EVENTS = {
  feast: (c) => ({ title: 'The Grand Feast', scene: 'feast', desc: `The hall glows with torchlight. Roast swans, boars stuffed with chestnuts, and wine from the south flow freely. Your vassals drink your health — and some drink too deeply.`,
    opts: [ { t: 'Toast to my vassals\' loyalty!', fx: [['opinionVassals', 15, 'Enjoyed my feast'], ['prestige', 50], ['stress', -20]] },
      { t: 'Use the occasion to negotiate.', fx: [['opinionVassals', 8, 'Enjoyed my feast'], ['chance', 0.5, [['gold', 40]], []], ['stress', -10]] },
      { t: 'Watch for drunken loose lips.', trait: 'deceitful', fx: [['opinionVassals', 8, 'Enjoyed my feast'], ['fn', (c) => { const v = vassalsOf(c.id).map(ch); if (v.length) { c.hooks = c.hooks || {}; c.hooks[pick(v).id] = 'weak'; } }, 'Gain a weak hook on a random vassal']] } ] }),
  hunt: (c) => ({ title: 'The Hunt', scene: 'forest', desc: `Hounds bay through the morning mist. Your huntsman has tracked a great stag — a white hart, the old men whisper, a creature of legend.`,
    opts: [ { t: 'Ride hard after the hart!', dyn: c => [['chance', clamp(0.35 + prowess(c) / 40, 0.3, 0.85), [['prestige', 80], ['stress', -25], ['chance', 0.25, [['artifact', 'tapestry', 1, 'Trophy of the White Hart']]]], [['chance', 0.12, [['die', 'hunt']], [['wound'], ['stress', -10]]]]]] },
      { t: 'Let the hounds do the work.', fx: [['stress', -15], ['prestige', 25]] },
      { t: 'Spare it. Some things should stay wild.', trait: 'compassionate', fx: [['stress', -20], ['piety', 40]] } ] }),
  tournament: (c) => {
    const ks = [c, ...courtiersOf(c.id).map(ch), ...vassalsOf(c.id).map(ch)].filter(k => k && !k.dead && isAdult(k) && !k.f && age(k) < 55);
    const entrants = [...ks.slice(0, 6), ...Array.from({ length: Math.max(0, 8 - ks.length) }, () => ({ name: randomKnightName(c), pro: randi(6, 16), fake: true }))].slice(0, 8);
    return { title: 'The Grand Tournament', scene: 'tournament', desc: `Pavilions of every color line the lists. ${entrants.length} champions have come to compete in joust and melee — and the prize is a jewelled cup and a year of glory. Will you ride yourself, or sponsor a champion?`,
      opts: [ { t: 'I shall ride in the lists!', req: c => isAdult(c) && !c.f && age(c) < 55, dyn: c => [['fn', (c) => runTournament(c, entrants, true), `Your prowess (${prowess(c)}) vs the field. Win: great prestige and an artifact. Lose: risk injury.`]] },
        { t: 'Sponsor my best knight.', fx: [['fn', (c) => runTournament(c, entrants, false), 'Your champion competes for your glory']] },
        { t: 'Simply host and enjoy the spectacle.', fx: [['prestige', 60], ['stress', -15], ['opinionVassals', 5, 'Hosted a tournament']] } ] };
  },
  pilgrimage: (c) => ({ title: 'The Holy Road', scene: 'road', desc: `After weeks on the road, your party crests the last hill. Before you lies the holy city, its domes and spires gleaming in the dawn. Pilgrims weep openly.`,
    opts: [ { t: 'Walk the last mile barefoot.', fx: [['piety', 250], ['stress', -40], ['trait', 'self', 'pilgrim'], ['health', -0.1]] },
      { t: 'Make a rich donation at the shrine.', fx: [['gold', -50], ['piety', 300], ['trait', 'self', 'pilgrim'], ['chance', 0.2, [['artifact', 'relic', 1, 'Pilgrim\'s Relic']]]] },
      { t: 'Seek out the learned men of the city.', fx: [['piety', 120], ['xp', 500], ['trait', 'self', 'pilgrim']] } ] }),
  wedding: (c) => ({ title: 'A Grand Wedding', scene: 'feast', desc: `Bells ring out across the city. The bride and groom process beneath a canopy of cloth-of-gold, and the feasting will last a week.`,
    opts: [ { t: 'Let the celebrations be legendary!', fx: [['prestige', 150], ['renown', 50], ['opinionVassals', 10, 'Attended a grand wedding']] },
      { t: 'Use the gathering to forge alliances.', fx: [['prestige', 60], ['fn', c => { const n = adjacentRealms(c.id).map(ch); for (const x of n.slice(0, 3)) addOpinion(x, c, 15, 'Wedding guest', 60); }, '+15 Opinion with neighbors']] } ] }),
};
function randomKnightName(c) { return pick(['Sir Godric', 'Ser Amaury', 'Ulric the Red', 'Bertrand of the Lake', 'Konrad Ironhand', 'Diego the Swift', 'Oleg Bear-Arm', 'Tancred', 'Gaston le Noir', 'Ragnvald', 'Fulk Strongbow', 'Ottokar']); }
function runTournament(c, entrants, self) {
  const pro = x => (x.fake ? x.pro : prowess(x)) + randi(-4, 6);
  let pool = [...entrants]; if (!self) pool = pool.filter(x => x !== c);
  const champion = self ? c : [...pool].filter(x => !x.fake).sort((a, b) => prowess(b) - prowess(a))[0] || pool[0];
  const rounds = [];
  while (pool.length > 1) { const next = []; for (let i = 0; i < pool.length; i += 2) { const a = pool[i], b = pool[i + 1]; if (!b) { next.push(a); continue; } const w = pro(a) >= pro(b) ? a : b; rounds.push(`${a.name} vs ${b.name}: ${w.name} wins`); next.push(w); } pool = next; }
  const winner = pool[0];
  const won = winner === champion;
  if (won) { addPrestige(c, self ? 300 : 150); const art = createArtifact(c, pick(['crown', 'sword', 'tapestry', 'banner']), self ? 2 : 1, 'Tournament Champion\'s Prize', { origin: 'Won at a tournament' }); }
  else { addPrestige(c, 40); if (self && chance(0.25)) addTrait(c, chance(0.3) ? 'maimed' : 'wounded'); }
  c.stress = Math.max(0, c.stress - 20);
  G.s.eventQueue.push({ custom: true, title: won ? 'Victory in the Lists!' : 'The Tournament Ends', scene: 'tournament', desc: `${rounds.slice(-4).join('. ')}.\n\n${won ? `${self ? 'You are' : `${champion.name} is`} crowned champion to thunderous applause!` : `${winner.name} takes the prize. ${self ? 'You fought bravely.' : ''}`}`, opts: [{ t: won ? 'Glory!' : 'There is always next year.', fx: [] }] });
}

// ---------- Hold Court (Royal Court) ----------
export const PETITIONS = [
  (c) => { const v = vassal(c); if (!v) return null; return { title: 'Petition: A Disputed Inheritance', scene: 'throne', x: { x: v }, desc: `${displayName(v)} kneels before your throne. "My late uncle's estate was seized by the bishop. I ask the crown for justice."`, opts: [ { t: 'Restore the estate.', fx: [['opinion', 'x', 25, 'Restored my estate'], ['piety', -30]] }, { t: 'The Church\'s claim stands.', fx: [['piety', 50], ['opinion', 'x', -15, 'Denied my petition']] } ] }; },
  (c) => ({ title: 'Petition: The Artist', scene: 'throne', x: {}, desc: `A painter presents a portfolio of startling skill and begs to decorate your great hall.`, opts: [ { t: 'Commission a great fresco (80 gold).', req: c => c.gold >= 80, fx: [['gold', -80], ['artifact', 'tapestry', 2, `Fresco of ${primary(c)?.name || 'the Court'}`]] }, { t: 'A small portrait will do (25 gold).', req: c => c.gold >= 25, fx: [['gold', -25], ['grandeur', 3]] }, { t: 'Decline.', fx: [] } ] }),
  (c) => ({ title: 'Petition: The Widow', scene: 'throne', x: {}, desc: `A widow from ${capName(c)} begs for help: her sons were taken for your levies and never returned. She cannot work the farm alone.`, opts: [ { t: 'Grant her a pension.', fx: [['gold', -15], ['piety', 40], ['prestige', 20]] }, { t: 'Grief is the price of war.', fx: [['stress', 5]] } ] }),
  (c) => { const k = courtier(c); if (!k) return null; return { title: 'Petition: A Courtier\'s Grievance', scene: 'throne', x: { x: k }, desc: `${displayName(k)} complains bitterly that the court steward has been skimming from the kitchens.`, opts: [ { t: 'Investigate.', fx: [['chance', 0.6, [['gold', 40], ['opinion', 'x', 15, 'Took my side']], [['opinion', 'x', -10, 'False accusation']]]] }, { t: 'Dismiss the complaint.', fx: [['opinion', 'x', -15, 'Dismissed my grievance']] } ] }; },
  (c) => ({ title: 'Petition: The Traveling Merchant', scene: 'market', x: {}, desc: `A merchant offers exotic luxuries for your court: silk hangings, glass from Venice, spices from the Indies.`, opts: [ { t: 'Buy the finest (60 gold).', req: c => c.gold >= 60, fx: [['gold', -60], ['grandeur', 5], ['prestige', 30]] }, { t: 'Haggle for a bargain.', fx: [['chance', clamp(0.5, 0.2, 0.9), [['gold', -25], ['grandeur', 3]], [['prestige', -10]]]] }, { t: 'Send him away.', fx: [] } ] }),
];

// ---------- Engine ----------
function weightFor(ev, c) { try { return ev.w(c) || 0; } catch (e) { return 0; } }
export function rollEvents() {
  const s = G.s; const pc = ch(s.player);
  if (pc && !pc.dead && chance(0.17)) {
    const pool = EVENTS.filter(e => !(e.once && s.flags['ev_' + e.id]));
    const ev = weighted(pool, e => weightFor(e, pc));
    if (ev) fireEvent(ev, pc);
  }
  // AI rulers occasionally get events too (resolved instantly)
  const I = idx();
  for (let i = 0; i < 6; i++) {
    const c = ch(pick(I.rulers)); if (!c || c.id === s.player || rankOf(c) < 2) continue;
    const ev = weighted(EVENTS, e => weightFor(e, c)); if (ev) fireEvent(ev, c);
  }
}
export function fireEvent(ev, c, ctx) {
  let x = ctx;
  if (!x) { try { x = ev.setup ? ev.setup(c) : {}; } catch (e) { x = null; } }
  if (x === null || x === undefined) return;
  if (ev.once) G.s.flags['ev_' + ev.id] = true;
  const opts = ev.opts.map(o => ({ ...o, fxR: o.dyn ? o.dyn(c, x) : o.fx }));
  if (isPlayer(c)) {
    G.s.eventQueue.push({ id: ev.id, title: ev.title, scene: ev.scene, desc: typeof ev.desc === 'function' ? ev.desc(c, x) : ev.desc, opts, x: serializeCtx(x), charId: c.id });
    emit('event');
  } else {
    // AI choice by personality
    const choice = weighted(opts.filter(o => !o.req || o.req(c)), o => { let w = 1; for (const [t, v] of Object.entries(o.ai || {})) if (c.traits.includes(t)) w += v; if (o.trait && c.traits.includes(o.trait)) w += 2; return Math.max(0.1, w); });
    if (choice) applyFx(c, choice.fxR, x);
  }
}
function serializeCtx(x) { const o = {}; for (const [k, v] of Object.entries(x || {})) o[k] = v && typeof v === 'object' && v.id !== undefined && G.s.chars[v.id] ? { __c: v.id } : v; return o; }
export function deserializeCtx(x) { const o = {}; for (const [k, v] of Object.entries(x || {})) o[k] = v && v.__c ? ch(v.__c) : v; return o; }
export function resolvePlayerEvent(e, optIndex) {
  const c = ch(e.charId || G.s.player) || ch(G.s.player);
  const opt = e.opts[optIndex];
  const x = deserializeCtx(e.x);
  if (opt.fxR) applyFx(c, opt.fxR, x);
  else if (opt.fx) applyFx(c, opt.fx, x);
  if (opt.trait && !c.traits.includes(opt.trait) && TRAITS[opt.trait]?.cat === 'personality') c.stress += 0;
  // personality stress: acting against your nature
  if (opt.ai) { const against = Object.entries(opt.ai).filter(([t, v]) => v < 0 && c.traits.includes(t)); if (against.length) c.stress += 10; }
  markDirty();
}
export function eventPayload(e) { return e; }

// Activities
export function canStartActivity(c, type) {
  const a = ACTIVITIES[type]; if (!a) return false;
  if (G.s.activities.some(x => x.owner === c.id)) return false;
  if (c.gold < a.cost) return false;
  if (c.lastAct?.[type] && G.s.day - c.lastAct[type] < a.cooldown) return false;
  if (type === 'wedding' && !kidsOf(c).some(k => !k.dead && k.spouse && k.court === c.id) && !c.spouse) return false;
  return true;
}
export function startActivity(c, type) {
  if (!canStartActivity(c, type)) return false;
  const a = ACTIVITIES[type]; c.gold -= a.cost;
  G.s.activities.push({ type, owner: c.id, start: G.s.day, end: G.s.day + a.days });
  c.lastAct = c.lastAct || {}; c.lastAct[type] = G.s.day;
  if (isPlayer(c)) log(`You began a ${a.name}.`, { type: 'activity', icon: a.icon });
  return true;
}
export function dailyActivities() {
  for (const act of [...G.s.activities]) {
    if (G.s.day < act.end) continue;
    G.s.activities = G.s.activities.filter(x => x !== act);
    const c = ch(act.owner); if (!c || c.dead) continue;
    const def = ACT_EVENTS[act.type](c);
    if (isPlayer(c)) { G.s.eventQueue.push({ custom: true, title: def.title, scene: def.scene, desc: def.desc, opts: def.opts.map(o => ({ ...o, fxR: o.dyn ? o.dyn(c, {}) : o.fx })), x: {}, charId: c.id }); emit('event'); }
    else { const o = def.opts.find(o => !o.req || o.req(c)); if (o) applyFx(c, o.dyn ? o.dyn(c, {}) : o.fx, {}); }
  }
}
export function holdCourt(c) {
  if (c.lastCourt && G.s.day - c.lastCourt < 365) return false;
  c.lastCourt = G.s.day;
  const list = PETITIONS.map(f => f(c)).filter(Boolean);
  for (const p of list.slice(0, 3).sort(() => rand() - 0.5).slice(0, 2)) G.s.eventQueue.push({ custom: true, title: p.title, scene: p.scene, desc: p.desc, opts: p.opts.map(o => ({ ...o, fxR: o.fx })), x: serializeCtx(p.x), charId: c.id });
  emit('event'); return true;
}
export function hireMercs(c, size) {
  const big = size === 'company';
  const cap = c.capital ?? domainOf(c.id)[0]; if (cap === undefined || cap === null) return;
  const cm = pick(['heavy_infantry', 'archers', 'light_cavalry', 'pikemen', 'crossbowmen']);
  const army = { id: G.s.nextId++, owner: c.id, men: big ? 1500 : 600, maa: { [cm]: big ? 500 : 200 }, loc: cap, path: [], prog: 0, cmdr: c.id, ready: G.s.day + 3, raid: false, loot: 0, siege: 0, merc: G.s.nextId++, start: 2000 };
  c.mercs = c.mercs || []; c.mercs.push({ id: army.merc, name: pick(['The White Company', 'The Grand Company', 'The Catalan Company', 'The Varangian Exiles', 'The Black Band', 'The Company of the Star', 'The Brabançons']), upkeep: big ? 3 : 1.5, until: G.s.day + (big ? 365 * 3 : 365) });
  G.s.armies.push(army);
}
export function stressBreak(c) {
  if (!isPlayer(c)) { const t = pick(['drunkard', 'reclusive', 'irritable', 'flagellant', 'comfort_eater']); addTrait(c, t); c.stress = 50; return; }
  G.s.eventQueue.push({ custom: true, title: 'Mental Break', scene: 'night', desc: `The pressure has become unbearable. Your hands shake; you cannot eat or sleep. Something must give.`, opts: [
    { t: 'Drown it in wine.', fxR: [['trait', 'self', 'drunkard'], ['stress', -60]] },
    { t: 'Lock myself away.', fxR: [['trait', 'self', 'reclusive'], ['stress', -60]] },
    { t: 'Lash out at everyone.', fxR: [['trait', 'self', 'irritable'], ['stress', -60]] },
    { t: 'Punish my flesh for my sins.', fxR: [['trait', 'self', 'flagellant'], ['stress', -60]] },
    { t: 'Eat until the pain stops.', fxR: [['trait', 'self', 'comfort_eater'], ['stress', -60]] } ], x: {}, charId: c.id });
  emit('event');
}
