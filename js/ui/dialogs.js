// Dialogs and modal flows.
import { G, on, emit, saveSettings, markDirty } from '../state.js';
import { TRAITS, COUNCIL, MAA } from '../data/traits.js';
import { ch, T, idx, age, isAdult, rankOf, primary, displayName, fullName, titleName, faith, culture, stat, STATS, STAT_NAMES, STAT_ICONS, opinion, domainOf, realmProvs, vassalsOf, courtiersOf, isRuler, kidsOf, siblings, topOf, relationTo, isKin, liegeOf, isLanded, dynName } from '../engine/core.js';
import { availableCBs, declareWar, canAfford, realmStrength, atWar, allied, alliesOf, joinWar, disbandArmy, splitArmy, mergeArmies, moveArmy, canRaid, armyPower, adjacentRealms, bordersProv, sideOf } from '../engine/war.js';
import { SCHEMES, startScheme, canScheme, schemeOdds, giftAmount, sendGift, allianceAcceptance, makeAlliance, vassalizeAcceptance, imprison, release, execute, revokeTitle, grantTitle, inviteAcceptance, councillor } from '../engine/intrigue.js';
import { marriageAcceptance, CAUSES } from '../engine/life.js';
import { marry, log, addOpinion } from '../engine/core.js';
import { resolvePlayerEvent, describeFx, deserializeCtx } from '../engine/events.js';
import { LLM, fetchModels, chat, isConfigured, isLLMActive, playerWrites, setSovereignMind } from '../engine/llm.js';
import { saveGame, listSaves, loadSave, deleteSave, exportFile, restore } from '../engine/save.js';
import { portrait, scene } from '../render/art.js';
import { STYLES, recolor, focusProv, renderer } from '../render/map.js';
import { ACT, modal, closeModal, modalOpen, confirmBox, ptr, charLink, titleLink, opTag, toast, sound, pc, openWindow, renderWindow, renderHUD, closeWindow, fanfare } from './ui.js';
import { esc, fmtNum, fmtDate, clamp, sign } from '../util.js';

