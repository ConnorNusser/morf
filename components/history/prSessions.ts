import { ExerciseWithMax, GeneratedWorkout } from '@/types';
import { dayKeyOf, e1rmLbs } from './liftSeries';

// Pure (no React / react-native) so the PR gate is unit-testable and shares the
// exact day-bucketing + 1RM math the hero curve uses (liftSeries.ts).
//
// A PR = a *new all-time best at the time it was logged*: a training day whose best
// estimated-1RM strictly beats every PRIOR day for that exercise. This is NOT the
// same as tying the global max (the old WorkoutCard test), which only ever flagged
// the single record-holding workout — so in a strictly-ascending history every real
// PR after the first went un-chipped, while a plateau that re-hit its peak lit up a
// chip on every repeat. Walking a running max fixes both: the whole ascending ramp
// gets chipped, and cyclic re-hits of an already-set record do not.
//
// First-ever day policy: EXCLUDE. A brand-new user's very first log isn't a record
// "beat" — there is nothing prior to beat — so it shows no PR chip.
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

    // Oldest → newest, then record every day that strictly beat the running max.
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

// The single most significant all-time PR set on a given training day. Powers the
// at-most-one PR chip on the collapsed WorkoutCard — replacing the old per-exercise
// chip spray, which lit ~10 of ~14 rows on a normal ascending history and turned the
// badge into decoration instead of signal. "Most significant" = the largest e1RM jump
// over that lift's prior all-time best on the day it happened.
export interface SessionPR {
  name: string;    // display name of the exercise that set the record
  gainLbs: number; // improvement (lbs) over the lift's prior all-time best
}

// day-key -> the day's single biggest all-time PR (absent if no record that day).
// Same day-bucketing + running-max walk as buildPRDays, so a card's session PR can
// never contradict the modal's per-exercise PR badges. First-ever day is EXCLUDED
// (nothing prior to beat), matching buildPRDays.
export function buildSessionPRs(exerciseStats: ExerciseWithMax[]): Map<string, SessionPR> {
  const out = new Map<string, SessionPR>();

  for (const ex of exerciseStats) {
    if (!ex.history || ex.history.length === 0) continue;

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
        const prior = out.get(key);
        // Keep only the biggest jump on that calendar day, across all lifts.
        if (!prior || gainLbs > prior.gainLbs) out.set(key, { name: ex.name, gainLbs });
      }
      if (day.bestLbs > runningMax) runningMax = day.bestLbs;
      isFirst = false;
    }
  }

  return out;
}

// Which exercises in a SINGLE workout should show a PR badge: exactly those whose
// training-day bucket set a new all-time best (buildPRDays membership for the
// workout's calendar day). Shared by WorkoutCard AND WorkoutDetailModal so the card
// chip and the modal badge are identical by construction — a PR can never appear on
// one surface and vanish on the other (the old modal used a stale global-max `>=`
// heuristic that only ever badged the single record-holding workout).
export function prExerciseIdsForWorkout(
  workout: Pick<GeneratedWorkout, 'exercises' | 'createdAt'>,
  prDays: Map<string, Set<string>>,
): Set<string> {
  const dayKey = dayKeyOf(workout.createdAt);
  const ids = new Set<string>();
  for (const ex of workout.exercises) {
    if (prDays.get(ex.id)?.has(dayKey)) ids.add(ex.id);
  }
  return ids;
}
