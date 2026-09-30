import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { withTransaction } from '../db/pool.js';
import * as usersDb from '../db/users.js';
import * as questsDb from '../db/quests.js';
import * as progressDb from '../db/progress.js';
import * as eventsDb from '../db/events.js';
import * as vitalsDb from '../db/vitals.js';
import { ensureQuestsForDay, questView } from '../services/quests.js';
import { verifyPhoto, geminiEnabled } from '../services/gemini.js';
import { createChapter } from '../services/story.js';
import { canAddQuest, completeQuest, rankIndex, rankOf, verifyVitals } from '../game/rules.js';
import { playerState, userView } from '../game/userView.js';
import { config } from '../config.js';
import { httpError } from '../utils/http.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) =>
    file.mimetype.startsWith('image/') ? cb(null, true) : cb(httpError(400, 'Photo must be an image')),
});

// The timer uploads every 5 seconds; this leaves room for retries without letting one client flood the table.
const vitalsLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req) => String(req.user.id),
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many vitals uploads, slow down' },
});

const MAX_READINGS_PER_BATCH = 60;
const CLOCK_SLACK_MS = 5_000;
const done = (q) => q.status === 'completed';

async function findTodaysQuest(req) {
  const quest = await questsDb.findOwn(req.user.id, req.params.id);
  if (!quest) throw httpError(404, 'Quest not found');
  if (quest.date !== req.user.gameDate) throw httpError(409, 'This quest is not from today');
  return quest;
}

// GET /api/quests/today
router.get('/today', async (req, res) => {
  const quests = await ensureQuestsForDay(req.user);
  res.json(quests.map(questView));
});

// POST /api/quests/add -> one more quest in a new category, once everything listed is done.
router.post('/add', async (req, res) => {
  const user = req.user;
  const quests = await questsDb.listForDay(user.id, user.gameDate);
  if (!canAddQuest(quests, user.chosen.length)) throw httpError(409, 'Finish every quest listed first (or you already have one in every category)');
  const saved = await usersDb.update(user.id, { extraToday: user.extraToday + 1 });
  res.status(201).json((await ensureQuestsForDay(saved)).map(questView));
});

// POST /api/quests/:id/start -> { quest, endsAt }
router.post('/:id/start', async (req, res) => {
  const quest = await findTodaysQuest(req);
  if (done(quest)) throw httpError(409, 'Quest already completed');
  const started = await questsDb.start(quest.id);
  res.json({ quest: questView(started), endsAt: started.endsAt });
});

// POST /api/quests/:id/cancel -> back to pending ("Give up" on the timer screen)
router.post('/:id/cancel', async (req, res) => {
  const quest = await findTodaysQuest(req);
  if (quest.status !== 'active') throw httpError(409, 'Quest is not running');
  res.json({ quest: questView(await questsDb.cancel(quest.id)) });
});

// POST /api/quests/:id/vitals  { readings: [{ t, bpm?, breathingRate?, focusScore? }] }  (max 60 per batch)
router.post('/:id/vitals', vitalsLimiter, async (req, res) => {
  const quest = await findTodaysQuest(req);
  if (!['VITALS', 'FOCUS'].includes(quest.proof)) throw httpError(400, 'This quest does not use vitals');
  if (quest.status !== 'active') throw httpError(409, 'Start the quest first');
  const readings = req.body?.readings;
  if (!Array.isArray(readings) || !readings.length) throw httpError(400, 'readings must be a non-empty array');
  if (readings.length > MAX_READINGS_PER_BATCH) throw httpError(400, `At most ${MAX_READINGS_PER_BATCH} readings per batch`);

  const from = new Date(quest.startedAt).getTime() - CLOCK_SLACK_MS;
  const to = Math.min(new Date(quest.endsAt).getTime(), Date.now()) + CLOCK_SLACK_MS;
  const inRange = (v, lo, hi) => v == null || (Number.isFinite(Number(v)) && Number(v) >= lo && Number(v) <= hi);
  const valid = readings
    .map((r) => ({
      t: new Date(r?.t).getTime(),
      bpm: r?.bpm == null ? null : Math.round(Number(r.bpm)),
      breathingRate: r?.breathingRate ?? null,
      focusScore: r?.focusScore ?? null,
    }))
    .filter((r) => r.t >= from && r.t <= to
      && inRange(r.bpm, 25, 250) && inRange(r.breathingRate, 0, 80) && inRange(r.focusScore, 0, 1)
      && (r.bpm != null || r.breathingRate != null || r.focusScore != null));

  const saved = valid.length ? await vitalsDb.insertBatch(req.user.id, quest.id, valid) : 0;
  res.json({ received: readings.length, saved });
});

