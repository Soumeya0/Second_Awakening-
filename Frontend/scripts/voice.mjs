// Records the story narration with ElevenLabs, once, into public/story/voice/scene-N.mp3.
// Run from Frontend/: npm run voice          (skips chapters that already have a recording)
//                     npm run voice -- --force  (re-records every chapter, e.g. after editing the story text)
// Needs ELEVENLABS_API_KEY in Frontend/.env.local. The key stays on your machine: the site only ships the mp3s.
import fs from 'node:fs';
import { SCENES, narration } from '../src/api/story.js';

// Brian: one of ElevenLabs' built-in voices, which free plans may use through the API.
// Library voices (like J2FGlQG8Gd7x8uEDt2H8) need a paid plan; set ELEVENLABS_VOICE_ID in .env.local to use one.
const BRIAN = 'nPczCjzI2devNBz1zQrb';
const MODEL_ID = 'eleven_v3';
const OUT = new URL('../public/story/voice/', import.meta.url);

try { process.loadEnvFile(new URL('../.env.local', import.meta.url)); } catch { /* fall back to the shell environment */ }
const key = process.env.ELEVENLABS_API_KEY;
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || BRIAN;
if (!key) {
  console.error('Missing ELEVENLABS_API_KEY. Add it to Frontend/.env.local:  ELEVENLABS_API_KEY=your-key');
  process.exit(1);
}

const force = process.argv.includes('--force');
fs.mkdirSync(OUT, { recursive: true });

for (const scene of SCENES) {
  const file = new URL(`${scene.img}.mp3`, OUT);
  if (fs.existsSync(file) && !force) { console.log(`skip  ${scene.img} (already recorded)`); continue; }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text: narration(scene), model_id: MODEL_ID })
  });
  if (!res.ok) {
    console.error(`ElevenLabs refused ${scene.img}: ${res.status} ${await res.text()}`);
    process.exit(1);
  }
  fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  console.log(`saved ${scene.img}.mp3`);
}
