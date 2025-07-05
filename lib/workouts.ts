import {
  Equipment,
  MuscleGroup,
  ThemeLevel,
  UserProgress,
  Workout,
  WorkoutCategory,
  WorkoutFilters,
} from '@/types';
import exercisesData from './exercises.json';
import { getThemeRequiredPercentile } from './userProfile';

export {
  Equipment, MuscleGroup, UserProgress, Workout, WorkoutCategory, WorkoutFilters
};

// Load all exercises from JSON
export const ALL_WORKOUTS: Workout[] = exercisesData as Workout[];

// Get main lifts from the exercise database
export const MAIN_LIFTS: Workout[] = ALL_WORKOUTS.filter(workout => workout.isMainLift);

// Helper function to filter workouts by user's theme level and filters
export const getAvailableWorkouts = (
  userPercentile: number, 
  filters?: WorkoutFilters
): Workout[] => {
  const getUserThemeLevel = (percentile: number): ThemeLevel => {
    if (percentile >= getThemeRequiredPercentile('god')) return 'god';
    if (percentile >= getThemeRequiredPercentile('advanced')) return 'advanced';
    if (percentile >= getThemeRequiredPercentile('intermediate')) return 'intermediate';
    return 'beginner';
  };

  const userThemeLevel = getUserThemeLevel(userPercentile);
  const themeOrder: Record<ThemeLevel, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    elite: 4,
    god: 5,
  };

  const userThemeOrder = themeOrder[userThemeLevel];

  let availableWorkouts = ALL_WORKOUTS.filter(workout => 
    themeOrder[workout.themeLevel] <= userThemeOrder
  );

  // Apply filters if provided - much simpler now!
  if (filters && filters.excludedWorkoutIds.length > 0) {
    availableWorkouts = availableWorkouts.filter(workout => 
      !filters.excludedWorkoutIds.includes(workout.id)
    );
  }

  return availableWorkouts;
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
  userPercentile: number,
  filters?: WorkoutFilters
): Workout[] => {
  const availableWorkouts = getAvailableWorkouts(userPercentile, filters);
  return availableWorkouts.filter(workout => 
    workout.primaryMuscles.includes(muscleGroup) || 
    workout.secondaryMuscles.includes(muscleGroup)
  );
};

// Helper function to get workouts by equipment
export const getWorkoutsByEquipment = (
  equipment: Equipment[], 
  userPercentile: number,
  filters?: WorkoutFilters
): Workout[] => {
  const availableWorkouts = getAvailableWorkouts(userPercentile, filters);
  return availableWorkouts.filter(workout => 
    workout.equipment.some(eq => equipment.includes(eq))
  );
};

// Helper function to get compound vs isolation exercises
export const getWorkoutsByCategory = (
  category: WorkoutCategory, 
  userPercentile: number,
  filters?: WorkoutFilters
): Workout[] => {
  const availableWorkouts = getAvailableWorkouts(userPercentile, filters);
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

export const getWorkoutById = (exerciseId: string): Pick<Workout, 'id' | 'name' | 'description' | 'category' | 'primaryMuscles' | 'equipment'> | null => {
  const allWorkouts = getAvailableWorkouts(100);
  const workout = allWorkouts.find(w => w.id === exerciseId);
  
  if (!workout) {
    console.warn(`⚠️ Exercise not found: ${exerciseId}`);
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
}