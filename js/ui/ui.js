// UI infrastructure: actions, tooltips, toasts, HUD, window manager, sound.
import { G, on, emit } from '../state.js';
import { TRAITS, LIFESTYLES, PERK_INDEX, COUNCIL } from '../data/traits.js';
import { ch, T, idx, age, rankOf, primary, displayName, fullName, titleName, faith, culture, stat, STATS, STAT_NAMES, STAT_ICONS, opinion, opinionBreakdown, prestigeLevel, PRESTIGE_LEVELS, pietyLevel, PIETY_LEVELS, domainOf, domainLimit, realmProvs, isRuler, dynName, mods, relationTo, grandeur, grandeurLevel } from '../engine/core.js';
import { income, levyMax } from '../engine/economy.js';
import { warsOf, sideOf, armyPower, realmStrength } from '../engine/war.js';
import { creatableTitles } from '../engine/decisions.js';
import { availablePerks } from '../engine/economy.js';
import { LLM, isLLMActive } from '../engine/llm.js';
import { portrait, coa, titleCoa, dynCoa } from '../render/art.js';
import { STYLES, MODES, focusProv, focusOn, setSelectedProv, renderer, zoomBy } from '../render/map.js';
import { esc, fmtNum, fmtDate, sign, clamp, roman } from '../util.js';
import { TERRAIN } from '../data/geography.js';
import { SPEEDS } from '../engine/sim.js';

export const ACT = {};
export const TIP = {};
const $ = s => document.querySelector(s);

// ---------- Helpers ----------
export function ptr(c, size = 56, opts = {}) {
  if (!c) return '';
  const r = rankOf(c);
  return `<span class="ptr r${r} ${c.dead ? 'dead' : ''}" data-act="char" data-a="${c.id}" data-tipk="char:${c.id}" style="width:${size}px;height:${Math.round(size * 1.2)}px">${portrait(c, size)}${opts.badge !== false && c.primary ? `<span class="ptr-coa">${titleCoa(c.primary, Math.max(14, size / 4))}</span>` : ''}${c.dead ? '<span class="ptr-badge">✝</span>' : opts.age ? `<span class="ptr-badge">${age(c)}</span>` : ''}</span>`;
}
export function coaHtml(tid, size = 30) { return `<span class="coa" data-act="title" data-a="${tid}" data-tipk="title:${tid}">${titleCoa(tid, size)}</span>`; }
export function charLink(c, full = false) { if (!c) return '<span class="muted">nobody</span>'; return `<span class="link" data-act="char" data-a="${c.id}" data-tipk="char:${c.id}">${esc(full ? fullName(c) : displayName(c))}</span>`; }
export function titleLink(tid) { const t = T(tid); if (!t) return ''; return `<span class="link" data-act="title" data-a="${tid}" data-tipk="title:${tid}">${esc(titleName(t))}</span>`; }
export function provLink(pid) { const p = G.world.provinces[pid]; return `<span class="link" data-act="prov" data-a="${pid}" data-tipk="prov:${pid}">${esc(p.name)}</span>`; }
export function traitIcon(t) { const tr = TRAITS[t]; if (!tr) return ''; return `<span class="trait ${tr.cat}" data-tipk="trait:${t}">${tr.icon}</span>`; }
export function opTag(v) { const col = v >= 50 ? '#8ccc6a' : v >= 0 ? '#d8d0a0' : v > -50 ? '#e0a050' : '#e0604c'; return `<span class="op" style="color:${col}">${v > 0 ? '+' : ''}${Math.round(v)}</span>`; }
export function bar(v, max = 1, cls = '') { return `<div class="bar ${cls}"><div style="width:${clamp(v / max * 100, 0, 100)}%"></div></div>`; }
export const pc = () => ch(G.s?.player);
// Only touch the DOM when content actually changed (prevents flicker and restarted animations).
const htmlCache = new WeakMap();
export function setHTML(el, html) { if (!el) return; if (htmlCache.get(el) === html) return; htmlCache.set(el, html); el.innerHTML = html; }

// ---------- Delegated events ----------
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACT[el.dataset.act];
  if (fn) { e.stopPropagation(); sound('click'); fn(el.dataset.a, el.dataset.b, el, e); }
});
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el && ACT[el.dataset.chg]) ACT[el.dataset.chg](el.value, el.dataset.a, el); });
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el && ACT[el.dataset.inp]) ACT[el.dataset.inp](el.value, el.dataset.a, el); });

