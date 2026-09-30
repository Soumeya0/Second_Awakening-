// Demo-only shortcuts. Mounted only when DEMO_MODE=true.
import { Router } from 'express';
import * as usersDb from '../db/users.js';
import * as progressDb from '../db/progress.js';
import { nextRankLevel, XP_PER_LEVEL } from '../game/rules.js';
import { processDay } from '../game/endOfDay.js';
import { userView } from '../game/userView.js';
import { httpError } from '../utils/http.js';

const router = Router();

// POST /api/demo/next-day  { outcome?: "auto" | "perfect" | "fail" }
// auto = judge today's quests as they are (fewer than 4 required done -> banished).
router.post('/next-day', async (req, res) => {
  const outcome = req.body?.outcome;
  if (outcome && !['auto', 'perfect', 'fail'].includes(outcome)) throw httpError(400, 'outcome must be auto, perfect, or fail');
  const result = await processDay(req.user.id, { forceOutcome: outcome === 'auto' ? undefined : outcome });
  res.json({ result, me: await userView(await usersDb.findById(req.user.id)) });
});

// POST /api/demo/add-exp -> one level below the next rank, 10 EXP short of levelling, every bar full,
// so the next completed quest triggers a rank-up (and its story chapter).
router.post('/add-exp', async (req, res) => {
  const next = nextRankLevel(req.user.level);
  if (next === null) throw httpError(400, 'Already rank S');
  await progressDb.fillAll(req.user.id);
  const user = await usersDb.update(req.user.id, { level: next - 1, xp: XP_PER_LEVEL - 10 });
  res.json(await userView(user));
});

// POST /api/demo/fill-bars -> every category bar full
router.post('/fill-bars', async (req, res) => {
  await progressDb.fillAll(req.user.id);
  res.json(await userView(req.user));
});

export default router;
