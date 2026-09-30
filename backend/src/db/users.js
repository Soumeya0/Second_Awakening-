import { query } from './pool.js';

// camelCase field -> column. json columns are sent as JSON text and cast to jsonb.
const COLUMNS = {
  name: 'name', onboarded: 'onboarded', chosen: 'chosen', level: 'level', xp: 'xp', coins: 'coins',
  questsDone: 'quests_done', failedDaysInRow: 'failed_days_in_row', gameDate: 'game_date',
  extraToday: 'extra_today', gateWonOn: 'gate_won_on', started: 'started',
};
const JSON_COLUMNS = { look: 'look', answers: 'answers', materials: 'materials', stats: 'stats', items: 'items', rift: 'rift' };

function fromRow(r) {
  if (!r) return null;
  return {
    id: r.id, auth0Id: r.auth0_id, name: r.name, onboarded: r.onboarded, chosen: r.chosen,
    look: r.look, answers: r.answers, level: r.level, xp: r.xp, coins: r.coins,
    materials: r.materials, stats: r.stats, items: r.items, questsDone: r.quests_done,
    failedDaysInRow: r.failed_days_in_row, rift: r.rift, gameDate: r.game_date,
    extraToday: r.extra_today, gateWonOn: r.gate_won_on, started: r.started, createdAt: r.created_at,
  };
}

export async function findById(id, db, { forUpdate = false } = {}) {
  const { rows } = await query(`SELECT * FROM users WHERE id = $1${forUpdate ? ' FOR UPDATE' : ''}`, [id], db);
  return fromRow(rows[0]);
}

// Creates the user on first login, so the frontend never needs a separate "sign up" call.
export async function findOrCreateByAuthId(auth0Id, today) {
  const found = await query('SELECT * FROM users WHERE auth0_id = $1', [auth0Id]);
  if (found.rows[0]) return fromRow(found.rows[0]);
  const created = await query(
    `INSERT INTO users (auth0_id, game_date, started) VALUES ($1, $2, $2)
     ON CONFLICT (auth0_id) DO NOTHING RETURNING *`,
    [auth0Id, today]
  );
  if (created.rows[0]) return fromRow(created.rows[0]);
  // Two first requests at once: the other one created it.
  const again = await query('SELECT * FROM users WHERE auth0_id = $1', [auth0Id]);
  return fromRow(again.rows[0]);
}

// update(id, { coins: 10, materials: {...} }) -> the saved user
export async function update(id, fields, db) {
  const sets = [];
  const params = [id];
  for (const [key, value] of Object.entries(fields)) {
    if (COLUMNS[key]) {
      params.push(value);
      sets.push(`${COLUMNS[key]} = $${params.length}`);
    } else if (JSON_COLUMNS[key]) {
      params.push(value == null ? null : JSON.stringify(value));
      sets.push(`${JSON_COLUMNS[key]} = $${params.length}::jsonb`);
    } else {
      throw new Error(`users.update: unknown field "${key}"`);
    }
  }
  if (!sets.length) return findById(id, db);
  const { rows } = await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING *`, params, db);
  return fromRow(rows[0]);
}

export async function listDueForEndOfDay(today) {
  const { rows } = await query('SELECT * FROM users WHERE onboarded AND game_date < $1 ORDER BY id', [today]);
  return rows.map(fromRow);
}