// ---------- Interactions ----------
export function interactions(me, c) {
  const out = [];
  const ruler = isRuler(c); const meInd = !me.liege; const myTop = topOf(me.id);
  const same = topOf(c.id) === myTop;
  const cbs = ruler && !same || c.id === me.liege ? availableCBs(me, c) : [];
  if (ruler && (!same || c.id === me.liege)) out.push({ id: 'war', icon: '⚔', label: 'Declare War', ok: cbs.length > 0, tip: cbs.length ? `${cbs.length} casus belli available` : 'No valid casus belli (claims, de jure, faith, or truce)' });
  if (ruler && !c.liege && meInd && !allied(me.id, c.id)) out.push({ id: 'alliance', icon: '🤝', label: 'Propose Alliance', ok: true, tip: c.llm && isLLMActive() ? 'This Sovereign Mind will consider your letter.' : `Acceptance: ${allianceAcceptance(me, c)}` });
  if (allied(me.id, c.id)) out.push({ id: 'breakAlliance', icon: '💔', label: 'Break Alliance', ok: true, tip: '-100 prestige' });
  out.push({ id: 'marriage', icon: '💍', label: 'Arrange Marriage', ok: true, tip: 'Marry a member of your family into theirs' });
  out.push({ id: 'letter', icon: '✉', label: 'Write Letter', ok: true, tip: isLLMActive() ? 'They will reply in their own words.' : 'Send a letter (configure OpenRouter for real replies)' });
  out.push({ id: 'gift', icon: '🎁', label: `Send Gift (${giftAmount(me)})`, ok: me.gold >= giftAmount(me), tip: 'Improve their opinion of you' });
  for (const s of ['befriend', 'sway', 'seduce', 'murder']) out.push({ id: 'scheme_' + s, icon: SCHEMES[s].icon, label: SCHEMES[s].name, ok: canScheme(me, c, s), tip: SCHEMES[s].desc });
  if (ruler && !same && rankOf(me) >= 1 && me.councilMembers?.chancellor) out.push({ id: 'fabricate', icon: '📜', label: 'Fabricate Claim', ok: true, tip: 'Set your chancellor to forge a claim on one of their titles' });
  if (!ruler && c.court !== me.id && !c.imprisoned) out.push({ id: 'invite', icon: '🚪', label: 'Invite to Court', ok: inviteAcceptance(me, c) > 0, tip: `Acceptance: ${inviteAcceptance(me, c)}` });
  if ((c.court === me.id || c.liege === me.id) && isAdult(c) && !c.imprisoned && domainOf(me.id).length > 1) out.push({ id: 'grant', icon: '🏰', label: 'Grant Title', ok: true, tip: 'Grant them one of your counties' });
  if (c.liege === me.id) out.push({ id: 'revoke', icon: '✂', label: 'Revoke Title', ok: true, tip: 'Tyrannical unless you hold a strong hook or they rebelled' });
  if ((c.court === me.id || c.liege === me.id) && !c.imprisoned) out.push({ id: 'imprison', icon: '⛓', label: 'Imprison', ok: true, tip: 'Tyrannical without a crime' });
  if (c.imprisoned === me.id) { out.push({ id: 'release', icon: '🕊', label: 'Release', ok: true }); out.push({ id: 'execute', icon: '🪓', label: 'Execute', ok: true, tip: 'Grants dread. Tyrannical unless guilty.' }); }
  if (ruler && !c.liege && meInd && rankOf(c) < rankOf(me)) out.push({ id: 'vassalize', icon: '🙇', label: 'Offer Vassalization', ok: true, tip: c.llm && isLLMActive() ? 'This Sovereign Mind will consider it.' : `Acceptance: ${vassalizeAcceptance(me, c)}` });
  if ((c.father === me.id || c.mother === me.id) && age(c) < 16) out.push({ id: 'educate', icon: '📚', label: 'Choose Education', ok: true, tip: 'Pick the focus of their education' });
  if (ruler) out.push({ id: 'mind', icon: '🧿', label: c.llm ? 'Revoke Mind' : 'Grant Sovereign Mind', ok: true, tip: 'Let a real AI model rule this character' });
  if (c.capital !== null && c.capital !== undefined) out.push({ id: 'goto', icon: '🗺', label: 'Show on Map', ok: true });
  return out;
}
ACT.interact = (kind, id) => {
  const me = pc(), c = ch(+id); if (!c) return;
  if (kind.startsWith('scheme_')) { const s = startScheme(me, c, kind.slice(7)); if (s) toast({ text: `Scheme started: ${SCHEMES[s.type].name} ${c.name}. Odds ${schemeOdds(s)}%.`, icon: SCHEMES[s.type].icon }); renderWindow(); return; }
  switch (kind) {
    case 'war': return openWarDeclare(c);
    case 'alliance': if (c.llm && isLLMActive()) return openLetterComposer(c, { kind: 'alliance' }); if (allianceAcceptance(me, c) > 0) { makeAlliance(me, c); toast({ text: `${c.name} has accepted your alliance!`, type: 'good', icon: '🤝' }); } else toast({ text: `${c.name} declines your alliance.`, type: 'bad', icon: '🤝' }); return renderWindow();
    case 'breakAlliance': return confirmBox('Break Alliance', `Break your alliance with ${esc(displayName(c))}? You will lose 100 prestige.`, () => { import('../engine/intrigue.js').then(m => { m.breakAlliance(me, c); renderWindow(); }); });
    case 'marriage': return openMarriage(c);
    case 'letter': return openLetterComposer(c);
    case 'gift': sendGift(me, c); toast({ text: `${c.name} gratefully receives your gift.`, type: 'good', icon: '🎁' }); renderHUD(); return renderWindow();
    case 'fabricate': { me.councilTasks = me.councilTasks || {}; me.councilTasks.chancellor = 'claim'; const tgt = c.capital !== null && c.capital !== undefined ? G.world.provinces[c.capital].key : c.primary; me.fabPick = tgt; me.fab = { target: tgt, prog: 0 }; toast({ text: `Your chancellor begins forging documents for ${T(tgt).name}.`, icon: '📜' }); return; }
    case 'invite': c.court = me.id; addOpinion(c, me, 10, 'Invited to court', 60); markDirty(); toast({ text: `${c.name} joins your court.`, type: 'good', icon: '🚪' }); return renderWindow();
    case 'grant': return openGrantPicker(null, c);
    case 'revoke': return pickFrom(`Revoke a title from ${esc(c.name)}`, c.titles.map(T).map(t => ({ id: t.id, html: `${titleLink(t.id)}` })), tid => { revokeTitle(me, c, tid); renderWindow(); });
    case 'imprison': return confirmBox('Imprison', `Throw ${esc(displayName(c))} into your dungeon?`, () => { imprison(me, c); renderWindow(); });
    case 'release': release(me, c); return renderWindow();
    case 'execute': return confirmBox('Execute', `Execute ${esc(displayName(c))}? This cannot be undone.`, () => { execute(me, c); renderWindow(); }, 'Execute');
    case 'vassalize': if (c.llm && isLLMActive()) return openLetterComposer(c, { kind: 'vassalize' }); if (vassalizeAcceptance(me, c) > 0) { c.liege = me.id; markDirty(); fanfare(`${c.name} bends the knee`); } else toast({ text: `${c.name} refuses to become your vassal.`, type: 'bad', icon: '🙇' }); return renderWindow();
    case 'educate': return pickFrom(`Education of ${esc(c.name)}`, STATS.map(s => ({ id: s, html: `${STAT_ICONS[s]} ${STAT_NAMES[s]} <span class="muted small">(aptitude ${c.base[s]})</span>` })), s => { c.eduFocus = s; toast({ text: `${c.name} will be educated in ${STAT_NAMES[s]}.`, icon: '📚' }); });
    case 'mind': return ACT.toggleMind(c.id);
    case 'goto': return focusProv(c.capital, 2);
  }
};
export function pickFrom(title, items, onPick, opts = {}) {
  const m = modal(`<div class="dh"><h2>${title}</h2><button class="btn small" data-act="mClose">✕</button></div><div class="db"><div class="col" style="max-height:60vh;overflow-y:auto">${items.map((it, i) => `<div class="choice ${it.dis ? 'dis' : ''}" data-i="${i}">${it.html}</div>`).join('') || '<div class="muted">Nothing to choose from.</div>'}</div></div>`, { width: opts.width || 480 });
  m.querySelectorAll('.choice').forEach(el => el.onclick = () => { const it = items[+el.dataset.i]; if (it.dis) return; closeModal(m); onPick(it.id); });
}

// ---------- War declaration ----------
export function openWarDeclare(c) {
  const me = pc(); const cbs = availableCBs(me, c);
  const mine = realmStrength(me.id) + alliesOf(me.id).reduce((s, a) => s + realmStrength(a) * 0.5, 0);
  const target = ch(topOf(c.id));
  const theirs = realmStrength(target.id) + alliesOf(target.id).reduce((s, a) => s + realmStrength(a) * 0.5, 0);
  const m = modal(`<div class="dh"><h2>⚔ Declare War on ${esc(displayName(target))}</h2></div><div class="db"><div class="row between" style="margin-bottom:10px"><div class="col" style="align-items:center">${ptr(me, 56)}<b>${fmtNum(mine)}</b><span class="tiny muted">your strength (+allies)</span></div><span style="font-size:30px">⚔</span><div class="col" style="align-items:center">${ptr(target, 56)}<b>${fmtNum(theirs)}</b><span class="tiny muted">their strength (+allies)</span></div></div>
  <div class="col">${cbs.map((cb, i) => `<div class="choice ${canAfford(me, cb.cost) ? '' : 'dis'}" data-i="${i}"><div class="row between"><b>${cb.icon} ${esc(cb.label)}</b><span class="small">${Object.entries(cb.cost).map(([k, v]) => `${{ prestige: '👑', piety: '🙏', gold: '🪙' }[k]}${v}`).join(' ') || 'free'}</span></div><div class="tiny muted">${cb.desc}</div></div>`).join('')}</div>${alliesOf(target.id).length ? `<div class="small bad" style="margin-top:8px">Their allies may join: ${alliesOf(target.id).map(id => esc(ch(id).name)).join(', ')}</div>` : ''}</div><div class="df"><button class="btn" data-act="mClose">Cancel</button></div>`);
  m.querySelectorAll('.choice').forEach(el => el.onclick = () => { const cb = cbs[+el.dataset.i]; if (!canAfford(me, cb.cost)) return; closeModal(m); const w = declareWar(me, c, cb); if (w) { openWindow('war', w.id); renderHUD(); } });
}

