// Shapes a user into the player object the frontend already reads (frontend/src/api/player.jsx).
import * as progressDb from '../db/progress.js';
import * as questsDb from '../db/quests.js';
import * as eventsDb from '../db/events.js';
import { addDays } from '../utils/dates.js';
import { dayResult, rankOf, streak } from './rules.js';

// The game state rules.js works on, as plain data.
export function playerState(user, bars) {
  return {
    level: user.level, xp: user.xp, coins: user.coins, chosen: user.chosen, bars: { ...bars },
    materials: { ...user.materials }, stats: { ...user.stats }, items: { ...user.items }, questsDone: user.questsDone,
  };
}

export async function userView(user) {
  const [bars, quests, closed] = await Promise.all([
    progressDb.getBars(user.id),
    questsDb.listForDay(user.id, user.gameDate),
    eventsDb.history(user.id, addDays(user.gameDate, -400), user.gameDate),
  ]);

  // Today is still open: its history entry comes from the quests, like the frontend does.
  const history = { ...closed };
  const todayResult = dayResult(quests);
  if (todayResult !== 'missed') history[user.gameDate] = todayResult === 'cleared' ? 'd' : 'p';

  const status = {};
  for (const q of quests) {
    if (q.status === 'completed') status[q.category] = 'done';
    else if (q.status === 'active') status[q.category] = new Date(q.startedAt).getTime();
  }

  return {
    name: user.name, look: user.look, answers: user.answers, onboarded: user.onboarded,
    level: user.level, xp: user.xp, rank: rankOf(user.level), coins: user.coins,
    chosen: user.chosen, bars, materials: user.materials, stats: user.stats, items: user.items,
    questsDone: user.questsDone, started: user.started, lastCheck: user.gameDate,
    history,
    streak: streak(history, { today: user.gameDate, started: user.started, freezes: user.items.freeze || 0 }),
    day: { date: user.gameDate, status, cleared: todayResult === 'cleared', extra: user.extraToday },
    rift: user.rift,
    gateWonToday: user.gateWonOn === user.gameDate,
  };
}
