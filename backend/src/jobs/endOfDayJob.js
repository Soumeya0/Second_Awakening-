// Runs every night at midnight (server time zone) and once at startup to catch up after downtime.
import cron from 'node-cron';
import * as usersDb from '../db/users.js';
import { processDay } from '../game/endOfDay.js';
import { addDays, todayStr } from '../utils/dates.js';
import { config } from '../config.js';

let running = false;

export async function runEndOfDay() {
  if (running) return; // a slow catch-up is still going; it will reach every user
  running = true;
  try {
    await closeDueDays();
  } finally {
    running = false;
  }
}

async function closeDueDays() {
  const today = todayStr();
  // Users whose game day is behind the real date. (Demo mode can push a user ahead; they are skipped.)
  const users = await usersDb.listDueForEndOfDay(today);
  for (const user of users) {
    try {
      // If the server was down for several days, each missed day is closed separately. Only the last one
      // gets a story chapter (with the total loss) and new quests; the others would be closed straight away.
      let gameDate = user.gameDate;
      const lost = { xp: 0, coins: 0 };
      while (gameDate < today) {
        const last = addDays(gameDate, 1) >= today;
        const closed = await processDay(user.id, { before: today, quiet: !last, lostEarlier: lost });
        if (!closed) break; // another run already closed it
        lost.xp += closed.rift?.lost.xp || 0;
        lost.coins += closed.rift?.lost.coins || 0;
        gameDate = addDays(closed.date, 1);
      }
    } catch (err) {
      console.error(`End of day failed for user ${user.id}:`, err);
    }
  }
  if (users.length) console.log(`End of day processed for ${users.length} user(s)`);
}

export function startEndOfDayJob() {
  cron.schedule('0 0 * * *', () => runEndOfDay().catch((e) => console.error('End-of-day job error:', e)), { timezone: config.timezone });
  runEndOfDay().catch((e) => console.error('Startup catch-up error:', e));
}
