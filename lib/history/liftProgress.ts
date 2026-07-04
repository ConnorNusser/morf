// Per-lift progression for the home strip: for each lift, the best working set of
// each month across its history, laid out oldest→newest so the left→right order
// encodes time (the month label under each point makes it explicit). Pure so it's
// unit-testable and node-gate-able.
import { getExercise } from '@/lib/workout/workouts';
import { GeneratedWorkout, WeightUnit, convertWeight } from '@/types';

export interface LiftProgressPoint {
  weight: number; // in the preferred unit; 0 for a bodyweight set
  reps: number;
  date: Date; // the day this month's best set was logged
  monthLabel: string; // "Mar", "Jul"
}

export interface LiftProgress {
  id: string;
  name: string;
  unit: WeightUnit;
  points: LiftProgressPoint[]; // oldest → newest, one per month, capped
}

// Epley 1RM in lbs, so months are compared on a unit-invariant "best set" basis.
const e1rmLbs = (weight: number, reps: number, unit: WeightUnit): number => {
  const lbs = unit === 'lbs' ? weight : convertWeight(weight, unit, 'lbs');
  return lbs * (1 + reps / 30);
};

const monthKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}`;
const monthLabel = (d: Date): string => d.toLocaleDateString('en-US', { month: 'short' });

interface Raw {
  weight: number;
  reps: number;
  date: Date;
  unit: WeightUnit;
}

/**
 * Build the progression strip for the given lift ids (e.g. the user's featured
 * lifts). `months` caps how many recent months with data are shown per lift.
 * Lifts with no logged sets are dropped; the result is ordered by most-recent
 * activity so the lifts you're currently training lead.
 */
export function buildLiftProgressions(
  history: GeneratedWorkout[],
  liftIds: string[],
  unit: WeightUnit,
  months = 4,
): LiftProgress[] {
  const want = new Set(liftIds);
  const byLift = new Map<string, Raw[]>();
  for (const w of history) {
    const date = new Date(w.createdAt);
    for (const ex of w.exercises || []) {
      if (!want.has(ex.id)) continue;
      for (const s of ex.completedSets || []) {
        if (!s.completed) continue;
        const list = byLift.get(ex.id) ?? [];
        list.push({ weight: s.weight, reps: s.reps, date, unit: s.unit });
        byLift.set(ex.id, list);
      }
    }
  }

  const out: LiftProgress[] = [];
  for (const id of liftIds) {
    const sets = byLift.get(id);
    if (!sets || sets.length === 0) continue;

    // Best (highest estimated 1RM) set per calendar month.
    const bestByMonth = new Map<string, { set: Raw; e1rm: number }>();
    for (const s of sets) {
      const key = monthKey(s.date);
      const e1rm = e1rmLbs(s.weight, s.reps, s.unit);
      const cur = bestByMonth.get(key);
      if (!cur || e1rm > cur.e1rm) bestByMonth.set(key, { set: s, e1rm });
    }

    const recent = [...bestByMonth.values()]
      .sort((a, b) => a.set.date.getTime() - b.set.date.getTime())
      .slice(-months);

    const points: LiftProgressPoint[] = recent.map(({ set }) => ({
      weight: Math.round(set.unit === unit ? set.weight : convertWeight(set.weight, set.unit, unit)),
      reps: set.reps,
      date: set.date,
      monthLabel: monthLabel(set.date),
    }));

    out.push({ id, name: getExercise(id)?.name ?? id, unit, points });
  }

  out.sort(
    (a, b) => (b.points[b.points.length - 1]?.date.getTime() ?? 0) - (a.points[a.points.length - 1]?.date.getTime() ?? 0),
  );
  return out;
}
