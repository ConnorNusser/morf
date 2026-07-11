// Lifetime "career" stats derived purely from workout history. Pure + clock-injectable.
import { LoggedWorkout, WeightUnit, convertWeight } from '@/types';
import { dateKey, sortedDayTimestamps } from '@/lib/utils/utils';
import { getWeekStreak } from '@/lib/workout/streak';

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
  currentStreak: number; // consecutive trained *weeks* (rest days don't break it)
  longestStreak: number; // best consecutive trained-week run ever
  longestDayStreak: number; // best consecutive-day run ever (powers day-streak achievements)
  firstWorkoutAt: Date | null;
  daysSinceStart: number; // days from first workout to now (membership length)
  heaviestSet: HeaviestSet | null; // single heaviest completed set
  biggestSessionVolume: number; // most volume in one workout
  unit: WeightUnit;
}

// Longest run of consecutive calendar days present in the set of trained days.
function longestConsecutive(dayKeys: Set<string>): number {
  if (dayKeys.size === 0) return 0;
  const days = sortedDayTimestamps(dayKeys);

  const DAY_MS = 24 * 60 * 60 * 1000;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = Math.round((days[i] - days[i - 1]) / DAY_MS);
    if (gap === 1) run += 1;
    else if (gap > 1) run = 1;
    if (run > longest) longest = run;
  }
  return longest;
}

export function computeCareerStats(
  workouts: LoggedWorkout[],
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

  // Headline streak is week-based; the raw consecutive-day run is kept separately for achievements.
  const week = getWeekStreak(workouts, now);

  const daysSinceStart = firstWorkoutAt
    ? Math.max(1, Math.floor((now.getTime() - firstWorkoutAt.getTime()) / (24 * 60 * 60 * 1000)) + 1)
    : 0;

  return {
    totalWorkouts: workouts.length,
    totalVolume: Math.round(totalVolume),
    totalSets,
    totalReps,
    daysActive: dayKeys.size,
    currentStreak: week.current,
    longestStreak: week.longest,
    longestDayStreak: longestConsecutive(dayKeys),
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

// Total-volume comparison: heaviest object the user has "lifted" the equivalent of, else null.
const HEAVY_OBJECTS: { single: string; plural: string; lbs: number }[] = [
  { single: 'blue whale', plural: 'blue whales', lbs: 300_000 },
  { single: 'school bus', plural: 'school buses', lbs: 24_000 },
  { single: 'elephant', plural: 'elephants', lbs: 13_000 },
  { single: 'car', plural: 'cars', lbs: 4_000 },
  { single: 'grand piano', plural: 'grand pianos', lbs: 1_000 },
];

export function volumeComparison(volume: number, unit: WeightUnit): string | null {
  const lbs = unit === 'kg' ? convertWeight(volume, 'kg', 'lbs') : volume;
  for (const obj of HEAVY_OBJECTS) {
    if (lbs >= obj.lbs) {
      const n = Math.round(lbs / obj.lbs);
      return `≈ ${n.toLocaleString()} ${n === 1 ? obj.single : obj.plural} lifted`;
    }
  }
  return null;
}
