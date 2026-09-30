// Game rules. Every function mutates the player object it is given (a fresh clone from usePlayer().update).
import { CATEGORY, MATERIAL, POTIONS, RARE } from './data.js';

export const RANKS = [['E', 1], ['D', 5], ['C', 10], ['B', 20], ['A', 35], ['S', 50]];
export const RANK_COLOR = { S: '#F2B84B', A: '#FF5C74', B: '#0ECCED', C: '#4D8FE8', D: '#B9D3E2', E: '#87A4B5' };
export const XP_PER_LEVEL = 1000;
// The 4 daily quests, hardest first; a required quest's EXP is its points (same as the backend's rules.js).
export const DIFFICULTY = [
  { id: 'hard', name: 'Hard', points: 50 },
  { id: 'medium', name: 'Medium', points: 30 },
  { id: 'medium-easy', name: 'Medium-easy', points: 20 },
  { id: 'easy', name: 'Easy', points: 10 },
];
export const REWARD = { required: { coins: 10, qty: 1 }, extra: { xp: 20, coins: 8, qty: 1 }, clear: { xp: 50, coins: 25 } };
export const RIFT = { xpPerDay: 150, coinsPerDay: 25, hoursPerDay: 1 };

// Each verification type trains one stat; stats also rise with level.
export const STAT_OF = { VITALS: 'Strength', FOCUS: 'Intelligence', PHOTO: 'Perception', HONOR: 'Willpower' };
export const stats = (p) => Object.entries(STAT_OF).map(([proof, name]) => ({ name, proof, value: 10 + (p.level - 1) * 3 + ((p.stats || {})[proof] || 0) * 2 }));

export const today = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD, local
export const rankOf = (level) => RANKS.filter((r) => level >= r[1]).pop()[0];
export const totalXp = (p) => (p.level - 1) * XP_PER_LEVEL + p.xp;

// Level up needs 1000 EXP and every chosen category bar full; bars reset after.
export function gain(p, xp, coins) {
  p.xp += xp;
  p.coins += coins;
  while (p.xp >= XP_PER_LEVEL && p.chosen.every((id) => (p.bars[id] || 0) >= 10)) {
    p.xp -= XP_PER_LEVEL;
    p.level++;
    p.chosen.forEach((id) => { p.bars[id] = 0; });
  }
}

// A window of 4 chosen categories, hardest first, moving back one category a day and wrapping around: with 10
// categories day 1 is 1, 2, 3, 4 and day 2 is 10, 1, 2, 3. Extras continue the window. Same as the backend.
export function questWindow(chosen, started, date, count) {
  const n = chosen.length;
  const off = ((-Math.round((new Date(date) - new Date(started)) / 864e5) % n) + n) % n;
  return Array.from({ length: Math.min(n, count) }, (_, k) => chosen[(off + k) % n]); // never repeat a category in one day
}

const slotAt = (k) => (k < DIFFICULTY.length
  ? { kind: 'required', difficulty: DIFFICULTY[k], xp: DIFFICULTY[k].points, ...REWARD.required }
  : { kind: 'extra', difficulty: null, ...REWARD.extra });

// ponytail: rotation stands in for Gemini-written quests; swap in an API call here when the backend exists.
export function todaysQuests(p) {
  if (!p.chosen.length) return [];
  return questWindow(p.chosen, p.started, today(), DIFFICULTY.length + (p.day.extra || 0)).map((id, k) => {
    const c = CATEGORY[id];
    const { kind, difficulty, ...reward } = slotAt(k);
    return { ...c, kind, difficulty, reward: { ...reward, material: MATERIAL[c.proof] } };
  });
}

// Once everything listed today is done, the player can take on another quest (one category each).
export function canAddQuest(p) {
  const qs = todaysQuests(p);
  return qs.length < p.chosen.length && qs.every((q) => p.day.status[q.id] === 'done');
}
export function addQuest(p) {
  if (canAddQuest(p)) p.day.extra = (p.day.extra || 0) + 1;
}

export function completeQuest(p, id) {
  const quests = todaysQuests(p);
  const q = quests.find((x) => x.id === id);
  if (!q || p.day.status[id] === 'done') return null;
  const r = { category: q.name, title: q.title, difficulty: q.difficulty, xp: q.reward.xp, coins: q.reward.coins, material: q.reward.material, qty: q.reward.qty, barFrom: p.bars[id] || 0, levelFrom: p.level };
  p.day.status[id] = 'done';
  p.bars[id] = Math.min(10, r.barFrom + 1);
  r.barTo = p.bars[id];
  p.materials[r.material.name] = (p.materials[r.material.name] || 0) + r.qty;
  p.questsDone++;
  r.drops = RARE.filter((x) => x.every && p.questsDone % x.every === 0);
  p.stats = p.stats || {};
  p.stats[q.proof] = (p.stats[q.proof] || 0) + 1;
  r.stat = STAT_OF[q.proof];
  p.buffs = p.buffs || {};
  if (p.buffs.haste) { r.xp *= 2; r.boost = [...(r.boost || []), 'Tonic of haste: EXP ×2']; delete p.buffs.haste; }
  if (p.buffs.fortune) { r.coins *= 2; r.boost = [...(r.boost || []), 'Potion of fortune: coins ×2']; delete p.buffs.fortune; }
  gain(p, r.xp, r.coins);
  if (!p.day.cleared && quests.slice(0, 4).every((x) => p.day.status[x.id] === 'done')) {
    p.day.cleared = true;
    gain(p, REWARD.clear.xp, REWARD.clear.coins);
    r.xp += REWARD.clear.xp;
    r.coins += REWARD.clear.coins;
    r.cleared = true;
    r.drops.push(...RARE.filter((x) => x.clear));
  }
  r.drops.forEach((x) => { p.materials[x.name] = (p.materials[x.name] || 0) + 1; });
  p.history[today()] = p.day.cleared ? 'd' : 'p';
  r.levelTo = p.level;
  return r;
}

