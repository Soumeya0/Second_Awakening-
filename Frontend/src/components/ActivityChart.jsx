// Last 30 days: quests per day stacked by proof type, with totals. Rows come from GET /api/stats
// (the daily_player_stats continuous aggregate) or, locally, from localDailyStats.
import { PROOF_COLOR, PROOF_LABEL } from '../api/data.js';

const ORDER = ['VITALS', 'FOCUS', 'PHOTO', 'HONOR'];

export default function ActivityChart({ days, source, queryMs }) {
  const W = 300, H = 90, gap = 2;
  const max = Math.max(5, ...days.map((d) => d.quests));
  const bw = W / days.length - gap;
  const totalQuests = days.reduce((a, d) => a + d.quests, 0);
  const totalXp = days.reduce((a, d) => a + d.xp, 0);
  const cleared = days.filter((d) => d.result === 'd').length;

  return (
    <div className="col" style={{ gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        <div className="stat"><span className="muted">Quests</span><b style={{ fontSize: 20 }}>{totalQuests}</b></div>
        <div className="stat"><span className="muted">Net EXP</span><b style={{ fontSize: 20 }}>{totalXp >= 0 ? '+' : ''}{totalXp}</b></div>
        <div className="stat"><span className="muted">Days cleared</span><b style={{ fontSize: 20 }}>{cleared}/{days.length}</b></div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} role="img"
        aria-label={`${totalQuests} quests over the last ${days.length} days, ${cleared} days cleared`}>
        {days.map((d, k) => {
          let top = H;
          return (
            <g key={d.date}>
              <title>{`${d.date}: ${d.quests} quests, ${d.xp} EXP`}</title>
              {ORDER.map((proof) => {
                const h = (d.byProof[proof] / max) * H;
                if (!h) return null;
                top -= h;
                return <rect key={proof} x={k * (bw + gap)} y={top} width={bw} height={h} rx="1" fill={PROOF_COLOR[proof]} />;
              })}
              {!d.quests && <rect x={k * (bw + gap)} y={H - 2} width={bw} height={2} fill="var(--line)" />}
            </g>
          );
        })}
      </svg>
      <div className="row between wrap" style={{ gap: 10, fontSize: 12 }}>
        <div className="row wrap muted" style={{ gap: 12 }}>
          {ORDER.map((p) => (
            <span key={p} className="row" style={{ gap: 5 }}><span className="swatch" style={{ background: PROOF_COLOR[p] }} />{PROOF_LABEL[p]}</span>
          ))}
        </div>
        <span className="mono dim" style={{ fontSize: 10 }}>
          {source === 'server' ? `TIGER DATA · CONTINUOUS AGGREGATE${queryMs != null ? ` · ${queryMs} MS` : ''}` : 'LOCAL'}
        </span>
      </div>
    </div>
  );
}
