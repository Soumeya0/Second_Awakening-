// Builds each day's quests (4 required, hard to easy, plus extras on request): Gemini titles first, category defaults if it fails.
import * as questsDb from '../db/quests.js';
import { CATEGORY } from '../game/content.js';
import { DIFFICULTY_BY_ID, questReward, questSlotsForDay, rankOf, slotsToAdd } from '../game/rules.js';
import { generateQuests } from './gemini.js';

async function draftQuests(user, slots) {
  const categories = slots.map((s) => ({ ...CATEGORY[s.category], difficulty: s.difficulty }));
  let written = [];
  try {
    const recentTitles = await questsDb.recentTitles(user.id);
    written = await generateQuests({ categories, rank: rankOf(user.level), recentTitles });
  } catch (err) {
    if (err.message !== 'Gemini is not configured') console.warn('Quest fallback:', err.message);
  }
  // Never trust the model blindly: proof, duration, and rewards always come from our content.
  return slots.map((s) => {
    const c = CATEGORY[s.category];
    const w = written.find((q) => q.category === s.category && q.title);
    return {
      userId: user.id, date: user.gameDate, category: s.category, kind: s.kind, position: s.position, difficulty: s.difficulty,
      title: String(w?.title || c.title).slice(0, 140),
      description: String(w?.description || c.title).slice(0, 500),
      durationMinutes: c.mins, proof: c.proof,
      rewards: questReward(s.kind, c.proof, s.difficulty),
    };
  });
}

export async function ensureQuestsForDay(user) {
  const slots = questSlotsForDay(user.chosen, user.gameDate, { started: user.started, extra: user.extraToday });
  const existing = await questsDb.listForDay(user.id, user.gameDate);
  const missing = slotsToAdd(slots, existing);
  if (!missing.length) return existing;
  await questsDb.insertMany(await draftQuests(user, missing));
  return questsDb.listForDay(user.id, user.gameDate);
}

// The JSON shape the frontend's quest cards and timer read.
export function questView(q) {
  const c = CATEGORY[q.category];
  return {
    id: String(q.id), category: q.category, name: c?.name || q.category, proof: q.proof, kind: q.kind,
    difficulty: q.difficulty, points: q.difficulty ? DIFFICULTY_BY_ID[q.difficulty].points : null,
    title: q.title, description: q.description, mins: q.durationMinutes,
    status: q.status, startedAt: q.startedAt, endsAt: q.endsAt, completedAt: q.completedAt,
    reward: q.rewards, result: q.status === 'completed' ? q.proofResult : null,
  };
}
