// Tier-gated background gradients: an optional color wash rendered behind
// every tab screen (see components/ui/ScreenBackground.tsx). One gradient per
// strength tier, anchored on that tier's canonical TIER_COLORS entry (the
// color every tier badge/leaderboard band uses) fading to a lighter companion
// shade, and named after the tier's rarity word.

import { getStrengthTier, StrengthTierBase, TIER_COLORS, tierFloorPercentile } from '@/lib/data/strengthStandards';

export type BackgroundGradientId =
  | 'auto' // follows the lifter's current tier (default; the wash is always on)
  | 'none' // legacy: stored by older builds, now resolves like 'auto'
  | 'common'
  | 'uncommon'
  | 'rare'
  | 'epic'
  | 'legendary';

export interface BackgroundGradient {
  id: BackgroundGradientId;
  displayName: string;
  /** Tier whose TIER_COLORS entry anchors the gradient; null for 'none'. */
  tier: StrengthTierBase | null;
  /** Percentile gate, mirrors THEME_CONFIG tiers (0 = everyone). */
  requiredPercentile: number;
  description: string;
  /** Two anchor colors (top → fade); null renders no gradient. */
  colors: [string, string] | null;
}

export const DEFAULT_GRADIENT_ID: BackgroundGradientId = 'auto';

// Ordered by unlock tier — keep 'auto' first and requiredPercentile non-decreasing.
export const BACKGROUND_GRADIENTS: BackgroundGradient[] = [
  {
    id: 'auto',
    displayName: 'My tier',
    tier: null,
    requiredPercentile: 0,
    description: 'Follows your current tier',
    colors: null, // resolved per lifter by resolveBackgroundGradient
  },
  {
    id: 'common',
    displayName: 'Common',
    tier: 'E',
    requiredPercentile: 0,
    description: 'E Tier · Available to everyone',
    colors: [TIER_COLORS.E, '#B8B8B8'],
  },
  {
    id: 'uncommon',
    displayName: 'Uncommon',
    tier: 'C',
    requiredPercentile: tierFloorPercentile('C'),
    description: `C Tier · Requires ${ordinal(tierFloorPercentile('C'))} percentile`,
    colors: [TIER_COLORS.C, '#6FCF97'],
  },
  {
    id: 'rare',
    displayName: 'Rare',
    tier: 'B',
    requiredPercentile: tierFloorPercentile('B'),
    description: `B Tier · Requires ${ordinal(tierFloorPercentile('B'))} percentile`,
    colors: [TIER_COLORS.B, '#7EA4F2'],
  },
  {
    id: 'epic',
    displayName: 'Epic',
    tier: 'A',
    requiredPercentile: tierFloorPercentile('A'),
    description: `A Tier · Requires ${ordinal(tierFloorPercentile('A'))} percentile`,
    colors: [TIER_COLORS.A, '#D178FF'],
  },
  {
    id: 'legendary',
    displayName: 'Legendary',
    tier: 'S',
    requiredPercentile: tierFloorPercentile('S'),
    description: `S Tier · Requires ${ordinal(tierFloorPercentile('S'))} percentile`,
    colors: [TIER_COLORS.S, '#FF9F1C'],
  },
];

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const byId = new Map(BACKGROUND_GRADIENTS.map((g) => [g.id, g]));

/** Unknown/legacy stored ids (including 'none') fall back to 'auto' so the wash is always on. */
export const getBackgroundGradient = (id: string | null | undefined): BackgroundGradient => {
  return (id && byId.get(id as BackgroundGradientId)) || (byId.get('auto') as BackgroundGradient);
};

const BY_TIER: Partial<Record<StrengthTierBase, BackgroundGradient>> = {};
for (const g of BACKGROUND_GRADIENTS) if (g.tier) BY_TIER[g.tier] = g;

/** Gradient for a tier letter; D (no gradient of its own) shares E's. */
export const gradientForTier = (base: StrengthTierBase | null): BackgroundGradient =>
  (base && BY_TIER[base]) || BY_TIER.E!;

/** The gradient actually painted: 'auto' (and legacy 'none') follow the lifter's tier;
 * an explicit pick is honored only while it's still unlocked. */
export const resolveBackgroundGradient = (id: string | null | undefined, userPercentile: number): BackgroundGradient => {
  const base = userPercentile > 0 ? (getStrengthTier(userPercentile).charAt(0) as StrengthTierBase) : null;
  const g = getBackgroundGradient(id);
  if (g.id === 'auto' || !isGradientUnlocked(g.id, userPercentile)) return gradientForTier(base);
  return g;
};

export const isGradientUnlocked = (id: BackgroundGradientId, userPercentile: number): boolean => {
  return userPercentile >= getBackgroundGradient(id).requiredPercentile;
};

// ---- Blending ------------------------------------------------------------
// The 'auto' wash doesn't jump at tier boundaries: as you climb through a tier
// letter it eases toward the next letter's colors, so a C+ lifter's screen is
// already tinged with B's blue. The current tier stays dominant (max 55% mix).

const LETTER_ORDER: StrengthTierBase[] = ['E', 'D', 'C', 'B', 'A', 'S'];
export const MAX_BLEND = 0.55;

function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '');
  return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16)) as [number, number, number];
}

export function blendHex(a: string, b: string, t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const [ra, ga, ba] = hexToRgb(a);
  const [rb, gb, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0');
  return `#${c(ra, rb)}${c(ga, gb)}${c(ba, bb)}`.toUpperCase();
}

// 0..1 progress through the current tier *letter* (C- floor → B- floor).
export function letterProgress(percentile: number): number {
  if (percentile <= 0) return 0;
  const base = getStrengthTier(percentile).charAt(0) as StrengthTierBase;
  const i = LETTER_ORDER.indexOf(base);
  const next = LETTER_ORDER[i + 1];
  if (!next) return 0;
  const lo = tierFloorPercentile(base);
  const hi = tierFloorPercentile(next);
  return Math.max(0, Math.min(1, (percentile - lo) / Math.max(1, hi - lo)));
}

/** Colors actually painted. 'auto' blends toward the next tier (eased);
 * explicit picks paint their own colors unblended. */
export function resolveBackgroundColors(id: string | null | undefined, userPercentile: number): [string, string] | null {
  const g = resolveBackgroundGradient(id, userPercentile);
  if (!g.colors) return null;
  if (getBackgroundGradient(id).id !== 'auto' || userPercentile <= 0) return g.colors;
  const base = getStrengthTier(userPercentile).charAt(0) as StrengthTierBase;
  const next = LETTER_ORDER[LETTER_ORDER.indexOf(base) + 1];
  const target = next ? gradientForTier(next).colors : null;
  if (!target || target === g.colors) return g.colors;
  const p = letterProgress(userPercentile);
  const t = MAX_BLEND * p * p; // ease-in: identity holds early, blends near the top
  return [blendHex(g.colors[0], target[0], t), blendHex(g.colors[1], target[1], t)];
}
