// All game math lives here as pure functions (no database), so it is easy to test and tune.
// The rules mirror frontend/src/api/game.js; the backend is the source of truth once the app is connected.
// Functions that take a player state `p` mutate it: { level, xp, coins, chosen, bars, materials, stats, items, questsDone }.
import { CATEGORY, MATERIAL, STAT_OF } from './content.js';

export const RANKS = [['E', 1], ['D', 5], ['C', 10], ['B', 20], ['A', 35], ['S', 50]];
export const XP_PER_LEVEL = 1000;
export const BAR_TARGET = 10;
// The 4 daily quests, hardest first. A required quest's EXP is its points.
export const DIFFICULTY = [
  { id: 'hard', name: 'Hard', points: 50 },
  { id: 'medium', name: 'Medium', points: 30 },
  { id: 'medium-easy', name: 'Medium-easy', points: 20 },
  { id: 'easy', name: 'Easy', points: 10 },
];
export const DIFFICULTY_BY_ID = Object.fromEntries(DIFFICULTY.map((d) => [d.id, d]));
export const REQUIRED_PER_DAY = DIFFICULTY.length;
export const REWARD = {
  required: { coins: 10, qty: 1 },
  bonus: { xp: 40, coins: 20, qty: 2 }, // only quests generated before difficulties existed
  extra: { xp: 20, coins: 8, qty: 1 },
  clear: { xp: 50, coins: 25 },
};
export const RIFT = { xpPerDay: 150, coinsPerDay: 25, hoursPerDay: 1, shieldHours: 0.5 };

export const rankOf = (level) => RANKS.filter((r) => level >= r[1]).pop()[0];
export const totalXp = (p) => (p.level - 1) * XP_PER_LEVEL + p.xp;
export const rankIndex = (rank) => RANKS.findIndex((r) => r[0] === rank);

// First level of the next rank (demo mode jumps to one level below it).
export function nextRankLevel(level) {
  const next = RANKS.find((r) => r[1] > level);
  return next ? next[1] : null;
}

// Level up needs 1000 EXP and every chosen category bar full; bars reset after. Returns levels gained.
export function gain(p, xp, coins) {
  const before = p.level;
  p.xp += xp;
  p.coins += coins;
  while (p.xp >= XP_PER_LEVEL && p.chosen.every((id) => (p.bars[id] || 0) >= BAR_TARGET)) {
    p.xp -= XP_PER_LEVEL;
    p.level++;
    p.chosen.forEach((id) => { p.bars[id] = 0; });
  }
  return p.level - before;
}

// Game days since the player started: 0 on their first day.
export const dayNumber = (started, date) => Math.round((Date.parse(date) - Date.parse(started)) / 864e5);

// A window of 4 categories over the player's chosen list, hardest first, moving back one category a day (and
// wrapping around). With 10 categories: day 1 is 1, 2, 3, 4 (hard to easy), day 2 is 10, 1, 2, 3, day 3 is 9, 10, 1, 2.
// So each category steps down one difficulty a day. Extras continue the window; a category never repeats in one day.
export function questSlotsForDay(chosen, date, { started = date, extra = 0 } = {}) {
  const n = chosen.length;
  if (!n) return [];
  const off = (((-dayNumber(started, date)) % n) + n) % n;
  const count = Math.min(n, REQUIRED_PER_DAY + extra);
  return Array.from({ length: count }, (_, k) => ({ category: chosen[(off + k) % n], ...slotAt(k) }));
}

const slotAt = (k) => (k < REQUIRED_PER_DAY
  ? { position: k, kind: 'required', difficulty: DIFFICULTY[k].id }
  : { position: k, kind: 'extra', difficulty: null });

// Which of today's slots still need a quest. Once a day has quests its required ones are fixed:
// anything added later (an extra quest, or new categories picked mid-day) goes after them as an extra,
// so changing categories can't add required quests or pay the daily clear bonus twice.
export function slotsToAdd(slots, existing) {
  const have = new Set(existing.map((q) => q.category));
  const missing = slots.filter((s) => !have.has(s.category));
  if (!existing.length) return missing;
  const room = Math.max(0, slots.length - existing.length);
  return missing.slice(0, room).map((s, i) => ({ ...s, ...slotAt(existing.length + i) }));
}

export function questReward(kind, proof, difficulty) {
  const xp = kind === 'required' ? DIFFICULTY_BY_ID[difficulty]?.points ?? DIFFICULTY.at(-1).points : REWARD[kind].xp;
  return { ...REWARD[kind], xp, material: MATERIAL[proof] };
}

// Extra quests unlock once everything listed today is done, one new category each.
export function canAddQuest(quests, chosenCount) {
  return quests.length < chosenCount && quests.every((q) => q.status === 'completed');
}

