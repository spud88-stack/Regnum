// Extra UI features: ambitions, the Herald news ticker, battle reports, saga export.
import { G, on } from '../state.js';
import { TRAITS } from '../data/traits.js';
import { ch, T, age, rankOf, displayName, fullName, titleName, dynName, faith, culture, realmProvs, topOf } from '../engine/core.js';
import { AMBITIONS, ambitionOptions, chooseAmbition, ambitionProgress, rewardText } from '../engine/ambitions.js';
import { portrait, dynCoa, titleCoa } from '../render/art.js';
import { focusProv } from '../render/map.js';
import { ACT, modal, closeModal, setHTML, ptr, sound, toast, pc, fanfare, renderHUD } from './ui.js';
import { esc, fmtNum, fmtDate, clamp } from '../util.js';

// ---------- Ambition banner & picker ----------
on('hud', () => {
  const el = document.getElementById('ambition'); if (!el) return;
  const p = ambitionProgress();
  if (!G.s?.player) { setHTML(el, ''); return; }
  if (!p) { setHTML(el, `<button class="amb-btn" data-act="ambitions" data-tip="<h4>Ambitions</h4>Vow to pursue a personal goal. Fulfil it for prestige, renown and other rewards.">🎯 Choose an Ambition</button>`); return; }
  setHTML(el, `<div class="amb" data-act="ambitions" data-tip="<h4>${p.a.icon} ${esc(p.a.name)}</h4>${esc(p.a.desc)}<br>Progress: ${fmtNum(p.v)} / ${fmtNum(p.am.target)}<br>Reward: ${esc(rewardText(p.a.reward))}<br><span class='tt-sub'>Expires ${fmtDate(p.am.until, true)}</span>"><span>${p.a.icon}</span><div class="grow"><div class="amb-n">${esc(p.a.name)}</div><div class="amb-bar"><div style="width:${Math.round(p.frac * 100)}%"></div></div></div><span class="amb-v">${fmtNum(p.v)}/${fmtNum(p.am.target)}</span></div>`);
});
ACT.ambitions = () => {
  const c = pc(); if (!c) return;
  const cur = ambitionProgress();
  const opts = ambitionOptions(c);
  const m = modal(`<div class="dh"><h2>🎯 Ambitions</h2><button class="btn small" data-act="mClose">✕</button></div><div class="db">
    <div class="small muted" style="margin-bottom:10px">A ruler without ambition is soon forgotten. Vow to pursue one goal at a time; fulfil it within twelve years for its reward. Abandoning a vow causes stress. Fulfilled so far: <b>${G.s.ambitionsDone || 0}</b>.</div>
    ${cur ? `<div class="choice sel" style="margin-bottom:10px"><b>${cur.a.icon} Current: ${esc(cur.a.name)}</b> — ${fmtNum(cur.v)}/${fmtNum(cur.am.target)}<div class="bar" style="margin-top:4px"><div style="width:${Math.round(cur.frac * 100)}%"></div></div><button class="btn small danger" style="margin-top:6px" id="ambDrop">Abandon vow</button></div>` : ''}
    <div class="grid2">${opts.map(k => { const a = AMBITIONS[k]; return `<div class="choice ${cur ? 'dis' : ''}" data-amb="${k}"><div style="font-family:var(--fh);color:var(--gold2)">${a.icon} ${esc(a.name)}</div><div class="small">${esc(a.desc)}</div><div class="tiny good" style="margin-top:3px">${esc(rewardText(a.reward))}</div></div>`; }).join('')}</div></div>`, { width: 640 });
  m.querySelectorAll('[data-amb]').forEach(el => el.onclick = () => { if (cur) return; chooseAmbition(c, el.dataset.amb); closeModal(m); sound('fanfare'); toast({ text: `You vow: ${AMBITIONS[el.dataset.amb].name}.`, icon: AMBITIONS[el.dataset.amb].icon, type: 'good' }); renderHUD(); });
  const d = m.querySelector('#ambDrop'); if (d) d.onclick = () => { G.s.ambition = null; c.stress += 15; closeModal(m); renderHUD(); };
};
on('ambitionDone', a => fanfare(`${a.name} — Fulfilled`));

