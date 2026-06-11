// Lifetime "career" stats derived purely from workout history — the foundation
// of the gamification layer. Pure + clock-injectable so it's unit-testable.
import { GeneratedWorkout, WeightUnit, convertWeight } from '@/types';

export interface HeaviestSet {
  weight: number; // in preferred unit
  reps: number;
  exerciseId: string;
  date: Date;
}

export interface CareerStats {
  totalWorkouts: number;
  totalVolume: number; // Σ weight×reps over completed sets, preferred unit
  totalSets: number;
  totalReps: number;
  daysActive: number; // distinct calendar days trained
  currentStreak: number; // consecutive days up to today/yesterday
  longestStreak: number; // best consecutive-day run ever
  firstWorkoutAt: Date | null;
  daysSinceStart: number; // days from first workout to now (membership length)
  heaviestSet: HeaviestSet | null; // single heaviest completed set
  biggestSessionVolume: number; // most volume in one workout
  unit: WeightUnit;
}

// Local YYYY-MM-DD, matching retentionSignals / recapStats.
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Longest run of consecutive calendar days present in the set of trained days.
function longestConsecutive(dayKeys: Set<string>): number {
  if (dayKeys.size === 0) return 0;
  // Convert keys back to dates, sort ascending, walk for consecutive runs.
  const days = [...dayKeys]
    .map(k => {
      const [y, m, d] = k.split('-').map(Number);
      return new Date(y, m - 1, d).getTime();
    })
    .sort((a, b) => a - b);

  const DAY_MS = 24 * 60 * 60 * 1000;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round((days[i] - days[i - 1]) / DAY_MS);
    if (gap === 1) run += 1;
    else if (gap > 1) run = 1;
    // gap === 0 (same day) shouldn't happen with a Set of day keys
    if (run > longest) longest = run;
  }
  return longest;
}

export function computeCareerStats(
  workouts: GeneratedWorkout[],
  unit: WeightUnit,
  now: Date = new Date(),
): CareerStats {
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  let heaviestSet: HeaviestSet | null = null;
  let biggestSessionVolume = 0;
  let firstWorkoutAt: Date | null = null;
  const dayKeys = new Set<string>();

  for (const workout of workouts) {
    const created = new Date(workout.createdAt);
    dayKeys.add(dateKey(created));
    if (!firstWorkoutAt || created < firstWorkoutAt) firstWorkoutAt = created;

    let sessionVolume = 0;
    for (const exercise of workout.exercises || []) {
      for (const set of exercise.completedSets || []) {
        if (!set.completed) continue;
        const weight = set.unit === unit ? set.weight : convertWeight(set.weight, set.unit, unit);
        totalSets += 1;
        totalReps += set.reps;
        const vol = weight * set.reps;
        totalVolume += vol;
        sessionVolume += vol;

        if (!heaviestSet || weight > heaviestSet.weight) {
          heaviestSet = { weight, reps: set.reps, exerciseId: exercise.id, date: created };
        }
      }
    }
    if (sessionVolume > biggestSessionVolume) biggestSessionVolume = sessionVolume;
  }

  // Streaks via the same day-key logic the retention reminders use.
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  let currentStreak = 0;
  if (dayKeys.has(dateKey(today)) || dayKeys.has(dateKey(yesterday))) {
    const cursor = new Date(dayKeys.has(dateKey(today)) ? today : yesterday);
    while (dayKeys.has(dateKey(cursor))) {
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
  }

  const daysSinceStart = firstWorkoutAt
    ? Math.max(1, Math.floor((now.getTime() - firstWorkoutAt.getTime()) / (24 * 60 * 60 * 1000)) + 1)
    : 0;

  return {
    totalWorkouts: workouts.length,
    totalVolume: Math.round(totalVolume),
    totalSets,
    totalReps,
    daysActive: dayKeys.size,
    currentStreak,
    longestStreak: longestConsecutive(dayKeys),
    firstWorkoutAt,
    daysSinceStart,
    heaviestSet,
    biggestSessionVolume: Math.round(biggestSessionVolume),
    unit,
  };
}

// Compact large numbers for stat tiles: 1840 -> "1.8K", 1_250_000 -> "1.3M".
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}
