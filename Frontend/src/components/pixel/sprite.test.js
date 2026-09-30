// Run: npm test — every body × hairstyle × evolution paints a full, outlined portrait.
import assert from 'node:assert/strict';
import { H, W, paint } from './sprite.js';
import { DEFAULT_LOOK, HAIR_STYLES } from '../../api/look.js';

let n = 0;
for (const body of ['boy', 'girl']) for (const { id } of HAIR_STYLES) for (let stage = 0; stage < 6; stage++) {
  const g = paint({ ...DEFAULT_LOOK, body, hairStyle: id }, stage);
  assert.equal(g.length, H); assert.equal(g[0].length, W);
  const filled = g.flat().filter(Boolean).length;
  assert.ok(filled > 900, `${body}/${id}/${stage}: only ${filled} pixels`);
  assert.ok(g[H - 1].some(Boolean), `${body}/${id}/${stage}: no shoulders`);
  assert.equal(g[24][19], '#141011', `${body}/${id}/${stage}: eyes covered`); // pupil visible, not under hair
  n++;
}
console.log(`pixel sprites ok (${n} combinations)`);
