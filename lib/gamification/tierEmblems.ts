// Tier rank emblems (Solo Leveling-inspired obsidian sigils) — one per base
// tier; +/- variants share their letter's emblem.
import { getBaseTier, StrengthTier, StrengthTierBase } from '@/lib/data/strengthStandards';
import { ImageSourcePropType } from 'react-native';

const TIER_EMBLEMS: Record<StrengthTierBase, ImageSourcePropType> = {
  S: require('@/assets/images/tiers/emblem-s.png'),
  A: require('@/assets/images/tiers/emblem-a.png'),
  B: require('@/assets/images/tiers/emblem-b.png'),
  C: require('@/assets/images/tiers/emblem-c.png'),
  D: require('@/assets/images/tiers/emblem-d.png'),
  E: require('@/assets/images/tiers/emblem-e.png'),
};

export function tierEmblemFor(tier: StrengthTier): ImageSourcePropType {
  return TIER_EMBLEMS[getBaseTier(tier)];
}
