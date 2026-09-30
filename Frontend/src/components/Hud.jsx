// Dashboard HUD: character card (character, rank, level, EXP, stats, coins, streak) + one bar per category.
import { CATEGORY, PROOF_COLOR } from '../api/data.js';
import CharacterCard from './CharacterCard.jsx';
import SystemWindow from './SystemWindow.jsx';
import { Bar } from './ui.jsx';

export default function Hud({ player, highlight }) {
  return (
    <aside className="col" style={{ flex: '0 1 380px', gap: 24 }}>
      <CharacterCard player={player} />
      <SystemWindow title="PATH BARS" icon={null} aria-label="Category bars">
        <div className="col" style={{ gap: 12 }}>
          <span className="muted" style={{ fontSize: 13, textAlign: 'center' }}>Fill every bar to reach the next level</span>
          {player.chosen.map((id) => {
            const v = player.bars[id] || 0;
            return (
              <div key={id} className="col" style={{ gap: 5 }}>
                <div className="row between" style={{ fontSize: 13 }}><span>{CATEGORY[id].name}</span><span className="bracket">[{v}/10]</span></div>
                <Bar pct={v * 10} color={highlight === id ? 'var(--gold)' : PROOF_COLOR[CATEGORY[id].proof]} />
              </div>
            );
          })}
        </div>
      </SystemWindow>
    </aside>
  );
}
