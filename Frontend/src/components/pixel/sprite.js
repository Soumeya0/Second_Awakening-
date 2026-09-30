// Pixel-art mini self: a 48×48 head-and-shoulders portrait (big eyes, lashes, blush, soft lips, strand-shaded hair),
// painted from the player's look + evolution stage. The outfit changes with each rank; A/S rank adds glowing eyes and an aura.
// Returns a PNG data URL (cached per look).
export const W = 48;
export const H = 48;

// Mix a hex colour toward black (k < 0) or white (k > 0).
export function mix(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const t = k < 0 ? 0 : 255, a = Math.abs(k);
  const ch = (v) => Math.round(v + (t - v) * a).toString(16).padStart(2, '0');
  return `#${ch(n >> 16)}${ch((n >> 8) & 255)}${ch(n & 255)}`;
}
const blend = (a, b, k) => { // a → b by k
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
};

// 3-tone ramp with hue shifting: highlights lean toward warm light, shadows lean warm (skin, hair) or cool (cloth).
export const INK = '#141011';
export function ramp(base, warm = true) {
  return {
    hi: blend(base, warm ? '#FFF1C8' : '#E6F2FF', 0.3),
    base,
    lo: blend(mix(base, -0.28), warm ? '#7A2A22' : '#1B2A5A', 0.24)
  };
}

// ---------------- hairstyles ----------------
// fringe(x): first row below the bangs in each column; side: last row the side locks reach (ears show below it).
const d = (x) => Math.abs(x - 23.5) - 0.5; // columns from the centre line: 0 … 11
const STYLES = {
  messy: { fringe: (x) => 16 + [2, 0, 3, 1][x % 4] - (d(x) < 2 ? 1 : 0), side: 22, back: 'nape',
    extra: [[19, 7], [20, 7], [20, 6], [21, 5], [26, 7], [27, 7], [27, 6], [28, 6], [29, 5], [11, 17], [10, 17], [9, 16], [36, 15], [37, 15], [38, 14]] },
  short: { fringe: (x) => (d(x) < 1 ? 11 : Math.floor(13 + Math.min(d(x), 7) * 0.6)), side: 21, back: 'nape', part: true },
  bob: { fringe: (x) => (x % 3 === 0 ? 18 : 17), side: 33, back: 'bob' },
  long: { fringe: (x) => Math.floor(12 + d(x) * 0.75), side: 31, back: 'long', part: true, drape: true },
  ponytail: { fringe: (x) => (d(x) < 1 ? 12 : Math.floor(14 + d(x) * 0.4)), side: 21, back: 'ponytail', part: true },
  twintails: { fringe: (x) => (x % 4 === 1 ? 17 : 16), side: 23, back: 'twintails' },
  curly: { fringe: (x) => 14 + ((x * 7) % 3), side: 24, back: 'afro', curls: true },
  buzz: { fringe: () => 12, side: 19, buzz: true }
};
const inCap = (x, y, grow = 0) => ((x - 23.5) / (11.5 + grow)) ** 2 + ((y - 19) / (12 + grow)) ** 2 <= 1;

