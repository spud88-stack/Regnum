// Main panel windows.
import { G, markDirty, saveSettings } from '../state.js';
import { TRAITS, LIFESTYLES, PERK_INDEX, COUNCIL, BUILDINGS, MAA, LEGACIES, LEGACY_COST, INNOVATIONS, ERAS, SUCCESSION, GENDER_LAWS, CROWN_AUTHORITY, AMENITIES, ACTIVITIES, ARTIFACT_TYPES, RARITY } from '../data/traits.js';
import { FAITHS, CULTURES, GOVERNMENTS } from '../data/cultures.js';
import { TERRAIN } from '../data/geography.js';
import { ch, T, idx, age, isAdult, rankOf, primary, displayName, fullName, titleName, rankName, faith, culture, stat, STATS, STAT_NAMES, STAT_ICONS, opinion, domainOf, domainLimit, realmProvs, vassalsOf, courtiersOf, allVassals, isRuler, dynName, mods, relationTo, kidsOf, siblings, topOf, prestigeLevel, PRESTIGE_LEVELS, grandeur, grandeurLevel, expectedGrandeur, equippedArtifacts, deJureCounties, liegeOf, invalidateMods, isLanded } from '../engine/core.js';
import { income, levyMax, countyTax, countyLevy, fortLevel, availableMaa, maaCap, recruitMaa, disbandMaa, buildCost, startBuilding, availablePerks, unlockPerk, perkCost, maaMen } from '../engine/economy.js';
import { warsOf, sideOf, armyPower, realmStrength, raiseArmy, disbandArmy, knights, peaceAcceptance, endWar, warTargets, alliesOf, canRaid, CB, moveArmy, currentStrength } from '../engine/war.js';
import { heirList } from '../engine/life.js';
import { SCHEMES, schemeOdds, councillor } from '../engine/intrigue.js';
import { creatableTitles, createTitle, changeSuccession, changeCrown, changeGender, canReform, reformFaith, conversionCost, convertFaith, hybridize, holyTargets, callGreatHolyWar, legacyCost, buyLegacy, legitimize, myFraction } from '../engine/decisions.js';
import { canStartActivity, startActivity, holdCourt } from '../engine/events.js';
import { LLM, isConfigured, isLLMActive, setSovereignMind } from '../engine/llm.js';
import { portrait, coa, titleCoa, dynCoa } from '../render/art.js';
import { focusProv, setSelectedProv } from '../render/map.js';
import { WIN, ACT, ptr, coaHtml, charLink, titleLink, provLink, traitIcon, opTag, bar, pc, openWindow, closeWindow, renderWindow, confirmBox, toast, modName, modVal, fanfare, renderHUD } from './ui.js';
import { interactions, openCouncilPicker, openWarDeclare, openLetterComposer, openGrantPicker, openStyleMenu, renderArmyPanel } from './dialogs.js';
import { esc, fmtNum, fmtDate, sign, clamp, roman, plural } from '../util.js';

const sec = (h, body) => `<div class="sec"><h3>${h}</h3>${body}</div>`;
const pList = (cs, size = 46, label) => `<div class="plist">${cs.filter(Boolean).map(c => `<div class="pi">${ptr(c, size, { age: true })}<span class="pn">${esc(label ? label(c) : c.name)}</span></div>`).join('') || '<span class="muted small">None</span>'}</div>`;

// ---------- Character ----------
WIN.char = (id, tab) => {
  const c = ch(+id); if (!c) return null;
  const me = pc(); const isMe = me && me.id === c.id;
  tab = tab || 'overview';
  const tabs = [['overview', 'Overview'], ['family', 'Family'], ['mind', c.llm || G.s.llm.diaries[c.id] ? '🧿 Mind' : 'Mind'], ['history', 'History']];
  let html = '';
  if (tab === 'overview') {
    const liege = liegeOf(c); const host = !isRuler(c) && c.court ? ch(c.court) : null;
    html += `<div class="row" style="align-items:flex-start;gap:14px">${ptr(c, 112, { badge: false })}<div class="col grow" style="gap:3px">
      <div style="font-family:var(--fh);font-size:17px;color:var(--gold2)">${esc(fullName(c))}</div>
      ${c.dyn ? `<div class="row small"><span class="coa" data-act="open" data-a="dynasty">${dynCoa(c.dyn, 18)}</span> House ${esc(dynName(c))}</div>` : ''}
      <div class="small muted">${c.dead ? `Died ${fmtDate(c.dead)} (${c.cause || 'unknown'}), aged ${age(c)}` : `Age ${age(c)} · born ${fmtDate(c.born, true)}`}</div>
      <div class="small">${culture(c.cul).name} · <span data-tip="${esc(faith(c.fai).doctrines?.join(', ') || '')}">${faith(c.fai).icon} ${faith(c.fai).name}</span>${c.gov && isRuler(c) ? ` · ${GOVERNMENTS[c.gov]?.name}` : ''}</div>
      ${liege ? `<div class="small">Liege: ${charLink(liege)}</div>` : ''}${host ? `<div class="small">${c.imprisoned ? '⛓ Imprisoned by' : 'At the court of'} ${charLink(host)}</div>` : ''}
      ${me && !isMe && !c.dead ? `<div class="row small" style="margin-top:4px"><span data-tipk="opinion:${c.id}:${me.id}">Opinion of you ${opTag(opinion(c, me))}</span><span data-tipk="opinion:${me.id}:${c.id}">Yours ${opTag(opinion(me, c))}</span></div>` : ''}
      ${relationTo(me, c) && !isMe ? `<div class="tag" style="align-self:flex-start">${relationTo(me, c)}</div>` : ''}
      ${c.llm ? `<div class="tag" style="align-self:flex-start;color:#d0b8ff;border-color:#8060c0">🧿 Sovereign Mind</div>` : ''}
    </div></div>`;
    html += `<div class="sep"></div><div class="stats">${[...STATS, 'pro'].map(s => `<div class="stat" data-tip="<h4>${STAT_NAMES[s]}</h4>Base ${c.base[s]}, total ${stat(c, s)}"><div class="si">${STAT_ICONS[s]}</div><div class="sv">${stat(c, s)}</div></div>`).join('')}</div>`;
    html += sec('Traits', `<div class="traits">${c.traits.map(traitIcon).join('') || '<span class="muted small">None yet</span>'}</div>`);
    if (!c.dead) html += `<div class="row small" style="gap:14px"><span data-tip="Stress ${Math.round(c.stress)}">😰 Stress ${Math.round(c.stress)}</span><span data-tip="Health ${(c.health + (mods(c).health || 0)).toFixed(1)}">❤ ${['Dying', 'Poor', 'Fair', 'Good', 'Excellent'][clamp(Math.floor((c.health + (mods(c).health || 0) - 2) / 1.5), 0, 4)]} health</span>${c.preg ? '<span>🤰 Pregnant</span>' : ''}</div>`;
    if (isRuler(c)) {
      html += sec('Realm', `<div class="kv"><span class="k">Gold</span><span>🪙 ${fmtNum(c.gold)}</span><span class="k">Prestige</span><span>👑 ${fmtNum(c.prestige)} (${PRESTIGE_LEVELS[prestigeLevel(c)]})</span><span class="k">Piety</span><span>🙏 ${fmtNum(c.piety)}</span><span class="k">Military</span><span>⚔ ${fmtNum(realmStrength(c.id))}</span><span class="k">Counties</span><span>${realmProvs(c.id).length} (domain ${domainOf(c.id).length})</span><span class="k">Vassals</span><span>${vassalsOf(c.id).length}</span></div>`);
      html += sec('Titles', `<div class="row wrap">${c.titles.map(T).sort((a, b) => b.rank - a.rank).map(t => `<span data-tip="${esc(titleName(t))}">${coaHtml(t.id, t.rank >= 3 ? 34 : 24)}</span>`).join('')}</div>`);
    }
    if (c.claims?.length) html += sec('Claims', c.claims.map(tid => titleLink(tid)).join(', '));
    const rel = [['Friends', c.rel.friends], ['Rivals', c.rel.rivals], ['Lovers', c.rel.lovers]].filter(([, l]) => l.length);
    if (rel.length) html += sec('Relations', rel.map(([n, l]) => `<div class="small muted">${n}</div>${pList(l.map(ch), 38)}`).join(''));
    const arts = (c.artifacts || []).map(a => G.s.artifacts[a]).filter(Boolean);
    if (arts.length) html += sec('Artifacts', arts.map(artifactHtml).join(''));
    if (!c.dead && me && !isMe) html += sec('Interactions', `<div class="actions">${interactions(me, c).map(i => `<button class="btn small" data-act="interact" data-a="${i.id}" data-b="${c.id}" ${i.ok ? '' : 'disabled'} data-tip="${esc(i.tip || '')}">${i.icon} ${i.label}</button>`).join('')}</div>`);
    if (isMe) html += sec('Your Life', `<div class="actions"><button class="btn small" data-act="open" data-a="lifestyle">📘 Lifestyle</button><button class="btn small" data-act="open" data-a="court">🏛 Court</button><button class="btn small" data-act="open" data-a="dynasty">🌳 House</button></div>`);
  } else if (tab === 'family') {
    html += sec('Parents', pList([ch(c.father), ch(c.mother)], 52, x => relationTo(c, x)));
    html += sec('Spouse', pList([ch(c.spouse)], 52));
    html += sec('Children', pList(kidsOf(c), 46));
    html += sec('Siblings', pList(siblings(c), 42));
    const gk = kidsOf(c).flatMap(kidsOf); if (gk.length) html += sec('Grandchildren', pList(gk, 38));
    if (isRuler(c)) { const hl = heirList(c).slice(0, 5); html += sec(`Line of Succession — ${SUCCESSION[c.laws?.succ]?.name || ''}`, `<div class="small muted" style="margin-bottom:5px">${SUCCESSION[c.laws?.succ]?.desc || ''}</div>${pList(hl, 46, x => relationTo(c, x) || x.name)}`); }
  } else if (tab === 'mind') {
    const diary = (G.s.llm.diaries[c.id] || []).slice().reverse();
    html += `<div class="small muted" style="margin-bottom:8px">A <b>Sovereign Mind</b> is a ruler whose decisions are made by a real large language model via OpenRouter. They write diaries, send letters, scheme, make alliances and declare wars of their own volition.</div>`;
    if (isRuler(c) && !c.dead && c.id !== G.s.player) html += `<div class="row" style="margin-bottom:10px"><button class="btn ${c.llm ? 'danger' : 'primary'} small" data-act="toggleMind" data-a="${c.id}">${c.llm ? 'Revoke Sovereign Mind' : '🧿 Grant a Sovereign Mind'}</button>${c.llm && isLLMActive() ? `<button class="btn small" data-act="thinkNow" data-a="${c.id}">Think now</button>` : ''}${!isConfigured() ? '<button class="btn small" data-act="llmSettings">Configure OpenRouter</button>' : ''}</div>`;
    html += diary.length ? diary.map(mindEntry).join('') : '<div class="muted">No thoughts recorded yet.</div>';
  } else {
    const ev = G.s.log.filter(e => e.ids?.includes(c.id)).slice(-40).reverse();
    html += ev.length ? `<div class="list">${ev.map(e => `<div class="li small"><span class="muted" style="min-width:90px">${fmtDate(e.day, true)}</span><span>${e.icon || ''} ${esc(e.text)}</span></div>`).join('')}</div>` : '<div class="muted">No recorded deeds.</div>';
  }
  return { title: esc(displayName(c)), tabs, html };
};
export function mindEntry(e) { return `<div class="mind-entry"><div class="md">${fmtDate(e.day)}</div><div class="mdiary">“${esc(e.diary)}”</div>${G.settings.llm.revealThoughts && e.thoughts ? `<div class="mthought">💭 ${esc(e.thoughts)}</div>` : ''}${e.actions?.length ? `<div class="macts">⚙ ${e.actions.map(esc).join(' · ')}</div>` : ''}</div>`; }
export function artifactHtml(a) { const r = RARITY[a.rarity]; return `<div class="artifact" style="border-color:${r.color}55" data-tip="<h4 style='color:${r.color}'>${esc(a.name)}</h4><div class='tt-sub'>${r.name} ${a.type}</div>${a.desc ? `<div><i>${esc(a.desc)}</i></div>` : ''}${Object.entries(a.mods).map(([k, v]) => `<div class='tt-line'><span>${modName(k)}</span><span class='good'>${modVal(k, v)}</span></div>`).join('')}<div class='tt-sub'>${esc(a.history.join(' · '))}</div>"><span class="ai">${ARTIFACT_TYPES[a.type]?.icon}</span><div><div style="color:${r.color};font-family:var(--fh);font-size:13px">${esc(a.name)}</div><div class="tiny muted">${r.name} · ${Object.entries(a.mods).map(([k, v]) => `${modVal(k, v)} ${modName(k)}`).join(', ')}</div></div></div>`; }
ACT.toggleMind = id => { const c = ch(+id); if (!isConfigured() && !c.llm) { toast({ text: 'Configure an OpenRouter API key and model first (Sovereign Minds window).', type: 'bad', icon: '🧿' }); openWindow('minds'); return; } setSovereignMind(c, !c.llm); renderWindow(); };
ACT.thinkNow = id => { const c = ch(+id); c.nextThink = 0; import('../engine/llm.js').then(m => m.monthlyLLM()); toast({ text: `${c.name} is deliberating…`, icon: '🧿' }); };