// ---------- Tooltips ----------
const tipEl = () => $('#tooltip');
let tipTarget = null;
document.addEventListener('mouseover', e => {
  const el = e.target.closest('[data-tip],[data-tipk]');
  if (!el) { if (tipTarget) hideTip(); return; }
  if (el === tipTarget) return;
  tipTarget = el;
  let html = el.dataset.tip || '';
  if (el.dataset.tipk) { const [k, ...args] = el.dataset.tipk.split(':'); try { html = TIP[k]?.(...args) || html; } catch (err) { console.warn(err); } }
  if (!html) return hideTip();
  showTip(html, e.clientX, e.clientY);
});
document.addEventListener('mousemove', e => { if (tipEl().classList.contains('on') && tipTarget) placeTip(e.clientX, e.clientY); });
export function showTip(html, x, y) { const t = tipEl(); t.innerHTML = html; t.classList.add('on'); placeTip(x, y); }
export function hideTip() { tipTarget = null; tipEl().classList.remove('on'); }
function placeTip(x, y) { const t = tipEl(); const r = t.getBoundingClientRect(); let nx = x + 16, ny = y + 16; if (nx + r.width > innerWidth - 8) nx = x - r.width - 12; if (ny + r.height > innerHeight - 8) ny = y - r.height - 12; t.style.left = nx + 'px'; t.style.top = ny + 'px'; }

