import { config, checkConfig } from './config.js';
import { createApp } from './app.js';
import { checkDatabase } from './db/pool.js';
import { startEndOfDayJob } from './jobs/endOfDayJob.js';

checkConfig();

const { timescaledb } = await checkDatabase();
if (!timescaledb) console.warn('Connected, but the timescaledb extension is missing: run this against a Tiger Data service.');
console.log(`Connected to Tiger Data (TimescaleDB ${timescaledb || 'n/a'})`);

createApp().listen(config.port, () => console.log(`API on http://localhost:${config.port} (demo mode: ${config.demoMode})`));
startEndOfDayJob();