// ---------- Title ----------
WIN.title = tid => {
  const t = T(tid); if (!t) return null; const me = pc(); const h = ch(t.holder);
  let html = `<div class="row" style="gap:14px;align-items:flex-start">${titleCoa(tid, 90)}<div class="col grow"><div style="font-family:var(--fh);font-size:18px;color:var(--gold2)">${esc(titleName(t))}</div><div class="small muted">${['', 'County', 'Duchy', 'Kingdom', 'Empire'][t.rank]} tier${t.custom ? ' · titular' : ''}</div>${t.parent ? `<div class="small">De jure part of ${titleLink(t.parent)}</div>` : ''}${t.faithHead ? `<div class="small">Head of the ${faith(t.faithHead).name} faith</div>` : ''}</div>${h ? ptr(h, 64) : ''}</div>`;
  html += sec('Holder', h ? `${charLink(h, true)}${h.liege ? ` · vassal of ${charLink(ch(h.liege))}` : ''}` : '<i class="muted">Unheld</i>');
  if (t.rank === 1) html += `<button class="btn small" data-act="prov" data-a="${t.prov}">🏰 View county</button>`;
  const kids = Object.values(G.s.titles).filter(x => x.parent === tid);
  if (kids.length) html += sec('De Jure Vassal Titles', `<div class="list">${kids.map(k => `<div class="li small">${coaHtml(k.id, 20)} ${titleLink(k.id)} <span class="muted grow" style="text-align:right">${k.holder ? esc(displayName(ch(k.holder))) : '—'}</span></div>`).join('')}</div>`);
  if (me && t.rank >= 2 && !t.custom) {
    const ct = creatableTitles(me).find(x => x.tid === tid);
    const frac = myFraction(me, tid);
    html += sec('Your Claim to It', `<div class="small">You control ${Math.round(frac * 100)}% of its de jure counties.</div>${bar(frac, 1)}${ct ? `<div style="margin-top:6px"><button class="btn primary small" data-act="createTitle" data-a="${tid}" ${ct.ok ? '' : 'disabled'} data-tip="Requires ${Math.round(ct.need * 100)}% · ${ct.cost.gold} gold · ${ct.cost.prestige} prestige">${ct.usurp ? 'Usurp' : 'Create'} title (🪙${ct.cost.gold} 👑${ct.cost.prestige})</button></div>` : ''}`);
  }
  const claimants = Object.values(G.s.chars).filter(c => !c.dead && c.claims?.includes(tid)).slice(0, 8);
  if (claimants.length) html += sec('Claimants', pList(claimants, 40));
  const hist = (t.history || []).slice(-12).reverse();
  if (hist.length) html += sec('History', `<div class="list">${hist.map(x => `<div class="li small"><span class="muted" style="min-width:86px">${fmtDate(x.day, true)}</span>${x.holder ? charLink(ch(x.holder)) : '—'} <span class="muted">(${x.how})</span></div>`).join('')}</div>`);
  return { title: esc(t.realmName || t.name), html };
};
ACT.createTitle = tid => { const me = pc(); if (createTitle(me, tid)) { fanfare(titleName(T(tid))); renderWindow(); renderHUD(); } };

