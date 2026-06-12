import { GeneratedWorkout } from '../types';
import { getWeekProgress, getWeeklyLoad } from '../lib/workout/weeklyGoal';

// Minimal workout fixture — getWeekProgress only reads `createdAt`.
function w(date: Date): GeneratedWorkout {
  return { id: date.toISOString(), title: 'test', exercises: [], createdAt: date } as unknown as GeneratedWorkout;
}

// Workout fixture with a single exercise's completed sets (lbs) for load tests.
function wLoad(date: Date, sets: { weight: number; reps: number; completed?: boolean }[]): GeneratedWorkout {
  return {
    id: date.toISOString(),
    title: 'test',
    createdAt: date,
    exercises: [
      {
        completedSets: sets.map(s => ({ weight: s.weight, reps: s.reps, unit: 'lbs', completed: s.completed ?? true })),
      },
    ],
  } as unknown as GeneratedWorkout;
}

// Fixed reference "now": Wednesday, June 10 2026, 20:00 local.
// The Monday of this week is June 8 2026.
const NOW = new Date(2026, 5, 10, 20, 0, 0);
const at = (month: number, dayOfMonth: number, hour = 18) =>
  new Date(2026, month, dayOfMonth, hour, 0, 0);

describe('getWeekProgress', () => {
  it('reports an empty week', () => {
    const p = getWeekProgress([], 4, NOW);
    expect(p.daysTrained).toBe(0);
    expect(p.metGoal).toBe(false);
    expect(p.trainedDays).toEqual([false, false, false, false, false, false, false]);
    expect(p.weekStart).toEqual(new Date(2026, 5, 8, 0, 0, 0, 0)); // Monday June 8
  });

  it('marks Monday and Wednesday of the current week', () => {
    const p = getWeekProgress([w(at(5, 8)), w(at(5, 10))], 4, NOW);
    expect(p.daysTrained).toBe(2);
    // index 0 = Mon (Jun 8), index 2 = Wed (Jun 10)
    expect(p.trainedDays).toEqual([true, false, true, false, false, false, false]);
    expect(p.metGoal).toBe(false);
  });

  it('dedupes multiple workouts on the same day', () => {
    const p = getWeekProgress([w(at(5, 10, 8)), w(at(5, 10, 19))], 4, NOW);
    expect(p.daysTrained).toBe(1);
  });

  it('ignores workouts from the previous week', () => {
    // June 7 2026 is the Sunday before this week's Monday (June 8).
    const p = getWeekProgress([w(at(5, 7)), w(at(5, 9))], 4, NOW);
    expect(p.daysTrained).toBe(1);
    expect(p.trainedDays[1]).toBe(true); // Tuesday June 9
  });

  it('meets the goal when days trained reaches it', () => {
    const p = getWeekProgress([w(at(5, 8)), w(at(5, 9)), w(at(5, 10))], 3, NOW);
    expect(p.metGoal).toBe(true);
  });
});

describe('getWeeklyLoad', () => {
  it('reports an empty week', () => {
    expect(getWeeklyLoad([], NOW)).toEqual({ volumeLbs: 0, sets: 0, deltaPct: null });
  });

  it('sums completed-set volume and set count for this week', () => {
    const load = getWeeklyLoad([wLoad(at(5, 8), [{ weight: 100, reps: 10 }, { weight: 100, reps: 5 }])], NOW);
    expect(load.volumeLbs).toBe(1500);
    expect(load.sets).toBe(2);
    expect(load.deltaPct).toBeNull(); // no prior-week data
  });

  it('skips incomplete sets', () => {
    const load = getWeeklyLoad([wLoad(at(5, 8), [{ weight: 100, reps: 10 }, { weight: 200, reps: 10, completed: false }])], NOW);
    expect(load.volumeLbs).toBe(1000);
    expect(load.sets).toBe(1);
  });

  it('computes the week-over-week volume delta', () => {
    // Last week (June 1, Monday): 1000 lb. This week (June 8): 1500 lb → +50%.
    const load = getWeeklyLoad(
      [wLoad(at(5, 1), [{ weight: 100, reps: 10 }]), wLoad(at(5, 8), [{ weight: 100, reps: 15 }])],
      NOW
    );
    expect(load.volumeLbs).toBe(1500);
    expect(load.deltaPct).toBe(50);
  });

  it('ignores workouts older than last week', () => {
    const load = getWeeklyLoad([wLoad(at(4, 20), [{ weight: 100, reps: 10 }])], NOW);
    expect(load.volumeLbs).toBe(0);
    expect(load.deltaPct).toBeNull();
  });
});
