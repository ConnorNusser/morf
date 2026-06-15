import { GeneratedWorkout } from '../types';
import { getStrengthTrend } from '../lib/workout/progressiveOverload';

// Minimal workout fixture — getStrengthTrend only reads exercise id, the
// completed sets, and the workout date.
function workout(
  date: Date,
  exerciseId: string,
  weight: number,
  reps: number,
  unit: 'lbs' | 'kg' = 'lbs'
): GeneratedWorkout {
  return {
    id: `w-${date.getTime()}`,
    createdAt: date,
    exercises: [
      {
        id: exerciseId,
        sets: 1,
        completedSets: [{ setNumber: 1, weight, reps, unit, completed: true }],
      },
    ],
  } as unknown as GeneratedWorkout;
}

const daysAgo = (n: number) => new Date(2026, 5, 15 - n);

describe('getStrengthTrend', () => {
  it('returns null when the exercise has never been logged', () => {
    expect(getStrengthTrend('bench', [], 'lbs')).toBeNull();
  });

  it('reports a single session as flat with its current 1RM', () => {
    const t = getStrengthTrend('bench', [workout(daysAgo(0), 'bench', 135, 5)], 'lbs')!;
    expect(t.sessions).toBe(1);
    expect(t.direction).toBe('flat');
    expect(t.deltaPercent).toBe(0);
    // Epley: 135 * (1 + 5/30) ≈ 158
    expect(t.current1RM).toBeGreaterThan(150);
  });

  it('detects an upward trend vs a baseline ~a month back', () => {
    const history = [
      workout(daysAgo(0), 'bench', 155, 5),   // newest — stronger
      workout(daysAgo(28), 'bench', 135, 5),  // baseline ~4 weeks ago
    ];
    const t = getStrengthTrend('bench', history, 'lbs')!;
    expect(t.direction).toBe('up');
    expect(t.deltaPercent).toBeGreaterThan(0);
    expect(t.delta1RM).toBeGreaterThan(0);
  });

  it('detects a downward trend after a deload', () => {
    const history = [
      workout(daysAgo(0), 'squat', 185, 5),
      workout(daysAgo(30), 'squat', 225, 5),
    ];
    const t = getStrengthTrend('squat', history, 'lbs')!;
    expect(t.direction).toBe('down');
    expect(t.deltaPercent).toBeLessThan(0);
  });

  it('uses the most recent session at least ~3 weeks older as the baseline', () => {
    // Two recent sessions within 3 weeks + one older baseline. Newest vs the
    // ~4-week-old session (not the very oldest) should drive the comparison.
    const history = [
      workout(daysAgo(0), 'ohp', 100, 5),
      workout(daysAgo(7), 'ohp', 98, 5),
      workout(daysAgo(28), 'ohp', 90, 5),  // baseline (>= 3 weeks older than newest)
      workout(daysAgo(90), 'ohp', 60, 5),  // older still — should NOT be the baseline
    ];
    const t = getStrengthTrend('ohp', history, 'lbs')!;
    expect(t.sessions).toBe(4);
    // 100 vs 90 ≈ +11%, not 100 vs 60 (+66%)
    expect(t.deltaPercent).toBeGreaterThan(5);
    expect(t.deltaPercent).toBeLessThan(20);
  });

  it('converts the current 1RM into the requested display unit', () => {
    const history = [workout(daysAgo(0), 'bench', 100, 5, 'kg')];
    const lbs = getStrengthTrend('bench', history, 'lbs')!;
    const kg = getStrengthTrend('bench', history, 'kg')!;
    // Same lift, different display unit — lbs value is ~2.2x the kg value.
    expect(lbs.current1RM).toBeGreaterThan(kg.current1RM * 2);
  });
});
