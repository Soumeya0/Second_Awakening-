// Radar chart of the four stats (diamond), with the value on each axis.
import { PROOF_COLOR } from '../api/data.js';
import { stats } from '../api/game.js';

const CX = 140, CY = 110, R = 78; // centre and radius in a 280×220 box (wide, so side labels clear the points)

export default function StatRadar({ player }) {
  const list = stats(player); // Strength (top), Intelligence (right), Perception (bottom), Willpower (left)
  const max = Math.max(...list.map((s) => s.value)) * 1.15;
  const at = (k, r) => { const a = -Math.PI / 2 + (k * Math.PI) / 2; return [CX + Math.cos(a) * r, CY + Math.sin(a) * r]; };
  const ring = (f) => list.map((_, k) => at(k, R * f).join(',')).join(' ');
  const shape = list.map((s, k) => at(k, (R * s.value) / max).join(',')).join(' ');
  const labelPos = [[CX, 14], [276, CY + 4], [CX, 212], [4, CY + 4]];
  const anchor = ['middle', 'end', 'middle', 'start'];

  return (
    <svg viewBox="0 0 280 220" className="radar" role="img"
      aria-label={`Stats: ${list.map((s) => `${s.name} ${s.value}`).join(', ')}`}>
      <defs>
        <radialGradient id="radar-fill"><stop offset="0" stopColor="#4FB8FF" stopOpacity=".5" /><stop offset="1" stopColor="#A56BFF" stopOpacity=".3" /></radialGradient>
      </defs>
      {[1, 0.66, 0.33].map((f) => <polygon key={f} points={ring(f)} fill="none" stroke="#2B3243" strokeWidth="1" />)}
      {list.map((_, k) => { const [x, y] = at(k, R); return <line key={k} x1={CX} y1={CY} x2={x} y2={y} stroke="#2B3243" strokeWidth="1" />; })}
      <polygon points={shape} fill="url(#radar-fill)" stroke="#BFE3FF" strokeWidth="1.6" style={{ filter: 'drop-shadow(0 0 6px #4FB8FF)' }} />
      {list.map((s, k) => {
        const [x, y] = at(k, (R * s.value) / max);
        return <circle key={s.name} cx={x} cy={y} r="4" fill={PROOF_COLOR[s.proof]} stroke="#000" strokeWidth="1.5" />;
      })}
      {list.map((s, k) => (
        <text key={`t${s.name}`} x={labelPos[k][0]} y={labelPos[k][1]} textAnchor={anchor[k]} className="radar-label" fill={PROOF_COLOR[s.proof]}>
          {s.name.slice(0, 3).toUpperCase()} {s.value}
        </text>
      ))}
    </svg>
  );
}
