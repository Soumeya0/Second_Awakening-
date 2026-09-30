// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_LIST } from '../src/game/content.js';
import { addDays } from '../src/utils/dates.js';
import {
  canAddQuest, completeQuest, dayResult, gain, nextRankLevel, questSlotsForDay, rankOf, slotsToAdd,
  sendToRift, streak, verifyVitals,
} from '../src/game/rules.js';

const chosen = CATEGORY_LIST.slice(0, 10).map((c) => c.id);
const player = () => ({
  level: 1, xp: 0, coins: 50, chosen, bars: {}, materials: {}, stats: {}, items: {}, questsDone: 0,
});
const questFor = (slot) => ({ ...slot, proof: CATEGORY_LIST.find((c) => c.id === slot.category).proof });

test('4 quests a day, hard to easy, extras up to the number of categories', () => {
  const slots = questSlotsForDay(chosen, '2026-09-26');
  assert.deepEqual(slots.map((s) => [s.kind, s.difficulty]),
    [['required', 'hard'], ['required', 'medium'], ['required', 'medium-easy'], ['required', 'easy']]);
  const extra = questSlotsForDay(chosen, '2026-09-26', { extra: 1 })[4];
  assert.deepEqual([extra.kind, extra.difficulty], ['extra', null]);
  const all = questSlotsForDay(chosen, '2026-09-26', { extra: 50 });
  assert.equal(all.length, 10);
  assert.equal(new Set(all.map((s) => s.category)).size, 10);
});

test('the window starts at the first category and moves back one category a day, wrapping around', () => {
  const started = '2026-09-26';
  const day = (n) => questSlotsForDay(chosen, addDays(started, n - 1), { started }).map((s) => chosen.indexOf(s.category) + 1);
  assert.deepEqual(day(1), [1, 2, 3, 4]);
  assert.deepEqual(day(2), [10, 1, 2, 3], 'day 2: hard is category 10, medium 1, medium-easy 2, easy 3');
  assert.deepEqual(day(3), [9, 10, 1, 2]);
  assert.deepEqual(day(11), [1, 2, 3, 4], 'back to the start after one lap');
  assert.deepEqual(questSlotsForDay(chosen.slice(0, 4), '2026-09-27', { started }).map((s) => s.category),
    [chosen[3], chosen[0], chosen[1], chosen[2]], 'works with exactly 4 categories');
});

test('quest rewards, stats, and the daily clear bonus', () => {
  const p = player();
  const slots = questSlotsForDay(chosen, '2026-09-26').map(questFor);
  const r = completeQuest(p, slots[0], { requiredDoneAfter: false });
  assert.deepEqual([r.xp, r.coins, r.qty, r.barFrom, r.barTo, r.difficulty], [50, 10, 1, 0, 1, 'hard']);
  assert.equal(p.stats[slots[0].proof], 1);
  assert.deepEqual(slots.slice(1, 3).map((q) => completeQuest(p, q, { requiredDoneAfter: false }).xp), [30, 20]);
  const last = completeQuest(p, slots[3], { requiredDoneAfter: true });
  assert.ok(last.cleared);
  assert.equal(last.xp, 10 + 50, 'easy quest + daily clear bonus');
  assert.deepEqual([p.xp, p.coins], [50 + 30 + 20 + 10 + 50, 50 + 40 + 25]);
  const extra = completeQuest(p, questFor(questSlotsForDay(chosen, '2026-09-26', { extra: 1 })[4]), { requiredDoneAfter: true, alreadyCleared: true });
  assert.equal(extra.cleared, undefined);
  assert.deepEqual([extra.xp, extra.coins], [20, 8]);
});

test('level up needs 1000 EXP and every bar full', () => {
  const p = player();
  assert.equal(gain(p, 1200, 0), 0, 'bars not full');
  chosen.forEach((id) => { p.bars[id] = 10; });
  assert.equal(gain(p, 0, 0), 1);
  assert.equal(p.xp, 200);
  assert.ok(chosen.every((id) => p.bars[id] === 0), 'bars reset');
});

test('extra quest only once everything listed is done', () => {
  const done = (n) => Array.from({ length: n }, () => ({ status: 'completed' }));
  assert.equal(canAddQuest([...done(4), { status: 'pending' }], 10), false);
  assert.equal(canAddQuest(done(5), 10), true);
  assert.equal(canAddQuest(done(10), 10), false);
});

