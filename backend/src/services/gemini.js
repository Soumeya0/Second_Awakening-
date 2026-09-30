// Gemini calls. The Gemini teammate owns the prompts; keep these three function
// signatures the same and the rest of the backend will keep working.
// Every function throws on failure; callers catch and use fallbacks.
import { GoogleGenAI } from '@google/genai';
import { config } from '../config.js';

const ai = config.gemini.apiKey ? new GoogleGenAI({ apiKey: config.gemini.apiKey }) : null;
export const geminiEnabled = Boolean(ai);

// Busy (503) and rate-limited (429) answers are common and short-lived: retry, then try the fallback model.
const RETRY_DELAYS_MS = [1000, 3000];
const busy = (err) => err?.status === 429 || err?.status === 503;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function askJson(contents, schema) {
  if (!ai) throw new Error('Gemini is not configured');
  const models = [...new Set([config.gemini.model, config.gemini.fallbackModel].filter(Boolean))];
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const res = await ai.models.generateContent({
          model,
          contents,
          config: { responseMimeType: 'application/json', responseJsonSchema: schema },
        });
        return JSON.parse(res.text);
      } catch (err) {
        if (!busy(err)) throw err;
        lastErr = err;
        if (attempt < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }
  throw lastErr;
}

const PROOF_HINT = {
  PHOTO: 'proven with a photo: say what the photo should show',
  VITALS: 'proven with camera heart-rate/breathing readings: make it physical enough to raise the heart rate (or, for yoga, slow the breath)',
  FOCUS: 'proven by a focus score during the session: one uninterrupted block',
  HONOR: 'honor system',
};

// The day's 4 quests run hard to easy; extras (difficulty null) stay light.
const DIFFICULTY_HINT = {
  hard: 'HARD: the toughest quest of the day, a real stretch for the player',
  medium: 'MEDIUM: a solid challenge that takes real effort',
  'medium-easy': 'MEDIUM-EASY: steady and comfortable, a little effort',
  easy: 'EASY: a quick win anyone can do today',
};

// categories: [{ id, name, proof, mins, title, difficulty }] -> [{ category, title, description }]
export async function generateQuests({ categories, rank, recentTitles }) {
  const lines = categories.map((c) =>
    `- ${c.id} (${c.name}, ${c.mins} minutes, ${DIFFICULTY_HINT[c.difficulty] || 'EXTRA: light, optional'}, ${PROOF_HINT[c.proof]}). Example: "${c.title}"`);
  const prompt = `You write daily quests for a habit app styled like an RPG.
Write exactly one quest for each of these categories, sized to fit the given minutes:
${lines.join('\n')}
Match each quest to its difficulty: within the same minutes, a hard quest asks for more intensity, volume, or
precision than an easy one. The player is rank ${rank} (E is a beginner, S is a veteran); higher ranks get
slightly more ambitious quests at every difficulty.
Quests must be safe, realistic, doable in one session, and specific. Titles under 60 characters,
descriptions one or two sentences.
Avoid repeating these recent quests: ${recentTitles.join('; ') || 'none'}.`;
  const schema = {
    type: 'object',
    properties: {
      quests: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            category: { type: 'string', enum: categories.map((c) => c.id) },
            title: { type: 'string' },
            description: { type: 'string' },
          },
          required: ['category', 'title', 'description'],
        },
      },
    },
    required: ['quests'],
  };
  const out = await askJson(prompt, schema);
  return out.quests;
}

// -> { verified, confidence, reason }
export async function verifyPhoto({ buffer, mimeType, quest }) {
  const prompt = `A user of a habit app says this photo proves they completed the quest:
"${quest.title}: ${quest.description}".
Decide whether the photo reasonably shows the quest was done. Be fair, not strict:
approve normal real-life photos. Reject only if the photo clearly does not match.
Give a one-sentence reason addressed to the user.`;
  const schema = {
    type: 'object',
    properties: {
      verified: { type: 'boolean' },
      confidence: { type: 'number' },
      reason: { type: 'string' },
    },
    required: ['verified', 'confidence', 'reason'],
  };
  return askJson(
    [{ inlineData: { mimeType, data: buffer.toString('base64') } }, { text: prompt }],
    schema
  );
}

// -> { title, text }   (text under ~45 seconds when spoken, about 110 words)
export async function writeChapter({ type, playerName, rank, categories, streak, details }) {
  const prompt = `Write a short story chapter for a habit app told like an original anime/RPG.
The "System" narrates; the player's character is ${playerName}.
Chapter type: ${type}. Player rank: ${rank}. Current streak: ${streak} days.
The player's real-life paths: ${categories.join(', ')}.
What happened: ${JSON.stringify(details || {})}.
The Rift is a dark dimension where characters are banished when their player misses a day.
Keep it under 110 words, vivid, and encouraging. Use only original characters and places.`;
  const schema = {
    type: 'object',
    properties: { title: { type: 'string' }, text: { type: 'string' } },
    required: ['title', 'text'],
  };
  return askJson(prompt, schema);
}
