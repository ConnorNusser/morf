// Tier-driven visuals for the holo rank card and every XP surface.
// Each tier letter gets (a) a foil treatment that escalates with rarity and
// (b) an XP accent that complements its hue, so the level bar always contrasts
// with the card it sits on and the whole hero shifts color as you rank up.
import { getStrengthTier, StrengthTierBase, TIER_COLORS } from '@/lib/data/strengthStandards';

export type SheenMode = 'none' | 'once' | 'loop';

export interface TierFoil {
  base: StrengthTierBase | null; // null = unranked
  color: string; // tier hue (card edge + glow)
  light: string; // lightened tier hue for the big letter
  foil: [string, string]; // card gradient: tier-tinted top-left → near-black
  sheen: SheenMode; // light sweep across the card
  sheenMs: number; // sweep duration (loop tiers)
  edgeOpacity: number; // 0..1 border strength
  xp: string; // complementary XP accent (bars, level number, "+N XP")
  xpSoft: string; // translucent XP for the ghost segment
}

// Complements: C green → rose, B blue → amber, A purple → lime, S gold → cyan.
// D/E are gray, so they borrow Morf's pink to stay lively without faking rarity.
const XP_BY_TIER: Record<StrengthTierBase, string> = {
  S: '#3DDCFF',
  A: '#B6F03C',
  B: '#FFB23F',
  C: '#FF6F91',
  D: '#FF4FA3',
  E: '#FF4FA3',
};

const LIGHT_BY_TIER: Record<StrengthTierBase, string> = {
  S: '#FFE45C',
  A: '#D08BFF',
  B: '#7C9CFF',
  C: '#5FD394',
  D: '#C9CDD3',
  E: '#C9CDD3',
};

// Rarity escalation: matte → soft → shimmer → fast gold shimmer.
const SHEEN_BY_TIER: Record<StrengthTierBase, { sheen: SheenMode; ms: number; edge: number }> = {
  E: { sheen: 'none', ms: 0, edge: 0.25 },
  D: { sheen: 'none', ms: 0, edge: 0.3 },
  C: { sheen: 'once', ms: 1600, edge: 0.45 },
  B: { sheen: 'once', ms: 1400, edge: 0.6 },
  A: { sheen: 'loop', ms: 4200, edge: 0.75 },
  S: { sheen: 'loop', ms: 2800, edge: 0.95 },
};

const UNRANKED_XP = '#FF4FA3';

export function xpAccentForTier(base: StrengthTierBase | null): string {
  return base ? XP_BY_TIER[base] : UNRANKED_XP;
}

export function tierBaseForPercentile(percentile: number): StrengthTierBase | null {
  return percentile > 0 ? (getStrengthTier(percentile).charAt(0) as StrengthTierBase) : null;
}

// XP accent for a lifter at `percentile` (0 = unranked).
export function xpAccentForPercentile(percentile: number): string {
  return xpAccentForTier(tierBaseForPercentile(percentile));
}

// "#RRGGBB" + alpha 0..1 → "#RRGGBBAA".
export function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

export function tierFoil(percentile: number): TierFoil {
  const base = tierBaseForPercentile(percentile);
  if (!base) {
    return {
      base: null,
      color: '#5B626C',
      light: '#C9CDD3',
      foil: ['#2A2F37', '#15181E'],
      sheen: 'none',
      sheenMs: 0,
      edgeOpacity: 0.25,
      xp: UNRANKED_XP,
      xpSoft: hexAlpha(UNRANKED_XP, 0.35),
    };
  }
  const color = TIER_COLORS[base];
  const s = SHEEN_BY_TIER[base];
  const xp = XP_BY_TIER[base];
  return {
    base,
    color,
    light: LIGHT_BY_TIER[base],
    foil: [hexAlpha(color, 0.55), '#15181E'],
    sheen: s.sheen,
    sheenMs: s.ms,
    edgeOpacity: s.edge,
    xp,
    xpSoft: hexAlpha(xp, 0.35),
  };
}
