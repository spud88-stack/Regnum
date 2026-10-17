// Bootstrap and main loop.
import { G, on, emit, loadSettings } from './state.js';
import { buildWorld, findPath } from './world.js';
import { newGame } from './engine/setup.js';
import { tickDay, SPEEDS } from './engine/sim.js';
import { ch, T, idx, displayName, titleName } from './engine/core.js';
import { moveArmy, armyPower, warsOf } from './engine/war.js';
import { LLM } from './engine/llm.js';
import { initMap, frame, recolor, renderer, focusProv, fitView, setSelectedProv, MODES } from './render/map.js';
import { ACT, renderHUD, renderTime, renderWindow, openWindow, closeWindow, showTip, hideTip, provTip, modalOpen, closeModal, fanfare, toast, sound, currentWindow } from './ui/ui.js';
import './ui/windows.js';
import './ui/extras.js';
import { setMood, refreshMusic } from './ui/music.js';
import { renderArmyPanel, openGameMenu, showNextEvent } from './ui/dialogs.js';
import { showMenu, showBookmarks, bookmarkProvClick } from './ui/menus.js';
import { esc, fmtNum } from './util.js';

window.G = G; // debug handle
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function boot() {
  loadSettings();
  const fill = document.getElementById('load-fill'), txt = document.getElementById('load-text');
  await sleep(50);
  G.world = buildWorld((p, t) => { fill.style.width = (p * 80) + '%'; txt.textContent = t + '…'; });
  txt.textContent = 'Crowning kings…'; fill.style.width = '90%'; await sleep(20);
  newGame('1066', 4242);
  initMap(document.getElementById('map'));
  recolor(true);
  fill.style.width = '100%';
  await sleep(250);
  const ld = document.getElementById('loading'); ld.classList.add('done'); setTimeout(() => { ld.style.display = 'none'; }, 900);
  showMenu();
  requestAnimationFrame(loop);
}

// ---------- Loop ----------
let lastMood = 0, last = performance.now(), acc = 0, lastHud = 0, lastWin = 0, lastDay = -1;
function loop(now) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (G.mode === 'menu') { renderer.target.x += dt * 9; if (renderer.target.x > G.world.W - renderer.w / renderer.target.z) renderer.target.x = 0; }
  if (G.mode === 'game' && G.s) {
    const blocked = (G.settings.eventPause && G.s.eventQueue?.length) || (G.settings.llm.pauseWhileThinking && LLM.active > 0);
    if (G.speed > 0 && !blocked) {
      acc += dt * SPEEDS[G.speed]; let n = 0;
      while (acc >= 1 && n < 12) { try { tickDay(); } catch (e) { console.error('tick error', e); } acc -= 1; n++; }
      if (acc > 4) acc = 0;
    }
    if (G.s.day !== lastDay && now - lastHud > 220) { lastHud = now; lastDay = G.s.day; renderHUD(); renderArmyPanel(); }
    if (now - lastWin > 1200 && !document.activeElement?.matches('input,textarea,select')) { lastWin = now; const w = currentWindow(); if (w.kind && !['letters', 'chronicle', 'dynasty'].includes(w.kind) && G.speed > 0) renderWindow(); }
    if (G.s.eventQueue?.length) showNextEvent();
  }
  if (now - lastMood > 2000) { lastMood = now; setMood(G.mode === 'game' && G.s?.player ? (warsOf(G.s.player).length ? 'war' : 'peace') : 'menu'); }
  try { frame(); } catch (e) { console.error('frame', e); }
  requestAnimationFrame(loop);
}

// ---------- Mode transitions ----------
on('startGame', () => enterGame(true));
on('loaded', () => { recolor(true); enterGame(false); });
on('toMenu', () => { closeWindow(); G.selected = null; renderArmyPanel(); document.querySelectorAll('.modal-back').forEach(m => m.remove()); newGame('1066', 4242); recolor(true); fitView(); showMenu(); });
function enterGame(fresh) {
  G.mode = 'game'; G.speed = 0; G.observer = false;
  document.getElementById('screen-root').innerHTML = '';
  document.getElementById('modal-root').innerHTML = '';
  document.getElementById('hud').classList.remove('hidden');
  setSelectedProv(-1);
  const pc = ch(G.s.player);
  renderHUD();
  if (pc?.capital !== null && pc?.capital !== undefined) focusProv(pc.capital, 1.6);
  if (fresh && pc) { fanfare(`${displayName(pc)}`); setTimeout(() => toast({ text: 'The game is paused. Press Space (or click the date) to let time flow. Right-click with an army selected to march.', icon: '⏳', important: true }), 1500); openWindow('char', pc.id); }
}

