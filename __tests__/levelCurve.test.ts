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
    expect(p).toMatchObject({ level: 23, title: 'Elite', xpIntoLevel: 660, xpForNext: 1030, xpToNext: 370 });
    expect(p.progress).toBeCloseTo(660 / 1030);
  });

  it('treats zero, negative and fractional XP sanely', () => {
    expect(levelForXp(0)).toMatchObject({ level: 1, title: 'Novice', progress: 0 });
    expect(levelForXp(-50).level).toBe(1);
    expect(levelForXp(149.9).level).toBe(1);
  });

  it('titles are rank names and change every 5 levels', () => {
    expect(levelTitle(4)).toBe('Novice');
    expect(levelTitle(5)).toBe('Initiate');
    expect(levelTitle(49)).toBe('Mythic');
    expect(levelTitle(50)).toBe('Ascendant');
    expect(levelTitle(99)).toBe('Transcendent');
    expect(nextLevelTitle(23)).toEqual({ minLevel: 25, title: 'Ace' });
    expect(nextLevelTitle(54)).toEqual({ minLevel: 55, title: 'Transcendent' });
    expect(nextLevelTitle(55)).toBeNull();
  });
});