// ---------- The Herald (world news ticker) ----------
const NEWS_TYPES = new Set(['war', 'title', 'succession', 'faith', 'culture', 'death', 'battle', 'diplomacy', 'marriage']);
let lastNewsLen = -1;
on('hud', () => {
  const el = document.getElementById('herald'); if (!el || !G.s) return;
  if (!G.settings.herald) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  if (G.s.log.length === lastNewsLen) return; lastNewsLen = G.s.log.length;
  const me = G.s.player;
  const items = [];
  for (let i = G.s.log.length - 1; i >= 0 && items.length < 10; i--) {
    const e = G.s.log[i]; if (!NEWS_TYPES.has(e.type)) continue;
    if (G.s.day - e.day > 365 * 2) break;
    const important = e.ids?.some(id => rankOf(ch(id)) >= 3) || e.type === 'title' || e.type === 'faith' || e.type === 'culture';
    if (!important) continue;
    items.push(e);
  }
  if (!items.length) { setHTML(el, '<div class="herald-inner"><span class="hn muted">The realm is quiet…</span></div>'); return; }
  const html = items.map(e => `<span class="hn" data-act="${e.ids?.[0] ? 'char' : ''}" data-a="${e.ids?.[0] || ''}"><b>${Math.floor(e.day / 365)}</b> ${e.icon || '📜'} ${esc(e.text)}</span>`).join('<span class="hsep">✦</span>');
  const dur = Math.max(40, items.reduce((s, e) => s + e.text.length, 0) / 9);
  setHTML(el, `<span class="herald-tag">THE HERALD</span><div class="herald-track"><div class="herald-inner" style="animation-duration:${dur}s">${html}<span class="hsep">✦</span>${html}</div></div>`);
});

// ---------- Battle reports ----------
on('battleEnd', d => {
  if (!d.playerIn || !G.s) return;
  const box = document.getElementById('toasts'); if (!box) return;
  const win = d.playerWon;
  const wc = ch(d.wc) || d.winner, lc = ch(d.lc) || d.loser;
  const bar = (n0, n) => `<div class="br-bar"><div class="br-lost" style="width:100%"></div><div class="br-left" style="width:${clamp(n / Math.max(1, n0) * 100, 0, 100)}%"></div></div>`;
  const el = document.createElement('div');
  el.className = `toast battle-report ${win ? 'good' : 'bad'}`;
  el.innerHTML = `<div class="br-stamp ${win ? 'v' : 'd'}">${win ? 'VICTORY' : 'DEFEAT'}</div><div class="br-title">⚔ Battle of ${esc(G.world.provinces[d.prov].name)}</div>
  <div class="br-sides"><div class="br-side"><div class="br-p">${portrait(wc, 44)}</div><div class="br-n">${esc(displayName(d.winner))}</div>${bar(d.menW0, d.menW)}<div class="tiny">${fmtNum(d.menW)} / ${fmtNum(d.menW0)} <span class="bad">−${fmtNum(d.menW0 - d.menW)}</span></div></div>
  <div class="br-vs">vs</div><div class="br-side"><div class="br-p">${portrait(lc, 44)}</div><div class="br-n">${esc(displayName(d.loser))}</div>${bar(d.menL0, d.menL)}<div class="tiny">${fmtNum(d.menL)} / ${fmtNum(d.menL0)} <span class="bad">−${fmtNum(d.menL0 - d.menL)}</span></div></div></div>
  ${d.fates?.length ? `<div class="tiny muted" style="margin-top:4px">${esc(d.fates.join('; '))}</div>` : ''}`;
  el.onclick = () => { focusProv(d.prov, 2); el.remove(); };
  box.prepend(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, 11000);
});

