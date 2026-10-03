import {
  buildRoutineProgressList,
  computeMuscleBalance,
  getStatusLabel,
  summarizeRoutineProgress,
} from '@/lib/history/routineProgress';
import type { CalculatedRoutine, LoggedWorkout } from '@/types';

const BENCH = 'bench-press-barbell';
const SQUAT = 'squat-barbell';

type Set = { weight: number; completed?: boolean };

// Explicit ISO dates only — nothing here reads the real clock.
const session = (
  id: string,
  routineId: string | undefined,
  createdAt: string,
  exs: { id: string; sets: Set[] }[]
): LoggedWorkout =>
  ({
    id,
    title: id,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt,
    routineId,
    exercises: exs.map(ex => ({
      id: ex.id,
      sets: ex.sets.length,
      reps: '8',
      isCompleted: true,
      completedSets: ex.sets.map((s, i) => ({
        setNumber: i + 1,
        weight: s.weight,
        reps: 8,
        unit: 'lbs' as const,
        completed: s.completed ?? true,
      })),
    })),
  }) as unknown as LoggedWorkout;

const routine = (
  id: string,
  exs: { exerciseId: string; progression: 'increase' | 'maintain' | 'decrease'; workingWeight?: number }[]
): CalculatedRoutine =>
  ({
    id,
    name: `Routine ${id}`,
    createdAt: new Date('2026-01-01'),
    exercises: exs.map(e => ({
      exerciseId: e.exerciseId,
      exerciseName: e.exerciseId,
      sets: [],
      workingWeight: e.workingWeight ?? 0,
      progression: e.progression,
      unit: 'lbs',
    })),
  }) as unknown as CalculatedRoutine;

