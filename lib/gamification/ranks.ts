// Level rank ladder, themed exactly like overall strength: the six letter
// tiers E → S, each split into three steps (−, plain, +), in the same tier
// colors. One visual language for "your grade" across the app — strength is a
// percentile grade, level is an effort grade, both read "C+".
//
//   Tier  Levels   Steps (− / · / +)
//   E     1–9      1–3 / 4–6 / 7–9
//   D     10–19    10–12 / 13–15 / 16–19
//   C     20–34    20–24 / 25–29 / 30–34
//   B     35–49    35–39 / 40–44 / 45–49
//   A     50–69    50–56 / 57–62 / 63–69
//   S     70+      70–79 / 80–89 / 90+
//
// A "rank" is one rung (18 in all). Colors are per tier (TIER_COLORS) and blend
// toward the next tier across the tier, like the strength wash.

export type HexColor = string;
export type Gradient = [HexColor, HexColor]; // [light/start, deep/end]

export type TierId = 'E' | 'D' | 'C' | 'B' | 'A' | 'S';

export type Division = '-' | '' | '+';

// Crest silhouette; each tier keeps everything below it and adds a piece.
// 1 Bronze shield · 2 + side blades · 3 + crown point · 4 + layered plates ·
// 5 + gem inset · 6 faceted gem + small wings · 7 full wings + aura ring ·
// 8 flame wings · 9 grand crown + animated prismatic aura.
export type EmblemStage = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface EmblemSpec {
  stage: EmblemStage;
  blades: boolean;
  crown: 'none' | 'point' | 'grand';
  plates: boolean;
  gem: 'none' | 'inset' | 'faceted';
  wings: 'none' | 'small' | 'full' | 'flame';
  aura: 'none' | 'ring' | 'prismatic';
  pips: 0 | 1 | 2 | 3; // division chevrons on the crest: III = 1, II = 2, I = 3
  prismatic: boolean; // multi-hue animated aura (Challenger)
}

export interface Tier {
  id: TierId;
  name: string; // "Gold"
  index: number; // 0-based position in TIERS
  minLevel: number;
  hasDivisions: boolean;
  gradient: Gradient; // the tier's own two-stop metal
  shine: HexColor; // specular highlight laid over the light stop
}

export interface Rank {
  id: string; // "gold-2", "master"
  name: string; // "Gold II", "Master"
  tier: TierId;
  tierName: string; // "Gold"
  tierIndex: number; // 0-based position in TIERS
  division: Division | null; // null on master tiers
  index: number; // 0-based position in RANKS (the whole ladder)
  minLevel: number;
  emblem: EmblemSpec;
  gradient: Gradient; // blended palette at the rank's first level
  colorSoft: HexColor; // = gradient[0]: text/accent on dark surfaces
  color: HexColor; // = gradient[1]: text/accent on light surfaces
}

export const DIVISIONS: Division[] = ['-', '', '+'];
export const DIVISION_SPAN = 3; // legacy constant; steps now split each tier's span in thirds
export const TIER_SPAN = 10; // legacy constant; tiers carry explicit minLevels

// Prismatic accent stops for Challenger's aura.
export const PRISMATIC_STOPS: HexColor[] = ['#FFE27A', '#FF8BD1', '#9C8BFF', '#6FE3FF', '#FFE27A'];

type TierDef = { id: TierId; name: string; minLevel: number; gradient: Gradient; shine: HexColor };

// [light, deep]: the light stop reads on dark grounds, the deep stop is the
// tier's canonical color (TIER_COLORS in strengthStandards).
const TIER_DEFS: TierDef[] = [
  { id: 'E', name: 'E', minLevel: 1, gradient: ['#C9CDD3', '#808080'], shine: '#F1F2F4' },
  { id: 'D', name: 'D', minLevel: 10, gradient: ['#C9CDD3', '#808080'], shine: '#F1F2F4' },
  { id: 'C', name: 'C', minLevel: 20, gradient: ['#5FD394', '#2E8B57'], shine: '#DCFFE8' },
  { id: 'B', name: 'B', minLevel: 35, gradient: ['#7C9CFF', '#3558C0'], shine: '#E6ECFF' },
  { id: 'A', name: 'A', minLevel: 50, gradient: ['#D08BFF', '#9932CC'], shine: '#F4E7FF' },
  { id: 'S', name: 'S', minLevel: 70, gradient: ['#FFE45C', '#C9A227'], shine: '#FFF8D6' },
];

