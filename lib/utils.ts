import { ExerciseSet, MainLiftType, WeightUnit } from "@/types";
import { storageService } from "./storage";
import { getDateDaysAgo } from "./time";

const convertWeightToLbs = (weight: number, unit: WeightUnit): number => {
  if (unit === 'kg') {
    return weight * 2.20462;
  }
  return weight;
};

const convertWeightToKg = (weight: number, unit: WeightUnit): number => {
  if (unit === 'lbs') {
    return weight / 2.20462;
  }
  return weight;
};


// Calculate overall percentile from individual lift percentiles
export const calculateOverallPercentile = (liftPercentiles: number[]): number => {
  if (liftPercentiles.length === 0) return 0;
  const filteredPercentiles = liftPercentiles.filter(percentile => percentile > 0);
  if (filteredPercentiles.length === 0) return 0; // Handle case where all percentiles are 0 or negative
  const sum = filteredPercentiles.reduce((acc, percentile) => acc + percentile, 0);
  return Math.round(sum / filteredPercentiles.length);
};

export const getRecentExercises = async (days: number): Promise<ExerciseSet[]> => {
  const workoutHistory = await storageService.getWorkoutHistory();
  const exercises: ExerciseSet[] = [];
  workoutHistory.forEach(workout => {
    if (workout.createdAt.getTime() > getDateDaysAgo(days).getTime()) {
      workout.exercises.forEach(exercise => {
        exercises.push(exercise);
      });
    }
  });
  return exercises;
};

export const getPreviousExercises = async (days: number): Promise<ExerciseSet[]> => {
  const workoutHistory = await storageService.getWorkoutHistory();
  const exercises: ExerciseSet[] = [];
  workoutHistory.forEach(workout => {
    if (workout.createdAt.getTime() < getDateDaysAgo(days).getTime()) {
      workout.exercises.forEach(exercise => {
        exercises.push(exercise); 
      });
    }
  });
  return exercises;
};

// Calculate improvement trend from user progress 
export const calculateOverallImprovement = async (days?: number): Promise<number> => {
  const mainLifts: MainLiftType[] = ['squat', 'bench-press', 'deadlift', 'overhead-press'];
  if (days === undefined){
    const percentiles: number[] = [];
    mainLifts.forEach(async (lift) => {
      const percentile = await storageService.getPercentileRanking(lift as MainLiftType);
      percentiles.push(percentile);
    });
    return percentiles.reduce((acc, curr) => acc + curr, 0) / percentiles.length;
  }

  const recentExercises = await getRecentExercises(days);
  const previousExercises = await getPreviousExercises(days);

  const recentMainLifts = recentExercises.filter(exercise => mainLifts.includes(exercise.id as MainLiftType));
  const previousMainLifts = previousExercises.filter(exercise => mainLifts.includes(exercise.id as MainLiftType));

  const recentBestLifts = {
    squat: 0,
    benchPress: 0,
    deadlift: 0,
    overheadPress: 0
  }
  const previousBestLifts = {
    squat: 0,
    benchPress: 0,
    deadlift: 0,
    overheadPress: 0
  }


  const recentBestLiftPercentiles: number[] = [];
  return 0;
};

export { convertWeightToKg, convertWeightToLbs };
