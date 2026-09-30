// Real-time side-view gate fight: one fighter vs. one boss, drawn on a 2D canvas.
// createGame() is framework-free; Arena.jsx drives step()/draw() from requestAnimationFrame.
export const W = 960;
export const H = 480;
export const GROUND = 400;
const GRAVITY = 2200;
const RUN = 260;
const JUMP = 780;

const rand = (a, b) => a + Math.random() * (b - a);
const roll = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rgba = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

const TELEGRAPH = { slam: 0.75, charge: 0.6, shards: 0.5 };

export function createGame({ boss, fighter, ai, onLog = () => {}, onEnd = () => {} }) {
  const maxHp = fighter.maxHp || 100;
  const s = {
    time: 0, shake: 0, over: null, endT: 0, ended: false, keys: {},
    p: { x: 180, y: GROUND, vx: 0, vy: 0, face: 1, hp: maxHp, maxHp, mp: 60, state: 'idle', t: 0, hit: false,
      dodgeCd: 0, inv: 0, flash: 0, combo: 0, comboT: 0, run: 0, name: fighter.name, color: fighter.color, skin: fighter.skin || '#F1C9A5', hair: fighter.hair || '#15161C', longHair: !!fighter.longHair, dmg: fighter.dmg || 1, level: fighter.level || 1 },
    b: { x: W - 200, y: GROUND, face: -1, hp: boss.hp, maxHp: boss.hp, state: 'idle', t: 0, next: 1.4, hit: false, thrown: 0,
      flash: 0, enraged: false, name: boss.name, color: boss.color },
    shots: [], waves: [], rocks: [], parts: [], texts: [], ghosts: []
  };
  const { p, b } = s;
  const tele = (name) => TELEGRAPH[name] * (b.enraged ? 0.7 : 1);

  function setP(state) { p.state = state; p.t = 0; p.hit = false; }
  function bossIdle() { b.state = 'idle'; b.t = 0; b.next = rand(0.8, 1.7); }

  function burst(x, y, color, n, speed = 260) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), v = rand(speed * 0.3, speed);
      s.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: rand(0.3, 0.7), max: 0.7, color, size: rand(2, 5) });
    }
  }
  function floatText(x, y, text, color, big) {
    s.texts.push({ x: x + rand(-14, 14), y, text, color, life: 0.9, big });
  }

  function hitBoss(raw, big, label) {
    if (b.hp <= 0) return;
    const d = Math.round(raw * (b.state === 'stunned' ? 1.5 : 1));
    b.hp = Math.max(0, b.hp - d);
    b.flash = 0.12;
    s.shake = Math.max(s.shake, big ? 9 : 4);
    burst(b.x - b.face * 30, GROUND - rand(80, 170), big ? '#F2B84B' : '#EDF4F9', big ? 18 : 8);
    floatText(b.x, GROUND - 230, d, big ? '#F2B84B' : '#EDF4F9', big);
    onLog(`${p.name} · ${label} → ${d}${b.state === 'stunned' ? ' (stunned!)' : ''}`, big ? '#F2B84B' : '#EDF4F9');
    if (!b.enraged && b.hp > 0 && b.hp < b.maxHp * 0.4) {
      b.enraged = true;
      s.shake = 14;
      onLog(`[SYSTEM] ${b.name} is enraged. Attacks come faster.`, '#E0304F');
    }
  }

  function hurtPlayer(d, knock, source) {
    if (p.inv > 0 || s.over) return;
    p.hp = Math.max(0, p.hp - d);
    p.inv = 0.7;
    p.flash = 0.2;
    setP('hurt');
    p.vx = knock;
    p.vy = -320;
    s.shake = Math.max(s.shake, 10);
    burst(p.x, p.y - 60, '#E0304F', 12);
    floatText(p.x, p.y - 120, d, '#FF5C74');
    onLog(`${b.name} · ${source} → ${d}`, '#FF5C74');
  }

  function throwRock() {
    const T = 0.9, sx = b.x + b.face * 40, sy = GROUND - 200;
    const tx = clamp(p.x + p.vx * 0.35 + rand(-50, 50), 40, W - 40);
    s.rocks.push({ x: sx, y: sy, vx: (tx - sx) / T, vy: (GROUND - sy - 0.5 * GRAVITY * T * T) / T, tx, spin: rand(0, 6) });
  }

  function updatePlayer(input, dt) {
    p.t += dt;
    p.inv = Math.max(0, p.inv - dt);
    p.dodgeCd = Math.max(0, p.dodgeCd - dt);
    p.flash = Math.max(0, p.flash - dt);
    p.comboT = Math.max(0, p.comboT - dt);
    if (!p.comboT) p.combo = 0;
    const onGround = p.y >= GROUND;

    if (s.over === 'lost') {
      p.state = 'down';
      p.vx *= 0.9;
    } else if (!s.over) {
      const busy = ['attack', 'skill', 'dodge', 'hurt'].includes(p.state);
      if (!busy) {
        const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        p.vx = dir * RUN;
        if (dir) p.face = dir;
        p.state = !onGround ? 'jump' : dir ? 'run' : 'idle';
        if (input.jump && onGround) { p.vy = -JUMP; burst(p.x, GROUND, '#4C6C81', 6, 120); }
        if (input.dodge && p.dodgeCd <= 0) {
          setP('dodge'); p.vx = p.face * 560; p.inv = 0.38; p.dodgeCd = 0.75;
        } else if (input.skill && p.mp >= 30) {
          setP('skill'); p.mp -= 30; p.vx = 0;
        } else if (input.attack) {
          setP('attack'); p.combo = (p.combo % 3) + 1; p.comboT = 0.7; p.vx = p.face * 70;
        }
      }
      if (p.state === 'attack') {
        if (!p.hit && p.t > 0.08) {
          p.hit = true;
          const reach = Math.abs(b.x - (p.x + p.face * 50));
          if (reach < 100 && p.y > GROUND - 220) {
            const fin = p.combo === 3;
            hitBoss(roll(10, 16) * (fin ? 1.6 : 1) * p.dmg, fin, fin ? 'Finisher' : 'Strike');
            p.mp = Math.min(100, p.mp + 8);
          }
        }
        p.vx *= 0.85;
        if (p.t > 0.3) setP('idle');
      } else if (p.state === 'skill') {
        if (!p.hit && p.t > 0.15) {
          p.hit = true;
          s.shots.push({ x: p.x + p.face * 40, y: p.y - 60, vx: p.face * 760, life: 1.1, hit: false });
          s.shake = Math.max(s.shake, 5);
        }
        if (p.t > 0.4) setP('idle');
      } else if (p.state === 'dodge') {
        s.ghosts.push({ x: p.x, y: p.y, face: p.face, life: 0.25 });
        if (p.t > 0.35) { setP('idle'); p.vx = 0; }
      } else if (p.state === 'hurt' && p.t > 0.28) {
        setP('idle');
      }
    } else {
      p.vx *= 0.9;
      if (p.state !== 'jump') p.state = 'idle';
    }

    p.vy += GRAVITY * dt;
    p.y += p.vy * dt;
    if (p.y >= GROUND) { p.y = GROUND; p.vy = 0; }
    p.x = clamp(p.x + p.vx * dt, 40, W - 40);
    p.run += Math.abs(p.vx) * dt * 0.045;
  }

  function updateBoss(dt) {
    b.t += dt;
    b.flash = Math.max(0, b.flash - dt);
    if (b.state === 'dead') return;
    if (s.over) { b.state = 'idle'; return; }
    const dx = p.x - b.x;
    const dist = Math.abs(dx);

    if (b.state === 'idle') {
      b.face = dx > 0 ? 1 : -1;
      if (dist > 180) b.x += Math.sign(dx) * (b.enraged ? 120 : 85) * dt;
      if (b.t > b.next * (b.enraged ? 0.7 : 1)) {
        const r = Math.random();
        b.state = dist < 230 ? (r < 0.45 ? 'slam' : r < 0.7 ? 'shards' : 'retreat') : (r < 0.55 ? 'charge' : 'shards');
        b.t = 0; b.hit = false; b.thrown = 0;
      }
    } else if (b.state === 'slam') {
      if (b.t >= tele('slam') && !b.hit) {
        b.hit = true;
        s.shake = 14;
        burst(b.x, GROUND, b.color, 26, 320);
        onLog(`${b.name} slams the ground.`, '#FF5C74');
        if (dist < 130 && p.y > GROUND - 60) hurtPlayer(roll(12, 18), Math.sign(dx || 1) * 420, 'Slam');
        s.waves.push({ x: b.x - 90, dir: -1, hit: false }, { x: b.x + 90, dir: 1, hit: false });
      }
      if (b.t > tele('slam') + 0.6) bossIdle();
    } else if (b.state === 'charge') {
      if (b.t >= tele('charge')) {
        b.x += b.face * (b.enraged ? 1000 : 850) * dt;
        if (Math.random() < 0.6) s.parts.push({ x: b.x - b.face * 60, y: GROUND - 4, vx: -b.face * rand(60, 180), vy: rand(-120, -30), life: 0.5, max: 0.5, color: '#4C6C81', size: rand(3, 6) });
        if (!b.hit && Math.abs(p.x - b.x) < 80 && p.y > GROUND - 115) { b.hit = true; hurtPlayer(roll(14, 20), b.face * 600, 'Charge'); }
        if (b.x <= 90 || b.x >= W - 90) {
          b.x = clamp(b.x, 90, W - 90);
          b.state = 'stunned'; b.t = 0;
          s.shake = 16;
          burst(b.x + b.face * 70, GROUND - 100, '#87A4B5', 20);
          onLog(`${b.name} crashes into the wall — stunned! Hit it now.`, '#F2B84B');
        }
      }
    } else if (b.state === 'retreat') {
      // hop back to make room, then charge
      b.x -= b.face * 340 * dt;
      if (b.t > 0.55 || b.x <= 90 || b.x >= W - 90) { b.state = 'charge'; b.t = 0; b.hit = false; b.face = p.x > b.x ? 1 : -1; }
    } else if (b.state === 'stunned') {
      if (b.t > 1.4) bossIdle();
    } else if (b.state === 'shards') {
      const n = b.enraged ? 5 : 3;
      b.face = dx > 0 ? 1 : -1;
      if (b.t > tele('shards') + b.thrown * 0.18 && b.thrown < n) { throwRock(); b.thrown++; }
      if (b.t > tele('shards') + n * 0.18 + 0.5) bossIdle();
    }
    b.x = clamp(b.x, 90, W - 90);
  }

  function updateProjectiles(dt) {
    for (const sh of s.shots) {
      sh.x += sh.vx * dt;
      sh.life -= dt;
      if (Math.random() < 0.8) s.parts.push({ x: sh.x, y: sh.y + rand(-20, 20), vx: -sh.vx * 0.1, vy: rand(-40, 40), life: 0.3, max: 0.3, color: '#4FB8FF', size: rand(2, 4) });
      if (!sh.hit && Math.abs(sh.x - b.x) < 70 && b.hp > 0) { sh.hit = true; sh.life = 0; hitBoss(roll(26, 34) * p.dmg, true, 'Surge'); }
    }
    s.shots = s.shots.filter((sh) => sh.life > 0 && sh.x > -50 && sh.x < W + 50);

    for (const w of s.waves) {
      w.x += w.dir * 440 * dt;
      if (!w.hit && Math.abs(p.x - w.x) < 24 && p.y > GROUND - 34) { w.hit = true; hurtPlayer(roll(8, 12), w.dir * 300, 'Shockwave'); }
    }
    s.waves = s.waves.filter((w) => w.x > -40 && w.x < W + 40);

    for (const r of s.rocks) {
      r.vy += GRAVITY * dt;
      r.x += r.vx * dt;
      r.y += r.vy * dt;
      r.spin += dt * 8;
      if (!r.done && Math.abs(r.x - p.x) < 26 && r.y > p.y - 105 && r.y < p.y + 5) { r.done = true; hurtPlayer(roll(7, 11), Math.sign(r.vx) * 250, 'Stone shard'); burst(r.x, r.y, '#87A4B5', 10); }
      if (r.y >= GROUND) { r.done = true; burst(r.x, GROUND, '#87A4B5', 8, 160); }
    }
    s.rocks = s.rocks.filter((r) => !r.done);
  }

  function updateFx(dt) {
    for (const q of s.parts) { q.vy += 600 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.life -= dt; }
    s.parts = s.parts.filter((q) => q.life > 0);
    for (const t of s.texts) { t.y -= 60 * dt; t.life -= dt; }
    s.texts = s.texts.filter((t) => t.life > 0);
    for (const g of s.ghosts) g.life -= dt;
    s.ghosts = s.ghosts.filter((g) => g.life > 0);
    s.shake = Math.max(0, s.shake - dt * 45);
  }

  function step(rawDt) {
    const dt = Math.min(rawDt, 1 / 30);
    s.time += dt;
    updatePlayer(ai ? ai(s) : s.keys, dt);
    updateBoss(dt);
    updateProjectiles(dt);
    updateFx(dt);
    if (!s.over) {
      if (b.hp <= 0) {
        s.over = 'won'; b.state = 'dead'; b.t = 0; s.shake = 18;
        burst(b.x, GROUND - 120, b.color, 70, 420);
        onLog(`[SYSTEM] ${b.name} defeated.`, '#F2B84B');
      } else if (p.hp <= 0) {
        s.over = 'lost';
        onLog(`[SYSTEM] ${p.name} has fallen.`, '#FF5C74');
      }
    } else if (!s.ended && (s.endT += dt) > 1.6) {
      s.ended = true;
      onEnd(s.over);
    }
  }

  // ---------- drawing ----------
  function bar(ctx, x, y, w, h, pct, color) {
    ctx.fillStyle = '#25435D';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, Math.max(0, w * pct), h, h / 2); ctx.fill();
  }

  function drawStage(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#132647'); g.addColorStop(1, '#0A1424');
    ctx.fillStyle = g;
    ctx.fillRect(-30, -30, W + 60, H + 60);
    // gate arches behind the fight
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rgba(b.color, 0.1 + i * 0.07 + (b.enraged ? 0.06 * Math.sin(s.time * 6) : 0));
      ctx.beginPath(); ctx.ellipse(W / 2, GROUND, 330 - i * 70, 360 - i * 80, 0, Math.PI, Math.PI * 2); ctx.stroke();
    }
    // pillars
    for (const x of [60, W - 100]) {
      ctx.fillStyle = '#1A2E52'; ctx.fillRect(x, 140, 40, GROUND - 140);
      ctx.fillStyle = '#25435D'; ctx.fillRect(x - 8, 128, 56, 14);
      ctx.fillStyle = rgba(b.color, 0.5 + 0.3 * Math.sin(s.time * 3 + x)); ctx.fillRect(x + 16, 170, 8, 8);
    }
    // drifting motes
    for (let k = 0; k < 28; k++) {
      const x = (k * 97 + s.time * (10 + (k % 4) * 6)) % W;
      const y = 40 + ((k * 53 + Math.sin(s.time + k) * 10) % (GROUND - 60));
      ctx.fillStyle = rgba(b.color, 0.12 + (k % 3) * 0.06);
      ctx.fillRect(x, y, 2, 2);
    }
    // floor with perspective grid
    ctx.fillStyle = '#0E1A30'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = rgba(b.color, 0.12); ctx.lineWidth = 1;
    for (let x = -W; x <= W * 2; x += 60) { ctx.beginPath(); ctx.moveTo(x, GROUND); ctx.lineTo(W / 2 + (x - W / 2) * 2.2, H); ctx.stroke(); }
    for (const y of [GROUND + 22, GROUND + 50]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.strokeStyle = rgba(b.color, 0.55); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND); ctx.lineTo(W, GROUND); ctx.stroke();
  }

  function drawTelegraphs(ctx) {
    const pulse = 0.5 + 0.5 * Math.sin(s.time * 20);
    if (b.state === 'slam' && !b.hit) {
      const k = b.t / tele('slam');
      ctx.fillStyle = `rgba(224,48,79,${0.12 + 0.25 * k})`;
      ctx.beginPath(); ctx.ellipse(b.x, GROUND + 8, 130, 14, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = `rgba(224,48,79,${0.4 + 0.4 * pulse})`; ctx.lineWidth = 2; ctx.stroke();
    }
    if (b.state === 'charge' && b.t < tele('charge')) {
      const end = b.face > 0 ? W - 60 : 60;
      const gr = ctx.createLinearGradient(b.x, 0, end, 0);
      gr.addColorStop(0, `rgba(224,48,79,${0.35 * pulse + 0.1})`); gr.addColorStop(1, 'rgba(224,48,79,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(Math.min(b.x, end), GROUND - 110, Math.abs(end - b.x), 110);
    }
    for (const r of s.rocks) {
      ctx.fillStyle = `rgba(224,48,79,${0.25 + 0.3 * pulse})`;
      ctx.beginPath(); ctx.ellipse(r.tx, GROUND + 4, 22, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawBoss(ctx) {
    const dead = b.state === 'dead';
    const alpha = dead ? Math.max(0, 1 - b.t / 1.2) : 1;
    if (alpha <= 0) return;
    const bob = b.state === 'idle' ? Math.sin(s.time * 2.4) * 4 : 0;
    let squash = 1, lean = 0, arm = 0;
    if (b.state === 'slam') {
      const k = Math.min(1, b.t / tele('slam'));
      arm = b.hit ? 0.3 : -1.9 * k;
      squash = b.hit ? 0.9 : 1 + 0.05 * k;
    }
    if (b.state === 'charge') { squash = 0.72; lean = 0.25; }
    if (b.state === 'shards') arm = -1.2 * Math.abs(Math.sin(b.t * 10));
    if (b.state === 'stunned') lean = -0.12;
    const sink = dead ? b.t * 60 : 0;
    const shakeX = b.state === 'charge' && b.t < tele('charge') ? rand(-3, 3) : 0;

    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(b.x, GROUND + 6, 90, 12, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x + shakeX, b.y + bob + sink);
    ctx.scale(b.face, squash);
    ctx.rotate(lean);
    ctx.translate(-130, -244);
    const white = b.flash > 0;
    const body = white ? '#FFFFFF' : b.enraged ? '#340A13' : '#1A2E52';
    const limb = white ? '#FFFFFF' : b.enraged ? '#2A0810' : '#122240';
    const edge = b.enraged ? '#E0304F' : b.color;
    const poly = (pts, fill) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = edge; ctx.lineWidth = 2.5; ctx.stroke();
    };
    const armPoly = (pivot, pts, a) => {
      ctx.save(); ctx.translate(pivot[0], pivot[1]); ctx.rotate(a); ctx.translate(-pivot[0], -pivot[1]);
      poly(pts, limb); ctx.restore();
    };
    armPoly([74, 72], [[74, 72], [34, 120], [48, 170], [70, 130]], -arm);
    poly([[100, 200], [124, 200], [118, 244], [94, 244]], body);
    poly([[136, 200], [160, 200], [166, 244], [142, 244]], body);
    poly([[90, 140], [170, 140], [160, 200], [100, 200]], limb);
    poly([[130, 24], [186, 70], [176, 138], [84, 138], [74, 70]], body);
    armPoly([186, 72], [[186, 72], [226, 120], [212, 170], [190, 130]], arm);
    // glowing eyes
    ctx.shadowColor = '#E0304F'; ctx.shadowBlur = b.state === 'idle' ? 8 : 18;
    ctx.fillStyle = b.state === 'stunned' ? '#4C6C81' : '#E0304F';
    ctx.fillRect(104, 80, 14, 8); ctx.fillRect(142, 80, 14, 8);
    ctx.shadowBlur = 0;
    // cracks appear as it loses health
    ctx.strokeStyle = rgba(edge, 0.7); ctx.lineWidth = 2;
    const dmg = 1 - b.hp / b.maxHp;
    if (dmg > 0.3) { ctx.beginPath(); ctx.moveTo(120, 40); ctx.lineTo(128, 60); ctx.lineTo(118, 72); ctx.stroke(); }
    if (dmg > 0.6) { ctx.beginPath(); ctx.moveTo(150, 100); ctx.lineTo(160, 118); ctx.lineTo(150, 134); ctx.moveTo(110, 150); ctx.lineTo(124, 170); ctx.stroke(); }
    ctx.restore();

    if (b.state === 'stunned') {
      for (let i = 0; i < 3; i++) {
        const a = s.time * 5 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = '#F2B84B';
        ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * 34, GROUND - 262 + Math.sin(a) * 8, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawFighter(ctx, f, ghost) {
    const { x, y, face } = f;
    const air = GROUND - y;
    const st = ghost ? 'dodge' : p.state;
    const t = ghost ? 0 : p.t;
    if (!ghost) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(x, GROUND + 5, Math.max(10, 26 - air * 0.08), 6, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.save();
    ctx.translate(x, y);
    if (st === 'down') { ctx.translate(0, -8); ctx.rotate(-face * Math.PI / 2); }
    ctx.scale(face, 1);
    if (st === 'dodge') ctx.rotate(0.35);
    const blink = !ghost && p.inv > 0 && st !== 'dodge' && Math.floor(s.time * 20) % 2 === 0;
    ctx.globalAlpha = ghost ? f.life * 1.6 : blink ? 0.45 : 1;
    const red = !ghost && p.flash > 0;
    const skin = red ? '#E0304F' : p.skin;
    const suit = red ? '#E0304F' : '#1A2E52';

    // legs
    const moving = st === 'run';
    const ph = p.run * 2.2;
    const legA = st === 'jump' ? 0.6 : moving ? Math.sin(ph) * 0.7 : st === 'attack' ? 0.35 : 0.12;
    const legB = st === 'jump' ? -0.2 : moving ? -Math.sin(ph) * 0.7 : st === 'attack' ? -0.3 : -0.12;
    ctx.strokeStyle = suit; ctx.lineWidth = 8; ctx.lineCap = 'round';
    for (const a of [legA, legB]) {
      ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(Math.sin(a) * 22, -40 + Math.cos(a) * 22);
      ctx.lineTo(Math.sin(a) * 22 + Math.sin(a * 0.3) * 18, -40 + Math.cos(a) * 22 + 18); ctx.stroke();
    }
    // cape flowing behind
    const wind = Math.sin(s.time * 6) * 4 + (moving ? 10 : 0) + (st === 'jump' ? 8 : 0);
    ctx.fillStyle = red ? '#E0304F' : f.color;
    ctx.beginPath(); ctx.moveTo(-2, -80); ctx.quadraticCurveTo(-26 - wind, -58, -30 - wind, -30 + Math.sin(s.time * 8) * 3);
    ctx.lineTo(-8, -40); ctx.closePath(); ctx.fill();
    // torso
    ctx.strokeStyle = suit; ctx.lineWidth = 16;
    ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(2, -78); ctx.stroke();
    ctx.strokeStyle = red ? '#E0304F' : f.color; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-5, -60); ctx.lineTo(8, -60); ctx.stroke();
    // head + visor
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(3, -93, 11, 0, Math.PI * 2); ctx.fill();
    // hair: long styles get a tail that sways as you move, then a spiky cap on top
    if (p.longHair) {
      ctx.fillStyle = red ? '#E0304F' : p.hair;
      const sway = Math.sin(s.time * 5) * 3 - (st === 'run' ? 6 : 0);
      ctx.beginPath(); ctx.moveTo(-8, -98); ctx.quadraticCurveTo(-16 + sway, -80, -12 + sway, -62); ctx.lineTo(-4, -70); ctx.quadraticCurveTo(-6, -84, 0, -96); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = red ? '#E0304F' : p.hair;
    ctx.beginPath(); ctx.moveTo(-9, -88); ctx.quadraticCurveTo(-11, -108, 4, -106); ctx.lineTo(8, -110); ctx.lineTo(10, -104); ctx.lineTo(15, -103); ctx.quadraticCurveTo(12, -97, 6, -99); ctx.quadraticCurveTo(-2, -99, -5, -90); ctx.closePath(); ctx.fill();
    ctx.fillStyle = red ? '#340A13' : f.color;
    ctx.fillRect(6, -96, 8, 3);

    // sword arm
    let a = -1.0;
    if (st === 'attack') {
      const k = Math.min(1, t / 0.14);
      const [from, to] = p.combo === 2 ? [1.0, -1.9] : [-2.3, 1.0];
      a = from + (to - from) * k;
    } else if (st === 'skill') a = -0.1;
    else if (st === 'run') a = -0.6 + Math.sin(ph) * 0.15;
    else if (st === 'jump') a = -1.6;
    else if (st === 'hurt') a = -2.4;
    const sx = 6, sy = -72;
    const hx = sx + Math.cos(a) * 20, hy = sy + Math.sin(a) * 20;
    ctx.strokeStyle = suit; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(hx, hy); ctx.stroke();
    if (st === 'attack' && t < 0.2 && !ghost) {
      const from = p.combo === 2 ? 1.0 : -2.3;
      ctx.strokeStyle = rgba(p.combo === 3 ? '#F2B84B' : f.color, 0.55); ctx.lineWidth = p.combo === 3 ? 14 : 9;
      ctx.beginPath(); ctx.arc(sx, sy, 62, Math.min(from, a), Math.max(from, a)); ctx.stroke();
    }
    ctx.strokeStyle = st === 'skill' ? '#BFE3FF' : '#B9D3E2'; ctx.lineWidth = 4;
    if (st === 'skill' && !ghost) { ctx.shadowColor = '#4FB8FF'; ctx.shadowBlur = 16; }
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * 54, hy + Math.sin(a) * 54); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  function drawHud(ctx) {
    ctx.font = '700 15px Rajdhani, sans-serif';
    ctx.textBaseline = 'alphabetic';
    // fighter
    ctx.fillStyle = 'rgba(14,26,48,0.88)';
    ctx.beginPath(); ctx.roundRect(16, 14, 264, 66, 12); ctx.fill();
    ctx.fillStyle = '#EDF4F9'; ctx.textAlign = 'left';
    ctx.fillText(`${p.name} · Lv ${p.level}`, 30, 36);
    bar(ctx, 30, 46, 236, 9, p.hp / p.maxHp, '#4FB8FF');
    bar(ctx, 30, 61, 236, 7, p.mp / 100, p.mp >= 30 ? '#4D8FE8' : '#043780');
    // boss
    ctx.fillStyle = 'rgba(14,26,48,0.88)';
    ctx.beginPath(); ctx.roundRect(W - 376, 14, 360, 56, 12); ctx.fill();
    ctx.fillStyle = b.enraged ? '#FF5C74' : '#EDF4F9'; ctx.textAlign = 'right';
    ctx.fillText(`${b.name}${b.enraged ? ' · ENRAGED' : ''}`, W - 30, 36);
    ctx.fillStyle = '#87A4B5'; ctx.textAlign = 'left'; ctx.font = '500 12px "JetBrains Mono", monospace';
    ctx.fillText(`${Math.ceil(b.hp)} / ${b.maxHp}`, W - 362, 36);
    bar(ctx, W - 362, 46, 332, 12, b.hp / b.maxHp, '#E0304F');
  }

  function draw(ctx) {
    ctx.save();
    if (s.shake) ctx.translate(rand(-s.shake, s.shake) * 0.6, rand(-s.shake, s.shake) * 0.6);
    drawStage(ctx);
    drawTelegraphs(ctx);
    for (const w of s.waves) {
      ctx.fillStyle = '#4C6C81'; ctx.strokeStyle = rgba(b.color, 0.9); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(w.x - 16, GROUND); ctx.lineTo(w.x - 4, GROUND - 30); ctx.lineTo(w.x + 4, GROUND - 18); ctx.lineTo(w.x + 14, GROUND - 34); ctx.lineTo(w.x + 20, GROUND); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    drawBoss(ctx);
    for (const g of s.ghosts) drawFighter(ctx, { ...g, color: p.color }, true);
    drawFighter(ctx, p, false);
    for (const r of s.rocks) {
      ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.spin);
      ctx.fillStyle = '#25435D'; ctx.strokeStyle = '#87A4B5'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-2, -13); ctx.lineTo(12, -6); ctx.lineTo(9, 10); ctx.lineTo(-8, 11); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    for (const sh of s.shots) {
      ctx.save(); ctx.translate(sh.x, sh.y); ctx.scale(Math.sign(sh.vx), 1);
      ctx.shadowColor = '#4FB8FF'; ctx.shadowBlur = 24; ctx.strokeStyle = '#BFE3FF'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(-20, 0, 42, -1.1, 1.1); ctx.stroke();
      ctx.restore();
    }
    for (const q of s.parts) {
      ctx.globalAlpha = Math.max(0, q.life / q.max);
      ctx.fillStyle = q.color; ctx.fillRect(q.x, q.y, q.size, q.size);
    }
    ctx.globalAlpha = 1;
    for (const t of s.texts) {
      ctx.globalAlpha = Math.min(1, t.life * 2);
      ctx.font = `800 ${t.big ? 30 : 22}px Rajdhani, sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#030812'; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    drawHud(ctx);
  }

  return {
    state: s,
    step,
    draw,
    press(key, down) { s.keys[key] = down; },
    clearKeys() { s.keys = {}; }
  };
}

// AI for spectating: reacts to telegraphs a little late (and sometimes not at all), so fights look human.
export function runnerAI(s) {
  const { p, b } = s;
  const i = {};
  if (s.over) return i;
  const dx = b.x - p.x, dist = Math.abs(dx), toward = dx > 0 ? 'right' : 'left', away = dx > 0 ? 'left' : 'right';
  if (!s.plan || s.plan.state !== b.state || s.plan.since > b.t) {
    s.plan = { state: b.state, since: b.t, delay: rand(0.08, 0.3), miss: Math.random() < 0.18, dodge: Math.random() < 0.5 };
  }
  const ready = b.t > s.plan.delay && !s.plan.miss;

  const wave = s.waves.find((w) => !w.hit && Math.sign(p.x - w.x) === w.dir && Math.abs(p.x - w.x) < 120);
  if (wave && ready) i.jump = true;

  const rock = s.rocks.find((r) => Math.abs(r.tx - p.x) < 45);
  if (rock && ready) { i[rock.tx > p.x ? 'left' : 'right'] = true; return i; }

  if (b.state === 'slam' && !b.hit && ready && dist < 210) {
    i[away] = true;
    if (dist < 110 && p.dodgeCd <= 0) i.dodge = true;
    return i;
  }
  if (b.state === 'charge' && ready && dist < 240 && Math.sign(p.x - b.x) === b.face) {
    if (s.plan.dodge && p.dodgeCd <= 0) { i[toward] = true; i.dodge = true; } else i.jump = true;
    return i;
  }
  if (p.mp >= 30 && dist < 500 && (b.state === 'stunned' || Math.random() < 0.02)) {
    if (p.face !== Math.sign(dx)) i[toward] = true; else i.skill = true;
    return i;
  }
  if (dist > 85) i[toward] = true;
  else if (p.face !== Math.sign(dx)) i[toward] = true;
  else i.attack = true;
  return i;
}
