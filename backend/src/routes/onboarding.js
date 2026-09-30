import { Router } from 'express';
import * as usersDb from '../db/users.js';
import * as progressDb from '../db/progress.js';
import { ensureQuestsForDay, questView } from '../services/quests.js';
import { createChapter } from '../services/story.js';
import { userView } from '../game/userView.js';
import { httpError } from '../utils/http.js';
import { todayStr } from '../utils/dates.js';
import { cleanAnswers, cleanChosen, cleanLook } from './validate.js';

const router = Router();

// POST /api/onboarding  { chosen: [...10+ category ids], look, name?, answers? }
router.post('/', async (req, res) => {
  if (req.user.onboarded) throw httpError(409, 'Already onboarded');
  const body = req.body || {};
  const chosen = cleanChosen(body.chosen);
  const today = todayStr();

  const user = await usersDb.update(req.user.id, {
    chosen,
    look: cleanLook(body.look),
    answers: cleanAnswers(body.answers ?? req.user.answers),
    ...(body.name !== undefined && { name: String(body.name).trim().slice(0, 40) || 'Player' }),
    onboarded: true, started: today, gameDate: today,
  });
  await progressDb.ensureRows(user.id, chosen);
  const quests = await ensureQuestsForDay(user);
  const chapter = await createChapter(user, 'intro'); // the first awakening

  res.status(201).json({ me: await userView(user), quests: quests.map(questView), chapter });
});

export default router;
