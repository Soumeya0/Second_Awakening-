import { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { Bar, Check } from '../components/ui.jsx';

const QUESTIONS = [
  { id: 'time', text: 'When do you have the most energy?', opts: ['Early morning', 'Afternoon', 'Evening', 'Late night'] },
  { id: 'len', text: 'How long can you give one quest on a normal day?', opts: ['10 minutes', '15 minutes', '30 minutes', '45+ minutes'] },
  { id: 'goal', text: 'What do you want to change first?', opts: ['Body and health', 'Focus and study', 'Home and routine', 'Social life'] },
  { id: 'topic', text: 'Which of these pulls you in the most?', opts: ['Gym', 'Anime & Shows', 'Music', 'Books', 'Nature walks'] },
  { id: 'fitness', text: 'How active are you right now?', opts: ['Barely moving', 'I walk sometimes', 'Workout 1–2 × a week', 'Workout 3+ × a week'] },
  { id: 'place', text: 'Where can you train?', opts: ['A gym', 'At home', 'Outdoors', 'Nowhere yet'] },
  { id: 'sleep', text: 'When do you usually fall asleep?', opts: ['Before 11 pm', '11 pm – 1 am', 'After 1 am', 'Different every night'] },
  { id: 'screen', text: 'Daily screen time outside work or school?', opts: ['Under 2 hours', '2–4 hours', '4–6 hours', '6+ hours'] },
  { id: 'weak', text: 'What knocks you off track most often?', opts: ['Endless scrolling', 'No plan for the day', 'Low energy', 'Too busy'] },
  { id: 'quit', text: 'Last time you tried to change, what stopped you?', opts: ['Lost motivation', 'Too hard too fast', 'Life got busy', 'Never really tried'] },
  { id: 'why', text: 'Who are you doing this for?', opts: ['Myself', 'Someone I love', 'To prove someone wrong', 'Future me'] },
  { id: 'voice', text: 'How should the System talk to you?', opts: ['Calm and kind', 'Strict', 'Drill sergeant', 'Only when needed'] }
];
const ORDER = ['signin', 'auth', 'quiz', 'done'];
const LABELS = ['Sign in with Google', 'Verify identity', 'Gemini assessment', 'Receive your rank'];
const MSGS = {
  signin: '[SYSTEM] A Player candidate has been detected. Identify yourself.',
  auth: '[SYSTEM] Identity verified. Preparing the assessment.',
  quiz: '[SYSTEM] Answer honestly. The System adapts to the truth, not to what sounds good.',
  done: '[SYSTEM] Assessment complete. Rank E assigned. Everyone starts somewhere.'
};
const DIFFICULTY = { 'Barely moving': 'Gentle', 'I walk sometimes': 'Easy', 'Workout 1–2 × a week': 'Normal', 'Workout 3+ × a week': 'Hard' };

export default function Login() {
  const { player, update } = usePlayer();
  const [step, setStep] = useState('signin');
  const [q, setQ] = useState(0);
  const A = player.answers;
  const idx = ORDER.indexOf(step);

  return (
    <div className="row wrap" style={{ minHeight: '100vh', alignItems: 'stretch', gap: 0 }}>
      <aside className="col between" style={{ flex: '0 1 440px', padding: 48, borderRight: '1px solid var(--line)', background: 'var(--deep)', gap: 32 }}>
        <div className="col" style={{ gap: 48 }}>
          <Link to="/" className="brand" style={{ fontSize: 18 }}>SECOND AWAKENING</Link>
          <div className="col">
            <span className="mono muted">PLAYER REGISTRATION</span>
            <h1 className="page-title">Four steps to Rank E.</h1>
          </div>
          <ol className="col" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 6 }}>
            {LABELS.map((l, k) => {
              const ring = k < idx ? 'var(--blue)' : k === idx ? 'var(--fg)' : 'var(--line3)';
              return (
                <li key={l} className="row" aria-current={k === idx ? 'step' : undefined}
                  style={{ gap: 14, padding: '12px 14px', borderRadius: 'var(--r-md)', background: k === idx ? 'var(--raised)' : 'transparent' }}>
                  <span className="step-num" style={{ borderColor: ring, color: ring }}>{k < idx ? '✓' : k + 1}</span>
                  <span style={{ fontSize: 16, color: k <= idx ? 'var(--fg)' : 'var(--dim)' }}>{l}</span>
                </li>
              );
            })}
          </ol>
        </div>
        <div className="sys" style={{ background: 'var(--bg)' }}>{MSGS[step]}</div>
      </aside>

      <main className="row" style={{ flex: '1 1 480px', justifyContent: 'center', padding: '48px 24px' }}>
        {step === 'signin' && (
          <div className="col" style={{ width: 440, maxWidth: '100%', gap: 28 }}>
            <div className="col">
              <h2 className="display" style={{ fontSize: 32 }}>Enter the System</h2>
              <p className="soft" style={{ fontSize: 17, lineHeight: 1.55 }}>One account. Your quests, your bars, your rank — saved wherever you sign in.</p>
            </div>
            {/* ponytail: demo sign-in; plug Auth0's Google connection in here when there's a backend */}
            <button className="btn" onClick={() => setStep('auth')} style={{ height: 56, background: '#fff', color: '#10182B', fontSize: 17, gap: 12, border: '1px solid var(--line2)', boxShadow: 'var(--shadow)' }}>
              <span className="g-mark">G</span>Continue with Google
            </button>
            <p className="muted" style={{ fontSize: 13 }}>Demo sign-in · progress is saved in this browser only.</p>
            <p className="dim" style={{ fontSize: 13, lineHeight: 1.5 }}>Second Awakening is a wellness tool, not a medical device.</p>
          </div>
        )}

        {step === 'auth' && (
          <div className="col" style={{ width: 480, maxWidth: '100%', gap: 28 }}>
            <h2 className="display" style={{ fontSize: 32 }}>Identity confirmed</h2>
            <div className="col" style={{ gap: 8 }}>
              <label htmlFor="name" className="mono muted">PLAYER NAME</label>
              <input id="name" className="input" defaultValue={player.name} maxLength={24} autoComplete="nickname"
                onChange={(e) => update((p) => { p.name = e.target.value.trim() || 'Player'; })} />
            </div>
            <ul className="col" style={{ margin: 0, padding: 0, listStyle: 'none', gap: 14, fontSize: 16 }}>
              <li className="row"><Check color="var(--blue)" />Account linked</li>
              <li className="row"><Check color="var(--blue)" />Session created</li>
              <li className="row"><Check color="var(--blue)" />Player profile created at Rank E · Level 1</li>
            </ul>
            <p className="soft" style={{ fontSize: 16, lineHeight: 1.55 }}>Before your first quest, Gemini asks twelve quick questions (about 2 minutes) so the quests fit your life, not someone else’s.</p>
            <button className="btn btn-blue" style={{ height: 56, fontSize: 17 }} onClick={() => { setQ(0); setStep('quiz'); }}>Begin assessment</button>
          </div>
        )}

        {step === 'quiz' && (() => {
          const Q = QUESTIONS[q];
          const cur = A[Q.id];
          const lastQ = q === QUESTIONS.length - 1;
          return (
            <div className="col" style={{ width: 640, maxWidth: '100%', gap: 28 }}>
              <div className="row between">
                <span className="mono" style={{ color: 'var(--violet)' }}>GEMINI · ADAPTIVE ASSESSMENT</span>
                <span className="mono muted">{q + 1} / {QUESTIONS.length}</span>
              </div>
              <Bar pct={((q + (cur ? 1 : 0)) / QUESTIONS.length) * 100} color="var(--violet)" label="Assessment progress" />
              <h2 className="display" style={{ fontSize: 32, lineHeight: 1.2 }}>{Q.text}</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                {Q.opts.map((o) => (
                  <button key={o} className="choice" aria-pressed={cur === o} onClick={() => update((p) => { p.answers[Q.id] = o; })}>{o}</button>
                ))}
              </div>
              <div className="row between">
                <button className="btn btn-ghost" onClick={() => (q === 0 ? setStep('auth') : setQ(q - 1))}>Back</button>
                <button className="btn btn-light" disabled={!cur} onClick={() => (lastQ ? setStep('done') : setQ(q + 1))}>{lastQ ? 'See my rank' : 'Next'}</button>
              </div>
            </div>
          );
        })()}

        {step === 'done' && (
          <div className="col" style={{ width: 560, maxWidth: '100%', gap: 28 }}>
            <div className="row" style={{ gap: 20 }}>
              <div className="rank-box" style={{ width: 88, height: 88, fontSize: 48 }}>E</div>
              <div className="col" style={{ gap: 4 }}>
                <span className="mono muted">INITIAL RANK</span>
                <h2 className="display" style={{ fontSize: 32 }}>Awakening confirmed</h2>
              </div>
            </div>
            <div style={{ border: '1px solid var(--line2)', borderRadius: 'var(--r-md)', overflow: 'hidden' }}>
              {[['First focus', A.goal], ['Starting quest length', A.len], ['Quests arrive', A.time], ['Starting difficulty', DIFFICULTY[A.fitness]],
                ['Training spot', A.place], ['Main enemy', A.weak], ['Daily minimum', '4 quests'], ['System voice', A.voice]].map(([k, v]) => (
                <div key={k} className="row between" style={{ padding: '11px 18px', borderBottom: '1px solid var(--line)', fontSize: 16 }}>
                  <span className="muted">{k}</span><b style={{ fontWeight: 600 }}>{v || '—'}</b>
                </div>
              ))}
            </div>
            <p className="soft" style={{ fontSize: 15, lineHeight: 1.55 }}>Gemini will use this to write your daily quests. Starting wallet: 0 EXP · 50 coins.</p>
            <Link className="btn btn-gold" style={{ height: 56, fontSize: 17 }} to="/onboarding">Choose your categories</Link>
          </div>
        )}
      </main>
    </div>
  );
}
