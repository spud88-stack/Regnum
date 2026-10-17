// Simulation clock: daily, monthly and yearly processing.
import { G, emit } from '../state.js';
import { ch, idx, opinion, rankOf, isPlayer, invalidateMods, log } from './core.js';
import { dailyArmies, aiArmies, monthlyWars } from './war.js';
import { monthlyEconomy, monthlyInnovations, monthlyLifestyle } from './economy.js';
import { monthlyLife, yearlyLife } from './life.js';
import { monthlySchemes, monthlyCouncil, yearlyFactions } from './intrigue.js';
import { monthlyAI } from './ai.js';
import { rollEvents, dailyActivities, stressBreak } from './events.js';
import { yearlyDecisions } from './decisions.js';
import { monthlyLLM, chronicleYear } from './llm.js';
import { snapshot } from './setup.js';
import { monthlyAmbition } from './ambitions.js';
import { dayToDate } from '../util.js';
import { on } from '../state.js';

on('stressBreak', c => stressBreak(c));

export const SPEEDS = [0, 1.2, 3, 7, 16, 40]; // days per second

export function tickDay() {
  const s = G.s;
  s.day++;
  dailyArmies();
  dailyActivities();
  if (s.day % 3 === 0) aiArmies();
  const { d, m } = dayToDate(s.day);
  if (d === 1) monthly(m);
  emit('day');
}

function monthly(m) {
  const s = G.s; const I = idx();
  // cache vassal opinions of lieges (used by levy contributions)
  G.opinionCache = new Map();
  for (const id of I.rulers) { const c = ch(id); if (c.liege) G.opinionCache.set(id, opinion(c, ch(c.liege))); }
  invalidateMods();
  monthlyEconomy();
  monthlyLife();
  monthlyWars();
  monthlySchemes();
  monthlyCouncil();
  monthlyInnovations();
  for (const id of idx().rulers) monthlyLifestyle(ch(id));
  const pc = ch(s.player); if (pc && !pc.dead && !idx().rulers.includes(pc.id)) monthlyLifestyle(pc);
  monthlyAI();
  rollEvents();
  monthlyLLM();
  monthlyAmbition();
  // tyranny & dread decay
  for (const id of idx().rulers) { const c = ch(id); if (c.tyranny) c.tyranny = Math.max(0, c.tyranny - 0.5); if (c.dreadBase) c.dreadBase = Math.max(0, c.dreadBase - 0.3); }
  s.truces = s.truces.filter(t => t.until > s.day);
  if (m === 12 || m === 1 || m === 3) G.mapDirty = true;
  if (m === 1) yearly();
  G.mapDirty = true;
  emit('month');
}

function yearly() {
  const s = G.s;
  yearlyLife();
  yearlyFactions();
  yearlyDecisions();
  s.history.push(snapshot());
  if (s.history.length > 1200) s.history.shift();
  chronicleYear(Math.floor(s.day / 365) - 1);
  emit('year');
}
