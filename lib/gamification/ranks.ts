// Competitive rank ladder for the account level, drawn anime-style by
// RankEmblem. Nine metal tiers from Bronze to Challenger; the six lower tiers
// split into three divisions (III → II → I, I being the top of the tier), the
// three master tiers don't. Pure data + math.
//
//   Tier         Levels  Divisions (III / II / I)
//   Bronze       1–9     1–3 / 4–6 / 7–9
//   Silver       10–19   10–12 / 13–15 / 16–19
//   Gold         20–29   20–22 / 23–25 / 26–29
//   Platinum     30–39   30–32 / 33–35 / 36–39
//   Emerald      40–49   40–42 / 43–45 / 46–49
//   Diamond      50–59   50–52 / 53–55 / 56–59
//   Master       60–69   —
//   Grandmaster  70–79   —
//   Challenger   80+     —
//
// Division rule: divisions start at the tier's first level, +3 and +6. Bronze
// (9 levels) splits 3/3/3; the 10-level tiers split 3/3/4, so Division I, the
// gate to the next metal, is the longest climb.
//
// A "rank" is one rung of the ladder: a division, or a whole master tier (21
// rungs in all). Colors are per TIER and BLEND across the whole tier toward the
// next tier's palette, so Gold I already leans into Platinum.

export type HexColor = string;
export type Gradient = [HexColor, HexColor]; // [light/start, deep/end]

export type TierId =
  | 'bronze'
  | 'silver'
  | 'gold'
  | 'platinum'
  | 'emerald'
  | 'diamond'
  | 'master'
  | 'grandmaster'
  | 'challenger';

export type Division = 'III' | 'II' | 'I';

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

export const DIVISIONS: Division[] = ['III', 'II', 'I'];
export const DIVISION_SPAN = 3; // divisions start at tier min, +3, +6
export const TIER_SPAN = 10;

// Prismatic accent stops for Challenger's aura.
export const PRISMATIC_STOPS: HexColor[] = ['#FFE27A', '#FF8BD1', '#9C8BFF', '#6FE3FF', '#FFE27A'];

type TierDef = { id: TierId; name: string; gradient: Gradient; shine: HexColor };

// Light stops are bright enough to read as text on dark surfaces, deep stops
// dark enough to read on light ones; `shine` is the metal's highlight.
const TIER_DEFS: TierDef[] = [
  { id: 'bronze', name: 'Bronze', gradient: ['#F0B48A', '#94562C'], shine: '#FFE2CB' },
  { id: 'silver', name: 'Silver', gradient: ['#DCE4EC', '#66788C'], shine: '#FFFFFF' },
  { id: 'gold', name: 'Gold', gradient: ['#FFD96A', '#A97508'], shine: '#FFF5C8' },
  { id: 'platinum', name: 'Platinum', gradient: ['#A2EEE2', '#1C8580'], shine: '#E9FFFB' },
  { id: 'emerald', name: 'Emerald', gradient: ['#7FE8A4', '#14854A'], shine: '#DCFFE8' },
  { id: 'diamond', name: 'Diamond', gradient: ['#BCD3FF', '#5560DA'], shine: '#F1F6FF' },
  { id: 'master', name: 'Master', gradient: ['#D7AAFF', '#8336C9'], shine: '#F4E7FF' },
  { id: 'grandmaster', name: 'Grandmaster', gradient: ['#FF8F9C', '#BC1F3D'], shine: '#FFE1E5' },
  { id: 'challenger', name: 'Challenger', gradient: ['#FFE58C', '#C2860C'], shine: '#FFFBE8' },
];

export const TIERS: Tier[] = TIER_DEFS.map((d, index) => ({
  id: d.id,
  name: d.name,
  index,
  minLevel: index === 0 ? 1 : index * TIER_SPAN,
  hasDivisions: index < 6,
  gradient: d.gradient,
  shine: d.shine,
}));

const safeLevel = (level: number) => Math.max(1, Math.floor(level || 1));

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

// Levels a tier spans for blending: Bronze 9 (1–9), the rest 10.
function tierSpan(t: Tier): number {
  return t.index === 0 ? TIER_SPAN - 1 : TIER_SPAN;
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
  const idx = Math.min(TIERS.length - 1, Math.floor(safeLevel(level) / TIER_SPAN));
  return TIERS[idx];
}

export const RANKS: Rank[] = TIERS.flatMap(t => {
  const rungs: { division: Division | null; divisionIndex: number | null; minLevel: number }[] = t.hasDivisions
    ? DIVISIONS.map((division, i) => ({
        division,
        divisionIndex: i,
        minLevel: t.minLevel + i * DIVISION_SPAN, // Bronze: 1, 4, 7 · Silver: 10, 13, 16
      }))
    : [{ division: null, divisionIndex: null, minLevel: t.minLevel }];
  return rungs.map(r => ({ tier: t, ...r }));
}).map(({ tier, division, divisionIndex, minLevel }, index) => {
  const gradient = blendedGradient(tier, minLevel, 0);
  return {
    id: division ? `${tier.id}-${DIVISIONS.length - divisionIndex!}` : tier.id,
    name: division ? `${tier.name} ${division}` : tier.name,
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
  return tierForLevel(level).hasDivisions ? DIVISIONS.length : TIER_SPAN;
}

// 1-based position inside the tier: division ordinal (III = 1, II = 2, I = 3),
// or level within a master tier (1–10).
export function rankStep(level: number): number {
  const t = tierForLevel(level);
  if (t.hasDivisions) return rankForLevel(level).emblem.pips;
  return Math.min(TIER_SPAN, safeLevel(level) - t.minLevel + 1);
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

// "an Emerald II", "a Gold III".
export function withArticle(name: string): string {
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

// Banner line on a rank change: "Promoted to Gold II".
export function rankUpLine(rank: Pick<Rank, 'name'>): string {
  return `Promoted to ${rank.name}`;
}
