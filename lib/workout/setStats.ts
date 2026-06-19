// Shared helpers for picking the "best" completed set out of a workout exercise.
// Centralizes the filter-completed + kg→lbs-normalized comparison that was
// reimplemented (inconsistently) across progressiveOverload, routineProgression,
// trainingAdvancement, and recapStats.
import { WeightUnit, convertWeight } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';

interface SetLike {
  weight: number;
  reps: number;
  unit?: WeightUnit;
  completed?: boolean;
}

export interface CompletedSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
}

/** Completed working sets (completed && weight > 0), each in its native unit. */
export function completedWorkingSets(sets: SetLike[] | undefined): CompletedSet[] {
  if (!sets) return [];
  return sets
    .filter(s => s.completed && s.weight > 0)
    .map(s => ({ weight: s.weight, reps: s.reps, unit: s.unit ?? 'lbs' }));
}

/**
 * Best completed working set, ranked by estimated 1RM (default) or raw weight.
 * Weights are normalized to lbs for the comparison so mixed-unit sets rank
 * correctly; the winning set is returned in its native unit. Pass the output of
 * completedWorkingSets(). Returns null when there are no qualifying sets.
 */
export function bestCompletedSet(
  sets: CompletedSet[],
  by: 'e1rm' | 'weight' = 'e1rm'
): CompletedSet | null {
  if (sets.length === 0) return null;
  const score = (s: CompletedSet): number => {
    const lbs = convertWeight(s.weight, s.unit, 'lbs');
    return by === 'e1rm' ? OneRMCalculator.estimate(lbs, s.reps) : lbs;
  };
  return sets.reduce((best, s) => (score(s) > score(best) ? s : best));
}
