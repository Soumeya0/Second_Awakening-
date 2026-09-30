import { Router } from 'express';
import { withTransaction } from '../db/pool.js';
import * as usersDb from '../db/users.js';
import * as eventsDb from '../db/events.js';
import { SHOP_ITEMS } from '../game/content.js';
import { httpError } from '../utils/http.js';

const router = Router();

// GET /api/shop -> potions, prices, and how many the player owns
router.get('/', (req, res) => {
  const items = Object.values(SHOP_ITEMS).map((i) => ({ ...i, owned: req.user.items[i.id] || 0 }));
  res.json({ coins: req.user.coins, items });
});

// POST /api/shop/buy  { itemId }
router.post('/buy', async (req, res) => {
  const item = SHOP_ITEMS[req.body?.itemId];
  if (!item) throw httpError(400, 'Unknown item', { allowed: Object.keys(SHOP_ITEMS) });

  const user = await withTransaction(async (db) => {
    const u = await usersDb.findById(req.user.id, db, { forUpdate: true });
    if (u.coins < item.cost) throw httpError(400, `Not enough coins: need ${item.cost}, have ${u.coins}`);
    const items = { ...u.items, [item.id]: (u.items[item.id] || 0) + 1 };
    await eventsDb.record(db, { userId: u.id, type: 'purchase', coins: -item.cost, data: { itemId: item.id } });
    return usersDb.update(u.id, { coins: u.coins - item.cost, items }, db);
  });
  res.json({ coins: user.coins, items: user.items });
});

export default router;
