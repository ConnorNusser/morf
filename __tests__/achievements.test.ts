import { CareerStats } from '../lib/gamification/careerStats';
import {
  Achievement,
  achievementDisplay,
  computeAchievements,
  newlyUnlocked,
  rarityBreakdown,
  summarizeAchievements,
  unlockedIds,
} from '../lib/gamification/achievements';
import { Rarity } from '../lib/gamification/rarity';

function mk(id: string, rarity: Rarity, unlocked: boolean, hidden = false): Achievement {
  return {
    id,
    title: id,
    description: id,
    icon: 'flag',
    category: 'special',
    rarity,
    current: unlocked ? 1 : 0,
    target: 1,
    unlocked,
    progress: unlocked ? 1 : 0,
    hidden,
  };
}

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

describe('funny achievements', () => {
  it('unlocks the meme and silly-count milestones', () => {
    const a = computeAchievements(
      stats({ totalVolume: 9_500, totalSets: 1_200, totalReps: 27_000, daysActive: 220, daysSinceStart: 1_100, biggestSessionVolume: 60_000 }),
      0,
    );
    const by = (id: string) => a.find(x => x.id === id)!;
    expect(by('meme-9000').unlocked).toBe(true);
    expect(by('sets-1000').unlocked).toBe(true);
    expect(by('reps-marathon').unlocked).toBe(true);
    expect(by('days-200').unlocked).toBe(true);
    expect(by('member-1000').unlocked).toBe(true);
    expect(by('session-50k').unlocked).toBe(true);
  });

  it('gates plate milestones on the single heaviest set, fair across units', () => {
    const lbs = computeAchievements(stats({ heaviestSet: { weight: 320, reps: 1, exerciseId: 'x', date: new Date() }, unit: 'lbs' }), 0);
    expect(lbs.find(x => x.id === 'plates-3')?.unlocked).toBe(true); // 320 >= 315
    expect(lbs.find(x => x.id === 'plates-4')?.unlocked).toBe(false); // 320 < 405

    // 150 kg ≈ 330 lbs — should clear the three-plate (315 lbs) milestone.
    const kg = computeAchievements(stats({ heaviestSet: { weight: 150, reps: 1, exerciseId: 'x', date: new Date() }, unit: 'kg' }), 0);
    expect(kg.find(x => x.id === 'plates-3')?.unlocked).toBe(true);
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

describe('rarityBreakdown', () => {
  it('counts unlocked/total per rarity in ascending order', () => {
    const bd = rarityBreakdown([
      mk('a', 'common', true),
      mk('b', 'common', false),
      mk('c', 'rare', true),
      mk('d', 'legendary', false),
    ]);
    expect(bd.map(x => x.rarity)).toEqual(['common', 'rare', 'epic', 'legendary']);
    expect(bd[0]).toMatchObject({ unlocked: 1, total: 2 });
    expect(bd[1]).toMatchObject({ unlocked: 1, total: 1 });
    expect(bd[2]).toMatchObject({ unlocked: 0, total: 0 });
    expect(bd[3]).toMatchObject({ unlocked: 0, total: 1 });
  });
});

describe('hidden / secret badges', () => {
  it('masks a secret locked badge and never teases it as the next goal', () => {
    const secret = mk('secret', 'epic', false, true);
    const open = mk('open', 'rare', false);
    open.progress = 0.9;

    const masked = achievementDisplay(secret);
    expect(masked.masked).toBe(true);
    expect(masked.title).toBe('Secret achievement');

    // A revealed (unlocked) secret shows its real title.
    expect(achievementDisplay(mk('secret', 'epic', true, true)).masked).toBe(false);

    // nextUp prefers the visible locked badge over the closer secret.
    expect(summarizeAchievements([secret, open]).nextUp?.id).toBe('open');
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
