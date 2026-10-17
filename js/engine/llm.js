// "Sovereign Minds": rulers driven by real language models through OpenRouter.
import { G, emit, markDirty } from '../state.js';
import { TRAITS, BUILDINGS, MAA, LIFESTYLES, ACTIVITIES } from '../data/traits.js';
import { ch, T, idx, age, rankOf, primary, displayName, fullName, titleName, faith, culture, stat, STATS, STAT_NAMES, opinion, domainOf, vassalsOf, realmProvs, topOf, isPlayer, log, notify, addTrait, removeTrait, dynName, kidsOf, isAdult, relationTo, isRuler, courtiersOf, liegeOf } from './core.js';
import { availableCBs, declareWar, warsOf, sideOf, realmStrength, adjacentRealms, alliesOf, endWar, peaceAcceptance, raiseArmy, disbandArmy, canAfford, allied, atWar } from './war.js';
import { recruitMaa, availableMaa, startBuilding, buildCost, income } from './economy.js';
import { allianceAcceptance, makeAlliance, startScheme, sendGift, vassalizeAcceptance } from './intrigue.js';
import { marriageAcceptance } from './life.js';
import { marry } from './core.js';
import { startActivity, canStartActivity } from './events.js';
import { fmtDate, fmtNum, clamp, pick } from '../util.js';

const API = 'https://openrouter.ai/api/v1';
export const LLM = { queue: [], active: 0, fails: 0, models: [], lastError: '', calls: 0, tokens: 0 };

export function isConfigured() { const l = G.settings?.llm; return !!(l && l.apiKey && l.model); }
export function isLLMActive() { return isConfigured() && LLM.fails < 6; }

export async function fetchModels() {
  try {
    const r = await fetch(`${API}/models`);
    const j = await r.json();
    LLM.models = (j.data || []).map(m => ({ id: m.id, name: m.name, ctx: m.context_length, price: m.pricing ? (+m.pricing.prompt * 1e6).toFixed(2) + '/' + (+m.pricing.completion * 1e6).toFixed(2) : '?', free: m.id.endsWith(':free') || (+m.pricing?.prompt === 0) })).sort((a, b) => a.name.localeCompare(b.name));
    return LLM.models;
  } catch (e) { LLM.lastError = 'Could not fetch model list: ' + e.message; return []; }
}

