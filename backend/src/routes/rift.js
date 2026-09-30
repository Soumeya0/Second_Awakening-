import { Router } from 'express';
import * as usersDb from '../db/users.js';
import { userView } from '../game/userView.js';
import { httpError } from '../utils/http.js';

const router = Router();

// POST /api/rift/seen -> the banishment screen was shown (the dashboard stops redirecting to it)
router.post('/seen', async (req, res) => {
  const { rift } = req.user;
  if (!rift) throw httpError(409, 'Not in the Rift');
  res.json(await userView(await usersDb.update(req.user.id, { rift: { ...rift, seen: true } })));
});

// POST /api/rift/leave -> only once the timer has run out
router.post('/leave', async (req, res) => {
  const { rift } = req.user;
  if (!rift) throw httpError(409, 'Not in the Rift');
  if (rift.until > Date.now()) throw httpError(409, 'Still trapped', { until: rift.until });
  res.json(await userView(await usersDb.update(req.user.id, { rift: null })));
});

export default router;
