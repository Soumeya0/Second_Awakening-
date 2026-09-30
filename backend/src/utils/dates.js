// Game days are "YYYY-MM-DD" strings in APP_TIMEZONE (the same zone the daily summary view buckets by).
import { config } from '../config.js';

export function todayStr(date = new Date()) {
  return date.toLocaleDateString('en-CA', { timeZone: config.timezone }); // en-CA formats as YYYY-MM-DD
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
