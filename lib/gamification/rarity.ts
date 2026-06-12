// Achievement rarity — the single biggest prestige driver in game/fitness
// reward systems (PlayStation/Steam tag rarity on top of medals; research shows
// rare unlocks account for most perceived "score"). Drives the metallic look of
// each badge and a small rarity label in the UI. Pure data, no deps.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface RarityMeta {
  label: string;
  // The badge tint + border color and the rarity text accent.
  accent: string;
}

// Slate → Sapphire → Amethyst → Gold: an escalating-prestige ramp that stays
// legible (as a tint + border) on both light and dark surfaces.
export const RARITY_META: Record<Rarity, RarityMeta> = {
  common: { label: 'Common', accent: '#6B7280' },
  rare: { label: 'Rare', accent: '#2563EB' },
  epic: { label: 'Epic', accent: '#7C3AED' },
  legendary: { label: 'Legendary', accent: '#F59E0B' },
};

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}
