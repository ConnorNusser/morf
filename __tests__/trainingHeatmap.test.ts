import { GeneratedWorkout } from '../types';
import { computeTrainingHeatmap } from '../lib/gamification/trainingHeatmap';

function workout(date: Date, volume: number): GeneratedWorkout {
  return {
    id: date.toISOString(),
    title: 'w',
    exercises: [
      { id: 'x', sets: 1, reps: '', isCompleted: true, completedSets: [{ setNumber: 1, weight: volume, reps: 1, unit: 'lbs', completed: true }] },
    ],
    createdAt: date,
  } as unknown as GeneratedWorkout;
}

// Wed Jun 10 2026
const NOW = new Date(2026, 5, 10, 20, 0, 0);

describe('computeTrainingHeatmap', () => {
  it('builds a weeks x 7 grid', () => {
    const hm = computeTrainingHeatmap([], 12, NOW);
    expect(hm.weeks.length).toBe(12);
    expect(hm.weeks.every(w => w.length === 7)).toBe(true);
    expect(hm.totalDays).toBe(0);
  });

  it('marks trained days with normalized intensity and counts them', () => {
    const hm = computeTrainingHeatmap(
      [workout(new Date(2026, 5, 10), 1000), workout(new Date(2026, 5, 8), 500)], // Wed + Mon this week
      12,
      NOW,
    );
    expect(hm.totalDays).toBe(2);
    const lastWeek = hm.weeks[hm.weeks.length - 1];
    expect(lastWeek[0].trained).toBe(true); // Monday
    expect(lastWeek[0].intensity).toBeCloseTo(0.5); // 500 / 1000 max
    expect(lastWeek[2].trained).toBe(true); // Wednesday
    expect(lastWeek[2].intensity).toBe(1); // the biggest day
  });

  it('flags future days in the current week', () => {
    const hm = computeTrainingHeatmap([], 12, NOW);
    const lastWeek = hm.weeks[hm.weeks.length - 1];
    // Wed is "today"; Thu..Sun are future
    expect(lastWeek[2].future).toBe(false);
    expect(lastWeek[3].future).toBe(true);
    expect(lastWeek[6].future).toBe(true);
  });
});
