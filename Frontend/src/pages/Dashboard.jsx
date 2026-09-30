import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { REWARD, addQuest, canAddQuest, sendToRift, today, todaysQuests } from '../api/game.js';
import Hud from '../components/Hud.jsx';
import QuestCard from '../components/QuestCard.jsx';
import RewardPopup from '../components/RewardPopup.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SystemWindow from '../components/SystemWindow.jsx';
import WarningBox from '../components/WarningBox.jsx';

export default function Dashboard() {
  const { player, update } = usePlayer();
  const navigate = useNavigate();
  const { state } = useLocation();
  const reward = state?.reward;
  const quests = todaysQuests(player);
  const status = player.day.status;
  const done = quests.slice(0, 4).filter((q) => status[q.id] === 'done').length;
  const riftActive = player.rift && player.rift.until > Date.now();

  // A fresh banishment is shown once, straight away.
  useEffect(() => {
    if (player.rift && !player.rift.seen) navigate('/rift', { replace: true });
  }, [player.rift, navigate]);

  const dayN = Math.round((new Date(today()) - new Date(player.started)) / 864e5) + 1;
  const weekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();

  return (
    <div className="page col" style={{ gap: 24 }}>
      <PageHeader eyebrow={`${weekday} · DAY ${dayN} OF YOUR AWAKENING`} title="Today’s quests"
        sub="Clear the 4 required quests to seal the Rift. Everything else is extra EXP." />

      {player.rift && (
        <Link to="/rift" className="card row between wrap" style={{ borderColor: 'var(--red-line)', background: 'var(--red-tint)', color: 'var(--red)', textDecoration: 'none' }}>
          <span className="mono">{riftActive ? '[RIFT] YOUR CHARACTER IS STILL TRAPPED' : '[RIFT] THE RIFT HAS OPENED — ESCAPE NOW'}</span><span>View the Rift →</span>
        </Link>
      )}

      <div className="row wrap" style={{ gap: 32, alignItems: 'flex-start' }}>
        <div className="col" style={{ flex: '1 1 560px', gap: 16, minWidth: 0 }}>
          <SystemWindow title="QUEST INFO">
            <p className="sys-note">[Daily Quest: {quests.length} quests have arrived. Clear 4 to seal the Rift.]</p>
            <h3 className="goal-heading">GOAL</h3>
            <div className="row between" style={{ fontSize: 14, marginBottom: 6 }}>
              <span className="muted">Required</span>
              <span className="bracket">[{done}/4]</span>
            </div>
            <div className="col goal-list">
              {quests.map((q) => <QuestCard key={q.id} quest={q} status={status[q.id]} />)}
            </div>
            {player.day.cleared && (
              <p className="sys-note" style={{ color: 'var(--gold-soft)', '--rgb': '242,184,75', marginTop: 18 }}>
                [4 quests cleared · daily bonus +50 EXP · +25 coins. Rift sealed for today.] Jinho: “Not bad. Same time tomorrow.”
              </p>
            )}
            {canAddQuest(player) && (
              <div className="row between wrap add-quest">
                <div className="col" style={{ gap: 4 }}>
                  <b>All caught up. Want more?</b>
                  <span className="muted" style={{ fontSize: 14 }}>Take on another quest: +{REWARD.extra.xp} EXP · +{REWARD.extra.coins} coins · a material · +1 on its bar.</span>
                </div>
                <button className="btn btn-blue" style={{ height: 48, fontSize: 15 }} onClick={() => update(addQuest)}>+ Add another quest</button>
              </div>
            )}
            {quests.length === player.chosen.length && quests.every((q) => status[q.id] === 'done') && (
              <p className="muted" style={{ fontSize: 14, marginTop: 16, textAlign: 'center' }}>You’ve done a quest in every one of your categories today. That’s the whole map — rest up.</p>
            )}
            <div className="col warning-block">
              <p><b>WARNING:</b> Failure to complete the daily quest will result in an appropriate penalty.</p>
            </div>
          </SystemWindow>
          <WarningBox lead="Miss the 4 required quests and you're banished to the Rift."
            detail="−150 EXP · −25 coins · apps locked 1 hour · +1 hour for every missed day in a row">
            <button className="btn-danger" style={{ marginTop: 6 }} onClick={() => { update((p) => sendToRift(p, 1)); }}>Demo: fail today</button>
          </WarningBox>
        </div>
        <Hud player={player} highlight={reward ? quests.find((q) => q.name === reward.category)?.id : undefined} />
      </div>

      {reward && <RewardPopup reward={reward} onClose={() => navigate('.', { replace: true, state: null })} />}
    </div>
  );
}
