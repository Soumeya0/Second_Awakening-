import { useEffect, useState } from 'react';
import { usePlayer } from '../api/player.jsx';
import { MATERIAL, POTIONS, RARE } from '../api/data.js';
import { lookOf, stageOf } from '../api/look.js';
import { buyPotion, drinkPotion, localDailyStats, today } from '../api/game.js';
import { API_ENABLED, api } from '../api/client.js';
import ActivityChart from '../components/ActivityChart.jsx';
import TigerPanel from '../components/TigerPanel.jsx';
import CharacterCard from '../components/CharacterCard.jsx';
import PageHeader from '../components/PageHeader.jsx';
import SystemWindow from '../components/SystemWindow.jsx';
import StatRadar from '../components/StatRadar.jsx';
import { LootIcon, MaterialIcon, Potion } from '../components/ui.jsx';

const DAY_LOOK = {
  d: { bg: 'var(--blue)', ring: 'var(--blue)', fg: 'var(--on-accent)', label: 'All quests done' },
  p: { bg: 'var(--blue-deep)', ring: 'var(--blue-deep)', fg: 'var(--fg)', label: 'Some quests done' },
  m: { bg: 'transparent', ring: 'var(--red)', fg: 'var(--red)', label: 'Missed' },
  f: { bg: 'transparent', ring: 'var(--line)', fg: 'var(--dim)', label: 'Upcoming' }
};

