// Global game holder + event bus.
export const G = {
  s: null,          // serializable game state
  world: null,      // generated map raster + static province data
  idx: null,        // derived indices (rebuilt when dirty)
  dirty: true,
  mapDirty: true,   // map needs recoloring
  speed: 0,         // 0 = paused, 1..5
  lastSpeed: 2,
  selected: null,   // {type:'prov'|'char'|'army', id}
  ui: {},
  render: null,
  settings: null,   // persisted user settings (map style, llm)
};

const listeners = {};
export function on(evt, fn) { (listeners[evt] ||= []).push(fn); }
export function emit(evt, data) { (listeners[evt] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(evt, e); } }); }

export function markDirty() { G.dirty = true; G.mapDirty = true; }

const SETTINGS_KEY = 'regnum.settings.v1';
export function loadSettings() {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { s = {}; }
  G.settings = Object.assign({
    mapStyle: 'parchment', mapMode: 'realm', sound: true, volume: 0.4, music: true, musicVolume: 0.35, herald: true, labels: true, seasons: true, eventPause: true,
    llm: { apiKey: '', model: '', temperature: 0.8, interval: 6, revealThoughts: true, chronicler: false, pauseWhileThinking: false, maxConcurrent: 2 },
  }, s);
  G.settings.llm = Object.assign({ apiKey: '', model: '', temperature: 0.8, interval: 6, revealThoughts: true, chronicler: false, pauseWhileThinking: false, maxConcurrent: 2 }, s.llm || {});
  return G.settings;
}
export function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings)); } catch (e) { /* storage blocked */ } }