// ---------- Marriage ----------
function eligibleSpouses(host, wantFemale) {
  const fam = [host, ...kidsOf(host), ...siblings(host), ...courtiersOf(host.id).map(ch).filter(x => x && x.dyn === host.dyn)];
  return [...new Set(fam)].filter(x => x && !x.dead && !x.spouse && isAdult(x) && (wantFemale === undefined || x.f === wantFemale) && !x.imprisoned && x.gov !== 'theocracy');
}
export function openMarriage(c) {
  const me = pc(); const theirHost = isRuler(c) ? c : ch(c.court) || c;
  const mine = eligibleSpouses(me); const theirs = isRuler(c) ? eligibleSpouses(theirHost) : (!c.spouse && isAdult(c) ? [c] : []);
  let selA = mine[0]?.id, selB = theirs.find(x => x.f !== mine[0]?.f)?.id;
  const render = () => {
    const a = ch(selA), b = ch(selB); const acc = a && b && a.f !== b.f ? marriageAcceptance(me, a, b) : null;
    return `<div class="dh"><h2>💍 Arrange a Marriage</h2></div><div class="db"><div class="grid2"><div><div class="small gold">Your family</div><div class="col" style="max-height:280px;overflow-y:auto">${mine.map(x => `<div class="choice ${x.id === selA ? 'sel' : ''}" data-a="${x.id}"><div class="row">${ptr(x, 30)}<div class="small">${esc(x.name)}<div class="tiny muted">${relationTo(me, x) || ''} · ${age(x)} · ${x.f ? '♀' : '♂'}</div></div></div></div>`).join('') || '<div class="muted small">No one eligible</div>'}</div></div><div><div class="small gold">${esc(displayName(theirHost))}'s family</div><div class="col" style="max-height:280px;overflow-y:auto">${theirs.map(x => `<div class="choice ${x.id === selB ? 'sel' : ''}" data-b="${x.id}"><div class="row">${ptr(x, 30)}<div class="small">${esc(x.name)}<div class="tiny muted">${relationTo(theirHost, x) || ''} · ${age(x)} · ${x.f ? '♀' : '♂'}</div></div></div></div>`).join('') || '<div class="muted small">No one eligible</div>'}</div></div></div>${acc !== null ? `<div class="small" style="margin-top:8px">Acceptance: <b class="${acc >= 0 ? 'good' : 'bad'}">${acc}</b>${theirHost.llm && isLLMActive() ? ' — this Sovereign Mind will decide by letter' : ''}</div>` : a && b ? '<div class="bad small">Must be a man and a woman.</div>' : ''}</div><div class="df"><button class="btn" data-act="mClose">Cancel</button><button class="btn primary" id="mrGo" ${a && b && a.f !== b.f && !isKin(a, b) ? '' : 'disabled'}>Propose</button></div>`;
  };
  const m = modal(render(), { width: 620 });
  const bind = () => {
    m.querySelectorAll('[data-a]').forEach(el => el.onclick = () => { selA = +el.dataset.a; m.firstChild.innerHTML = render(); bind(); });
    m.querySelectorAll('[data-b]').forEach(el => el.onclick = () => { selB = +el.dataset.b; m.firstChild.innerHTML = render(); bind(); });
    const go = m.querySelector('#mrGo'); if (go) go.onclick = () => {
      const a = ch(selA), b = ch(selB); closeModal(m);
      if (theirHost.llm && isLLMActive()) return openLetterComposer(theirHost, { kind: 'marriage', mine: a.id, theirs: b.id }, `I propose a union between my ${relationTo(me, a).toLowerCase() || 'kin'} ${a.name} and your ${relationTo(theirHost, b).toLowerCase() || 'kin'} ${b.name}.`);
      if (marriageAcceptance(me, a, b) >= 0) { marry(a, b); log(`${a.name} and ${b.name} were wed.`, { type: 'marriage', ids: [a.id, b.id], icon: '💍' }); toast({ text: `${a.name} and ${b.name} are now married!`, type: 'good', icon: '💍', sound: 'birth' }); if (!me.liege && !theirHost.liege && theirHost.id !== me.id && !allied(me.id, theirHost.id) && (a === me || me.kids.includes(a.id)) && (b === theirHost || theirHost.kids.includes(b.id))) { makeAlliance(me, theirHost); } }
      else toast({ text: `${displayName(theirHost)} rejects the match.`, type: 'bad', icon: '💔' });
      renderWindow();
    };
  };
  bind();
}

