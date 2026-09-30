// Runs every night at midnight (server time zone) and once at startup to catch up after downtime.
import cron from 'node-cron';
import * as usersDb from '../db/users.js';
import { processDay } from '../game/endOfDay.js';
import { todayStr } from '../utils/dates.js';
import { config } from '../config.js';

export async function runEndOfDay() {
  const today = todayStr();
  // Users whose game day is behind the real date. (Demo mode can push a user ahead; they are skipped.)
  const users = await usersDb.listDueForEndOfDay(today);
  for (const user of users) {
    try {
      // If the server was down for several days, each missed day is closed separately.
      let gameDate = user.gameDate;
      while (gameDate < today) {
        await processDay(user.id);
        const next = (await usersDb.findById(user.id)).gameDate;
        if (next === gameDate) break; // safety: never loop forever
        gameDate = next;
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
