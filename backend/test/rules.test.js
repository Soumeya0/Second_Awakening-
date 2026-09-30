// Run with: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORY_LIST } from '../src/game/content.js';
import {
  canAddQuest, completeQuest, dayResult, gain, nextRankLevel, questSlotsForDay, rankOf,
  sendToRift, streak, verifyVitals,
} from '../src/game/rules.js';

const chosen = CATEGORY_LIST.slice(0, 10).map((c) => c.id);
const player = () => ({
  level: 1, xp: 0, coins: 50, chosen, bars: {}, materials: {}, stats: {}, items: {}, questsDone: 0,
});
const questFor = (slot) => ({ ...slot, proof: CATEGORY_LIST.find((c) => c.id === slot.category).proof });

test('5 quests a day (4 required + bonus), extras up to the number of categories', () => {
  const slots = questSlotsForDay(chosen, '2026-09-26');
  assert.equal(slots.length, 5);
  assert.deepEqual(slots.map((s) => s.kind), ['required', 'required', 'required', 'required', 'bonus']);
  assert.equal(questSlotsForDay(chosen, '2026-09-26', 1)[5].kind, 'extra');
  const all = questSlotsForDay(chosen, '2026-09-26', 50);
  assert.equal(all.length, 10);
  assert.equal(new Set(all.map((s) => s.category)).size, 10);
});

test('quest rewards, stats, and the daily clear bonus', () => {
  const p = player();
  const slots = questSlotsForDay(chosen, '2026-09-26').map(questFor);
  const r = completeQuest(p, slots[0], { requiredDoneAfter: false });
  assert.deepEqual([r.coins, r.qty, r.barFrom, r.barTo], [10, 1, 0, 1]);
  assert.equal(p.stats[slots[0].proof], 1);
  slots.slice(1, 3).forEach((q) => completeQuest(p, q, { requiredDoneAfter: false }));
  const last = completeQuest(p, slots[3], { requiredDoneAfter: true });
  assert.ok(last.cleared);
  assert.equal(p.coins, 50 + 40 + 25);
  const bonus = completeQuest(p, slots[4], { requiredDoneAfter: true, alreadyCleared: true });
  assert.equal(bonus.cleared, undefined);
  assert.equal(bonus.qty, 2);
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
  assert.equal(dayResult([q('required', 'completed'), q('required', 'completed'), q('required', 'completed'), q('required', 'completed'), q('bonus', 'pending')]), 'cleared');
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
