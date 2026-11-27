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
  foil: [string, string]; // translucent card tint: tier wash top-left → nearly clear
  sheen: SheenMode; // light sweep across the card
  sheenMs: number; // sweep duration (loop tiers)
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

// Rarity escalation: matte → one sweep → shimmer → fast gold shimmer.
const SHEEN_BY_TIER: Record<StrengthTierBase, { sheen: SheenMode; ms: number }> = {
  E: { sheen: 'none', ms: 0 },
  D: { sheen: 'none', ms: 0 },
  C: { sheen: 'once', ms: 1600 },
  B: { sheen: 'once', ms: 1400 },
  A: { sheen: 'loop', ms: 4200 },
  S: { sheen: 'loop', ms: 2800 },
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
      foil: [hexAlpha('#808080', 0.16), hexAlpha('#808080', 0.04)],
      sheen: 'none',
      sheenMs: 0,
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
    foil: [hexAlpha(color, 0.24), hexAlpha(color, 0.05)],
    sheen: s.sheen,
    sheenMs: s.ms,
    xp,
    xpSoft: hexAlpha(xp, 0.35),
  };
}
