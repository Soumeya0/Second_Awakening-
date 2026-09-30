import { query } from './pool.js';

function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id, userId: r.user_id, date: r.date, category: r.category, kind: r.kind, position: r.position,
    title: r.title, description: r.description, durationMinutes: r.duration_minutes, proof: r.proof,
    status: r.status, startedAt: r.started_at, endsAt: r.ends_at, completedAt: r.completed_at,
    rewards: r.rewards, proofResult: r.proof_result,
  };
}

export async function listForDay(userId, date, db) {
  const { rows } = await query('SELECT * FROM quests WHERE user_id = $1 AND date = $2 ORDER BY position', [userId, date], db);
  return rows.map(fromRow);
}

// Duplicate (user, date, category) rows are skipped, so two requests generating the same day are harmless.
export async function insertMany(quests, db) {
  if (!quests.length) return;
  const cols = ['user_id', 'date', 'category', 'kind', 'position', 'title', 'description', 'duration_minutes', 'proof', 'rewards'];
  const params = [];
  const values = quests.map((q) => {
    const row = [q.userId, q.date, q.category, q.kind, q.position, q.title, q.description, q.durationMinutes, q.proof, JSON.stringify(q.rewards)];
    const start = params.length;
    params.push(...row);
    return `(${row.map((_, i) => `$${start + i + 1}${cols[i] === 'rewards' ? '::jsonb' : ''}`).join(', ')})`;
  });
  await query(
    `INSERT INTO quests (${cols.join(', ')}) VALUES ${values.join(', ')} ON CONFLICT (user_id, date, category) DO NOTHING`,
    params,
    db
  );
}

export async function findOwn(userId, id, db, { forUpdate = false } = {}) {
  if (!/^\d+$/.test(String(id))) return null;
  const { rows } = await query(
    `SELECT * FROM quests WHERE id = $1 AND user_id = $2${forUpdate ? ' FOR UPDATE' : ''}`,
    [id, userId],
    db
  );
  return fromRow(rows[0]);
}

// pending -> active; an already active quest keeps its timer (a refresh resumes the countdown).
export async function start(id) {
  const { rows } = await query(
    `UPDATE quests SET status = 'active', started_at = now(), ends_at = now() + make_interval(mins => duration_minutes)
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id]
  );
  if (rows[0]) return fromRow(rows[0]);
  return fromRow((await query('SELECT * FROM quests WHERE id = $1', [id])).rows[0]);
}

export async function cancel(id) {
  const { rows } = await query(
    `UPDATE quests SET status = 'pending', started_at = NULL, ends_at = NULL WHERE id = $1 AND status = 'active' RETURNING *`,
    [id]
  );
  return fromRow(rows[0]);
}

export async function complete(id, { rewards, proofResult }, db) {
  const { rows } = await query(
    `UPDATE quests SET status = 'completed', completed_at = now(), rewards = $2::jsonb, proof_result = $3::jsonb
     WHERE id = $1 RETURNING *`,
    [id, JSON.stringify(rewards), JSON.stringify(proofResult)],
    db
  );
  return fromRow(rows[0]);
}

export async function setProofResult(id, proofResult) {
  await query('UPDATE quests SET proof_result = $2::jsonb WHERE id = $1', [id, JSON.stringify(proofResult)]);
}

export async function failMissing(userId, date, db) {
  await query(`UPDATE quests SET status = 'failed' WHERE user_id = $1 AND date = $2 AND status <> 'completed'`, [userId, date], db);
}

export async function recentTitles(userId, limit = 15) {
  const { rows } = await query('SELECT title FROM quests WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
  return rows.map((r) => r.title);
}
