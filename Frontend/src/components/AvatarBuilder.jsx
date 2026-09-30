// Customise your mini self, and preview how it evolves at each rank.
import { useState } from 'react';
import { BODIES, BODY_HAIR, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, OUTFIT_COLORS, SKIN_TONES, STAGES, stageOf } from '../api/look.js';
import MiniSelf from './MiniSelf.jsx';

function Swatches({ label, colors, value, onPick, locked = () => false }) {
  return (
    <fieldset className="swatch-set">
      <legend className="mono muted">{label}</legend>
      <div className="row wrap" style={{ gap: 8 }}>
        {colors.map((c) => (
          <button key={c} type="button" className="swatch-btn" style={{ '--c': c }} aria-pressed={value === c} disabled={locked(c)}
            aria-label={`${label} ${c}${locked(c) ? ' (locked)' : ''}`} onClick={() => onPick(c)}>
            {locked(c) && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#030812" strokeWidth="2.6" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            )}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export default function AvatarBuilder({ look, onChange, level = 1, premium = false }) {
  const [preview, setPreview] = useState(stageOf(level));
  // onChange is a state setter; update from the latest look so quick successive picks all stick.
  const set = (k) => (v) => onChange((l) => ({ ...l, [k]: v }));
  const st = STAGES[preview];

  return (
    <div className="row wrap" style={{ gap: 28, alignItems: 'flex-start' }}>
      <div className="col builder-stage" style={{ flex: '0 1 300px', alignItems: 'center', gap: 12 }}>
        <div className="portrait" style={{ '--c': look.outfit, width: '100%' }}>
          <MiniSelf look={look} stage={preview} size={240} title={`Your character as ${st.title}`} />
          <div className="col" style={{ alignItems: 'center', gap: 2 }}>
            <span className="display" style={{ fontSize: 18 }}>{st.title}</span>
            <span className="muted" style={{ fontSize: 13 }}>Rank {st.rank} · Lv.{st.lv} · {st.outfit}</span>
          </div>
        </div>
        <div className="col" style={{ gap: 6, width: '100%' }}>
          <span className="mono muted" style={{ textAlign: 'center' }}>PREVIEW YOUR EVOLUTION</span>
          <div className="row" style={{ gap: 4, justifyContent: 'center' }} role="group" aria-label="Preview evolution stage">
            {STAGES.map((s, k) => (
              <button key={s.rank} type="button" className="stage-chip" aria-pressed={preview === k} onClick={() => setPreview(k)}>
                {s.rank}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="col" style={{ flex: '1 1 320px', gap: 18 }}>
        <fieldset className="swatch-set">
          <legend className="mono muted">BODY</legend>
          <div className="row" style={{ gap: 8 }} role="radiogroup" aria-label="Body">
            {BODIES.map((b) => (
              <button key={b.id} type="button" role="radio" aria-checked={look.body === b.id} className="style-btn body-btn"
                onClick={() => onChange((l) => (l.body === b.id ? l : { ...l, body: b.id, hairStyle: BODY_HAIR[b.id] }))}>
                <MiniSelf look={{ ...look, body: b.id, hairStyle: look.body === b.id ? look.hairStyle : BODY_HAIR[b.id] }} stage={0} size={52} crop="bust" />
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>
        <Swatches label="SKIN" colors={SKIN_TONES} value={look.skin} onPick={set('skin')} />
        <fieldset className="swatch-set">
          <legend className="mono muted">HAIRSTYLE</legend>
          <div className="row wrap" style={{ gap: 8 }}>
            {HAIR_STYLES.map((h) => (
              <button key={h.id} type="button" className="style-btn" aria-pressed={look.hairStyle === h.id} onClick={() => set('hairStyle')(h.id)}>
                <MiniSelf look={{ ...look, hairStyle: h.id }} stage={0} size={46} crop="bust" />
                {h.label}
              </button>
            ))}
          </div>
        </fieldset>
        <Swatches label="HAIR COLOR" colors={HAIR_COLORS} value={look.hair} onPick={set('hair')} />
        <Swatches label="EYES" colors={EYE_COLORS} value={look.eyes} onPick={set('eyes')} />
        <Swatches label="OUTFIT COLOR" colors={OUTFIT_COLORS.map((o) => o.c)} value={look.outfit} onPick={set('outfit')}
          locked={(c) => !premium && OUTFIT_COLORS.find((o) => o.c === c).premium} />
        {!premium && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Locked colors unlock with the Essence of style potion in the Profile shop.</p>}
      </div>
    </div>
  );
}
