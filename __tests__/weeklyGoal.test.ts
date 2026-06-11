import { GeneratedWorkout } from '../types';
import { getWeekProgress } from '../lib/workout/weeklyGoal';

// Minimal workout fixture — getWeekProgress only reads `createdAt`.
function w(date: Date): GeneratedWorkout {
  return { id: date.toISOString(), title: 'test', exercises: [], createdAt: date } as unknown as GeneratedWorkout;
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
