// Run: npm test — headless fights to catch balance regressions.
import assert from 'node:assert/strict';
import { createGame, runnerAI } from './engine.js';

function fight(opts, limit = 120) {
  let result = null;
  const g = createGame({ ...opts, onEnd: (r) => { result = r; } });
  let t = 0;
  while (!result && t < limit) { g.step(1 / 60); t += 1 / 60; }
  return { result, t, g };
}

// A spectated Rank B runner should usually clear a Rank C gate, in a watchable length of time.
let wins = 0, total = 0, hurt = 0;
for (let n = 0; n < 40; n++) {
  const { result, t, g } = fight({ boss: { name: 'Warden', hp: 700, color: '#5AA9FF' }, fighter: { name: 'r', color: '#fff', level: 24, maxHp: 148, dmg: 0.55 + 24 / 60 }, ai: runnerAI });
  if (result === 'won') wins++;
  if (g.state.p.hp < g.state.p.maxHp) hurt++;
  total += t;
}
assert.ok(wins >= 30, `runner won ${wins}/40`);
assert.ok(total / 40 > 15 && total / 40 < 60, `avg fight ${(total / 40).toFixed(1)}s`);
assert.ok(hurt > 10, 'boss should land hits on the runner');

// A player who does nothing loses: the boss really attacks.
assert.equal(fight({ boss: { name: 'Warden', hp: 400, color: '#9B7BFF' }, fighter: { name: 'me', color: '#fff' } }).result, 'lost');

console.log('arena ok');
