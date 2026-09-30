// npm run db:seed -> a Rank S showcase player with 150 days of history, built in SQL with generate_series:
// completed quests, player events, and ~1 reading per second for every VITALS and FOCUS quest of the last 85 days.
// Then refreshes both continuous aggregates and compresses old chunks, so the demo numbers are real.
// Sign in as this player with AUTH_DISABLED=true and the header  x-dev-user: showcase
import { pool, withTransaction } from '../src/db/pool.js';
import { config } from '../src/config.js';
import { CATEGORY_LIST, MATERIAL } from '../src/game/content.js';
import { DIFFICULTY, REWARD } from '../src/game/rules.js';
import { todayStr, addDays } from '../src/utils/dates.js';
import { ensureQuestsForDay } from '../src/services/quests.js';
import * as usersDb from '../src/db/users.js';
import { dailyStats } from '../src/db/events.js';
import { storageStats } from '../src/db/storage.js';

const AUTH_ID = 'dev|showcase';
const DAYS = 150;
// Raw readings older than 90 days are dropped by the retention policy, so only seed them inside that window.
const VITALS_DAYS = 85;
const chosen = CATEGORY_LIST.slice(0, 10);
const today = todayStr();
const tz = config.timezone;

const t0 = performance.now();
const userId = await withTransaction(async (db) => {
  await db.query('DELETE FROM users WHERE auth0_id = $1', [AUTH_ID]); // cascades to quests, bars, events, vitals

  const { rows: [user] } = await db.query(
    `INSERT INTO users (auth0_id, name, onboarded, chosen, look, level, xp, coins, materials, stats, items, game_date, started)
     VALUES ($1, 'Showcase', true, $2, '{}', 52, 640, 4820, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7) RETURNING id`,
    [
      AUTH_ID, chosen.map((c) => c.id),
      JSON.stringify({ [MATERIAL.VITALS.name]: 148, [MATERIAL.PHOTO.name]: 173, [MATERIAL.FOCUS.name]: 161, [MATERIAL.HONOR.name]: 139 }),
      JSON.stringify({ VITALS: 150, FOCUS: 165, PHOTO: 170, HONOR: 128 }),
      JSON.stringify({ freeze: 2, shield: 1, outfit: 1 }),
      today, addDays(today, -DAYS),
    ]
  );
  const fill = [7, 9, 6, 8, 10, 5, 9, 7, 8, 6];
  await db.query(
    `INSERT INTO category_progress (user_id, category, count) SELECT $1, * FROM unnest($2::text[], $3::int[])`,
    [user.id, chosen.map((c) => c.id), fill]
  );

  // Quests for the past 150 days, same rotation as the app: 100-day perfect streak, a few partial days before it.
  // Cleared days: the 4 required quests, hard to easy (the 4th carries the daily clear bonus). Partial days: the first 2.
  // The player started DAYS days ago, so day n back is day number DAYS - n of the rotation.
  await db.query(
    `WITH cats AS (
       SELECT id, proof, mins, title, idx - 1 AS i
       FROM unnest($2::text[], $3::text[], $4::int[], $5::text[]) WITH ORDINALITY AS c(id, proof, mins, title, idx)
     ),
     days AS (
       SELECT n, ($6::date - n) AS d, CASE WHEN n > 100 AND n % 13 = 0 THEN 'partial' ELSE 'cleared' END AS result
       FROM generate_series(1, $7::int) AS n
     ),
     slots AS (
       SELECT days.*, k, (((k - ($7::int - n)) % 10) + 10) % 10 AS i
       FROM days, generate_series(0, 3) AS k
       WHERE k < CASE WHEN result = 'cleared' THEN 4 ELSE 2 END
     )
     INSERT INTO quests (user_id, date, category, kind, position, difficulty, title, description, duration_minutes, proof,
                         status, started_at, ends_at, completed_at, rewards, proof_result)
     SELECT $1, s.d, c.id, 'required', s.k, ($13::text[])[s.k + 1], c.title, c.title, c.mins, c.proof, 'completed',
            st, st + make_interval(mins => c.mins), st + make_interval(mins => c.mins),
            jsonb_build_object(
              'xp', ($8::int[])[s.k + 1] + CASE WHEN s.k = 3 AND s.result = 'cleared' THEN $9::int ELSE 0 END,
              'coins', $10::int + CASE WHEN s.k = 3 AND s.result = 'cleared' THEN $11::int ELSE 0 END),
            jsonb_build_object('verified', c.proof <> 'HONOR', 'seeded', true)
     FROM slots s
     JOIN cats c ON c.i = s.i
     CROSS JOIN LATERAL (SELECT (s.d + time '07:00' + s.k * interval '2 hours') AT TIME ZONE $12 AS st) AS t`,
    [
      user.id, chosen.map((c) => c.id), chosen.map((c) => c.proof), chosen.map((c) => c.mins), chosen.map((c) => c.title),
      today, DAYS, DIFFICULTY.map((d) => d.points), REWARD.clear.xp,
      REWARD.required.coins, REWARD.clear.coins, tz, DIFFICULTY.map((d) => d.id),
    ]
  );

  // One event per completed quest, one day_closed per day.
  await db.query(
    `INSERT INTO player_events (time, user_id, type, category, proof, xp, coins, data)
     SELECT completed_at, user_id, 'quest_completed', category, proof, (rewards->>'xp')::int, (rewards->>'coins')::int,
            jsonb_build_object('questId', id, 'kind', kind, 'seeded', true)
     FROM quests WHERE user_id = $1 AND date < $2`,
    [user.id, today]
  );
  await db.query(
    `INSERT INTO player_events (time, user_id, type, result, data)
     SELECT (date + time '12:00') AT TIME ZONE $3, $1, 'day_closed',
            CASE WHEN count(*) >= 4 THEN 'cleared' ELSE 'partial' END, jsonb_build_object('done', count(*), 'seeded', true)
     FROM quests WHERE user_id = $1 AND date < $2 GROUP BY date`,
    [user.id, today, tz]
  );

  // ~1 reading per second: workouts climb to a plateau and cool down, yoga settles heart rate and breathing,
  // focus sessions carry a drifting focus score.
  await db.query(
    `INSERT INTO vitals_readings (time, user_id, quest_id, bpm, breathing_rate, focus_score)
     SELECT q.started_at + s * interval '1 second', q.user_id, q.id,
            CASE
              WHEN q.proof = 'FOCUS' THEN round(66 + random() * 8)
              WHEN q.category = 'yoga' THEN round(86 - 16 * f + random() * 4)
              ELSE round(72 + 46 * (1 - exp(-s / 120.0)) - 30 * greatest(0, f - 0.85) / 0.15 + random() * 6)
            END::smallint,
            CASE WHEN q.category = 'yoga' THEN (16 - 7 * f + random())::real END,
            CASE WHEN q.proof = 'FOCUS' THEN least(1, greatest(0, 0.8 + 0.12 * sin(s / 90.0) + (random() - 0.5) * 0.2))::real END
     FROM quests q
     CROSS JOIN LATERAL generate_series(0, q.duration_minutes * 60 - 1) AS s
     CROSS JOIN LATERAL (SELECT s::float / (q.duration_minutes * 60) AS f) AS frac
     WHERE q.user_id = $1 AND q.proof IN ('VITALS', 'FOCUS') AND q.date < $2 AND q.date >= $2::date - $3::int`,
    [user.id, today, VITALS_DAYS]
  );

  await db.query('UPDATE users SET quests_done = (SELECT count(*) FROM quests WHERE user_id = $1) WHERE id = $1', [user.id]);
  return user.id;
});
console.log(`Seeded showcase player ${userId} in ${Math.round(performance.now() - t0)} ms`);

