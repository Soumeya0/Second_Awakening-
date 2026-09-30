// Character card: portrait, level, rank, EXP, stats, coins and streak.
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { PROOF_COLOR } from '../api/data.js';
import { STAGES, lookOf, stageOf } from '../api/look.js';
import { RANK_COLOR, rankOf, stats, streak } from '../api/game.js';
import SystemWindow from './SystemWindow.jsx';
import MiniSelf from './MiniSelf.jsx';
import EvolutionTimeline from './EvolutionTimeline.jsx';
import { Bar, CoinIcon } from './ui.jsx';

export default function CharacterCard({ player }) {
  const look = lookOf(player);
  const stage = stageOf(player.level);
  const r = rankOf(player.level);
  const dev = useRef(null);
  return (
    <SystemWindow title="CHARACTER CARD" icon={null} tone="violet">
      <div className="col" style={{ gap: 16 }}>
        <div className="portrait" style={{ '--c': look.outfit }}>
          <button type="button" className="portrait-open" onClick={() => dev.current.showModal()} aria-label="Open character development" aria-haspopup="dialog">
            <MiniSelf look={look} stage={stage} size={170} crop="bust" title={`${player.name}, ${STAGES[stage].title}`} />
          </button>
          <Link to="/customize" className="portrait-edit" aria-label="Customize your character">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
          </Link>
          <span className="portrait-rank" style={{ color: RANK_COLOR[r], borderColor: RANK_COLOR[r] }} aria-label={`Rank ${r}`}>{r}</span>
          <div className="col" style={{ alignItems: 'center', gap: 2 }}>
            <span className="display" style={{ fontSize: 20 }}>{player.name}</span>
            <span className="muted" style={{ fontSize: 13 }}>{STAGES[stage].title}</span>
          </div>
        </div>
        <div className="col" style={{ gap: 8 }}>
          <div className="level-line">LEVEL {player.level}</div>
          <Bar pct={player.xp / 10} h={6} color="var(--violet)" label="Experience" />
          <span className="muted" style={{ fontSize: 12, textAlign: 'center' }}>{player.xp} / 1000 EXP</span>
        </div>
        <dl className="stat-bars">
          {(() => {
            const list = stats(player);
            const top = Math.max(...list.map((x) => x.value)) * 1.1;
            return list.map((st) => (
              <div key={st.name} style={{ '--c': PROOF_COLOR[st.proof] }}>
                <dt>{st.name.slice(0, 3).toUpperCase()}</dt>
                <dd className="stat-track" aria-hidden="true"><span style={{ width: `${(st.value / top) * 100}%` }} /></dd>
                <dd className="stat-val"><span className="sr-only">{st.name} </span>{st.value}</dd>
              </div>
            ));
          })()}
        </dl>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div className="orb-box">
            <span className="orb gold"><CoinIcon size={20} /></span>
            <div className="col" style={{ gap: 0 }}><b className="orb-num">{player.coins}</b><span className="muted">Coins</span></div>
          </div>
          <div className="orb-box">
            <span className="orb">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--violet-soft)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 3c1 3 4 4.5 4 8.5A4 4 0 0 1 8 11.5c0-1.5.7-2.6 1.5-3.5.2 1.6 1 2.5 2 2.5 0-3-1-5 .5-7.5z" /><path d="M6 17c1.5 2.5 3.5 4 6 4s4.5-1.5 6-4" />
              </svg>
            </span>
            <div className="col" style={{ gap: 0 }}><b className="orb-num">{streak(player)}</b><span className="muted">Day streak</span></div>
          </div>
        </div>
      </div>
      <dialog ref={dev} className="dev-dialog" aria-label="Character development" onClick={(e) => { if (e.target === dev.current) dev.current.close(); }}>
        <EvolutionTimeline look={look} stage={stage} level={player.level} />
        <button className="btn btn-light dev-close" onClick={() => dev.current.close()}>Close</button>
      </dialog>
    </SystemWindow>
  );
}
