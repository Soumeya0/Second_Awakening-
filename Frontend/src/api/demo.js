// Judge demo: the same player, as if they had reached Rank S. Built fresh each time the demo starts,
// kept under its own storage key so the real save is never touched.
import { CATEGORIES } from './data.js';
import { today, todaysQuests } from './game.js';

export const DEMO_LEVEL = 52;

export function showcasePlayer(real = {}) {
  const now = new Date();
  const daysAgo = (n) => { const d = new Date(now); d.setDate(d.getDate() - n); return today(d); };

  // 150 days of history: a 100-day perfect streak, with a few partial days before it so the calendar looks lived-in.
  const history = {};
  for (let n = 1; n <= 150; n++) history[daysAgo(n)] = n > 100 && n % 13 === 0 ? 'p' : 'd';

  const chosen = real.chosen?.length >= 10 ? real.chosen : CATEGORIES.slice(0, 10).map((c) => c.id);
  const fill = [7, 9, 6, 8, 10, 5, 9, 7, 8, 6];

  const p = {
    name: real.name || 'Player', look: real.look, answers: real.answers || {},
    onboarded: true, demo: true,
    level: DEMO_LEVEL, xp: 640, coins: 4820, questsDone: 612,
    chosen, bars: Object.fromEntries(chosen.map((id, k) => [id, fill[k % fill.length]])),
    materials: { 'Iron ore': 148, 'Spirit herb': 173, 'Mana crystal': 161, 'Oath token': 139, 'Beast core': 122, 'Rune stone': 61, 'Gate key': 24, 'Shadow essence': 118, 'Demon fang': 12, 'Monarch sigil': 6 },
    stats: { VITALS: 150, FOCUS: 165, PHOTO: 170, HONOR: 128 },
    items: { freeze: 2, shield: 1, outfit: 1, growth: 3, haste: 2, fortune: 2, revival: 1 }, buffs: {},
    history, started: daysAgo(150), lastCheck: today(), rift: null,
    day: { date: today(), status: {}, cleared: false }
  };
  // Two of today's quests already done, so the quest list shows progress.
  todaysQuests(p).slice(0, 2).forEach((q) => { p.day.status[q.id] = 'done'; });
  return p;
}
