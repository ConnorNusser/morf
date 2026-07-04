import {
  CustomExercise,
  Equipment,
  MuscleGroup,
  ThemeLevel,
  UserProgress,
  Workout,
  WorkoutCategory,
} from '@/types';
import exercisesData from '@/lib/data/exercises.json';
import { storageService } from '@/lib/storage/storage';
import { getThemeRequiredPercentile } from '@/lib/storage/userProfile';

export {
  Equipment, MuscleGroup, UserProgress, Workout, WorkoutCategory
};

// Load all exercises from JSON
export const ALL_WORKOUTS: Workout[] = exercisesData as Workout[];

// Get main lifts from the exercise database
export const MAIN_LIFTS: Workout[] = ALL_WORKOUTS.filter(workout => workout.isMainLift);

// Helper function to filter workouts by user's theme level
export const getAvailableWorkouts = (userPercentile: number): Workout[] => {
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

  return ALL_WORKOUTS.filter(workout =>
    themeOrder[workout.themeLevel] <= userThemeOrder
  );
};

// Helper function to get workouts by equipment
export const getWorkoutsByEquipment = (
  equipment: Equipment[],
  userPercentile: number
): Workout[] => {
  const availableWorkouts = getAvailableWorkouts(userPercentile);
  return availableWorkouts.filter(workout =>
    workout.equipment.some(eq => equipment.includes(eq))
  );
};

// The subset of exercise fields every resolver returns.
export type ExerciseInfo = Pick<Workout, 'id' | 'name' | 'description' | 'category' | 'primaryMuscles' | 'equipment' | 'trackingType'>;
const pickInfo = (w: Workout | CustomExercise): ExerciseInfo => ({
  id: w.id,
  name: w.name,
  description: w.description,
  category: w.category,
  primaryMuscles: w.primaryMuscles,
  equipment: w.equipment,
  trackingType: w.trackingType,
});

// In-memory mirror of the user's custom exercises, kept in sync by
// CustomExercisesContext (which owns the list). Lets every *sync* lookup resolve
// custom exercises without the caller threading the list or awaiting storage.
let customById = new Map<string, CustomExercise>();
export function setCustomExerciseCache(list: CustomExercise[]): void {
  customById = new Map(list.map(e => [e.id, e]));
}

// Catalog-only lookup. Also the canonical "is this a standard / rankable lift?"
// predicate (leaderboards, strength radar, backend sync) — deliberately blind to
// custom exercises. For an exercise's display info, prefer getExercise().
export const getWorkoutById = (exerciseId: string): ExerciseInfo | null => {
  if (!exerciseId) return null;
  const w = ALL_WORKOUTS.find(x => x.id === exerciseId);
  return w ? pickInfo(w) : null;
};

// Any exercise, catalog or custom (sync, via the mirrored cache). The default for
// display / history / muscle lookups. Replaces the old getWorkoutByIdWithCustom —
// no need to pass the custom list in.
export const getExercise = (exerciseId: string): ExerciseInfo | null => {
  if (!exerciseId) return null;
  const custom = customById.get(exerciseId);
  return getWorkoutById(exerciseId) ?? (custom ? pickInfo(custom) : null);
};

// Async catalog+custom lookup that reads storage directly — for background/service
// code that runs outside React and can't rely on the mirrored cache being hydrated.
export const getExerciseById = async (exerciseId: string): Promise<ExerciseInfo | null> => {
  const builtIn = getWorkoutById(exerciseId);
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
