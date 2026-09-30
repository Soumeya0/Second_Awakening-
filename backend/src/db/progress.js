// Category bars: one row per (user, category), count 0..target.
import { query } from './pool.js';

// -> { strength: 3, yoga: 10, ... }
export async function getBars(userId, db) {
  const { rows } = await query('SELECT category, count FROM category_progress WHERE user_id = $1', [userId], db);
  return Object.fromEntries(rows.map((r) => [r.category, r.count]));
}

export async function ensureRows(userId, categories, db) {
  await query(
    `INSERT INTO category_progress (user_id, category)
     SELECT $1, unnest($2::text[]) ON CONFLICT DO NOTHING`,
    [userId, categories],
    db
  );
}

// Writes the whole bar map at once (a level-up resets every bar, so single increments are not enough).
export async function saveBars(userId, bars, db) {
  const categories = Object.keys(bars);
  if (!categories.length) return;
  await query(
    `UPDATE category_progress c SET count = LEAST(v.count, c.target)
     FROM unnest($2::text[], $3::int[]) AS v(category, count)
     WHERE c.user_id = $1 AND c.category = v.category`,
    [userId, categories, categories.map((c) => bars[c])],
    db
  );
}

// Demo mode: every bar full.
export async function fillAll(userId, db) {
  await query('UPDATE category_progress SET count = target WHERE user_id = $1', [userId], db);
}
