import { TIER_COLORS } from '@/lib/data/strengthStandards';
import {
  BACKGROUND_GRADIENTS,
  DEFAULT_GRADIENT_ID,
  getBackgroundGradient,
  isGradientUnlocked,
} from '@/lib/ui/backgroundGradients';

describe('background gradient catalog', () => {
  it('has unique ids', () => {
    const ids = BACKGROUND_GRADIENTS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('starts with the None option and defaults to it', () => {
    expect(BACKGROUND_GRADIENTS[0].id).toBe('none');
    expect(BACKGROUND_GRADIENTS[0].colors).toBeNull();
    expect(DEFAULT_GRADIENT_ID).toBe('none');
  });

  it('is sorted by unlock tier (non-decreasing percentile)', () => {
    const gates = BACKGROUND_GRADIENTS.map((g) => g.requiredPercentile);
    for (let i = 1; i < gates.length; i++) {
      expect(gates[i]).toBeGreaterThanOrEqual(gates[i - 1]);
    }
  });

  it('mirrors the theme tier ladder (0/25/50/75/90 all present)', () => {
    const gates = new Set(BACKGROUND_GRADIENTS.map((g) => g.requiredPercentile));
    for (const gate of [0, 25, 50, 75, 90]) {
      expect(gates).toContain(gate);
    }
  });

  it('every gradient except none has two valid hex anchor colors', () => {
    for (const g of BACKGROUND_GRADIENTS) {
      if (g.id === 'none') continue;
      expect(g.colors).toHaveLength(2);
      for (const c of g.colors!) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it('anchors every gradient on its tier color from TIER_COLORS', () => {
    for (const g of BACKGROUND_GRADIENTS) {
      if (g.id === 'none') continue;
      expect(g.tier).not.toBeNull();
      expect(g.colors![0]).toBe(TIER_COLORS[g.tier!]);
    }
  });
});

describe('getBackgroundGradient', () => {
  it('resolves known ids', () => {
    expect(getBackgroundGradient('legendary').id).toBe('legendary');
  });

  it('falls back to none for unknown, legacy, null, or undefined ids', () => {
    expect(getBackgroundGradient('earth').id).toBe('none'); // pre-rename id
    expect(getBackgroundGradient('sparkle_legacy').id).toBe('none');
    expect(getBackgroundGradient(null).id).toBe('none');
    expect(getBackgroundGradient(undefined).id).toBe('none');
  });
});

describe('isGradientUnlocked', () => {
  it('none and the E-tier gradient are available to everyone', () => {
    expect(isGradientUnlocked('none', 0)).toBe(true);
    expect(isGradientUnlocked('common', 0)).toBe(true);
  });

  it('gates each tier at its percentile boundary', () => {
    expect(isGradientUnlocked('uncommon', 24)).toBe(false);
    expect(isGradientUnlocked('uncommon', 25)).toBe(true);
    expect(isGradientUnlocked('rare', 49)).toBe(false);
    expect(isGradientUnlocked('rare', 50)).toBe(true);
    expect(isGradientUnlocked('epic', 74)).toBe(false);
    expect(isGradientUnlocked('epic', 75)).toBe(true);
    expect(isGradientUnlocked('legendary', 89)).toBe(false);
    expect(isGradientUnlocked('legendary', 90)).toBe(true);
  });
});