// ---------- Map interaction ----------
on('provClick', pid => {
  if (G.mode === 'bookmark') return bookmarkProvClick(pid);
  if (G.mode !== 'game') return;
  if (G.selected?.type === 'army') { G.selected = null; renderArmyPanel(); }
  if (pid >= 0) openWindow('prov', pid); else closeWindow();
});
on('armyClick', a => {
  if (G.mode !== 'game') return;
  G.selected = { type: 'army', id: a.id }; sound('click'); renderArmyPanel();
});
on('provRightClick', pid => {
  if (G.mode !== 'game' || pid < 0) return;
  const a = G.selected?.type === 'army' ? G.s.armies.find(x => x.id === G.selected.id) : null;
  if (a && a.owner === G.s.player) {
    if (moveArmy(a, pid)) { sound('click'); renderArmyPanel(); } else toast({ text: 'No path for the army.', type: 'bad' });
    return;
  }
  const h = ch(idx().provOwner[pid]); if (h) openWindow('char', h.id);
});
on('mapHover', ({ pid, x, y, army }) => {
  if (G.mode !== 'game' && G.mode !== 'bookmark') return hideTip();
  if (army) { const o = ch(army.owner); return showTip(`<h4>⚔ Army of ${esc(displayName(o))}</h4><div class="tt-line"><span>Men</span><span>${fmtNum(army.men + Object.values(army.maa).reduce((a, b) => a + b, 0))}</span></div><div class="tt-line"><span>Power</span><span>${fmtNum(armyPower(army))}</span></div>${army.raid ? '<div class="bad">Raiding</div>' : ''}`, x, y); }
  if (pid >= 0) { showTip(provTip(pid), x, y); const a = G.selected?.type === 'army' ? G.s.armies.find(q => q.id === G.selected.id) : null; if (a && a.owner === G.s.player && pid !== a.loc) { const path = findPath(G.world, a.loc, pid); renderer.pathPreview = path ? [[G.world.provinces[a.loc].hx, G.world.provinces[a.loc].hy], ...path.map(p => [G.world.provinces[p].hx, G.world.provinces[p].hy])] : null; } else renderer.pathPreview = null; }
  else { hideTip(); renderer.pathPreview = null; }
});

// ---------- Time controls & hotkeys ----------
ACT.togglePause = () => togglePause();
ACT.speed = k => { G.speed = +k; G.lastSpeed = +k; renderTime(); };
function togglePause() { if (G.speed) { G.lastSpeed = G.speed; G.speed = 0; } else G.speed = G.lastSpeed || 2; renderTime(); }
window.addEventListener('keydown', e => {
  if (document.activeElement?.matches('input,textarea,select')) return;
  if (G.mode !== 'game') { if (e.key === 'Escape' && modalOpen()) closeModal(); return; }
  if (e.key === ' ') { e.preventDefault(); togglePause(); }
  else if (/^[1-5]$/.test(e.key)) { G.speed = +e.key; G.lastSpeed = G.speed; renderTime(); }
  else if (e.key === '+' || e.key === '=') { G.speed = Math.min(5, (G.speed || G.lastSpeed) + 1); G.lastSpeed = G.speed; renderTime(); }
  else if (e.key === '-') { G.speed = Math.max(1, (G.speed || G.lastSpeed) - 1); G.lastSpeed = G.speed; renderTime(); }
  else if (e.key === 'Escape') { if (document.querySelector('.event')) return; if (modalOpen()) closeModal(); else if (G.selected) { G.selected = null; renderArmyPanel(); } else if (currentWindow().kind) closeWindow(); else openGameMenu(); }
  else if (!e.ctrlKey && !e.metaKey) {
    const k = e.key.toUpperCase(); const m = Object.entries(MODES).find(([, v]) => v.key === k);
    if (m && !'WASD'.includes(k)) ACT.mapMode(m[0]);
    if (k === 'F5') e.preventDefault();
  }
});

boot().catch(e => { console.error(e); document.getElementById('load-text').textContent = 'Failed to load: ' + e.message; });
