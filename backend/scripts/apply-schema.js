// npm run db:schema -> creates or updates every table, view, and policy in src/db/schema.sql.
import fs from 'node:fs/promises';
import { pool } from '../src/db/pool.js';
import { config } from '../src/config.js';

// Splits on semicolons that end a line, except inside $$ ... $$ blocks.
function splitStatements(sql) {
  const out = [];
  let current = [];
  let inDollar = false;
  for (const line of sql.split('\n')) {
    if (!inDollar && /^\s*--/.test(line)) continue;
    current.push(line);
    if ((line.match(/\$\$/g) || []).length % 2 === 1) inDollar = !inDollar;
    if (!inDollar && /;\s*$/.test(line)) {
      out.push(current.join('\n').trim());
      current = [];
    }
  }
  const rest = current.join('\n').trim();
  if (rest) out.push(rest);
  return out;
}

const raw = await fs.readFile(new URL('../src/db/schema.sql', import.meta.url), 'utf8');
const sql = raw.replaceAll('{{TZ}}', config.timezone.replaceAll("'", ''));

try {
  const statements = splitStatements(sql);
  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err) {
      console.error(`Failed on:\n${statement}\n`);
      throw err;
    }
  }
  console.log(`Schema applied (${statements.length} statements, time zone ${config.timezone}).`);
} catch (err) {
  console.error('Schema error:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
