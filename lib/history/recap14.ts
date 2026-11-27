// The Home "Last 14 days" recap: a per-day volume strip, window totals, volume
// change vs the 14 days before, and the lift that improved the most. Pure +
// clock-injectable. Days are LOCAL calendar days; index 13 is today.
import { dominantPPL, PPLCategory } from '@/lib/data/pplCategories';
import { e1rmLbs } from '@/lib/data/strengthStandards';
import { dateKey } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { workoutLoad } from '@/lib/workout/weeklyGoal';
import { convertWeight, LoggedWorkout, WeightUnit } from '@/types';

export const RECAP_DAYS = 14;
// Look-back for the "before" side of most-improved, measured from the window start.
export const BASELINE_DAYS = 90;

// "Most improved" guards: a lift must clear ALL of these to qualify.
export const MIN_GAIN_LBS = 5; // smaller e1RM moves are estimator noise / plate rounding
export const MIN_GAIN_PCT = 1; // rounded % must show as at least +1%
export const MIN_BASELINE_E1RM_LBS = 40; // keeps 15→20 lb raises from "+33%"-ing the bench
const TIE_EPSILON_PCT = 0.05;

export interface RecapDay {
  date: Date; // local midnight
  workouts: number;
  volume: number; // display unit, rounded
  split: PPLCategory | null; // dominant push/pull/legs, null on rest days
}

export interface RecapTotals {
  workouts: number;
  activeDays: number;
  volume: number; // display unit, rounded
  sets: number;
}

export interface MostImproved {
  exerciseId: string;
  name: string;
  fromE1rm: number; // display unit, rounded — best in the baseline window
  toE1rm: number; // display unit, rounded — best in the last 14 days
  deltaPct: number; // rounded integer %
  deltaAbs: number; // display unit, rounded (toE1rm − fromE1rm)
}

export interface Recap14 {
  days: RecapDay[]; // length 14, oldest → today
  totals: RecapTotals;
  deltaVsPrev14: number | null; // rounded % volume change; null when the prior 14 had no volume
  mostImproved: MostImproved | null;
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Bodyweight-only (no external load to estimate) and timed/cardio lifts can't have an e1RM.
function isE1rmEligible(exerciseId: string): boolean {
  const info = getExercise(exerciseId);
  if (!info) return true; // unknown/legacy id: let the weighted-set filter decide
  if (info.trackingType && info.trackingType !== 'reps') return false;
  const equipment = info.equipment || [];
  if (equipment.length > 0 && equipment.every(e => e === 'bodyweight')) return false;
  return true;
}

// Best working-set e1RM (lbs) per exercise for workouts in [from, to).
function bestE1rmByExercise(workouts: LoggedWorkout[], from: Date, to: Date): Map<string, number> {
  const best = new Map<string, number>();
  for (const w of workouts) {
    const t = new Date(w.createdAt).getTime();
    if (t < from.getTime() || t >= to.getTime()) continue;
    for (const ex of w.exercises || []) {
      if (!isE1rmEligible(ex.id)) continue;
      for (const s of ex.completedSets || []) {
        if (!s.completed || s.isWarmup || !(s.weight > 0) || !(s.reps > 0)) continue;
        const e1rm = e1rmLbs(s.weight, s.reps, s.unit || 'lbs');
        if (e1rm > (best.get(ex.id) ?? 0)) best.set(ex.id, e1rm);
      }
    }
  }
  return best;
}

function findMostImproved(
  history: LoggedWorkout[],
  windowStart: Date,
  windowEnd: Date,
  unit: WeightUnit,
): MostImproved | null {
  const recent = bestE1rmByExercise(history, windowStart, windowEnd);
  const baseline = bestE1rmByExercise(history, addDays(windowStart, -BASELINE_DAYS), windowStart);

  const toDisplay = (lbs: number) => Math.round(convertWeight(lbs, 'lbs', unit));

  let winner: { id: string; name: string; from: number; to: number; pct: number; abs: number } | null = null;
  for (const [id, to] of recent) {
    const from = baseline.get(id);
    if (from === undefined || from < MIN_BASELINE_E1RM_LBS) continue;
    const abs = to - from;
    const pct = (abs / from) * 100;
    if (abs < MIN_GAIN_LBS || Math.round(pct) < MIN_GAIN_PCT) continue;

    const name = getExercise(id)?.name || id.replace('custom_', '').replace(/-/g, ' ');
    const better =
      !winner ||
      pct > winner.pct + TIE_EPSILON_PCT ||
      (Math.abs(pct - winner.pct) <= TIE_EPSILON_PCT &&
        (abs > winner.abs || (abs === winner.abs && name.localeCompare(winner.name) < 0)));
    if (better) winner = { id, name, from, to, pct, abs };
  }
  if (!winner) return null;

  const fromE1rm = toDisplay(winner.from);
  const toE1rm = toDisplay(winner.to);
  return {
    exerciseId: winner.id,
    name: winner.name,
    fromE1rm,
    toE1rm,
    deltaPct: Math.round(winner.pct),
    deltaAbs: toE1rm - fromE1rm,
  };
}

export function computeRecap14(
  history: LoggedWorkout[],
  unit: WeightUnit,
  now: Date = new Date(),
): Recap14 {
  const today = startOfDay(now);
  const windowStart = addDays(today, -(RECAP_DAYS - 1));
  const windowEnd = addDays(today, 1); // exclusive
  const prevStart = addDays(windowStart, -RECAP_DAYS);

  const dayDates = Array.from({ length: RECAP_DAYS }, (_, i) => addDays(windowStart, i));
  const indexByKey = new Map(dayDates.map((d, i) => [dateKey(d), i]));
  const byDay: LoggedWorkout[][] = dayDates.map(() => []);
  const volumeLbsByDay = dayDates.map(() => 0);

  let sets = 0;
  let volumeLbs = 0;
  let prevVolumeLbs = 0;
  for (const w of history) {
    const created = new Date(w.createdAt);
    const idx = indexByKey.get(dateKey(created));
    if (idx !== undefined) {
      const load = workoutLoad(w);
      byDay[idx].push(w);
      volumeLbsByDay[idx] += load.volumeLbs;
      volumeLbs += load.volumeLbs;
      sets += load.sets;
    } else if (created >= prevStart && created < windowStart) {
      prevVolumeLbs += workoutLoad(w).volumeLbs;
    }
  }

  const toDisplay = (lbs: number) => Math.round(convertWeight(lbs, 'lbs', unit));

  const days: RecapDay[] = dayDates.map((date, i) => ({
    date,
    workouts: byDay[i].length,
    volume: toDisplay(volumeLbsByDay[i]),
    split: byDay[i].length > 0 ? dominantPPL(byDay[i]) : null,
  }));

  return {
    days,
    totals: {
      workouts: byDay.reduce((n, d) => n + d.length, 0),
      activeDays: byDay.filter(d => d.length > 0).length,
      volume: toDisplay(volumeLbs),
      sets,
    },
    deltaVsPrev14:
      prevVolumeLbs > 0 ? Math.round(((volumeLbs - prevVolumeLbs) / prevVolumeLbs) * 100) : null,
    mostImproved: findMostImproved(history, windowStart, windowEnd, unit),
  };
}
