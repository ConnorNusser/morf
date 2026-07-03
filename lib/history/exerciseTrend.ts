import { convertWeight, ExerciseHistoryEntry, WeightUnit } from '@/types';
import { dayKeyOf, e1rmLbs } from '@/components/history/liftSeries';

// Pure (no React / react-native) so the ExerciseCard trend math is unit-testable and
// deduped with the history "Improved" sort. Critically, it is NOT coupled to the live
// clock: the old getSparklineData/getDelta bucketed into six fixed calendar windows
// measured from `new Date()` and cut the delta off at a hard 3-month boundary, so any
// history shorter than 3 months (sparse ~ 2 months) or not logged recently rendered
// trend-less. Here we collapse to one best-per-training-day bucket and read the trend
// straight off the FULL logged window, so a 2-month ascending history reports its gain.

/**
 * Which value each day-bucket keeps: the day's top working weight, its best e1RM, or
 * (for a calisthenics lift with no meaningful weight) its best rep count.
 */
export type TrendMetric = 'topWeight' | 'e1rm' | 'reps';

export interface ExerciseTrend {
  /** Absolute rounded gain (display unit) from earliest to latest day-bucket; 0 hides the chip. */
  deltaDisplay: number;
  /** True when the latest day-bucket beats the earliest. */
  isPositive: boolean;
  /** Up-to-6 most-recent day-bucket bests (display unit), oldest->newest; [] if <2 days. */
  sparkline: number[];
}

const EMPTY_TREND: ExerciseTrend = { deltaDisplay: 0, isPositive: false, sparkline: [] };

/** Max number of day-buckets the sparkline renders. */
export const SPARKLINE_POINTS = 6;

interface DayBucket {
  time: number;
  best: number; // in lbs; converted to display unit only at the end
}

/**
 * Collapse a per-set history to one best-per-day bucket and derive the card's two
 * trend signals from the full logged window.
 *
 * - `metric` 'topWeight' (default) keeps the heaviest working weight that day, matching
 *   the ExerciseCard number dump; 'e1rm' keeps the best estimated 1RM, matching the
 *   "Improved" sort in history.tsx. Both share this one definition of progress.
 * - All comparison is done in lbs (so mixed kg/lbs logs bucket correctly) and only the
 *   final numbers are converted to the user's display unit.
 */
export function computeExerciseTrend(
  history: ExerciseHistoryEntry[],
  weightUnit: WeightUnit,
  metric: TrendMetric = 'topWeight'
): ExerciseTrend {
  if (!history || history.length === 0) return EMPTY_TREND;

  // 'reps' is a raw count (not a weight), so it never gets kg/lbs converted below.
  const value = (e: ExerciseHistoryEntry): number =>
    metric === 'reps'
      ? e.reps
      : metric === 'e1rm'
        ? e1rmLbs(e)
        : convertWeight(e.weight, e.unit || 'lbs', 'lbs');

  const byDay = new Map<string, DayBucket>();
  for (const h of history) {
    const key = dayKeyOf(h.date);
    const v = value(h);
    const existing = byDay.get(key);
    if (existing) {
      if (v > existing.best) existing.best = v;
    } else {
      byDay.set(key, { time: new Date(h.date).getTime(), best: v });
    }
  }

  const days = [...byDay.values()].sort((a, b) => a.time - b.time);
  if (days.length === 0) return EMPTY_TREND;

  // Rep counts are unitless; only weight-based metrics convert to the display unit.
  const toDisplay = (v: number) => (metric !== 'reps' && weightUnit === 'kg' ? convertWeight(v, 'lbs', 'kg') : v);
  const bests = days.map(d => toDisplay(d.best));

  const rawDelta = days.length >= 2 ? bests[bests.length - 1] - bests[0] : 0;

  return {
    deltaDisplay: Math.round(Math.abs(rawDelta)),
    isPositive: rawDelta > 0,
    sparkline: bests.length >= 2 ? bests.slice(-SPARKLINE_POINTS) : [],
  };
}
