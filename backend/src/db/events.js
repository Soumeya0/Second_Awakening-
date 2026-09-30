// player_events hypertable + the daily_player_stats continuous aggregate built on it.
import { query } from './pool.js';
import { config } from '../config.js';

const RESULT_CODE = { cleared: 'd', partial: 'p', missed: 'm' };

// event: { userId, type, category?, proof?, xp?, coins?, result?, data?, onDate? }
// onDate ("YYYY-MM-DD") files the event at noon of that game day instead of now, so a day_closed
// event lands in the right daily bucket even when the job runs after midnight.
export async function record(db, e) {
  await query(
    `INSERT INTO player_events (time, user_id, type, category, proof, xp, coins, result, data)
     VALUES (CASE WHEN $1::date IS NULL THEN now() ELSE ($1::date + time '12:00') AT TIME ZONE $10 END,
             $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
    [
      e.onDate || null, e.userId, e.type, e.category || null, e.proof || null,
      e.xp || 0, e.coins || 0, e.result || null, e.data ? JSON.stringify(e.data) : null, config.timezone,
    ],
    db
  );
}

// Last `days` days, one row per day (gaps filled with zeros), straight from the continuous aggregate.
export async function dailyStats(userId, days = 30) {
  const { rows } = await query(
    `SELECT d::date AS date,
            coalesce(s.quests, 0) AS quests, coalesce(s.xp, 0) AS xp, coalesce(s.coins, 0) AS coins,
            coalesce(s.vitals_quests, 0) AS vitals, coalesce(s.focus_quests, 0) AS focus,
            coalesce(s.photo_quests, 0) AS photo, coalesce(s.honor_quests, 0) AS honor,
            s.day_result
     FROM generate_series(((now() AT TIME ZONE $3)::date - ($2::int - 1))::timestamp, (now() AT TIME ZONE $3)::date::timestamp, interval '1 day') AS d
     LEFT JOIN daily_player_stats s ON s.user_id = $1 AND s.day = d AT TIME ZONE $3
     ORDER BY d`,
    [userId, days, config.timezone]
  );
  return rows.map((r) => ({
    date: r.date, quests: r.quests, xp: r.xp, coins: r.coins,
    byProof: { VITALS: r.vitals, FOCUS: r.focus, PHOTO: r.photo, HONOR: r.honor },
    result: r.day_result ? RESULT_CODE[r.day_result] : null,
  }));
}

// Closed days between two dates -> { 'YYYY-MM-DD': 'd' | 'p' | 'm' }
export async function history(userId, from, to) {
  const { rows } = await query(
    `SELECT (day AT TIME ZONE $4)::date AS date, day_result
     FROM daily_player_stats
     WHERE user_id = $1 AND day >= $2::date::timestamp AT TIME ZONE $4 AND day < ($3::date + 1)::timestamp AT TIME ZONE $4
       AND day_result IS NOT NULL`,
    [userId, from, to, config.timezone]
  );
  return Object.fromEntries(rows.map((r) => [r.date, RESULT_CODE[r.day_result]]));
}
