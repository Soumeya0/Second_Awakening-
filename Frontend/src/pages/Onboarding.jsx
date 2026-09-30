// Pick at least 10 categories, then create your mini self.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { CATEGORIES, MIN_CATEGORIES, PROOF_COLOR, PROOF_LABEL } from '../api/data.js';
import { lookOf } from '../api/look.js';
import { today } from '../api/game.js';
import { syncCategories } from '../api/serverQuests.js';
import AvatarBuilder from '../components/AvatarBuilder.jsx';
import SystemWindow from '../components/SystemWindow.jsx';
import { Bar } from '../components/ui.jsx';

export default function Onboarding() {
  const { player, update } = usePlayer();
  const navigate = useNavigate();
  const [step, setStep] = useState('categories');
  const [chosen, setChosen] = useState(player.chosen);
  const [look, setLook] = useState(lookOf(player));
  const n = chosen.length;
  const ready = n >= MIN_CATEGORIES;

  const toggle = (id) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  async function finish() {
    await syncCategories({ chosen, look, name: player.name, answers: player.answers });
    update((p) => {
      p.chosen = chosen;
      p.look = look;
      if (!p.onboarded) { p.onboarded = true; p.started = today(); p.lastCheck = today(); }
    });
    navigate('/dashboard');
  }

  return (
    <div className="page col" style={{ gap: 28 }}>
      <header className="row between wrap">
        <Link to="/" className="brand">SECOND AWAKENING</Link>
        <span className="mono muted">STEP {step === 'categories' ? 1 : 2} OF 2</span>
      </header>

      {step === 'categories' ? (
        <>
          <div className="row between wrap" style={{ alignItems: 'flex-end', gap: '24px 40px' }}>
            <div className="col" style={{ gap: 8 }}>
              <h1 className="page-title">Choose at least 10 categories</h1>
              <p className="soft" style={{ fontSize: 16 }}>Each category gets its own progress bar. Your 4 daily quests rotate through them in the order you pick them, from hard to easy.</p>
            </div>
            <div className="col" style={{ width: 280, gap: 8 }}>
              <div className="row between" style={{ fontSize: 15 }}>
                <b>{n} chosen</b>
                <span role="status" style={{ color: ready ? 'var(--blue)' : 'var(--muted)' }}>{ready ? 'Ready' : `${MIN_CATEGORIES - n} to go`}</span>
              </div>
              <Bar pct={(n / MIN_CATEGORIES) * 100} h={8} label="Categories chosen" />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
            {CATEGORIES.map((c) => {
              const order = chosen.indexOf(c.id) + 1;
              const on = order > 0;
              return (
                <button key={c.id} className="tile" aria-pressed={on} onClick={() => toggle(c.id)}>
                  <span className="row between" style={{ width: '100%', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{c.name}</span>
                    <span className="checkbox" aria-hidden="true">{on ? order : ''}</span>
                  </span>
                  <span className="mono proof-text" style={{ fontSize: 11, letterSpacing: '.08em', '--c': PROOF_COLOR[c.proof] }}>{PROOF_LABEL[c.proof].toUpperCase()} PROOF</span>
                </button>
              );
            })}
          </div>
          <div className="row between wrap" style={{ gap: 16 }}>
            <p className="muted" style={{ fontSize: 14, flex: '1 1 400px' }}>Proof types: Photo is checked by Gemini · Vitals use the camera heart-rate reading · Focus watches you stay on task · Honor is your word.</p>
            <button className="btn btn-blue" disabled={!ready} onClick={() => setStep('character')}>Continue</button>
          </div>
        </>
      ) : (
        <>
          <div className="col" style={{ gap: 8 }}>
            <h1 className="page-title">Create your mini self</h1>
            <p className="soft" style={{ fontSize: 16 }}>This is you in the game. Make it look like you — it evolves as you rank up.</p>
          </div>
          <SystemWindow title="CHARACTER CREATION" tone="violet" icon={null}>
            <AvatarBuilder look={look} onChange={setLook} level={player.level} premium={(player.items.outfit || 0) > 0} />
          </SystemWindow>
          <div className="row between">
            <button className="btn btn-ghost" onClick={() => setStep('categories')}>Back</button>
            <button className="btn btn-gold" onClick={finish}>Begin my awakening</button>
          </div>
        </>
      )}
    </div>
  );
}
