// Autofill an added exercise from its last training session. Unit-aware.
import type { DraftSet } from '@/lib/workout/workoutDraft';
import { convertWeight, LoggedWorkout, WeightUnit } from '@/types';
import { roundWeight } from '@/lib/utils/utils';

// Most recent completed sets for an exercise in the preferred unit, or null if never trained.
export function getLastSetsFor(
  exerciseId: string,
  history: LoggedWorkout[],
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
