// Algorithmic autofill: when a user adds an exercise, look up what they did the
// last time they trained it so we can offer to pre-fill those sets. Pure + unit-
// aware (converts stored sets into the user's preferred unit).
import type { DraftSet } from '@/lib/workout/workoutDraft';
import { convertWeight, GeneratedWorkout, WeightUnit } from '@/types';
import { roundWeight } from '@/lib/utils/utils';

/**
 * The most recent completed sets logged for an exercise, in the preferred unit,
 * or null if it's never been trained. Used to offer "autofill last time".
 */
export function getLastSetsFor(
  exerciseId: string,
  history: GeneratedWorkout[],
  unit: WeightUnit,
): DraftSet[] | null {
  const sorted = [...history].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  for (const workout of sorted) {
    const exercise = workout.exercises?.find(e => e.id === exerciseId);
    if (!exercise) continue;
    const sets = (exercise.completedSets || [])
      .filter(s => s.completed)
      .map<DraftSet>(s => ({
        weight: s.unit === unit ? s.weight : roundWeight(convertWeight(s.weight, s.unit, unit), unit),
        reps: s.reps,
        unit,
      }));
    if (sets.length > 0) return sets;
  }
  return null;
}
