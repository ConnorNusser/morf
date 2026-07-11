// Tier-gated background gradients: an optional color wash rendered behind
// every tab screen (see components/ui/ScreenBackground.tsx). Options are
// sorted by the tier that unlocks them, and each draws its colors from that
// tier's theme (primary → accent), so the ladder reads E → S.

export type BackgroundGradientId =
  | 'none'
  | 'earth'
  | 'steel'
  | 'circuit'
  | 'ocean'
  | 'nebula'
  | 'ember';

export interface BackgroundGradient {
  id: BackgroundGradientId;
  displayName: string;
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
    requiredPercentile: 0,
    description: 'No gradient',
    colors: null,
  },
  {
    id: 'earth',
    displayName: 'Earth',
    requiredPercentile: 0,
    description: 'Available to everyone',
    colors: ['#8B5A3C', '#7FB069'], // E tier
  },
  {
    id: 'steel',
    displayName: 'Steel',
    requiredPercentile: 0,
    description: 'Available to everyone',
    colors: ['#1F6FEB', '#D4D4D8'], // E tier dark
  },
  {
    id: 'circuit',
    displayName: 'Circuit',
    requiredPercentile: 25,
    description: 'Requires 25th percentile',
    colors: ['#5856D6', '#34C759'], // C tier
  },
  {
    id: 'ocean',
    displayName: 'Ocean',
    requiredPercentile: 50,
    description: 'Requires 50th percentile',
    colors: ['#3B82F6', '#22D3EE'], // B tier
  },
  {
    id: 'nebula',
    displayName: 'Nebula',
    requiredPercentile: 75,
    description: 'Requires 75th percentile',
    colors: ['#A855F7', '#F472B6'], // A tier
  },
  {
    id: 'ember',
    displayName: 'Ember',
    requiredPercentile: 90,
    description: 'Requires 90th percentile',
    colors: ['#C15F3C', '#E67D22'], // S tier
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
