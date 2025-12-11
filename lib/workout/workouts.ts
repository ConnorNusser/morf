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
  };

  const userThemeOrder = themeOrder[userThemeLevel];

  return ALL_WORKOUTS.filter(workout =>
    themeOrder[workout.themeLevel] <= userThemeOrder
  );
};

// Helper function to get user's current theme level
export const getUserThemeLevel = (userPercentile: number): ThemeLevel => {
  if (userPercentile >= getThemeRequiredPercentile('god')) return 'god';
  if (userPercentile >= getThemeRequiredPercentile('advanced')) return 'advanced';
  if (userPercentile >= getThemeRequiredPercentile('intermediate')) return 'intermediate';
  return 'beginner';
};

// Helper function to get workouts by muscle group and theme level
export const getWorkoutsByMuscleGroup = (
  muscleGroup: MuscleGroup,
  userPercentile: number
): Workout[] => {
  const availableWorkouts = getAvailableWorkouts(userPercentile);
  return availableWorkouts.filter(workout =>
    workout.primaryMuscles.includes(muscleGroup) ||
    workout.secondaryMuscles.includes(muscleGroup)
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

// Helper function to get compound vs isolation exercises
export const getWorkoutsByCategory = (
  category: WorkoutCategory,
  userPercentile: number
): Workout[] => {
  const availableWorkouts = getAvailableWorkouts(userPercentile);
  return availableWorkouts.filter(workout => workout.category === category);
};

// Function to analyze user's weak points
export const analyzeWeakPoints = (
  userProgress: UserProgress[]
): { weakestMuscleGroups: MuscleGroup[]; recommendations: string[] } => {
  // Sort by percentile ranking to find weak points
  const sortedProgress = [...userProgress].sort((a, b) => a.percentileRanking - b.percentileRanking);

  const weakestLifts = sortedProgress.slice(0, 2); // Top 2 weakest lifts
  const recommendations: string[] = [];
  const weakMuscleGroups: MuscleGroup[] = [];

  weakestLifts.forEach(lift => {
    const workout = MAIN_LIFTS.find(w => w.id === lift.workoutId);
    if (workout) {
      weakMuscleGroups.push(...workout.primaryMuscles);

      if (lift.percentileRanking < 25) {
        recommendations.push(`Focus on ${workout.name} - you're in the ${lift.percentileRanking}th percentile`);
      } else if (lift.percentileRanking < 50) {
        recommendations.push(`Improve ${workout.name} with accessory work`);
      }
    }
  });

  return {
    weakestMuscleGroups: [...new Set(weakMuscleGroups)], // Remove duplicates
    recommendations
  };
};

// Sync version - only checks built-in exercises
export const getWorkoutById = (exerciseId: string): Pick<Workout, 'id' | 'name' | 'description' | 'category' | 'primaryMuscles' | 'equipment'> | null => {
  const allWorkouts = getAvailableWorkouts(100);
  const workout = allWorkouts.find(w => w.id === exerciseId);

  if (!workout) {
    // Don't warn for custom exercises - they need async lookup
    if (!exerciseId.startsWith('custom_') && !exerciseId.includes('-')) {
      console.warn(`⚠️ Exercise not found: ${exerciseId}`);
    }
    return null;
  }

  return {
    id: workout.id,
    name: workout.name,
    description: workout.description,
    category: workout.category,
    primaryMuscles: workout.primaryMuscles,
    equipment: workout.equipment,
  };
};

// Async version - checks both built-in and custom exercises
export const getExerciseById = async (exerciseId: string): Promise<Pick<Workout, 'id' | 'name' | 'description' | 'category' | 'primaryMuscles' | 'equipment'> | null> => {
  // First try built-in exercises
  const builtInWorkout = getWorkoutById(exerciseId);
  if (builtInWorkout) {
    return builtInWorkout;
  }

  // Then try custom exercises
  try {
    const customExercises = await storageService.getCustomExercises();
    const customExercise = customExercises.find(e => e.id === exerciseId);

    if (customExercise) {
      return {
        id: customExercise.id,
        name: customExercise.name,
        description: customExercise.description,
        category: customExercise.category,
        primaryMuscles: customExercise.primaryMuscles,
        equipment: customExercise.equipment,
      };
    }
  } catch (error) {
    console.error('Error fetching custom exercise:', error);
  }

  console.warn(`⚠️ Exercise not found: ${exerciseId}`);
  return null;
};

// Sync version with custom exercises cache - use when you have custom exercises loaded
export const getWorkoutByIdWithCustom = (
  exerciseId: string,
  customExercises: CustomExercise[]
): Pick<Workout, 'id' | 'name' | 'description' | 'category' | 'primaryMuscles' | 'equipment'> | null => {
  // First try built-in exercises
  const builtInWorkout = getWorkoutById(exerciseId);
  if (builtInWorkout) {
    return builtInWorkout;
  }

  // Then try custom exercises from the provided cache
  const customExercise = customExercises.find(e => e.id === exerciseId);
  if (customExercise) {
    return {
      id: customExercise.id,
      name: customExercise.name,
      description: customExercise.description,
      category: customExercise.category,
      primaryMuscles: customExercise.primaryMuscles,
      equipment: customExercise.equipment,
    };
  }

  return null;
}
