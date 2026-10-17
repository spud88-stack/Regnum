// Save/load to IndexedDB (with file export/import).
import { G, markDirty } from '../state.js';
import { seedRng, rngState, fmtDate } from '../util.js';
import { invalidateMods, ch, displayName } from './core.js';

const DB = 'regnum-saves', STORE = 'saves';
function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode); const st = t.objectStore(STORE); const r = fn(st); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); }

export function serialize() {
  const s = { ...G.s, eventQueue: [], rng: rngState() };
  return JSON.stringify(s);
}
export async function saveGame(name) {
  const data = serialize();
  const pc = ch(G.s.player);
  const meta = { name: name || `${displayName(pc)} — ${fmtDate(G.s.day)}`, day: G.s.day, player: pc ? displayName(pc) : '', bookmark: G.s.bookmark, saved: Date.now(), size: data.length };
  await tx('readwrite', st => st.put({ meta, data }, meta.name));
  return meta;
}
export async function listSaves() {
  const d = await db();
  return new Promise((res) => { const out = []; const t = d.transaction(STORE, 'readonly'); const c = t.objectStore(STORE).openCursor(); c.onsuccess = () => { const cur = c.result; if (cur) { out.push(cur.value.meta); cur.continue(); } else res(out.sort((a, b) => b.saved - a.saved)); }; c.onerror = () => res([]); });
}
export async function loadSave(name) { const rec = await tx('readonly', st => st.get(name)); if (!rec) throw new Error('Save not found'); return restore(rec.data); }
export async function deleteSave(name) { await tx('readwrite', st => st.delete(name)); }
export function restore(json) {
  const s = JSON.parse(json);
  s.eventQueue = []; s.letters = s.letters || []; s.llm = s.llm || { rulers: [], diaries: {} }; s.flags = s.flags || {};
  for (const l of s.letters) l.awaiting = false;
  G.s = s; seedRng(s.rng || 1); markDirty(); invalidateMods();
  return s;
}
export function exportFile() {
  const blob = new Blob([serialize()], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `regnum-${G.s.bookmark}-${fmtDate(G.s.day, true).replace(/ /g, '_')}.json`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
