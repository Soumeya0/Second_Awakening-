// Canvas host for the gate fight. Remount (change `key`) to restart a fight.
import { useEffect, useRef } from 'react';
import { H, W, createGame, runnerAI } from './engine.js';

const KEYS = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
  KeyJ: 'attack', KeyK: 'skill', KeyL: 'dodge', ShiftLeft: 'dodge', ShiftRight: 'dodge'
};

const PAD = [
  ['left', '◀', 'Move left'], ['right', '▶', 'Move right'], ['jump', 'Jump', 'Jump'],
  ['attack', 'Strike', 'Strike'], ['skill', 'Surge', 'Surge (30 focus)'], ['dodge', 'Dodge', 'Dodge']
];

export default function Arena({ mode, boss, fighter, onEnd, onLog, children }) {
  const canvas = useRef(null);
  const game = useRef(null);
  const cb = useRef({ onEnd, onLog });
  cb.current = { onEnd, onLog };

  useEffect(() => {
    const g = createGame({
      boss, fighter,
      ai: mode === 'watch' ? runnerAI : null,
      onLog: (t, c) => cb.current.onLog?.(t, c),
      onEnd: (r) => cb.current.onEnd?.(r)
    });
    game.current = g;
    const cv = canvas.current;
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = W * dpr;
    cv.height = H * dpr;

    let raf, last = performance.now();
    const loop = (now) => {
      g.step((now - last) / 1000);
      last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.draw(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const onKey = (e) => {
      const k = KEYS[e.code];
      if (!k || e.target.closest?.('input, textarea')) return;
      e.preventDefault();
      g.press(k, e.type === 'keydown');
    };
    const clear = () => g.clearKeys();
    if (mode === 'play') {
      window.addEventListener('keydown', onKey);
      window.addEventListener('keyup', onKey);
      window.addEventListener('blur', clear);
    }
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', clear);
    };
    // A fight is set up once per mount; the parent restarts it by changing `key`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hold = (k, down) => (e) => { e.preventDefault(); game.current?.press(k, down); };

  return (
    <div className="col" style={{ gap: 12, flex: '1 1 560px', minWidth: 0 }}>
      <div style={{ position: 'relative', borderRadius: 'var(--r-lg)', overflow: 'hidden', border: '1px solid var(--line)' }}>
        <canvas ref={canvas} style={{ display: 'block', width: '100%', aspectRatio: `${W} / ${H}` }}
          role="img" aria-label={mode === 'watch' ? `${fighter.name} fighting ${boss.name}` : `Your fight against ${boss.name}`} />
        {children}
      </div>
      {mode === 'play' && (
        <>
          <div className="row wrap between" style={{ gap: 8 }}>
            {PAD.map(([k, label, aria]) => (
              <button key={k} className="pad-btn" aria-label={aria}
                onPointerDown={hold(k, true)} onPointerUp={hold(k, false)} onPointerLeave={hold(k, false)} onPointerCancel={hold(k, false)}
                onContextMenu={(e) => e.preventDefault()}>{label}</button>
            ))}
          </div>
          <p className="dim" style={{ fontSize: 13 }}>
            Keyboard: <b>A / D</b> or arrows to move · <b>W / Space</b> jump · <b>J</b> strike (3rd hit is a finisher) · <b>K</b> Surge · <b>L / Shift</b> dodge.
            Jump the shockwaves and the charge, and hit the boss hard while it’s stunned.
          </p>
        </>
      )}
    </div>
  );
}
