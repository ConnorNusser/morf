import { RARITY_META, RARITY_ORDER, rarityRank } from '../lib/gamification/rarity';

describe('rarity', () => {
  it('ranks rarities from common (0) to legendary (3)', () => {
    expect(rarityRank('common')).toBe(0);
    expect(rarityRank('rare')).toBe(1);
    expect(rarityRank('epic')).toBe(2);
    expect(rarityRank('legendary')).toBe(3);
  });

  it('has ascending order and complete metadata for every rarity', () => {
    for (let i = 1; i < RARITY_ORDER.length; i++) {
      expect(rarityRank(RARITY_ORDER[i])).toBeGreaterThan(rarityRank(RARITY_ORDER[i - 1]));
    }
    for (const r of RARITY_ORDER) {
      const meta = RARITY_META[r];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
