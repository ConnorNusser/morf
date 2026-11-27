import {
  isRankUp,
  mixHex,
  nextRank,
  rankAccentForLevel,
  rankBlend,
  RANKS,
  rankForLevel,
  rankGradientForLevel,
  rankStep,
  rankStepCount,
  rankUpLine,
  withArticle,
} from '@/lib/gamification/ranks';

// Distance between two hex colors in RGB space.
function dist(a: string, b: string): number {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

describe('rank ladder', () => {
  it('has 12 ranks, one every 5 levels', () => {
    expect(RANKS.map(r => r.name)).toEqual([
      'Novice', 'Initiate', 'Adept', 'Vanguard', 'Elite', 'Ace',
      'Champion', 'Hero', 'Paragon', 'Mythic', 'Ascendant', 'Transcendent',
    ]);
    expect(RANKS.map(r => r.minLevel)).toEqual([1, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    RANKS.forEach((r, i) => expect(r.index).toBe(i));
  });

  it('maps levels to ranks at the boundaries', () => {
    const table: [number, string][] = [
      [1, 'Novice'], [4, 'Novice'], [5, 'Initiate'], [9, 'Initiate'], [10, 'Adept'],
      [22, 'Elite'], [25, 'Ace'], [34, 'Champion'], [49, 'Mythic'], [54, 'Ascendant'],
      [55, 'Transcendent'], [200, 'Transcendent'],
    ];
    for (const [level, name] of table) expect(rankForLevel(level).name).toBe(name);
  });

  it('treats junk levels as level 1', () => {
    expect(rankForLevel(0).id).toBe('novice');
    expect(rankForLevel(-3).id).toBe('novice');
    expect(rankForLevel(NaN).id).toBe('novice');
  });

  it('escalates emblem drama every three ranks; prismatic only at the top', () => {
    expect(RANKS.map(r => r.emblem.stage)).toEqual([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4]);
    expect(RANKS.map(r => r.emblem.sparkles)).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3]);
    expect(RANKS.filter(r => r.emblem.prismatic).map(r => r.id)).toEqual(['ascendant', 'transcendent']);
  });

  it('nextRank walks up and stops at the top', () => {
    expect(nextRank(1)?.name).toBe('Initiate');
    expect(nextRank(23)?.minLevel).toBe(25);
    expect(nextRank(55)).toBeNull();
  });

  it('rankStep is the 1-based position inside the rank', () => {
    expect([1, 2, 3, 4].map(rankStep)).toEqual([1, 2, 3, 4]);
    expect(rankStepCount(3)).toBe(4);
    expect([5, 6, 7, 8, 9].map(rankStep)).toEqual([1, 2, 3, 4, 5]);
    expect(rankStepCount(5)).toBe(5);
    expect(rankStep(22)).toBe(3);
    expect(rankStep(80)).toBe(5); // open-ended top rank caps at full
  });

  it('flags rank-ups only across rank boundaries', () => {
    expect(isRankUp(4, 5)).toBe(true);
    expect(isRankUp(23, 26)).toBe(true);
    expect(isRankUp(21, 24)).toBe(false);
    expect(isRankUp(60, 61)).toBe(false);
  });
});

describe('rank gradients', () => {
  it('mixHex interpolates and clamps', () => {
    expect(mixHex('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixHex('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
    expect(mixHex('#102030', '#FFFFFF', 7)).toBe('#FFFFFF');
  });

  it('starts each rank on its own palette', () => {
    for (const r of RANKS) expect(rankGradientForLevel(r.minLevel)).toEqual(r.gradient);
  });

  it('blends toward the next rank as you level through a rank', () => {
    const elite = rankForLevel(20).gradient;
    const ace = rankForLevel(25).gradient;
    const at = (lv: number, p = 0) => rankGradientForLevel(lv, p);
    // Lv 24 is closer to Ace than Lv 20 is, and monotonically so.
    let prev = Infinity;
    for (const lv of [20, 21, 22, 23, 24]) {
      const d = dist(at(lv)[1], ace[1]);
      expect(d).toBeLessThan(prev);
      prev = d;
    }
    expect(dist(at(24)[0], ace[0])).toBeLessThan(dist(at(24)[0], elite[0]));
    // XP progress within the level nudges it further.
    expect(dist(at(22, 0.9)[1], ace[1])).toBeLessThan(dist(at(22, 0)[1], ace[1]));
    // And it never overshoots into the next rank's palette before the boundary.
    expect(rankBlend(24, 1)).toBeLessThanOrEqual(1);
    expect(rankBlend(20)).toBe(0);
    expect(rankBlend(22)).toBeCloseTo(2 / 5);
  });

  it('uses the 4-level span for Novice and holds steady at the top', () => {
    expect(rankBlend(3)).toBeCloseTo(2 / 4);
    expect(rankGradientForLevel(60, 0.5)).toEqual(rankForLevel(55).gradient);
    expect(rankBlend(99)).toBe(0);
  });

  it('accent picks the light stop on dark, saturated stop on light', () => {
    const [soft, deep] = rankGradientForLevel(23, 0.4);
    expect(rankAccentForLevel(23, true, 0.4)).toBe(soft);
    expect(rankAccentForLevel(23, false, 0.4)).toBe(deep);
  });

  it('every stop is a valid 6-digit hex', () => {
    for (let lv = 1; lv <= 60; lv++) {
      for (const c of rankGradientForLevel(lv, 0.5)) expect(c).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('rank copy', () => {
  it('uses the right article', () => {
    expect(withArticle('Ace')).toBe('an Ace');
    expect(withArticle('Elite')).toBe('an Elite');
    expect(withArticle('Hero')).toBe('a Hero');
    expect(rankUpLine({ name: 'Ace' })).toBe('Rank up! Now an Ace');
    expect(rankUpLine({ name: 'Champion' })).toBe('Rank up! Now a Champion');
  });
});
