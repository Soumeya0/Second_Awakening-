// One shared connection pool for the Tiger Data (PostgreSQL + TimescaleDB) service.
import pg from 'pg';
import { config } from '../config.js';

// DATE columns stay "YYYY-MM-DD" strings (game days), and counts/ids/averages come back as numbers.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));

// Free shared compute allows only a handful of connections.
export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 5, idleTimeoutMillis: 30_000 });
pool.on('error', (err) => console.error('Idle database client error:', err.message));

// db is either the pool or a transaction client, so every query helper works inside and outside transactions.
export function query(text, params, db = pool) {
  return db.query(text, params);
}

export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function checkDatabase() {
  const { rows } = await pool.query("SELECT extversion FROM pg_extension WHERE extname = 'timescaledb'");
  return { timescaledb: rows[0]?.extversion || null };
}