// ---------- Province ----------
WIN.prov = pid => {
  pid = +pid; const W = G.world, s = G.s, I = idx(); const p = W.provinces[pid], sp = s.provs[pid]; if (!p) return null;
  const me = pc(); const h = ch(I.provOwner[pid]); const top = ch(I.provTop[pid]); const mine = h && h.id === me.id;
  let html = `<div class="row" style="gap:12px">${coaHtml(p.key, 54)}<div class="col grow"><div class="small muted">${TERRAIN[p.terrain].name} · ${titleLink(p.duchy)} · ${titleLink(p.kingdom)}</div><div class="small">Holder: ${h ? charLink(h) : '—'}${top && top !== h ? ` · Realm of ${charLink(top)}` : ''}</div><div class="small">${culture(sp.cul).name} · ${faith(sp.fai).icon} ${faith(sp.fai).name}</div></div>${h ? ptr(h, 54) : ''}</div>`;
  html += sec('County', `<div class="kv"><span class="k">Development</span><span>${sp.dev.toFixed(1)} ${bar(sp.dev, 60)}</span><span class="k">Monthly tax</span><span>🪙 ${countyTax(pid).toFixed(2)}</span><span class="k">Levies</span><span>⚔ ${fmtNum(countyLevy(pid))}</span><span class="k">Fort level</span><span>🏰 ${fortLevel(pid)}</span>${sp.ctrl ? `<span class="k bad">Occupied by</span><span>${charLink(ch(sp.ctrl))}</span>` : ''}${sp.siege ? `<span class="k bad">Siege</span><span>${Math.round(sp.siege * 100)}%</span>` : ''}${sp.conv ? `<span class="k">Conversion</span><span>${Math.round(sp.conv)}%</span>` : ''}</div>`);
  if (sp.wonders?.length) html += sec('Wonders', sp.wonders.map(w => `<div class="gold">✦ ${esc(w)}</div>`).join(''));
  html += sec('Buildings', `<div class="list">${Object.entries(BUILDINGS).map(([b, def]) => { const lv = sp.b?.[b] || 0; const cost = lv < 3 ? buildCost(me, b, lv) : 0; const can = mine && lv < 3 && !sp.build && me.gold >= cost; return `<div class="li"><span style="font-size:20px">${def.icon}</span><div class="grow"><div style="font-family:var(--fh);font-size:13px">${def.name} ${lv ? roman(lv) : ''}</div><div class="tiny muted">${def.desc}</div></div>${mine && lv < 3 ? `<button class="btn small" data-act="build" data-a="${pid}" data-b="${b}" ${can ? '' : 'disabled'}>${lv ? 'Upgrade' : 'Build'} 🪙${cost}</button>` : `<span class="small gold">${'★'.repeat(lv)}${'☆'.repeat(3 - lv)}</span>`}</div>`; }).join('')}</div>${sp.build ? `<div class="small" style="margin-top:6px">🔨 Building ${BUILDINGS[sp.build.b].name} ${roman(sp.build.lvl)} — ${Math.max(0, sp.build.done - s.day)} days left ${bar(s.day - sp.build.start, sp.build.done - sp.build.start)}</div>` : ''}`);
  const armies = s.armies.filter(a => a.loc === pid);
  if (armies.length) html += sec('Armies Here', `<div class="list">${armies.map(a => `<div class="li small" data-act="selArmy" data-a="${a.id}">⚔ ${fmtNum(a.men + Object.values(a.maa).reduce((x, y) => x + y, 0))} — ${esc(displayName(ch(a.owner)))}</div>`).join('')}</div>`);
  const acts = [];
  if (topOf(me.id) === I.provTop[pid]) acts.push(`<button class="btn small" data-act="raiseAt" data-a="${pid}">⚔ Raise armies here</button>`);
  if (G.selected?.type === 'army') acts.push(`<button class="btn small" data-act="moveSel" data-a="${pid}">➜ Move selected army here</button>`);
  if (h && h.id !== me.id) acts.push(`<button class="btn small" data-act="char" data-a="${h.id}">👤 Holder</button>`);
  if (me.councilMembers?.chancellor && I.provTop[pid] !== topOf(me.id)) acts.push(`<button class="btn small" data-act="fabHere" data-a="${p.key}" data-tip="Set your chancellor to fabricate a claim on this county (council task).">📜 Fabricate claim</button>`);
  html += `<div class="actions">${acts.join('')}</div>`;
  return { title: esc(p.name), html };
};
ACT.build = (pid, b) => { if (startBuilding(pc(), +pid, b)) { toast({ text: `Construction of ${BUILDINGS[b].name} has begun.`, icon: BUILDINGS[b].icon, type: 'good' }); renderWindow(); renderHUD(); } };
ACT.raiseAt = pid => { const a = raiseArmy(pc(), +pid); if (a) { toast({ text: `Armies raised: ${fmtNum(a.men)} levies and men-at-arms are mustering.`, icon: '⚔', type: 'good' }); G.selected = { type: 'army', id: a.id }; renderArmyPanel(); } else toast({ text: 'No troops available to raise.', icon: '⚔', type: 'bad' }); renderWindow(); };
ACT.moveSel = pid => { const a = G.s.armies.find(x => x.id === G.selected?.id); if (a && moveArmy(a, +pid)) toast({ text: 'Army on the march.', icon: '➜' }); };
ACT.fabHere = key => { const me = pc(); me.councilTasks = me.councilTasks || {}; me.councilTasks.chancellor = 'claim'; me.fabPick = key; me.fab = null; toast({ text: `Your chancellor will now work to fabricate a claim on ${T(key).name}.`, icon: '📜', type: 'good' }); };

