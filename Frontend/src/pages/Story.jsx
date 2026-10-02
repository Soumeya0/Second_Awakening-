import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { SCENES, narration } from '../api/story.js';

const EMBERS = Array.from({ length: 22 }, (_, k) => ({
  left: `${(k * 37) % 100}%`, bottom: `${(k * 23) % 40}%`,
  animationDelay: `${((k * 0.61) % 6).toFixed(2)}s`, animationDuration: `${6 + (k % 5)}s`
}));
const HS = [10, 22, 16, 30, 12, 26, 34, 18, 24, 14, 32, 20, 28, 12, 22, 36, 16, 26, 10, 30, 18, 24, 14, 20];

export default function Story() {
  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(false);
  const { enterDemo } = usePlayer();
  const navigate = useNavigate();
  const s = SCENES[i];
  const last = i === SCENES.length - 1;

  // Narrator: the recorded ElevenLabs voice (public/story/voice, made by `npm run voice`),
  // or the browser's own speech voice for any chapter that has no recording yet.
  useEffect(() => {
    if (muted) return;
    const tts = 'speechSynthesis' in window;
    const audio = new Audio(`/story/voice/${s.img}.mp3`);
    const speak = () => { if (tts) speechSynthesis.speak(new SpeechSynthesisUtterance(narration(s))); };
    audio.addEventListener('error', speak, { once: true });
    audio.play().catch(() => {}); // browsers may hold sound until the first click; missing files land in 'error'
    return () => { audio.removeEventListener('error', speak); audio.pause(); if (tts) speechSynthesis.cancel(); };
  }, [muted, s]);

  return (
    <div className="story-root" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 1280, margin: '0 auto', '--story-c': s.color }}>
      <header className="row between story-pad" style={{ paddingTop: 32, paddingBottom: 32 }}>
        <div className="brand" style={{ fontSize: 18 }}>SECOND AWAKENING</div>
        <div className="row" style={{ gap: 28 }}>
          <span className="mono muted hide-sm" style={{ fontSize: 13 }}>CHAPTER 0{i + 1} / 05</span>
          <button className="pill demo-pill" onClick={() => { enterDemo(); navigate('/dashboard'); }}>★ Judge demo (Rank S)</button>
          <Link to="/login" style={{ fontSize: 15, color: 'var(--muted)', textDecoration: 'none', padding: '12px 4px' }}>Skip intro</Link>
        </div>
      </header>

      <main className="story-pad" style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
        <section className="story-card" style={{ '--story-c': s.color }} aria-label={`Chapter ${i + 1}: ${s.label}`}>
          <span className="story-embers" aria-hidden="true">{EMBERS.map((e, k) => <i key={k} style={e} />)}</span>

          <div className="col story-text">
            <div className="story-badge"><b>{String(i + 1).padStart(2, '0')}</b><span>CHAPTER</span></div>
            <span className="mono story-kicker">JINWOO · NARRATOR</span>
            <h1 key={`t${i}`} className="story-heading" aria-live="polite">{s.title}</h1>
            <p key={`b${i}`} className="story-copy">{s.body}</p>
            <div className="sys story-sys">{s.system}</div>
            <div className="row" style={{ gap: 16 }}>
              <button onClick={() => setMuted(!muted)} aria-label={muted ? 'Turn narrator voice on' : 'Mute narrator voice'} className="icon-btn">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 5 6 9H3v6h3l5 4z" />
                  {muted ? <path d="m16 9 6 6M22 9l-6 6" /> : <><path d="M15.5 8.5a5 5 0 0 1 0 7" /><path d="M18.5 5.5a9 9 0 0 1 0 13" /></>}
                </svg>
              </button>
              <div className={`wave${muted ? ' muted' : ''}`} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 36 }} aria-hidden="true">
                {HS.map((h, k) => <span key={k} style={{ height: h, animationDelay: `${(k * 0.07).toFixed(2)}s`, background: 'var(--story-c)' }} />)}
              </div>
              <span className="mono muted" style={{ letterSpacing: '.06em' }}>{muted ? 'VOICE OFF' : 'JINWOO IS SPEAKING'}</span>
            </div>
          </div>

          <div className="story-figure">
            {SCENES.map((x, k) => ( // all mounted: switching chapters crossfades instead of reloading an image
              <img key={x.img} className={`story-portrait${x.inside ? ' inside' : ''}${k === i ? ' on' : ''}`} src={`/story/${x.img}.jpg`}
                alt={k === i ? x.alt : ''} aria-hidden={k !== i} />
            ))}
          </div>

          <nav className="story-index" aria-label="Chapters">
            {SCENES.map((x, k) => (
              <button key={x.img} onClick={() => setI(k)} aria-current={k === i ? 'step' : undefined}>{x.label}</button>
            ))}
          </nav>
        </section>
      </main>
      <p className="story-credit story-pad">Images: Solo Leveling © Chugong, DUBU (REDICE Studio), D&amp;C Media · anime by A-1 Pictures; chapter 5 is fan art. Fan project, not affiliated.</p>

      <footer className="row between wrap story-pad" style={{ paddingTop: 32, paddingBottom: 32 }}>
        <div className="row" style={{ gap: 8 }}>
          {SCENES.map((x, k) => (
            <button key={k} onClick={() => setI(k)} aria-label={`Go to chapter ${k + 1}`} aria-current={k === i ? 'step' : undefined}
              style={{ height: 44, width: k === i ? 44 : 20, padding: 0, border: 0, background: 'transparent', display: 'flex', alignItems: 'center' }}>
              <span style={{ display: 'block', width: '100%', height: 6, borderRadius: 3, background: k === i ? 'var(--story-c)' : 'var(--line2)', transition: 'background .6s' }} />
            </button>
          ))}
        </div>
        <div className="row">
          <button className="btn btn-ghost" onClick={() => setI(i - 1)} disabled={i === 0}>Back</button>
          {last
            ? <Link className="btn btn-gold" to="/login">Accept the call</Link>
            : <button className="btn btn-light" onClick={() => setI(i + 1)}>Continue</button>}
        </div>
      </footer>
    </div>
  );
}