TIP.trait = t => { const tr = TRAITS[t]; if (!tr) return ''; const st = Object.entries(tr.stats || {}).map(([k, v]) => `<div class="tt-line"><span>${STAT_ICONS[k] || ''} ${STAT_NAMES[k] || k}</span><span class="${v > 0 ? 'good' : 'bad'}">${sign(v)}</span></div>`).join(''); const md = Object.entries(tr.mods || {}).map(([k, v]) => `<div class="tt-line"><span>${modName(k)}</span><span class="${(v > 0) !== badMod(k) ? 'good' : 'bad'}">${modVal(k, v)}</span></div>`).join(''); return `<h4>${tr.icon} ${tr.name}</h4><div class="tt-sub">${capital(tr.cat)} trait</div>${tr.desc ? `<div style="margin:4px 0">${tr.desc}</div>` : ''}${st}${md}${tr.opp?.length ? `<div class="tt-sub">Opposite: ${tr.opp.map(o => TRAITS[o]?.name).join(', ')}</div>` : ''}`; };
TIP.char = id => { const c = ch(+id); if (!c) return ''; const me = pc(); const rel = me ? relationTo(me, c) : ''; return `<div class="row" style="align-items:flex-start"><div>${portrait(c, 56)}</div><div><h4>${esc(fullName(c))}</h4><div class="tt-sub">${c.dead ? `Died ${fmtDate(c.dead, true)}` : `Age ${age(c)}`} · ${culture(c.cul).name} · ${faith(c.fai).icon} ${faith(c.fai).name}</div>${rel ? `<div class="gold">${rel}</div>` : ''}<div class="row" style="gap:6px;margin-top:4px">${STATS.map(s => `<span>${STAT_ICONS[s]}${stat(c, s)}</span>`).join('')}</div><div style="margin-top:3px">${c.traits.slice(0, 8).map(t => TRAITS[t]?.icon).join(' ')}</div>${me && me.id !== c.id && !c.dead ? `<div class="tt-sub" style="margin-top:4px">Opinion of you: ${opTag(opinion(c, me))}</div>` : ''}${c.llm ? '<div style="color:#c0a0ff">🧿 Sovereign Mind</div>' : ''}</div></div>`; };
TIP.title = tid => { const t = T(tid); if (!t) return ''; const h = ch(t.holder); return `<div class="row">${titleCoa(tid, 40)}<div><h4>${esc(titleName(t))}</h4><div class="tt-sub">${['', 'County', 'Duchy', 'Kingdom', 'Empire'][t.rank]} tier${t.parent ? ` · de jure ${esc(T(t.parent)?.name || '')}` : ''}</div><div>Holder: ${h ? esc(displayName(h)) : '<i>none</i>'}</div>${t.counties?.length > 1 ? `<div class="tt-sub">${t.counties.length} de jure counties</div>` : ''}</div></div>`; };
TIP.prov = pid => provTip(+pid);
export function provTip(pid) {
  const W = G.world, s = G.s, I = idx(); const p = W.provinces[pid], sp = s.provs[pid]; if (!p) return '';
  const h = ch(I.provOwner[pid]), top = ch(I.provTop[pid]);
  return `<h4>${esc(p.name)}</h4><div class="tt-sub">${TERRAIN[p.terrain].name} · ${esc(T(p.duchy).name)}, ${esc(T(p.kingdom).name)}</div>
  <div class="tt-line"><span>Holder</span><span>${h ? esc(displayName(h)) : '—'}</span></div>${top && top !== h ? `<div class="tt-line"><span>Realm</span><span>${esc(titleName(T(top.primary)))}</span></div>` : ''}
  <div class="tt-line"><span>Culture</span><span>${culture(sp.cul).name}</span></div><div class="tt-line"><span>Faith</span><span>${faith(sp.fai).icon} ${faith(sp.fai).name}</span></div>
  <div class="tt-line"><span>Development</span><span>${sp.dev.toFixed(1)}</span></div>${sp.wonders?.length ? `<div class="gold">✦ ${sp.wonders.join(', ')}</div>` : ''}${sp.ctrl ? `<div class="bad">Occupied by ${esc(displayName(ch(sp.ctrl)))}</div>` : ''}${sp.siege ? `<div class="bad">Under siege: ${Math.round(sp.siege * 100)}%</div>` : ''}`;
}
TIP.opinion = (a, b) => { const A = ch(+a), B = ch(+b); if (!A || !B) return ''; const br = opinionBreakdown(A, B); return `<h4>${esc(A.name)}'s opinion of ${esc(B.name)}: ${opTag(opinion(A, B))}</h4>${br.map(([v, r]) => `<div class="tt-line"><span>${esc(r)}</span><span class="${v >= 0 ? 'good' : 'bad'}">${sign(v)}</span></div>`).join('') || '<div class="tt-sub">No strong feelings</div>'}`; };
TIP.gold = () => { const c = pc(); const i = c.lastIncome || income(c); return `<h4>🪙 Treasury: ${fmtNum(c.gold)}</h4><div class="tt-line"><span>Domain taxes</span><span class="good">+${i.domain.toFixed(1)}</span></div><div class="tt-line"><span>Vassal taxes</span><span class="good">+${i.fromVassals.toFixed(1)}</span></div>${i.toLiege ? `<div class="tt-line"><span>Paid to liege</span><span class="bad">-${i.toLiege.toFixed(1)}</span></div>` : ''}<div class="tt-line"><span>Men-at-arms</span><span class="bad">-${i.maa.toFixed(1)}</span></div><div class="tt-line"><span>Raised armies</span><span class="bad">-${i.armies.toFixed(1)}</span></div><div class="tt-line"><span>Court amenities</span><span class="bad">-${i.court.toFixed(1)}</span></div>${i.merc ? `<div class="tt-line"><span>Mercenaries</span><span class="bad">-${i.merc.toFixed(1)}</span></div>` : ''}<div class="sep"></div><div class="tt-line"><b>Monthly</b><b class="${i.net >= 0 ? 'good' : 'bad'}">${sign(+i.net.toFixed(1))}</b></div>`; };
TIP.prestige = () => { const c = pc(); const l = prestigeLevel(c); return `<h4>👑 Prestige: ${fmtNum(c.prestige)}</h4><div>Level ${l}: <b>${PRESTIGE_LEVELS[l]}</b></div><div class="tt-sub">Earned through victories, titles and grand deeds. Spent on casus belli, laws and decisions.</div>`; };
TIP.piety = () => { const c = pc(); const l = pietyLevel(c); return `<h4>🙏 Piety: ${fmtNum(c.piety)}</h4><div>Level ${l}: <b>${PIETY_LEVELS[l]}</b></div><div class="tt-sub">Earned through faith. Spent on holy wars, conversion and reformation.</div>`; };
TIP.levies = () => { const c = pc(); const l = levyMax(c); return `<h4>⚔ Military</h4><div class="tt-line"><span>Levies ready</span><span>${fmtNum(c.levyCur || 0)}</span></div><div class="tt-line"><span>From domain</span><span>${fmtNum(l.own)}</span></div><div class="tt-line"><span>From vassals</span><span>${fmtNum(l.fromV)}</span></div><div class="tt-line"><span>Total strength</span><span>${fmtNum(realmStrength(c.id))}</span></div>`; };
function capital(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }
const MODN = { opinion: 'General opinion', vassalOpinion: 'Vassal opinion', dynastyOpinion: 'House opinion', prestigeGain: 'Monthly prestige', pietyGain: 'Monthly piety', taxMult: 'Tax income', levyMult: 'Levy size', fertility: 'Fertility', health: 'Health', stressGain: 'Stress gain', stressLoss: 'Stress loss', schemePower: 'Scheme power', schemeDef: 'Scheme resistance', dread: 'Dread', advantage: 'Battle advantage', domain: 'Domain limit', buildCost: 'Building cost', lifestyleXp: 'Lifestyle experience', seduce: 'Seduction', knightEff: 'Knight effectiveness', maaUpkeep: 'Men-at-arms upkeep', siegeSpeed: 'Siege speed', moveSpeed: 'Movement speed', devGrowth: 'Development growth', marriageAccept: 'Marriage acceptance', allianceAccept: 'Alliance acceptance', conversion: 'Conversion speed', raidSpeed: 'Raid speed', clergyOpinion: 'Clergy opinion', fort: 'Fort level', grandeur: 'Grandeur', taxFlat: 'Monthly gold' };
export const modName = k => MODN[k] || STAT_NAMES[k] || k;
const badMod = k => ['stressGain', 'buildCost', 'maaUpkeep'].includes(k);
export const modVal = (k, v) => ['taxMult', 'levyMult', 'fertility', 'schemePower', 'schemeDef', 'buildCost', 'lifestyleXp', 'knightEff', 'maaUpkeep', 'siegeSpeed', 'moveSpeed', 'stressGain', 'stressLoss', 'seduce', 'conversion', 'raidSpeed', 'devGrowth'].includes(k) ? `${v > 0 ? '+' : ''}${Math.round(v * 100)}%` : sign(v);

