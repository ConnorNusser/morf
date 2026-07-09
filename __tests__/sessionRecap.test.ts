import { buildSessionRecaps } from '@/lib/history/sessionRecap';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { GeneratedWorkout } from '@/types';

type Ex = { id: string; weight: number; reps: number; sets?: number };

// Multi-exercise workout factory (ISO createdAt, mirroring storage's shape).
function workout(id: string, daysAgo: number, exs: Ex[]): GeneratedWorkout {
  const createdAt = new Date(Date.UTC(2026, 5, 30) - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id,
    title: `W ${id}`,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt,
    exercises: exs.map(({ id: exId, weight, reps, sets = 3 }) => ({
      id: exId,
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
    })),
  } as unknown as GeneratedWorkout;
}

describe('buildSessionRecaps — compact-row payload', () => {
  it('standout is the highest-e1RM set and carries its rounded display e1RM', () => {
    const recaps = buildSessionRecaps(
      [workout('w1', 0, [
        { id: 'bench-press-barbell', weight: 155, reps: 8 },
        { id: 'deadlift-barbell', weight: 225, reps: 5 },
      ])],
      [],
      'lbs',
    );

    const standout = recaps[0].standout;
    expect(standout?.name).toMatch(/deadlift/i);
    expect(standout?.weight).toBe(225);
    expect(standout?.reps).toBe(5);
    expect(standout?.e1rm).toBe(Math.round(OneRMCalculator.estimate(225, 5)));
  });

  it('lineup has one entry per completed exercise (drives the "+N lifts" suffix)', () => {
    const recaps = buildSessionRecaps(
      [workout('w1', 0, [
        { id: 'bench-press-barbell', weight: 155, reps: 8 },
        { id: 'deadlift-barbell', weight: 225, reps: 5 },
        { id: 'row-barbell', weight: 115, reps: 8 },
      ])],
      [],
      'lbs',
    );
    expect(recaps[0].lineup).toHaveLength(3);
  });

  it('converts the standout e1RM into the display unit', () => {
    const recaps = buildSessionRecaps(
      [workout('w1', 0, [{ id: 'deadlift-barbell', weight: 225, reps: 5 }])],
      [],
      'kg',
    );
    const e1rmLbs = OneRMCalculator.estimate(225, 5);
    expect(recaps[0].standout?.e1rm).toBe(Math.round(e1rmLbs / 2.20462));
  });

  it('counts sets for the meta line', () => {
    const recaps = buildSessionRecaps(
      [workout('w1', 0, [{ id: 'deadlift-barbell', weight: 135, reps: 8, sets: 1 }])],
      [],
      'lbs',
    );
    expect(recaps[0].sets).toBe(1);
    expect(recaps[0].lineup).toHaveLength(1);
  });
});
