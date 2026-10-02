// The five intro chapters. `inside`: the picture stays within the card frame instead of rising out of its top.
// Shared by the Story page and scripts/voice.mjs (which turns `title` + `body` into narration).
export const SCENES = [
{ img: 'scene-1', label: 'THE PLAN', alt: 'Jinwoo, calm and confident in a grey jacket', title: 'You were built different.', body: 'Up before the sun. First on every list. No excuses, no days off  just the grind, on repeat.', system: '[STATUS] Discipline: high · Energy: high · Streak: unbroken', color: 'var(--blue)' },
{ img: 'scene-2', inside: true, label: 'COMFORT', alt: 'Jinwoo in a worn hoodie, looking drained', title: 'Then the grind stopped.', body: 'The alarm became a suggestion. The gym bag became furniture. Tomorrow became the whole plan.', system: '[WARNING] Discipline falling. Quests ignored: too many to count.', color: 'var(--muted)' },
{ img: 'scene-3', inside: true, label: 'VILLAIN ARC', alt: 'Jinwoo with glowing eyes, in the middle of a fight', title: 'Everyone has a villain arc.', body: 'Yours didn\'t wear a mask. It looked like snoozed alarms and nights that blurred into nothing.', system: '[ALERT] Villain arc detected. Main character status: suspended.', color: 'var(--red)' },
{ img: 'scene-4', inside: true, label: 'RANK E', alt: 'Jinwoo at Rank E, bandaged and carrying a backpack', title: 'Every legend starts at zero.', body: 'Rank E. Weak. Overlooked. Underestimated. That\'s not your ceiling  that\'s your origin story.', system: '[NOTICE] Dormant potential found. It has been waiting for you.', color: 'var(--sapphire-light)' },
{ img: 'scene-5', label: 'AWAKENING', alt: 'Jinwoo at Rank E in his blue hoodie, his future self standing behind him as a shadow with glowing eyes', title: 'This is your Awakening.', body: 'The System has chosen you. Every rep counts. Every quest matters. Let\u2019s see what you\u2019re really made of.', system: '[SYSTEM] You have been selected as a Player. Accept?', color: 'var(--gold)' },
  ];

// What the narrator says for a chapter.
export const narration = (s) => `${s.title} ${s.body}`;
