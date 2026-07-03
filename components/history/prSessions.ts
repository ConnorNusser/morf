import { ExerciseWithMax } from '@/types';
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
