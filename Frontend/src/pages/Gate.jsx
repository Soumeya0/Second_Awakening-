import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { lookOf } from '../api/look.js';
import { RANKS, RANK_COLOR, claimGateReward, rankOf, today } from '../api/game.js';
import Arena from '../components/arena/Arena.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SystemWindow from '../components/SystemWindow.jsx';
import { Bar, CoinIcon } from '../components/ui.jsx';

const GATES = [
  { name: 'Hollow Quarry', rank: 'C', lv: 10, color: '#4D8FE8', boss: 'Quarry Warden', bossHp: 700, xp: 120, coins: 80, drop: 'Stone shard', runner: 'river.k', runnerRank: 'B', runnerLv: 24, streak: 96, watchers: 38 },
  { name: 'Ember Vault', rank: 'B', lv: 20, color: '#FF5C74', boss: 'Vault Keeper', bossHp: 1000, xp: 260, coins: 150, drop: 'Ember cloak', runner: 'mika.lifts', runnerRank: 'A', runnerLv: 41, streak: 204, watchers: 112 },
  { name: 'Sky Spire', rank: 'A', lv: 35, color: '#0ECCED', boss: 'Spire Sentinel', bossHp: 1300, xp: 500, coins: 300, drop: 'New character', runner: 'nightrunner', runnerRank: 'S', runnerLv: 52, streak: 311, watchers: 457 }
];
const PLAY_BOSS = { name: 'Quarry Warden', hp: 400, color: '#E0304F' };
const REWARD = { xp: 40, coins: 30 };
// Canvas colours for the fighter: cape = outfit, plus skin and hair.
const arenaLook = (l) => ({ color: l.outfit === '#25435D' ? '#4C6C81' : l.outfit, skin: l.skin, hair: l.hair, longHair: ['long', 'bob', 'ponytail', 'twintails'].includes(l.hairStyle) });

function Log({ title, lines }) {
  return (
    <SystemWindow title={title} icon={null}>
      <div className="log" aria-live="polite" style={{ minHeight: 150 }}>
        {lines.length ? lines.map((l) => <span key={l.id} style={{ color: l.c }}>{l.t}</span>) : <span className="dim">Waiting for the first move…</span>}
      </div>
    </SystemWindow>
  );
}

const LOCK = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </svg>
);

function useLog() {
  const [lines, setLines] = useState([]);
  const push = useCallback((t, c) => setLines((ls) => [...ls, { t, c, id: Math.random() }].slice(-8)), []);
  const clear = useCallback(() => setLines([]), []);
  return [lines, push, clear];
}

