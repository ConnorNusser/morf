import { computeNextUnlocks } from '@/lib/gamification/nextUnlocks';
import { buildRewardSnapshot, computeSessionRewards } from '@/lib/gamification/sessionRewards';
import { getStreakShields, MAX_SHIELDS } from '@/lib/workout/streak';
import { Achievement } from '@/lib/gamification/achievements';
import { GeneratedWorkout } from '@/types';

// Tuesday, local time — so "this week" is in progress and Monday math is exercised.
const NOW = new Date(2026, 5, 30, 12, 0, 0);

// One workout on the given local date: `sets` completed sets of weight×reps.
function workout(id: string, date: Date, weight = 100, reps = 8, sets = 3): GeneratedWorkout {
  return {
    id,
    title: `W ${id}`,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt: date.toISOString(),
    exercises: [
      {
        id: 'bench-press-barbell',
        sets,
        reps: String(reps),
        isCompleted: true,
        completedSets: Array.from({ length: sets }, (_, i) => ({
          setNumber: i + 1,
          weight,
          reps,
          unit: 'lbs' as const,
          completed: true,
        })),
      },
    ],
  } as unknown as GeneratedWorkout;
}

// A workout `weeksAgo` Mondays back from NOW's week (Wednesday of that week).
function weeklyWorkout(weeksAgo: number, weight = 100): GeneratedWorkout {
  const d = new Date(NOW);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday of this week
  d.setDate(d.getDate() - weeksAgo * 7 + 2);
  d.setHours(10, 0, 0, 0);
  if (weeksAgo === 0) d.setDate(d.getDate() - 2); // keep week-0 sessions ≤ NOW (Tuesday)
  return workout(`wk-${weeksAgo}-${weight}`, d, weight);
}

describe('getStreakShields', () => {
  it('banks a shield every 4 consecutive trained weeks, capped', () => {
    const four = [4, 3, 2, 1].map(w => weeklyWorkout(w));
    expect(getStreakShields(four, NOW)).toMatchObject({
      current: 4,
      shieldsAvailable: 1,
      weeksToNextShield: 4,
    });

    const twelve = Array.from({ length: 12 }, (_, i) => weeklyWorkout(i + 1));
    expect(getStreakShields(twelve, NOW).shieldsAvailable).toBe(MAX_SHIELDS);
  });

  it('spends a shield to bridge a single empty week, keeping the streak', () => {
    // 4 trained, 1 empty (bridged), then trained this week.
    const history = [[5, 4, 3, 2].map(w => weeklyWorkout(w)), [weeklyWorkout(0)]].flat();
    expect(getStreakShields(history, NOW)).toMatchObject({
      current: 6, // 5 trained + 1 saved
      shieldsAvailable: 0,
      savedWeeks: 1,
      savedLastWeek: true, // the bridged week was last week — the save gets celebrated
    });
  });

  it('breaks on two consecutive empty weeks regardless of bank', () => {
    const history = [[6, 5, 4, 3].map(w => weeklyWorkout(w)), [weeklyWorkout(0)]].flat();
    expect(getStreakShields(history, NOW)).toMatchObject({
      current: 1,
      shieldsAvailable: 0,
      savedWeeks: 0,
    });
  });

  it('never spends a shield on the in-progress week', () => {
    const history = [4, 3, 2, 1].map(w => weeklyWorkout(w)); // nothing this week yet
    expect(getStreakShields(history, NOW)).toMatchObject({
      current: 4,
      shieldsAvailable: 1,
      trainedThisWeek: false,
    });
  });
});

describe('session bonuses via computeSessionRewards', () => {
  const ctx = { unit: 'lbs' as const, overall: 0, bodyWeightLbs: 180, now: NOW };

  it('fires biggest-session and heaviest-set on true all-time bests only', () => {
    const d1 = new Date(2026, 5, 1);
    const d2 = new Date(2026, 5, 15);
    const beforeHist = [workout('a', d1, 100)];
    const afterHist = [...beforeHist, workout('b', d2, 150, 8, 5)];
    const rewards = computeSessionRewards(
      buildRewardSnapshot(beforeHist, ctx),
      buildRewardSnapshot(afterHist, ctx)
    );
    const ids = rewards.bonuses.map(b => b.id);
    expect(ids).toContain('biggest-session');
    expect(rewards.hasRewards).toBe(true);

    // First-ever workout has no prior best to beat — no bonus, no false hype.
    const first = computeSessionRewards(
      buildRewardSnapshot([], ctx),
      buildRewardSnapshot(beforeHist, ctx)
    );
    expect(first.bonuses.map(b => b.id)).not.toContain('biggest-session');
  });

  it('caps at two bonuses per session', () => {
    // New biggest session + heaviest set + 3-day record all at once.
    const days = [3, 2, 1].map(n => {
      const d = new Date(NOW);
      d.setDate(d.getDate() - n);
      return d;
    });
    const beforeHist = [workout('a', days[0], 100), workout('b', days[1], 100)];
    const afterHist = [...beforeHist, workout('c', days[2], 200, 10, 8)];
    const rewards = computeSessionRewards(
      buildRewardSnapshot(beforeHist, ctx),
      buildRewardSnapshot(afterHist, ctx)
    );
    expect(rewards.bonuses.length).toBeLessThanOrEqual(2);
  });
});

describe('computeNextUnlocks', () => {
  const ach = (id: string, progress: number, over: Partial<Achievement> = {}): Achievement => ({
    id,
    title: id,
    description: '',
    icon: 'flame',
    category: 'volume',
    rarity: 'rare',
    current: progress * 100,
    target: 100,
    unlocked: false,
    progress,
    ...over,
  });

  it('returns the closest visible locked achievements, nearest first', () => {
    const list = [
      ach('low', 0.2), // below threshold — a bar at 20% demotivates
      ach('mid', 0.6),
      ach('near', 0.97),
      ach('secret', 0.9, { hidden: true }), // hidden stays a surprise
      ach('done', 1, { unlocked: true }),
    ];
    const next = computeNextUnlocks(list);
    expect(next.map(n => n.id)).toEqual(['near', 'mid']);
    expect(next[0].percentLabel).toBe('97%');
  });
});