// GET /api/quests/:id/vitals -> per-minute series (continuous aggregate) + summary, for the reward chart
router.get('/:id/vitals', async (req, res) => {
  const quest = await questsDb.findOwn(req.user.id, req.params.id);
  if (!quest) throw httpError(404, 'Quest not found');
  const [series, summary] = await Promise.all([
    vitalsDb.perMinute(req.user.id, quest.id, quest.startedAt),
    vitalsDb.summary(req.user.id, quest.id, quest.startedAt),
  ]);
  res.json({ questId: String(quest.id), proof: quest.proof, series, summary });
});

// POST /api/quests/:id/complete
//   PHOTO quests:          multipart/form-data with a "photo" file (checked by Gemini)
//   VITALS / FOCUS quests: no body; verified from the readings uploaded during the timer
//   HONOR quests:          no body
router.post('/:id/complete', upload.single('photo'), async (req, res) => {
  const user = req.user;
  const quest = await findTodaysQuest(req);
  if (done(quest)) throw httpError(409, 'Quest already completed');
  if (quest.status !== 'active') throw httpError(409, 'Start the quest first');
  if (!config.demoMode && new Date(quest.endsAt) > new Date()) {
    throw httpError(409, 'The timer is still running', { endsAt: quest.endsAt });
  }

  // 1. Verify (outside the transaction: Gemini and the vitals summary can take a moment)
  let proofResult;
  if (quest.proof === 'PHOTO') {
    if (!req.file) throw httpError(400, 'This quest needs a photo');
    const attempts = (quest.proofResult?.attempts || 0) + 1;
    if (geminiEnabled) {
      let result;
      try {
        result = await verifyPhoto({ buffer: req.file.buffer, mimeType: req.file.mimetype, quest });
      } catch (err) {
        console.warn('Photo check failed, accepting without verification:', err.message);
        result = { verified: false, reason: 'We could not check the photo right now, so it counts without verification.', accepted: true };
      }
      if (!result.verified && !result.accepted) {
        await questsDb.setProofResult(quest.id, { ...quest.proofResult, attempts, lastReason: result.reason });
        return res.status(422).json({ error: 'Photo not accepted', reason: result.reason, attempts });
      }
      proofResult = { verified: Boolean(result.verified), reason: result.reason, attempts };
    } else {
      proofResult = { verified: true, reason: 'Photo received (Gemini not configured, auto-approved).', attempts };
    }
  } else if (quest.proof === 'VITALS' || quest.proof === 'FOCUS') {
    const summary = await vitalsDb.summary(user.id, quest.id, quest.startedAt);
    proofResult = { ...verifyVitals(quest.category, summary), summary };
    // Not verified still completes the quest, so a camera hiccup never costs the player their day.
  } else {
    proofResult = { verified: false, reason: 'Completed on the honor system.' };
  }

  // 2. Rewards: user, bars, quest, and events change together or not at all.
  const out = await withTransaction(async (db) => {
    const q = await questsDb.findOwn(user.id, quest.id, db, { forUpdate: true });
    if (done(q)) throw httpError(409, 'Quest already completed');
    const u = await usersDb.findById(user.id, db, { forUpdate: true });
    const dayQuests = await questsDb.listForDay(u.id, q.date, db);
    const otherRequiredDone = dayQuests.filter((x) => x.kind === 'required' && x.id !== q.id).every(done);

    const p = playerState(u, await progressDb.getBars(u.id, db));
    const reward = completeQuest(p, q, {
      requiredDoneAfter: otherRequiredDone,
      alreadyCleared: q.kind !== 'required' && otherRequiredDone,
    });
    const rewardOut = { ...reward, verified: proofResult.verified, reason: proofResult.reason };

    const saved = await usersDb.update(u.id, {
      level: p.level, xp: p.xp, coins: p.coins, materials: p.materials, stats: p.stats, questsDone: p.questsDone,
    }, db);
    await progressDb.saveBars(u.id, p.bars, db);
    const completed = await questsDb.complete(q.id, { rewards: rewardOut, proofResult }, db);
    await eventsDb.record(db, {
      userId: u.id, type: 'quest_completed', category: q.category, proof: q.proof, xp: reward.xp, coins: reward.coins,
      data: { questId: q.id, kind: q.kind, verified: proofResult.verified, cleared: Boolean(reward.cleared) },
    });
    if (reward.levelUps) {
      await eventsDb.record(db, { userId: u.id, type: 'level_up', data: { from: u.level, to: p.level } });
    }
    return { user: saved, reward: rewardOut, quest: completed, levelBefore: u.level };
  });

  if (rankIndex(rankOf(out.user.level)) > rankIndex(rankOf(out.levelBefore))) {
    await createChapter(out.user, 'rankUp', { rankAfter: rankOf(out.user.level) });
  }
  res.json({ reward: out.reward, quest: questView(out.quest), me: await userView(out.user) });
});

export default router;
