// Creates story chapters: text now (Gemini or fallback), audio in the background (ElevenLabs).
import * as chaptersDb from '../db/chapters.js';
import { CATEGORY } from '../game/content.js';
import { rankOf } from '../game/rules.js';
import { writeChapter } from './gemini.js';
import { synthesize, voiceEnabled } from './voice.js';

const hours = (h) => (h < 1 ? `${Math.round(h * 60)} minutes` : `${h} hour${h > 1 ? 's' : ''}`);

const FALLBACK_CHAPTERS = {
  intro:    (n) => ({ title: 'The First Awakening', text: `The System stirs. "Player detected." Light gathers, and ${n} opens their eyes for the first time. "Your paths are chosen. Walk them every day, and you will grow. Abandon them, and the Rift will take you." ${n} clenches a fist. The journey begins.` }),
  rankUp:   (n, d) => ({ title: `Rank ${d.rankAfter}`, text: `The System's voice rings out: "Rank up confirmed. Rank ${d.rankAfter}." A new mark burns onto ${n}'s shoulder. Days of steady effort have become real strength. "Do not stop now," the System warns. "Higher ranks bring harder trials."` }),
  banished: (n, d) => ({ title: 'Banished to the Rift', text: `"Daily quests failed." The ground splits open, and ${n} falls into the Rift, a cold dimension without light. ${d.expLost} EXP bleeds away into the dark. "Return by keeping your promises," the System says. "The Rift holds you for ${hours(d.banishHours)}."` }),
  returned: (n) => ({ title: 'Return from the Rift', text: `A crack of light. ${n} climbs out of the Rift, tired but unbroken. "Welcome back," says the System. "The Rift remembers you. Make sure it never sees you again."` }),
};

export async function createChapter(user, type, details = {}) {
  const playerName = user.name || 'Player';
  let content;
  try {
    content = await writeChapter({
      type, playerName, rank: rankOf(user.level), streak: details.streak ?? 0,
      categories: user.chosen.map((c) => CATEGORY[c]?.name || c), details,
    });
  } catch (err) {
    if (err.message !== 'Gemini is not configured') console.warn('Chapter fallback:', err.message);
    content = FALLBACK_CHAPTERS[type](playerName, details);
  }

  const chapter = await chaptersDb.create({
    userId: user.id, type, title: content.title, text: content.text,
    audioStatus: voiceEnabled ? 'pending' : 'none',
  });

  if (voiceEnabled) {
    // Not awaited: the request returns right away and the audio link appears when ready.
    synthesize(content.text, 'system')
      .then(({ url }) => chaptersDb.setAudio(chapter.id, { audioUrl: url, audioStatus: 'ready' }))
      .catch((err) => {
        console.warn('Chapter audio failed:', err.message);
        return chaptersDb.setAudio(chapter.id, { audioStatus: 'failed' });
      });
  }
  return chapter;
}
