import { Router } from 'express';
import fs from 'node:fs/promises';
import { synthesize } from '../services/voice.js';
import { httpError } from '../utils/http.js';

const router = Router();

// POST /api/voice  { text, voice: "system" | "starter1_base" | ... } -> audio/mpeg
router.post('/', async (req, res) => {
  const text = String(req.body?.text || '').trim();
  const voice = req.body?.voice || 'system';
  if (!text) throw httpError(400, 'text is required');
  if (text.length > 1000) throw httpError(400, 'text is too long (max 1000 characters)');

  let result;
  try {
    result = await synthesize(text, voice);
  } catch (err) {
    throw httpError(502, `Voice failed: ${err.message}`);
  }
  res.set('Content-Type', 'audio/mpeg');
  res.set('X-Audio-Url', result.url); // lets the frontend reuse the cached file
  res.send(await fs.readFile(result.filePath));
});

export default router;