// ---------- Saga export ----------
export function exportSaga() {
  const s = G.s; const me = pc();
  const line = [...new Set([...(s.lineage || []), s.player].filter(Boolean))].map(ch).filter(Boolean);
  if (!line.length) return;
  const d = s.dyns[line[0].dyn];
  const deedTypes = new Set(['war', 'battle', 'title', 'succession', 'ambition', 'marriage', 'faith', 'culture', 'death']);
  const chapter = (c, i) => {
    const from = c.reignStart ?? c.born, to = c.dead || s.day;
    const deeds = s.log.filter(e => e.ids?.includes(c.id) && deedTypes.has(e.type) && e.day >= from - 30 && e.day <= to + 30).slice(0, 18);
    const chron = (s.chronicle || []).filter(e => e.year >= Math.floor(from / 365) && e.year <= Math.floor(to / 365));
    const traits = c.traits.map(t => TRAITS[t]).filter(t => t && ['personality', 'lifestyle', 'fame', 'congenital'].includes(t.cat)).map(t => t.name).join(', ');
    return `<section class="ch"><div class="num">${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][i] || i + 1}</div><div class="head"><div class="p">${portrait(c, 150)}</div><div><h2>${esc(fullName(c))}</h2><div class="meta">${Math.floor(c.born / 365)} – ${c.dead ? Math.floor(c.dead / 365) : '…'} · reigned ${Math.max(0, Math.round((to - from) / 365))} years · ${esc(culture(c.cul).name)}, ${esc(faith(c.fai).name)}</div><div class="traits">${esc(traits)}</div>${c.dead ? `<div class="meta">Died ${esc(c.cause || '')} at the age of ${age(c)}.</div>` : '<div class="meta">Reigns still.</div>'}</div></div>
    ${chron.map(e => `<p class="chron"><b>Anno Domini ${e.year}.</b> ${esc(e.text)}</p>`).join('')}
    <ul>${deeds.map(e => `<li><span>${fmtDate(e.day)}</span> ${esc(e.text)}</li>`).join('') || '<li>Of this reign little was written.</li>'}</ul></section>`;
  };
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>The Saga of House ${esc(d?.name || '')}</title><link href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@600&family=EB+Garamond:ital@0;1&display=swap" rel="stylesheet"><style>
body{margin:0;background:#2a1d12;font-family:'EB Garamond',Georgia,serif;color:#2a1a0a}
.book{max-width:860px;margin:40px auto;background:linear-gradient(#f3e6c8,#e4d0a4);padding:60px 70px;box-shadow:0 20px 60px #000;border:3px double #6a4a20}
.title{text-align:center;padding:40px 0 30px;border-bottom:3px double #6a4a20}.title h1{font-family:'Cinzel Decorative',serif;font-size:46px;color:#7a1a10;margin:10px 0}.title .sub{font-family:Cinzel,serif;letter-spacing:4px;color:#6a4a2a}
.ch{padding:30px 0;border-bottom:1px solid #b09060;position:relative}.num{position:absolute;right:0;top:20px;font-family:'Cinzel Decorative',serif;font-size:42px;color:#c9a24a55}
.head{display:flex;gap:24px;align-items:flex-start}.p svg{border:3px solid #8a6a2a;border-radius:6px}h2{font-family:Cinzel,serif;color:#5a1a10;margin:0 0 6px}
.meta{color:#6a4a2a;font-style:italic}.traits{margin:6px 0}.chron{font-style:italic;font-size:18px;line-height:1.6}.chron::first-letter{font-family:'Cinzel Decorative',serif;font-size:34px;color:#7a1a10}
ul{list-style:none;padding:0;font-size:17px;line-height:1.5}li span{display:inline-block;min-width:160px;color:#7a5a3a;font-size:14px}
.foot{text-align:center;margin-top:30px;font-family:Cinzel,serif;color:#6a4a2a;font-size:13px;letter-spacing:2px}</style></head><body><div class="book">
<div class="title">${dynCoa(line[0].dyn, 110)}<h1>The Saga of House ${esc(d?.name || dynName(line[0]))}</h1><div class="sub">${line.length} generation${line.length > 1 ? 's' : ''} · ${Math.floor((s.startDay) / 365)} – ${Math.floor(s.day / 365)} A.D.</div>${d ? `<p style="margin-top:14px">Renown ${fmtNum(d.renown)} · ${Object.entries(d.legacies || {}).map(([k, v]) => `${k} ${'★'.repeat(v)}`).join(' · ')}</p>` : ''}</div>
${line.map(chapter).join('')}<div class="foot">Written in the ${Math.floor(s.day / 365 / 100) + 1}th century · Regnum: Chronicles of Crowns</div></div></body></html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `Saga-of-House-${(d?.name || 'Unknown').replace(/[^\w]+/g, '_')}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast({ text: 'Your house\'s saga has been bound and saved.', icon: '📜', type: 'good' });
}
ACT.exportSaga = () => exportSaga();
