import { computeXpLedger, XP_RULES } from '@/lib/gamification/xp';
import { Achievement } from '@/lib/gamification/achievements';
import { LoggedWorkout } from '@/types';

type Ex = { id: string; weight?: number; reps?: number; sets?: number; warmups?: number };

// Local-time dates: 2026-06-01 is a Monday.
function workout(id: string, day: number, exs: Ex[], month = 5): LoggedWorkout {
  return {
    id,
    title: id,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt: new Date(2026, month, day, 12).toISOString(),
    exercises: exs.map(({ id: exId, weight = 100, reps = 8, sets = 3, warmups = 0 }) => ({
      id: exId,
      sets,
      reps: String(reps),
      isCompleted: true,
      completedSets: [
        ...Array.from({ length: warmups }, (_, i) => ({ setNumber: i + 1, weight: 45, reps: 10, unit: 'lbs', completed: true, isWarmup: true })),
        ...Array.from({ length: sets }, (_, i) => ({ setNumber: warmups + i + 1, weight, reps, unit: 'lbs', completed: true })),
      ],
    })),
  } as unknown as LoggedWorkout;
}

const curl = (sets = 3): Ex => ({ id: 'bicep-curl-dumbbells', weight: 30, reps: 10, sets });

describe('computeXpLedger', () => {
  it('pays workout + per-set XP for a normal session', () => {
    const ledger = computeXpLedger([workout('a', 1, [curl(6)])], { weeklyGoal: 7 });
    expect(ledger.workouts[0]).toMatchObject({ base: 50, sets: 30, prs: 0, multiplier: 1, total: 80 });
    expect(ledger.totalXp).toBe(80);
  });

  it('ignores warmups and gives no completion XP under 3 working sets', () => {
    const w = computeXpLedger([workout('a', 1, [{ ...curl(2), warmups: 4 }])], { weeklyGoal: 7 }).workouts[0];
    expect(w.base).toBe(0);
    expect(w.sets).toBe(10);
  });

  it('caps per-set XP at 30 sets', () => {
    const w = computeXpLedger([workout('a', 1, [curl(50)])], { weeklyGoal: 7 }).workouts[0];
    expect(w.sets).toBe(XP_RULES.maxSetsPerWorkout * XP_RULES.perSet);
  });

  it('pays PRs only when beating a previous best on a featured lift, capped at 3', () => {
    const lifts = ['bench-press-barbell', 'squat-barbell', 'deadlift-barbell', 'overhead-press-barbell'];
    const first = workout('a', 1, lifts.map(id => ({ id, weight: 100 })));
    const second = workout('b', 3, lifts.map(id => ({ id, weight: 110 })));
    const third = workout('c', 5, [{ id: 'bicep-curl-dumbbells', weight: 999 }]); // not featured → no PR
    const ledger = computeXpLedger([second, first, third], { weeklyGoal: 7 }); // order-independent
    expect(ledger.workouts.map(w => w.prCount)).toEqual([0, 3, 0]);
    expect(ledger.workouts[1].prs).toBe(3 * XP_RULES.pr);
  });

  it('grows the streak multiplier per consecutive week and resets after a gap', () => {
    const ws = [
      workout('w1', 1, [curl()]),
      workout('w2', 8, [curl()]),
      workout('w3', 15, [curl()]),
      workout('w5', 29, [curl()]), // skipped the week of the 22nd
    ];
    expect(computeXpLedger(ws, { weeklyGoal: 7 }).workouts.map(w => w.multiplier)).toEqual([1, 1.05, 1.1, 1]);
  });

  it('caps the streak multiplier', () => {
    const ws = Array.from({ length: 20 }, (_, i) => workout(`w${i}`, 1 + i * 7, [curl()]));
    const last = computeXpLedger(ws, { weeklyGoal: 7 }).workouts.at(-1)!;
    expect(last.multiplier).toBe(XP_RULES.streakCap);
  });

  it('pays the weekly goal once, on the session that reaches it, counting distinct days', () => {
    const ws = [
      workout('mon', 1, [curl()]),
      workout('mon2', 1, [curl()]), // same day: doesn't count toward the goal
      workout('tue', 2, [curl()]),
      workout('wed', 3, [curl()]),
    ];
    const goals = computeXpLedger(ws, { weeklyGoal: 2 }).workouts.map(w => w.weeklyGoal);
    expect(goals).toEqual([0, 0, XP_RULES.weeklyGoal, 0]);
  });

  it('pays tier-ups after the first tier, on the day they happened', () => {
    const ws = [workout('a', 1, [curl()]), workout('b', 3, [curl()])];
    const timeline = [
      { tier: 'C' as const, percentile: 31, date: new Date(2026, 5, 1, 12) },
      { tier: 'C+' as const, percentile: 40, date: new Date(2026, 5, 3, 12) },
    ];
    const ledger = computeXpLedger(ws, { weeklyGoal: 7, tierTimeline: timeline });
    expect(ledger.workouts.map(w => w.tierUp)).toEqual([0, XP_RULES.tierUp]);
  });

  it('adds achievement XP by rarity for unlocked achievements only', () => {
    const ach = (rarity: Achievement['rarity'], unlocked: boolean) => ({ rarity, unlocked }) as Achievement;
    const ledger = computeXpLedger([], {
      achievements: [ach('common', true), ach('legendary', true), ach('epic', false)],
    });
    expect(ledger.achievementXp).toBe(225);
    expect(ledger.totalXp).toBe(225);
  });

  it('is deterministic: retroactive XP equals summing sessions one at a time', () => {
    const ws = [workout('a', 1, [curl(5)]), workout('b', 2, [curl(4)]), workout('c', 9, [curl(8)])];
    const full = computeXpLedger(ws, { weeklyGoal: 2 }).totalXp;
    let prev = 0;
    let summed = 0;
    for (let i = 1; i <= ws.length; i++) {
      const t = computeXpLedger(ws.slice(0, i), { weeklyGoal: 2 }).totalXp;
      summed += t - prev;
      prev = t;
    }
    expect(summed).toBe(full);
  });
});
