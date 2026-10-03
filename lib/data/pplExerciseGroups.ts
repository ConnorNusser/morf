import { pplForExercise, PPLCategory } from '@/lib/data/pplCategories';
import { EXERCISE_CATALOG } from '@/lib/workout/exerciseCatalog';

export interface PPLExerciseEntry {
  name: string;
  sets: number;
}

/** Catalog exercises bucketed by PPL category, classified like calculatePPLBreakdown. */
export function groupExercisesByPPL(
  exercises: { name: string; sets: number }[],
): Record<PPLCategory, PPLExerciseEntry[]> {
  const result: Record<PPLCategory, PPLExerciseEntry[]> = {
    push: [],
    pull: [],
    legs: [],
  };

  exercises.forEach(exercise => {
    const exerciseInfo = EXERCISE_CATALOG.find(
      w => w.name.toLowerCase() === exercise.name.toLowerCase()
    );
    const pplCategory = pplForExercise(exerciseInfo);
    if (pplCategory) {
      result[pplCategory].push({
        name: exercise.name,
        sets: exercise.sets,
      });
    }
  });

  return result;
}
