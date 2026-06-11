import { CareerStats } from '../lib/gamification/careerStats';
import {
  computeAchievements,
  newlyUnlocked,
  summarizeAchievements,
  unlockedIds,
} from '../lib/gamification/achievements';

function stats(partial: Partial<CareerStats>): CareerStats {
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
    ...partial,
  };
}

describe('computeAchievements', () => {
  it('locks everything for a fresh account', () => {
    const a = computeAchievements(stats({}), 0);
    expect(a.every(x => !x.unlocked)).toBe(true);
    expect(a.find(x => x.id === 'first-workout')?.progress).toBe(0);
  });

  it('unlocks milestones once thresholds are met', () => {
    const a = computeAchievements(stats({ totalWorkouts: 60, longestStreak: 8, totalVolume: 1_200_000 }), 58);
    const by = (id: string) => a.find(x => x.id === id)!;
    expect(by('first-workout').unlocked).toBe(true);
    expect(by('workouts-50').unlocked).toBe(true);
    expect(by('workouts-100').unlocked).toBe(false);
    expect(by('streak-7').unlocked).toBe(true);
    expect(by('streak-14').unlocked).toBe(false);
    expect(by('volume-1m').unlocked).toBe(true);
    expect(by('tier-b').unlocked).toBe(true); // 58 >= 55
    expect(by('tier-a').unlocked).toBe(false);
  });

  it('reports partial progress, clamped to 1', () => {
    const a = computeAchievements(stats({ totalWorkouts: 5 }), 0);
    expect(a.find(x => x.id === 'workouts-10')?.progress).toBeCloseTo(0.5);
    const done = computeAchievements(stats({ totalWorkouts: 999 }), 0);
    expect(done.find(x => x.id === 'first-workout')?.progress).toBe(1);
  });
});

describe('summarizeAchievements', () => {
  it('counts unlocked and picks the nearest next goal', () => {
    const a = computeAchievements(stats({ totalWorkouts: 9, longestStreak: 1, totalVolume: 0 }), 0);
    const s = summarizeAchievements(a);
    expect(s.unlockedCount).toBe(1); // first-workout
    expect(s.total).toBe(a.length);
    // workouts-10 is at 9/10 = 0.9 progress — the closest locked one
    expect(s.nextUp?.id).toBe('workouts-10');
  });
});

describe('newlyUnlocked / unlockedIds', () => {
  it('lists unlocked ids and the subset not yet seen', () => {
    const a = computeAchievements(stats({ totalWorkouts: 12 }), 0);
    const ids = unlockedIds(a);
    expect(ids).toEqual(expect.arrayContaining(['first-workout', 'workouts-10']));
    // first-workout already seen -> only workouts-10 is "new"
    const fresh = newlyUnlocked(a, ['first-workout']);
    expect(fresh.map(x => x.id)).toEqual(['workouts-10']);
    // everything seen -> nothing new
    expect(newlyUnlocked(a, ids)).toEqual([]);
  });
});
