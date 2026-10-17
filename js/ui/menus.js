// Main menu & start-date selection.
import { G, emit, saveSettings } from '../state.js';
import { allBookmarks, newGame } from '../engine/setup.js';
import { ch, T, idx, age, rankOf, displayName, fullName, titleName, faith, culture, stat, STATS, STAT_ICONS, realmProvs, topOf, dynName } from '../engine/core.js';
import { realmStrength } from '../engine/war.js';
import { isConfigured, setSovereignMind } from '../engine/llm.js';
import { listSaves, loadSave } from '../engine/save.js';
import { portrait, titleCoa } from '../render/art.js';
import { recolor, focusProv, fitView, setSelectedProv, STYLES, renderer } from '../render/map.js';
import { modal, closeModal, toast, sound, traitIcon, ACT } from './ui.js';
import { openLoadDialog, openSettings, openLLMSettings, openStyleMenu, openHelp } from './dialogs.js';
import { esc, fmtNum } from '../util.js';

const root = () => document.getElementById('screen-root');
export function showMenu() {
  G.mode = 'menu';
  document.getElementById('hud').classList.add('hidden');
  root().innerHTML = `<div class="menu"><div class="embers">${Array.from({ length: 26 }, (_, i) => `<span class="ember" style="left:${Math.random() * 100}%;animation-duration:${6 + Math.random() * 10}s;animation-delay:${Math.random() * 10}s"></span>`).join('')}</div><div class="menu-inner"><div class="menu-title">REGNUM</div><div class="menu-sub">Chronicles of Crowns</div>
  <button class="menu-btn" id="mNew">New Game</button><button class="menu-btn" id="mCont" disabled>Continue</button><button class="menu-btn" id="mLoad">Load Game</button><button class="menu-btn" id="mMinds">Sovereign Minds</button><button class="menu-btn" id="mHelp">How to Play</button><button class="menu-btn" id="mSet">Settings</button><button class="menu-btn" id="mAbout">About</button></div>
  <div class="menu-foot">Nine start dates from 476 to 1453 · Six map styles · True AI rulers via OpenRouter</div></div>`;
  document.getElementById('mNew').onclick = () => { sound('open'); showBookmarks(); };
  document.getElementById('mLoad').onclick = () => openLoadDialog();
  document.getElementById('mSet').onclick = () => openSettings();
  document.getElementById('mHelp').onclick = () => openHelp();
  document.getElementById('mMinds').onclick = () => openLLMSettings();
  document.getElementById('mAbout').onclick = () => modal(`<div class="dh"><h2>About Regnum</h2><button class="btn small" data-act="mClose">✕</button></div><div class="db" style="line-height:1.55"><p><b>Regnum: Chronicles of Crowns</b> is a dynasty-driven grand strategy game of the medieval Old World.</p><p>Rule a realm across generations: marry, scheme, wage holy wars, hold court and tournaments, forge legacies, reform faiths and birth new cultures. When you die, you play as your heir.</p><p><b>The twist:</b> any ruler may be granted a <b>Sovereign Mind</b> — a real large language model (via OpenRouter) that reads its situation, keeps a diary, writes you letters, and decides war and peace for itself.</p><p class="small muted">Inspired by the grand strategy tradition. All art is procedurally generated.</p></div>`, { width: 520 });
  listSaves().then(s => { const b = document.getElementById('mCont'); if (b && s.length) { b.disabled = false; b.onclick = async () => { await loadSave(s[0].name); emit('loaded'); }; } }).catch(() => {});
}

