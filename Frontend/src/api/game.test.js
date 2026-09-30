// Run: npm test
import assert from 'node:assert/strict';
import { addQuest, buyPotion, canAddQuest, drinkPotion, checkMissedDays, completeQuest, localDailyStats, rankOf, sendToRift, stats, streak, today, todaysQuests } from './game.js';
import { CATEGORIES } from './data.js';
import { showcasePlayer } from './demo.js';

const player = () => ({
  level: 1, xp: 0, coins: 50, chosen: CATEGORIES.slice(0, 10).map((c) => c.id), bars: {}, materials: {},
  history: {}, items: {}, questsDone: 0, started: today(), lastCheck: today(), onboarded: true,
  day: { date: today(), status: {}, cleared: false }, rift: null
});

// Quest rewards: coins, material, bar; 4 required quests clear the day with a bonus.
const p = player();
const qs = todaysQuests(p);
assert.equal(qs.length, 5);
const r = completeQuest(p, qs[0].id);
assert.deepEqual([r.coins, r.qty, r.barFrom, r.barTo], [10, 1, 0, 1]);
assert.deepEqual([r.levelFrom, r.levelTo], [1, 1], 'no level up from one quest');
assert.equal(stats(p).find((x) => x.name === r.stat).value, 12, 'quest trains its stat');
assert.equal(completeQuest(p, qs[0].id), null, 'cannot claim twice');
qs.slice(1, 4).forEach((q) => completeQuest(p, q.id));
assert.ok(p.day.cleared);
assert.equal(p.coins, 50 + 40 + 25);
assert.equal(p.history[today()], 'd');
assert.equal(p.materials['Shadow essence'], 1, 'clearing the day drops a shadow essence');
const fifth = completeQuest(p, qs[4].id); // 5th quest of the run
assert.deepEqual(fifth.drops.map((x) => x.name), ['Beast core']);
assert.equal(p.materials['Beast core'], 1);

// Extra quests: only once everything is done, one new category each, never a repeat.
assert.equal(canAddQuest(p), true, 'bonus quest done above');
assert.ok(canAddQuest(p));
addQuest(p);
const more = todaysQuests(p);
assert.equal(more.length, 6);
assert.equal(more[5].kind, 'extra');
assert.equal(canAddQuest(p), false, 'new extra quest not done yet');
assert.equal(completeQuest(p, more[5].id).coins, 8);
for (let k = 0; k < 10; k++) { addQuest(p); todaysQuests(p).forEach((q) => completeQuest(p, q.id)); }
assert.equal(todaysQuests(p).length, 10, 'capped at the number of chosen categories');
assert.equal(new Set(todaysQuests(p).map((q) => q.id)).size, 10);
assert.equal(canAddQuest(p), false);

// Rift: losses are exact and can drop level and rank.
const q = { ...player(), level: 10, xp: 100, coins: 30 };
sendToRift(q, 2);
assert.deepEqual(q.rift.lost, { xp: 300, coins: 30, levelFrom: 10, levelTo: 9, rankFrom: 'C', rankTo: 'D' });
assert.equal(q.xp, 800);
assert.equal(rankOf(q.level), 'D');

// Two missed days since last check -> banished for 2 days.
const m = player();
const d = new Date(); d.setDate(d.getDate() - 2);
m.lastCheck = today(d);
checkMissedDays(m);
assert.equal(m.rift.days, 2);
assert.equal(m.lastCheck, today());

// Judge demo: a Rank S version of the same player, built without touching the real one.
const real = player();
const before = JSON.stringify(real);
const demo = showcasePlayer({ ...real, name: 'Soumeya' });
assert.equal(rankOf(demo.level), 'S');
assert.equal(demo.name, 'Soumeya');
assert.ok(demo.onboarded && demo.demo);
assert.ok(streak(demo) >= 100, `streak ${streak(demo)}`);
assert.equal(Object.values(demo.day.status).filter((v) => v === 'done').length, 2);
assert.equal(JSON.stringify(real), before, 'real player unchanged');

// Potions: buy with coins, drink from the inventory.
{
  const q = showcasePlayer({});
  const coins = q.coins;
  assert.ok(buyPotion(q, 'haste')); assert.equal(q.coins, coins - 220);
  q.coins = 0; assert.equal(buyPotion(q, 'haste'), false, 'too poor');
  assert.ok(drinkPotion(q, 'haste')); assert.equal(drinkPotion(q, 'haste'), false, 'already active');
  const quest = todaysQuests(q).find((x) => q.day.status[x.id] !== 'done');
  const won = completeQuest(q, quest.id);
  assert.ok(won.boost?.length, 'haste doubled the quest');
  assert.equal(q.buffs.haste, undefined, 'used up');
  assert.equal(drinkPotion(q, 'revival'), false, 'no Rift to escape');
  sendToRift(q); assert.ok(drinkPotion(q, 'revival')); assert.equal(q.rift, null);
}

// Local 30-day stats (same shape as GET /api/stats): the showcase's perfect streak shows up as cleared days.
const week = localDailyStats(demo, 30);
assert.equal(week.length, 30);
assert.equal(week.at(-1).date, today());
assert.ok(week.slice(0, -1).every((d) => d.result === 'd' && d.quests === 4), 'past showcase days are cleared');
assert.equal(week.at(-1).quests, 2, 'today counts the quests done so far');
assert.equal(week[0].xp, 4 * 25 + 50);

console.log('game rules ok');