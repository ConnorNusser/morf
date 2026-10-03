import { MUSCLE_TO_PPL, PPLCategory } from '@/lib/data/pplCategories';
import { EXERCISE_CATALOG } from '@/lib/workout/exerciseCatalog';

export interface PPLExerciseEntry {
  name: string;
  sets: number;
}

/** Catalog exercises bucketed by the PPL category of their first primary muscle. */
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
    if (exerciseInfo && exerciseInfo.primaryMuscles.length > 0) {
      const primaryMuscle = exerciseInfo.primaryMuscles[0];
      const pplCategory = MUSCLE_TO_PPL[primaryMuscle];
      if (pplCategory) {
        result[pplCategory].push({
          name: exercise.name,
          sets: exercise.sets,
        });
      }
    }
  });

  return result;
}
