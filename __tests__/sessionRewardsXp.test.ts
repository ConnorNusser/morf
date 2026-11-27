import { buildRewardSnapshot, computeSessionRewards } from '@/lib/gamification/sessionRewards';
import { LoggedWorkout } from '@/types';

const NOW = new Date(2026, 5, 30, 12);

function workout(id: string, daysAgo: number, exId: string, weight: number, sets = 5): LoggedWorkout {
  return {
    id,
    title: id,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    exercises: [{
      id: exId,
      sets,
      reps: '5',
      isCompleted: true,
      completedSets: Array.from({ length: sets }, (_, i) => ({ setNumber: i + 1, weight, reps: 5, unit: 'lbs', completed: true })),
    }],
  } as unknown as LoggedWorkout;
}

const ctx = { unit: 'lbs' as const, overall: 0, bodyWeightLbs: 180, weeklyGoal: 7, gender: 'male' as const, age: 30, now: NOW };

describe('session rewards: XP, level and region tier-ups', () => {
  it('reports XP gained as the snapshot difference', () => {
    const before = [workout('a', 3, 'bench-press-barbell', 135)];
    const after = [...before, workout('b', 0, 'bench-press-barbell', 135)];
    const r = computeSessionRewards(buildRewardSnapshot(before, ctx), buildRewardSnapshot(after, ctx));
    expect(r.xpGained).toBe(r.levelAfter.totalXp - r.levelBefore.totalXp);
    expect(r.xpGained).toBeGreaterThanOrEqual(75); // 50 workout + 5 sets × 5
  });

  it('flags a level-up when a level boundary is crossed', () => {
    const r = computeSessionRewards(buildRewardSnapshot([], ctx), buildRewardSnapshot([workout('a', 0, 'bench-press-barbell', 135, 30)], ctx));
    expect(r.levelBefore.level).toBe(1);
    expect(r.leveledUp).toBe(r.levelAfter.level > 1);
    expect(r.leveledUp).toBe(true);
  });

  it("exposes the new session's XP row and achievement XP for the breakdown", () => {
    const before = [workout('a', 3, 'bench-press-barbell', 135)];
    const after = [...before, workout('b', 0, 'bench-press-barbell', 155)];
    const r = computeSessionRewards(buildRewardSnapshot(before, ctx), buildRewardSnapshot(after, ctx));
    expect(r.sessionXp?.workoutId).toBe('b');
    expect(r.sessionXp?.base).toBe(50);
    expect(r.sessionXp?.prCount).toBe(1);
    expect(r.achievementXpGained).toBeGreaterThanOrEqual(0);
    expect(r.sessionXp!.total + r.achievementXpGained).toBe(r.xpGained);
  });

  it('has no session row when no workout was added', () => {
    const h = [workout('a', 0, 'bench-press-barbell', 135)];
    const r = computeSessionRewards(buildRewardSnapshot(h, ctx), buildRewardSnapshot(h, ctx));
    expect(r.sessionXp).toBeUndefined();
    expect(r.xpGained).toBe(0);
  });

  it('lists newly ranked and promoted regions', () => {
    const before = [workout('a', 3, 'bench-press-barbell', 135)];
    const after = [...before, workout('b', 0, 'bench-press-barbell', 275), workout('c', 0, 'squat-barbell', 225)];
    const ups = computeSessionRewards(buildRewardSnapshot(before, ctx), buildRewardSnapshot(after, ctx)).regionTierUps;
    const chest = ups.find(u => u.region === 'chest');
    expect(chest?.from).not.toBeNull();
    expect(ups.find(u => u.region === 'quads')?.from).toBeNull();
  });

  it('omits region tiers without gender, but still computes XP', () => {
    const snap = buildRewardSnapshot([workout('a', 0, 'bench-press-barbell', 135)], { ...ctx, gender: undefined });
    expect(snap.regionTiers).toEqual({});
    expect(snap.xp.totalXp).toBeGreaterThan(0);
  });
});
