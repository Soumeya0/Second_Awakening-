// Shown after a quest: coins count up, the material drops in, the category bar fills.
import { useEffect, useState } from 'react';
import SystemWindow from './SystemWindow.jsx';
import { PROOF_COLOR } from '../api/data.js';
import { STAT_OF } from '../api/game.js';
import VitalsChart from './VitalsChart.jsx';
import { Bar, CoinIcon, LootIcon, MaterialIcon } from './ui.jsx';

// stat name -> its colour (Strength red, Intelligence blue, …)
const STAT_COLOR = Object.fromEntries(Object.entries(STAT_OF).map(([proof, name]) => [name, PROOF_COLOR[proof]]));

export default function RewardPopup({ reward, onClose }) {
  const [coins, setCoins] = useState(0);
  const [bar, setBar] = useState(reward.barFrom);

  useEffect(() => {
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 900);
      setCoins(Math.round(reward.coins * k));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const t = setTimeout(() => setBar(reward.barTo), 700);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [reward]);

  return (
    <div className="overlay dim-bg" role="dialog" aria-modal="true" aria-labelledby="reward-title">
      <SystemWindow title="NOTIFICATION" style={{ width: 480, maxWidth: '100%' }}>
        <div className="col" style={{ gap: 18 }}>
          <p id="reward-title" className="notify-text">
            Daily Quest “{reward.title || reward.category}” has been completed.
            {reward.cleared && <><br />All required quests cleared — daily bonus granted.</>}
          </p>
          {reward.levelTo > reward.levelFrom && (
            <div className="level-up" role="status">
              <span className="level-up-word">LEVEL UP</span>
              <span className="level-up-lv">Lv. {reward.levelTo} <span aria-hidden="true">↑</span></span>
            </div>
          )}
          <div className="reward-grid">
            <div className="reward-cell"><span className="row" style={{ gap: 8 }} aria-live="polite"><CoinIcon size={24} /><b className="gold">+{coins}</b></span><small>coins</small></div>
            <div className="reward-cell"><b>+{reward.xp}</b><small>EXP</small></div>
            {reward.stat && <div className="reward-cell" style={{ '--c': STAT_COLOR[reward.stat] }}><b className="stat-up">+2</b><small>{reward.stat.toUpperCase()}</small></div>}
          </div>
          <div className="row drop-in reward-item">
            <MaterialIcon color={reward.material.color} size={38} />
            <div className="col" style={{ gap: 2 }}>
              <b>{reward.qty}× {reward.material.name}</b>
              <span className="muted" style={{ fontSize: 13 }}>Added to your inventory</span>
            </div>
          </div>
          {reward.proofNote && <p className="sys-note" style={{ margin: 0 }}>{reward.proofNote}</p>}
          {reward.boost?.map((b) => <p key={b} className="sys-note" style={{ margin: 0, color: 'var(--gold)' }}>[{b}]</p>)}
          {reward.drops?.map((x) => (
            <div key={x.name} className="row drop-in reward-item" style={{ '--c': x.color }}>
              <LootIcon kind={x.kind} color={x.color} size={38} />
              <div className="col" style={{ gap: 2 }}>
                <b>RARE DROP · 1× {x.name}</b>
                <span className="muted" style={{ fontSize: 13 }}>{x.desc}</span>
              </div>
            </div>
          ))}
          <div className="col" style={{ gap: 6 }}>
            <div className="row between" style={{ fontSize: 14 }}><span>{reward.category} path</span><span className="bracket">[{bar}/10]</span></div>
            <Bar pct={bar * 10} color="var(--blue)" h={8} label={`${reward.category} bar`} />
          </div>
          {reward.vitals && <VitalsChart vitals={reward.vitals} />}
          <button className="btn btn-blue" onClick={onClose} autoFocus>Confirm</button>
        </div>
      </SystemWindow>
    </div>
  );
}