export async function chat(messages, opts = {}) {
  const l = G.settings.llm;
  const body = { model: opts.model || l.model, messages, temperature: opts.temperature ?? l.temperature ?? 0.8, max_tokens: opts.max_tokens || 900 };
  const r = await fetch(`${API}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${l.apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': location.origin, 'X-Title': 'Regnum: Chronicles of Crowns' },
    body: JSON.stringify(body),
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`OpenRouter ${r.status}: ${t.slice(0, 200)}`); }
  const j = await r.json();
  LLM.calls++; LLM.tokens += j.usage?.total_tokens || 0;
  const content = j.choices?.[0]?.message?.content || '';
  return content;
}
export function parseJSON(text) {
  if (!text) return null;
  let t = text.replace(/```json|```/g, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < 0) return null;
  t = t.slice(a, b + 1);
  try { return JSON.parse(t); } catch (e) {
    try { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"')); } catch (e2) { return null; }
  }
}

// ---------- Designation ----------
export function setSovereignMind(c, on) {
  const L = G.s.llm;
  if (on) { if (!L.rulers.includes(c.id)) L.rulers.push(c.id); c.llm = true; addTrait(c, 'ai_mind'); c.nextThink = G.s.day + Math.floor(Math.random() * 60); }
  else { L.rulers = L.rulers.filter(x => x !== c.id); c.llm = false; removeTrait(c, 'ai_mind'); }
  markDirty();
}

// ---------- Prompt building ----------
function traitText(c) { return c.traits.map(t => TRAITS[t]).filter(Boolean).filter(t => t.id !== 'ai_mind').map(t => `${t.name}${t.desc && t.cat === 'personality' ? ` (${t.desc.replace(/\.$/, '')})` : ''}`).join(', '); }
function charLine(c, me) {
  if (!c) return '';
  const rel = me ? relationTo(me, c) : '';
  return `#${c.id} ${displayName(c)}${dynName(c) ? ' (' + dynName(c) + ')' : ''}, age ${age(c)}${rel ? ', your ' + rel.toLowerCase() : ''}`;
}
function warLine(w, me) {
  const side = sideOf(w, me.id); const enemy = ch(side === 'att' ? w.defLeader : w.attLeader);
  const ws = side === 'att' ? w.ws : -w.ws;
  return `[war #${w.id}] "${w.name}" — you are ${side === 'att' ? 'ATTACKER' : 'DEFENDER'} against ${charLine(enemy, me)} (strength ${fmtNum(realmStrength(enemy.id))}). Warscore in your favor: ${ws}%. Lasting ${Math.round((G.s.day - w.start) / 30)} months.`;
}
export function situation(c) {
  const inc = c.lastIncome || income(c);
  const lines = [];
  lines.push(`DATE: ${fmtDate(G.s.day)}`);
  lines.push(`YOU ARE: #${c.id} ${fullName(c)} of the house of ${dynName(c) || 'no great house'}, age ${age(c)}, ${culture(c.cul).name} culture, faith ${faith(c.fai).name}.`);
  lines.push(`Personality & traits: ${traitText(c)}.`);
  lines.push(`Skills: ${STATS.map(s => `${STAT_NAMES[s]} ${stat(c, s)}`).join(', ')}, Prowess ${stat(c, 'pro')}. Stress ${Math.round(c.stress)}/100.`);
  lines.push(`Treasury ${Math.round(c.gold)} gold (${inc.net >= 0 ? '+' : ''}${inc.net.toFixed(1)}/month). Prestige ${Math.round(c.prestige)}. Piety ${Math.round(c.piety)}.`);
  lines.push(`Realm: ${realmProvs(c.id).length} counties, ${domainOf(c.id).length} in your personal domain. Military potential ${fmtNum(realmStrength(c.id))} (levies ${fmtNum(c.levyCur || 0)} ready).`);
  if (c.liege) lines.push(`Your liege: ${charLine(ch(c.liege), c)} — your opinion of them ${opinion(c, ch(c.liege))}, theirs of you ${opinion(ch(c.liege), c)}.`);
  const vs = vassalsOf(c.id).map(ch).filter(Boolean).sort((a, b) => rankOf(b) - rankOf(a)).slice(0, 6);
  if (vs.length) lines.push(`Main vassals: ${vs.map(v => `${charLine(v, c)} [opinion of you ${opinion(v, c)}]`).join('; ')}.`);
  const fam = [ch(c.spouse), ...kidsOf(c).filter(k => !k.dead)].filter(Boolean);
  if (fam.length) lines.push(`Family: ${fam.map(f => charLine(f, c) + (f.spouse ? ' (married)' : isAdult(f) ? ' (unmarried)' : '')).join('; ')}.`);
  const wars = warsOf(c.id);
  lines.push(wars.length ? `WARS:\n${wars.map(w => '- ' + warLine(w, c)).join('\n')}` : 'You are at peace.');
  const al = alliesOf(c.id).map(ch).filter(Boolean);
  if (al.length) lines.push(`Allies: ${al.map(a => charLine(a, c)).join('; ')}.`);
  const neigh = adjacentRealms(c.id).map(ch).filter(Boolean).sort((a, b) => realmStrength(b.id) - realmStrength(a.id)).slice(0, 8);
  lines.push('NEIGHBORING RULERS:');
  for (const n of neigh) {
    const cbs = c.liege ? [] : availableCBs(c, n).slice(0, 4);
    lines.push(`- ${charLine(n, c)} — ${faith(n.fai).name}, ${culture(n.cul).name}; strength ${fmtNum(realmStrength(n.id))}; their opinion of you ${opinion(n, c)}, yours of them ${opinion(c, n)}${allied(c.id, n.id) ? '; ALLIED' : ''}${n.id === G.s.player ? '; (this ruler is controlled by a human player)' : ''}${n.llm ? '; (another sovereign mind)' : ''}${cbs.length ? `; casus belli available: ${cbs.map(x => `{"cb":"${x.cb}","title":"${x.target}"} ${x.label} (cost ${Object.entries(x.cost).map(([k, v]) => v + ' ' + k).join(', ') || 'free'})`).join(' | ')}` : ''}`);
  }
  const letters = G.s.letters.filter(l => (l.to === c.id || l.from === c.id) && G.s.day - l.day < 365 * 2).slice(-6);
  if (letters.length) lines.push('RECENT CORRESPONDENCE:\n' + letters.map(l => `- ${fmtDate(l.day)} ${l.from === c.id ? 'You wrote to ' + displayName(ch(l.to)) : displayName(ch(l.from)) + ' wrote to you'}: "${(l.text || '').slice(0, 300)}"${l.proposal ? ` [proposal: ${l.proposal.kind}, status ${l.status || 'pending'}]` : ''}`).join('\n'));
  const diary = (G.s.llm.diaries[c.id] || []).slice(-5);
  if (diary.length) lines.push('YOUR RECENT DIARY:\n' + diary.map(d => `- ${fmtDate(d.day)}: ${d.diary}`).join('\n'));
  const recent = G.s.log.filter(e => e.ids?.includes(c.id) && G.s.day - e.day < 365).slice(-6);
  if (recent.length) lines.push('RECENT EVENTS:\n' + recent.map(e => `- ${fmtDate(e.day)}: ${e.text}`).join('\n'));
  lines.push(`Buildable in your domain: ${Object.keys(BUILDINGS).join(', ')}. Men-at-arms you can recruit: ${availableMaa(c).map(t => `${t} (${MAA[t].cost}g)`).join(', ')}.`);
  return lines.join('\n');
}
const ACTION_SPEC = `AVAILABLE ACTIONS (choose 0 to 3, only what fits your character and situation):
{"type":"declare_war","target":<ruler id>,"cb":"<cb from the list>","title":"<title id from the list>"}
{"type":"offer_peace","war":<war id>,"terms":"white"|"surrender"|"demand"}   (demand = you demand the enemy surrenders)
{"type":"propose_alliance","target":<ruler id>}
{"type":"propose_marriage","mine":<your unmarried family member id>,"theirs":<their unmarried family member id>}
{"type":"send_letter","to":<ruler id>,"text":"<in-character letter, under 90 words>"}
{"type":"gift","to":<ruler id>,"amount":<gold>}
{"type":"scheme","kind":"murder"|"seduce"|"befriend"|"sway","target":<character id>}
{"type":"build","building":"<building id>"}
{"type":"recruit","unit":"<men-at-arms id>","regiments":<1-3>}
{"type":"raise_armies"} | {"type":"disband_armies"}
{"type":"activity","kind":"feast"|"hunt"|"tournament"|"pilgrimage"}
{"type":"focus","lifestyle":"diplomacy"|"martial"|"stewardship"|"intrigue"|"learning"}`;

function systemPrompt(c) {
  return `You are the living mind of ${fullName(c)}, a ruler in a medieval grand strategy simulation (in the style of Crusader Kings). You are not an assistant; you ARE this person. Think and act with their personality, ambitions, fears, faith and era-appropriate worldview. You can be cunning, pious, cruel, generous, cautious or reckless as your traits suggest. Wars are costly and risky: only declare war when you are clearly stronger or driven by your nature. Respect the game's mechanics: only use IDs given to you.
Respond ONLY with one JSON object, no prose outside it:
{"thoughts":"<2-3 sentences of private strategic reasoning, in character>","diary":"<one vivid first-person diary sentence about your current state of mind>","actions":[ ... ]}`;
}

// ---------- Thinking ----------
export function monthlyLLM() {
  if (!isLLMActive()) return;
  const L = G.s.llm; const every = (G.settings.llm.interval || 6) * 30;
  for (const id of [...L.rulers]) {
    const c = ch(id); if (!c || c.dead) { L.rulers = L.rulers.filter(x => x !== id); continue; }
    if (!isRuler(c)) continue;
    if (G.s.day < (c.nextThink || 0)) continue;
    if (LLM.queue.some(q => q.id === id)) continue;
    c.nextThink = G.s.day + every;
    enqueue({ id, kind: 'think', run: () => think(c) });
  }
  pump();
}
function enqueue(job) { if (LLM.queue.length > 20) LLM.queue.shift(); LLM.queue.push(job); }
async function pump() {
  const max = G.settings.llm.maxConcurrent || 2;
  while (LLM.active < max && LLM.queue.length) {
    const job = LLM.queue.shift(); LLM.active++; emit('llmStatus');
    job.run().catch(e => { LLM.fails++; LLM.lastError = e.message; console.warn(e); if (LLM.fails === 6) notify('Sovereign Minds disabled after repeated API errors: ' + e.message, { type: 'bad', icon: '🧿' }); })
      .finally(() => { LLM.active--; emit('llmStatus'); pump(); });
  }
}
async function think(c) {
  if (!G.s || c.dead) return;
  const msgs = [{ role: 'system', content: systemPrompt(c) }, { role: 'user', content: situation(c) + '\n\n' + ACTION_SPEC }];
  const text = await chat(msgs);
  const j = parseJSON(text);
  if (!j) throw new Error('Unparseable response from model');
  LLM.fails = 0;
  const done = [];
  for (const a of (j.actions || []).slice(0, 3)) { try { const r = act(c, a); if (r) done.push(r); } catch (e) { console.warn('LLM action failed', a, e); } }
  const entry = { day: G.s.day, thoughts: String(j.thoughts || '').slice(0, 600), diary: String(j.diary || '').slice(0, 300), actions: done };
  (G.s.llm.diaries[c.id] ||= []).push(entry);
  if (G.s.llm.diaries[c.id].length > 30) G.s.llm.diaries[c.id].shift();
  emit('llmThought', { c, entry });
}

function act(c, a) {
  const tgt = ch(+a.target || +a.to);
  switch (a.type) {
    case 'declare_war': {
      if (!tgt || c.liege) return null;
      const cbs = availableCBs(c, tgt);
      const cb = cbs.find(x => x.cb === a.cb && (!a.title || x.target === a.title)) || cbs.find(x => x.cb === a.cb);
      if (!cb || !canAfford(c, cb.cost)) return null;
      const w = declareWar(c, tgt, cb); return w ? `Declared war: ${w.name}` : null;
    }
    case 'offer_peace': {
      const w = G.s.wars.find(x => x.id === +a.war); if (!w) return null;
      const side = sideOf(w, c.id); if (!side) return null;
      const leader = side === 'att' ? w.attLeader : w.defLeader; if (leader !== c.id) return null;
      const enemy = ch(side === 'att' ? w.defLeader : w.attLeader);
      const terms = a.terms === 'surrender' ? 'surrender' : a.terms === 'demand' ? 'demand' : 'white';
      if (enemy.id === G.s.player) { sendLetter(c, enemy, a.text || defaultPeaceText(terms), { kind: 'peace', war: w.id, terms }); return `Offered ${terms} peace to ${enemy.name}`; }
      if (terms === 'surrender') { endWar(w, side === 'att' ? 'def' : 'att', 'Surrendered'); return 'Surrendered'; }
      if (peaceAcceptance(w, c.id, terms) >= 0 || enemy.llm) { endWar(w, terms === 'white' ? 'white' : side, 'Negotiated'); return `Made peace (${terms})`; }
      return null;
    }
    case 'propose_alliance': {
      if (!tgt || allied(c.id, tgt.id)) return null;
      if (tgt.id === G.s.player) { sendLetter(c, tgt, a.text || 'Let our houses stand together against our enemies. I propose an alliance.', { kind: 'alliance' }); return `Proposed alliance to ${tgt.name}`; }
      if (allianceAcceptance(c, tgt) > 0) { makeAlliance(c, tgt); return `Allied with ${tgt.name}`; }
      return null;
    }
    case 'propose_marriage': {
      const mine = ch(+a.mine), theirs = ch(+a.theirs); if (!mine || !theirs || mine.spouse || theirs.spouse || mine.f === theirs.f) return null;
      const host = isRuler(theirs) ? theirs : ch(theirs.court);
      if (host && host.id === G.s.player) { sendLetter(c, host, a.text || `I propose a marriage between my ${relationTo(c, mine).toLowerCase() || 'kin'} ${mine.name} and your ${relationTo(host, theirs).toLowerCase() || 'kin'} ${theirs.name}.`, { kind: 'marriage', mine: mine.id, theirs: theirs.id }); return 'Proposed marriage'; }
      if (marriageAcceptance(c, mine, theirs) >= 0) { marry(mine, theirs); log(`${mine.name} and ${theirs.name} were wed.`, { type: 'marriage', ids: [mine.id, theirs.id], icon: '💍' }); return `Married ${mine.name} to ${theirs.name}`; }
      return null;
    }
    case 'send_letter': { if (!tgt || !a.text) return null; sendLetter(c, tgt, String(a.text).slice(0, 900)); return `Wrote to ${tgt.name}`; }
    case 'gift': { const amt = clamp(+a.amount || 0, 5, Math.max(5, c.gold)); if (!tgt || c.gold < amt) return null; sendGift(c, tgt, amt); return `Gifted ${amt} gold to ${tgt.name}`; }
    case 'scheme': { const t = ch(+a.target); if (!t) return null; const s = startScheme(c, t, a.kind); return s ? `Began scheme (${a.kind}) against ${t.name}` : null; }
    case 'build': { const b = a.building; if (!BUILDINGS[b]) return null; const pid = domainOf(c.id).find(p => (G.s.provs[p].b?.[b] || 0) < 3 && !G.s.provs[p].build); if (pid === undefined) return null; return startBuilding(c, pid, b) ? `Building ${BUILDINGS[b].name}` : null; }
    case 'recruit': { const n = clamp(+a.regiments || 1, 1, 3); if (!MAA[a.unit]) return null; let k = 0; for (let i = 0; i < n; i++) if (recruitMaa(c, a.unit, 1)) k++; return k ? `Recruited ${k} ${MAA[a.unit].name}` : null; }
    case 'raise_armies': return raiseArmy(c) ? 'Raised armies' : null;
    case 'disband_armies': { const arms = G.s.armies.filter(x => x.owner === c.id && !x.battle); arms.forEach(disbandArmy); return arms.length ? 'Disbanded armies' : null; }
    case 'activity': return canStartActivity(c, a.kind) && startActivity(c, a.kind) ? `Began ${ACTIVITIES[a.kind].name}` : null;
    case 'focus': if (LIFESTYLES[a.lifestyle]) { c.focus = a.lifestyle; return `Focus: ${a.lifestyle}`; } return null;
  }
  return null;
}
function defaultPeaceText(terms) { return terms === 'white' ? 'Enough blood has been spilled. Let us return to how things were.' : terms === 'surrender' ? 'You have won. I yield.' : 'Your cause is lost. Yield to me and I shall be merciful.'; }

// ---------- Letters ----------
export function sendLetter(from, to, text, proposal = null) {
  const l = { id: G.s.nextId++, from: from.id, to: to.id, text, day: G.s.day, read: false, proposal, status: proposal ? 'pending' : null };
  G.s.letters.push(l);
  if (G.s.letters.length > 400) G.s.letters.splice(0, 50);
  if (to.id === G.s.player) { notify(`A letter has arrived from ${displayName(from)}.`, { type: 'letter', icon: '✉', action: 'letters', from: from.id, sound: 'letter' }); emit('letter', l); }
  return l;
}
// Player writes to a ruler; any ruler can reply via the LLM if configured.
export async function playerWrites(to, text, proposal = null) {
  const me = ch(G.s.player);
  const l = sendLetter(me, to, text, proposal);
  if (!isLLMActive()) { cannedReply(to, me, l); return; }
  l.awaiting = true; emit('letter', l);
  try {
    const sys = systemPrompt(to) + `\nYou are now replying to a letter from another ruler. If it contains a proposal, decide whether to accept it — consider your interests, your opinion of them, and your personality.`;
    const user = `${situation(to)}\n\nLETTER FROM ${charLine(me, to)}:\n"${text}"\n${proposal ? `\nIt contains a formal PROPOSAL: ${describeProposal(proposal, me, to)}. Mechanical acceptance score (positive = favorable to you by the numbers): ${proposalScore(proposal, me, to)}.\n` : ''}\nRespond ONLY with JSON: {"accept": ${proposal ? 'true|false' : 'null'}, "reply":"<your in-character reply letter, under 120 words>", "diary":"<one sentence>"}`;
    const j = parseJSON(await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { max_tokens: 600 }));
    if (!j) throw new Error('bad reply');
    l.awaiting = false;
    if (proposal) { l.status = j.accept ? 'accepted' : 'declined'; if (j.accept) applyProposal(proposal, me, to); }
    sendLetter(to, me, String(j.reply || '...').slice(0, 1200));
    if (j.diary) (G.s.llm.diaries[to.id] ||= []).push({ day: G.s.day, diary: j.diary, thoughts: '', actions: [proposal ? `${l.status} ${proposal.kind}` : 'Replied to a letter'] });
  } catch (e) { l.awaiting = false; LLM.lastError = e.message; cannedReply(to, me, l); }
}
function describeProposal(p, from, to) {
  if (p.kind === 'alliance') return 'a defensive and offensive alliance between your realms';
  if (p.kind === 'marriage') return `marriage between their ${ch(p.mine)?.name} and your ${ch(p.theirs)?.name}`;
  if (p.kind === 'peace') return `peace (${p.terms}) in war #${p.war}`;
  if (p.kind === 'vassalize') return 'that you become their vassal';
  return p.kind;
}
function proposalScore(p, from, to) {
  if (p.kind === 'alliance') return allianceAcceptance(from, to);
  if (p.kind === 'marriage') return marriageAcceptance(from, ch(p.mine), ch(p.theirs));
  if (p.kind === 'peace') { const w = G.s.wars.find(x => x.id === p.war); return w ? peaceAcceptance(w, from.id, p.terms) : -100; }
  if (p.kind === 'vassalize') return vassalizeAcceptance(from, to);
  return 0;
}
export function applyProposal(p, from, to) {
  if (p.kind === 'alliance') makeAlliance(from, to);
  else if (p.kind === 'marriage') { const a = ch(p.mine), b = ch(p.theirs); if (a && b && !a.spouse && !b.spouse) { marry(a, b); log(`${a.name} and ${b.name} were wed.`, { type: 'marriage', ids: [a.id, b.id], icon: '💍' }); } }
  else if (p.kind === 'peace') { const w = G.s.wars.find(x => x.id === p.war); if (w) { const side = sideOf(w, from.id); endWar(w, p.terms === 'white' ? 'white' : p.terms === 'surrender' ? (side === 'att' ? 'def' : 'att') : side, 'Negotiated peace'); } }
  else if (p.kind === 'vassalize') { to.liege = from.id; markDirty(); log(`${displayName(to)} has sworn fealty to ${displayName(from)}.`, { type: 'diplomacy', ids: [from.id, to.id], icon: '🤝' }); }
}
function cannedReply(to, me, l) {
  const p = l.proposal;
  let accept = null;
  if (p) { accept = proposalScore(p, me, to) >= 0; l.status = accept ? 'accepted' : 'declined'; if (accept) applyProposal(p, me, to); }
  const op = opinion(to, me);
  const tone = op > 40 ? ['My dear friend', 'It warms my heart to hear from you.'] : op > 0 ? ['Greetings', 'Your letter was received.'] : op > -40 ? ['To you', 'I have read your words.'] : ['You', 'Your insolence is noted.'];
  const body = p ? (accept ? `I accept your proposal. Let it be done.` : `I must decline. The time is not right — nor, perhaps, the offer.`) : pick(['May God keep you and your house.', 'We shall see what the seasons bring.', 'I will consider your words carefully.', 'Do not mistake courtesy for weakness.']);
  setTimeout(() => sendLetter(to, me, `${tone[0]}, ${tone[1]} ${body}\n— ${displayName(to)}`), 400);
}

// ---------- AI Chronicler ----------
export async function chronicleYear(year) {
  if (!isLLMActive() || !G.settings.llm.chronicler) return;
  const me = ch(G.s.player); if (!me) return;
  const events = G.s.log.filter(e => Math.floor(e.day / 365) === year).slice(-40).map(e => e.text);
  if (!events.length) return;
  try {
    const text = await chat([{ role: 'system', content: 'You are a medieval monastic chronicler writing an illuminated chronicle of a royal house. Write in a vivid, slightly archaic, literary style. Be concise.' },
      { role: 'user', content: `Write the chronicle entry (one paragraph, 90-140 words) for the year ${year} AD concerning ${fullName(me)} and their realm, based on these recorded events:\n${events.map(e => '- ' + e).join('\n')}` }], { max_tokens: 400, temperature: 0.9 });
    (G.s.chronicle ||= []).push({ year, text: text.trim(), author: 'chronicler' });
    notify(`The chronicler has completed the entry for ${year}.`, { type: 'info', icon: '📜', action: 'chronicle' });
  } catch (e) { LLM.lastError = e.message; }
}