await ensureQuestsForDay(await usersDb.findById(userId));

// Continuous aggregates and compression (outside a transaction, as TimescaleDB requires).
// The background refresh policy may be running at the same moment (55P03); wait for it and retry.
// vitals_per_minute is refreshed only inside the retention window: refreshing over dropped raw chunks
// would wipe the per-minute history those chunks left behind.
async function refresh(view, from = null) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await pool.query(`CALL refresh_continuous_aggregate($1, $2::timestamptz, NULL)`, [view, from]);
    } catch (err) {
      if (err.code !== '55P03' || attempt === 10) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
await refresh('daily_player_stats');
await refresh('vitals_per_minute', new Date(Date.now() - (VITALS_DAYS + 1) * 864e5).toISOString());
const { rowCount: vitalsChunks } = await pool.query(
  `SELECT compress_chunk(c, if_not_compressed => true) FROM show_chunks('vitals_readings', older_than => INTERVAL '3 days') c`
);
const { rowCount: eventChunks } = await pool.query(
  `SELECT compress_chunk(c, if_not_compressed => true) FROM show_chunks('player_events', older_than => INTERVAL '30 days') c`
);
console.log(`Summary views refreshed; compressed ${vitalsChunks} vitals chunks and ${eventChunks} event chunks.`);

const q0 = performance.now();
const stats = await dailyStats(userId, 30);
const statsMs = Math.round((performance.now() - q0) * 10) / 10;
const s = await storageStats();
const vitals = s.hypertables.find((h) => h.name === 'vitals_readings');
const mb = (b) => (b == null ? '?' : `${(b / 1048576).toFixed(1)} MB`);

console.log(`
For the pitch:
  heart-rate readings:   ${s.vitalsRows.toLocaleString('en-US')}
  player events:         ${s.eventRows.toLocaleString('en-US')}
  vitals compression:    ${vitals.ratio ?? '?'}% smaller (${mb(vitals.beforeBytes)} -> ${mb(vitals.afterBytes)})
  database size:         ${mb(s.databaseBytes)} of the 750 MB free tier
  GET /api/stats query:  ${statsMs} ms for ${stats.length} days
  30-day heart rate per quest: ${s.query30Days.summaryViewMs} ms from vitals_per_minute vs ${s.query30Days.rawReadingsMs} ms from raw readings`);

await pool.end();
