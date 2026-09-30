// vitals_readings hypertable + the vitals_per_minute continuous aggregate built on it.
import { query } from './pool.js';

// readings: [{ t: ms or ISO, bpm?, breathingRate?, focusScore? }]. One row per second per quest:
// timestamps are rounded to the second and duplicates are dropped by the (quest_id, time) unique index.
export async function insertBatch(userId, questId, readings) {
  const times = [];
  const bpm = [];
  const breathing = [];
  const focus = [];
  for (const r of readings) {
    times.push(new Date(Math.floor(new Date(r.t).getTime() / 1000) * 1000).toISOString());
    bpm.push(r.bpm ?? null);
    breathing.push(r.breathingRate ?? null);
    focus.push(r.focusScore ?? null);
  }
  const { rowCount } = await query(
    `INSERT INTO vitals_readings (time, user_id, quest_id, bpm, breathing_rate, focus_score)
     SELECT t, $1, $2, b, br, f FROM unnest($3::timestamptz[], $4::smallint[], $5::real[], $6::real[]) AS v(t, b, br, f)
     ON CONFLICT (quest_id, time) DO NOTHING`,
    [userId, questId, times, bpm, breathing, focus]
  );
  return rowCount;
}

// Per-minute series for the reward chart, read from the continuous aggregate.
export async function perMinute(userId, questId) {
  const { rows } = await query(
    `SELECT minute, round(avg_bpm)::int AS avg_bpm, min_bpm, max_bpm,
            round(avg_breathing::numeric, 1) AS avg_breathing, round(avg_focus::numeric, 2) AS avg_focus, samples
     FROM vitals_per_minute WHERE user_id = $1 AND quest_id = $2 ORDER BY minute`,
    [userId, questId]
  );
  return rows.map((r) => ({
    minute: r.minute, avgBpm: r.avg_bpm, minBpm: r.min_bpm, maxBpm: r.max_bpm,
    avgBreathing: r.avg_breathing, avgFocus: r.avg_focus, samples: r.samples,
  }));
}

// What verifyVitals needs: start = first minute, peak = best 10-second average (ignores single spikes).
export async function summary(userId, questId) {
  const { rows } = await query(
    `WITH r AS (SELECT * FROM vitals_readings WHERE user_id = $1 AND quest_id = $2),
          b AS (SELECT min(time) AS t0, max(time) AS t1, count(*) AS n FROM r)
     SELECT b.n AS samples,
            (SELECT avg(bpm) FROM r WHERE r.time < b.t0 + interval '60 seconds') AS start_bpm,
            (SELECT max(a) FROM (SELECT avg(bpm) AS a FROM r GROUP BY time_bucket('10 seconds', r.time)) x) AS peak_bpm,
            (SELECT avg(bpm) FROM r) AS avg_bpm,
            (SELECT avg(breathing_rate) FROM r WHERE r.time < b.t0 + interval '60 seconds') AS start_breathing,
            (SELECT avg(breathing_rate) FROM r WHERE r.time > b.t1 - interval '60 seconds') AS end_breathing,
            (SELECT avg(focus_score) FROM r) AS avg_focus
     FROM b`,
    [userId, questId]
  );
  const s = rows[0];
  const num = (v) => (v == null ? null : Number(v));
  return {
    samples: s.samples, startBpm: num(s.start_bpm), peakBpm: num(s.peak_bpm), avgBpm: num(s.avg_bpm),
    startBreathing: num(s.start_breathing), endBreathing: num(s.end_breathing), avgFocus: num(s.avg_focus),
  };
}
