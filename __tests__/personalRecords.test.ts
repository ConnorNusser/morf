import { GeneratedWorkout } from '../types';
import { computeMainLiftPRs } from '../lib/gamification/personalRecords';

function liftWorkout(date: Date, exerciseId: string, weight: number, reps: number, unit: 'lbs' | 'kg' = 'lbs'): GeneratedWorkout {
  return {
    id: date.toISOString() + exerciseId,
    title: 'w',
    exercises: [
      {
        id: exerciseId,
        sets: 1,
        reps: '',
        isCompleted: true,
        completedSets: [{ setNumber: 1, weight, reps, unit, completed: true }],
      },
    ],
    createdAt: date,
  } as unknown as GeneratedWorkout;
}

const day = (n: number) => new Date(2026, 0, n, 18, 0, 0);

describe('computeMainLiftPRs', () => {
  it('returns nothing without main-lift data', () => {
    expect(computeMainLiftPRs([liftWorkout(day(1), 'lateral-raise', 20, 12)], 'lbs')).toEqual([]);
  });

  it('keeps the best estimated 1RM per main lift, with its set + date', () => {
    const prs = computeMainLiftPRs(
      [
        liftWorkout(day(1), 'bench-press-barbell', 185, 5),
        liftWorkout(day(2), 'bench-press-barbell', 225, 1), // higher e1RM
        liftWorkout(day(3), 'bench-press-barbell', 135, 10), // e1RM ~180, not a PR
        liftWorkout(day(1), 'squat-barbell', 315, 3),
      ],
      'lbs',
    );
    const bench = prs.find(p => p.exerciseId === 'bench-press-barbell')!;
    expect(bench.topWeight).toBe(225);
    expect(bench.topReps).toBe(1);
    expect(bench.date.getDate()).toBe(2);
    expect(bench.estimatedOneRM).toBeGreaterThanOrEqual(225);
    // both lifts present, in canonical order (squat before bench)
    expect(prs.map(p => p.exerciseId)).toEqual(['squat-barbell', 'bench-press-barbell']);
  });

  it('converts kg to the preferred unit', () => {
    const prs = computeMainLiftPRs([liftWorkout(day(1), 'deadlift-barbell', 100, 1, 'kg')], 'lbs');
    expect(prs[0].topWeight).toBeGreaterThan(200); // 100kg ~ 220 lbs
  });
});
