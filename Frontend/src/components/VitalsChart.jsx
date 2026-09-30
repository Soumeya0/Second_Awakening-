// Per-minute heart rate for a finished vitals quest: average line over a min–max band.
// Reads the backend's vitals_per_minute continuous aggregate when the quest was uploaded, else the local readings.
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function VitalsChart({ vitals }) {
  const [server, setServer] = useState(null);
  useEffect(() => {
    if (!vitals?.questId) return;
    let alive = true;
    api.questVitals(vitals.questId)
      .then((d) => { if (alive && d.series.length) setServer(d.series); })
      .catch(() => {});
    return () => { alive = false; };
  }, [vitals?.questId]);

  const series = server || vitals?.series || [];
  if (!series.length) return null;

  const lo = Math.min(...series.map((s) => s.minBpm)) - 5;
  const hi = Math.max(...series.map((s) => s.maxBpm)) + 5;
  const W = 290, H = 70;
  const x = (k) => (series.length === 1 ? W / 2 : (k / (series.length - 1)) * W);
  const y = (b) => H - ((b - lo) / Math.max(1, hi - lo)) * H;
  const band = [...series.map((s, k) => `${x(k)},${y(s.maxBpm)}`), ...series.map((s, k) => `${x(k)},${y(s.minBpm)}`).reverse()].join(' ');
  const line = series.map((s, k) => `${x(k)},${y(s.avgBpm)}`).join(' ');
  const avg = Math.round(series.reduce((a, s) => a + s.avgBpm, 0) / series.length);
  const peak = Math.max(...series.map((s) => s.maxBpm));

  return (
    <div className="col" style={{ gap: 6, padding: '12px 14px', borderRadius: 'var(--r-md)', background: 'var(--deep)' }}>
      <div className="row between">
        <span className="mono" style={{ color: 'var(--red)', fontSize: 11 }}>HEART RATE · PER MINUTE</span>
        <span className="mono dim" style={{ fontSize: 10 }}>{server ? 'TIGER DATA' : 'LOCAL'}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} role="img"
        aria-label={`Heart rate over ${series.length} minutes: average ${avg} bpm, peak ${peak} bpm`}>
        <polygon points={band} fill="var(--red)" fillOpacity=".15" />
        <polyline points={line} fill="none" stroke="var(--red)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div className="row between muted" style={{ fontSize: 13 }}>
        <span>Avg <b style={{ color: 'var(--fg)' }}>{avg}</b> bpm</span>
        <span>Peak <b style={{ color: 'var(--fg)' }}>{peak}</b> bpm</span>
        <span>{series.length} min</span>
      </div>
    </div>
  );
}