// ---------- Sound (procedural WebAudio) ----------
let actx = null;
export function sound(kind) {
  if (!G.settings?.sound) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime; const vol = G.settings.volume ?? 0.4;
    const tone = (f, d, type = 'sine', v = 0.2, delay = 0) => { const o = actx.createOscillator(), g = actx.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t + delay); g.gain.linearRampToValueAtTime(v * vol, t + delay + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + delay + d); o.connect(g); g.connect(actx.destination); o.start(t + delay); o.stop(t + delay + d + 0.05); };
    switch (kind) {
      case 'click': tone(880, 0.05, 'triangle', 0.05); break;
      case 'open': tone(520, 0.12, 'triangle', 0.08); tone(780, 0.15, 'triangle', 0.06, 0.05); break;
      case 'event': tone(392, 0.6, 'triangle', 0.12); tone(523, 0.6, 'triangle', 0.1, 0.12); tone(659, 0.9, 'triangle', 0.1, 0.24); break;
      case 'war': case 'battle': tone(110, 0.8, 'sawtooth', 0.12); tone(146, 0.8, 'sawtooth', 0.1, 0.2); tone(110, 1.0, 'sawtooth', 0.12, 0.45); break;
      case 'victory': case 'fanfare': [523, 659, 784, 1046].forEach((f, k) => tone(f, 0.5, 'triangle', 0.12, k * 0.12)); break;
      case 'defeat': [392, 349, 311, 262].forEach((f, k) => tone(f, 0.6, 'sine', 0.1, k * 0.18)); break;
      case 'death': tone(196, 2.2, 'sine', 0.15); tone(147, 2.4, 'sine', 0.12, 0.05); break;
      case 'birth': [659, 784, 988].forEach((f, k) => tone(f, 0.4, 'sine', 0.08, k * 0.1)); break;
      case 'letter': tone(1046, 0.2, 'sine', 0.07); tone(1318, 0.3, 'sine', 0.06, 0.1); break;
      case 'alert': tone(330, 0.25, 'triangle', 0.06); tone(262, 0.35, 'triangle', 0.05, 0.12); break;
      default: tone(660, 0.1, 'triangle', 0.06);
    }
  } catch (e) { /* audio unavailable */ }
}

// ---------- Toasts ----------
on('notify', n => toast(n));
export function toast(n) {
  const box = $('#toasts'); if (!box || !G.s) return;
  const el = document.createElement('div');
  el.className = `toast ${n.type || 'info'}`;
  el.innerHTML = `<span class="ti">${n.icon || '📜'}</span><span>${esc(n.text)}</span>`;
  el.onclick = () => { if (n.prov !== undefined) focusProv(n.prov, 2); if (n.ids?.length) openWindow('char', n.ids[0]); if (n.title) openWindow('title', n.title); if (n.action) openWindow(n.action); el.remove(); };
  box.prepend(el);
  while (box.children.length > 6) box.lastChild.remove();
  if (n.sound) sound(n.sound);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, n.important ? 11000 : 6500);
}
export function fanfare(text) { const d = document.createElement('div'); d.className = 'fanfare'; d.innerHTML = `<div class="fx-text">${esc(text)}</div>`; document.body.appendChild(d); sound('fanfare'); setTimeout(() => d.remove(), 3300); }

