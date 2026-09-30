// Character development: every evolution E → S. Locked ones are silhouettes unless the demo preview is on.
import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { STAGES } from '../api/look.js';
import MiniSelf from './MiniSelf.jsx';
import SystemWindow from './SystemWindow.jsx';

export default function EvolutionTimeline({ look, stage, level }) {
  const [demo, setDemo] = useState(false);
  const [open, setOpen] = useState(stage);
  const dialog = useRef(null);
  const closeBtn = useRef(null);
  const show = (k) => { setOpen(k); dialog.current.showModal(); closeBtn.current.focus(); };
  const s = STAGES[open];
  const unlocked = open <= stage;

  return (
    <SystemWindow title="CHARACTER DEVELOPMENT" icon={null} tone="violet">
      <p className="sys-note">[Stage {stage + 1} of {STAGES.length} · {STAGES[stage].title}. {demo ? 'Previewing every rank.' : 'Rank up to evolve.'}]</p>

      <div className="row between wrap" style={{ gap: 12, marginBottom: 14 }}>
        <label className="toggle">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          <span className="toggle-track" aria-hidden="true" />
          Preview all ranks (demo)
        </label>
        <span className="muted" style={{ fontSize: 13 }}>Click a stage to see it up close</span>
      </div>

      <div className="evo-grid">
        {STAGES.map((st, k) => {
          const got = k <= stage;
          const visible = got || demo;
          return (
            <button key={st.rank} type="button" onClick={() => show(k)}
              className={`evo-card${k === stage ? ' current' : ''}${got ? '' : ' locked'}${!got && demo ? ' preview' : ''}`}
              aria-label={`${st.title}, Rank ${st.rank}, level ${st.lv}${got ? '' : ' (locked)'}. View larger`}>
              {!got && demo && <span className="evo-badge">PREVIEW</span>}
              <MiniSelf look={look} stage={k} size={130} locked={!visible} />
              <span className="evo-lv">Lv.{st.lv}</span>
              <span className="evo-name">{visible ? st.title : `Rank ${st.rank}`}</span>
            </button>
          );
        })}
      </div>

      <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
        <Link className="btn btn-ghost" to="/customize">Customize your look</Link>
      </div>

      <dialog ref={dialog} className="evo-dialog" aria-labelledby="evo-title" onClick={(e) => { if (e.target === dialog.current) dialog.current.close(); }}>
        <SystemWindow title={`RANK ${s.rank}`} icon={null} tone={s.rank === 'S' ? 'violet' : 'blue'}>
          <div className="col" style={{ alignItems: 'center', gap: 12 }}>
            <div className="portrait" style={{ '--c': look.outfit, width: '100%' }}>
              <MiniSelf look={look} stage={open} size={260} title={`${s.title} preview`} />
            </div>
            <h3 id="evo-title" className="display" style={{ fontSize: 24, margin: 0 }}>{s.title}</h3>
            <p className="sys-note" style={{ margin: 0 }}>
              [{unlocked ? 'Unlocked' : `Preview · unlocks at Level ${s.lv} (you are Level ${level})`} · {s.outfit}]
            </p>
            <div className="row" style={{ gap: 8 }}>
              <button className="btn btn-ghost" onClick={() => setOpen(Math.max(0, open - 1))} disabled={open === 0} aria-label="Previous rank">◀</button>
              <div className="row" style={{ gap: 4 }}>
                {STAGES.map((st, k) => (
                  <button key={st.rank} type="button" className="stage-chip" aria-pressed={open === k} onClick={() => setOpen(k)}>{st.rank}</button>
                ))}
              </div>
              <button className="btn btn-ghost" onClick={() => setOpen(Math.min(STAGES.length - 1, open + 1))} disabled={open === STAGES.length - 1} aria-label="Next rank">▶</button>
            </div>
            <button ref={closeBtn} className="btn btn-light" style={{ width: '100%' }} onClick={() => dialog.current.close()}>Close</button>
          </div>
        </SystemWindow>
      </dialog>
    </SystemWindow>
  );
}
