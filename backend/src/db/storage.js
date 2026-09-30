// Numbers for the "Powered by Tiger Data" panel: row counts, compression, and summary-view vs raw query time.
import { query } from './pool.js';

async function timed(sql, params) {
  const t0 = performance.now();
  await query(sql, params);
  return Math.round((performance.now() - t0) * 10) / 10;
}

export async function storageStats() {
  const { rows: [counts] } = await query(
    `SELECT (SELECT count(*) FROM vitals_readings) AS vitals_rows,
            (SELECT count(*) FROM player_events) AS event_rows,
            (SELECT count(*) FROM users) AS players,
            pg_database_size(current_database()) AS database_bytes`
  );
  const { rows: compression } = await query(
    `SELECT h AS hypertable, s.total_chunks, s.number_compressed_chunks,
            s.before_compression_total_bytes, s.after_compression_total_bytes, hypertable_size(h::regclass) AS total_bytes
     FROM unnest(ARRAY['vitals_readings', 'player_events']) AS h
     LEFT JOIN LATERAL hypertable_compression_stats(h::regclass) s ON true`
  );

  // The same question asked two ways: average and peak heart rate per quest over the last 30 days.
  const summaryMs = await timed(
    `SELECT quest_id, sum(avg_bpm * samples) / sum(samples), max(max_bpm)
     FROM vitals_per_minute WHERE minute > now() - interval '30 days' GROUP BY quest_id`
  );
  const rawMs = await timed(
    `SELECT quest_id, avg(bpm), max(bpm) FROM vitals_readings WHERE time > now() - interval '30 days' GROUP BY quest_id`
  );

  return {
    players: counts.players,
    vitalsRows: counts.vitals_rows,
    eventRows: counts.event_rows,
    databaseBytes: counts.database_bytes,
    freeTierBytes: 750 * 1024 * 1024,
    hypertables: compression.map((c) => ({
      name: c.hypertable,
      totalBytes: c.total_bytes,
      chunks: c.total_chunks ?? 0,
      compressedChunks: c.number_compressed_chunks ?? 0,
      beforeBytes: c.before_compression_total_bytes ?? null,
      afterBytes: c.after_compression_total_bytes ?? null,
      ratio: c.before_compression_total_bytes && c.after_compression_total_bytes
        ? Math.round((1 - c.after_compression_total_bytes / c.before_compression_total_bytes) * 1000) / 10
        : null,
    })),
    query30Days: { summaryViewMs: summaryMs, rawReadingsMs: rawMs },
  };
}