// ---------- Window manager ----------
export const WIN = {}; // kind -> render(arg) => {title, html, wide, head}
const win = { kind: null, arg: null, tab: null, history: [] };
export function openWindow(kind, arg, opts = {}) {
  if (!WIN[kind]) return;
  if (win.kind && !opts.noHistory && !(win.kind === kind && win.arg === arg)) win.history.push([win.kind, win.arg, win.tab]);
  if (win.history.length > 30) win.history.shift();
  win.kind = kind; win.arg = arg; win.tab = opts.tab || null;
  if (kind === 'prov') setSelectedProv(+arg); else if (kind !== 'army') setSelectedProv(-1);
  renderWindow(); sound('open');
  document.querySelectorAll('.navbtn').forEach(b => b.classList.toggle('active', b.dataset.a === kind));
}
export function closeWindow() { win.kind = null; win.history = []; const p = $('#panel'); p.classList.remove('open'); setSelectedProv(-1); document.querySelectorAll('.navbtn').forEach(b => b.classList.remove('active')); }
export function setTab(t) { win.tab = t; renderWindow(); }
export const currentTab = () => win.tab;
export const currentWindow = () => win;
export function renderWindow() {
  const p = $('#panel'); if (!win.kind || !G.s) return;
  let r;
  try { r = WIN[win.kind](win.arg, win.tab); } catch (e) { console.error(e); r = { title: 'Error', html: `<pre class="small bad">${esc(e.stack || e.message)}</pre>` }; }
  if (!r) { closeWindow(); return; }
  const scroll = p.querySelector('.win-body')?.scrollTop || 0;
  p.className = 'window open' + (r.wide ? ' wide' : '');
  const html = `<div class="win-head">${win.history.length ? '<button class="x" data-act="winBack" data-tip="Back">‹</button>' : ''}${r.head || ''}<h2>${r.title}</h2><button class="x" data-act="winClose" data-tip="Close (Esc)">✕</button></div>${r.tabs ? `<div class="win-tabs">${r.tabs.map(([k, n]) => `<button class="${(win.tab || r.tabs[0][0]) === k ? 'on' : ''}" data-act="winTab" data-a="${k}">${n}</button>`).join('')}</div>` : ''}<div class="win-body">${r.html}</div>`;
  if (p.__html === html) return; p.__html = html; p.innerHTML = html;
  const body = p.querySelector('.win-body'); if (body) body.scrollTop = scroll;
}
ACT.winClose = () => closeWindow();
ACT.winBack = () => { const h = win.history.pop(); if (h) { win.kind = h[0]; win.arg = h[1]; win.tab = h[2]; renderWindow(); } };
ACT.winTab = t => setTab(t);
ACT.char = id => openWindow('char', +id);
ACT.title = tid => openWindow('title', tid);
ACT.prov = pid => { openWindow('prov', +pid); focusProv(+pid); };
ACT.open = k => (win.kind === k ? closeWindow() : openWindow(k));
ACT.focusProv = pid => focusProv(+pid, 2.2);

// ---------- Modals ----------
export function modal(html, opts = {}) {
  const root = $('#modal-root');
  const back = document.createElement('div'); back.className = 'modal-back';
  back.innerHTML = `<div class="modal ${opts.cls || 'frame dialog'}" style="${opts.width ? `width:${opts.width}px` : ''}">${html}</div>`;
  if (!opts.noClose) back.addEventListener('mousedown', e => { if (e.target === back) closeModal(back); });
  root.appendChild(back);
  return back;
}
export function closeModal(el) { if (el) el.remove(); else $('#modal-root').lastElementChild?.remove(); emit('modalClosed'); }
export const modalOpen = () => $('#modal-root').children.length > 0;
export function confirmBox(title, text, onYes, yes = 'Confirm') {
  const m = modal(`<div class="dh"><h2>${title}</h2></div><div class="db">${text}</div><div class="df"><button class="btn" data-act="mClose">Cancel</button><button class="btn primary" id="cfYes">${yes}</button></div>`);
  m.querySelector('#cfYes').onclick = () => { closeModal(m); onYes(); };
}
ACT.mClose = () => closeModal();

