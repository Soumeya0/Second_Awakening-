// Closes out a user's game day: 4 required quests done -> cleared; otherwise banished to the Rift.
// Used by the midnight cron job and by POST /api/demo/next-day. Each day closes in one transaction.
import { withTransaction } from '../db/pool.js';
import * as usersDb from '../db/users.js';
import * as questsDb from '../db/quests.js';
import * as progressDb from '../db/progress.js';
import * as eventsDb from '../db/events.js';
import { dayResult, sendToRift } from './rules.js';
import { playerState } from './userView.js';
import { ensureQuestsForDay } from '../services/quests.js';
import { createChapter } from '../services/story.js';
import { addDays } from '../utils/dates.js';

// forceOutcome: 'perfect' | 'fail' | undefined (demo mode only)
export async function processDay(userId, { forceOutcome } = {}) {
  const closed = await withTransaction(async (db) => {
    const user = await usersDb.findById(userId, db, { forUpdate: true });
    const date = user.gameDate;
    let quests = await questsDb.listForDay(user.id, date, db);
    if (forceOutcome === 'perfect') quests = quests.map((q) => (q.kind === 'required' ? { ...q, status: 'completed' } : q));

    const result = forceOutcome === 'fail' ? (dayResult(quests) === 'missed' ? 'missed' : 'partial') : dayResult(quests);
    const done = quests.filter((q) => q.status === 'completed').length;
    await questsDb.failMissing(user.id, date, db);
    await eventsDb.record(db, { userId: user.id, type: 'day_closed', result, onDate: date, data: { done, total: quests.length } });

    const fields = { gameDate: addDays(date, 1), extraToday: 0 };
    let rift = null;
    if (result === 'cleared') {
      fields.failedDaysInRow = 0;
    } else {
      const p = playerState(user, await progressDb.getBars(user.id, db));
      fields.failedDaysInRow = user.failedDaysInRow + 1;
      rift = sendToRift(p, 1, { hoursFor: fields.failedDaysInRow });
      Object.assign(fields, { level: p.level, xp: p.xp, coins: p.coins, items: p.items, rift });
      await eventsDb.record(db, {
        userId: user.id, type: 'rift', onDate: date, xp: -rift.lost.xp, coins: -rift.lost.coins, data: rift.lost,
      });
    }
    const saved = await usersDb.update(user.id, fields, db);
    return { user: saved, result, date, rift };
  });

  if (closed.rift) {
    await createChapter(closed.user, 'banished', {
      expLost: closed.rift.lost.xp, coinsLost: closed.rift.lost.coins, banishHours: closed.rift.hours,
    });
  }
  await ensureQuestsForDay(closed.user);
  return { date: closed.date, result: closed.result, rift: closed.rift };
}
