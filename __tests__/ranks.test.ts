import { TIER_COLORS } from '@/lib/data/strengthStandards';
import {
  isRankUp,
  isTierUp,
  mixHex,
  nextRank,
  nextTier,
  rankAccentForLevel,
  rankBlend,
  RANKS,
  rankForLevel,
  rankGradientForLevel,
  rankShineForLevel,
  rankStep,
  rankStepCount,
  rankUpLine,
  tierForLevel,
  TIERS,
  withArticle,
} from '@/lib/gamification/ranks';

// Distance between two hex colors in RGB space.
function dist(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

// WCAG relative luminance + contrast ratio.
function contrast(a: string, b: string): number {
  const lum = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c =>
      c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (hi + 0.05) / (lo + 0.05);
}

describe('tiers', () => {
  it('runs Bronze → Challenger, one metal per 10 levels (Bronze 1–9)', () => {
    expect(TIERS.map(t => t.name)).toEqual([
      'Bronze', 'Silver', 'Gold', 'Platinum', 'Emerald', 'Diamond', 'Master', 'Grandmaster', 'Challenger',
    ]);
    expect(TIERS.map(t => t.minLevel)).toEqual([1, 10, 20, 30, 40, 50, 60, 70, 80]);
    expect(TIERS.map(t => t.hasDivisions)).toEqual([true, true, true, true, true, true, false, false, false]);
  });

  it('maps levels to tiers at the boundaries', () => {
    const table: [number, string][] = [
      [1, 'bronze'], [9, 'bronze'], [10, 'silver'], [19, 'silver'], [20, 'gold'], [29, 'gold'],
      [30, 'platinum'], [40, 'emerald'], [50, 'diamond'], [59, 'diamond'], [60, 'master'],
      [69, 'master'], [70, 'grandmaster'], [79, 'grandmaster'], [80, 'challenger'], [250, 'challenger'],
    ];
    for (const [level, id] of table) expect(tierForLevel(level).id).toBe(id);
  });

  it('nextTier walks up and stops at Challenger', () => {
    expect(nextTier(5)?.name).toBe('Silver');
    expect(nextTier(59)?.name).toBe('Master');
    expect(nextTier(80)).toBeNull();
  });
});

describe('divisions', () => {
  it('has 21 rungs: 6 divided tiers × 3 + 3 master tiers', () => {
    expect(RANKS).toHaveLength(21);
    RANKS.forEach((r, i) => expect(r.index).toBe(i));
    expect(RANKS.slice(0, 6).map(r => r.name)).toEqual([
      'Bronze III', 'Bronze II', 'Bronze I', 'Silver III', 'Silver II', 'Silver I',
    ]);
    expect(RANKS.slice(-3).map(r => r.name)).toEqual(['Master', 'Grandmaster', 'Challenger']);
    expect(RANKS.map(r => r.minLevel)).toEqual([
      1, 4, 7, 10, 13, 16, 20, 23, 26, 30, 33, 36, 40, 43, 46, 50, 53, 56, 60, 70, 80,
    ]);
  });

  it('splits Bronze 3/3/3 and the 10-level tiers 3/3/4', () => {
    const div = (lv: number) => rankForLevel(lv).division;
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9].map(div)).toEqual(['III', 'III', 'III', 'II', 'II', 'II', 'I', 'I', 'I']);
    expect([10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(div)).toEqual([
      'III', 'III', 'III', 'II', 'II', 'II', 'I', 'I', 'I', 'I',
    ]);
    expect([50, 52, 53, 55, 56, 59].map(div)).toEqual(['III', 'III', 'II', 'II', 'I', 'I']);
  });

  it('names ranks "Tier Division", master tiers just the tier', () => {
    const table: [number, string][] = [
      [1, 'Bronze III'], [9, 'Bronze I'], [10, 'Silver III'], [22, 'Gold III'], [23, 'Gold II'],
      [29, 'Gold I'], [41, 'Emerald III'], [59, 'Diamond I'], [60, 'Master'], [75, 'Grandmaster'],
      [80, 'Challenger'], [200, 'Challenger'],
    ];
    for (const [level, name] of table) expect(rankForLevel(level).name).toBe(name);
    expect(rankForLevel(64)).toMatchObject({ tier: 'master', division: null, tierName: 'Master' });
    expect(rankForLevel(23)).toMatchObject({ id: 'gold-2', tier: 'gold', tierIndex: 2, division: 'II' });
  });

  it('treats junk levels as level 1', () => {
    expect(rankForLevel(0).id).toBe('bronze-3');
    expect(rankForLevel(-3).id).toBe('bronze-3');
    expect(rankForLevel(NaN).id).toBe('bronze-3');
    expect(tierForLevel(NaN).id).toBe('bronze');
  });

  it('nextRank walks to the next division, then the next tier, then stops', () => {
    expect(nextRank(1)?.name).toBe('Bronze II');
    expect(nextRank(8)).toMatchObject({ name: 'Silver III', minLevel: 10 });
    expect(nextRank(17)).toMatchObject({ name: 'Gold III', minLevel: 20 });
    expect(nextRank(57)?.name).toBe('Master');
    expect(nextRank(65)).toMatchObject({ name: 'Grandmaster', minLevel: 70 });
    expect(nextRank(80)).toBeNull();
  });

  it('rankStep counts divisions on divided tiers, levels on master tiers', () => {
    expect(rankStepCount(5)).toBe(3);
    expect([1, 3, 4, 6, 7, 9].map(rankStep)).toEqual([1, 1, 2, 2, 3, 3]);
    expect([20, 23, 26, 29].map(rankStep)).toEqual([1, 2, 3, 3]);
    expect(rankStepCount(60)).toBe(10);
    expect([60, 64, 69].map(rankStep)).toEqual([1, 5, 10]);
    expect(rankStep(150)).toBe(10); // open-ended Challenger caps at full
  });

  it('isRankUp fires on a division OR tier change; isTierUp only on a metal change', () => {
    // Division promotion inside a tier.
    expect(isRankUp(3, 4)).toBe(true);
    expect(isTierUp(3, 4)).toBe(false);
    expect(isRankUp(22, 23)).toBe(true);
    expect(isTierUp(22, 23)).toBe(false);
    // Tier up.
    expect(isRankUp(9, 10)).toBe(true);
    expect(isTierUp(9, 10)).toBe(true);
    expect(isTierUp(59, 60)).toBe(true);
    expect(isTierUp(79, 80)).toBe(true);
    expect(isTierUp(18, 31)).toBe(true); // skipped a tier in one go
    // Same rung.
    expect(isRankUp(16, 19)).toBe(false);
    expect(isRankUp(61, 69)).toBe(false); // master tiers have no divisions
    expect(isRankUp(90, 95)).toBe(false);
    // Never on the way down.
    expect(isRankUp(10, 9)).toBe(false);
    expect(isTierUp(10, 9)).toBe(false);
  });
});

