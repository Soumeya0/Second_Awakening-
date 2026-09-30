// Full-screen quest: countdown, focus mode with blocked apps, live heart rate for vitals quests.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { BLOCKED_APPS, PROOF_CTA, PROOF_LABEL } from '../api/data.js';
import { completeQuest, mmss, todaysQuests } from '../api/game.js';
import { createVitalsRecorder, subscribeHeartRate } from '../api/vitals.js';
import { startServerQuest } from '../api/client.js';
import { Bar } from '../components/ui.jsx';

function HeartRate({ onReading }) {
  const [reading, setReading] = useState(null);
  const [samples, setSamples] = useState([]);
  useEffect(() => subscribeHeartRate((r) => {
    setReading(r);
    setSamples((s) => [...s.slice(-29), r.bpm]);
    onReading?.(r);
  }), [onReading]);

  const pts = samples.map((b, k) => `${k * 10},${60 - ((b - 50) / 120) * 60}`).join(' ');
  return (
    <section className="card deep col" style={{ width: 420, maxWidth: '100%', gap: 10, textAlign: 'left' }} aria-label="Live heart rate">
      <div className="row between">
        <span className="mono" style={{ color: 'var(--red)' }}>LIVE VITALS · PRESAGE</span>
        {reading?.simulated && <span className="mono dim" style={{ fontSize: 11 }}>SIMULATED</span>}
      </div>
      <div className="row" style={{ gap: 14 }}>
        <svg className="beat" width="30" height="30" viewBox="0 0 24 24" fill="var(--red)" aria-hidden="true">
          <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.4 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z" />
        </svg>
        <span className="display" style={{ fontSize: 44 }} aria-live="off">{reading ? reading.bpm : '--'}</span>
        <span className="muted">BPM</span>
      </div>
      <svg viewBox="0 0 290 60" style={{ width: '100%', height: 60 }} aria-hidden="true">
        <polyline points={pts} fill="none" stroke="var(--red)" strokeWidth="2" strokeLinejoin="round" />
      </svg>
    </section>
  );
}

export default function QuestTimer() {
  const { id } = useParams();
  const { player, update } = usePlayer();
  const navigate = useNavigate();
  const quest = todaysQuests(player).find((q) => q.id === id);
  const started = player.day.status[id];
  const [now, setNow] = useState(Date.now());
  const completing = useRef(false);
  const recorder = useRef(null);
  const isVitals = quest?.proof === 'VITALS';

  // Starting is stored, so a refresh resumes the same countdown.
  useEffect(() => {
    if (quest && typeof started !== 'number' && started !== 'done') update((p) => { p.day.status[id] = Date.now(); });
  }, [quest, started, id, update]);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);
  // Vitals quests record every reading; with the backend on, they stream to the vitals_readings hypertable.
  useEffect(() => {
    if (!isVitals) return;
    const r = createVitalsRecorder(startServerQuest(id));
    recorder.current = r;
    return () => { if (recorder.current === r && !completing.current) { r.discard(); recorder.current = null; } };
  }, [id, isVitals]);
  const onReading = useCallback((r) => recorder.current?.add(r), []);

  if (!quest) return <Navigate to="/dashboard" replace />;
  if (started === 'done') return completing.current ? null : <Navigate to="/dashboard" replace />;

  const total = quest.mins * 60;
  const left = typeof started === 'number' ? total - (now - started) / 1000 : total;
  const finished = left <= 0;

  async function complete() {
    if (completing.current) return;
    completing.current = true; // keep the done-redirect from replacing the navigation that carries the reward
    let vitals;
    if (recorder.current) {
      const series = recorder.current.series();
      vitals = { series, questId: await recorder.current.finish() };
      recorder.current = null;
    }
    const reward = update((p) => completeQuest(p, id));
    navigate('/dashboard', { state: { reward: reward && vitals ? { ...reward, vitals } : reward } });
  }
  function abandon() {
    recorder.current?.discard();
    recorder.current = null;
    update((p) => { delete p.day.status[id]; });
    navigate('/dashboard');
  }

  return (
    <div className="fullscreen">
      <span className="mono" style={{ color: 'var(--blue)', fontSize: 13 }}>FOCUS MODE · {quest.name.toUpperCase()} · {PROOF_LABEL[quest.proof].toUpperCase()} PROOF</span>
      <h1 className="display" style={{ fontSize: 'clamp(24px, 4vw, 34px)', maxWidth: 720 }}>{quest.title}</h1>
      <div role="timer" aria-label="Time left" style={{ fontFamily: 'Rajdhani, sans-serif', fontWeight: 800, fontSize: 'clamp(72px, 16vw, 160px)', lineHeight: 1, color: finished ? 'var(--gold)' : 'var(--fg)' }}>
        {mmss(left)}
      </div>
      <div style={{ width: 520, maxWidth: '100%' }}><Bar pct={(1 - left / total) * 100} h={8} color={finished ? 'var(--gold)' : 'var(--blue)'} label="Quest progress" /></div>

      {isVitals && <HeartRate onReading={onReading} />}

      <div className="col" style={{ alignItems: 'center', gap: 10 }}>
        <span className="mono dim">BLOCKED UNTIL YOU FINISH</span>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          {BLOCKED_APPS.map((a) => <span key={a} className="app-chip">{a}</span>)}
        </div>
      </div>

      <div className="row wrap" style={{ justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={abandon}>Give up</button>
        <button className={`btn ${finished ? 'btn-gold' : 'btn-blue'}`} onClick={complete}>{PROOF_CTA[quest.proof]}</button>
      </div>
    </div>
  );
}