describe('buildRoutineProgressList', () => {
  it('builds oldest→newest top-weight history from this routine only', () => {
    const history = [
      session('w3', 'push', '2026-06-20T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 145 }, { weight: 150 }] }]),
      session('other', 'legs', '2026-06-15T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 300 }] }]),
      session('w1', 'push', '2026-06-01T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 135 }, { weight: 130 }] }]),
      session('free', undefined, '2026-06-10T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 400 }] }]),
    ];
    const [push] = buildRoutineProgressList([routine('push', [{ exerciseId: BENCH, progression: 'increase' }])], history);

    expect(push.completions).toBe(2);
    expect(push.lastWorkoutDate).toEqual(new Date('2026-06-20T10:00:00.000Z'));
    expect(push.exercises[0].weightHistory).toEqual([
      { weight: 135, date: new Date('2026-06-01T10:00:00.000Z'), sessionNumber: 1 },
      { weight: 150, date: new Date('2026-06-20T10:00:00.000Z'), sessionNumber: 2 },
    ]);
    expect(push.exercises[0].startWeight).toBe(135);
    expect(push.exercises[0].currentWeight).toBe(150);
    expect(push.exercises[0].repBonus).toBe(0);
  });

  it('skips sessions with no completed weighted sets without consuming a session number', () => {
    const history = [
      session('w1', 'push', '2026-06-01T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 135 }] }]),
      session('w2', 'push', '2026-06-08T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 140, completed: false }, { weight: 0 }] }]),
      session('w3', 'push', '2026-06-15T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 140 }] }]),
    ];
    const [push] = buildRoutineProgressList([routine('push', [{ exerciseId: BENCH, progression: 'maintain' }])], history);

    // Completions count every routine session; the chart only numbers readable ones.
    expect(push.completions).toBe(3);
    expect(push.exercises[0].weightHistory.map(p => [p.sessionNumber, p.weight])).toEqual([[1, 135], [2, 140]]);
  });

  it('maps the engine progression to a status and counts each bucket', () => {
    const history = [
      session('w1', 'full', '2026-06-01T10:00:00.000Z', [
        { id: BENCH, sets: [{ weight: 135 }] },
        { id: SQUAT, sets: [{ weight: 225 }] },
        { id: 'deadlift-barbell', sets: [{ weight: 315 }] },
      ]),
    ];
    const [full] = buildRoutineProgressList(
      [routine('full', [
        { exerciseId: BENCH, progression: 'increase' },
        { exerciseId: SQUAT, progression: 'maintain' },
        { exerciseId: 'deadlift-barbell', progression: 'decrease' },
        { exerciseId: 'pull-up-bodyweight', progression: 'increase', workingWeight: 25 },
      ])],
      history
    );

    expect(full.exercises.map(e => e.status)).toEqual(['improving', 'stable', 'declining', 'new']);
    expect([full.improving, full.stable, full.declining]).toEqual([1, 1, 1]);
    // Never logged: falls back to the prescribed working weight, start stays 0.
    expect(full.exercises[3].currentWeight).toBe(25);
    expect(full.exercises[3].startWeight).toBe(0);
    expect(full.exercises[3].weightHistory).toEqual([]);
  });

  it('returns an empty, never-run routine when it has no history', () => {
    const [push] = buildRoutineProgressList([routine('push', [{ exerciseId: BENCH, progression: 'maintain', workingWeight: 95 }])], []);
    expect(push.completions).toBe(0);
    expect(push.lastWorkoutDate).toBeNull();
    expect(push.exercises[0].status).toBe('new');
    expect([push.improving, push.stable, push.declining]).toEqual([0, 0, 0]);
  });
});

describe('summarizeRoutineProgress', () => {
  it('sums sessions and status buckets across routines', () => {
    const history = [
      session('a1', 'a', '2026-06-01T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 135 }] }]),
      session('a2', 'a', '2026-06-08T10:00:00.000Z', [{ id: BENCH, sets: [{ weight: 140 }] }]),
      session('b1', 'b', '2026-06-02T10:00:00.000Z', [{ id: SQUAT, sets: [{ weight: 225 }] }, { id: BENCH, sets: [{ weight: 135 }] }]),
    ];
    const list = buildRoutineProgressList(
      [
        routine('a', [{ exerciseId: BENCH, progression: 'increase' }]),
        routine('b', [{ exerciseId: SQUAT, progression: 'decrease' }, { exerciseId: BENCH, progression: 'maintain' }]),
      ],
      history
    );
    expect(summarizeRoutineProgress(list)).toEqual({
      totalSessions: 3,
      totalImproving: 1,
      totalStable: 1,
      totalDeclining: 1,
    });
  });

  it('is all zeros for no routines', () => {
    expect(summarizeRoutineProgress([])).toEqual({
      totalSessions: 0,
      totalImproving: 0,
      totalStable: 0,
      totalDeclining: 0,
    });
  });
});

describe('computeMuscleBalance', () => {
  it('counts completed weighted sets by primary muscle, folding glutes into legs', () => {
    const history = [
      session('w1', 'a', '2026-06-01T10:00:00.000Z', [
        { id: BENCH, sets: [{ weight: 135 }, { weight: 135 }, { weight: 135, completed: false }] },
        { id: SQUAT, sets: [{ weight: 225 }] },
        { id: 'hip-thrust-barbell', sets: [{ weight: 185 }, { weight: 185 }, { weight: 185 }] },
        // Full-body, unknown, and bodyweight-only (weight 0) entries add nothing.
        { id: 'power-clean-barbell', sets: [{ weight: 135 }] },
        { id: 'not-in-catalog', sets: [{ weight: 50 }] },
        { id: 'deadlift-barbell', sets: [{ weight: 0 }] },
      ]),
    ];
    const balance = computeMuscleBalance(history);

    expect(balance.axes.map(a => a.key)).toEqual(['chest', 'shoulders', 'arms', 'legs', 'core', 'back']);
    expect(balance.values).toEqual([2, 0, 0, 4, 0, 0]);
    expect(balance.max).toBe(4);
    expect(balance.total).toBe(6);
  });

  it('keeps max at 1 with no history so the radar never divides by zero', () => {
    const balance = computeMuscleBalance([]);
    expect(balance.values).toEqual([0, 0, 0, 0, 0, 0]);
    expect(balance.max).toBe(1);
    expect(balance.total).toBe(0);
  });
});

describe('getStatusLabel', () => {
  it('labels improving rows by rep bonus and declining rows as a deload', () => {
    expect(getStatusLabel({ status: 'improving', repBonus: 3 })).toBe('Weight ↑ next session');
    expect(getStatusLabel({ status: 'improving', repBonus: 2 })).toBe('+2 reps per set');
    expect(getStatusLabel({ status: 'improving', repBonus: 1 })).toBe('+1 rep per set');
    expect(getStatusLabel({ status: 'declining', repBonus: 0 })).toBe('Consider deload');
  });

  it('is null when there is nothing to say', () => {
    expect(getStatusLabel({ status: 'improving', repBonus: 0 })).toBeNull();
    expect(getStatusLabel({ status: 'stable', repBonus: 3 })).toBeNull();
    expect(getStatusLabel({ status: 'new', repBonus: 0 })).toBeNull();
  });
});