describe('emblem spec', () => {
  const spec = (lv: number) => rankForLevel(lv).emblem;

  it('upgrades the silhouette one piece per tier', () => {
    expect(TIERS.map(t => spec(t.minLevel).stage)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(spec(1)).toMatchObject({ blades: false, crown: 'none', plates: false, gem: 'none', wings: 'none', aura: 'none' });
    expect(spec(10)).toMatchObject({ blades: true, crown: 'none' });
    expect(spec(20)).toMatchObject({ blades: true, crown: 'point', plates: false });
    expect(spec(30)).toMatchObject({ plates: true, gem: 'none' });
    expect(spec(40)).toMatchObject({ plates: true, gem: 'inset', wings: 'none' });
    expect(spec(50)).toMatchObject({ gem: 'faceted', wings: 'small', aura: 'none' });
    expect(spec(60)).toMatchObject({ wings: 'full', aura: 'ring' });
    expect(spec(70)).toMatchObject({ wings: 'flame', aura: 'ring', prismatic: false });
    expect(spec(80)).toMatchObject({ crown: 'grand', wings: 'flame', aura: 'prismatic', prismatic: true });
  });

  it('shows the division as 1–3 pips (III = 1, II = 2, I = 3), none on master tiers', () => {
    expect([10, 13, 16].map(lv => spec(lv).pips)).toEqual([1, 2, 3]);
    expect([60, 70, 80].map(lv => spec(lv).pips)).toEqual([0, 0, 0]);
  });

  it('only Challenger is prismatic', () => {
    expect(RANKS.filter(r => r.emblem.prismatic).map(r => r.id)).toEqual(['challenger']);
  });
});

describe('rank gradients', () => {
  it('mixHex interpolates and clamps', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#FFFFFF', 7)).toBe('#FFFFFF');
  });

  it('starts each tier on its own metal; ranks carry the blended palette at their first level', () => {
    for (const t of TIERS) expect(rankGradientForLevel(t.minLevel)).toEqual(t.gradient);
    for (const r of RANKS) expect(r.gradient).toEqual(rankGradientForLevel(r.minLevel));
  });

  it('blends across the whole tier toward the next tier', () => {
    const gold = TIERS[2].gradient;
    const plat = TIERS[3].gradient;
    const at = (lv: number, p = 0) => rankGradientForLevel(lv, p);
    let prev = Infinity;
    for (let lv = 20; lv <= 29; lv++) {
      const d = dist(at(lv)[1], plat[1]);
      expect(d).toBeLessThan(prev);
      prev = d;
    }
    expect(dist(at(29)[0], plat[0])).toBeLessThan(dist(at(29)[0], gold[0]));
    expect(dist(at(22, 0.9)[1], plat[1])).toBeLessThan(dist(at(22, 0)[1], plat[1]));
    expect(rankBlend(29, 1)).toBeLessThanOrEqual(1);
    expect(rankBlend(20)).toBe(0);
    expect(rankBlend(25)).toBeCloseTo(5 / 10);
  });

  it('uses the 9-level span for Bronze and holds steady at Challenger', () => {
    expect(rankBlend(4)).toBeCloseTo(3 / 9);
    expect(rankGradientForLevel(95, 0.5)).toEqual(TIERS[8].gradient);
    expect(rankShineForLevel(95)).toBe(TIERS[8].shine);
    expect(rankBlend(99)).toBe(0);
  });

  it('accent picks the light stop on dark, deep stop on light', () => {
    const [soft, deep] = rankGradientForLevel(23, 0.4);
    expect(rankAccentForLevel(23, true, 0.4)).toBe(soft);
    expect(rankAccentForLevel(23, false, 0.4)).toBe(deep);
  });

  it('metals read on both themes: light stops on dark, deep stops on white', () => {
    for (let lv = 1; lv <= 85; lv++) {
      const [soft, deep] = rankGradientForLevel(lv, 0.5);
      expect(contrast(soft, '#121212')).toBeGreaterThanOrEqual(4.5);
      expect(contrast(deep, '#FFFFFF')).toBeGreaterThanOrEqual(3);
    }
  });

  it('every stop is a valid 6-digit hex', () => {
    for (let lv = 1; lv <= 90; lv++) {
      for (const c of [...rankGradientForLevel(lv, 0.5), rankShineForLevel(lv, 0.5)]) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('rank copy', () => {
  it('uses the right article', () => {
    expect(withArticle('Emerald II')).toBe('an Emerald II');
    expect(withArticle('Gold III')).toBe('a Gold III');
  });

  it('announces promotions', () => {
    expect(rankUpLine({ name: 'Gold II' })).toBe('Promoted to Gold II');
    expect(rankUpLine(rankForLevel(60))).toBe('Promoted to Master');
  });
});

// Color ownership (docs: strength tiers own hue; rank metals read as material).
describe('rank metals vs strength-tier colors', () => {
  const chroma = (hex: string) => {
    const h = hex.replace('#', '');
    const c = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
    return Math.max(...c) - Math.min(...c);
  };
  const METAL_MAX = 0.3;
  const TIER_MIN = 0.35;

  it('every metal stop is low-chroma', () => {
    for (const t of TIERS) {
      for (const stop of t.gradient) expect(chroma(stop)).toBeLessThanOrEqual(METAL_MAX);
    }
  });

  it('every hued strength tier is clearly more saturated than any metal', () => {
    for (const tier of ['C', 'B', 'A', 'S'] as const) {
      expect(chroma(TIER_COLORS[tier])).toBeGreaterThanOrEqual(TIER_MIN);
    }
  });

  it('blended level gradients stay low-chroma between metals too', () => {
    for (let lv = 1; lv <= 100; lv += 3) {
      for (const stop of rankGradientForLevel(lv, 0.5)) expect(chroma(stop)).toBeLessThanOrEqual(METAL_MAX);
    }
  });
});
