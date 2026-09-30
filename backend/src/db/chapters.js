import { query } from './pool.js';

function fromRow(r) {
  return {
    id: r.id, type: r.type, title: r.title, text: r.text,
    audioUrl: r.audio_url, audioStatus: r.audio_status, createdAt: r.created_at,
  };
}

export async function create({ userId, type, title, text, audioStatus }) {
  const { rows } = await query(
    `INSERT INTO story_chapters (user_id, type, title, text, audio_status) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, type, title, text, audioStatus]
  );
  return fromRow(rows[0]);
}

export async function setAudio(id, { audioUrl = null, audioStatus }) {
  await query('UPDATE story_chapters SET audio_url = $2, audio_status = $3 WHERE id = $1', [id, audioUrl, audioStatus]);
}

// Newest first. audioStatus "pending" means poll again in a few seconds.
export async function listForUser(userId, limit = 50) {
  const { rows } = await query('SELECT * FROM story_chapters WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2', [userId, limit]);
  return rows.map(fromRow);
}