// ---------- Letters ----------
export function openLetterComposer(to, proposal = null, preset = '') {
  const me = pc(); const llm = isLLMActive();
  const props = [['', 'No formal proposal'], ['alliance', 'Propose an alliance'], ['vassalize', 'Demand they become my vassal']];
  const wars = G.s.wars.filter(w => sideOf(w, me.id) && sideOf(w, to.id) && sideOf(w, me.id) !== sideOf(w, to.id));
  for (const w of wars) props.push([`peace:${w.id}:white`, `White peace in ${w.name}`], [`peace:${w.id}:demand`, `Demand their surrender in ${w.name}`]);
  const curKey = proposal ? (proposal.kind === 'peace' ? `peace:${proposal.war}:${proposal.terms}` : proposal.kind) : '';
  const m = modal(`<div class="dh">${ptr(to, 40)}<h2>✉ To ${esc(fullName(to))}</h2></div><div class="db"><textarea class="txt" id="ltxt" rows="7" placeholder="Write your letter… be courteous, cunning, or threatening.">${esc(preset)}</textarea><div class="row" style="margin-top:8px"><span class="small">Attach:</span><select class="txt" id="lprop" style="width:auto">${proposal?.kind === 'marriage' ? `<option value="marriage" selected>Marriage proposal</option>` : ''}${props.map(([k, n]) => `<option value="${k}" ${k === curKey ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div><div class="tiny muted" style="margin-top:6px">${llm ? `${esc(to.name)} will read and reply in character${to.llm ? ' (Sovereign Mind)' : ''} using ${esc(G.settings.llm.model)}.` : 'Without OpenRouter configured, replies are formulaic.'}</div></div><div class="df"><button class="btn" data-act="mClose">Cancel</button><button class="btn primary" id="lsend">Seal & Send</button></div>`, { width: 560 });
  m.querySelector('#lsend').onclick = () => {
    const text = m.querySelector('#ltxt').value.trim() || '(A sealed letter bearing only your signature.)';
    const v = m.querySelector('#lprop').value; let p = null;
    if (v === 'marriage') p = proposal; else if (v === 'alliance' || v === 'vassalize') p = { kind: v }; else if (v.startsWith('peace:')) { const [, wid, terms] = v.split(':'); p = { kind: 'peace', war: +wid, terms }; }
    closeModal(m); playerWrites(to, text, p); sound('letter'); toast({ text: `Your letter to ${to.name} has been dispatched.`, icon: '✉' });
    openWindow('letters', to.id);
  };
  setTimeout(() => m.querySelector('#ltxt')?.focus(), 50);
}

// ---------- Pickers ----------
export function openGrantPicker(countyKey, toChar) {
  const me = pc();
  if (toChar) return pickFrom(`Grant a county to ${esc(toChar.name)}`, domainOf(me.id).filter(p => p !== me.capital).map(p => ({ id: G.world.provinces[p].key, html: `🏰 ${esc(G.world.provinces[p].name)}` })), key => { grantTitle(me, toChar, key); toast({ text: `${toChar.name} is now ${titleName(T(key))}'s lord.`, icon: '🏰', type: 'good' }); renderWindow(); renderHUD(); });
  const cands = [...courtiersOf(me.id), ...kidsOf(me).map(k => k.id), ...vassalsOf(me.id)].map(ch).filter((x, i, a) => x && !x.dead && isAdult(x) && !x.imprisoned && a.indexOf(x) === i && x.gov !== 'theocracy');
  pickFrom(`Grant ${esc(T(countyKey).name)} to…`, cands.map(c => ({ id: c.id, html: `<div class="row">${ptr(c, 32)}<div>${esc(displayName(c))}<div class="tiny muted">${relationTo(me, c)} · ${culture(c.cul).name} · opinion ${opinion(c, me)}</div></div></div>` })), id => { grantTitle(me, ch(id), countyKey); renderWindow(); renderHUD(); });
}
export function openCouncilPicker(post) {
  const me = pc(); const def = COUNCIL[post];
  const used = new Set(Object.entries(me.councilMembers || {}).filter(([k]) => k !== post).map(([, v]) => v));
  const pool = [...courtiersOf(me.id), ...vassalsOf(me.id), me.spouse].map(ch).filter(x => x && !x.dead && isAdult(x) && !x.imprisoned && !used.has(x.id) && (post !== 'chaplain' || x.fai === me.fai)).sort((a, b) => stat(b, def.stat) - stat(a, def.stat));
  pickFrom(`Appoint ${def.name}`, pool.map(c => ({ id: c.id, html: `<div class="row">${ptr(c, 34)}<div class="grow">${esc(displayName(c))}<div class="tiny muted">${relationTo(me, c)}</div></div><b>${STAT_ICONS[def.stat]} ${stat(c, def.stat)}</b></div>` })), id => { me.councilMembers[post] = +id; addOpinion(ch(+id), me, 10, 'Appointed to council', 60); renderWindow(); });
}

// ---------- Events ----------
on('event', () => showNextEvent());
on('modalClosed', () => setTimeout(showNextEvent, 50));
export function showNextEvent() {
  const s = G.s; if (!s || !s.eventQueue?.length) return;
  if (document.querySelector('.event')) return;
  if (modalOpen()) return;
  const e = s.eventQueue[0];
  const c = ch(e.charId) || pc();
  const x = deserializeCtx(e.x);
  const others = Object.values(x).filter(v => v && v.id !== undefined && G.s.chars[v.id]);
  sound('event');
  if (G.settings.eventPause && G.speed) { G.lastSpeed = G.speed; G.speed = 0; G.pausedByEvent = true; }
  const m = modal(`<div class="ev-scene">${scene(e.scene)}<div class="ev-title">${esc(e.title)}</div></div><div class="ev-body"><div class="ev-desc">${esc(e.desc)}</div><div class="col" style="gap:6px">${ptr(c, 70)}${others.slice(0, 2).map(o => ptr(o, 54)).join('')}</div></div><div class="ev-opts">${e.opts.map((o, i) => { const ok = !o.req || o.req(c); const fx = describeFx(o.fxR || o.fx, x); const txt = typeof o.t === 'function' ? o.t(c, x) : o.t; return `<button class="evopt" data-i="${i}" ${ok ? '' : 'disabled'}>${o.trait ? `<span class="oti" data-tipk="trait:${o.trait}">${TRAITS[o.trait]?.icon || ''}</span>` : ''}<span>${esc(txt)}${fx ? `<span class="fx">${esc(fx)}</span>` : ''}</span></button>`; }).join('')}</div>`, { cls: 'event', noClose: true });
  m.querySelectorAll('.evopt').forEach(b => b.onclick = () => {
    if (s !== G.s) { closeModal(m); return; }
    s.eventQueue.shift();
    try { resolvePlayerEvent(e, +b.dataset.i); } catch (err) { console.error(err); }
    closeModal(m);
    if (G.pausedByEvent && !s.eventQueue.length) { G.speed = G.lastSpeed; G.pausedByEvent = false; }
    renderHUD(); renderWindow();
  });
}

// ---------- Calls to arms ----------
on('callToArms', ({ war, ally, side }) => {
  const leader = ch(side === 'att' ? war.attLeader : war.defLeader);
  const m = modal(`<div class="dh">${ptr(leader, 48)}<h2>A Call to Arms</h2></div><div class="db">${charLink(leader, true)} calls upon your alliance in <b>${esc(war.name)}</b>. Will you honor your oath?</div><div class="df"><button class="btn danger" id="ctaNo">Refuse (−opinion, −prestige)</button><button class="btn primary" id="ctaYes">Join the war</button></div>`, { noClose: true });
  m.querySelector('#ctaYes').onclick = () => { joinWar(war, ally.id, side); closeModal(m); renderHUD(); };
  m.querySelector('#ctaNo').onclick = () => { addOpinion(leader, ally, -40, 'Refused call to arms', 120); ally.prestige -= 100; closeModal(m); };
});
on('crusadeCall', ({ w, head }) => {
  const me = pc();
  const m = modal(`<div class="dh">${ptr(head, 48)}<h2>✠ The Faithful Are Called</h2></div><div class="db">${charLink(head, true)} has proclaimed a Great Holy War: <b>${esc(w.name)}</b>. Will you take up the cause?</div><div class="df"><button class="btn" id="cNo">Stay home</button><button class="btn primary" id="cYes">Take the vow!</button></div>`, { noClose: true });
  m.querySelector('#cYes').onclick = () => { joinWar(w, me.id, 'att'); me.piety += 150; closeModal(m); renderHUD(); };
  m.querySelector('#cNo').onclick = () => { me.piety -= 100; closeModal(m); };
});

// ---------- Army panel ----------
export function renderArmyPanel() {
  const el = document.getElementById('armypanel'); if (!el) return;
  const a = G.selected?.type === 'army' ? G.s.armies.find(x => x.id === G.selected.id) : null;
  if (!a) { el.classList.remove('open'); return; }
  const owner = ch(a.owner); const mine = owner.id === G.s.player;
  const cm = ch(a.cmdr); const total = a.men + Object.values(a.maa).reduce((x, y) => x + y, 0);
  const here = G.s.armies.filter(x => x !== a && x.loc === a.loc && x.owner === a.owner && !x.path.length && !a.path.length);
  const status = a.battle ? '⚔ In battle!' : a.retreat ? '🏳 Retreating' : a.path.length ? `→ marching to ${esc(G.world.provinces[a.path[a.path.length - 1]].name)}` : G.s.provs[a.loc].siege && G.s.provs[a.loc].sieger === a.id ? `🏰 ${a.raid ? 'Raiding' : 'Besieging'} ${Math.round(G.s.provs[a.loc].siege * 100)}%` : G.s.day < a.ready ? 'Mustering…' : 'Holding position';
  el.innerHTML = `<div class="frame" style="padding:10px 14px"><div class="row" style="gap:12px">${ptr(owner, 46)}<div class="grow"><div style="font-family:var(--fh);color:var(--gold2)">Army of ${esc(displayName(owner))} — ${fmtNum(total)} men</div><div class="small">${esc(G.world.provinces[a.loc].name)} · ${status} · Commander ${cm ? charLink(cm) + ` (⚔${stat(cm, 'mar')})` : '—'}</div><div class="tiny muted">Levies ${fmtNum(a.men)} · ${Object.entries(a.maa).map(([t, n]) => `${MAA[t]?.icon}${fmtNum(n)}`).join(' ')} · Power ${fmtNum(armyPower(a))}${a.loot ? ` · 💰${Math.round(a.loot)}` : ''}</div></div><button class="btn small" data-act="deselArmy">✕</button></div>${mine ? `<div class="actions" style="margin-top:8px"><span class="small muted">Right-click the map to march.</span><span class="grow"></span>${here.length ? `<button class="btn small" data-act="mergeHere" data-a="${a.id}">Merge (${here.length})</button>` : ''}<button class="btn small" data-act="splitArmy" data-a="${a.id}">Split</button>${canRaid(owner) ? `<button class="btn small ${a.raid ? 'sel' : ''}" data-act="raidToggle" data-a="${a.id}" data-tip="Raiders loot foreign lands without a war, then bring the plunder home.">🔥 Raid</button>` : ''}<button class="btn small" data-act="cmdrPick" data-a="${a.id}">Commander</button><button class="btn small danger" data-act="disbandArmy" data-a="${a.id}" ${a.battle ? 'disabled' : ''}>Disband</button></div>` : ''}</div>`;
  el.classList.add('open');
}
on('hud', () => renderArmyPanel());
ACT.selArmy = id => { G.selected = { type: 'army', id: +id }; const a = G.s.armies.find(x => x.id === +id); if (a) focusProv(a.loc); renderArmyPanel(); };
ACT.deselArmy = () => { G.selected = null; renderArmyPanel(); };
ACT.splitArmy = id => { const a = G.s.armies.find(x => x.id === +id); if (a) splitArmy(a); renderArmyPanel(); };
ACT.mergeHere = id => { const a = G.s.armies.find(x => x.id === +id); for (const b of G.s.armies.filter(x => x !== a && x.loc === a.loc && x.owner === a.owner)) mergeArmies(a, b); renderArmyPanel(); };
ACT.raidToggle = id => { const a = G.s.armies.find(x => x.id === +id); if (a) a.raid = !a.raid; renderArmyPanel(); };
ACT.cmdrPick = id => { const a = G.s.armies.find(x => x.id === +id); const me = pc(); const pool = [me, ...courtiersOf(me.id).map(ch), ...vassalsOf(me.id).map(ch)].filter(x => x && !x.dead && isAdult(x) && !x.imprisoned).sort((p, q) => stat(q, 'mar') - stat(p, 'mar')); pickFrom('Choose a commander', pool.map(c => ({ id: c.id, html: `<div class="row">${ptr(c, 30)}<span class="grow">${esc(displayName(c))}</span><b>⚔ ${stat(c, 'mar')}</b></div>` })), cid => { a.cmdr = +cid; renderArmyPanel(); }); };

// ---------- Style menu ----------
const STYLE_PREV = { parchment: ['#e2d2a8', '#b04a3a', '#8aa0a0'], illuminated: ['#3050c0', '#d4af37', '#c03040'], topographic: ['#6a8a4a', '#e8e8f0', '#1a4a7a'], stained: ['#c02040', '#2060c0', '#0a0a0a'], ink: ['#ece4cc', '#3a2a1a', '#8a7a5a'], nightfire: ['#05070c', '#ffb050', '#3050a0'] };
export function openStyleMenu() {
  const m = modal(`<div class="dh"><h2>🎨 Map Style</h2><button class="btn small" data-act="mClose">✕</button></div><div class="db"><div class="grid3">${Object.entries(STYLES).map(([k, s]) => `<div class="choice ${G.settings.mapStyle === k ? 'sel' : ''}" data-s="${k}"><div style="height:56px;border-radius:4px;background:linear-gradient(135deg,${STYLE_PREV[k][0]} 0 40%,${STYLE_PREV[k][1]} 40% 60%,${STYLE_PREV[k][2]} 60%);border:1px solid #000;margin-bottom:6px"></div><div style="font-family:var(--fh);font-size:13px;color:var(--gold2)">${s.icon} ${s.name}</div><div class="tiny muted">${s.desc}</div></div>`).join('')}</div><div class="row" style="margin-top:10px;gap:14px"><label class="small row"><input type="checkbox" id="stLabels" ${G.settings.labels ? 'checked' : ''}> Realm names</label><label class="small row"><input type="checkbox" id="stSeasons" ${G.settings.seasons ? 'checked' : ''}> Seasons (winter snow)</label></div></div>`, { width: 640 });
  m.querySelectorAll('[data-s]').forEach(el => el.onclick = () => { G.settings.mapStyle = el.dataset.s; saveSettings(); recolor(true); renderHUD(); m.querySelectorAll('[data-s]').forEach(x => x.classList.toggle('sel', x === el)); });
  m.querySelector('#stLabels').onchange = e => { G.settings.labels = e.target.checked; saveSettings(); };
  m.querySelector('#stSeasons').onchange = e => { G.settings.seasons = e.target.checked; saveSettings(); recolor(true); };
}
ACT.styleMenu = () => openStyleMenu();

// ---------- LLM settings ----------
export async function openLLMSettings() {
  const L = G.settings.llm;
  const m = modal(`<div class="dh"><h2>🧿 Sovereign Minds — OpenRouter</h2><button class="btn small" data-act="mClose">✕</button></div><div class="db col" style="gap:10px">
    <div class="small" style="line-height:1.5">Connect to <b>OpenRouter</b> to let real AI models rule characters in your world. Your key is stored only in this browser and sent only to openrouter.ai. Get a key at <a href="https://openrouter.ai/keys" target="_blank" style="color:var(--gold2)">openrouter.ai/keys</a>.</div>
    <label class="small">API key<input class="txt" type="password" id="lk" value="${esc(L.apiKey)}" placeholder="sk-or-..." autocomplete="off"></label>
    <label class="small">Model <span class="muted" id="lmcount"></span><input class="txt" id="lmf" placeholder="Filter models (e.g. claude, gpt, llama, free)…" style="margin-bottom:4px"><select class="txt" id="lm" size="7"></select><input class="txt" id="lmc" value="${esc(L.model)}" placeholder="or type a model id, e.g. anthropic/claude-sonnet-4" style="margin-top:4px"></label>
    <div class="grid2"><label class="small">Creativity (temperature): <b id="ltv">${L.temperature}</b><input type="range" id="lt" min="0" max="1.5" step="0.05" value="${L.temperature}" style="width:100%"></label><label class="small">Rulers deliberate every <b id="liv">${L.interval}</b> months<input type="range" id="li" min="1" max="24" step="1" value="${L.interval}" style="width:100%"></label></div>
    <div class="grid2"><label class="small">Max simultaneous requests <select class="txt" id="lc">${[1, 2, 3, 4].map(n => `<option ${L.maxConcurrent === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label><div class="col small"><label class="row"><input type="checkbox" id="lr" ${L.revealThoughts ? 'checked' : ''}> Reveal private thoughts</label><label class="row"><input type="checkbox" id="lch" ${L.chronicler ? 'checked' : ''}> AI Chronicler (yearly narrative)</label></div></div>
    <div class="row"><button class="btn" id="ltest">Test connection</button><span id="lres" class="small"></span></div>
  </div><div class="df"><button class="btn" data-act="mClose">Close</button><button class="btn primary" id="lsave">Save</button></div>`, { width: 620 });
  const sel = m.querySelector('#lm'), filt = m.querySelector('#lmf'), custom = m.querySelector('#lmc');
  const fill = () => { const f = filt.value.toLowerCase(); const list = LLM.models.filter(x => !f || x.id.toLowerCase().includes(f) || x.name.toLowerCase().includes(f)).slice(0, 300); sel.innerHTML = list.map(x => `<option value="${esc(x.id)}" ${x.id === custom.value ? 'selected' : ''}>${esc(x.name)}${x.free ? ' — FREE' : ` — $${x.price}/M`}</option>`).join(''); m.querySelector('#lmcount').textContent = LLM.models.length ? `(${list.length} of ${LLM.models.length})` : '(loading…)'; };
  filt.oninput = fill; sel.onchange = () => { custom.value = sel.value; };
  m.querySelector('#lt').oninput = e => m.querySelector('#ltv').textContent = e.target.value;
  m.querySelector('#li').oninput = e => m.querySelector('#liv').textContent = e.target.value;
  const collect = () => { L.apiKey = m.querySelector('#lk').value.trim(); L.model = custom.value.trim(); L.temperature = +m.querySelector('#lt').value; L.interval = +m.querySelector('#li').value; L.maxConcurrent = +m.querySelector('#lc').value; L.revealThoughts = m.querySelector('#lr').checked; L.chronicler = m.querySelector('#lch').checked; saveSettings(); LLM.fails = 0; };
  m.querySelector('#lsave').onclick = () => { collect(); closeModal(m); toast({ text: isConfigured() ? `Sovereign Minds will use ${L.model}.` : 'OpenRouter not fully configured.', icon: '🧿', type: isConfigured() ? 'good' : 'bad' }); renderWindow(); };
  m.querySelector('#ltest').onclick = async () => { collect(); const r = m.querySelector('#lres'); r.innerHTML = '<span class="spinner"></span> contacting the oracle…'; try { const t = await chat([{ role: 'user', content: 'Reply with exactly: "Long live the King!"' }], { max_tokens: 20 }); r.innerHTML = `<span class="good">✓ ${esc(t.slice(0, 60))}</span>`; } catch (e) { r.innerHTML = `<span class="bad">✗ ${esc(e.message.slice(0, 140))}</span>`; } };
  if (!LLM.models.length) { fill(); await fetchModels(); }
  fill();
}
ACT.llmSettings = () => openLLMSettings();

// ---------- How to play ----------
export function openHelp() {
  modal(`<div class="dh"><h2>📖 How to Play</h2><button class="btn small" data-act="mClose">✕</button></div><div class="db" style="line-height:1.5;max-height:70vh;overflow-y:auto">
  <h3>Your Goal</h3><p>There is no victory screen. Guide your dynasty through the centuries: gain titles, grow your house's renown, and survive. When your character dies you continue as their heir. If your house has no heir, the game ends.</p>
  <h3>Time</h3><p><b>Space</b> pauses, <b>1–5</b> set speed. Events pause the game and ask for your decision; hover options to see their effects.</p>
  <h3>The Map</h3><p>Drag to pan, scroll to zoom, <b>WASD</b>/arrows to move. Click a county for details and buildings. Map modes (bottom right): Realms, De Jure, Culture, Faith, Terrain, Development, Houses, Diplomacy. Change the visual style with the style button.</p>
  <h3>Characters</h3><p>Click any portrait to open a character. From there: declare war, propose alliances, arrange marriages, send gifts or letters, and start schemes (befriend, sway, seduce, murder).</p>
  <h3>War</h3><p>You need a <b>casus belli</b>: claims (fabricated by your chancellor), de jure conquest, holy wars against other faiths, or subjugation. Raise armies (Military window or a county), select an army by clicking it, and <b>right-click</b> a county to march. Occupy the war's target counties and win battles to raise war score; at 100% you can enforce your demands. Tribal and pagan rulers can <b>raid</b> without war.</p>
  <h3>Realm</h3><p>Keep your domain within its limit by granting counties to vassals. Watch vassal opinion — discontented vassals form independence factions. Laws control succession: <i>partition</i> splits your lands among children; <i>primogeniture</i> keeps them whole.</p>
  <h3>Court & Lifestyle</h3><p>Choose a lifestyle focus to earn perks. Raise court grandeur with amenities and artifacts, hold feasts, hunts, tournaments and pilgrimages, and Hold Court once a year.</p>
  <h3>🧿 Sovereign Minds</h3><p>Add an OpenRouter API key (Game Menu → Sovereign Minds) and any ruler can be driven by a real AI model. They keep diaries (Mind tab), write you letters, and choose war or peace for themselves. Write to them from their character window — they answer in character and decide on your proposals.</p></div>`, { width: 640 });
}
ACT.help = () => openHelp();

// ---------- Game menu, settings, save/load ----------
export function openGameMenu() {
  const prev = G.speed; G.speed = 0;
  const m = modal(`<div class="dh"><h2>☰ Game Menu</h2></div><div class="db col" style="gap:8px"><button class="btn primary" id="gmRes">Resume</button><button class="btn" id="gmSave">💾 Save Game</button><button class="btn" id="gmLoad">📂 Load Game</button><button class="btn" id="gmExp">⬇ Export Save File</button><button class="btn" data-act="help">📖 How to Play</button><button class="btn" id="gmSet">⚙ Settings</button><button class="btn" id="gmLLM">🧿 Sovereign Minds (OpenRouter)</button><button class="btn" id="gmStyle">🎨 Map Style</button><button class="btn danger" id="gmMenu">Exit to Main Menu</button></div>`, { width: 340 });
  m.querySelector('#gmRes').onclick = () => { closeModal(m); G.speed = prev; };
  m.querySelector('#gmSave').onclick = async () => { try { const meta = await saveGame(); toast({ text: `Game saved: ${meta.name}`, icon: '💾', type: 'good' }); } catch (e) { toast({ text: 'Save failed: ' + e.message, type: 'bad' }); } };
  m.querySelector('#gmLoad').onclick = () => { closeModal(m); openLoadDialog(); };
  m.querySelector('#gmExp').onclick = () => exportFile();
  m.querySelector('#gmSet').onclick = () => { closeModal(m); openSettings(); };
  m.querySelector('#gmLLM').onclick = () => { closeModal(m); openLLMSettings(); };
  m.querySelector('#gmStyle').onclick = () => { closeModal(m); openStyleMenu(); };
  m.querySelector('#gmMenu').onclick = () => confirmBox('Exit', 'Return to the main menu? Unsaved progress will be lost.', () => { closeModal(m); emit('toMenu'); });
}
ACT.menu = () => openGameMenu();
export async function openLoadDialog() {
  const saves = await listSaves();
  const m = modal(`<div class="dh"><h2>📂 Load Game</h2><button class="btn small" data-act="mClose">✕</button></div><div class="db"><div class="col">${saves.map((s, i) => `<div class="choice row between" data-i="${i}"><div><div style="font-family:var(--fh);color:var(--gold2)">${esc(s.name)}</div><div class="tiny muted">${fmtDate(s.day)} · saved ${new Date(s.saved).toLocaleString()} · ${(s.size / 1e6).toFixed(1)} MB</div></div><button class="btn small danger" data-del="${i}">🗑</button></div>`).join('') || '<div class="muted">No saved games.</div>'}</div><div class="sep"></div><label class="small">Import a save file <input type="file" id="ldf" accept=".json"></label></div>`, { width: 560 });
  m.querySelectorAll('[data-i]').forEach(el => el.onclick = async e => { if (e.target.dataset.del !== undefined) return; closeModal(m); try { await loadSave(saves[+el.dataset.i].name); emit('loaded'); } catch (err) { toast({ text: 'Load failed: ' + err.message, type: 'bad' }); } });
  m.querySelectorAll('[data-del]').forEach(el => el.onclick = async () => { await deleteSave(saves[+el.dataset.del].name); closeModal(m); openLoadDialog(); });
  m.querySelector('#ldf').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { try { restore(r.result); closeModal(m); emit('loaded'); } catch (err) { toast({ text: 'Invalid save file', type: 'bad' }); } }; r.readAsText(f); };
}
export function openSettings() {
  const S = G.settings;
  const m = modal(`<div class="dh"><h2>⚙ Settings</h2><button class="btn small" data-act="mClose">✕</button></div><div class="db col" style="gap:10px"><label class="row small"><input type="checkbox" id="sSnd" ${S.sound ? 'checked' : ''}> Sound effects</label><label class="row small"><input type="checkbox" id="sMus" ${S.music ? 'checked' : ''}> Procedural music</label><label class="small">Music volume<input type="range" id="sMVol" min="0" max="1" step="0.05" value="${S.musicVolume ?? 0.35}" style="width:100%"></label><label class="row small"><input type="checkbox" id="sHer" ${S.herald ? 'checked' : ''}> The Herald (world news ticker)</label><label class="small">Volume<input type="range" id="sVol" min="0" max="1" step="0.05" value="${S.volume}" style="width:100%"></label><label class="row small"><input type="checkbox" id="sEvp" ${S.eventPause ? 'checked' : ''}> Pause when an event appears</label><label class="row small"><input type="checkbox" id="sLab" ${S.labels ? 'checked' : ''}> Show realm names on the map</label><label class="row small"><input type="checkbox" id="sSea" ${S.seasons ? 'checked' : ''}> Seasonal snow</label><div class="small muted">Hotkeys: Space pause · 1–5 speed · WASD/arrows pan · R/J/C/F/T/D/H/P map modes · Esc close</div></div><div class="df"><button class="btn primary" id="sOk">Done</button></div>`, { width: 420 });
  m.querySelector('#sOk').onclick = () => { S.sound = m.querySelector('#sSnd').checked; S.volume = +m.querySelector('#sVol').value; S.eventPause = m.querySelector('#sEvp').checked; S.labels = m.querySelector('#sLab').checked; S.seasons = m.querySelector('#sSea').checked; S.music = m.querySelector('#sMus').checked; S.musicVolume = +m.querySelector('#sMVol').value; S.herald = m.querySelector('#sHer').checked; saveSettings(); import('./music.js').then(mu => mu.refreshMusic()); recolor(true); closeModal(m); };
}

// ---------- Succession interlude ----------
on('playerSuccession', ({ old, heir, heirs }) => {
  const reign = old.titles.length ? '' : '';
  const years = Math.floor((old.dead - (old.reignStart || G.s.startDay)) / 365);
  if (!heir) { emit('gameOver', old); return; }
  heir.reignStart = G.s.day;
  const prev = G.speed; G.speed = 0;
  const el = document.createElement('div'); el.className = 'succession';
  el.innerHTML = `<div class="side">${portrait(old, 180)}<h2 style="margin-top:10px">${esc(fullName(old))}</h2><div class="epitaph">${Math.floor(old.born / 365)} – ${Math.floor(old.dead / 365)}<br>Died ${esc(CAUSES[old.cause] || old.cause || '')} at ${age(old)}.<br>${old.traits.filter(t => TRAITS[t]?.cat === 'personality').map(t => TRAITS[t].name).join(', ')}</div></div><div class="arrow">➤</div><div class="side">${portrait(heir, 180)}<h2 style="margin-top:10px">${esc(fullName(heir))}</h2><div class="epitaph">Age ${age(heir)} · ${esc(relationTo(old, heir) || 'Heir')}<br>${heirs.length > 1 ? `The realm is divided among ${heirs.length} heirs.` : 'The realm passes intact.'}</div><button class="btn primary" style="margin-top:20px" id="sucGo">Long live ${esc(heir.name)}!</button></div>`;
  document.getElementById('screen-root').appendChild(el); sound('death');
  el.querySelector('#sucGo').onclick = () => { el.remove(); G.speed = prev || 1; renderHUD(); closeWindow(); if (heir.capital !== null && heir.capital !== undefined) focusProv(heir.capital, 1.4); };
});
on('gameOver', old => {
  G.speed = 0;
  const el = document.createElement('div'); el.className = 'succession';
  el.innerHTML = `<div class="side" style="width:420px">${portrait(old, 180)}<h1 style="margin-top:14px">Your Dynasty Has Ended</h1><div class="epitaph">${esc(fullName(old))} died ${esc(CAUSES[old.cause] || old.cause || '')} with no heir of their house to carry on.<br>House ${esc(dynName(old))} passes into history.</div><div class="row center" style="margin-top:20px;gap:10px"><button class="btn" id="goObs">Watch the world</button><button class="btn primary" id="goMenu">Main Menu</button></div></div>`;
  document.getElementById('screen-root').appendChild(el);
  el.querySelector('#goMenu').onclick = () => { el.remove(); emit('toMenu'); };
  el.querySelector('#goObs').onclick = () => { el.remove(); G.observer = true; G.speed = 2; };
});
