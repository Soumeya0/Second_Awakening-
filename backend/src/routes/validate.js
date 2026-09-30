// Input cleaning shared by the onboarding and profile routes.
import { CATEGORY_IDS, MIN_CATEGORIES } from '../game/content.js';
import { httpError } from '../utils/http.js';

export function cleanChosen(chosen) {
  const unique = [...new Set(Array.isArray(chosen) ? chosen : [])];
  const invalid = unique.filter((c) => !CATEGORY_IDS.includes(c));
  if (invalid.length) throw httpError(400, `Unknown categories: ${invalid.join(', ')}`, { allowed: CATEGORY_IDS });
  if (unique.length < MIN_CATEGORIES) throw httpError(400, `Pick at least ${MIN_CATEGORIES} categories (you picked ${unique.length})`);
  return unique;
}

// Avatar choices: short strings only (ids and hex colours from frontend/src/api/look.js).
const LOOK_KEYS = ['body', 'skin', 'hairStyle', 'hair', 'eyes', 'outfit'];
export function cleanLook(look) {
  const out = {};
  for (const k of LOOK_KEYS) if (typeof look?.[k] === 'string') out[k] = look[k].slice(0, 20);
  return out;
}

// Onboarding answers: up to 20 short string pairs.
export function cleanAnswers(answers) {
  const out = {};
  for (const [k, v] of Object.entries(answers || {}).slice(0, 20)) out[String(k).slice(0, 40)] = String(v).slice(0, 120);
  return out;
}