// ---------- HUD ----------
const NAV = [['realm', '🏰', 'Realm'], ['military', '⚔', 'Military'], ['council', '🗝', 'Council'], ['court', '🏛', 'Royal Court'], ['intrigue', '🕸', 'Intrigue'], ['faith', '✝', 'Faith'], ['culture', '🎭', 'Culture'], ['dynasty', '🌳', 'Dynasty'], ['decisions', '📜', 'Decisions'], ['lifestyle', '📘', 'Lifestyle'], ['wars', '🛡', 'Wars'], ['letters', '✉', 'Correspondence'], ['minds', '🧿', 'Sovereign Minds'], ['chronicle', '📖', 'Chronicle'], ['ledger', '🏆', 'Ledger']];
export function renderHUD() {
  const c = pc(); if (!c || !G.s) return;
  const inc = c.lastIncome || income(c);
  const d = G.s.dyns[c.dyn];
  setHTML($('#playerbox'), `<div class="pb-portrait">${ptr(c, 104, { badge: false })}${c.primary ? `<span class="pb-coa">${coaHtml(c.primary, 44)}</span>` : ''}</div>
  <div><div class="pb-name">${esc(fullName(c))}${c.regnal ? '' : ''}</div>
  <div class="resbar">
    <div class="res" data-tipk="gold"><span class="ri">🪙</span><span class="rv">${fmtNum(c.gold)}</span><span class="rd ${inc.net >= 0 ? 'good' : 'bad'}">${sign(+inc.net.toFixed(1))}</span></div>
    <div class="res" data-tipk="prestige"><span class="ri">👑</span><span class="rv">${fmtNum(c.prestige)}</span><span class="rd muted">${PRESTIGE_LEVELS[prestigeLevel(c)]}</span></div>
    <div class="res" data-tipk="piety"><span class="ri">🙏</span><span class="rv">${fmtNum(c.piety)}</span><span class="rd muted">${PIETY_LEVELS[pietyLevel(c)]}</span></div>
    <div class="res" data-tip="<h4>🌟 House Renown</h4>Your dynasty's renown, spent on legacies."><span class="ri">🌟</span><span class="rv">${fmtNum(d?.renown || 0)}</span><span class="rd muted">Renown</span></div>
    <div class="res" data-tipk="levies"><span class="ri">⚔</span><span class="rv">${fmtNum(c.levyCur || 0)}</span><span class="rd muted">Levies</span></div>
    <div class="res" data-tip="<h4>🏰 Domain</h4>Counties you hold personally vs your domain limit. Exceeding it reduces taxes and angers vassals."><span class="ri">🏰</span><span class="rv ${domainOf(c.id).length > domainLimit(c) ? 'bad' : ''}">${domainOf(c.id).length}/${domainLimit(c)}</span><span class="rd muted">Domain</span></div>
    <div class="res" data-tip="<h4>😰 Stress ${Math.round(c.stress)}</h4>At 100 stress you will suffer a mental break."><span class="ri">${c.stress > 66 ? '😫' : c.stress > 33 ? '😟' : '🙂'}</span><span class="rv">${Math.round(c.stress)}</span><div class="stressbar"><div style="width:${clamp(c.stress, 0, 100)}%"></div></div></div>
  </div></div>`);
  renderAlerts(c);
  const unread = G.s.letters.filter(l => l.to === c.id && !l.read).length;
  setHTML($('#nav'), NAV.map(([k, i, n]) => `<button class="navbtn ${win.kind === k ? 'active' : ''}" data-act="open" data-a="${k}" data-tip="<h4>${n}</h4>">${i}${k === 'letters' && unread ? `<span class="nb">${unread}</span>` : ''}${k === 'lifestyle' && c.perkPoints ? `<span class="nb">${c.perkPoints}</span>` : ''}${k === 'wars' && warsOf(c.id).length ? `<span class="nb">${warsOf(c.id).length}</span>` : ''}</button>`).join(''));
  renderTime();
  renderModes();
  renderOutliner(c);
  emit('hud');
  const th = $('#thinking'); if (LLM.active > 0) { th.classList.add('on'); th.innerHTML = `<span class="spinner"></span>${LLM.active} sovereign mind${LLM.active > 1 ? 's' : ''} deliberating…`; } else th.classList.remove('on');
}
let lastAlertSig = '', lastAlertKeys = new Set();
function renderAlerts(c) {
  const al = [];
  if (c.perkPoints) al.push(['good', '📘', 'Perk available — open Lifestyle', 'lifestyle']);
  if (!c.focus) al.push(['info', '🎯', 'Choose a lifestyle focus', 'lifestyle']);
  const ct = creatableTitles(c).filter(x => x.ok); if (ct.length) al.push(['good', '👑', `You can ${ct[0].usurp ? 'usurp' : 'create'} ${titleName(ct[0].t)}`, 'decisions']);
  const unread = G.s.letters.filter(l => l.to === c.id && !l.read).length; if (unread) al.push(['info', '✉', `${unread} unread letter${unread > 1 ? 's' : ''}`, 'letters']);
  const pending = G.s.letters.filter(l => l.to === c.id && l.proposal && l.status === 'pending'); if (pending.length) al.push(['bad', '📨', `${pending.length} proposal${pending.length > 1 ? 's' : ''} await your answer`, 'letters']);
  if (rankOf(c) >= 2 && Object.values(c.councilMembers || {}).some(v => !v)) al.push(['bad', '🗝', 'Council position vacant', 'council']);
  if (domainOf(c.id).length > domainLimit(c)) al.push(['bad', '🏰', 'Over domain limit — grant counties to vassals', 'realm']);
  if (c.gold < 0) al.push(['bad', '💸', 'In debt!', 'realm']);
  if (c.faction) al.push(['bad', '🔥', `Discontented vassals: faction power ${c.faction.power}%`, 'realm']);
  if (!c.spouse && age(c) >= 16 && c.gov !== 'theocracy') al.push(['info', '💍', 'You are unmarried — arrange a marriage from another character\'s window', 'char:' + c.id]);
  const unwed = (c.kids || []).map(ch).filter(k => k && !k.dead && !k.spouse && age(k) >= 16 && k.court === c.id);
  if (unwed.length) al.push(['info', '👰', `${unwed.length} of your adult children ${unwed.length > 1 ? 'are' : 'is'} unmarried — secure your line`, 'char:' + unwed[0].id]);
  for (const w of warsOf(c.id)) al.push([((sideOf(w, c.id) === 'att' ? w.ws : -w.ws) >= 0 ? 'good' : 'bad'), '⚔', `${w.name}: ${(sideOf(w, c.id) === 'att' ? w.ws : -w.ws)}%`, 'war:' + w.id]);
  const list = al.slice(0, 9); const key = x => x[1] + '|' + x[3];
  const sig = list.map(x => key(x) + x[0] + x[2]).join('#');
  if (sig === lastAlertSig) return;
  const box = $('#alerts'); const nodes = [...box.children];
  if (nodes.length === list.length && list.every((x, i) => nodes[i].dataset.k === key(x))) {
    list.forEach((x, i) => { const n = nodes[i]; n.dataset.tip = x[2]; n.classList.toggle('good', x[0] === 'good'); n.classList.toggle('bad', x[0] === 'bad'); n.classList.toggle('info', x[0] === 'info'); n.classList.remove('new'); });
    lastAlertSig = sig; return;
  }
  const newOnes = list.filter(x => !lastAlertKeys.has(key(x)));
  lastAlertSig = sig; lastAlertKeys = new Set(list.map(key));
  $('#alerts').innerHTML = list.map(x => { const [cls, i, t, a] = x; const urgent = cls === 'bad' && /proposal|debt|faction/i.test(t); return `<div class="alert ${cls}${newOnes.includes(x) ? ' new' : ''}${urgent ? ' urgent' : ''}" data-k="${esc(key(x))}" data-tip="${esc(t)}" data-act="alert" data-a="${a}">${i}</div>`; }).join('');
  if (newOnes.length && lastAlertKeys.size) for (const x of newOnes) if (x[0] === 'bad') { sound('alert'); break; }
}
ACT.alert = a => { const [k, v] = a.split(':'); openWindow(k, v !== undefined ? (isNaN(+v) ? v : +v) : undefined); };
export function renderTime() {
  const s = G.s; const paused = G.speed === 0;
  setHTML($('#timebox'), `<div class="timeinner ${paused ? 'paused' : ''}"><button class="btn icon small" data-act="zoomOut" data-tip="Zoom out">−</button><button class="btn icon small" data-act="zoomIn" data-tip="Zoom in">+</button><span class="datestr" data-act="togglePause" data-tip="Space: pause/unpause · 1-5: speed">${paused ? '⏸ ' : ''}${fmtDate(s.day)}</span><div class="spd">${[1, 2, 3, 4, 5].map(k => `<span class="${G.speed >= k || (!G.speed && G.lastSpeed >= k) ? 'on' : ''}" data-act="speed" data-a="${k}" data-tip="Speed ${k}"></span>`).join('')}</div><button class="btn icon small" data-act="menu" data-tip="Game menu (Esc)">☰</button></div>`);
}
function renderModes() {
  const m = G.settings.mapMode;
  setHTML($('#mapmodes'), Object.entries(MODES).map(([k, v]) => `<button class="mm ${m === k ? 'on' : ''}" data-act="mapMode" data-a="${k}" data-tip="<h4>${v.name} map mode</h4>Hotkey: ${v.key}">${v.icon}</button>`).join('') + `<button class="mm style" data-act="styleMenu" data-tip="<h4>Map style</h4>${STYLES[G.settings.mapStyle].desc}">${STYLES[G.settings.mapStyle].icon} ${STYLES[G.settings.mapStyle].name}</button>`);
}
function renderOutliner(c) {
  const s = G.s; const parts = [];
  const myArmies = s.armies.filter(a => a.owner === c.id);
  if (myArmies.length) parts.push(`<div class="ol-sec"><h4>Armies <span>${myArmies.length}</span></h4>${myArmies.map(a => `<div class="ol-item" data-act="selArmy" data-a="${a.id}">⚔ ${fmtNum(a.men + Object.values(a.maa).reduce((x, y) => x + y, 0))} <span class="muted small">${a.battle ? '⚔ in battle' : a.path.length ? '→ ' + esc(G.world.provinces[a.path[a.path.length - 1]].name) : esc(G.world.provinces[a.loc].name)}</span>${a.raid ? ' 🔥' : ''}</div>`).join('')}</div>`);
  const wars = warsOf(c.id);
  if (wars.length) parts.push(`<div class="ol-sec"><h4>Wars</h4>${wars.map(w => { const ws = sideOf(w, c.id) === 'att' ? w.ws : -w.ws; return `<div class="ol-item" data-act="war" data-a="${w.id}">🛡 ${esc(w.name)}<span class="ws ${ws >= 0 ? 'good' : 'bad'}">${ws}%</span></div>`; }).join('')}</div>`);
  const sch = s.schemes.filter(x => x.owner === c.id);
  if (sch.length) parts.push(`<div class="ol-sec"><h4>Schemes</h4>${sch.map(x => `<div class="ol-item" data-act="open" data-a="intrigue">🕸 ${esc(ch(x.target)?.name || '')} <span class="ws">${Math.round(x.prog)}%</span></div>`).join('')}</div>`);
  const acts = s.activities.filter(a => a.owner === c.id);
  if (acts.length) parts.push(`<div class="ol-sec"><h4>Activities</h4>${acts.map(a => `<div class="ol-item">🎪 ${a.type} <span class="ws">${Math.max(0, a.end - s.day)}d</span></div>`).join('')}</div>`);
  const minds = s.llm.rulers.map(ch).filter(x => x && !x.dead).slice(0, 6);
  if (minds.length) parts.push(`<div class="ol-sec"><h4 data-act="open" data-a="minds">🧿 Sovereign Minds</h4>${minds.map(m => { const last = (s.llm.diaries[m.id] || []).slice(-1)[0]; return `<div class="ol-item" data-act="char" data-a="${m.id}" data-tip="${last ? esc('“' + last.diary + '”') : 'Has not yet spoken.'}">${esc(displayName(m))}${LLM.queue.some(q => q.id === m.id) ? ' <span class="spinner"></span>' : ''}</div>`; }).join('')}</div>`);
  const worldWars = s.wars.filter(w => !wars.includes(w) && (rankOf(ch(w.attLeader)) >= 3 || rankOf(ch(w.defLeader)) >= 3)).slice(0, 5);
  if (worldWars.length) parts.push(`<div class="ol-sec"><h4>Great Wars</h4>${worldWars.map(w => `<div class="ol-item small" data-act="war" data-a="${w.id}">${w.cb === 'crusade' ? '✠' : '⚔'} ${esc(w.name)}</div>`).join('')}</div>`);
  setHTML($('#outliner'), parts.join(''));
}
ACT.war = id => openWindow('war', +id);
ACT.zoomIn = () => zoomBy(1.4); ACT.zoomOut = () => zoomBy(1 / 1.4);
ACT.mapMode = m => { G.settings.mapMode = m; G.mapDirty = true; renderModes(); import('../state.js').then(s => s.saveSettings()); };
