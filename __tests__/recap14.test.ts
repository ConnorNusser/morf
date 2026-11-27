import { computeRecap14 } from '@/lib/history/recap14';
import { e1rmLbs } from '@/lib/data/strengthStandards';
import { convertWeight, LoggedWorkout, WeightUnit } from '@/types';

// Fixed local clock: Thu 26 Nov 2026, 18:00 local.
const NOW = new Date(2026, 10, 26, 18, 0, 0);

type Ex = { id: string; weight: number; reps: number; sets?: number; unit?: WeightUnit; warmup?: boolean };

// Workout `daysAgo` local days before NOW, at 10:00 local.
function workout(id: string, daysAgo: number, exs: Ex[], hour = 10): LoggedWorkout {
  const createdAt = new Date(2026, 10, 26 - daysAgo, hour, 0, 0).toISOString();
  return {
    id,
    title: `W ${id}`,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt,
    exercises: exs.map(({ id: exId, weight, reps, sets = 1, unit = 'lbs', warmup }) => ({
      id: exId,
      sets,
      reps: String(reps),
      isCompleted: true,
      completedSets: Array.from({ length: sets }, (_, i) => ({
        setNumber: i + 1,
        weight,
        reps,
        unit,
        completed: true,
        ...(warmup ? { isWarmup: true } : {}),
      })),
    })),
  } as unknown as LoggedWorkout;
}

const BENCH = 'bench-press-barbell';
const SQUAT = 'squat-barbell';
const DEADLIFT = 'deadlift-barbell';
const ROW = 'row-barbell';

describe('computeRecap14 — days strip', () => {
  it('returns 14 local days, oldest first, ending today', () => {
    const r = computeRecap14([], 'lbs', NOW);
    expect(r.days).toHaveLength(14);
    expect(r.days[13].date).toEqual(new Date(2026, 10, 26));
    expect(r.days[0].date).toEqual(new Date(2026, 10, 13));
    expect(r.days.every(d => d.workouts === 0 && d.volume === 0 && d.split === null)).toBe(true);
  });

  it('buckets workouts by local day with volume and dominant split', () => {
    const r = computeRecap14(
      [
        workout('a', 0, [{ id: BENCH, weight: 100, reps: 10, sets: 3 }]),
        workout('b', 2, [{ id: SQUAT, weight: 200, reps: 5, sets: 2 }]),
        workout('c', 2, [{ id: SQUAT, weight: 100, reps: 5 }], 19),
      ],
      'lbs',
      NOW,
    );
    expect(r.days[13]).toMatchObject({ workouts: 1, volume: 3000, split: 'push' });
    expect(r.days[11]).toMatchObject({ workouts: 2, volume: 2500, split: 'legs' });
    expect(r.days[12]).toMatchObject({ workouts: 0, volume: 0, split: null });
  });

  it('excludes workouts older than the 14-day window from days and totals', () => {
    const r = computeRecap14([workout('old', 14, [{ id: BENCH, weight: 100, reps: 10 }])], 'lbs', NOW);
    expect(r.totals.workouts).toBe(0);
    expect(r.days.every(d => d.workouts === 0)).toBe(true);
  });

  it('converts volume into the display unit', () => {
    const r = computeRecap14([workout('a', 0, [{ id: BENCH, weight: 100, reps: 10 }])], 'kg', NOW);
    expect(r.days[13].volume).toBe(Math.round(convertWeight(1000, 'lbs', 'kg')));
    expect(r.totals.volume).toBe(Math.round(convertWeight(1000, 'lbs', 'kg')));
  });
});

describe('computeRecap14 — totals and delta', () => {
  it('sums workouts, active days, volume and sets', () => {
    const r = computeRecap14(
      [
        workout('a', 0, [{ id: BENCH, weight: 100, reps: 10, sets: 3 }]),
        workout('b', 0, [{ id: ROW, weight: 100, reps: 10, sets: 1 }], 20),
        workout('c', 5, [{ id: SQUAT, weight: 200, reps: 5, sets: 2 }]),
      ],
      'lbs',
      NOW,
    );
    expect(r.totals).toEqual({ workouts: 3, activeDays: 2, volume: 6000, sets: 6 });
  });

  it('deltaVsPrev14 compares against the 14 days before the window', () => {
    const r = computeRecap14(
      [
        workout('now', 1, [{ id: BENCH, weight: 100, reps: 12 }]), // 1200
        workout('prev', 20, [{ id: BENCH, weight: 100, reps: 10 }]), // 1000
        workout('ancient', 40, [{ id: BENCH, weight: 1000, reps: 10 }]), // outside both
      ],
      'lbs',
      NOW,
    );
    expect(r.deltaVsPrev14).toBe(20);
  });

  it('deltaVsPrev14 is null with no prior volume, and negative on a drop', () => {
    expect(computeRecap14([workout('a', 0, [{ id: BENCH, weight: 100, reps: 10 }])], 'lbs', NOW).deltaVsPrev14).toBeNull();
    const drop = computeRecap14(
      [workout('prev', 15, [{ id: BENCH, weight: 100, reps: 10 }]), workout('now', 0, [{ id: BENCH, weight: 50, reps: 10 }])],
      'lbs',
      NOW,
    );
    expect(drop.deltaVsPrev14).toBe(-50);
  });
});

