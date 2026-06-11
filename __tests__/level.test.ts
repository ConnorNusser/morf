import { CareerStats } from '../lib/gamification/careerStats';
import { computeLevel, totalXp, workoutXp } from '../lib/gamification/level';

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
    // 10 workouts (600) + 100k volume (1250) + 20 days (500) + 3 achievements (750)
    expect(totalXp(stats({ totalWorkouts: 10, totalVolume: 100_000, daysActive: 20 }), 3)).toBe(3100);
  });

  it('normalizes kg volume to lbs', () => {
    const inKg = totalXp(stats({ totalVolume: 45_360, unit: 'kg' }), 0); // ~100k lbs
    const inLbs = totalXp(stats({ totalVolume: 100_000, unit: 'lbs' }), 0);
    expect(Math.abs(inKg - inLbs)).toBeLessThan(50);
  });
});

describe('workoutXp', () => {
  it('is the workout bonus plus volume contribution', () => {
    expect(workoutXp(0)).toBe(60); // bonus only
    expect(workoutXp(8_000)).toBe(160); // 60 + 8000/80
  });

  it('never goes negative on bad input', () => {
    expect(workoutXp(-500)).toBe(60);
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

  it('levels up on the widening curve', () => {
    // cumulative XP: L2=200, L3=600, L4=1200. Volume XP = volume / 80.
    expect(computeLevel(stats({ totalVolume: 16_000 }), 0).level).toBe(2); // 200 xp
    expect(computeLevel(stats({ totalVolume: 47_900 }), 0).level).toBe(2); // 599 xp -> still L2
    expect(computeLevel(stats({ totalVolume: 48_000 }), 0).level).toBe(3); // 600 xp -> L3
  });

  it('reports progress within a level (0..1) and a sane span', () => {
    const l = computeLevel(stats({ totalVolume: 32_000 }), 0); // 400 xp, between L2(200) and L3(600)
    expect(l.level).toBe(2);
    expect(l.xpForNextLevel).toBe(400);
    expect(l.xpIntoLevel).toBe(200);
    expect(l.progress).toBeCloseTo(0.5);
  });

  it('gives higher levels bigger titles', () => {
    // enough XP for a high level via achievements + workouts + volume
    const l = computeLevel(stats({ totalWorkouts: 400, totalVolume: 5_000_000, daysActive: 365 }), 20);
    expect(l.level).toBeGreaterThan(12);
    expect(['Dedicated', 'Seasoned', 'Veteran', 'Titan', 'Mythic']).toContain(l.title);
  });
});
