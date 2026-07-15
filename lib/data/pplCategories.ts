import { LoggedWorkout, MuscleGroup } from '@/types';
import { EXERCISE_CATALOG, getCatalogExercise } from '@/lib/workout/exerciseCatalog';

export type PPLCategory = 'push' | 'pull' | 'legs';

// The muscle taxonomy lumps biceps and triceps into 'arms' (the grouping is a
// Supabase column and part of the AI prompt contract, so it can't be split),
// but triceps work belongs to push. Without this, every triceps accessory votes
// pull and a bench/OHP day with a few pushdowns reads as a Pull day.
const TRICEPS_NAME = /tricep|skull ?crush|pushdown|jm ?press|diamond|close[- ]grip/i;

/** PPL category for one exercise; 'arms' resolves biceps-vs-triceps by name. */
export function pplForExercise(
  exercise: { name: string; primaryMuscles: MuscleGroup[] } | null | undefined,
): PPLCategory | null {
  const primary = exercise?.primaryMuscles?.[0];
  if (!primary) return null;
  if (primary === 'arms' && TRICEPS_NAME.test(exercise!.name)) return 'push';
  return MUSCLE_TO_PPL[primary] ?? null;
}

/** Dominant category across a set of workouts (one vote per catalog exercise). */
export function dominantPPL(workouts: LoggedWorkout[]): PPLCategory | null {
  const counts: Record<PPLCategory, number> = { push: 0, pull: 0, legs: 0 };
  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      const category = pplForExercise(getCatalogExercise(exercise.id));
      if (category) counts[category]++;
    }
  }
  if (counts.push + counts.pull + counts.legs === 0) return null;
  return (['push', 'pull', 'legs'] as PPLCategory[]).reduce((best, c) =>
    counts[c] > counts[best] ? c : best,
  );
}

export const MUSCLE_TO_PPL: Record<MuscleGroup, PPLCategory> = {
  chest: 'push',
  shoulders: 'push',
  back: 'pull',
  arms: 'pull',
  legs: 'legs',
  glutes: 'legs',
  core: 'push',
  'full-body': 'push',
};

export const PPL_COLORS: Record<PPLCategory, string> = {
  push: '#FF6B6B',
  pull: '#4ECDC4',
  legs: '#9B59B6',
};

export const PPL_LABELS: Record<PPLCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
};

export interface PPLBreakdown {
  counts: Record<PPLCategory, number>;
  total: number;
}

export function calculatePPLBreakdown(exercises: { name: string }[]): PPLBreakdown {
  const counts: Record<PPLCategory, number> = { push: 0, pull: 0, legs: 0 };

  exercises.forEach(ex => {
    const exerciseData = EXERCISE_CATALOG.find(
      w => w.name.toLowerCase() === ex.name.toLowerCase()
    );
    const pplCategory = pplForExercise(exerciseData);
    if (pplCategory) {
      counts[pplCategory]++;
    }
  });

  const total = counts.push + counts.pull + counts.legs;
  return { counts, total };
}
