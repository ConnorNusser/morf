// Achievement rarity — drives each badge's tint/border and rarity label. Pure data.
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface RarityMeta {
  label: string;
  accent: string; // badge tint/border + rarity text accent
}

// Slate → Sapphire → Amethyst → Gold, legible on light and dark surfaces.
export const RARITY_META: Record<Rarity, RarityMeta> = {
  common: { label: 'Common', accent: '#6B7280' },
  rare: { label: 'Rare', accent: '#2563EB' },
  epic: { label: 'Epic', accent: '#7C3AED' },
  legendary: { label: 'Legendary', accent: '#F59E0B' },
};

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}