// Arena win reward, once per day (same rule as the backend's POST /api/gate/reward). Returns false if already claimed.
export function claimGateReward(p, xp, coins) {
  if (p.gateWonOn === today()) return false;
  p.gateWonOn = today();
  gain(p, xp, coins);
  return true;
}

// Buy a potion from the marketplace. Returns false when the player can't afford it.
export function buyPotion(p, id) {
  const it = POTIONS.find((x) => x.id === id);
  if (!it || p.coins < it.cost) return false;
  p.coins -= it.cost;
  p.items[id] = (p.items[id] || 0) + 1;
  return true;
}
// Drink a potion from the inventory. Returns false when there's none, or it can't be used right now.
export function drinkPotion(p, id) {
  if (!p.items[id] || !POTIONS.find((x) => x.id === id)?.drink) return false;
  p.buffs = p.buffs || {};
  if (id === 'growth') gain(p, 100, 0);
  else if (id === 'revival') { if (!p.rift) return false; p.rift = null; }
  else if (p.buffs[id]) return false; // already active: don't waste a second one
  else p.buffs[id] = true;
  p.items[id]--;
  return true;
}

// Banish the player to the Rift for `days` failed days in a row; records exactly what was lost.
export function sendToRift(p, days = 1) {
  const before = { total: totalXp(p), level: p.level, rank: rankOf(p.level), coins: p.coins };
  p.coins -= Math.min(p.coins, RIFT.coinsPerDay * days);
  p.xp -= RIFT.xpPerDay * days;
  while (p.xp < 0 && p.level > 1) { p.level--; p.xp += XP_PER_LEVEL; }
  p.xp = Math.max(0, p.xp);
  let hours = RIFT.hoursPerDay * days;
  if (p.items.shield) { p.items.shield--; hours = 0.5; }
  p.rift = {
    until: Date.now() + hours * 3600e3, days, seen: false,
    lost: { xp: before.total - totalXp(p), coins: before.coins - p.coins, levelFrom: before.level, levelTo: p.level, rankFrom: before.rank, rankTo: rankOf(p.level) }
  };
}

// Starts a new game day if the date changed (on load, and when a tab stays open past midnight). Returns true if it did.
export function startDay(p) {
  const fresh = !p.day || p.day.date !== today();
  if (fresh) p.day = { date: today(), status: {}, cleared: false };
  checkMissedDays(p);
  return fresh;
}

// On load: any day since the last check without all 4 required quests counts as failed.
export function checkMissedDays(p) {
  const t = today();
  if (p.onboarded && p.lastCheck < t) {
    let run = 0;
    const d = new Date(p.lastCheck + 'T00:00');
    while (today(d) < t) { run = p.history[today(d)] === 'd' ? 0 : run + 1; d.setDate(d.getDate() + 1); }
    if (run) sendToRift(p, run);
  }
  p.lastCheck = t;
}

export function streak(p) {
  // ponytail: owned streak freezes bridge gaps but are never used up; track consumption if the shop matters
  let n = 0, freezes = p.items.freeze || 0;
  const d = new Date();
  if (p.history[today(d)] !== 'd') d.setDate(d.getDate() - 1);
  for (;;) {
    const key = today(d);
    if (p.history[key] === 'd') n++;
    else if (freezes > 0 && key >= p.started) freezes--;
    else break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

// Local stand-in for GET /api/stats (same row shape), rebuilt from the history calendar and the quest rotation.
// Past days only record cleared/partial, so they count the minimum: 4 quests for a cleared day, 2 for a partial one.
export function localDailyStats(p, days = 30) {
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  const out = [];
  for (let i = 0; i < days; i++, d.setDate(d.getDate() + 1)) {
    const date = today(d);
    const h = p.history[date];
    const row = { date, quests: 0, xp: 0, coins: 0, byProof: { VITALS: 0, FOCUS: 0, PHOTO: 0, HONOR: 0 }, result: h || null };
    const count = (qs) => qs.forEach((q) => { row.quests++; row.xp += q.reward.xp; row.coins += q.reward.coins; row.byProof[q.proof]++; });
    if (date === p.day?.date) count(todaysQuests(p).filter((q) => p.day.status[q.id] === 'done'));
    else if (h && p.chosen.length) {
      count(questWindow(p.chosen, p.started, date, h === 'd' ? 4 : 2).map((id, k) => ({ proof: CATEGORY[id].proof, reward: slotAt(k) })));
    }
    if (h === 'd') { row.xp += REWARD.clear.xp; row.coins += REWARD.clear.coins; }
    out.push(row);
  }
  return out;
}

export const mmss = (sec) => {
  const s = Math.max(0, Math.ceil(sec));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  return (hh ? String(hh).padStart(2, '0') + ':' : '') + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
};
