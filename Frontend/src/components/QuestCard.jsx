// One quest row: icon · title with progress bar · stat reward — the "100 push-ups | +5 STRENGTH" layout.
import { Link } from 'react-router-dom';
import { PROOF_COLOR, PROOF_LABEL } from '../api/data.js';
import { STAT_OF } from '../api/game.js';
import { CoinIcon, MaterialIcon, ProofChip } from './ui.jsx';


export default function QuestCard({ quest, status }) {
  const active = typeof status === 'number';
  const done = status === 'done';
  const c = PROOF_COLOR[quest.proof];
  const total = quest.mins * 60;
  const elapsed = active ? Math.min(total, (Date.now() - status) / 1000) : done ? total : 0;
  const { reward } = quest;

  return (
    <article className={`quest-row${done ? ' done' : ''}${active ? ' active' : ''}`} style={{ '--c': c }}>
      <ProofChip proof={quest.proof} color={c} />

      <div className="col quest-main">
        <span className="row mono wrap quest-meta">
          {quest.difficulty
            ? <span className={`tag tag-${quest.difficulty.id}`}>{quest.difficulty.name.toUpperCase()} · {quest.difficulty.points} PTS</span>
            : <span className="tag tag-extra">EXTRA</span>}
          {quest.name.toUpperCase()} · {quest.mins} MIN · {PROOF_LABEL[quest.proof].toUpperCase()}
        </span>
        <h3 className="quest-title">{quest.title}</h3>
        <div className="row" style={{ gap: 10 }}>
          <span className="quest-bar" role="progressbar" aria-label={`${quest.name} progress`} aria-valuenow={Math.round((elapsed / total) * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${(elapsed / total) * 100}%` }} />
          </span>
          <span className="mono quest-count">{done ? `${quest.mins}/${quest.mins}` : `${Math.floor(elapsed / 60)}/${quest.mins}`} min</span>
        </div>
        <div className="row wrap quest-loot">
          <span className="row" style={{ gap: 5 }}><CoinIcon size={15} />+{reward.coins}</span>
          <span className="row" style={{ gap: 5 }}><MaterialIcon color={reward.material.color} size={15} />{reward.qty}× {reward.material.name}</span>
          <span>+{reward.xp} EXP</span>
        </div>
      </div>

      <div className="quest-side">
        <span className="quest-reward">+2 <b>{STAT_OF[quest.proof].toUpperCase()}</b></span>
        {done ? (
          <span className="quest-done"><span className="goal-check on" aria-hidden="true">✓</span>COMPLETE</span>
        ) : (
          <Link className={`btn ${active ? 'btn-blue' : 'btn-light'}`} style={{ height: 40, padding: '0 16px', fontSize: 14 }} to={`/quest/${quest.id}`}>
            {active ? 'Resume' : 'Start'}
          </Link>
        )}
      </div>
    </article>
  );
}
