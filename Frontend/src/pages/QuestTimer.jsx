// Full-screen quest: countdown, focus mode with blocked apps, live heart rate for vitals quests, photo proof for photo quests.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { BLOCKED_APPS, PROOF_CTA, PROOF_LABEL } from '../api/data.js';
import { completeQuest, mmss, todaysQuests } from '../api/game.js';
import { createVitalsRecorder, subscribeHeartRate } from '../api/vitals.js';
import { api, cancelServerQuest, startServerQuest } from '../api/client.js';
import { useServerQuests, withServerText } from '../api/serverQuests.js';
import SystemWindow from '../components/SystemWindow.jsx';
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

// Pick or take a photo, preview it, send it. onSubmit(file) resolves to an error message when the photo is rejected.
function PhotoProof({ quest, onSubmit, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function submit(e) {
    e.preventDefault();
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSubmit(file);
    if (err) { setError(err); setBusy(false); }
  }

  return (
    <div className="overlay dim-bg" role="dialog" aria-modal="true" aria-labelledby="photo-title">
      <SystemWindow title="PHOTO PROOF" style={{ width: 480, maxWidth: '100%' }}>
        <form className="col" style={{ gap: 16 }} onSubmit={submit}>
          <p id="photo-title" className="notify-text">Upload a photo that shows “{quest.title}”.</p>
          <label className="btn btn-ghost" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {file ? 'Choose another photo' : 'Choose or take a photo'}
            <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy}
              onChange={(e) => { setFile(e.target.files[0] || null); setError(null); }} />
          </label>
          {preview && <img src={preview} alt="Your photo proof" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 'var(--r-md)' }} />}
          {error && <p className="sys-note" role="alert" style={{ margin: 0, color: 'var(--red)' }}>{error}</p>}
          <div className="row wrap" style={{ justifyContent: 'center' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>Back</button>
            <button type="submit" className="btn btn-gold" disabled={!file || busy}>{busy ? 'Checking…' : 'Submit proof'}</button>
          </div>
        </form>
      </SystemWindow>
    </div>
  );
}

export default function QuestTimer() {
  const { id } = useParams();
  const { player, update, demo } = usePlayer();
  const navigate = useNavigate();
  const quest = withServerText(todaysQuests(player), useServerQuests(player.day.date, !demo)).find((q) => q.id === id);
  const started = player.day.status[id];
  const [now, setNow] = useState(Date.now());
  const completing = useRef(false);
  const recorder = useRef(null);
  const serverQuest = useRef(null); // promise of the backend quest id (null when it stays local)
  const isVitals = quest?.proof === 'VITALS';
  const isPhoto = quest?.proof === 'PHOTO';
  const [photoOpen, setPhotoOpen] = useState(false);

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
    serverQuest.current = startServerQuest(id);
    const r = createVitalsRecorder(serverQuest.current);
    recorder.current = r;
    return () => { if (recorder.current === r && !completing.current) { r.discard(); recorder.current = null; } };
  }, [id, isVitals]);
  // Photo quests are checked by the backend (Gemini), so its quest has to be running too. The judge demo stays local.
  useEffect(() => {
    if (isPhoto && !demo) serverQuest.current = startServerQuest(id);
  }, [id, isPhoto, demo]);
  const onReading = useCallback((r) => recorder.current?.add(r), []);

  if (!quest) return <Navigate to="/dashboard" replace />;
  if (started === 'done') return completing.current ? null : <Navigate to="/dashboard" replace />;

  const total = quest.mins * 60;
  const left = typeof started === 'number' ? total - (now - started) / 1000 : total;
  const finished = left <= 0;
  const canComplete = finished || demo; // the judge demo can skip the wait, like the backend's DEMO_MODE

  async function complete(proof) {
    if (completing.current || !canComplete) return;
    completing.current = true; // keep the done-redirect from replacing the navigation that carries the reward
    let vitals;
    if (recorder.current) {
      const series = recorder.current.series();
      vitals = { series, questId: await recorder.current.finish() };
      recorder.current = null;
    }
    const reward = update((p) => completeQuest(p, id));
    if (reward) reward.title = quest.title; // the Gemini title when the backend wrote one
    if (reward && proof) reward.proofNote = proof;
    navigate('/dashboard', { state: { reward: reward && vitals ? { ...reward, vitals } : reward } });
  }
  // Returns an error message to show in the form, or completes the quest.
  async function submitPhoto(file) {
    const serverId = await serverQuest.current;
    let note;
    if (serverId) {
      try {
        note = (await api.completeWithPhoto(serverId, file)).reward?.reason;
      } catch (err) {
        if (err.status === 422) return err.data?.reason || 'That photo was not accepted. Try another one.';
        if (err.data?.details?.endsAt) return 'The server timer is still running. Try again in a moment.';
        if (err.status === 400) return err.message;
        console.warn('Photo check unavailable, completing locally:', err.message);
      }
    }
    await complete(note);
  }
  function abandon() {
    recorder.current?.discard();
    recorder.current = null;
    if (serverQuest.current) cancelServerQuest(serverQuest.current);
    serverQuest.current = null;
    update((p) => { delete p.day.status[id]; });
    navigate('/dashboard');
  }

  return (
    <div className="fullscreen">
      <span className="mono" style={{ color: 'var(--blue)', fontSize: 13 }}>FOCUS MODE · {quest.name.toUpperCase()} · {PROOF_LABEL[quest.proof].toUpperCase()} PROOF</span>
      <h1 className="display" style={{ fontSize: 'clamp(24px, 4vw, 34px)', maxWidth: 720 }}>{quest.title}</h1>
      {quest.description && <p className="soft" style={{ maxWidth: 620, margin: '-12px 0 0' }}>{quest.description}</p>}
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
        <button className={`btn ${finished ? 'btn-gold' : 'btn-blue'}`} onClick={isPhoto ? () => setPhotoOpen(true) : () => complete()} disabled={!canComplete}
          title={canComplete ? undefined : 'Finish the countdown first'}>{PROOF_CTA[quest.proof]}</button>
      </div>

      {isPhoto && photoOpen && canComplete && <PhotoProof quest={quest} onSubmit={submitPhoto} onClose={() => setPhotoOpen(false)} />}
    </div>
  );
}
