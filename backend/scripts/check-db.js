// npm run db:check -> confirms the Tiger service supports everything schema.sql needs, then cleans up.
import { pool, checkDatabase } from '../src/db/pool.js';

const steps = [
  ['hypertable', `CREATE TABLE levelup_check (time timestamptz NOT NULL, v int)`],
  ['hypertable', `SELECT create_hypertable('levelup_check', by_range('time', INTERVAL '1 day'))`],
  ['insert', `INSERT INTO levelup_check SELECT t, 1 FROM generate_series(now() - INTERVAL '3 days', now(), INTERVAL '1 minute') t`],
  ['continuous aggregate', `CREATE MATERIALIZED VIEW levelup_check_daily WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
     SELECT time_bucket('1 day', time, 'America/Toronto') AS day, count(*) FILTER (WHERE v = 1) AS n FROM levelup_check GROUP BY day WITH NO DATA`],
  ['refresh', `CALL refresh_continuous_aggregate('levelup_check_daily', NULL, NULL)`],
  ['compression', `ALTER TABLE levelup_check SET (timescaledb.compress)`],
  ['compression', `SELECT compress_chunk(c) FROM show_chunks('levelup_check', older_than => INTERVAL '1 day') c`],
];

try {
  const { timescaledb } = await checkDatabase();
  if (!timescaledb) throw new Error('The timescaledb extension is not installed on this database.');
  console.log(`TimescaleDB ${timescaledb}`);
  await pool.query('DROP TABLE IF EXISTS levelup_check CASCADE');
  for (const [name, sql] of steps) {
    await pool.query(sql);
    console.log(`  ok  ${name}`);
  }
  const { rows } = await pool.query('SELECT count(*) AS days FROM levelup_check_daily');
  console.log(`  ok  summary view has ${rows[0].days} days`);
  console.log('All features used by schema.sql work on this service.');
} catch (err) {
  console.error('Check failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.query('DROP TABLE IF EXISTS levelup_check CASCADE').catch(() => {});
  await pool.end();
}
