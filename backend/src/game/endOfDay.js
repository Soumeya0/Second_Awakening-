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
// before: only close the day if it is earlier than this date. Checked under the row lock, so two runs at once
//   (startup catch-up and the midnight cron, or two servers) can't close a day that hasn't ended. Returns null if skipped.
// quiet: skip the story chapter and the next day's quests (catch-up days that are closed straight away).
// lostEarlier: EXP and coins lost on earlier catch-up days, added to the banishment chapter.
export async function processDay(userId, { forceOutcome, before, quiet = false, lostEarlier = { xp: 0, coins: 0 } } = {}) {
  const closed = await withTransaction(async (db) => {
    const user = await usersDb.findById(userId, db, { forUpdate: true });
    const date = user.gameDate;
    if (before && date >= before) return null;
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

  if (!closed) return null;
  if (quiet) return { date: closed.date, result: closed.result, rift: closed.rift };

  if (closed.rift) {
    await createChapter(closed.user, 'banished', {
      expLost: closed.rift.lost.xp + lostEarlier.xp, coinsLost: closed.rift.lost.coins + lostEarlier.coins,
      banishHours: closed.rift.hours,
    });
  }
  await ensureQuestsForDay(closed.user);
  return { date: closed.date, result: closed.result, rift: closed.rift };
}