// ---------- Realm ----------
WIN.realm = () => {
  const me = pc(); if (!isRuler(me)) return { title: 'Realm', html: '<div class="muted">You hold no titles.</div>' };
  const inc = me.lastIncome || income(me);
  let html = `<div class="row" style="gap:12px">${coaHtml(me.primary, 70)}<div class="col grow"><div style="font-family:var(--fh);font-size:17px;color:var(--gold2)">${esc(titleName(primary(me)))}</div><div class="small muted">${GOVERNMENTS[me.gov]?.name}: ${GOVERNMENTS[me.gov]?.desc}</div><div class="small">${realmProvs(me.id).length} counties · ${allVassals(me.id).length} vassals · ⚔ ${fmtNum(realmStrength(me.id))}</div></div></div>`;
  if (me.liege) html += `<div class="small" style="margin-top:6px">You are a vassal of ${charLink(ch(me.liege), true)}. Opinion: ${opTag(opinion(ch(me.liege), me))}</div>`;
  const laws = me.laws || {};
  html += sec('Laws', `<div class="kv"><span class="k">Succession</span><span><select class="txt" style="width:auto;padding:3px" data-chg="setSucc">${Object.entries(SUCCESSION).map(([k, v]) => `<option value="${k}" ${laws.succ === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select> <span class="tiny muted">500 prestige to change</span></span>
  <span class="k">Gender</span><span><select class="txt" style="width:auto;padding:3px" data-chg="setGender">${Object.entries(GENDER_LAWS).map(([k, v]) => `<option value="${k}" ${laws.gender === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select> <span class="tiny muted">300 prestige</span></span>
  <span class="k">Crown Authority</span><span>${CROWN_AUTHORITY.map((ca, k) => `<button class="btn small ${laws.crown === k ? 'sel' : ''}" data-act="setCrown" data-a="${k}" data-tip="<h4>${ca.name}</h4>Vassal tax ${Math.round(ca.tax * 100)}%, levies ${Math.round(ca.levy * 100)}%, opinion ${sign(ca.opinion)}${k > (laws.crown ?? 1) ? `<br>Cost ${300 * k} prestige; no vassal may dislike you` : ''}">${roman(k + 1)}</button>`).join(' ')}</span></div><div class="small muted" style="margin-top:4px">${SUCCESSION[laws.succ]?.desc || ''}</div>`);
  html += sec('Heir', pList(heirList(me).slice(0, 3), 48, x => relationTo(me, x) || x.name));
  html += sec(`Domain (${domainOf(me.id).length}/${domainLimit(me)})`, `<div class="list">${domainOf(me.id).map(pid => `<div class="li small">${coaHtml(G.world.provinces[pid].key, 20)} ${provLink(pid)} ${me.capital === pid ? '<span class="tag">Capital</span>' : ''}<span class="grow"></span><span class="muted">🪙${countyTax(pid).toFixed(1)}</span>${me.capital !== pid ? `<button class="btn small" data-act="grantPick" data-a="${G.world.provinces[pid].key}">Grant</button>` : ''}</div>`).join('')}</div>`);
  const vs = vassalsOf(me.id).map(ch).sort((a, b) => rankOf(b) - rankOf(a) || realmStrength(b.id) - realmStrength(a.id));
  html += sec(`Vassals (${vs.length})`, `<table class="tbl"><tr><th></th><th>Vassal</th><th>Opinion</th><th>Levies</th><th>Tax</th></tr>${vs.map(v => `<tr><td>${ptr(v, 30)}</td><td>${charLink(v)}${me.faction?.members?.includes(v.id) ? ' <span class="bad" data-tip="Member of an independence faction">🔥</span>' : ''}${v.llm ? ' 🧿' : ''}</td><td data-tipk="opinion:${v.id}:${me.id}">${opTag(opinion(v, me))}</td><td>${fmtNum((v.levyMaxRaw || 0) * 0.25)}</td><td>${((v.grossIncome || 0) * 0.15).toFixed(1)}</td></tr>`).join('')}</table>`);
  if (me.faction) html += `<div class="bad small">🔥 Faction power: ${me.faction.power}% of your strength. At 80% they will rebel.</div>`;
  if (me.tyranny) html += `<div class="bad small">Tyranny: ${Math.round(me.tyranny)}</div>`;
  return { title: 'Realm', html };
};
ACT.setSucc = v => { if (!changeSuccession(pc(), v)) toast({ text: 'Cannot change succession now (500 prestige, peace, and for Primogeniture the High Medieval era).', type: 'bad', icon: '📜' }); renderWindow(); };
ACT.setGender = v => { if (!changeGender(pc(), v)) toast({ text: 'Not enough prestige.', type: 'bad' }); renderWindow(); };
ACT.setCrown = k => { if (!changeCrown(pc(), +k)) toast({ text: 'Cannot change crown authority (prestige, or a vassal dislikes you).', type: 'bad' }); renderWindow(); };
ACT.grantPick = key => openGrantPicker(key);

// ---------- Military ----------
WIN.military = () => {
  const me = pc(); const lm = levyMax(me);
  let html = `<div class="kv"><span class="k">Levies ready</span><span>⚔ ${fmtNum(me.levyCur || 0)} / ${fmtNum(me.levyMax || 0)}</span><span class="k">From domain</span><span>${fmtNum(lm.own)}</span><span class="k">From vassals</span><span>${fmtNum(lm.fromV)}</span><span class="k">Total strength</span><span>${fmtNum(realmStrength(me.id))}</span></div>`;
  html += `<div class="actions" style="margin-top:8px"><button class="btn primary small" data-act="raiseAt" data-a="${me.capital}">⚔ Raise armies</button><button class="btn small" data-act="disbandAll">Disband all</button><label class="small row"><input type="checkbox" data-chg="autoArmy" ${G.s.flags.autoArmy ? 'checked' : ''}> Marshal commands my armies</label></div>`;
  const regs = Object.values(me.maa || {}).reduce((a, b) => a + b, 0);
  html += sec(`Men-at-Arms (${regs}/${maaCap(me) * 3} regiments)`, `<table class="tbl"><tr><th>Regiment</th><th>Count</th><th>Men</th><th>Upkeep</th><th></th></tr>${Object.entries(me.maa || {}).map(([t, n]) => `<tr><td>${MAA[t].icon} ${MAA[t].name}</td><td>${n}</td><td>${fmtNum(me.maaCur?.[t] || 0)}/${fmtNum(n * MAA[t].size)}</td><td>${(MAA[t].upkeep * n).toFixed(1)}</td><td><button class="btn small" data-act="maaAdd" data-a="${t}">+</button><button class="btn small" data-act="maaDel" data-a="${t}">−</button></td></tr>`).join('') || '<tr><td colspan=5 class="muted">No regiments</td></tr>'}</table>`);
  html += sec('Recruit', `<div class="list">${availableMaa(me).map(t => { const d = MAA[t]; return `<div class="li small" data-tip="<h4>${d.icon} ${d.name}</h4>Damage ${d.dmg} · Toughness ${d.tough} · Pursuit ${d.pursuit}<br>Counters: ${d.counters.join(', ') || 'none'}<br>${d.size} men per regiment${d.cultural ? '<br><i>Cultural regiment</i>' : ''}"><span style="font-size:18px">${d.icon}</span><span class="grow">${d.name}${d.cultural ? ' <span class="tag">cultural</span>' : ''}</span><span class="muted">🪙${d.cost} · ${d.upkeep}/mo</span><button class="btn small" data-act="maaAdd" data-a="${t}" ${me.gold >= d.cost ? '' : 'disabled'}>Recruit</button></div>`; }).join('')}</div>`);
  const arm = G.s.armies.filter(a => a.owner === me.id);
  html += sec('Raised Armies', arm.length ? `<div class="list">${arm.map(a => `<div class="li small"><span>⚔ ${fmtNum(a.men + Object.values(a.maa).reduce((x, y) => x + y, 0))}</span><span class="grow">${esc(G.world.provinces[a.loc].name)}${a.path.length ? ' → ' + esc(G.world.provinces[a.path[a.path.length - 1]].name) : ''}</span><button class="btn small" data-act="selArmy" data-a="${a.id}">Select</button><button class="btn small" data-act="disbandArmy" data-a="${a.id}">Disband</button></div>`).join('')}</div>` : '<div class="muted small">No armies in the field.</div>');
  html += sec('Knights', pList(knights(me), 40, k => `${k.name} 💪${stat(k, 'pro')}`));
  if (me.mercs?.length) html += sec('Mercenaries', me.mercs.map(m => `<div class="small">🗡 ${esc(m.name)} — ${m.upkeep}/mo until ${fmtDate(m.until, true)}</div>`).join(''));
  return { title: 'Military', html };
};
ACT.maaAdd = t => { if (!recruitMaa(pc(), t, 1)) toast({ text: 'Cannot recruit (gold or regiment cap).', type: 'bad', icon: '⚔' }); renderWindow(); renderHUD(); };
ACT.maaDel = t => { disbandMaa(pc(), t, 1); renderWindow(); };
ACT.disbandAll = () => { G.s.armies.filter(a => a.owner === pc().id && !a.battle).forEach(disbandArmy); renderWindow(); };
ACT.disbandArmy = id => { const a = G.s.armies.find(x => x.id === +id); if (a && !a.battle) disbandArmy(a); G.selected = null; renderWindow(); renderArmyPanel(); };
ACT.autoArmy = (v, a, el) => { G.s.flags.autoArmy = el.checked; };

// ---------- Council ----------
WIN.council = () => {
  const me = pc();
  if (rankOf(me) < 2) return { title: 'Council', html: '<div class="muted">Only dukes and higher maintain a council.</div>' };
  me.councilMembers = me.councilMembers || {}; me.councilTasks = me.councilTasks || {};
  let html = '';
  for (const [post, def] of Object.entries(COUNCIL)) {
    const m = councillor(me, post);
    html += `<div class="li" style="align-items:flex-start;margin-bottom:6px">${m ? ptr(m, 48) : `<span class="ptr" style="width:48px;height:58px;display:flex;align-items:center;justify-content:center;font-size:24px;line-height:1" data-act="councilPick" data-a="${post}">${def.icon}</span>`}<div class="col grow"><div class="row between"><span style="font-family:var(--fh);color:var(--gold2)">${def.icon} ${def.name}</span><button class="btn small" data-act="councilPick" data-a="${post}">${m ? 'Replace' : 'Appoint'}</button></div><div class="small">${m ? `${charLink(m)} · ${STAT_NAMES[def.stat]} ${stat(m, def.stat)} · opinion ${opTag(opinion(m, me))}` : '<span class="bad">Vacant</span>'}</div><div class="row wrap" style="gap:4px;margin-top:4px">${Object.entries(def.tasks).map(([k, n]) => `<button class="btn small ${me.councilTasks[post] === k ? 'sel' : ''}" data-act="councilTask" data-a="${post}" data-b="${k}">${n}</button>`).join('')}</div>${post === 'chancellor' && me.councilTasks.chancellor === 'claim' && me.fab ? `<div class="small" style="margin-top:4px">Fabricating claim on ${titleLink(me.fab.target)} ${bar(me.fab.prog, 100)}</div>` : ''}${post === 'chaplain' && me.councilTasks.chaplain === 'convert' ? `<div class="tiny muted">Converting domain counties of other faiths.</div>` : ''}</div></div>`;
  }
  return { title: 'Council', html };
};
ACT.councilTask = (post, task) => { const me = pc(); me.councilTasks[post] = task; if (post === 'chancellor' && task === 'claim') me.fab = null; renderWindow(); };
ACT.councilPick = post => openCouncilPicker(post);

// ---------- Court ----------
WIN.court = () => {
  const me = pc(); const g = grandeur(me), gl = grandeurLevel(me), ex = expectedGrandeur(me);
  me.amenities = me.amenities || { food: 1, servants: 1, fashion: 1, lodging: 1 };
  let html = `<div class="row" style="gap:10px"><span class="bigicon">🏛</span><div class="grow"><div style="font-family:var(--fh);color:var(--gold2)">Court Grandeur ${g} — Level ${gl}</div>${bar(g, 100)}<div class="tiny ${g >= ex ? 'good' : 'bad'}">Expected for your rank: ${ex}. ${g >= ex ? 'Your court impresses.' : 'Your court disappoints your peers.'}</div></div></div>`;
  html += sec('Amenities', Object.entries(AMENITIES).map(([k, a]) => `<div class="row between small" style="margin-bottom:4px"><span>${a.icon} ${a.name}: <b>${a.levels[me.amenities[k]]}</b></span><span>${a.levels.map((n, i) => `<button class="btn small ${me.amenities[k] === i ? 'sel' : ''}" data-act="amen" data-a="${k}" data-b="${i}" data-tip="${n}${i > 1 ? `: costs ${((i - 1) * 0.35 * Math.max(1, rankOf(me) - 1)).toFixed(1)} gold/month` : ''}">${i + 1}</button>`).join('')}</span></div>`).join(''));
  html += sec('Activities', `<div class="list">${Object.entries(ACTIVITIES).map(([k, a]) => { const ok = canStartActivity(me, k); const cd = me.lastAct?.[k] ? Math.max(0, a.cooldown - (G.s.day - me.lastAct[k])) : 0; return `<div class="li small"><span style="font-size:20px">${a.icon}</span><div class="grow"><div style="font-family:var(--fh)">${a.name}</div><div class="tiny muted">${a.desc}</div></div><button class="btn small" data-act="activity" data-a="${k}" ${ok ? '' : 'disabled'} data-tip="${cd ? `Available in ${cd} days` : `Cost ${a.cost} gold, lasts ${a.days} days`}">🪙${a.cost}</button></div>`; }).join('')}</div>${G.s.activities.filter(a => a.owner === me.id).map(a => `<div class="small gold">In progress: ${ACTIVITIES[a.type].name} — ${a.end - G.s.day} days left</div>`).join('')}`);
  html += `<button class="btn primary" data-act="holdCourt" ${rankOf(me) >= 2 && (!me.lastCourt || G.s.day - me.lastCourt >= 365) ? '' : 'disabled'} data-tip="Receive petitioners in your throne room (once per year).">👑 Hold Court</button>`;
  const arts = (me.artifacts || []).map(a => G.s.artifacts[a]).filter(Boolean); const eq = equippedArtifacts(me);
  html += sec(`Treasury of Artifacts (${arts.length})`, arts.length ? arts.map(a => artifactHtml(a) + (eq.includes(a.id) ? '' : '')).join('') : '<div class="muted small">Your vaults are empty.</div>');
  html += sec('Courtiers', pList(courtiersOf(me.id).map(ch), 40));
  return { title: 'Royal Court', html };
};
ACT.amen = (k, i) => { pc().amenities[k] = +i; invalidateMods(pc().id); renderWindow(); };
ACT.activity = k => { if (startActivity(pc(), k)) { toast({ text: `Your ${ACTIVITIES[k].name} has begun.`, icon: ACTIVITIES[k].icon, type: 'good' }); renderWindow(); renderHUD(); } };
ACT.holdCourt = () => { if (holdCourt(pc())) renderWindow(); };

// ---------- Intrigue ----------
WIN.intrigue = () => {
  const me = pc();
  const mine = G.s.schemes.filter(s => s.owner === me.id);
  const against = G.s.schemes.filter(s => s.target === me.id && s.discovered);
  let html = sec('Your Schemes', mine.length ? mine.map(s => `<div class="li small">${ptr(ch(s.target), 34)}<div class="grow"><div>${SCHEMES[s.type].icon} ${SCHEMES[s.type].name} ${charLink(ch(s.target))}</div>${bar(s.prog, 100)}<div class="tiny muted">Success chance ${schemeOdds(s)}% · secrecy ${Math.round(s.secrecy * 100)}%${s.discovered ? ' · <span class="bad">discovered</span>' : ''}</div></div><button class="btn small danger" data-act="cancelScheme" data-a="${s.id}">✕</button></div>`).join('') : '<div class="muted small">Start schemes from a character\'s interactions.</div>');
  html += sec('Known Plots Against You', against.length ? against.map(s => `<div class="li small bad">${SCHEMES[s.type].icon} ${charLink(ch(s.owner))} plots to ${SCHEMES[s.type].name.toLowerCase()} you (${Math.round(s.prog)}%)</div>`).join('') : '<div class="muted small">None known. Your spymaster watches.</div>');
  const hooks = Object.entries(me.hooks || {}).filter(([id]) => ch(+id) && !ch(+id).dead);
  html += sec('Hooks', hooks.length ? `<div class="list">${hooks.map(([id, t]) => `<div class="li small">${ptr(ch(+id), 30)} ${charLink(ch(+id))} <span class="tag">${t} hook</span></div>`).join('')}</div>` : '<div class="muted small">You hold no leverage over anyone.</div>');
  if (me.secrets?.length) html += sec('Your Secrets', me.secrets.map(s => `<div class="small bad">🤫 ${s.type === 'murder' ? `You arranged the death of ${esc(ch(s.about)?.name || 'someone')}` : s.type}</div>`).join(''));
  const sm = councillor(me, 'spymaster'); html += sec('Spymaster', sm ? `${ptr(sm, 40)} ${charLink(sm)} · Intrigue ${stat(sm, 'int')}` : '<div class="muted small">No spymaster appointed.</div>');
  return { title: 'Intrigue', html };
};
ACT.cancelScheme = id => { G.s.schemes = G.s.schemes.filter(s => s.id !== +id); renderWindow(); };

// ---------- Faith ----------
WIN.faith = () => {
  const me = pc(); const f = faith(me.fai); const fs = G.s.faiths[me.fai] || { fervor: 50 };
  const headT = Object.values(G.s.titles).find(t => t.faithHead === me.fai && t.holder); const head = headT ? ch(headT.holder) : null;
  let html = `<div class="row" style="gap:12px"><span style="font-size:46px;color:${f.color}">${f.icon}</span><div class="grow"><div style="font-family:var(--fh);font-size:18px;color:var(--gold2)">${esc(f.name)}</div><div class="small muted">${f.family[0].toUpperCase() + f.family.slice(1)} family${f.reformed ? ' · Reformed' : ''}</div><div class="small">Fervor ${Math.round(fs.fervor || 50)}%</div>${bar(fs.fervor || 50, 100, 'purple')}</div>${head ? ptr(head, 56) : ''}</div>`;
  html += sec('Doctrines', `<div class="row wrap">${(f.doctrines || []).map(d => `<span class="chip">${esc(d)}</span>`).join('')}</div>`);
  if (head) html += sec('Head of Faith', `${charLink(head, true)} — opinion of you ${opTag(opinion(head, me))}`);
  html += sec('Holy Sites', `<div class="list">${(f.holy || []).map(n => { const pid = G.world.byName[n]; if (pid === undefined) return `<div class="li small muted">${n} (beyond the map)</div>`; const top = ch(idx().provTop[pid]); return `<div class="li small">✦ ${provLink(pid)} <span class="grow"></span>${top ? `${charLink(top)} ${top.fai === me.fai ? '<span class="good">✓</span>' : '<span class="bad">✗</span>'}` : ''}</div>`; }).join('')}</div>`);
  const acts = [];
  if (f.reformable && !f.reformed) acts.push(`<button class="btn primary small" data-act="reform" ${canReform(me) ? '' : 'disabled'} data-tip="Requires 1,000 piety. Reform your pagan faith into an organized religion able to stand against the great faiths.">✨ Reform the Faith</button>`);
  if (head && head.id === me.id) { const tg = holyTargets(me); acts.push(...tg.map((t, i) => `<button class="btn danger small" data-act="ghw" data-a="${i}">✠ Call Great Holy War for ${esc(T(t.kingdom).name)}</button>`)); }
  html += acts.length ? `<div class="actions">${acts.join('')}</div>` : '';
  const others = [...new Set([ch(me.liege)?.fai, ...realmProvs(me.id).map(p => G.s.provs[p].fai), me.spouse ? ch(me.spouse)?.fai : null].filter(x => x && x !== me.fai))];
  if (others.length) html += sec('Conversion', others.map(fid => `<div class="li small"><span>${faith(fid).icon} ${faith(fid).name}</span><span class="grow"></span><button class="btn small" data-act="convert" data-a="${fid}" ${me.piety >= conversionCost(me, fid) ? '' : 'disabled'}>Convert (🙏${conversionCost(me, fid)})</button></div>`).join(''));
  const st = G.s.struggle;
  if (st) html += sec(st.name, `<div class="small">Phase: <b>${st.phase}</b></div>${bar(st.prog, 100, 'red')}<div class="tiny muted">Holy wars in the region push it toward Hostility (cheaper holy wars for involved faiths); peace pushes it toward Conciliation.</div>`);
  return { title: 'Faith', html };
};
ACT.reform = () => { const me = pc(); const name = prompt('Name your reformed faith:', `Reformed ${faith(me.fai).name}`); if (name !== null && reformFaith(me, name)) { fanfare(name); renderWindow(); } };
ACT.ghw = i => { const me = pc(); const t = holyTargets(me)[+i]; if (t) callGreatHolyWar(me, t); renderWindow(); };
ACT.convert = fid => { confirmBox('Convert?', `Abandon ${faith(pc().fai).name} for ${faith(fid).name}? Your vassals of the old faith will not forget.`, () => { convertFaith(pc(), fid); renderWindow(); }); };

// ---------- Culture ----------
WIN.culture = () => {
  const me = pc(); const cu = culture(me.cul); const cs = G.s.cultures[me.cul] || { inn: {}, era: 0 };
  let html = `<div class="row" style="gap:12px"><span style="width:46px;height:46px;border-radius:50%;background:${cu.color};border:2px solid var(--gold)"></span><div class="grow"><div style="font-family:var(--fh);font-size:18px;color:var(--gold2)">${esc(cu.name)}</div><div class="small muted">${esc(cu.group)} heritage · ${esc(cu.ethos)} ethos · ${ERAS[cs.era]}</div><div class="small">Cultural regiment: ${MAA[cu.maa]?.icon || ''} ${MAA[cu.maa]?.name || '—'}</div></div></div>`;
  for (let e = 0; e < 4; e++) html += sec(ERAS[e], `<div class="grid2">${INNOVATIONS.filter(i => i.era === e).map(i => { const p = cs.inn[i.id] || 0; return `<div class="choice ${p >= 100 ? 'sel' : ''}" data-tip="${Object.entries(i.mods).map(([k, v]) => `${modName(k)} ${modVal(k, v)}`).join('<br>')}"><div class="small">${p >= 100 ? '✓ ' : ''}${i.name}</div>${p < 100 ? bar(p, 100, 'blue') : ''}</div>`; }).join('')}</div>`);
  const neigh = [...new Set(realmProvs(me.id).map(p => G.s.provs[p].cul).filter(c => c !== me.cul))];
  html += sec('Hybridize Culture', neigh.length ? `<div class="small muted">Blend your culture with another in your realm to forge a new identity. 1,000 prestige.</div><div class="actions" style="margin-top:6px">${neigh.map(c => `<button class="btn small" data-act="hybrid" data-a="${c}" ${me.prestige >= 1000 ? '' : 'disabled'}>🎭 with ${culture(c).name}</button>`).join('')}</div>` : '<div class="muted small">No other cultures in your realm.</div>');
  return { title: 'Culture', html };
};
ACT.hybrid = other => { const me = pc(); const name = prompt('Name the new culture:', ''); if (name !== null && hybridize(me, other, name || undefined)) { fanfare('A New Culture'); renderWindow(); } };

// ---------- Dynasty ----------
WIN.dynasty = (_, tab) => {
  const me = pc(); const d = G.s.dyns[me.dyn];
  if (!d) return { title: 'House', html: '<div class="muted">You belong to no house.</div>' };
  tab = tab || 'house';
  const members = (idx().dynMembers.get(d.id) || []).map(ch).filter(Boolean).sort((a, b) => rankOf(b) - rankOf(a) || a.born - b.born);
  let html = '';
  if (tab === 'house') {
    html += `<div class="row" style="gap:14px"><span class="coa">${dynCoa(d.id, 70)}</span><div class="grow"><div style="font-family:var(--fh);font-size:20px;color:var(--gold2)">House ${esc(d.name)}</div><div class="small">🌟 Renown ${fmtNum(d.renown)} · ${members.length} living members</div><div class="small">Head of house: ${charLink(ch(d.head))}</div></div></div>`;
    html += sec('Legacies', Object.entries(LEGACIES).map(([k, L]) => { const lv = d.legacies[k] || 0; const cost = legacyCost(d, k); return `<div class="li"><span style="font-size:22px">${L.icon}</span><div class="grow"><div style="font-family:var(--fh);font-size:13px">${L.name} ${'★'.repeat(lv)}${'☆'.repeat(3 - lv)}</div><div class="tiny muted">${L.levels.map((l, i) => `<span class="${i < lv ? 'good' : ''}" data-tip="${Object.entries(l.mods).map(([mk, mv]) => modName(mk) + ' ' + modVal(mk, mv)).join(', ')}">${l.name}</span>`).join(' → ')}</div></div>${cost !== null ? `<button class="btn small" data-act="legacy" data-a="${k}" ${d.renown >= cost && d.head === me.id ? '' : 'disabled'} data-tip="${d.head !== me.id ? 'Only the head of house may choose legacies' : ''}">🌟${cost}</button>` : '<span class="gold">✓</span>'}</div>`; }).join(''));
    html += sec('Members', `<div class="list">${members.slice(0, 30).map(m => `<div class="li small">${ptr(m, 30)} ${charLink(m)} <span class="grow"></span><span class="muted">${age(m)} · ${relationTo(me, m)}</span></div>`).join('')}</div>`);
  } else html += familyTree(me);
  return { title: `House ${esc(d.name)}`, tabs: [['house', 'House'], ['tree', 'Family Tree']], html, wide: tab === 'tree' };
};
ACT.legacy = k => { if (buyLegacy(pc(), k)) renderWindow(); };
function familyTree(me) {
  const nodes = []; const links = [];
  const add = (c, x, y) => { if (!c) return; nodes.push({ c, x, y }); };
  const root = ch(me.father) ? ch(ch(me.father).father) || ch(me.father) : me;
  let col = 0; const W = 92, H = 128;
  const place = (c, depth) => {
    if (!c || depth > 4) return null;
    const kids = kidsOf(c).filter(k => k.dyn === c.dyn || depth < 1);
    let xs = [];
    for (const k of kids) { const kx = place(k, depth + 1); if (kx !== null) xs.push(kx); }
    const x = xs.length ? (xs[0] + xs[xs.length - 1]) / 2 : (col++) * W;
    add(c, x, depth * H);
    for (const k of kids) { const n = nodes.find(n => n.c === k); if (n) links.push([x, depth * H, n.x, n.y]); }
    return x;
  };
  place(root, 0);
  const maxX = Math.max(...nodes.map(n => n.x)) + W, maxY = Math.max(...nodes.map(n => n.y)) + H;
  return `<div class="tree" style="overflow:auto;max-height:70vh"><svg width="${maxX + 20}" height="${maxY + 10}" style="display:block">${links.map(([a, b, c, d]) => `<path d="M${a + 40} ${b + 96} C${a + 40} ${b + 112} ${c + 40} ${d - 14} ${c + 40} ${d}" stroke="#8a6a2a" fill="none" stroke-width="1.5"/>`).join('')}${nodes.map(n => `<g transform="translate(${n.x} ${n.y})" style="cursor:pointer" data-act="char" data-a="${n.c.id}" data-tipk="char:${n.c.id}"><rect x="-2" y="-2" width="84" height="100" rx="5" fill="${n.c.id === me.id ? '#5a4020' : '#2a1d12'}" stroke="${n.c.id === me.id ? '#f0d488' : '#6a5030'}"/><g transform="translate(14 2) scale(0.52)">${portrait(n.c, 100).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g><text x="40" y="80" text-anchor="middle" font-size="10" fill="#f0e0c0">${esc(n.c.name.slice(0, 14))}</text><text x="40" y="92" text-anchor="middle" font-size="9" fill="#a09070">${n.c.dead ? '✝ ' : ''}${Math.floor(n.c.born / 365)}${n.c.dead ? '–' + Math.floor(n.c.dead / 365) : ''}</text></g>`).join('')}</svg></div>`;
}

// ---------- Decisions ----------
WIN.decisions = () => {
  const me = pc(); const items = [];
  for (const ct of creatableTitles(me)) items.push({ icon: '👑', name: `${ct.usurp ? 'Usurp' : 'Create'} ${titleName(ct.t)}`, desc: `Control ${Math.round(ct.need * 100)}% of its de jure counties (you have ${Math.round(ct.frac * 100)}%).`, cost: `🪙${ct.cost.gold} 👑${ct.cost.prestige}`, ok: ct.ok, act: 'createTitle', a: ct.tid });
  if (rankOf(me) >= 2) items.push({ icon: '🏛', name: 'Hold Court', desc: 'Receive petitioners and visitors in your throne room.', cost: 'Once per year', ok: !me.lastCourt || G.s.day - me.lastCourt >= 365, act: 'holdCourt' });
  const f = faith(me.fai); if (f.reformable && !f.reformed) items.push({ icon: '✨', name: 'Reform the Faith', desc: 'Organize the old gods into a structured faith.', cost: '🙏1000', ok: canReform(me), act: 'reform' });
  for (const k of kidsOf(me).filter(k => k.traits.includes('bastard') && !k.dead)) items.push({ icon: '📯', name: `Legitimize ${k.name}`, desc: 'Make your bastard a true member of your house.', cost: '👑200', ok: me.prestige >= 200, act: 'legit', a: k.id });
  const neigh = [...new Set(realmProvs(me.id).map(p => G.s.provs[p].cul).filter(c => c !== me.cul))];
  if (neigh.length) items.push({ icon: '🎭', name: 'Hybridize Culture', desc: 'Forge a new culture from yours and another.', cost: '👑1000', ok: me.prestige >= 1000, act: 'open', a: 'culture' });
  items.push({ icon: '⚖', name: 'Change Realm Laws', desc: 'Succession, gender and crown authority.', cost: 'Prestige', ok: isRuler(me), act: 'open', a: 'realm' });
  const html = `<div class="list">${items.map(i => `<div class="li"><span style="font-size:24px">${i.icon}</span><div class="grow"><div style="font-family:var(--fh);font-size:14px;color:var(--gold2)">${esc(i.name)}</div><div class="small muted">${esc(i.desc)}</div></div><button class="btn small ${i.ok ? 'primary' : ''}" data-act="${i.act}" data-a="${i.a ?? ''}" ${i.ok ? '' : 'disabled'}>${i.cost}</button></div>`).join('')}</div>`;
  return { title: 'Decisions', html };
};
ACT.legit = id => { if (legitimize(pc(), ch(+id))) renderWindow(); };

// ---------- Lifestyle ----------
WIN.lifestyle = (_, tab) => {
  const me = pc(); const ls = tab || me.focus || 'diplomacy'; const L = LIFESTYLES[ls];
  const owned = me.perks.filter(p => PERK_INDEX[p]?.lifestyle === ls).length;
  const cost = perkCost(Math.min(3, Math.floor(owned / 2)));
  let html = `<div class="row wrap" style="gap:6px">${Object.entries(LIFESTYLES).map(([k, l]) => `<button class="btn small ${me.focus === k ? 'sel' : ''}" data-act="setFocus" data-a="${k}" data-tip="Focus on ${l.name} (based on ${STAT_NAMES[l.stat]})">${l.icon} ${l.name}</button>`).join('')}</div>`;
  html += `<div class="small" style="margin-top:8px">Focus: <b>${me.focus ? LIFESTYLES[me.focus].name : 'none'}</b> · Experience toward next ${L.name} perk: ${fmtNum(me.xp[ls] || 0)} / ${cost}</div>${bar(me.xp[ls] || 0, cost, 'blue')}${me.perkPoints ? `<div class="good small" style="margin-top:6px">✦ You have ${me.perkPoints} perk point${me.perkPoints > 1 ? 's' : ''} to spend!</div>` : ''}`;
  const avail = availablePerks(me, ls);
  html += `<div class="grid2" style="margin-top:12px">${L.trees.map(tr => `<div class="col" style="align-items:center;gap:0"><div style="font-family:var(--fh);color:var(--gold);margin-bottom:6px">${tr.name}</div>${tr.perks.map((p, i) => { const own = me.perks.includes(p.id); const av = avail.includes(p.id) && me.perkPoints > 0; return `${i ? `<div class="perkline ${own ? 'owned' : ''}"></div>` : ''}<div class="perk ${own ? 'owned' : av ? 'avail' : ''}" data-act="${av ? 'perk' : ''}" data-a="${p.id}" data-tip="<h4>${p.name}</h4>${Object.entries(p.mods).map(([k, v]) => `${modName(k)} ${modVal(k, v)}`).join('<br>')}${p.trait ? `<br>Grants trait <b>${TRAITS[p.trait]?.name}</b>` : ''}">${p.name}</div>`; }).join('')}</div>`).join('')}</div>`;
  return { title: `Lifestyle — ${L.icon} ${L.name}`, tabs: Object.entries(LIFESTYLES).map(([k, l]) => [k, l.icon + ' ' + l.name]), html };
};
ACT.setFocus = k => { pc().focus = k; renderWindow(); renderHUD(); };
ACT.perk = id => { const me = pc(); if (!me.perkPoints) return; unlockPerk(me, id); me.perkPoints--; toast({ text: `Perk unlocked: ${PERK_INDEX[id].name}`, icon: '📘', type: 'good' }); renderWindow(); renderHUD(); };

// ---------- Wars ----------
WIN.wars = () => {
  const me = pc(); const mine = warsOf(me.id); const others = G.s.wars.filter(w => !mine.includes(w));
  const wl = w => { const side = sideOf(w, me.id); const ws = side === 'def' ? -w.ws : w.ws; return `<div class="li small" data-act="war" data-a="${w.id}" style="cursor:pointer">${CB[w.cb]?.icon || '⚔'} <span class="grow">${esc(w.name)}<div class="tiny muted">${esc(displayName(ch(w.attLeader)))} vs ${esc(displayName(ch(w.defLeader)))}</div></span><span class="${ws >= 0 ? 'good' : 'bad'}" style="font-family:var(--fh)">${side ? ws + '%' : w.ws + '%'}</span></div>`; };
  let html = sec('Your Wars', mine.length ? `<div class="list">${mine.map(wl).join('')}</div>` : '<div class="muted small">You are at peace. Declare war from a ruler\'s character window.</div>');
  html += sec('Alliances', `<div class="list">${alliesOf(me.id).map(id => `<div class="li small">${ptr(ch(id), 30)} ${charLink(ch(id))}</div>`).join('') || '<span class="muted small">None</span>'}</div>`);
  html += sec('Wars of the World', `<div class="list">${others.slice(0, 40).map(wl).join('') || '<span class="muted small">The world is at peace.</span>'}</div>`);
  return { title: 'Wars', html };
};
WIN.war = id => {
  const w = G.s.wars.find(x => x.id === +id); if (!w) return null;
  const me = pc(); const side = sideOf(w, me.id); const leader = side && (w.attLeader === me.id || w.defLeader === me.id);
  const ws = w.ws; const pos = clamp(ws, -100, 100);
  let html = `<div class="row between"><div class="col" style="align-items:center">${ptr(ch(w.attLeader), 64)}<div class="small">Attacker</div></div><div class="col center grow"><div style="font-family:var(--fh);font-size:15px;color:var(--gold2)">${CB[w.cb]?.icon} ${CB[w.cb]?.name}</div><div class="small">Target: ${titleLink(w.target)}</div><div class="tiny muted">Since ${fmtDate(w.start, true)}</div></div><div class="col" style="align-items:center">${ptr(ch(w.defLeader), 64)}<div class="small">Defender</div></div></div>`;
  html += `<div style="margin:12px 0"><div class="ws-bar"><div class="wsf" style="left:${pos >= 0 ? 50 : 50 + pos / 2}%;width:${Math.abs(pos) / 2}%;background:${pos >= 0 ? '#c04030' : '#3070c0'}"></div><div class="wsm"></div></div><div class="row between small"><span>Attacker</span><b style="font-family:var(--fh)">Warscore ${ws > 0 ? '+' : ''}${ws}%</b><span>Defender</span></div></div>`;
  html += `<div class="kv small"><span class="k">Targets occupied</span><span>${w.occ || 0} / ${w.targetsN || warTargets(w).length}</span><span class="k">Battles</span><span>${sign(w.battle)}</span><span class="k">Ticking</span><span>${sign(w.tick)}</span></div>`;
  html += `<div class="grid2" style="margin-top:10px"><div>${sec('Attackers', pList(w.att.map(ch), 38))}</div><div>${sec('Defenders', pList(w.def.map(ch), 38))}</div></div>`;
  if (leader) {
    const opts = [['white', 'White Peace'], ['demand', 'Demand Surrender'], ['surrender', 'Surrender']];
    html += sec('Negotiate', `<div class="actions">${opts.map(([k, n]) => { const acc = k === 'surrender' ? 100 : peaceAcceptance(w, me.id, k); const enemy = ch(side === 'att' ? w.defLeader : w.attLeader); const llm = enemy?.llm && isLLMActive() && k !== 'surrender'; return `<button class="btn small ${k === 'surrender' ? 'danger' : ''}" data-act="peace" data-a="${w.id}" data-b="${k}" data-tip="${llm ? 'This Sovereign Mind will decide for themselves.' : `Acceptance: ${acc}`}">${n}${llm ? ' ✉' : ` (${acc >= 0 ? '✓' : '✗'})`}</button>`; }).join('')}${ws >= 100 && side === 'att' || ws <= -100 && side === 'def' ? `<button class="btn primary small" data-act="peace" data-a="${w.id}" data-b="enforce">Enforce Demands</button>` : ''}</div>`);
  }
  return { title: esc(w.name), html };
};
ACT.peace = (id, k) => {
  const w = G.s.wars.find(x => x.id === +id); if (!w) return; const me = pc(); const side = sideOf(w, me.id);
  const enemy = ch(side === 'att' ? w.defLeader : w.attLeader);
  if (k === 'surrender') { endWar(w, side === 'att' ? 'def' : 'att', 'Surrendered'); closeWindow(); return; }
  if (k === 'enforce') { endWar(w, side, 'Enforced demands'); closeWindow(); return; }
  if (enemy.llm && isLLMActive()) { openLetterComposer(enemy, { kind: 'peace', war: w.id, terms: k }); return; }
  if (peaceAcceptance(w, me.id, k) >= 0) { endWar(w, k === 'white' ? 'white' : side, 'Negotiated'); closeWindow(); }
  else toast({ text: `${enemy.name} refuses your terms.`, type: 'bad', icon: '✗' });
};

// ---------- Letters ----------
WIN.letters = (arg) => {
  const me = pc(); const L = G.s.letters.filter(l => l.to === me.id || l.from === me.id);
  const people = [...new Set(L.map(l => (l.from === me.id ? l.to : l.from)))].map(ch).filter(Boolean);
  people.sort((a, b) => { const la = Math.max(...L.filter(l => l.from === a.id || l.to === a.id).map(l => l.day)); const lb = Math.max(...L.filter(l => l.from === b.id || l.to === b.id).map(l => l.day)); return lb - la; });
  const sel = arg ? ch(+arg) : people[0];
  let html = `<div class="small muted" style="margin-bottom:8px">Write to any ruler from their character window. ${isLLMActive() ? 'Replies are written by real language models.' : 'Configure OpenRouter for rulers to write back in their own words.'}</div>`;
  html += `<div class="row wrap" style="gap:4px;margin-bottom:10px">${people.map(p => { const unread = L.filter(l => l.from === p.id && !l.read).length; return `<button class="btn small ${sel && p.id === sel.id ? 'sel' : ''}" data-act="letterThread" data-a="${p.id}">${esc(p.name)}${unread ? ` (${unread})` : ''}</button>`; }).join('')}</div>`;
  if (sel) {
    const thread = L.filter(l => l.from === sel.id || l.to === sel.id).slice(-30);
    for (const l of thread) if (l.to === me.id) l.read = true;
    html += `<div class="row" style="margin-bottom:8px">${ptr(sel, 44)}<div class="grow">${charLink(sel, true)}<div class="small">Opinion of you ${opTag(opinion(sel, me))}</div></div><button class="btn small primary" data-act="writeTo" data-a="${sel.id}">✍ Write</button></div>`;
    html += thread.map(l => `<div class="letter ${l.from === me.id ? 'mine' : ''}"><div class="lh">${fmtDate(l.day)} — ${l.from === me.id ? 'You wrote' : esc(displayName(ch(l.from)))}</div>${esc(l.text)}${l.proposal ? `<div style="margin-top:6px;font-family:var(--fh);font-size:12px">📜 Proposal: ${proposalText(l.proposal)} — <b>${l.status || ''}</b></div>${l.status === 'pending' && l.to === me.id ? `<div class="row" style="margin-top:6px"><button class="btn small primary" data-act="answerProp" data-a="${l.id}" data-b="1">Accept</button><button class="btn small danger" data-act="answerProp" data-a="${l.id}" data-b="0">Decline</button></div>` : ''}` : ''}${l.awaiting ? '<div class="small"><span class="spinner"></span> awaiting reply…</div>' : ''}${l.from !== me.id ? '<span class="seal"></span>' : ''}</div>`).join('');
  } else html += '<div class="muted">No correspondence yet.</div>';
  renderHUD();
  return { title: 'Correspondence', html };
};
function proposalText(p) { if (p.kind === 'alliance') return 'Alliance'; if (p.kind === 'marriage') return `Marriage of ${esc(ch(p.mine)?.name || '?')} and ${esc(ch(p.theirs)?.name || '?')}`; if (p.kind === 'peace') return `Peace (${p.terms})`; if (p.kind === 'vassalize') return 'Vassalization'; return p.kind; }
ACT.letterThread = id => openWindow('letters', +id, { noHistory: true });
ACT.writeTo = id => openLetterComposer(ch(+id));
ACT.answerProp = (id, yes) => {
  const l = G.s.letters.find(x => x.id === +id); if (!l) return; const me = pc(); const from = ch(l.from);
  l.status = yes === '1' ? 'accepted' : 'declined';
  import('../engine/llm.js').then(m => {
    if (yes === '1') { const p = { ...l.proposal }; if (p.kind === 'peace') { const w = G.s.wars.find(x => x.id === p.war); if (w) { const side = sideOf(w, from.id); import('../engine/war.js').then(wm => wm.endWar(w, p.terms === 'white' ? 'white' : p.terms === 'surrender' ? (side === 'att' ? 'def' : 'att') : side, 'Negotiated peace')); } } else m.applyProposal(p, from, me); }
    m.sendLetter(me, from, yes === '1' ? 'I accept your proposal.' : 'I must decline.');
    renderWindow();
  });
};

// ---------- Sovereign Minds ----------
WIN.minds = () => {
  const L = G.settings.llm; const minds = G.s.llm.rulers.map(ch).filter(x => x && !x.dead);
  let html = `<div class="small" style="line-height:1.5">Sovereign Minds are rulers controlled by real AI models through <b>OpenRouter</b>. Each one receives a briefing of its realm every ${L.interval} months and decides — in character — whether to wage war, scheme, write letters, build or make alliances. They remember their diaries and your correspondence.</div>`;
  html += `<div class="row" style="margin:10px 0"><span class="chip">${isConfigured() ? `✓ ${esc(L.model)}` : '✗ Not configured'}</span>${LLM.lastError ? `<span class="chip bad" data-tip="${esc(LLM.lastError)}">⚠ error</span>` : ''}<span class="chip">${LLM.calls} calls · ${fmtNum(LLM.tokens)} tokens</span><button class="btn small" data-act="llmSettings">⚙ Settings</button></div>`;
  html += `<div class="actions"><button class="btn small" data-act="mindsPreset" data-a="kings">Grant minds to all kings & emperors</button><button class="btn small" data-act="mindsPreset" data-a="neighbors">…to my neighbors</button><button class="btn small danger" data-act="mindsPreset" data-a="none">Revoke all</button></div>`;
  html += sec(`Minds (${minds.length})`, minds.length ? minds.map(m => { const e = (G.s.llm.diaries[m.id] || []).slice(-1)[0]; return `<div class="li" style="align-items:flex-start">${ptr(m, 46)}<div class="grow"><div>${charLink(m, true)} ${LLM.queue.some(q => q.id === m.id) ? '<span class="spinner"></span>' : ''}</div>${e ? mindEntry(e) : '<div class="muted small">Awaiting first deliberation…</div>'}<div class="tiny muted">Next deliberation: ${m.nextThink ? fmtDate(m.nextThink, true) : 'soon'}</div></div></div>`; }).join('') : '<div class="muted small">No rulers have been granted a Sovereign Mind. Open any ruler\'s character window → Mind tab.</div>');
  const me = pc(); const spy = me && me.councilMembers?.spymaster && ch(me.councilMembers.spymaster);
  const canSpy = spy && ['secrets', 'network'].includes(me.councilTasks?.spymaster);
  const foreign = G.s.letters.filter(l => l.from !== G.s.player && l.to !== G.s.player).slice(-12).reverse();
  html += sec('🕵 Intercepted Correspondence', canSpy ? (foreign.length ? foreign.map(l => `<div class="letter" style="font-size:14px"><div class="lh">${fmtDate(l.day)} — ${esc(displayName(ch(l.from)))} to ${esc(displayName(ch(l.to)))}</div>${esc(l.text)}</div>`).join('') : '<div class="muted small">Your agents have intercepted nothing yet. Sovereign Minds write to one another as they plot.</div>') : '<div class="muted small">Appoint a spymaster and set them to <b>Find Secrets</b> or <b>Spy Network</b> to read the letters that Sovereign Minds send one another.</div>');
  return { title: '🧿 Sovereign Minds', html };
};
ACT.mindsPreset = k => {
  const I = idx(); const me = pc();
  if (!isConfigured() && k !== 'none') { toast({ text: 'Configure OpenRouter first.', type: 'bad' }); return ACT.llmSettings(); }
  if (k === 'none') for (const id of [...G.s.llm.rulers]) setSovereignMind(ch(id), false);
  else {
    const myTop = topOf(me.id);
    const list = k === 'kings' ? I.independent.map(ch).filter(c => rankOf(c) >= 3)
      : I.independent.map(ch).filter(c => c.id !== me.id && realmProvs(c.id).some(p => G.world.provinces[p].neighbors.some(n => I.provTop[n] === myTop)));
    for (const c of list) if (c.id !== me.id) setSovereignMind(c, true);
  }
  renderWindow();
};

// ---------- Chronicle ----------
WIN.chronicle = (_, tab) => {
  tab = tab || 'chronicle';
  let html = '';
  if (tab === 'chronicle') {
    const entries = (G.s.chronicle || []).slice().reverse();
    html += `<div class="row between" style="margin-bottom:8px"><div class="small muted">${G.settings.llm.chronicler && isLLMActive() ? 'The AI chronicler writes an entry each year.' : 'Enable the AI Chronicler in Sovereign Minds settings for illuminated yearly narratives.'}</div><button class="btn primary small" data-act="exportSaga" data-tip="Bind the deeds of every ruler you have played into an illuminated book (HTML file) with portraits, epithets and chronicles.">📜 Export the Saga</button></div>`;
    const line = [...new Set([...(G.s.lineage || []), G.s.player].filter(Boolean))].map(ch).filter(Boolean);
    if (line.length) html += sec('Your Line', `<div class="plist">${line.map(c => `<div class="pi" style="width:84px">${ptr(c, 54)}<span class="pn">${esc(c.name)}${c.regnal ? ' ' + c.regnal : ''}</span><span class="tiny gold">${esc(c.epithet || '')}</span></div>`).join('')}</div>`);
    html += entries.map(e => `<div class="letter" style="font-style:italic"><div class="lh">Anno Domini ${e.year}</div>${esc(e.text)}</div>`).join('');
    const imp = G.s.log.filter(e => ['war', 'death', 'succession', 'title', 'faith', 'culture', 'battle'].includes(e.type) && e.ids?.some(id => id === G.s.player || ch(id)?.dyn === pc()?.dyn)).slice(-40).reverse();
    html += sec('Deeds of the House', `<div class="list">${imp.map(e => `<div class="li small"><span class="muted" style="min-width:86px">${fmtDate(e.day, true)}</span><span>${e.icon || ''} ${esc(e.text)}</span></div>`).join('')}</div>`);
  } else if (tab === 'log') {
    html += `<div class="list">${G.s.log.slice(-150).reverse().map(e => `<div class="li small"><span class="muted" style="min-width:86px">${fmtDate(e.day, true)}</span><span>${e.icon || ''} ${esc(e.text)}</span></div>`).join('')}</div>`;
  } else html += `<div class="timelapse"><canvas id="tlc" width="600" height="510"></canvas><div class="row" style="margin-top:6px"><button class="btn small" data-act="tlPlay">▶ Play</button><input type="range" id="tlr" min="0" max="${Math.max(0, G.s.history.length - 1)}" value="${G.s.history.length - 1}" data-inp="tlSeek" class="grow"><span id="tly" class="gold" style="font-family:var(--fh)"></span></div></div>`;
  if (tab === 'timelapse') setTimeout(() => drawTimelapse(G.s.history.length - 1), 30);
  return { title: 'Chronicle', tabs: [['chronicle', 'Chronicle'], ['log', 'Event Log'], ['timelapse', 'Timelapse']], html, wide: true };
};
let tlGrid = null;
function drawTimelapse(i) {
  const cv = document.getElementById('tlc'); if (!cv) return; const snap = G.s.history[i]; if (!snap) return;
  const W = G.world; const S = 600 / W.W; const h = Math.round(W.H * S); cv.height = h;
  if (!tlGrid) { tlGrid = new Int16Array(600 * h); for (let y = 0; y < h; y++) for (let x = 0; x < 600; x++) tlGrid[y * 600 + x] = W.prov[Math.floor(y / S) * W.W + Math.floor(x / S)]; }
  const ctx = cv.getContext('2d'); const im = ctx.createImageData(600, h);
  const cols = {}; for (const [id, c] of Object.entries(snap.colors)) { const n = parseInt(c.slice(1), 16); cols[id] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  for (let k = 0; k < tlGrid.length; k++) { const p = tlGrid[k]; let r = 30, g = 50, b = 80; if (p === -2) { r = 120; g = 110; b = 90; } else if (p >= 0) { const c = cols[snap.own[p]]; if (c) [r, g, b] = c; else { r = g = b = 100; } } im.data[k * 4] = r; im.data[k * 4 + 1] = g; im.data[k * 4 + 2] = b; im.data[k * 4 + 3] = 255; }
  ctx.putImageData(im, 0, 0);
  const y = document.getElementById('tly'); if (y) y.textContent = Math.floor(snap.day / 365);
}
ACT.tlSeek = v => drawTimelapse(+v);
ACT.tlPlay = () => { let i = 0; const r = document.getElementById('tlr'); const t = setInterval(() => { if (!document.getElementById('tlc') || i >= G.s.history.length) return clearInterval(t); drawTimelapse(i); if (r) r.value = i; i++; }, 220); };

// ---------- Ledger ----------
WIN.ledger = () => {
  const I = idx();
  const realms = I.independent.map(ch).filter(c => realmProvs(c.id).length).sort((a, b) => realmProvs(b.id).length - realmProvs(a.id).length).slice(0, 40);
  const html = `<table class="tbl"><tr><th>#</th><th></th><th>Realm</th><th>Counties</th><th>Strength</th><th>Faith</th></tr>${realms.map((c, i) => `<tr><td>${i + 1}</td><td>${coaHtml(c.primary, 22)}</td><td>${titleLink(c.primary)}<div class="tiny">${charLink(c)}${c.llm ? ' 🧿' : ''}</div></td><td>${realmProvs(c.id).length}</td><td>${fmtNum(realmStrength(c.id))}</td><td>${faith(c.fai).icon}</td></tr>`).join('')}</table>`;
  return { title: '🏆 Ledger of Realms', html };
};