export default function Gate() {
  const { player, update } = usePlayer();
  const canEnter = player.level >= 10; // Rank C
  const my = rankOf(player.level);
  const [mode, setMode] = useState('locked'); // locked | watch | fight
  const [watchI, setWatchI] = useState(0);
  const [run, setRun] = useState(0); // bump to restart a fight
  const [result, setResult] = useState(null);
  const [claimed, setClaimed] = useState(false); // this win paid out (false = practice, or today's reward was already taken)
  const [log, pushLog, clearLog] = useLog();

  const start = (m, i = watchI) => { setMode(m); setWatchI(i); setResult(null); setClaimed(false); clearLog(); setRun((r) => r + 1); };
  const g = GATES[watchI];

  const runner = useMemo(() => ({ name: g.runner, color: RANK_COLOR[g.runnerRank], level: g.runnerLv, maxHp: 100 + g.runnerLv * 2, dmg: 0.55 + g.runnerLv / 60 }), [g]);
  const gateBoss = useMemo(() => ({ name: g.boss, hp: g.bossHp, color: g.color }), [g]);
  const me = useMemo(() => ({
    name: player.name, ...arenaLook(lookOf(player)), level: player.level, maxHp: 100, dmg: 1 + (player.level - 1) * 0.05
  }), [player]);

  function endFight(r) {
    setResult(r);
    if (r === 'won' && canEnter) setClaimed(update((p) => claimGateReward(p, REWARD.xp, REWARD.coins)));
  }

  const aside = { flex: '0 1 380px', gap: 24 };
  const main = { flex: '1 1 560px', minWidth: 0 };

  if (mode === 'locked') return (
    <div className="page col" style={{ gap: 28 }}>
      <PageHeader eyebrow={`GATES · YOUR RANK: ${my}`} color="var(--gold)" title="Gates"
        sub={canEnter ? 'Rank C gates are open to you. Watch stronger players first to learn the boss patterns.' : 'Reach Rank C (Level 10) to fight for real. Until then, watch live runs and practice.'} />
      <div className="row wrap" style={{ gap: 32, alignItems: 'flex-start' }}>
        <SystemWindow title="LIVE RUNS" style={main}>
          <p className="sys-note">[{GATES.length} gates are being cleared right now. Watching is free.]</p>
          <div className="col goal-list">
            {GATES.map((gate, k) => (
              <article key={gate.name} className="goal-row">
                <div className="row between" style={{ gap: 16, alignItems: 'flex-start' }}>
                  <div className="row" style={{ gap: 14, alignItems: 'flex-start', minWidth: 0 }}>
                    <span className="proof-chip" style={{ '--c': gate.color }} aria-hidden="true">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M5 21V10a7 7 0 0 1 14 0v11" /><path d="M9 21v-8a3 3 0 0 1 6 0v8" /><path d="M3 21h18" /></svg>
                    </span>
                    <div className="col" style={{ gap: 6, minWidth: 0 }}>
                      <span className="row mono muted wrap" style={{ gap: 10, fontSize: 11, letterSpacing: '.1em' }}>
                        <span className="tag" style={{ color: gate.color, background: 'var(--raised)' }}>RANK {gate.rank}</span>
                        <span className="row" style={{ gap: 6 }}><span className="live" />LIVE · {gate.watchers} WATCHING</span>
                      </span>
                      <h3 className="goal-title">{gate.name}</h3>
                      <span className="muted" style={{ fontSize: 13 }}>{gate.runner} (Rank {gate.runnerRank}) vs {gate.boss}</span>
                    </div>
                  </div>
                  <span className="bracket">[+{gate.xp} EXP]</span>
                </div>
                <div className="row between wrap" style={{ gap: 12 }}>
                  <div className="row wrap" style={{ gap: 16, fontSize: 13, color: 'var(--gold-soft)' }}>
                    <span className="row" style={{ gap: 6 }}><CoinIcon size={16} />+{gate.coins} coins</span>
                    <span>Drop: {gate.drop}</span>
                  </div>
                  <button className="btn btn-light" style={{ height: 44, padding: '0 20px', fontSize: 15 }} onClick={() => start('watch', k)}>Watch the run</button>
                </div>
              </article>
            ))}
          </div>
        </SystemWindow>

        <aside className="col" style={aside}>
          <SystemWindow title="GATE STATUS" tone="gold" icon={LOCK}>
            <div className="col" style={{ gap: 16 }}>
              <p className="sys-note" style={{ margin: 0 }}>[{canEnter ? 'Gates open. Rank C reached.' : 'Gates sealed. Rank C required.'}]</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
                {RANKS.map(([l, lv]) => {
                  const isMe = l === my, target = !canEnter && l === 'C';
                  const c = isMe ? 'var(--gold)' : target ? 'var(--blue)' : 'var(--line2)';
                  return (
                    <div key={l} className="col" style={{ height: 58, borderRadius: 'var(--r-md)', border: `1.5px solid ${c}`, background: isMe ? 'var(--gold-tint)' : target ? 'var(--blue-tint)' : 'var(--deep)', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                      <span style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: 20, color: isMe || target ? 'var(--fg)' : 'var(--dim)' }}>{l}</span>
                      <span className="muted" style={{ fontSize: 10 }}>{isMe ? 'You' : `Lv ${lv}`}</span>
                    </div>
                  );
                })}
              </div>
              {!canEnter && (
                <div className="col" style={{ gap: 6 }}>
                  <div className="row between" style={{ fontSize: 13 }}><span>Progress to Rank C</span><span className="bracket">[Lv {player.level}/10]</span></div>
                  <Bar pct={(player.level / 10) * 100} color="var(--gold)" label="Progress to Rank C" />
                </div>
              )}
              <button className="btn btn-gold" onClick={() => start('fight')}>{canEnter ? 'Enter Hollow Quarry' : 'Practice fight'}</button>
              <span className="muted" style={{ fontSize: 13, textAlign: 'center' }}>{canEnter ? (player.gateWonOn === today() ? 'Today’s reward is claimed. Fights until tomorrow are practice.' : 'The first win each day counts toward your rank.') : 'Practice mode — nothing here is saved to your rank.'}</span>
            </div>
          </SystemWindow>
        </aside>
      </div>
    </div>
  );

  if (mode === 'watch') return (
    <div className="page col" style={{ gap: 28 }}>
      <PageHeader eyebrow={<><span className="live" />SPECTATING · {g.watchers} WATCHING</>} color="var(--red)" title={g.name}
        sub={`Rank ${g.rank} gate · ${g.runner} (Rank ${g.runnerRank}) vs ${g.boss}`}
        action={<button className="btn btn-ghost" onClick={() => setMode('locked')}>Stop watching</button>} />
      <div className="row wrap" style={{ gap: 32, alignItems: 'flex-start' }}>
        <SystemWindow style={{ ...main, padding: 16 }} aria-label="Live fight">
          <Arena key={run} mode="watch" boss={gateBoss} fighter={runner} onEnd={setResult} onLog={pushLog}>
            {result && (
              <div className="panel-overlay" style={{ borderRadius: 0, background: 'color-mix(in srgb, var(--panel) 92%, transparent)' }}>
                <span className="mono" style={{ fontSize: 13, color: result === 'won' ? 'var(--gold)' : 'var(--red)' }}>
                  {result === 'won' ? `[GATE CLEARED BY ${g.runner}]` : `[${g.runner} FELL IN ${g.name.toUpperCase()}]`}
                </span>
                <span className="display" style={{ fontWeight: 800, fontSize: 'clamp(24px, 4vw, 38px)', lineHeight: 1.15 }}>
                  {result === 'won' ? 'That could have been your loot.' : `Even Rank ${g.runnerRank} players fall.`}
                </span>
                {result === 'won' && <span className="soft" style={{ fontSize: 18 }}>+{g.xp} EXP · +{g.coins} coins · {g.drop}</span>}
                <div className="row wrap" style={{ paddingTop: 8, justifyContent: 'center' }}>
                  <Link className="btn btn-gold" to="/dashboard">Do today’s quests</Link>
                  <button className="btn btn-ghost" onClick={() => start('watch')}>Watch again</button>
                </div>
              </div>
            )}
          </Arena>
        </SystemWindow>
        <aside className="col" style={aside}>
          <SystemWindow title="LOOT" tone="gold" icon={null}>
            <div className="col" style={{ gap: 10 }}>
              <span className="row between"><span className="muted">EXP</span><b>+{g.xp}</b></span>
              <span className="row between"><span className="muted">Coins</span><b className="gold">+{g.coins}</b></span>
              <span className="row between"><span className="muted">Drop</span><b>{g.drop}</b></span>
              <p className="sys-note" style={{ margin: '6px 0 0' }}>[Unlocks at Rank {g.rank} · Level {g.lv}. You are Level {player.level}.]</p>
            </div>
          </SystemWindow>
          <SystemWindow title="RUNNER" icon={null}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="col" style={{ gap: 2 }}><span className="muted" style={{ fontSize: 12 }}>Level</span><span className="display" style={{ fontSize: 22 }}>{g.runnerLv}</span></div>
              <div className="col" style={{ gap: 2 }}><span className="muted" style={{ fontSize: 12 }}>Streak</span><span className="display" style={{ fontSize: 22 }}>{g.streak} days</span></div>
            </div>
          </SystemWindow>
          <Log title="LIVE LOG" lines={log} />
        </aside>
      </div>
    </div>
  );

  return (
    <div className="page col" style={{ gap: 28 }}>
      <PageHeader eyebrow={`${canEnter ? '' : 'PRACTICE · '}RANK C GATE`} color="var(--gold)" title="Hollow Quarry"
        sub="Defeat the Quarry Warden. Watch the red warnings — they tell you what’s coming."
        action={<button className="btn btn-ghost" onClick={() => setMode('locked')}>Leave gate</button>} />
      <div className="row wrap" style={{ gap: 32, alignItems: 'flex-start' }}>
        <SystemWindow style={{ ...main, padding: 16 }} aria-label="Your fight">
          <Arena key={run} mode="play" boss={PLAY_BOSS} fighter={me} onEnd={endFight} onLog={pushLog}>
            {result && (
              <div className="panel-overlay" style={{ borderRadius: 0, background: 'color-mix(in srgb, var(--panel) 92%, transparent)' }}>
                <span className="mono" style={{ fontSize: 13, color: result === 'won' ? 'var(--gold)' : 'var(--red)' }}>{result === 'won' ? '[GATE CLEARED]' : '[DEFEATED]'}</span>
                <span className="display" style={{ fontWeight: 800, fontSize: 'clamp(28px, 5vw, 44px)' }}>
                  {result === 'won' ? (claimed || !canEnter ? `+${REWARD.xp} EXP · +${REWARD.coins} coins` : 'Gate cleared') : 'Not strong enough. Yet.'}
                </span>
                <span className="soft" style={{ fontSize: 16 }}>
                  {result === 'won' ? (!canEnter ? 'Practice reward — reach Rank C to earn it for real.' : claimed ? 'Added to your wallet.' : 'Today’s gate reward is already claimed. Come back tomorrow.') : 'Daily quests raise your level, and your level raises your damage.'}
                </span>
                <button className="btn btn-light" onClick={() => start('fight')} autoFocus>{result === 'won' ? 'Run it again' : 'Try again'}</button>
              </div>
            )}
          </Arena>
        </SystemWindow>
        <aside className="col" style={aside}>
          <SystemWindow title="BOSS PATTERNS" tone="red">
            <div className="col" style={{ gap: 12, fontSize: 14, lineHeight: 1.5 }}>
              <span><b className="proof-text" style={{ '--c': 'var(--red)' }}>Slam</b> — red ring under the boss. Get out, then jump the shockwaves.</span>
              <span><b className="proof-text" style={{ '--c': 'var(--red)' }}>Charge</b> — a red lane flashes. Jump over it or dodge through. It stuns itself on the wall.</span>
              <span><b className="proof-text" style={{ '--c': 'var(--red)' }}>Stone shards</b> — red marks show where rocks land. Step aside.</span>
            </div>
          </SystemWindow>
          <Log title="BATTLE LOG" lines={log} />
        </aside>
      </div>
    </div>
  );
}
