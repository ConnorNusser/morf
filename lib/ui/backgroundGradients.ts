// Tier-gated background gradients: an optional color wash rendered behind
// every tab screen (see components/ui/ScreenBackground.tsx). One gradient per
// strength tier, anchored on that tier's canonical TIER_COLORS entry (the
// color every tier badge/leaderboard band uses) fading to a lighter companion
// shade, and named after the tier's rarity word.

import { StrengthTierBase, TIER_COLORS } from '@/lib/data/strengthStandards';

export type BackgroundGradientId =
  | 'none'
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

export const DEFAULT_GRADIENT_ID: BackgroundGradientId = 'none';

// Ordered by unlock tier — keep 'none' first and requiredPercentile non-decreasing.
export const BACKGROUND_GRADIENTS: BackgroundGradient[] = [
  {
    id: 'none',
    displayName: 'None',
    tier: null,
    requiredPercentile: 0,
    description: 'No gradient',
    colors: null,
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
    requiredPercentile: 25,
    description: 'C Tier · Requires 25th percentile',
    colors: [TIER_COLORS.C, '#6FCF97'],
  },
  {
    id: 'rare',
    displayName: 'Rare',
    tier: 'B',
    requiredPercentile: 50,
    description: 'B Tier · Requires 50th percentile',
    colors: [TIER_COLORS.B, '#7EA4F2'],
  },
  {
    id: 'epic',
    displayName: 'Epic',
    tier: 'A',
    requiredPercentile: 75,
    description: 'A Tier · Requires 75th percentile',
    colors: [TIER_COLORS.A, '#D178FF'],
  },
  {
    id: 'legendary',
    displayName: 'Legendary',
    tier: 'S',
    requiredPercentile: 90,
    description: 'S Tier · Requires 90th percentile',
    colors: [TIER_COLORS.S, '#FF9F1C'],
  },
];

const byId = new Map(BACKGROUND_GRADIENTS.map((g) => [g.id, g]));

/** Unknown/legacy stored ids fall back to 'none' so rendering never breaks. */
export const getBackgroundGradient = (id: string | null | undefined): BackgroundGradient => {
  return (id && byId.get(id as BackgroundGradientId)) || (byId.get('none') as BackgroundGradient);
};

export const isGradientUnlocked = (id: BackgroundGradientId, userPercentile: number): boolean => {
  return userPercentile >= getBackgroundGradient(id).requiredPercentile;
};
