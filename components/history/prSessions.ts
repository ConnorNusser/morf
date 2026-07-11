import { ExerciseWithMax, LoggedWorkout } from '@/types';
import { dayKeyOf, e1rmLbs } from './liftSeries';

// A PR = a training day whose best e1RM strictly beats every PRIOR day. Walking a
// running max chips the whole ascending ramp but not cyclic re-hits of an already-set
// record. First-ever day is EXCLUDED (nothing prior to beat).
export function buildPRDays(exerciseStats: ExerciseWithMax[]): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();

  for (const ex of exerciseStats) {
    if (!ex.history || ex.history.length === 0) continue;

    // Collapse to one bucket per training day, keeping that day's best e1RM (lbs).
    const byDay = new Map<string, { time: number; bestLbs: number }>();
    for (const h of ex.history) {
      const key = dayKeyOf(h.date);
      const best = e1rmLbs(h);
      const existing = byDay.get(key);
      if (existing) {
        if (best > existing.bestLbs) existing.bestLbs = best;
      } else {
        byDay.set(key, { time: new Date(h.date).getTime(), bestLbs: best });
      }
    }

    // Oldest → newest, recording every day that strictly beat the running max.
    const days = [...byDay.entries()].sort((a, b) => a[1].time - b[1].time);
    const prDays = new Set<string>();
    let runningMax = -Infinity;
    let isFirst = true;
    for (const [key, day] of days) {
      if (!isFirst && day.bestLbs > runningMax) prDays.add(key);
      if (day.bestLbs > runningMax) runningMax = day.bestLbs;
      isFirst = false;
    }

    if (prDays.size > 0) out.set(ex.id, prDays);
  }

  return out;
}

// The single most significant all-time PR on a training day, for the at-most-one WorkoutCard
// marker. Bar is deliberately HIGH — qualifies only for a compound lift (COMPOUND_LIFT_IDS)
// clearing BOTH significance floors — so most sessions carry no marker and the rest are real.
export type PRTier = 'major' | 'standard';

export interface SessionPR {
  name: string;    // display name of the exercise that set the record
  gainLbs: number; // improvement (lbs) over the lift's prior all-time best
  tier: PRTier;    // 'major' = big plate jump; 'standard' = notable but modest
}

// Multi-joint barbell/heavy-machine lifts only. Accessories are excluded — they progress in
// small increments off a small base, so a %-based record fires constantly and drowns the signal.
const COMPOUND_LIFT_IDS = new Set<string>([
  'squat-barbell',
  'front-squat-barbell',
  'squat-smith-machine',
  'hack-squat-machine',
  'leg-press-machine',
  'bench-press-barbell',
  'bench-press-dumbbells',
  'bench-press-machine',
  'bench-press-smith-machine',
  'incline-bench-press-barbell',
  'incline-bench-press-dumbbells',
  'overhead-press-barbell',
  'overhead-press-machine',
  'deadlift-barbell',
  'sumo-deadlift-barbell',
  'romanian-deadlift-barbell',
  'row-barbell',
  'hip-thrust-barbell',
  'lunges-barbell',
]);

// Significance floors. A qualifying day-PR must clear BOTH.
const PR_MIN_GAIN_LBS = 5;    // a real added plate/step, not a formula-rounding wobble
const PR_MIN_GAIN_PCT = 0.02; // ≥2% over the prior best — filters trivial moves on heavy lifts
// A 'major' record (emphasized badge) clears EITHER of these larger bars.
const PR_MAJOR_GAIN_LBS = 15;
const PR_MAJOR_GAIN_PCT = 0.05;

// day-key -> the day's single biggest notable-compound all-time PR. Same bucketing +
// running-max walk as buildPRDays so a card's PR can't contradict the modal's badges.
export function buildSessionPRs(exerciseStats: ExerciseWithMax[]): Map<string, SessionPR> {
  const out = new Map<string, SessionPR>();

  for (const ex of exerciseStats) {
    if (!ex.history || ex.history.length === 0) continue;
    if (!COMPOUND_LIFT_IDS.has(ex.id)) continue; // only primary lifts earn a card marker

    const byDay = new Map<string, { time: number; bestLbs: number }>();
    for (const h of ex.history) {
      const key = dayKeyOf(h.date);
      const best = e1rmLbs(h);
      const existing = byDay.get(key);
      if (existing) {
        if (best > existing.bestLbs) existing.bestLbs = best;
      } else {
        byDay.set(key, { time: new Date(h.date).getTime(), bestLbs: best });
      }
    }

    const days = [...byDay.entries()].sort((a, b) => a[1].time - b[1].time);
    let runningMax = -Infinity;
    let isFirst = true;
    for (const [key, day] of days) {
      if (!isFirst && day.bestLbs > runningMax) {
        const gainLbs = day.bestLbs - runningMax;
        const pct = runningMax > 0 ? gainLbs / runningMax : 1;
        if (gainLbs >= PR_MIN_GAIN_LBS && pct >= PR_MIN_GAIN_PCT) {
          const tier: PRTier =
            gainLbs >= PR_MAJOR_GAIN_LBS || pct >= PR_MAJOR_GAIN_PCT ? 'major' : 'standard';
          const prior = out.get(key);
          // Keep only the biggest jump on that calendar day, across compound lifts.
          if (!prior || gainLbs > prior.gainLbs) out.set(key, { name: ex.name, gainLbs, tier });
        }
      }
      if (day.bestLbs > runningMax) runningMax = day.bestLbs;
      isFirst = false;
    }
  }

  return out;
}

// Exercises in a workout that set a new all-time best on its calendar day (buildPRDays
// membership). Shared by WorkoutCard and WorkoutDetailModal so their badges can't disagree.
export function prExerciseIdsForWorkout(
  workout: Pick<LoggedWorkout, 'exercises' | 'createdAt'>,
  prDays: Map<string, Set<string>>,
): Set<string> {
  const dayKey = dayKeyOf(workout.createdAt);
  const ids = new Set<string>();
  for (const ex of workout.exercises) {
    if (prDays.get(ex.id)?.has(dayKey)) ids.add(ex.id);
  }
  return ids;
}
