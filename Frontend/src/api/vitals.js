// Presage vitals adapter.
// ponytail: simulated heart-rate stream until the Presage SmartSpectra SDK is wired up —
// replace the body of subscribeHeartRate with the SDK's camera-based reading and keep the same callback shape.
import { api } from './client.js';

export const VITALS_LIVE = false;

export function subscribeHeartRate(onReading) {
  let bpm = 74;
  const id = setInterval(() => {
    bpm = Math.round(Math.min(165, Math.max(58, bpm + (Math.random() - 0.4) * 6)));
    onReading({ bpm, at: Date.now(), simulated: !VITALS_LIVE });
  }, 1000);
  return () => clearInterval(id);
}

// [{ at, bpm }] -> [{ minute, avgBpm, minBpm, maxBpm }], the same shape the backend's vitals_per_minute view returns.
export function perMinute(readings) {
  const buckets = new Map();
  for (const r of readings) {
    const minute = Math.floor(r.at / 60e3) * 60e3;
    const b = buckets.get(minute) || { minute, sum: 0, n: 0, minBpm: Infinity, maxBpm: -Infinity };
    b.sum += r.bpm; b.n++;
    b.minBpm = Math.min(b.minBpm, r.bpm); b.maxBpm = Math.max(b.maxBpm, r.bpm);
    buckets.set(minute, b);
  }
  return [...buckets.values()].map(({ minute, sum, n, minBpm, maxBpm }) => ({ minute, avgBpm: Math.round(sum / n), minBpm, maxBpm }));
}

const FLUSH_MS = 5000;
const BATCH = 60;
const MAX_PENDING = 600; // ten minutes offline, then the oldest readings are dropped

// Keeps every reading for the local chart and, when the quest exists on the backend, uploads them
// in batches every 5 seconds to the vitals_readings hypertable.
export function createVitalsRecorder(serverQuestId) {
  const all = [];
  let pending = [];
  let inflight = null;

  async function send() {
    const id = await serverQuestId;
    if (!id || !pending.length) return;
    const batch = pending.splice(0, BATCH);
    try {
      await api.uploadVitals(id, batch);
    } catch (err) {
      pending = [...batch, ...pending].slice(-MAX_PENDING);
      console.warn('Vitals upload failed, will retry:', err.message);
    }
  }
  // One upload at a time; a flush during an upload waits for that one instead of returning early.
  function flush() {
    inflight ||= send().finally(() => { inflight = null; });
    return inflight;
  }
  const timer = setInterval(flush, FLUSH_MS);

  return {
    add(r) {
      all.push(r);
      pending.push({ t: r.at, bpm: r.bpm });
      if (pending.length > MAX_PENDING) pending = pending.slice(-MAX_PENDING);
    },
    series: () => perMinute(all),
    discard() { clearInterval(timer); pending = []; },
    // Sends what is left; resolves to the server quest id (or null when everything stayed local).
    async finish() {
      clearInterval(timer);
      if (!(await serverQuestId)) return null;
      const maxTries = 3 + Math.ceil(pending.length / BATCH);
      await inflight; // an interval upload may still be running (and may put its batch back if it fails)
      for (let tries = 0; pending.length && tries < maxTries; tries++) await flush();
      return serverQuestId;
    },
  };
}
