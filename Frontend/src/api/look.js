// The player's "mini self": what they customise, and how it evolves with rank.

export const SKIN_TONES = ['#FBE3D0', '#F1C9A5', '#D9A177', '#B57A52', '#8A5534', '#5E3A22'];
export const HAIR_COLORS = ['#15161C', '#3B2A20', '#7A4B2A', '#C8A165', '#D9DDE3', '#7D0018', '#043780', '#0ECCED'];
export const EYE_COLORS = ['#B8561E', '#3B2A20', '#25435D', '#4D8FE8', '#0ECCED', '#5A8F6B', '#E0304F'];
export const BODIES = [{ id: 'boy', label: 'Boy' }, { id: 'girl', label: 'Girl' }];
export const HAIR_STYLES = [
  { id: 'messy', label: 'Messy' }, { id: 'short', label: 'Short' }, { id: 'bob', label: 'Bob' }, { id: 'long', label: 'Long' },
  { id: 'ponytail', label: 'Ponytail' }, { id: 'twintails', label: 'Twin tails' }, { id: 'curly', label: 'Curly' }, { id: 'buzz', label: 'Buzz' }
];
// The last three outfit colours unlock with the Essence of style potion.
export const OUTFIT_COLORS = [
  { c: '#025EC4' }, { c: '#25435D' }, { c: '#7D0018' },
  { c: '#0ECCED', premium: true }, { c: '#F2B84B', premium: true }, { c: '#EDF4F9', premium: true }
];

export const DEFAULT_LOOK = { body: 'boy', skin: '#F1C9A5', hairStyle: 'messy', hair: '#3B2A20', eyes: '#B8561E', outfit: '#025EC4' };
// Switching body picks a fitting default hairstyle; everything stays editable.
export const BODY_HAIR = { boy: 'messy', girl: 'long' };
export const lookOf = (p) => ({ ...DEFAULT_LOOK, ...(p.look || {}) });

// One evolution per rank, unlocked at the same levels as the ranks.
export const STAGES = [
  { lv: 1, rank: 'E', title: 'The Awakened', outfit: 'Hoodie & backpack' },
  { lv: 5, rank: 'D', title: 'The Striver', outfit: 'Training hoodie' },
  { lv: 10, rank: 'C', title: 'The Trained', outfit: 'Athletic tee' },
  { lv: 20, rank: 'B', title: 'The Hunter', outfit: 'Field jacket & dagger' },
  { lv: 35, rank: 'A', title: 'The Vanguard', outfit: 'Rune coat' },
  { lv: 50, rank: 'S', title: 'The Monarch', outfit: 'Fur-collared coat' }
];
export const stageOf = (level) => STAGES.filter((s) => level >= s.lv).length - 1;
