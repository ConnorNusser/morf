import { GeneratedWorkout } from '../types';
import { computeCareerStats, formatCompact, volumeComparison } from '../lib/gamification/careerStats';

// Build a workout on a given day with completed sets [{weight, reps, unit}].
function workout(date: Date, sets: { weight: number; reps: number; unit?: 'lbs' | 'kg' }[]): GeneratedWorkout {
  return {
    id: date.toISOString(),
    title: 'w',
    exercises: [
      {
        id: 'bench-press',
        sets: sets.length,
        reps: '',
        isCompleted: true,
        completedSets: sets.map((s, i) => ({
          setNumber: i + 1,
          weight: s.weight,
          reps: s.reps,
          unit: s.unit ?? 'lbs',
          completed: true,
        })),
      },
    ],
    createdAt: date,
  } as unknown as GeneratedWorkout;
}

const NOW = new Date(2026, 5, 10, 20, 0, 0); // Wed Jun 10 2026
const day = (offset: number) => new Date(2026, 5, 10 - offset, 18, 0, 0);

describe('computeCareerStats', () => {
  it('returns zeroed stats for no workouts', () => {
    const s = computeCareerStats([], 'lbs', NOW);
    expect(s.totalWorkouts).toBe(0);
    expect(s.totalVolume).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.longestStreak).toBe(0);
    expect(s.longestDayStreak).toBe(0);
    expect(s.firstWorkoutAt).toBeNull();
    expect(s.heaviestSet).toBeNull();
  });

  it('aggregates volume, sets, reps across workouts', () => {
    const s = computeCareerStats(
      [
        workout(day(0), [{ weight: 100, reps: 10 }, { weight: 100, reps: 8 }]),
        workout(day(1), [{ weight: 135, reps: 5 }]),
      ],
      'lbs',
      NOW,
    );
    expect(s.totalWorkouts).toBe(2);
    expect(s.totalSets).toBe(3);
    expect(s.totalReps).toBe(23);
    expect(s.totalVolume).toBe(100 * 10 + 100 * 8 + 135 * 5); // 2475
    expect(s.heaviestSet?.weight).toBe(135);
    expect(s.biggestSessionVolume).toBe(1800); // day(0): 1000 + 800
  });

  it('counts week-based current/longest streaks plus the raw day streak', () => {
    // NOW = Wed Jun 10 (week of Mon Jun 8). day(0..1) land this week; day(4..7)
    // land in the prior week (Mon Jun 1) — so two consecutive trained weeks, and
    // the longest consecutive-day run is Jun 3–6 (4 days).
    const s = computeCareerStats(
      [
        workout(day(0), [{ weight: 100, reps: 5 }]),
        workout(day(1), [{ weight: 100, reps: 5 }]),
        workout(day(4), [{ weight: 100, reps: 5 }]),
        workout(day(5), [{ weight: 100, reps: 5 }]),
        workout(day(6), [{ weight: 100, reps: 5 }]),
        workout(day(7), [{ weight: 100, reps: 5 }]),
      ],
      'lbs',
      NOW,
    );
    expect(s.currentStreak).toBe(2); // this week + last week
    expect(s.longestStreak).toBe(2); // two consecutive trained weeks
    expect(s.longestDayStreak).toBe(4); // Jun 3..Jun 6
    expect(s.daysActive).toBe(6);
  });

  it('dedupes multiple workouts on the same day for daysActive', () => {
    const s = computeCareerStats(
      [workout(day(0), [{ weight: 50, reps: 5 }]), workout(day(0), [{ weight: 60, reps: 5 }])],
      'lbs',
      NOW,
    );
    expect(s.totalWorkouts).toBe(2);
    expect(s.daysActive).toBe(1);
  });

  it('converts kg sets into the preferred unit (lbs)', () => {
    // 100 kg ≈ 220.5 lbs; volume = ~220.5 * 5
    const s = computeCareerStats([workout(day(0), [{ weight: 100, reps: 5, unit: 'kg' }])], 'lbs', NOW);
    expect(s.totalVolume).toBeGreaterThan(1000);
    expect(s.heaviestSet?.weight).toBeGreaterThan(200);
  });

  it('tracks first workout and membership length', () => {
    const s = computeCareerStats(
      [workout(day(9), [{ weight: 100, reps: 5 }]), workout(day(0), [{ weight: 100, reps: 5 }])],
      'lbs',
      NOW,
    );
    expect(s.firstWorkoutAt?.getDate()).toBe(day(9).getDate());
    expect(s.daysSinceStart).toBe(10); // 9 days span, inclusive
  });
});

describe('formatCompact', () => {
  it('formats thousands and millions', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(1840)).toBe('1.8K');
    expect(formatCompact(1_250_000)).toBe('1.3M');
    expect(formatCompact(2_000_000)).toBe('2M');
  });
});

describe('volumeComparison', () => {
  it('returns null below the smallest object', () => {
    expect(volumeComparison(500, 'lbs')).toBeNull();
  });

  it('picks the heaviest relatable object and pluralizes', () => {
    expect(volumeComparison(1_000, 'lbs')).toBe('≈ 1 grand piano lifted');
    expect(volumeComparison(8_000, 'lbs')).toBe('≈ 2 cars lifted');
    expect(volumeComparison(600_000, 'lbs')).toBe('≈ 2 blue whales lifted');
  });

  it('converts kg volume to lbs first', () => {
    // 3000 kg ~ 6600 lbs -> cars (4000 lbs)
    expect(volumeComparison(3_000, 'kg')).toContain('car');
  });
});
