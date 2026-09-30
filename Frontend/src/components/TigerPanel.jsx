// "Powered by Tiger Data": live numbers from GET /api/stats/db (row counts, compression, query timings).
import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import SystemWindow from './SystemWindow.jsx';
import { Bar } from './ui.jsx';

const mb = (b) => (b == null ? '–' : `${(b / 1024 / 1024).toFixed(b < 10 * 1024 * 1024 ? 1 : 0)} MB`);
const n = (v) => Number(v || 0).toLocaleString('en-US');

export default function TigerPanel() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let alive = true;
    api.dbStats().then((d) => { if (alive) setS(d); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  if (!s) return null;

  const vitals = s.hypertables.find((h) => h.name === 'vitals_readings');
  return (
    <SystemWindow title="POWERED BY TIGER DATA" icon={null}>
      <div className="col" style={{ gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
          <div className="stat"><span className="muted">Heart-rate readings</span><b style={{ fontSize: 18 }}>{n(s.vitalsRows)}</b></div>
          <div className="stat"><span className="muted">Player events</span><b style={{ fontSize: 18 }}>{n(s.eventRows)}</b></div>
          <div className="stat">
            <span className="muted">Vitals compression</span>
            <b style={{ fontSize: 18 }}>{vitals?.ratio != null ? `${vitals.ratio}% smaller` : 'not yet'}</b>
            {vitals?.beforeBytes != null && <span className="muted" style={{ fontSize: 12 }}>{mb(vitals.beforeBytes)} → {mb(vitals.afterBytes)}</span>}
          </div>
          <div className="stat">
            <span className="muted">30-day heart-rate summary</span>
            <b style={{ fontSize: 18 }}>{s.query30Days.summaryViewMs} ms</b>
            <span className="muted" style={{ fontSize: 12 }}>vs {s.query30Days.rawReadingsMs} ms from raw readings</span>
          </div>
        </div>
        <div className="col" style={{ gap: 6 }}>
          <div className="row between" style={{ fontSize: 13 }}>
            <span className="muted">Database size</span><span>{mb(s.databaseBytes)} / {mb(s.freeTierBytes)} free tier</span>
          </div>
          <Bar pct={(s.databaseBytes / s.freeTierBytes) * 100} h={6} label="Database size used of the free tier" />
        </div>
      </div>
    </SystemWindow>
  );
}