// ---------- Start date selection ----------
let bmSel = null, charSel = null, mindsMode = 'featured';
export function showBookmarks() {
  G.mode = 'bookmark';
  const bms = allBookmarks();
  bmSel = bmSel || bms.find(b => b.id === '1066');
  renderBM();
  selectBookmark(bmSel.id);
}
function renderBM() {
  const bms = allBookmarks();
  root().innerHTML = `<div class="bm-screen"><div class="bm-left"><h2 style="margin-bottom:12px">Choose an Age</h2>${bms.map(b => `<div class="bm-card ${b.id === bmSel.id ? 'sel' : ''}" data-bm="${b.id}" style="background:linear-gradient(120deg, ${b.sky[0]}cc, ${b.sky[1]}55)"><div class="yr">${b.shattered ? '???' : b.year}</div><div class="nm">${esc(b.name)}</div></div>`).join('')}<div class="sep"></div><button class="btn" id="bmBack">‹ Main Menu</button></div><div class="bm-mid"></div><div class="bm-right" id="bmRight"></div></div><div class="bm-top"><div class="t1">${esc(bmSel.name)}</div><div class="t2">${bmSel.shattered ? 'An alternate world' : `Anno Domini ${bmSel.year}`}</div></div><button class="btn primary bm-play" id="bmPlay" style="font-size:18px;padding:12px 28px">▶ Play</button>`;
  root().querySelectorAll('[data-bm]').forEach(el => el.onclick = () => { sound('click'); selectBookmark(el.dataset.bm); });
  document.getElementById('bmBack').onclick = () => { emit('toMenu'); };
  document.getElementById('bmPlay').onclick = () => startGame();
  renderRight();
}
function selectBookmark(id) {
  bmSel = allBookmarks().find(b => b.id === id);
  charSel = null;
  document.getElementById('load-text').textContent = 'Crowning the kings of ' + bmSel.name + '…';
  newGame(id, 1000 + Math.floor(Math.random() * 1e6));
  const feat = Object.values(G.s.chars).filter(c => c.featured && !c.dead);
  charSel = feat[0] || null;
  recolor(true); fitView();
  renderBM();
  if (charSel?.capital !== null && charSel?.capital !== undefined) focusProv(charSel.capital, 1.1);
}
function renderRight() {
  const el = document.getElementById('bmRight'); if (!el || !G.s) return;
  const feat = Object.values(G.s.chars).filter(c => c.featured && !c.dead);
  const c = charSel;
  el.innerHTML = `<div class="bm-desc">${esc(bmSel.desc)}</div><div class="sep orn">✦</div><h3 style="margin-bottom:8px">Featured Rulers</h3>${feat.map(f => `<div class="feat ${c && f.id === c.id ? 'sel' : ''}" data-c="${f.id}"><div style="line-height:0">${portrait(f, 54)}</div><div><div class="fn">${esc(displayName(f))}</div><div class="tiny muted">${esc(titleName(T(f.primary)))}</div><div class="fb">${esc(f.featured)}</div></div></div>`).join('') || '<div class="muted small">No featured rulers — click any realm on the map.</div>'}
  <div class="small muted" style="margin:8px 0">…or click anywhere on the map to play as any ruler, from emperor to humble count.</div>
  ${c ? `<div class="sep orn">✦</div><div class="frame" style="padding:10px"><div class="row" style="gap:10px;align-items:flex-start"><div style="line-height:0">${portrait(c, 80)}</div><div class="col" style="gap:2px"><div style="font-family:var(--fh);color:var(--gold2)">${esc(fullName(c))}</div><div class="tiny muted">Age ${age(c)} · ${culture(c.cul).name} · ${faith(c.fai).icon} ${faith(c.fai).name}</div><div class="small">${realmProvs(c.id).length} counties · ⚔ ${fmtNum(realmStrength(c.id))}</div>${c.liege ? `<div class="small">Vassal of <span class="link" id="bmLiege">${esc(displayName(ch(c.liege)))}</span></div>` : ''}<div class="row small" style="gap:6px">${STATS.map(s => `${STAT_ICONS[s]}${stat(c, s)}`).join(' ')}</div><div class="traits" style="margin-top:3px">${c.traits.map(traitIcon).join('')}</div></div></div></div>` : ''}
  <div class="sep orn">✦</div><h3>🧿 Sovereign Minds</h3><div class="small muted" style="margin:4px 0 6px">Which rulers should be driven by real AI models?${isConfigured() ? ` Using <b>${esc(G.settings.llm.model)}</b>.` : ' <span class="bad">OpenRouter not configured.</span>'}</div>
  <div class="col">${[['none', 'None — classic AI only'], ['featured', 'Featured rulers'], ['kings', 'All kings & emperors'], ['rivals', 'Featured + all my neighbors']].map(([k, n]) => `<label class="row small"><input type="radio" name="mm" value="${k}" ${mindsMode === k ? 'checked' : ''}> ${n}</label>`).join('')}</div><button class="btn small" id="bmLLM" style="margin-top:6px">⚙ Configure OpenRouter</button>
  <div class="sep orn">✦</div><button class="btn small" id="bmStyle">🎨 Map style: ${STYLES[G.settings.mapStyle].name}</button>`;
  el.querySelectorAll('[data-c]').forEach(x => x.onclick = () => { charSel = ch(+x.dataset.c); sound('click'); renderRight(); if (charSel.capital !== null) focusProv(charSel.capital, 1.4); });
  el.querySelectorAll('input[name=mm]').forEach(x => x.onchange = () => { mindsMode = x.value; });
  const lg = document.getElementById('bmLiege'); if (lg) lg.onclick = () => { charSel = ch(c.liege); renderRight(); };
  document.getElementById('bmLLM').onclick = () => openLLMSettings().then(() => {});
  document.getElementById('bmStyle').onclick = () => openStyleMenu();
}
export function bookmarkProvClick(pid) {
  if (pid < 0) return;
  const h = ch(idx().provOwner[pid]); if (!h) return;
  charSel = h; setSelectedProv(pid); sound('click'); renderRight();
}
function startGame() {
  if (!charSel) { toast({ text: 'Choose a ruler first.', type: 'bad' }); return; }
  const s = G.s; s.player = charSel.id; charSel.reignStart = s.day; s.lineage = [charSel.id];
  if (charSel.llm) setSovereignMind(charSel, false);
  if (mindsMode !== 'none') {
    if (!isConfigured()) toast({ text: 'Sovereign Minds need an OpenRouter key — rulers will use classic AI until configured.', type: 'bad', icon: '🧿', important: true });
    const I = idx(); let list = [];
    const feat = Object.values(s.chars).filter(c => c.featured && !c.dead && c.id !== charSel.id);
    if (mindsMode === 'featured') list = feat;
    if (mindsMode === 'kings') list = I.independent.map(ch).filter(c => rankOf(c) >= 3);
    if (mindsMode === 'rivals') { const myTop = topOf(charSel.id); list = [...feat, ...I.independent.map(ch).filter(c => realmProvs(c.id).some(p => G.world.provinces[p].neighbors.some(n => I.provTop[n] === myTop)))]; }
    for (const c of new Set(list)) if (c.id !== charSel.id && c.titles.length) setSovereignMind(c, true);
  }
  emit('startGame');
}
