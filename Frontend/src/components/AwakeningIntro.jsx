// The Rank S reveal shown when the judge demo starts: the rank ladder lights up E → S, then the Monarch appears.
import { usePlayer } from '../api/player.jsx';
import { RANKS, streak } from '../api/game.js';
import { STAGES, lookOf } from '../api/look.js';
import MiniSelf from './MiniSelf.jsx';

export default function AwakeningIntro() {
  const { player, intro, closeIntro } = usePlayer();
  if (!intro) return null;
  const facts = [
    [`${streak(player)} days`, 'streak'],
    [player.questsDone, 'quests cleared'],
    [`Lv ${player.level}`, 'Rank S'],
    [player.coins.toLocaleString('en-US'), 'coins']
  ];
  return (
    <div className="awaken" role="dialog" aria-modal="true" aria-labelledby="awaken-title">
      <div className="awaken-inner">
        <span className="mono awaken-sys">[SYSTEM] The Player has reached Rank S.</span>
        <div className="row awaken-ladder" aria-hidden="true">
          {RANKS.map(([r], k) => <span key={r} style={{ animationDelay: `${0.25 + k * 0.22}s` }}>{r}</span>)}
        </div>
        <div className="awaken-hero">
          <MiniSelf look={lookOf(player)} stage={STAGES.length - 1} size={230} title={`${player.name} as ${STAGES[STAGES.length - 1].title}`} />
        </div>
        <h1 id="awaken-title" className="awaken-title">SECOND AWAKENING<br />COMPLETE</h1>
        <p className="soft" style={{ margin: 0 }}>{player.name} · {STAGES[STAGES.length - 1].title}</p>
        <div className="awaken-facts">
          {facts.map(([v, l]) => <div key={l}><b>{v}</b><span>{l}</span></div>)}
        </div>
        <button className="btn btn-blue" onClick={closeIntro} autoFocus>Enter as Rank S</button>
        <span className="dim" style={{ fontSize: 12 }}>Judge demo · the real save is untouched</span>
      </div>
    </div>
  );
}
