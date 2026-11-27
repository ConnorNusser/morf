import {
  levelForXp,
  levelTitle,
  nextLevelTitle,
  totalXpForLevel,
  xpForNextLevel,
} from '@/lib/gamification/levelCurve';

describe('level curve', () => {
  it('costs 150 for the first level and +40 per level after', () => {
    expect(xpForNextLevel(1)).toBe(150);
    expect(xpForNextLevel(2)).toBe(190);
    expect(xpForNextLevel(23)).toBe(1030);
  });

  it('cumulative XP matches the summed per-level cost', () => {
    let sum = 0;
    for (let l = 1; l <= 80; l++) {
      expect(totalXpForLevel(l)).toBe(sum);
      sum += xpForNextLevel(l);
    }
  });

  it('hits the planned milestones', () => {
    expect(totalXpForLevel(10)).toBe(2790);
    expect(totalXpForLevel(25)).toBe(14640);
    expect(totalXpForLevel(50)).toBe(54390);
  });

  it('levelForXp is exact at every boundary', () => {
    for (let l = 1; l <= 120; l++) {
      const at = totalXpForLevel(l);
      expect(levelForXp(at).level).toBe(l);
      expect(levelForXp(at).xpIntoLevel).toBe(0);
      if (at > 0) expect(levelForXp(at - 1).level).toBe(l - 1);
    }
  });

  it('reports progress through the current level', () => {
    const p = levelForXp(totalXpForLevel(23) + 660);
    expect(p).toMatchObject({ level: 23, title: 'Gold II', xpIntoLevel: 660, xpForNext: 1030, xpToNext: 370 });
    expect(p.progress).toBeCloseTo(660 / 1030);
  });

  it('treats zero, negative and fractional XP sanely', () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, title: 'Bronze III', progress: 0 });
    expect(levelForXp(-50).level).toBe(1);
    expect(levelForXp(149.9).level).toBe(1);
  });

  it('titles are rank names: tier + division, master tiers bare', () => {
    expect(levelTitle(1)).toBe('Bronze III');
    expect(levelTitle(4)).toBe('Bronze II');
    expect(levelTitle(9)).toBe('Bronze I');
    expect(levelTitle(10)).toBe('Silver III');
    expect(levelTitle(26)).toBe('Gold I');
    expect(levelTitle(49)).toBe('Emerald I');
    expect(levelTitle(60)).toBe('Master');
    expect(levelTitle(99)).toBe('Challenger');
    expect(levelForXp(totalXpForLevel(23)).title).toBe('Gold II');
    expect(nextLevelTitle(23)).toEqual({ minLevel: 26, title: 'Gold I' });
    expect(nextLevelTitle(17)).toEqual({ minLevel: 20, title: 'Gold III' });
    expect(nextLevelTitle(72)).toEqual({ minLevel: 80, title: 'Challenger' });
    expect(nextLevelTitle(80)).toBeNull();
  });
});
