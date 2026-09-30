// The player's mini self as pixel art. `look` = their customisation (body, skin, hair, eyes, outfit),
// `stage` = evolution (0–5, one per rank). crop="bust" frames head and shoulders; the default shows the full body.
// Renders an <svg> (so it also works nested inside other SVGs, e.g. the Rift) holding the pixel sprite.
import { useMemo } from 'react';
import { DEFAULT_LOOK } from '../api/look.js';
import { H, W, spriteURL } from './pixel/sprite.js';

export default function MiniSelf({ look = DEFAULT_LOOK, stage = 0, size = 160, locked = false, crop, x, y, title }) {
  const { body, skin, hairStyle, hair, eyes, outfit } = look;
  const url = useMemo(() => spriteURL({ body, skin, hairStyle, hair, eyes, outfit }, stage), [body, skin, hairStyle, hair, eyes, outfit, stage]);
  const [vx, vy, vw, vh] = crop === 'bust' ? [5, 3, 38, 38] : [0, 0, W, H];
  return (
    <svg x={x} y={y} width={size} height={size * (vh / vw)} viewBox={`${vx} ${vy} ${vw} ${vh}`}
      role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      style={locked ? { filter: 'brightness(0) opacity(.55)' } : undefined}>
      {url && <image href={url} width={W} height={H} preserveAspectRatio="none" style={{ imageRendering: 'pixelated' }} />}
    </svg>
  );
}