describe('computeRecap14 — mostImproved', () => {
  it('picks the largest % gain and reports display-unit e1RMs', () => {
    const r = computeRecap14(
      [
        workout('b1', 30, [{ id: BENCH, weight: 185, reps: 1 }, { id: SQUAT, weight: 225, reps: 1 }]),
        workout('r1', 3, [{ id: BENCH, weight: 205, reps: 1 }, { id: SQUAT, weight: 235, reps: 1 }]),
      ],
      'lbs',
      NOW,
    );
    expect(r.mostImproved).toEqual({
      exerciseId: BENCH,
      name: expect.stringMatching(/bench/i),
      fromE1rm: 185,
      toE1rm: 205,
      deltaPct: 11,
      deltaAbs: 20,
    });
  });

  it('uses the best e1RM on each side, not the latest set', () => {
    const r = computeRecap14(
      [
        workout('b1', 40, [{ id: BENCH, weight: 200, reps: 1 }]),
        workout('b2', 20, [{ id: BENCH, weight: 180, reps: 1 }]),
        workout('r1', 5, [{ id: BENCH, weight: 220, reps: 1 }]),
        workout('r2', 1, [{ id: BENCH, weight: 190, reps: 1 }]),
      ],
      'lbs',
      NOW,
    );
    expect(r.mostImproved).toMatchObject({ fromE1rm: 200, toE1rm: 220, deltaPct: 10 });
  });

  it('requires the lift in both windows', () => {
    const onlyRecent = computeRecap14([workout('r', 1, [{ id: BENCH, weight: 225, reps: 1 }])], 'lbs', NOW);
    expect(onlyRecent.mostImproved).toBeNull();
    const onlyBaseline = computeRecap14([workout('b', 30, [{ id: BENCH, weight: 225, reps: 1 }])], 'lbs', NOW);
    expect(onlyBaseline.mostImproved).toBeNull();
  });

  it('ignores baseline sessions older than ~90 days before the window', () => {
    const r = computeRecap14(
      [
        workout('stale', 13 + 91, [{ id: BENCH, weight: 135, reps: 1 }]),
        workout('r', 1, [{ id: BENCH, weight: 225, reps: 1 }]),
      ],
      'lbs',
      NOW,
    );
    expect(r.mostImproved).toBeNull();
  });

  it('ignores regressions, tiny absolute gains and light baselines', () => {
    const r = computeRecap14(
      [
        workout('b', 30, [
          { id: BENCH, weight: 225, reps: 1 }, // regresses
          { id: SQUAT, weight: 300, reps: 1 }, // +3 lb: below the 5 lb floor
          { id: 'lateral-raise-dumbbells', weight: 15, reps: 1 }, // 15 → 25: baseline too light
        ]),
        workout('r', 2, [
          { id: BENCH, weight: 215, reps: 1 },
          { id: SQUAT, weight: 303, reps: 1 },
          { id: 'lateral-raise-dumbbells', weight: 25, reps: 1 },
        ]),
      ],
      'lbs',
      NOW,
    );
    expect(r.mostImproved).toBeNull();
  });

  it('ignores bodyweight-only and timed exercises', () => {
    const r = computeRecap14(
      [
        workout('b', 30, [
          { id: 'pull-up-bodyweight', weight: 45, reps: 5 },
          { id: 'plank-bodyweight', weight: 45, reps: 1 },
        ]),
        workout('r', 2, [
          { id: 'pull-up-bodyweight', weight: 90, reps: 5 },
          { id: 'plank-bodyweight', weight: 90, reps: 1 },
        ]),
      ],
      'lbs',
      NOW,
    );
    expect(r.mostImproved).toBeNull();
  });

  it('ignores warmup and zero-weight sets', () => {
    const r = computeRecap14(
      [
        workout('b', 30, [{ id: BENCH, weight: 185, reps: 1 }]),
        workout('r', 2, [
          { id: BENCH, weight: 315, reps: 1, warmup: true },
          { id: BENCH, weight: 0, reps: 20 },
        ]),
      ],
      'lbs',
      NOW,
    );
    expect(r.mostImproved).toBeNull();
  });

  it('breaks % ties by the larger absolute gain', () => {
    const r = computeRecap14(
      [
        workout('b', 30, [{ id: BENCH, weight: 200, reps: 1 }, { id: DEADLIFT, weight: 400, reps: 1 }]),
        workout('r', 2, [{ id: BENCH, weight: 220, reps: 1 }, { id: DEADLIFT, weight: 440, reps: 1 }]),
      ],
      'lbs',
      NOW,
    );
    expect(r.mostImproved).toMatchObject({ exerciseId: DEADLIFT, deltaPct: 10, deltaAbs: 40 });
  });

  it('compares across units via lbs and reports in the display unit', () => {
    const r = computeRecap14(
      [
        workout('b', 30, [{ id: BENCH, weight: 100, reps: 1, unit: 'kg' }]),
        workout('r', 2, [{ id: BENCH, weight: 242.5, reps: 1, unit: 'lbs' }]),
      ],
      'kg',
      NOW,
    );
    const fromLbs = e1rmLbs(100, 1, 'kg');
    expect(r.mostImproved).toMatchObject({
      exerciseId: BENCH,
      fromE1rm: Math.round(convertWeight(fromLbs, 'lbs', 'kg')),
      toE1rm: Math.round(convertWeight(242.5, 'lbs', 'kg')),
    });
    expect(r.mostImproved!.deltaPct).toBe(Math.round(((242.5 - fromLbs) / fromLbs) * 100));
  });

  it('estimates e1RM from rep sets (same estimator as the rest of the app)', () => {
    const r = computeRecap14(
      [workout('b', 30, [{ id: BENCH, weight: 155, reps: 8 }]), workout('r', 2, [{ id: BENCH, weight: 165, reps: 8 }])],
      'lbs',
      NOW,
    );
    expect(r.mostImproved).toMatchObject({
      fromE1rm: Math.round(e1rmLbs(155, 8, 'lbs')),
      toE1rm: Math.round(e1rmLbs(165, 8, 'lbs')),
    });
  });
});
