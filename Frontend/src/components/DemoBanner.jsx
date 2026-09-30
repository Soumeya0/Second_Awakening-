// Shown on every in-app page while the judge demo is on.
import { useNavigate } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';

export default function DemoBanner() {
  const { demo, exitDemo, showIntro, reset } = usePlayer();
  const navigate = useNavigate();
  if (!demo) return null;
  return (
    <div className="demo-banner" role="status">
      <span className="mono">JUDGE DEMO · RANK S SHOWCASE</span>
      <span className="soft hide-sm">Everything here is a demo save — the real progress is untouched.</span>
      <div className="row" style={{ gap: 8 }}>
        <button className="demo-btn" onClick={showIntro}>Replay awakening</button>
        <button className="demo-btn" onClick={reset}>Restart demo</button>
        <button className="demo-btn solid" onClick={() => { exitDemo(); navigate('/dashboard'); }}>Exit demo</button>
      </div>
    </div>
  );
}
