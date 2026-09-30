// npm run test:smoke -> end-to-end check against a real Tiger Data database (needs DATABASE_URL and db:schema applied).
// Onboards a throwaway player, streams vitals for a strength quest, completes the day, reads the stats, then deletes the player.
import assert from 'node:assert/strict';

process.env.AUTH_DISABLED = 'true';
process.env.DEMO_MODE = 'true';
// Empty, not deleted: dotenv only fills in variables that are missing.
process.env.GEMINI_API_KEY = '';
process.env.ELEVENLABS_API_KEY = '';

const { createApp } = await import('../src/app.js');
const { pool } = await import('../src/db/pool.js');
const { CATEGORY_LIST } = await import('../src/game/content.js');
const { todayStr } = await import('../src/utils/dates.js');

const devUser = `smoke-${Date.now()}`;
const server = createApp().listen(0);
const base = `http://localhost:${server.address().port}/api`;

async function call(method, path, body) {
  const isForm = body instanceof FormData;
  const res = await fetch(base + path, {
    method,
    headers: { 'x-dev-user': devUser, ...(body && !isForm && { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
  return data;
}
const step = (name) => console.log(`  ok  ${name}`);

try {
  // Day 1 starts with the first chosen category, so "strength" goes first: the hard quest.
  const chosen = CATEGORY_LIST.slice(0, 10).map((c) => c.id);

  const onboard = await call('POST', '/onboarding', { chosen, name: 'Smoke', look: { body: 'girl' } });
  assert.deepEqual(onboard.quests.map((q) => [q.category, q.difficulty, q.points]),
    chosen.slice(0, 4).map((c, i) => [c, ['hard', 'medium', 'medium-easy', 'easy'][i], [50, 30, 20, 10][i]]));
  step('onboarding creates 4 quests, hard to easy, from the first 4 categories');

  const strength = onboard.quests.find((q) => q.category === 'strength');
  assert.equal(strength.kind, 'required');
  // A first attempt that was given up: its high, flat heart rate must not count toward the retry.
  await call('POST', `/quests/${strength.id}/start`);
  await pool.query(`UPDATE quests SET started_at = now() - interval '25 minutes', ends_at = now() - interval '15 minutes' WHERE id = $1`, [strength.id]);
  const gaveUpAt = Date.now() - 25 * 60e3;
  await call('POST', `/quests/${strength.id}/vitals`, { readings: Array.from({ length: 60 }, (_, i) => ({ t: gaveUpAt + i * 1000, bpm: 150 })) });
  await call('POST', `/quests/${strength.id}/cancel`);
  step('gave up a first attempt after uploading readings');

  await call('POST', `/quests/${strength.id}/start`);
  // Pretend the 10-minute session already happened, so readings fall inside the quest window.
  await pool.query(`UPDATE quests SET started_at = now() - interval '10 minutes', ends_at = now() WHERE id = $1`, [strength.id]);
  const start = Date.now() - 10 * 60e3;
  let saved = 0;
  for (let batch = 0; batch < 10; batch++) {
    const readings = Array.from({ length: 60 }, (_, i) => {
      const s = batch * 60 + i;
      return { t: start + s * 1000, bpm: Math.round(72 + 45 * (1 - Math.exp(-s / 120))) };
    });
    saved += (await call('POST', `/quests/${strength.id}/vitals`, { readings })).saved;
  }
  assert.ok(saved >= 590, `saved ${saved} readings`);
  step(`uploaded ${saved} heart-rate readings in 10 batches`);

  const done = await call('POST', `/quests/${strength.id}/complete`);
  assert.equal(done.reward.verified, true, done.reward.reason);
  assert.equal(done.reward.coins, 10);
  step(`strength quest verified from stored readings (${done.reward.reason})`);

  const vitals = await call('GET', `/quests/${strength.id}/vitals`);
  assert.ok(vitals.series.length >= 10 && vitals.series.length <= 11, `${vitals.series.length} minutes (this attempt only)`);
  assert.ok(vitals.summary.startBpm < 100, 'start is from this attempt, not the one given up');
  assert.ok(vitals.summary.peakBpm > vitals.summary.startBpm + 15);
  step(`vitals_per_minute returns ${vitals.series.length} minutes`);

  // Finish the other required quests (photos auto-approve without Gemini) to clear the day.
  const png = new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')], { type: 'image/png' });
  let cleared = false;
  for (const q of onboard.quests.filter((x) => x.kind === 'required' && x.id !== strength.id)) {
    await call('POST', `/quests/${q.id}/start`);
    let body;
    if (q.proof === 'PHOTO') { body = new FormData(); body.append('photo', png, 'proof.png'); }
    const r = await call('POST', `/quests/${q.id}/complete`, body);
    cleared ||= Boolean(r.reward.cleared);
  }
  assert.ok(cleared, 'daily clear bonus');
  step('4 required quests cleared the day');

  const closed = await call('POST', '/demo/next-day', { outcome: 'auto' });
  assert.equal(closed.result.result, 'cleared');
  step('end of day recorded a cleared day');

  const day2 = await call('GET', '/quests/today');
  assert.deepEqual(day2.map((q) => q.category), [chosen[9], chosen[0], chosen[1], chosen[2]]);
  step('day 2: hard is category 10, then categories 1, 2, 3');

  const stats = await call('GET', '/stats?days=2');
  const todayRow = stats.days.at(-1);
  assert.equal(todayRow.quests, 4);
  assert.equal(todayRow.byProof.VITALS >= 1, true);
  assert.equal(todayRow.result, 'd');
  step(`daily_player_stats: ${todayRow.quests} quests, ${todayRow.xp} EXP today (${stats.queryMs} ms)`);

  const history = await call('GET', `/stats/history?month=${todayStr().slice(0, 7)}`);
  assert.equal(history[todayStr()], 'd');
  step('history calendar reads the closed day');

  const db = await (await fetch(`${base}/stats/db`)).json();
  assert.ok(db.vitalsRows >= saved);
  step(`storage stats: ${db.vitalsRows} readings, summary ${db.query30Days.summaryViewMs} ms vs raw ${db.query30Days.rawReadingsMs} ms`);

  console.log('Smoke test passed.');
} catch (err) {
  console.error('Smoke test failed:', err.message);
  process.exitCode = 1;
} finally {
  await pool.query('DELETE FROM users WHERE auth0_id = $1', [`dev|${devUser}`]).catch(() => {});
  server.close();
  await pool.end();
}
