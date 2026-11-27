// Tier-driven visuals for the holo rank card and every XP surface.
// Each tier letter gets (a) a foil treatment that escalates with rarity and
// (b) an XP accent: the tier's *secondary* shade — the same companion color the
// tier's background gradient fades to — so card, XP bar and screen wash read as
// one palette, and the whole hero shifts color as you rank up.
import { getStrengthTier, StrengthTierBase, TIER_COLORS } from '@/lib/data/strengthStandards';
import { gradientForTier } from './backgroundGradients';

export type SheenMode = 'none' | 'once' | 'loop';

export interface TierFoil {
  base: StrengthTierBase | null; // null = unranked
  color: string; // tier hue (card edge + glow)
  light: string; // lightened tier hue for the big letter
  foil: [string, string]; // barely-there tint: the card blends into the screen wash
  sheen: SheenMode; // light sweep across the card
  sheenMs: number; // sweep duration
  sheenRestMs: number; // pause between sweeps (shorter = rarer tier)
  xp: string; // tier-secondary XP accent (bars, level number, "+N XP")
  xpSoft: string; // translucent XP for the ghost segment
}

// XP = the tier gradient's companion shade (C mint, B periwinkle, A orchid,
// S amber, D/E silver). One source of truth with the background wash.
function secondaryFor(base: StrengthTierBase | null): string {
  return gradientForTier(base).colors![1];
}

const LIGHT_BY_TIER: Record<StrengthTierBase, string> = {
  S: '#FFE45C',
  A: '#D08BFF',
  B: '#7C9CFF',
  C: '#5FD394',
  D: '#C9CDD3',
  E: '#C9CDD3',
};

// Rarity escalation by sweep cadence: D/E matte, then the sweep comes faster
// and more often as the tier rises (C lazy → S rapid gold glint).
const SHEEN_BY_TIER: Record<StrengthTierBase, { sheen: SheenMode; ms: number; rest: number }> = {
  E: { sheen: 'none', ms: 0, rest: 0 },
  D: { sheen: 'none', ms: 0, rest: 0 },
  C: { sheen: 'loop', ms: 1900, rest: 4200 },
  B: { sheen: 'loop', ms: 1700, rest: 3400 },
  A: { sheen: 'loop', ms: 1500, rest: 2500 },
  S: { sheen: 'loop', ms: 1200, rest: 1600 },
};

export function xpAccentForTier(base: StrengthTierBase | null): string {
  return secondaryFor(base);
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
      foil: [hexAlpha('#808080', 0.06), hexAlpha('#808080', 0)],
      sheen: 'none',
      sheenMs: 0,
      sheenRestMs: 0,
      xp: secondaryFor(null),
      xpSoft: hexAlpha(secondaryFor(null), 0.35),
    };
  }
  const color = TIER_COLORS[base];
  const s = SHEEN_BY_TIER[base];
  const xp = secondaryFor(base);
  return {
    base,
    color,
    light: LIGHT_BY_TIER[base],
    foil: [hexAlpha(color, 0.08), hexAlpha(color, 0)],
    sheen: s.sheen,
    sheenMs: s.ms,
    sheenRestMs: s.rest,
    xp,
    xpSoft: hexAlpha(xp, 0.35),
  };
}