// requiredDoneAfter: every required quest of the day is complete once this one counts.
// Returns the reward shape the frontend's RewardPopup reads.
export function completeQuest(p, quest, { requiredDoneAfter, alreadyCleared }) {
  const c = CATEGORY[quest.category];
  const base = questReward(quest.kind, quest.proof, quest.difficulty);
  const r = {
    category: c.name, difficulty: quest.difficulty, xp: base.xp, coins: base.coins, material: base.material, qty: base.qty,
    barFrom: p.bars[quest.category] || 0,
  };
  p.bars[quest.category] = Math.min(BAR_TARGET, r.barFrom + 1);
  r.barTo = p.bars[quest.category];
  p.materials[r.material.name] = (p.materials[r.material.name] || 0) + r.qty;
  p.questsDone++;
  p.stats[quest.proof] = (p.stats[quest.proof] || 0) + 1;
  r.stat = STAT_OF[quest.proof];
  r.levelUps = gain(p, r.xp, r.coins);
  if (!alreadyCleared && requiredDoneAfter) {
    r.levelUps += gain(p, REWARD.clear.xp, REWARD.clear.coins);
    r.xp += REWARD.clear.xp;
    r.coins += REWARD.clear.coins;
    r.cleared = true;
  }
  return r;
}

// cleared: all 4 required done. partial: at least one quest done. missed: nothing.
export function dayResult(quests) {
  const required = quests.filter((q) => q.kind === 'required');
  if (required.length && required.every((q) => q.status === 'completed')) return 'cleared';
  return quests.some((q) => q.status === 'completed') ? 'partial' : 'missed';
}

// Banish the player for `days` newly failed days; the time grows with the failed run (`hoursFor`).
// A Ward potion (shield) is used up and cuts the banishment to 30 minutes. Records exactly what was lost.
export function sendToRift(p, days = 1, { hoursFor = days, now = Date.now() } = {}) {
  const before = { total: totalXp(p), level: p.level, rank: rankOf(p.level), coins: p.coins };
  p.coins -= Math.min(p.coins, RIFT.coinsPerDay * days);
  p.xp -= RIFT.xpPerDay * days;
  while (p.xp < 0 && p.level > 1) { p.level--; p.xp += XP_PER_LEVEL; }
  p.xp = Math.max(0, p.xp);
  let hours = RIFT.hoursPerDay * hoursFor;
  if (p.items.shield) { p.items.shield--; hours = RIFT.shieldHours; }
  return {
    until: now + hours * 3600e3, hours, days: hoursFor, seen: false, returned: false,
    lost: {
      xp: before.total - totalXp(p), coins: before.coins - p.coins,
      levelFrom: before.level, levelTo: p.level, rankFrom: before.rank, rankTo: rankOf(p.level),
    },
  };
}

// history: { 'YYYY-MM-DD': 'd' | 'p' }. Owned streak freezes bridge gaps (as on the frontend, they are not used up).
export function streak(history, { today, started, freezes = 0 }) {
  let n = 0;
  const d = new Date(today + 'T12:00:00Z');
  const key = () => d.toISOString().slice(0, 10);
  if (history[key()] !== 'd') d.setUTCDate(d.getUTCDate() - 1);
  for (let guard = 0; guard < 3650; guard++) {
    const k = key();
    if (history[k] === 'd') n++;
    else if (freezes > 0 && k >= started) freezes--;
    else break;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return n;
}

// ---------- vitals (Presage) ----------
// summary is computed in SQL from vitals_readings for one quest:
// { samples, startBpm, peakBpm, avgBpm, startBreathing, endBreathing, avgFocus }
const HR_RISE_NEEDED = 15;
const FOCUS_NEEDED = 0.7;

export function verifyVitals(category, summary) {
  if (!summary || !summary.samples) return { verified: false, reason: 'No vitals received; counted without verification.' };
  const c = CATEGORY[category];
  if (c?.proof === 'FOCUS') {
    if (summary.avgFocus == null) return { verified: false, reason: 'No focus readings received; counted without verification.' };
    const pct = Math.round(summary.avgFocus * 100);
    return summary.avgFocus >= FOCUS_NEEDED
      ? { verified: true, reason: `Stayed focused ${pct}% of the session.` }
      : { verified: false, reason: `Focus averaged ${pct}% (needs ${FOCUS_NEEDED * 100}%).` };
  }
  if (category === 'yoga') {
    if (summary.startBreathing != null && summary.endBreathing != null) {
      return summary.endBreathing < summary.startBreathing
        ? { verified: true, reason: `Breathing slowed from ${Math.round(summary.startBreathing)} to ${Math.round(summary.endBreathing)} breaths/min.` }
        : { verified: false, reason: 'Breathing did not slow down.' };
    }
    return summary.avgBpm < summary.startBpm
      ? { verified: true, reason: 'Heart rate settled during the flow.' }
      : { verified: false, reason: 'Heart rate did not settle.' };
  }
  if (c?.proof === 'VITALS') {
    const rise = Math.round(summary.peakBpm - summary.startBpm);
    return rise >= HR_RISE_NEEDED
      ? { verified: true, reason: `Heart rate rose ${rise} bpm above your starting rate.` }
      : { verified: false, reason: `Heart rate only rose ${Math.max(0, rise)} bpm (needs ${HR_RISE_NEEDED}).` };
  }
  return { verified: false, reason: 'This category is not verified by vitals.' };
}