const clamp01 = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0').toUpperCase();

// Color ownership: strength tiers (E–S) own hue across the app; rank metals
// read as *material*, not as a second palette. Every metal stop keeps only
// METAL_KEEP of its chroma (mixed toward its own luma gray), so Gold/Emerald/
// Diamond/Master can never be mistaken for the S/C/B/A tier colors. The
// emblem's shape, chevrons and sheen carry the rank; tests pin the chroma gap.
export const METAL_KEEP = 0.4;

export function muteMetal(hex: HexColor, keep: number = METAL_KEEP): HexColor {
  const [r, g, b] = parseHex(hex);
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const k = clamp01(keep);
  return `#${toHex(y + (r - y) * k)}${toHex(y + (g - y) * k)}${toHex(y + (b - y) * k)}`;
}

export const TIERS: Tier[] = TIER_DEFS.map((d, index) => ({
  id: d.id,
  name: d.name,
  index,
  minLevel: d.minLevel,
  hasDivisions: true,
  gradient: d.gradient,
  shine: d.shine,
}));

const safeLevel = (level: number) => Math.max(1, Math.floor(level || 1));

// ---- Color blending ----


// Linear sRGB mix: t=0 → a, t=1 → b.
export function mixHex(a: HexColor, b: HexColor, t: number): HexColor {
  const k = clamp01(t);
  const [ar, ag, ab] = parseHex(a);
  const [br, bg, bb] = parseHex(b);
  return `#${toHex(ar + (br - ar) * k)}${toHex(ag + (bg - ag) * k)}${toHex(ab + (bb - ab) * k)}`;
}

// Levels a tier spans for blending: Bronze 9 (1–9), the rest 10.
function tierSpan(t: Tier): number {
  const next = TIERS[t.index + 1];
  return next ? next.minLevel - t.minLevel : 30;
}

function blendT(t: Tier, level: number, progressWithinLevel: number): number {
  if (!TIERS[t.index + 1]) return 0;
  return clamp01((safeLevel(level) - t.minLevel + clamp01(progressWithinLevel)) / tierSpan(t));
}

function blendedGradient(t: Tier, level: number, progressWithinLevel: number): Gradient {
  const next = TIERS[t.index + 1];
  if (!next) return [...t.gradient] as Gradient;
  const k = blendT(t, level, progressWithinLevel);
  return [mixHex(t.gradient[0], next.gradient[0], k), mixHex(t.gradient[1], next.gradient[1], k)];
}

function emblemFor(tierIndex: number, divisionIndex: number | null): EmblemSpec {
  const stage = (tierIndex + 1) as EmblemStage;
  return {
    stage,
    blades: stage >= 2,
    crown: stage >= 9 ? 'grand' : stage >= 3 ? 'point' : 'none',
    plates: stage >= 4,
    gem: stage >= 6 ? 'faceted' : stage === 5 ? 'inset' : 'none',
    wings: stage >= 8 ? 'flame' : stage === 7 ? 'full' : stage === 6 ? 'small' : 'none',
    aura: stage >= 9 ? 'prismatic' : stage >= 7 ? 'ring' : 'none',
    pips: divisionIndex === null ? 0 : ((divisionIndex + 1) as 1 | 2 | 3),
    prismatic: stage >= 9,
  };
}

export function tierForLevel(level: number): Tier {
  const lv = safeLevel(level);
  for (let i = TIERS.length - 1; i > 0; i--) if (lv >= TIERS[i].minLevel) return TIERS[i];
  return TIERS[0];
}

