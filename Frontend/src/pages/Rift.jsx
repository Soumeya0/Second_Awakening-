// Banishment screen: character trapped in the Rift, countdown, greyed-out apps, exactly what was lost.
import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { BLOCKED_APPS } from '../api/data.js';
import { lookOf, stageOf } from '../api/look.js';
import MiniSelf from '../components/MiniSelf.jsx';
import { RANK_COLOR, drinkPotion, mmss } from '../api/game.js';
import SystemWindow from '../components/SystemWindow.jsx';

function TrappedCharacter({ look, stage }) {
  return (
    <svg viewBox="0 0 300 320" style={{ width: 260, maxWidth: '70vw' }} role="img" aria-label="Your character, trapped inside the Rift">
      <path className="rift-glow" d="M150 10 L205 70 L185 120 L240 170 L195 230 L215 300 L150 270 L85 305 L100 235 L55 175 L110 125 L90 65 Z"
        fill="var(--red-tint)" stroke="var(--red)" strokeWidth="3" strokeLinejoin="round" />
      <path d="M150 40 L185 85 L170 125 L210 170 L175 215 L185 270 L150 250 L115 272 L125 218 L90 172 L130 128 L115 82 Z" fill="var(--bg)" />
      <g opacity="0.6"><MiniSelf look={look} stage={stage} x={113} y={118} size={80} /></g>
      {[122, 138, 154, 170, 186].map((x) => <line key={x} x1={x} y1="110" x2={x} y2="205" stroke="var(--red)" strokeWidth="2.5" opacity="0.8" />)}
      <line x1="112" y1="110" x2="194" y2="110" stroke="var(--red)" strokeWidth="3" />
      <line x1="112" y1="205" x2="194" y2="205" stroke="var(--red)" strokeWidth="3" />
    </svg>
  );
}

export default function Rift() {
  const { player, update } = usePlayer();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const rift = player.rift;

  useEffect(() => {
    if (rift && !rift.seen) update((p) => { p.rift.seen = true; });
  }, [rift, update]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!rift) return <Navigate to="/dashboard" replace />;

  const left = (rift.until - now) / 1000;
  const free = left <= 0;
  const { lost } = rift;
  const leave = () => { update((p) => { p.rift = null; }); navigate('/dashboard'); };

  return (
    <div className="fullscreen" style={{ background: 'radial-gradient(circle at 50% 35%, var(--red-tint) 0, var(--bg) 60%)' }}>
      <span className="mono" style={{ fontSize: 13, letterSpacing: '.16em', color: 'var(--red)' }}>
        [BANISHED] {rift.days > 1 ? `${rift.days} DAYS OF QUESTS FAILED` : 'DAILY QUESTS FAILED'}
      </span>
      <TrappedCharacter look={lookOf(player)} stage={stageOf(player.level)} />
      <h1 className="display" style={{ fontSize: 'clamp(28px, 4vw, 40px)' }}>{player.name} is trapped in the Rift.</h1>
      <div role="timer" aria-label="Time until release" style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: 'clamp(56px, 12vw, 110px)', lineHeight: 1 }}>
        {free ? '00:00' : mmss(left)}
      </div>

      <SystemWindow title="PENALTY" tone="red" style={{ width: 520, maxWidth: '100%', textAlign: 'left' }} aria-label="What you lost">
        <p className="sys-note">[You failed the daily quest. The following has been taken.]</p>
        <div className="col" style={{ gap: 0 }}>
          <div className="loss-row"><span className="muted">EXP</span><b style={{ color: 'var(--red)' }}>−{lost.xp}</b></div>
          <div className="loss-row"><span className="muted">Coins</span><b style={{ color: 'var(--red)' }}>−{lost.coins}</b></div>
          <div className="loss-row"><span className="muted">Level</span>
            <b>{lost.levelFrom === lost.levelTo ? `${lost.levelTo} (kept)` : <>{lost.levelFrom} → <span style={{ color: 'var(--red)' }}>{lost.levelTo}</span></>}</b></div>
          <div className="loss-row"><span className="muted">Rank</span>
            <b>{lost.rankFrom === lost.rankTo
              ? <span style={{ color: RANK_COLOR[lost.rankTo] }}>{lost.rankTo} (kept)</span>
              : <><span style={{ color: RANK_COLOR[lost.rankFrom] }}>{lost.rankFrom}</span> → <span style={{ color: RANK_COLOR[lost.rankTo] }}>{lost.rankTo}</span></>}</b></div>
        </div>
      </SystemWindow>

      <div className="col" style={{ alignItems: 'center', gap: 10 }}>
        <span className="mono dim">LOCKED WHILE YOU’RE IN THE RIFT</span>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          {BLOCKED_APPS.map((a) => <span key={a} className="app-chip">{a}</span>)}
        </div>
      </div>

      <p className="soft" style={{ fontSize: 16, maxWidth: 560, lineHeight: 1.5 }}>Finish today’s quests so tomorrow’s banishment doesn’t grow by another hour.</p>
      {!free && player.items.revival > 0 && (
        <button className="btn-danger" style={{ alignSelf: "center" }} onClick={() => { update((p) => { drinkPotion(p, 'revival'); }); navigate('/dashboard'); }}>
          Drink a Revival draught ({player.items.revival} left) and escape
        </button>
      )}
      {free
        ? <button className="btn btn-gold" onClick={leave}>Escape the Rift</button>
        : <button className="btn btn-light" onClick={() => navigate('/dashboard')}>Back to today’s quests</button>}
    </div>
  );
}
