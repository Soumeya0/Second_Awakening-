// Small presentational pieces shared across pages.
import { RANK_COLOR, rankOf } from '../api/game.js';

export function Bar({ pct, color = 'var(--blue)', h = 6, w, label }) {
  return (
    <span className="bar" style={{ height: h, width: w }} role={label ? 'progressbar' : undefined}
      aria-label={label} aria-valuenow={label ? Math.round(pct) : undefined} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </span>
  );
}

export function RankBadge({ level, size = 72 }) {
  const r = rankOf(level);
  return (
    <div className="rank-box" style={{ width: size, height: size, fontSize: size * 0.55, borderColor: RANK_COLOR[r], color: RANK_COLOR[r] }}
      aria-label={`Rank ${r}`}>{r}</div>
  );
}

export function MaterialIcon({ color, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 20 9 12 22 4 9Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M4 9h16M12 2 9 9l3 13 3-13-3-7" fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

// Rare drop icons: beast core, rune stone, gate key, shadow essence.
const LOOT_PATHS = {
  core: <><circle cx="12" cy="12" r="8" fillOpacity=".25" /><circle cx="12" cy="12" r="3.5" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2" fill="none" /></>,
  rune: <><path d="M12 2.5 20 7v10l-8 4.5L4 17V7Z" fillOpacity=".25" /><path d="M10 8v8M10 12l4-4M10 12l4 4" fill="none" /></>,
  key: <><circle cx="8" cy="12" r="4.5" fillOpacity=".25" /><path d="M12.5 12H21M18 12v3M21 12v2" fill="none" /></>,
  fang: <><path d="M7 4h10l-2 7-3 10-3-10Z" fillOpacity=".25" /><path d="M12 6v8" fill="none" /></>,
  sigil: <><path d="M4 18 5.5 8l4 4L12 5l2.5 7 4-4L20 18Z" fillOpacity=".25" /><path d="M4 21h16" fill="none" /></>,
  essence: <><path d="M12 2c2 4 6 6.5 6 11a6 6 0 0 1-12 0c0-2.4 1-4 2.3-5.3.3 2.2 1.4 3.3 2.7 3.3 0-3.8-.6-6 1-9Z" fillOpacity=".25" /><circle cx="12" cy="15" r="1.6" /></>
};
export function LootIcon({ kind, color, size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {LOOT_PATHS[kind]}
    </svg>
  );
}

export function Potion({ color, size = 56 }) {
  return (
    <svg width={size} height={size * 1.25} viewBox="0 0 40 50" aria-hidden="true">
      <rect x="15" y="2" width="10" height="7" rx="1.5" fill="#6B4A2B" />
      <path d="M16 9h8v8c6 2.5 10 7.5 10 14a14 14 0 0 1-28 0c0-6.5 4-11.5 10-14z" fill="rgba(255,255,255,.06)" stroke={color} strokeWidth="1.6" />
      <path d="M8.2 30h23.6a12 12 0 0 1-23.6 0z" fill={color} opacity=".75" />
      <circle cx="16" cy="36" r="1.6" fill="#fff" opacity=".5" /><circle cx="23" cy="33" r="1" fill="#fff" opacity=".4" />
      <path d="M13 22c-2 2-3 4-3 6" stroke="#fff" strokeOpacity=".35" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const PROOF_PATHS = {
  VITALS: <path d="M3 12h4l2-5 4 10 2-5h6" />,
  PHOTO: <><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8.5 7l1.5-3h4l1.5 3" /><circle cx="12" cy="13.5" r="3.5" /></>,
  FOCUS: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" /></>,
  HONOR: <path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z" />
};
// Icon for a verification type, drawn in its accent colour (PROOF_COLOR).
export function ProofChip({ proof, color }) {
  return (
    <span className="proof-chip" style={{ '--c': color }} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{PROOF_PATHS[proof]}</svg>
    </span>
  );
}

export const CoinIcon =({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" />
  </svg>
);

export const Check = ({ color = 'currentColor' }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m5 12 5 5 9-10" />
  </svg>
);
