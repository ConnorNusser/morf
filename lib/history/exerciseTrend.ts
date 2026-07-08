import { convertWeight, ExerciseHistoryEntry, WeightUnit } from '@/types';
import { dayKeyOf, e1rmLbs } from '@/components/history/liftSeries';

// ExerciseCard trend math, NOT coupled to the live clock (unlike the old getSparklineData/
// getDelta with fixed calendar windows): one best-per-training-day bucket over the FULL window.

export type TrendMetric = 'topWeight' | 'e1rm' | 'reps';

export interface ExerciseTrend {
  deltaDisplay: number; // rounded gain (display unit) earliest→latest; 0 hides the chip
  isPositive: boolean;
  sparkline: number[]; // up-to-6 recent day-bucket bests, oldest→newest; [] if <2 days
}

const EMPTY_TREND: ExerciseTrend = { deltaDisplay: 0, isPositive: false, sparkline: [] };

export const SPARKLINE_POINTS = 6;

interface DayBucket {
  time: number;
  best: number; // in lbs; converted to display unit only at the end
}

// `metric` 'topWeight' (default) keeps the day's heaviest weight; 'e1rm' the best 1RM
// (matching history.tsx's "Improved" sort). Comparison in lbs; convert last.
export function computeExerciseTrend(
  history: ExerciseHistoryEntry[],
  weightUnit: WeightUnit,
  metric: TrendMetric = 'topWeight'
): ExerciseTrend {
  if (!history || history.length === 0) return EMPTY_TREND;

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

  // Rep counts are unitless; only weight metrics convert.
  const toDisplay = (v: number) => (metric !== 'reps' && weightUnit === 'kg' ? convertWeight(v, 'lbs', 'kg') : v);
  const bests = days.map(d => toDisplay(d.best));

  const rawDelta = days.length >= 2 ? bests[bests.length - 1] - bests[0] : 0;

  return {
    deltaDisplay: Math.round(Math.abs(rawDelta)),
    isPositive: rawDelta > 0,
    sparkline: bests.length >= 2 ? bests.slice(-SPARKLINE_POINTS) : [],
  };
}
