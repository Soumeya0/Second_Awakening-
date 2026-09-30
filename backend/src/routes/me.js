import { Router } from 'express';
import * as usersDb from '../db/users.js';
import * as progressDb from '../db/progress.js';
import { userView } from '../game/userView.js';
import { ensureQuestsForDay } from '../services/quests.js';
import { createChapter } from '../services/story.js';
import { cleanChosen, cleanLook, cleanAnswers } from './validate.js';

const router = Router();

// GET /api/me -> the whole player object (HUD, dashboard, profile, Rift screen).
router.get('/', async (req, res) => {
  let user = req.user;
  // Banishment over? Play the "returned" chapter once.
  if (user.rift && !user.rift.returned && user.rift.until <= Date.now()) {
    user = await usersDb.update(user.id, { rift: { ...user.rift, returned: true } });
    await createChapter(user, 'returned');
  }
  if (user.onboarded) await ensureQuestsForDay(user);
  res.json(await userView(user));
});

// PATCH /api/me  { name?, look?, answers?, chosen? }
router.patch('/', async (req, res) => {
  const body = req.body || {};
  const fields = {};
  if (body.name !== undefined) fields.name = String(body.name).trim().slice(0, 40) || 'Player';
  if (body.look !== undefined) fields.look = cleanLook(body.look);
  if (body.answers !== undefined) fields.answers = cleanAnswers(body.answers);
  if (body.chosen !== undefined) fields.chosen = cleanChosen(body.chosen);

  const user = await usersDb.update(req.user.id, fields);
  if (fields.chosen) {
    await progressDb.ensureRows(user.id, fields.chosen);
    if (user.onboarded) await ensureQuestsForDay(user);
  }
  res.json(await userView(user));
});

export default router;
