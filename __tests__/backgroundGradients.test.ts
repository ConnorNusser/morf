import { getStrengthTier, TIER_COLORS, tierFloorPercentile } from '@/lib/data/strengthStandards';
import {
  BACKGROUND_GRADIENTS,
  resolveBackgroundGradient,
  DEFAULT_GRADIENT_ID,
  getBackgroundGradient,
  isGradientUnlocked,
} from '@/lib/ui/backgroundGradients';

describe('background gradient catalog', () => {
  it('has unique ids', () => {
    const ids = BACKGROUND_GRADIENTS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts with the tier-following Auto option and defaults to it (wash always on)', () => {
    expect(BACKGROUND_GRADIENTS[0].id).toBe('auto');
    expect(BACKGROUND_GRADIENTS[0].colors).toBeNull();
    expect(DEFAULT_GRADIENT_ID).toBe('auto');
  });

  it('is sorted by unlock tier (non-decreasing percentile)', () => {
    const gates = BACKGROUND_GRADIENTS.map((g) => g.requiredPercentile);
    for (let i = 1; i < gates.length; i++) {
      expect(gates[i]).toBeGreaterThanOrEqual(gates[i - 1]);
    }
  });

  it('gates each tier gradient at that tier letter\'s floor (E 0, C 23, B 47, A 70, S 85)', () => {
    for (const g of BACKGROUND_GRADIENTS) {
      if (!g.tier) continue;
      expect(g.requiredPercentile).toBe(tierFloorPercentile(g.tier));
    }
    expect(BACKGROUND_GRADIENTS.map((g) => g.requiredPercentile)).toEqual([0, 0, 23, 47, 70, 85]);
  });

  it('every gradient except none has two valid hex anchor colors', () => {
    for (const g of BACKGROUND_GRADIENTS) {
      if (g.id === 'auto') continue;
      expect(g.colors).toHaveLength(2);
      for (const c of g.colors!) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('anchors every gradient on its tier color from TIER_COLORS', () => {
    for (const g of BACKGROUND_GRADIENTS) {
      if (g.id === 'auto') continue;
      expect(g.tier).not.toBeNull();
      expect(g.colors![0]).toBe(TIER_COLORS[g.tier!]);
    }
  });
});

describe('getBackgroundGradient', () => {
  it('resolves known ids', () => {
    expect(getBackgroundGradient('legendary').id).toBe('legendary');
  });

  it('falls back to auto for unknown, legacy (incl. none), null, or undefined ids', () => {
    expect(getBackgroundGradient('earth').id).toBe('auto'); // pre-rename id
    expect(getBackgroundGradient('none').id).toBe('auto'); // the wash is forced on now
    expect(getBackgroundGradient('sparkle_legacy').id).toBe('auto');
    expect(getBackgroundGradient(null).id).toBe('auto');
    expect(getBackgroundGradient(undefined).id).toBe('auto');
  });
});

describe('isGradientUnlocked', () => {
  it('auto and the E-tier gradient are available to everyone', () => {
    expect(isGradientUnlocked('auto', 0)).toBe(true);
    expect(isGradientUnlocked('common', 0)).toBe(true);
  });

  it('gates each tier at its tier floor, so showing as C- means C is unlocked', () => {
    expect(isGradientUnlocked('uncommon', 22)).toBe(false);
    expect(isGradientUnlocked('uncommon', 23)).toBe(true);
    expect(isGradientUnlocked('uncommon', 24)).toBe(true); // regression: C- at 24th was locked
    expect(isGradientUnlocked('rare', 46)).toBe(false);
    expect(isGradientUnlocked('rare', 47)).toBe(true);
    expect(isGradientUnlocked('epic', 69)).toBe(false);
    expect(isGradientUnlocked('epic', 70)).toBe(true);
    expect(isGradientUnlocked('legendary', 84)).toBe(false);
    expect(isGradientUnlocked('legendary', 85)).toBe(true);
  });
});

describe('resolveBackgroundGradient', () => {
  it('auto follows the lifter\'s current tier', () => {
    expect(resolveBackgroundGradient('auto', 0).id).toBe('common');
    expect(resolveBackgroundGradient('auto', 10).id).toBe('common'); // D shares E's wash
    expect(resolveBackgroundGradient('auto', 24).id).toBe('uncommon');
    expect(resolveBackgroundGradient('auto', 60).id).toBe('rare');
    expect(resolveBackgroundGradient('auto', 92).id).toBe('legendary');
  });

  it('legacy none resolves like auto, so the wash is always on', () => {
    expect(resolveBackgroundGradient('none', 24).id).toBe('uncommon');
  });

  it('honors an explicit unlocked pick but not a locked one', () => {
    expect(resolveBackgroundGradient('common', 92).id).toBe('common');
    expect(resolveBackgroundGradient('legendary', 24).id).toBe('uncommon');
  });

  it('every tier letter lands on a gradient whose gate it passes', () => {
    for (let p = 0; p <= 100; p++) {
      const g = resolveBackgroundGradient('auto', p);
      expect(isGradientUnlocked(g.id, p)).toBe(true);
      if (p > 0 && g.tier && g.tier !== 'E') expect(g.tier).toBe(getStrengthTier(p).charAt(0));
    }
  });
});
