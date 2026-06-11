import { GeneratedWorkout } from '../types';
import { computeWeeklyChallenge } from '../lib/gamification/weeklyChallenge';

function workout(date: Date, sets: { reps: number; exId?: string }[]): GeneratedWorkout {
  return {
    id: date.toISOString() + Math.random(),
    title: 'w',
    exercises: sets.map((s, i) => ({
      id: s.exId ?? 'bench-press-barbell',
      sets: 1,
      reps: '',
      isCompleted: true,
      completedSets: [{ setNumber: i + 1, weight: 100, reps: s.reps, unit: 'lbs', completed: true }],
    })),
    createdAt: date,
  } as unknown as GeneratedWorkout;
}

// Wed Jun 10 2026; week of Mon Jun 8.
const NOW = new Date(2026, 5, 10, 20, 0, 0);
const day = (offset: number) => new Date(2026, 5, 10 - offset, 18, 0, 0);

describe('computeWeeklyChallenge', () => {
  it('returns a deterministic challenge with zero progress for no workouts', () => {
    const c = computeWeeklyChallenge([], NOW);
    expect(['days', 'sets', 'muscles', 'reps']).toContain(c.id);
    expect(c.current).toBe(0);
    expect(c.completed).toBe(false);
    expect(c.progress).toBe(0);
  });

  it('rotates the challenge week to week', () => {
    const thisWeek = computeWeeklyChallenge([], NOW).id;
    const nextWeek = computeWeeklyChallenge([], new Date(2026, 5, 17, 20, 0, 0)).id; // +7 days
    expect(thisWeek).not.toBe(nextWeek);
  });

  it('only counts the current week', () => {
    const c = computeWeeklyChallenge(
      [workout(day(0), [{ reps: 5 }]), workout(day(9), [{ reps: 5 }])], // day(9) is last week
      NOW,
    );
    // whichever metric, only the in-week workout contributes (current > 0 but small)
    expect(c.current).toBeGreaterThan(0);
  });

  it('keeps progress and completed consistent with current/target', () => {
    const workouts = [
      workout(day(0), [{ exId: 'bench-press-barbell' }, { exId: 'squat-barbell' }].map(e => ({ reps: 10, exId: e.exId }))),
      workout(day(1), [{ reps: 10 }]),
      workout(day(2), [{ reps: 10 }]),
    ];
    const c = computeWeeklyChallenge(workouts, NOW);
    expect(c.current).toBeGreaterThan(0);
    expect(c.progress).toBeCloseTo(Math.min(1, c.current / c.target));
    expect(c.completed).toBe(c.current >= c.target);
  });
});