test('day results', () => {
  const q = (kind, status) => ({ kind, status });
  assert.equal(dayResult([q('required', 'completed'), q('required', 'completed'), q('required', 'completed'), q('required', 'completed'), q('extra', 'pending')]), 'cleared');
  assert.equal(dayResult([q('required', 'completed'), q('required', 'pending')]), 'partial');
  assert.equal(dayResult([q('required', 'pending')]), 'missed');
});

test('Rift losses are exact and can drop level and rank', () => {
  const p = { ...player(), level: 10, xp: 100, coins: 30 };
  const rift = sendToRift(p, 2, { now: 0 });
  assert.deepEqual(rift.lost, { xp: 300, coins: 30, levelFrom: 10, levelTo: 9, rankFrom: 'C', rankTo: 'D' });
  assert.equal(p.xp, 800);
  assert.equal(rift.until, 2 * 3600e3);
});

test('a Ward potion cuts the banishment to 30 minutes and is used up', () => {
  const p = { ...player(), items: { shield: 1 } };
  const rift = sendToRift(p, 1, { hoursFor: 3, now: 0 });
  assert.equal(rift.until, 0.5 * 3600e3);
  assert.equal(p.items.shield, 0);
});

test('streak counts cleared days, freezes bridge gaps', () => {
  const history = { '2026-09-25': 'd', '2026-09-24': 'd', '2026-09-22': 'd' };
  assert.equal(streak(history, { today: '2026-09-26', started: '2026-09-01' }), 2);
  assert.equal(streak(history, { today: '2026-09-26', started: '2026-09-01', freezes: 1 }), 3);
  assert.equal(streak({ ...history, '2026-09-26': 'd' }, { today: '2026-09-26', started: '2026-09-01' }), 3);
});

test('ranks', () => {
  assert.equal(rankOf(1), 'E');
  assert.equal(rankOf(50), 'S');
  assert.equal(nextRankLevel(12), 20);
  assert.equal(nextRankLevel(50), null);
});

test('vitals verification from stored readings', () => {
  assert.equal(verifyVitals('strength', { samples: 900, startBpm: 72, peakBpm: 118, avgBpm: 104 }).verified, true);
  assert.equal(verifyVitals('running', { samples: 600, startBpm: 72, peakBpm: 80, avgBpm: 76 }).verified, false);
  assert.equal(verifyVitals('yoga', { samples: 600, startBreathing: 16, endBreathing: 9, startBpm: 80, avgBpm: 70 }).verified, true);
  assert.equal(verifyVitals('yoga', { samples: 600, startBpm: 80, avgBpm: 70 }).verified, true);
  assert.equal(verifyVitals('study', { samples: 900, avgFocus: 0.82 }).verified, true);
  assert.equal(verifyVitals('study', { samples: 900, avgFocus: 0.4 }).verified, false);
  assert.equal(verifyVitals('strength', { samples: 0 }).verified, false);
  assert.equal(verifyVitals('strength', null).verified, false);
});

test('quests added to a day that already has quests are extras, never required', () => {
  const today = questSlotsForDay(chosen, '2026-09-26').map((s) => ({ ...s, status: 'pending' }));
  assert.deepEqual(slotsToAdd(questSlotsForDay(chosen, '2026-09-26'), today), [], 'nothing missing');
  assert.equal(slotsToAdd(questSlotsForDay(chosen, '2026-09-26'), []).length, 4, 'a new day gets all 4');

  const extra = slotsToAdd(questSlotsForDay(chosen, '2026-09-26', { extra: 1 }), today);
  assert.deepEqual(extra.map((s) => [s.position, s.kind, s.difficulty]), [[4, 'extra', null]]);

  // New categories picked mid-day: the rotation changes, but only the free slots are filled, after today's quests.
  const swapped = [...chosen.slice(5), ...CATEGORY_LIST.slice(10, 15).map((c) => c.id)];
  assert.deepEqual(slotsToAdd(questSlotsForDay(swapped, '2026-09-26'), today), [], 'no second set of required quests');
  const more = slotsToAdd(questSlotsForDay(swapped, '2026-09-26', { extra: 1 }), today);
  assert.equal(more.length, 1);
  assert.deepEqual([more[0].position, more[0].kind], [4, 'extra']);
});