export default function Profile() {
  const { player, update, reset, demo } = usePlayer();
  const [picked, setPicked] = useState(null);
  const t = today();

  // With the backend on, the calendar and the 30-day chart come from Tiger Data's daily_player_stats view.
  const live = API_ENABLED && !demo;
  const [serverStats, setServerStats] = useState(null);
  const [serverHistory, setServerHistory] = useState(null);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    api.stats(30).then((s) => { if (alive) setServerStats(s); }).catch(() => {});
    api.history(t.slice(0, 7)).then((h) => { if (alive) setServerHistory(h); }).catch(() => {});
    return () => { alive = false; };
  }, [live, t]);
  const history = serverHistory ? { ...serverHistory, ...(player.history[t] && { [t]: player.history[t] }) } : player.history;
  const activity = serverStats ? serverStats.days : localDailyStats(player, 30);

  const now = new Date();
  const month = now.toLocaleDateString('en-US', { month: 'long' });
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, k) => {
    const key = today(new Date(now.getFullYear(), now.getMonth(), k + 1));
    const h = history[key];
    const kind = h || (key < t && key >= player.started ? 'm' : 'f');
    return { n: k + 1, ...DAY_LOOK[kind], label: `${key}: ${DAY_LOOK[kind].label}` };
  });

  const buy = (item) => update((p) => { buyPotion(p, item.id); });
  const drink = (id) => update((p) => { drinkPotion(p, id); });
  const buffs = POTIONS.filter((it) => player.buffs?.[it.id]);

  return (
    <div className="page col" style={{ gap: 28 }}>
      <PageHeader eyebrow="PLAYER PROFILE" color="var(--violet-soft)" title={player.name}
        sub="Your character, what you’ve collected, and where to spend your coins." />
    <div className="row wrap" style={{ gap: 28, alignItems: 'flex-start' }}>
      <div className="col" style={{ flex: '1 1 400px', maxWidth: 460, gap: 20 }}>
        <CharacterCard player={player} />
        <p className="muted" style={{ fontSize: 13, textAlign: 'center', marginTop: -8 }}>
          Awakened {new Date(player.started + 'T00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} · {player.questsDone} quests done · Level up needs 1000 EXP and every path bar full.
        </p>

        <SystemWindow title="STATUS" icon={null}>
          <StatRadar player={player} />
          <p className="sys-note" style={{ margin: '4px 0 0' }}>[Stats rise with every quest of their type, and with every level.]</p>
        </SystemWindow>

        <SystemWindow title={`${month.toUpperCase()} HISTORY`} icon={null}>
          <div className="row muted" style={{ gap: 14, fontSize: 12, justifyContent: 'center', marginBottom: 14 }}>
              <span className="row" style={{ gap: 5 }}><span className="swatch" style={{ background: 'var(--blue)' }} />All 4</span>
              <span className="row" style={{ gap: 5 }}><span className="swatch" style={{ background: 'var(--blue-deep)' }} />Partial</span>
              <span className="row" style={{ gap: 5 }}><span className="swatch" style={{ border: '1.5px solid var(--red)' }} />Missed</span>
            </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 6 }}>
            {days.map((d) => (
              <div key={d.n} title={d.label} aria-label={d.label} style={{ height: 30, borderRadius: 'var(--r-sm)', background: d.bg, border: `1.5px solid ${d.ring}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: d.fg }}>{d.n}</div>
            ))}
          </div>
        </SystemWindow>

        <SystemWindow title="LAST 30 DAYS" icon={null}>
          <ActivityChart days={activity} source={serverStats ? 'server' : 'local'} queryMs={serverStats?.queryMs} />
        </SystemWindow>

        {API_ENABLED && <TigerPanel />}
      </div>

      <div className="col" style={{ flex: '1 1 520px', gap: 20 }}>
        <SystemWindow title="INVENTORY" icon={null} tone="violet">
          {(() => {
            const MAT_DESC = { VITALS: 'Forged from sweat. Drops from Vitals quests.', PHOTO: 'Grows where proof is shown. Drops from Photo quests.', FOCUS: 'Condensed focus. Drops from Focus quests.', HONOR: 'A promise kept. Drops from Honor quests.' };
            const items = [
              ...Object.entries(MATERIAL).map(([k, m]) => ({ key: m.name, name: m.name, desc: MAT_DESC[k], glow: m.color, icon: <MaterialIcon color={m.color} size={30} /> })),
              ...RARE.map((x) => ({ key: x.name, name: x.name, desc: x.desc, glow: x.color, icon: <LootIcon kind={x.kind} color={x.color} size={30} /> })),
              ...POTIONS.map((it) => ({ key: it.id, name: it.name, desc: `${it.desc}. Buy it in the marketplace.`, glow: it.color, icon: <Potion color={it.color} size={22} />, potion: true, drink: it.drink }))
            ].map((it) => ({ ...it, n: it.potion ? player.items[it.key] || 0 : player.materials[it.name] || 0 }));
            const sel = items.find((it) => it.key === picked);
            return (<>
              <div className="inv-grid wide">
                {items.concat(Array(24 - items.length).fill(null)).map((slot, k) => (
                  slot
                    ? <button key={slot.key} type="button" className={`inv-slot${slot.n ? '' : ' empty'}`} style={{ '--c': slot.glow }}
                        aria-pressed={picked === slot.key} onClick={() => setPicked(picked === slot.key ? null : slot.key)} aria-label={`${slot.name}: ${slot.n}`}>
                        {slot.icon}{slot.n > 0 && <span className="inv-count">{slot.n}</span>}
                      </button>
                    : <div key={`e${k}`} className="inv-slot empty" aria-hidden="true" />
                ))}
              </div>
              <p className="inv-detail" aria-live="polite">
                {sel ? <><b style={{ color: sel.glow }}>{sel.name} × {sel.n}</b> · {sel.desc}</> : 'Select an item to inspect it.'}
                {sel?.drink && sel.key !== 'revival' && (
                  <button className="btn btn-blue inv-drink" disabled={!sel.n || !!player.buffs?.[sel.key]} onClick={() => drink(sel.key)}>
                    {player.buffs?.[sel.key] ? 'Active' : 'Drink'}
                  </button>
                )}
              </p>
              {buffs.length > 0 && <p className="sys-note" style={{ margin: '4px 0 0', color: 'var(--gold)' }}>[Active: {buffs.map((b) => b.name).join(' · ')} · works on your next quest]</p>}
            </>);
          })()}
          <p className="sys-note" style={{ margin: '12px 0 0' }}>[Materials drop from quests · rare drops reward quest milestones and cleared days · potions come from the marketplace]</p>
        </SystemWindow>

        <SystemWindow title="POTION MARKETPLACE" icon={null} tone="violet">
          <div className="col" style={{ gap: 14 }}>
            <p className="sys-note">[Balance: <span className="gold">{player.coins} coins</span> · potions you buy go to your inventory · drink them from there]</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              {POTIONS.map((item) => (
                <button key={item.id} className="potion-item" style={{ '--c': item.color }} disabled={player.coins < item.cost} onClick={() => buy(item)}>
                  <Potion color={item.color} />
                  <b>{item.name}</b>
                  <span className="muted" style={{ fontSize: 13 }}>{item.desc}</span>
                  <span className="gold" style={{ fontSize: 13 }}>{item.cost} coins</span>
                  {player.items[item.id] ? <span className="bracket" style={{ fontSize: 12 }}>[owned: {player.items[item.id]}]</span> : null}
                </button>
              ))}
            </div>
          </div>
        </SystemWindow>
      </div>
    </div>
    <button className="btn-danger" style={{ alignSelf: 'center' }} onClick={() => { if (confirm('Erase all progress and start over?')) reset(); }}>Reset progress</button>
    </div>
  );
}