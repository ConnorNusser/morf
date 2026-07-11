import {
  CustomExercise,
  Equipment,
  MuscleGroup,
  ThemeLevel,
  UserProgress,
  Exercise,
  WorkoutCategory,
} from '@/types';
import exercisesData from '@/lib/data/exercises.json';
import { storageService } from '@/lib/storage/storage';
import { getThemeRequiredPercentile } from '@/lib/storage/userProfile';

export {
  Equipment, MuscleGroup, UserProgress, Exercise, WorkoutCategory
};

export const EXERCISE_CATALOG: Exercise[] = exercisesData as Exercise[];

// Distinct name from types' MAIN_LIFTS id-map — this is the catalog rows whose
// json isMainLift flag is set (an invariant test ties the two together).
export const MAIN_LIFT_EXERCISES: Exercise[] = EXERCISE_CATALOG.filter(workout => workout.isMainLift);

export const getAvailableExercises = (userPercentile: number): Exercise[] => {
  const getUserThemeLevel = (percentile: number): ThemeLevel => {
    if (percentile >= getThemeRequiredPercentile('god')) return 'god';
    if (percentile >= getThemeRequiredPercentile('advanced')) return 'advanced';
    if (percentile >= getThemeRequiredPercentile('intermediate')) return 'intermediate';
    return 'beginner';
  };

  const userThemeLevel = getUserThemeLevel(userPercentile);
  const themeOrder: Record<ThemeLevel, number> = {
    beginner: 1,
    beginner_dark: 1,
    intermediate: 2,
    advanced: 3,
    elite: 4,
    god: 5,
    share_warm: 5,
    share_cool: 5,
    winter_2026: 5,
  };

  const userThemeOrder = themeOrder[userThemeLevel];

  return EXERCISE_CATALOG.filter(workout =>
    themeOrder[workout.themeLevel] <= userThemeOrder
  );
};

export const getExercisesByEquipment = (
  equipment: Equipment[],
  userPercentile: number
): Exercise[] => {
  const availableWorkouts = getAvailableExercises(userPercentile);
  return availableWorkouts.filter(workout =>
    workout.equipment.some(eq => equipment.includes(eq))
  );
};

// The subset of exercise fields every resolver returns.
export type ExerciseInfo = Pick<Exercise, 'id' | 'name' | 'description' | 'category' | 'primaryMuscles' | 'equipment' | 'trackingType'>;
const pickInfo = (w: Exercise | CustomExercise): ExerciseInfo => ({
  id: w.id,
  name: w.name,
  description: w.description,
  category: w.category,
  primaryMuscles: w.primaryMuscles,
  equipment: w.equipment,
  trackingType: w.trackingType,
});

// In-memory mirror of custom exercises, kept in sync by CustomExercisesContext,
// so sync lookups resolve custom exercises without threading the list or awaiting storage.
let customById = new Map<string, CustomExercise>();
export function setCustomExerciseCache(list: CustomExercise[]): void {
  customById = new Map(list.map(e => [e.id, e]));
}

// Catalog-only lookup. Also the canonical "is this a standard / rankable lift?"
// predicate (leaderboards, strength radar, backend sync) — deliberately blind to
// custom exercises. For display info, prefer getExercise().
export const getCatalogExercise = (exerciseId: string): ExerciseInfo | null => {
  if (!exerciseId) return null;
  const w = EXERCISE_CATALOG.find(x => x.id === exerciseId);
  return w ? pickInfo(w) : null;
};

// Any exercise, catalog or custom (sync, via the mirrored cache). Default for
// display / history / muscle lookups.
export const getExercise = (exerciseId: string): ExerciseInfo | null => {
  if (!exerciseId) return null;
  const custom = customById.get(exerciseId);
  return getCatalogExercise(exerciseId) ?? (custom ? pickInfo(custom) : null);
};

// Async catalog+custom lookup that reads storage directly — for background/service
// code outside React that can't rely on the mirrored cache being hydrated.
export const getExerciseById = async (exerciseId: string): Promise<ExerciseInfo | null> => {
  const builtIn = getCatalogExercise(exerciseId);
  if (builtIn) return builtIn;
  try {
    const customExercises = await storageService.getCustomExercises();
    const custom = customExercises.find(e => e.id === exerciseId);
    if (custom) return pickInfo(custom);
  } catch (error) {
    console.error('Error fetching custom exercise:', error);
  }
  return null;
};
