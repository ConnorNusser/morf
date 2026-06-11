import { CareerStats } from '../lib/gamification/careerStats';
import { computeLevel, totalXp } from '../lib/gamification/level';

function stats(p: Partial<CareerStats>): CareerStats {
  return {
    totalWorkouts: 0,
    totalVolume: 0,
    totalSets: 0,
    totalReps: 0,
    daysActive: 0,
    currentStreak: 0,
    longestStreak: 0,
    firstWorkoutAt: null,
    daysSinceStart: 0,
    heaviestSet: null,
    biggestSessionVolume: 0,
    unit: 'lbs',
    ...p,
  };
}

describe('totalXp', () => {
  it('sums the weighted sources', () => {
    // 10 workouts (500) + 100k volume (1000) + 20 days (400) + 3 achievements (600)
    expect(totalXp(stats({ totalWorkouts: 10, totalVolume: 100_000, daysActive: 20 }), 3)).toBe(2500);
  });

  it('normalizes kg volume to lbs', () => {
    const inKg = totalXp(stats({ totalVolume: 45_360, unit: 'kg' }), 0); // ~100k lbs
    const inLbs = totalXp(stats({ totalVolume: 100_000, unit: 'lbs' }), 0);
    expect(Math.abs(inKg - inLbs)).toBeLessThan(50);
  });
});

describe('computeLevel', () => {
  it('starts at level 1 with zero progress', () => {
    const l = computeLevel(stats({}), 0);
    expect(l.level).toBe(1);
    expect(l.xp).toBe(0);
    expect(l.progress).toBe(0);
    expect(l.title).toBe('Rookie');
  });

  it('levels up on the triangular curve', () => {
    // cumulative XP: L2=500, L3=1500, L4=3000
    expect(computeLevel(stats({ totalVolume: 50_000 }), 0).level).toBe(2); // 500 xp
    expect(computeLevel(stats({ totalVolume: 149_900 }), 0).level).toBe(2); // <1500 -> still L2
    expect(computeLevel(stats({ totalVolume: 150_000 }), 0).level).toBe(3); // 1500 -> L3
  });

  it('reports progress within a level (0..1) and a sane span', () => {
    const l = computeLevel(stats({ totalVolume: 100_000 }), 0); // 1000 xp, between L2(500) and L3(1500)
    expect(l.level).toBe(2);
    expect(l.xpForNextLevel).toBe(1000);
    expect(l.xpIntoLevel).toBe(500);
    expect(l.progress).toBeCloseTo(0.5);
  });

  it('gives higher levels bigger titles', () => {
    // enough XP for a high level via achievements + workouts + volume
    const l = computeLevel(stats({ totalWorkouts: 400, totalVolume: 5_000_000, daysActive: 365 }), 20);
    expect(l.level).toBeGreaterThan(12);
    expect(['Dedicated', 'Seasoned', 'Veteran', 'Titan', 'Mythic']).toContain(l.title);
  });
});
