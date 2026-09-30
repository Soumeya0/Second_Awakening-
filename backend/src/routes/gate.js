import { Router } from 'express';
import { withTransaction } from '../db/pool.js';
import * as usersDb from '../db/users.js';
import * as progressDb from '../db/progress.js';
import * as eventsDb from '../db/events.js';
import { GATE_REWARD } from '../game/content.js';
import { gain } from '../game/rules.js';
import { playerState, userView } from '../game/userView.js';
import { httpError } from '../utils/http.js';

const router = Router();

// POST /api/gate/reward -> arena win. Rank C and up, once per game day (so it can't be farmed).
router.post('/reward', async (req, res) => {
  const user = await withTransaction(async (db) => {
    const u = await usersDb.findById(req.user.id, db, { forUpdate: true });
    if (u.level < GATE_REWARD.minLevel) throw httpError(403, 'Gates open at Rank C (level 10)');
    if (u.gateWonOn === u.gameDate) throw httpError(409, 'Gate reward already claimed today');
    const p = playerState(u, await progressDb.getBars(u.id, db));
    const levelUps = gain(p, GATE_REWARD.xp, GATE_REWARD.coins);
    if (levelUps) await progressDb.saveBars(u.id, p.bars, db);
    await eventsDb.record(db, { userId: u.id, type: 'gate_win', xp: GATE_REWARD.xp, coins: GATE_REWARD.coins });
    if (levelUps) await eventsDb.record(db, { userId: u.id, type: 'level_up', data: { from: u.level, to: p.level } });
    return usersDb.update(u.id, { level: p.level, xp: p.xp, coins: p.coins, gateWonOn: u.gameDate }, db);
  });
  res.json({ reward: GATE_REWARD, me: await userView(user) });
});

export default router;
