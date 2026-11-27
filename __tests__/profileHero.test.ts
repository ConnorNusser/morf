import { formatOrdinal, heroRankLine, heroStrengthLine } from '@/lib/ui/profileHero';

describe('formatOrdinal', () => {
  it('handles the teens and the 1/2/3 suffixes', () => {
    expect(formatOrdinal(1)).toBe('1st');
    expect(formatOrdinal(2)).toBe('2nd');
    expect(formatOrdinal(3)).toBe('3rd');
    expect(formatOrdinal(4)).toBe('4th');
    expect(formatOrdinal(11)).toBe('11th');
    expect(formatOrdinal(12)).toBe('12th');
    expect(formatOrdinal(13)).toBe('13th');
    expect(formatOrdinal(22)).toBe('22nd');
    expect(formatOrdinal(64.4)).toBe('64th');
    expect(formatOrdinal(101)).toBe('101st');
    expect(formatOrdinal(111)).toBe('111th');
  });
});

describe('hero copy', () => {
  it('formats the rank line', () => {
    expect(heroRankLine('Gold II', 23)).toBe('Gold II · Level 23');
  });

  it('formats the strength line and hides it while unranked', () => {
    expect(heroStrengthLine('B+', 64)).toBe('B+ tier · 64th percentile');
    expect(heroStrengthLine('E-', 0)).toBeNull();
    expect(heroStrengthLine(null, 50)).toBeNull();
  });
});
