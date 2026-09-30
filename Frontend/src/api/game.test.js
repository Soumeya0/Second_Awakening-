// Run: npm test
import assert from 'node:assert/strict';
import { addQuest, questWindow, buyPotion, canAddQuest, claimGateReward, startDay, drinkPotion, checkMissedDays, completeQuest, localDailyStats, rankOf, sendToRift, stats, streak, today, todaysQuests } from './game.js';
import { CATEGORIES } from './data.js';
import { showcasePlayer } from './demo.js';

const player = () => ({
  level: 1, xp: 0, coins: 50, chosen: CATEGORIES.slice(0, 10).map((c) => c.id), bars: {}, materials: {},
  history: {}, items: {}, questsDone: 0, started: today(), lastCheck: today(), onboarded: true,
  day: { date: today(), status: {}, cleared: false }, rift: null
});

// 4 quests a day, hard to easy, worth 50/30/20/10 EXP. The window starts at the first category and moves back one a day.
const ids = CATEGORIES.slice(0, 10).map((c) => c.id);
const nth = (date) => questWindow(ids, '2026-09-26', date, 4).map((id) => ids.indexOf(id) + 1);
assert.deepEqual(nth('2026-09-26'), [1, 2, 3, 4]);
assert.deepEqual(nth('2026-09-27'), [10, 1, 2, 3], 'day 2: hard is category 10, medium 1, medium-easy 2, easy 3');
assert.deepEqual(nth('2026-09-28'), [9, 10, 1, 2]);
assert.deepEqual(nth('2026-10-06'), [1, 2, 3, 4], 'back to the start after one lap');

// Quest rewards: coins, material, bar; 4 required quests clear the day with a bonus.
const p = player();
const qs = todaysQuests(p);
assert.deepEqual(qs.map((q) => [q.id, q.kind, q.difficulty.id, q.reward.xp]),
  [[ids[0], 'required', 'hard', 50], [ids[1], 'required', 'medium', 30], [ids[2], 'required', 'medium-easy', 20], [ids[3], 'required', 'easy', 10]]);
const r = completeQuest(p, qs[0].id);
assert.deepEqual([r.xp, r.coins, r.qty, r.barFrom, r.barTo], [50, 10, 1, 0, 1]);
assert.deepEqual([r.levelFrom, r.levelTo], [1, 1], 'no level up from one quest');
assert.equal(stats(p).find((x) => x.name === r.stat).value, 12, 'quest trains its stat');
assert.equal(completeQuest(p, qs[0].id), null, 'cannot claim twice');
qs.slice(1, 4).forEach((q) => completeQuest(p, q.id));
assert.ok(p.day.cleared);
assert.deepEqual([p.xp, p.coins], [50 + 30 + 20 + 10 + 50, 50 + 40 + 25]);
assert.equal(p.history[today()], 'd');
assert.equal(p.materials['Shadow essence'], 1, 'clearing the day drops a shadow essence');

// Extra quests: only once everything is done, one new category each, never a repeat.
assert.equal(canAddQuest(p), true, 'all 4 done above');
addQuest(p);
const more = todaysQuests(p);
assert.equal(more.length, 5);
assert.deepEqual([more[4].id, more[4].kind, more[4].difficulty], [ids[4], 'extra', null]);
assert.equal(canAddQuest(p), false, 'new extra quest not done yet');
const fifth = completeQuest(p, more[4].id); // 5th quest of the run
assert.deepEqual([fifth.xp, fifth.coins], [20, 8]);
assert.deepEqual(fifth.drops.map((x) => x.name), ['Beast core']);
assert.equal(p.materials['Beast core'], 1);
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
assert.equal(week[0].xp, 50 + 30 + 20 + 10 + 50);

// The arena reward pays once per day.
const gp = player();
assert.equal(claimGateReward(gp, 40, 30), true);
assert.equal(claimGateReward(gp, 40, 30), false, 'second win the same day pays nothing');
assert.deepEqual([gp.xp, gp.coins], [40, 80]);
gp.gateWonOn = '2000-01-01';
assert.equal(claimGateReward(gp, 40, 30), true, 'a new day pays again');

// A tab left open past midnight: yesterday's statuses don't carry over, and the missed day counts.
const yesterday = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return today(d); })();
const op = player();
todaysQuests(op).slice(0, 3).forEach((q) => completeQuest(op, q.id));
Object.assign(op, { lastCheck: yesterday, day: { ...op.day, date: yesterday } });
assert.equal(startDay(op), true);
assert.deepEqual(op.day, { date: today(), status: {}, cleared: false });
assert.ok(op.rift, 'the unfinished day sends the player to the Rift');
assert.equal(startDay(op), false, 'same day: nothing changes');

console.log('game rules ok');