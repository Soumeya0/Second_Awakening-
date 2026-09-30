import { Router } from 'express';
import * as chaptersDb from '../db/chapters.js';

const router = Router();

// GET /api/story -> chapters, newest first. audioStatus "pending" means poll again in a few seconds.
router.get('/', async (req, res) => {
  res.json(await chaptersDb.listForUser(req.user.id));
});

export default router;
