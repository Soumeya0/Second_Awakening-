import { Router } from 'express';
import * as eventsDb from '../db/events.js';
import { storageStats } from '../db/storage.js';
import { httpError } from '../utils/http.js';
import { addDays } from '../utils/dates.js';

// Signed-in routes: /api/stats, /api/stats/history
const router = Router();

// GET /api/stats?days=30 -> one row per day from the daily_player_stats continuous aggregate
router.get('/', async (req, res) => {
  const days = Math.max(1, Math.min(365, Math.floor(Number(req.query.days) || 30)));
  const t0 = performance.now();
  const rows = await eventsDb.dailyStats(req.user.id, days);
  res.json({ days: rows, queryMs: Math.round((performance.now() - t0) * 10) / 10 });
});

// GET /api/stats/history?month=YYYY-MM -> { 'YYYY-MM-DD': 'd' | 'p' | 'm' } for the Profile calendar
router.get('/history', async (req, res) => {
  const month = String(req.query.month || req.user.gameDate.slice(0, 7));
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw httpError(400, 'month must be YYYY-MM');
  const from = `${month}-01`;
  const to = addDays(`${addDays(from, 32).slice(0, 7)}-01`, -1);
  res.json(await eventsDb.history(req.user.id, from, to));
});

export default router;

// Public: GET /api/stats/db -> row counts, compression, and query timings (cached for a minute)
export const publicStatsRouter = Router();
let cached = null;
publicStatsRouter.get('/db', async (_req, res) => {
  if (!cached || cached.at < Date.now() - 60_000) cached = { at: Date.now(), data: await storageStats() };
  res.set('Cache-Control', 'public, max-age=60');
  res.json(cached.data);
});
