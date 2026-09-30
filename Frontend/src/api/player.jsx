// Player state: one object in localStorage, shared through context (context lives in playerContext.js).
// A judge demo swaps in a Rank S showcase player under its own key; the real save is untouched.
import { useCallback, useContext, useRef, useState } from 'react';
import { checkMissedDays, today } from './game.js';
import { showcasePlayer } from './demo.js';
import { PlayerContext as Ctx } from './playerContext.js';

const KEY = 'second-awakening';
const DEMO_KEY = 'second-awakening-demo';
const MODE_KEY = 'second-awakening-mode';

const fresh = () => ({
  name: 'Player', character: null, onboarded: false, level: 1, xp: 0, coins: 50,
  chosen: [], answers: {}, bars: {}, materials: {}, history: {}, items: {}, buffs: {}, stats: {}, questsDone: 0,
  started: today(), lastCheck: today(), day: null, rift: null
});

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; /* private mode */ }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not persisted */ }
}

function load() {
  const p = { ...fresh(), ...read(KEY) };
  if (!p.day || p.day.date !== today()) p.day = { date: today(), status: {}, cleared: false };
  checkMissedDays(p);
  return p;
}

// Reuse today's demo (so a reload keeps what the judge did); rebuild it on a new day.
function loadDemo(real) {
  const d = read(DEMO_KEY);
  if (d && d.day?.date === today()) return d;
  const s = showcasePlayer(real);
  write(DEMO_KEY, s);
  return s;
}

export function PlayerProvider({ children }) {
  const store = useRef(null);
  if (!store.current) {
    const real = load();
    const inDemo = read(MODE_KEY) === 'demo';
    store.current = { mode: inDemo ? 'demo' : 'real', real, demo: inDemo ? loadDemo(real) : null };
  }
  const [player, setPlayer] = useState(() => store.current[store.current.mode]);
  const [intro, setIntro] = useState(false);

  // update(fn): fn mutates a clone of the active player; its return value is passed back (e.g. a quest reward).
  const update = useCallback((fn) => {
    const s = store.current;
    const next = structuredClone(s[s.mode]);
    const out = fn(next);
    s[s.mode] = next;
    write(s.mode === 'demo' ? DEMO_KEY : KEY, next);
    setPlayer(next);
    return out;
  }, []);

  const enterDemo = useCallback(() => {
    const s = store.current;
    s.demo = showcasePlayer(s.real);
    s.mode = 'demo';
    write(DEMO_KEY, s.demo);
    write(MODE_KEY, 'demo');
    setPlayer(s.demo);
    setIntro(true);
  }, []);

  const exitDemo = useCallback(() => {
    const s = store.current;
    s.mode = 'real';
    write(MODE_KEY, 'real');
    setPlayer(s.real);
    setIntro(false);
  }, []);

  const reset = useCallback(() => {
    if (store.current.mode === 'demo') return enterDemo(); // "reset" in the demo = a fresh showcase
    update((p) => { Object.assign(p, fresh(), { day: { date: today(), status: {}, cleared: false } }); });
  }, [update, enterDemo]);

  const value = {
    player, update, reset,
    demo: store.current.mode === 'demo', enterDemo, exitDemo,
    intro, showIntro: () => setIntro(true), closeIntro: () => setIntro(false)
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const usePlayer = () => useContext(Ctx);