export const RANKS: Rank[] = TIERS.flatMap(t => {
  const rungs: { division: Division | null; divisionIndex: number | null; minLevel: number }[] = t.hasDivisions
    ? DIVISIONS.map((division, i) => ({
        division,
        divisionIndex: i,
        minLevel: t.minLevel + Math.round((i * tierSpan(t)) / 3), // E: 1, 4, 7 · C: 20, 25, 30
      }))
    : [{ division: null, divisionIndex: null, minLevel: t.minLevel }];
  return rungs.map(r => ({ tier: t, ...r }));
}).map(({ tier, division, divisionIndex, minLevel }, index) => {
  const gradient = blendedGradient(tier, minLevel, 0);
  return {
    id: `${tier.id}${division === '-' ? '-minus' : division === '+' ? '-plus' : ''}`,
    name: `${tier.name}${division ?? ''}`,
    tier: tier.id,
    tierName: tier.name,
    tierIndex: tier.index,
    division,
    index,
    minLevel,
    emblem: emblemFor(tier.index, divisionIndex),
    gradient,
    colorSoft: gradient[0],
    color: gradient[1],
  };
});

export function rankForLevel(level: number): Rank {
  const lv = safeLevel(level);
  for (let i = RANKS.length - 1; i > 0; i--) if (lv >= RANKS[i].minLevel) return RANKS[i];
  return RANKS[0];
}

// The next rung above `level` (next division, or next tier), or null at the top.
export function nextRank(level: number): Rank | null {
  return RANKS[rankForLevel(level).index + 1] ?? null;
}

// The next metal above `level`, or null at Challenger.
export function nextTier(level: number): Tier | null {
  return TIERS[tierForLevel(level).index + 1] ?? null;
}

// Steps inside the current tier for the pips: 3 divisions on divided tiers,
// 10 levels on master tiers (Challenger is open-ended; its pips cap at full).
export function rankStepCount(level: number): number {
  return DIVISIONS.length;
}

// 1-based position inside the tier: division ordinal (III = 1, II = 2, I = 3),
// or level within a master tier (1–10).
export function rankStep(level: number): number {
  return rankForLevel(level).emblem.pips;
}

// True when going from `before` to `after` reached a higher rung: a new
// division OR a new tier.
export function isRankUp(beforeLevel: number, afterLevel: number): boolean {
  return rankForLevel(afterLevel).index > rankForLevel(beforeLevel).index;
}

// True only when the metal itself changed (Silver → Gold), so the UI can make
// tier-ups louder than division promotions.
export function isTierUp(beforeLevel: number, afterLevel: number): boolean {
  return tierForLevel(afterLevel).index > tierForLevel(beforeLevel).index;
}

// How far through the current TIER `level` (+ fractional XP progress) is,
// 0 at the tier's first level → approaching 1 at the next tier. 0 at the top.
export function rankBlend(level: number, progressWithinLevel = 0): number {
  return blendT(tierForLevel(level), level, progressWithinLevel);
}

// The level's gradient: the current tier's metal slid toward the next tier's
// by progress through the tier. Challenger holds its own palette.
export function rankGradientForLevel(level: number, progressWithinLevel = 0): Gradient {
  return blendedGradient(tierForLevel(level), level, progressWithinLevel);
}

// The blended specular highlight for the metal at `level`.
export function rankShineForLevel(level: number, progressWithinLevel = 0): HexColor {
  const t = tierForLevel(level);
  const next = TIERS[t.index + 1];
  return next ? mixHex(t.shine, next.shine, blendT(t, level, progressWithinLevel)) : t.shine;
}

// One readable accent from the blended gradient: the light stop on dark
// surfaces, the deep stop on light ones.
export function rankAccentForLevel(level: number, dark: boolean, progressWithinLevel = 0): HexColor {
  const [soft, deep] = rankGradientForLevel(level, progressWithinLevel);
  return dark ? soft : deep;
}

// ---- Copy ----

// "an E+", "a C".
export function withArticle(name: string): string {
  return `${/^[aefhilmnorsx]/i.test(name) ? 'an' : 'a'} ${name}`;
}

// Banner line on a rank change: "Ranked up to C+".
export function rankUpLine(rank: Pick<Rank, 'name'>): string {
  return `Ranked up to ${rank.name}`;
}
