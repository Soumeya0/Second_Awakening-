// Reads settings from .env once, so the rest of the code never touches process.env directly.
import 'dotenv/config';
import path from 'node:path';

export const config = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL,
  // Game days and the daily summary view are both bucketed in this zone. Changing it later means re-running db:schema.
  timezone: process.env.APP_TIMEZONE || 'America/Toronto',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // DEMO_MODE turns on the /api/demo routes and skips the "wait for the timer" check.
  demoMode: process.env.DEMO_MODE === 'true',
  // AUTH_DISABLED lets you test with curl/Postman before Auth0 is ready. NEVER true on Vultr.
  authDisabled: process.env.AUTH_DISABLED === 'true',

  auth0: {
    domain: process.env.AUTH0_DOMAIN,
    audience: process.env.AUTH0_AUDIENCE,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
  },
  elevenlabs: {
    apiKey: process.env.ELEVENLABS_API_KEY,
    systemVoiceId: process.env.ELEVENLABS_SYSTEM_VOICE_ID,
    model: process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2',
  },
  audioDir: path.resolve(process.env.AUDIO_DIR || 'audio-cache'),
};

export function checkConfig() {
  const missing = [];
  if (!config.databaseUrl) missing.push('DATABASE_URL');
  if (!config.authDisabled && (!config.auth0.domain || !config.auth0.audience)) {
    missing.push('AUTH0_DOMAIN / AUTH0_AUDIENCE (or set AUTH_DISABLED=true for local testing)');
  }
  if (missing.length) {
    console.error('Missing required settings:\n  ' + missing.join('\n  '));
    process.exit(1);
  }
  if (!config.gemini.apiKey) console.warn('No GEMINI_API_KEY: using fallback quests and chapters, and auto-approving photos.');
  if (!config.elevenlabs.apiKey) console.warn('No ELEVENLABS_API_KEY: chapters will have no audio.');
  if (config.authDisabled) console.warn('AUTH_DISABLED=true: anyone can call the API. Local testing only!');
}