// ---------------- painter ----------------
export function paint(look, stage) {
  const g = Array.from({ length: H }, () => Array(W).fill(null));
  const p = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) g[y][x] = c; };
  const span = (y, x0, x1, c) => { for (let x = x0; x <= x1; x++) p(x, y, c); };
  const sym = (x, y, c) => { p(x, y, c); p(47 - x, y, c); }; // paint a left-half pixel and its mirror
  const symSpan = (y, x0, x1, c) => { span(y, x0, x1, c); span(y, 47 - x1, 47 - x0, c); };

  const girl = look.body === 'girl';
  const S = ramp(look.skin), Hr = ramp(look.hair), C = ramp(look.outfit, false);
  const glow = stage >= 4;
  const E = glow ? ramp('#4FB8FF', false) : ramp(look.eyes);
  const st = STYLES[look.hairStyle] || STYLES.messy;
  const hairAt = (x, y, base) => { // curl texture for curly hair; plain colour otherwise
    if (!st.curls) return base;
    const cx = x % 3, cy = (y + (Math.floor(x / 3) % 2) * 2) % 3; // 3×3 cells, alternate columns offset: little curls
    if ((cx === 1 && cy === 0) || (cx === 0 && cy === 1)) return blend(base, Hr.hi, 0.55); // lit arc of each curl
    if ((cx === 2 && cy === 1) || (cx === 1 && cy === 2)) return mix(Hr.lo, -0.25); // its shadow
    return base;
  };

  // 1) hair behind the head
  const back = (y, x0, x1) => { for (let x = x0; x <= x1; x++) p(x, y, hairAt(x, y, Hr.lo)); };
  if (st.back === 'nape') for (let y = 7; y <= st.side + 1; y++) for (let x = 10; x <= 37; x++) if (inCap(x, y, 1)) p(x, y, Hr.lo);
  if (st.back === 'bob' || st.back === 'long') {
    const end = st.back === 'bob' ? 33 : 46;
    for (let y = 7; y <= end; y++) for (let x = 10; x <= 37; x++) {
      const tip = y >= end - 1 && (x + y) % 3 === 0; // ragged ends
      if ((y < 19 ? inCap(x, y, 1) : true) && !tip) p(x, y, Hr.lo);
    }
  }
  if (st.back === 'ponytail') {
    for (let y = 12; y <= 40; y++) { const x0 = 34 + Math.round(1.6 * Math.sin(y / 4)); back(y, x0, x0 + (y > 36 ? 2 : 4)); }
  }
  if (st.back === 'twintails') {
    for (let y = 16; y <= 43; y++) { const w = y < 19 ? 4 : y > 39 ? 3 : 6; back(y, 11 - w, 11); back(y, 36, 36 + w); }
  }
  if (st.back === 'afro') {
    for (let y = 2; y <= 32; y++) for (let x = 6; x <= 41; x++) {
      const bump = ((x * 5 + y * 3) % 4) * 0.02;
      if (((x - 23.5) / 16.5) ** 2 + ((y - 16) / 14) ** 2 <= 1 - bump) p(x, y, hairAt(x, y, Hr.lo));
    }
  }

  // 2) shoulders + outfit base
  const coat = stage === 4 ? '#0E1A30' : stage === 5 ? mix(look.outfit, -0.55) : look.outfit;
  const B = ramp(coat, false);
  const HW = girl ? { 38: 8, 39: 11, 40: 14, 41: 16 } : { 38: 8, 39: 12, 40: 15, 41: 17, 42: 18 };
  const max = girl ? 17 : 19;
  for (let y = 38; y < H; y++) {
    const hw = HW[y] ?? max;
    span(y, 24 - hw, 23 + hw, coat);
    p(24 - hw, y, B.hi); p(23 + hw, y, B.lo); p(22 + hw, y, B.lo);
  }
  for (let y = 43; y < H; y++) sym(24 - max + 4, y, B.lo); // where the arms meet the body

  // 3) neck (with the chin's shadow)
  const n0 = girl ? 21 : 20;
  for (let y = 31; y <= 40; y++) span(y, n0, 47 - n0, y <= 36 ? S.lo : S.base);
  for (let y = 37; y <= 40; y++) p(47 - n0, y, S.lo);

  // 4) outfit details, from rank E to rank S
  if (stage <= 1) { // hoodie
    symSpan(38, 16, 19, B.lo); symSpan(39, 15, 19, B.lo); symSpan(40, 17, 19, B.lo); // hood around the neck
    span(40, n0, 47 - n0, B.lo); span(41, n0 - 1, 48 - n0, INK); // neckline
    for (let y = 42; y <= 45; y++) sym(21, y, '#EEF3F8'); // drawstrings
    if (stage === 0) for (let y = 40; y < H; y++) { const x = 12 + Math.floor((y - 40) / 3); sym(x, y, '#2E5A48'); sym(x + 1, y, '#3E7560'); } // backpack straps
    else for (let y = 42; y < H; y++) p(23, y, '#D0DCE8'); // zipper
  } else if (stage === 2) { // tee with a ribbed crew neck
    span(41, n0 - 1, 48 - n0, B.lo); span(42, n0, 47 - n0, B.lo);
    symSpan(44, 21, 22, B.hi); sym(22, 45, B.hi); sym(23, 45, B.hi); sym(23, 46, B.hi); // little heart on the chest
  } else if (stage === 3) { // open jacket over a black top
    for (let y = 40; y < H; y++) span(y, 18, 29, '#17161C');
    span(40, n0, 47 - n0, '#222129');
    for (let k = 0; k < 8; k++) sym(17 + Math.floor(k / 2), 40 + k, C.hi); // lapels
  } else { // coats with a high collar
    for (let y = 36; y <= 40; y++) { symSpan(y, 17, 19 + (y - 36), coat); p(17, y, B.hi); p(30, y, B.lo); }
    for (let y = 40; y < H; y++) span(y, 23, 24, '#070D18'); // closure
    if (stage === 4) { // glowing rune trims
      for (let y = 36; y <= 40; y++) sym(19 + (y - 36), y, look.outfit);
      for (let y = 41; y < H; y++) sym(22, y, look.outfit);
      [[11, 43], [12, 44], [11, 45], [36, 43], [35, 44], [36, 45]].forEach(([x, y]) => p(x, y, look.outfit));
    } else { // fur collar
      const fur = '#E4ECF2', furLo = '#A9BBC9';
      for (let y = 37; y <= 41; y++) symSpan(y, 12 + (41 - y), 21, fur);
      [[14, 40], [17, 38], [20, 41], [15, 41], [19, 39]].forEach(([x, y]) => sym(x, y, furLo));
    }
  }

  // 5) long hair drapes over the shoulders
  if (st.drape) for (let y = 26; y <= 47; y++) {
    if (y >= 46 && y % 2 === 0) continue; // ragged tips
    const w = y > 44 ? 4 : 6;
    span(y, 10, 10 + w, Hr.base); span(y, 37 - w, 37, Hr.base); p(10 + w, y, Hr.lo); p(37, y, Hr.lo);
    p(12, y, Hr.lo); p(35, y, Hr.lo); // strands
  }

  // 6) ears + face
  for (let y = 22; y <= 27; y++) { sym(14, y, S.base); if (y > 22 && y < 27) sym(13, y, S.base); }
  sym(14, 24, S.lo); sym(14, 25, S.lo); p(33, 23, S.lo); p(34, 24, S.lo);
  const JAW = girl ? { 30: 16, 31: 17, 32: 18, 33: 20, 34: 22 } : { 30: 15, 31: 16, 32: 17, 33: 19, 34: 21 };
  for (let y = 12; y <= 34; y++) {
    const x0 = y === 12 ? 18 : y === 13 ? 16 : JAW[y] ?? 15;
    symSpan(y, x0, 23, S.base);
    if (y >= 14) p(47 - x0, y, S.lo); // shaded right cheek
  }
  p(17, 15, S.hi); p(18, 14, S.hi); // forehead light

  // 7) features (mirrored left → right)
  const brow = stage >= 3 && !girl ? Hr.lo : blend(Hr.lo, look.skin, 0.35);
  symSpan(19, girl ? 18 : 17, 21, brow); if (girl) sym(17, 20, brow); if (stage >= 3 && !girl) sym(21, 20, brow);
  const sclera = '#E9E4EE';
  symSpan(22, 17, 21, INK); if (girl) { sym(16, 22, INK); sym(15, 21, INK); } // thick upper lashes (winged for girls)
  sym(17, 23, INK); sym(18, 23, '#FFFFFF'); sym(19, 23, INK); sym(20, 23, E.lo); sym(21, 23, INK);
  sym(17, 24, sclera); sym(18, 24, E.lo); sym(19, 24, INK); sym(20, 24, E.base); sym(21, 24, sclera);
  sym(17, 25, sclera); sym(18, 25, E.base); sym(19, 25, E.hi); sym(20, 25, E.hi); sym(21, 25, sclera);
  symSpan(26, 18, 20, S.lo); // lower lid
  const pink = blend(look.skin, '#FF6F7F', 0.35);
  symSpan(27, 16, 18, pink); symSpan(28, 17, 18, pink);
  p(23, 27, S.hi); p(23, 28, S.lo); p(24, 28, S.lo); // nose
  if (girl) {
    const lip = blend(look.skin, '#C24D5E', 0.5);
    span(30, 22, 25, lip); span(31, 22, 25, blend(look.skin, '#8E2F3C', 0.55)); p(23, 30, blend(lip, '#FFFFFF', 0.35));
  } else {
    span(31, 22, 25, blend(look.skin, '#7A3A30', 0.45)); p(21, 30, S.lo); p(26, 30, S.lo); // small smile
  }
  if (stage === 0) { span(28, 29, 31, '#F3E3C8'); p(30, 27, '#F3E3C8'); p(31, 28, '#D8C2A0'); } // plaster on the cheek

  // 8) hair in front: the cap down to the fringe, side locks down to st.side
  for (let y = 5; y <= 33; y++) for (let x = 10; x <= 37; x++) {
    const sideCol = x <= 15 || x >= 32;
    if (!inCap(x, y) || !(y < st.fringe(x) || (sideCol && y <= st.side))) continue;
    let c = st.buzz ? (y < 9 ? Hr.base : Hr.lo) : Hr.base;
    if (!st.buzz) {
      if (x >= 31) c = Hr.lo; // shaded side
      if (y === st.fringe(x) - 1 && x % 3 === 0) c = Hr.lo; // strand tips
      if (st.part && d(x) < 1) c = Hr.lo; // centre part
      const r = ((x - 23.5) / 11.5) ** 2 + ((y - 19) / 12) ** 2;
      if (!st.curls && r > 0.55 && r < 0.72 && y < 13 && x < 25) c = Hr.hi; // shine arc
    }
    p(x, y, hairAt(x, y, c));
  }
  (st.extra || []).forEach(([x, y]) => p(x, y, x > 30 ? Hr.lo : Hr.base));
  if (st.back === 'ponytail') { p(33, 13, C.base); p(33, 14, C.lo); } // hair tie
  if (st.back === 'twintails') { sym(11, 16, C.base); sym(11, 17, C.lo); }

  // 9) outline the silhouette
  const solid = g.map((row) => row.map(Boolean));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!solid[y][x] && [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([a, b]) => solid[b]?.[a])) g[y][x] = INK;
  }

  // 10) aura at A/S rank: two soft pixel rings; lightning at S
  if (stage >= 4) {
    const a = stage === 5 ? '165,107,255' : '79,184,255';
    for (const alpha of [0.5, 0.22]) {
      const snap = g.map((row) => row.slice());
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (!snap[y][x] && [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([a2, b]) => snap[b]?.[a2])) g[y][x] = `rgba(${a},${alpha})`;
      }
    }
    if (stage === 5) [[2, 14], [3, 15], [2, 16], [3, 17], [45, 12], [44, 13], [45, 14], [44, 15]].forEach(([x, y]) => { g[y][x] = '#BFE3FF'; });
  }
  return g;
}

const cache = new Map();
export function spriteURL(look, stage) {
  const key = `${look.body}|${look.skin}|${look.hairStyle}|${look.hair}|${look.eyes}|${look.outfit}|${stage}`;
  if (cache.has(key)) return cache.get(key);
  if (typeof document === 'undefined') return null;
  const g = paint(look, stage);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (g[y][x]) { ctx.fillStyle = g[y][x]; ctx.fillRect(x, y, 1, 1); }
  const url = cv.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
