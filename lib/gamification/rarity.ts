// Achievement rarity — the single biggest prestige driver in game/fitness
// reward systems (PlayStation/Steam tag rarity on top of medals; research shows
// rare unlocks account for most perceived "score"). Drives the metallic look of
// each badge and a small rarity label in the UI. Pure data, no deps.

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export interface RarityMeta {
  label: string;
  // Metallic gradient for the badge medallion: [top highlight, bottom shade].
  gradient: [string, string];
  // Ring / bevel color and the rarity text accent.
  accent: string;
}

// Bronze → Sapphire → Amethyst → Gold. Chosen to read as escalating prestige
// and to stay legible on both light and dark surfaces.
export const RARITY_META: Record<Rarity, RarityMeta> = {
  common: { label: 'Common', gradient: ['#B8BEC9', '#7C8595'], accent: '#6B7280' },
  rare: { label: 'Rare', gradient: ['#5EC2F5', '#2563EB'], accent: '#2563EB' },
  epic: { label: 'Epic', gradient: ['#C98BFB', '#7C3AED'], accent: '#7C3AED' },
  legendary: { label: 'Legendary', gradient: ['#FCD667', '#F59E0B'], accent: '#F59E0B' },
};

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}
