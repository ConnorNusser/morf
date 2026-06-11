import { GeneratedWorkout } from '../types';
import { computeTierTimeline, getTierBandProgress, getTierLadder } from '../lib/gamification/tierTimeline';
import { getStrengthTier, TIER_THRESHOLDS } from '../lib/data/strengthStandards';

function benchWorkout(date: Date, weightLbs: number, reps: number): GeneratedWorkout {
  return {
    id: date.toISOString(),
    title: 'w',
    exercises: [
      {
        id: 'bench-press-barbell',
        sets: 1,
        reps: '',
        isCompleted: true,
        completedSets: [{ setNumber: 1, weight: weightLbs, reps, unit: 'lbs', completed: true }],
      },
    ],
    createdAt: date,
  } as unknown as GeneratedWorkout;
}

const PROFILE = { bodyWeightLbs: 180, gender: 'male' as const, age: 30 };
const day = (n: number) => new Date(2026, 0, n, 18, 0, 0);

describe('computeTierTimeline', () => {
  it('returns no milestones without bodyweight', () => {
    expect(computeTierTimeline([benchWorkout(day(1), 135, 5)], { bodyWeightLbs: 0, gender: 'male' })).toEqual([]);
  });

  it('returns no milestones with no main-lift data', () => {
    const accessory = {
      id: 'lateral-raise',
      sets: 1,
      reps: '',
      isCompleted: true,
      completedSets: [{ setNumber: 1, weight: 20, reps: 12, unit: 'lbs', completed: true }],
    };
    const w = { id: 'x', title: 'w', exercises: [accessory], createdAt: day(1) } as unknown as GeneratedWorkout;
    expect(computeTierTimeline([w], PROFILE)).toEqual([]);
  });

  it('emits chronological, strictly-increasing tier milestones as the lift grows', () => {
    const workouts = [
      benchWorkout(day(1), 95, 5),
      benchWorkout(day(2), 135, 5),
      benchWorkout(day(3), 185, 5),
      benchWorkout(day(4), 245, 3),
      benchWorkout(day(5), 315, 1),
    ];
    const timeline = computeTierTimeline(workouts, PROFILE);
    // 95 -> 315 lbs bench for a 180 lb male crosses multiple tiers.
    expect(timeline.length).toBeGreaterThanOrEqual(2);
    // dates ascend
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].date.getTime()).toBeGreaterThanOrEqual(timeline[i - 1].date.getTime());
    }
    // tiers strictly improve (percentile non-decreasing across milestones)
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].percentile).toBeGreaterThan(timeline[i - 1].percentile);
    }
    // last milestone's tier matches the tier of its percentile
    const last = timeline[timeline.length - 1];
    expect(last.tier).toBe(getStrengthTier(last.percentile));
  });

  it('honors a custom lift set (e.g. the dashboard featured lifts)', () => {
    // A secondary lift is ignored under the default (main-lift) set...
    const secondary = benchWorkout(day(1), 185, 5);
    secondary.exercises[0].id = 'row-barbell';
    expect(computeTierTimeline([secondary], PROFILE)).toEqual([]);
    // ...but counts when included in the lift set.
    expect(computeTierTimeline([secondary], PROFILE, ['row-barbell']).length).toBeGreaterThan(0);
  });

  it('ignores regressions (a lighter later session does not add a milestone)', () => {
    const workouts = [benchWorkout(day(1), 315, 1), benchWorkout(day(2), 95, 5)];
    const timeline = computeTierTimeline(workouts, PROFILE);
    expect(timeline.length).toBe(1);
    expect(timeline[0].date.getDate()).toBe(1);
  });
});

describe('getTierBandProgress', () => {
  it('reports the next tier, distance, and band progress', () => {
    // B = [55,63); at 58 -> 3/8 of the way to B+ (63)
    const b = getTierBandProgress(58);
    expect(b.tier).toBe('B');
    expect(b.nextTier).toBe('B+');
    expect(b.toNext).toBe(5); // 63 - 58
    expect(b.progress).toBeCloseTo((58 - 55) / (63 - 55));
  });

  it('caps out at the top tier', () => {
    const s = getTierBandProgress(100);
    expect(s.tier).toBe('S++');
    expect(s.nextTier).toBeNull();
    expect(s.toNext).toBe(0);
    expect(s.progress).toBe(1);
  });
});

describe('getTierLadder', () => {
  it('has every tier, ordered worst to best, with the current one flagged', () => {
    const ladder = getTierLadder(58); // B tier
    expect(ladder.length).toBe(TIER_THRESHOLDS.length);
    expect(ladder[0].threshold).toBeLessThan(ladder[ladder.length - 1].threshold); // ascending
    const current = ladder.filter(r => r.current);
    expect(current.length).toBe(1);
    expect(current[0].tier).toBe(getStrengthTier(58));
    // everything at/below current percentile is reached
    expect(ladder.find(r => r.tier === 'E-')?.reached).toBe(true);
    expect(ladder.find(r => r.tier === 'S++')?.reached).toBe(false);
  });
});
