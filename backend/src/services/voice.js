// ElevenLabs text-to-speech with a file cache, so a repeated line never costs credits twice.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

export const voiceEnabled = Boolean(config.elevenlabs.apiKey);

// "system" -> ELEVENLABS_SYSTEM_VOICE_ID
// "starter1_base" -> ELEVENLABS_VOICE_STARTER1_BASE
export function voiceIdFor(name) {
  if (!name || name === 'system') return config.elevenlabs.systemVoiceId;
  return process.env[`ELEVENLABS_VOICE_${String(name).toUpperCase()}`] || null;
}

export function characterVoiceName(characterId, awakened) {
  return `${characterId}_${awakened ? 'awakened' : 'base'}`;
}

// -> { url, filePath } ; url is served by express.static at /audio
export async function synthesize(text, voiceName = 'system') {
  if (!voiceEnabled) throw new Error('ElevenLabs is not configured');
  const voiceId = voiceIdFor(voiceName);
  if (!voiceId) throw new Error(`No voice id configured for "${voiceName}"`);

  const hash = crypto.createHash('sha1').update(`${voiceId}|${config.elevenlabs.model}|${text}`).digest('hex');
  const fileName = `${hash}.mp3`;
  const filePath = path.join(config.audioDir, fileName);
  const url = `/audio/${fileName}`;

  try {
    await fs.access(filePath);
    return { url, filePath, cached: true };
  } catch { /* not cached yet */ }

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': config.elevenlabs.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({ text, model_id: config.elevenlabs.model }),
    }
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);

  await fs.mkdir(config.audioDir, { recursive: true });
  await fs.writeFile(filePath, Buffer.from(await res.arrayBuffer()));
  return { url, filePath, cached: false };
}
