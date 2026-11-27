// Anime-style rank ladder for the account level. One rank every 5 levels
// (Novice covers 1–4), twelve in all, with original names and crests that
// escalate in drama (badge → starburst → wings → flame aura). RankEmblem
// renders the spec. Pure data + math.
//
// Colors are gradients that BLEND: within a rank the gradient slides toward the
// next rank's, so Lv 24 already leans into the Lv 25 palette.

export type HexColor = string;
export type Gradient = [HexColor, HexColor]; // [light/start, saturated/end]

// Drama stage: 1 crest, 2 + starburst & speed lines, 3 + wings & aura ring,
// 4 + flame aura & animated glow.
export type EmblemStage = 1 | 2 | 3 | 4;

export interface EmblemSpec {
  stage: EmblemStage;
  sparkles: 1 | 2 | 3; // marks on the crest; tells ranks within a stage apart
  prismatic: boolean; // multi-hue aura accents (top two ranks)
}

export interface Rank {
  id: string;
  name: string;
  index: number; // 0-based position in RANKS
  minLevel: number;
  emblem: EmblemSpec;
  gradient: Gradient; // the rank's own palette at its first level
  colorSoft: HexColor; // = gradient[0]: text/accent on dark surfaces
  color: HexColor; // = gradient[1]: text/accent on light surfaces
}

export const RANK_SPAN = 5;

// Prismatic accent stops for the aura on the top two ranks.
export const PRISMATIC_STOPS: HexColor[] = ['#FFE27A', '#FF8BD1', '#9C8BFF', '#6FE3FF', '#FFE27A'];

type RankDef = { id: string; name: string; gradient: Gradient };

// The journey: silver → teal → green → blue → indigo → purple → magenta →
// crimson → orange → gold → prismatic. Start stops are light enough to read on
// dark surfaces, end stops saturated enough to read on light ones.
const DEFS: RankDef[] = [
  { id: 'novice', name: 'Novice', gradient: ['#D3DCE5', '#7D8E9F'] },
  { id: 'initiate', name: 'Initiate', gradient: ['#7EEBDD', '#16928E'] },
  { id: 'adept', name: 'Adept', gradient: ['#8BE8A6', '#23894F'] },
  { id: 'vanguard', name: 'Vanguard', gradient: ['#8CBBFF', '#2B62D6'] },
  { id: 'elite', name: 'Elite', gradient: ['#A7A6FF', '#4A3ECF'] },
  { id: 'ace', name: 'Ace', gradient: ['#D7A4FF', '#8039C6'] },
  { id: 'champion', name: 'Champion', gradient: ['#FF98DD', '#BE2A96'] },
  { id: 'hero', name: 'Hero', gradient: ['#FF8A96', '#C21E3C'] },
  { id: 'paragon', name: 'Paragon', gradient: ['#FFC07A', '#DB5E14'] },
  { id: 'mythic', name: 'Mythic', gradient: ['#FFE584', '#C99512'] },
  { id: 'ascendant', name: 'Ascendant', gradient: ['#FFF0B0', '#D16AE8'] },
  { id: 'transcendent', name: 'Transcendent', gradient: ['#B4F7FF', '#E85FC8'] },
];

export const RANKS: Rank[] = DEFS.map((d, index) => ({
  id: d.id,
  name: d.name,
  index,
  minLevel: index === 0 ? 1 : index * RANK_SPAN,
  emblem: {
    stage: (Math.floor(index / 3) + 1) as EmblemStage,
    sparkles: ((index % 3) + 1) as 1 | 2 | 3,
    prismatic: index >= 10,
  },
  gradient: d.gradient,
  colorSoft: d.gradient[0],
  color: d.gradient[1],
}));

const safeLevel = (level: number) => Math.max(1, Math.floor(level || 1));

export function rankForLevel(level: number): Rank {
  const idx = Math.min(RANKS.length - 1, Math.floor(safeLevel(level) / RANK_SPAN));
  return RANKS[idx];
}

// The next rank above `level`, or null at the top.
export function nextRank(level: number): Rank | null {
  return RANKS[rankForLevel(level).index + 1] ?? null;
}

// Levels a rank spans for the pips: Novice 4 (1–4), every other rank 5. The
// top rank is open-ended; its pips cap at full.
export function rankStepCount(level: number): number {
  return rankForLevel(level).index === 0 ? RANK_SPAN - 1 : RANK_SPAN;
}

// 1-based position inside the current rank (1–5; 1–4 for Novice).
export function rankStep(level: number): number {
  const r = rankForLevel(level);
  return Math.min(rankStepCount(level), safeLevel(level) - r.minLevel + 1);
}

// True when going from `before` to `after` crossed into a new rank.
export function isRankUp(beforeLevel: number, afterLevel: number): boolean {
  return rankForLevel(afterLevel).index > rankForLevel(beforeLevel).index;
}

// ---- Color blending ----

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0').toUpperCase();

// Linear sRGB mix: t=0 → a, t=1 → b.
export function mixHex(a: HexColor, b: HexColor, t: number): HexColor {
  const k = clamp01(t);
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return `#${toHex(ar + (br - ar) * k)}${toHex(ag + (bg - ag) * k)}${toHex(ab + (bb - ab) * k)}`;
}

// How far through the current rank `level` (+ fractional XP progress) is,
// 0 at the rank's first level → approaching 1 at the next rank. 0 at the top.
export function rankBlend(level: number, progressWithinLevel = 0): number {
  const lv = safeLevel(level);
  const r = rankForLevel(lv);
  if (!nextRank(lv)) return 0;
  const span = rankStepCount(lv);
  return clamp01((lv - r.minLevel + clamp01(progressWithinLevel)) / span);
}

// The level's gradient: the current rank's palette slid toward the next one's
// by progress through the rank. Top rank holds its own palette.
export function rankGradientForLevel(level: number, progressWithinLevel = 0): Gradient {
  const r = rankForLevel(level);
  const next = nextRank(level);
  if (!next) return [...r.gradient] as Gradient;
  const t = rankBlend(level, progressWithinLevel);
  return [mixHex(r.gradient[0], next.gradient[0], t), mixHex(r.gradient[1], next.gradient[1], t)];
}

// One readable accent from the blended gradient: the light stop on dark
// surfaces, the saturated stop on light ones.
export function rankAccentForLevel(level: number, dark: boolean, progressWithinLevel = 0): HexColor {
  const [soft, deep] = rankGradientForLevel(level, progressWithinLevel);
  return dark ? soft : deep;
}

// ---- Copy ----

// "an Ace", "a Hero".
export function withArticle(name: string): string {
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

// Banner line on a rank change: "Rank up! Now an Ace".
export function rankUpLine(rank: Pick<Rank, 'name'>): string {
  return `Rank up! Now ${withArticle(rank.name)}`;
}
