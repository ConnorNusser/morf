import { getLastSetsFor } from '../lib/workout/autofill';
import { GeneratedWorkout } from '../types';

function workout(createdAt: Date, exId: string, sets: [number, number][]): GeneratedWorkout {
  return {
    id: createdAt.toISOString(),
    title: 'w',
    description: '',
    estimatedDuration: 60,
    difficulty: 'medium',
    createdAt,
    exercises: [
      {
        id: exId,
        sets: sets.length,
        reps: '',
        isCompleted: true,
        completedSets: sets.map(([weight, reps], i) => ({ setNumber: i + 1, weight, reps, unit: 'lbs' as const, completed: true })),
      },
    ],
  } as unknown as GeneratedWorkout;
}

describe('getLastSetsFor', () => {
  const history = [
    workout(new Date(2026, 5, 1), 'bench-press-barbell', [[135, 8], [145, 6]]),
    workout(new Date(2026, 5, 8), 'bench-press-barbell', [[140, 8], [150, 6]]), // most recent
    workout(new Date(2026, 5, 5), 'squat-barbell', [[225, 5]]),
  ];

  it('returns the most recent completed sets for the exercise', () => {
    expect(getLastSetsFor('bench-press-barbell', history, 'lbs')).toEqual([
      { weight: 140, reps: 8, unit: 'lbs' },
      { weight: 150, reps: 6, unit: 'lbs' },
    ]);
  });

  it('returns null when the exercise has never been trained', () => {
    expect(getLastSetsFor('deadlift-barbell', history, 'lbs')).toBeNull();
  });

  it('converts stored sets into the preferred unit', () => {
    const out = getLastSetsFor('squat-barbell', history, 'kg');
    expect(out).not.toBeNull();
    expect(out![0].unit).toBe('kg');
    expect(out![0].weight).toBeGreaterThan(90); // 225 lb ≈ 102 kg, rounded
    expect(out![0].weight).toBeLessThan(110);
  });
});
