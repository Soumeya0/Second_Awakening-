import { Link, NavLink } from 'react-router-dom';
import { usePlayer } from '../api/player.jsx';
import { RANK_COLOR, rankOf } from '../api/game.js';
import { Bar, CoinIcon } from './ui.jsx';

export default function Nav() {
  const { player, demo, enterDemo } = usePlayer();
  const r = rankOf(player.level);
  return (
    <nav id="nav">
      <Link to="/" className="brand">SECOND AWAKENING</Link>
      <div className="row" style={{ gap: 6 }}>
        <NavLink to="/dashboard" className="navlink">Quests</NavLink>
        <NavLink to="/gate" className="navlink">Gate</NavLink>
        <NavLink to="/profile" className="navlink">Profile</NavLink>
      </div>
      <div className="row" style={{ gap: 10 }}>
        {!demo && <button className="pill demo-pill hide-sm" onClick={enterDemo} title="Show the app as a Rank S player">★ Judge demo</button>}
        <span className="pill coins" aria-label={`${player.coins} coins`}><CoinIcon /><b>{player.coins}</b></span>
        <span className="pill hide-sm" aria-label={`${player.xp} of 1000 EXP`}>
          <span className="mono" style={{ color: 'var(--blue)', fontSize: 11 }}>EXP</span>
          <Bar pct={player.xp / 10} w={72} />
          <span className="soft" style={{ fontSize: 13 }}>{player.xp} / 1000</span>
        </span>
        <Link to="/profile" className="pill">
          <span className="rank-dot" style={{ '--c': RANK_COLOR[r] }}>{r}</span>Lv {player.level}
        </Link>
      </div>
    </nav>
  );
}
