import { ExerciseSet, MainLiftType, WeightUnit, WorkoutSplit } from "@/types";
import { storageService } from "./storage";
import { OneRMCalculator } from "./strengthStandards";
import { getDateDaysAgo } from "./time";
import { getWorkoutById } from "./workouts";

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

export const getPercentileSuffix = (percentile: number): string => {
  const percentileFirstChar = percentile.toString()[0];
  if (percentileFirstChar === '1') return 'st';
  if (percentileFirstChar === '2') return 'nd';
  if (percentileFirstChar === '3') return 'rd';
  return 'th';
};

// For auto-generated workouts: Focus on what was trained longest ago
export const analyzeAutoWorkoutFocus = async (workoutHistory: any[]): Promise<{
  recommendedSplit: WorkoutSplit;
  reasoning: string;
  muscleGroupGaps: string[];
}> => {
  const mainLifts: MainLiftType[] = ['squat', 'bench-press', 'deadlift', 'overhead-press'];
  
  // Get the last time each main lift was trained
  const lastTrained: Record<string, number> = {};
  const now = Date.now();
  
  mainLifts.forEach(lift => {
    // Find the most recent workout containing this lift
    const recentWorkout = workoutHistory
      .filter(w => w.exercises.some((e: any) => e.id === lift))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    
    lastTrained[lift] = recentWorkout 
      ? Math.floor((now - new Date(recentWorkout.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      : 999; // Very high number if never trained
  });
  
  // Find which muscle groups haven't been trained in longest
  const muscleGroupGaps: string[] = [];
  
  // Check for leg focus (squat, deadlift)
  const legsDaysSince = Math.min(lastTrained['squat'], lastTrained['deadlift']);
  
  // Check for push focus (bench-press, overhead-press)  
  const pushDaysSince = Math.min(lastTrained['bench-press'], lastTrained['overhead-press']);
  
  // Check for pull focus (deadlift for now - could expand to include rows, etc.)
  const pullDaysSince = lastTrained['deadlift'];
  
  // Determine recommended split based on what's been neglected longest
  let recommendedSplit: WorkoutSplit;
  let reasoning: string;
  
  if (legsDaysSince >= pushDaysSince && legsDaysSince >= pullDaysSince) {
    recommendedSplit = 'legs';
    reasoning = `Legs haven't been trained in ${legsDaysSince} days (squat: ${lastTrained['squat']}d, deadlift: ${lastTrained['deadlift']}d)`;
    if (lastTrained['squat'] > 7) muscleGroupGaps.push('squat movement pattern');
    if (lastTrained['deadlift'] > 7) muscleGroupGaps.push('deadlift movement pattern');
  } else if (pushDaysSince >= pullDaysSince) {
    recommendedSplit = 'push';
    reasoning = `Push muscles haven't been trained in ${pushDaysSince} days (bench: ${lastTrained['bench-press']}d, overhead: ${lastTrained['overhead-press']}d)`;
    if (lastTrained['bench-press'] > 7) muscleGroupGaps.push('bench press movement');
    if (lastTrained['overhead-press'] > 7) muscleGroupGaps.push('overhead pressing');
  } else {
    recommendedSplit = 'pull';
    reasoning = `Pull muscles haven't been trained in ${pullDaysSince} days (deadlift: ${lastTrained['deadlift']}d)`;
    if (lastTrained['deadlift'] > 7) muscleGroupGaps.push('deadlift/pulling movement');
  }
  
  return {
    recommendedSplit,
    reasoning,
    muscleGroupGaps
  };
};

// For user-selected splits: Focus on weaker muscles within that split
export const analyzeSelectedSplitWeaknesses = async (
  workoutHistory: any[], 
  selectedSplit: WorkoutSplit
): Promise<{
  weakerAreas: string[];
  progressionAnalysis: string[];
  progressionIssues: string[];
}> => {
  const weakerAreas: string[] = [];
  const progressionAnalysis: string[] = [];
  const progressionIssues: string[] = [];
  
  // Define exercises that belong to each split
  const splitExercises: Record<WorkoutSplit, string[]> = {
    'push': ['bench-press', 'overhead-press', 'incline-bench-press', 'dumbbell-shoulder-press', 'tricep-extension'],
    'pull': ['deadlift', 'barbell-row', 'lat-pulldown', 'pull-up', 'bicep-curl'],
    'legs': ['squat', 'deadlift', 'leg-press', 'leg-curl', 'calf-raise'],
    'upper-body': ['bench-press', 'overhead-press', 'barbell-row', 'lat-pulldown', 'pull-up'],
    'lower-body': ['squat', 'deadlift', 'leg-press', 'leg-curl', 'calf-raise'],
    'full-body': ['squat', 'bench-press', 'deadlift', 'overhead-press'],
    'calisthenics': ['push-up', 'pull-up', 'bodyweight-squat', 'dip']
  };
  
  const relevantExercises = splitExercises[selectedSplit] || [];
  
  // Split workouts into recent (last 30 days) and older periods
  const cutoffDate = getDateDaysAgo(7);
  const recentWorkouts = workoutHistory.filter(w => new Date(w.createdAt) > cutoffDate);
  const olderWorkouts = workoutHistory.filter(w => new Date(w.createdAt) <= cutoffDate);
  
  relevantExercises.forEach(exerciseId => {
    const exerciseData = getWorkoutById(exerciseId);
    const exerciseName = exerciseData?.name || exerciseId;
    
    // Calculate best estimated 1RM for each period
    const recentSets = recentWorkouts
      .flatMap(w => w.exercises.filter((e: any) => e.id === exerciseId))
      .flatMap((e: any) => e.completedSets || [])
      .filter((set: any) => set.weight && set.reps && set.weight > 0);
    
    const olderSets = olderWorkouts
      .flatMap(w => w.exercises.filter((e: any) => e.id === exerciseId))
      .flatMap((e: any) => e.completedSets || [])
      .filter((set: any) => set.weight && set.reps && set.weight > 0);
    
    const recentBest1RM = recentSets.length > 0 
      ? Math.max(...recentSets.map((s: any) => OneRMCalculator.estimate(s.weight, s.reps)))
      : 0;
    
    const olderBest1RM = olderSets.length > 0 
      ? Math.max(...olderSets.map((s: any) => OneRMCalculator.estimate(s.weight, s.reps)))
      : 0;
    
    // Calculate progression percentage once
    const progressionPercent = (recentBest1RM > 0 && olderBest1RM > 0) 
      ? Math.round(((recentBest1RM - olderBest1RM) / olderBest1RM) * 100)
      : null;
    
    // Always add progression analysis entry
    if (progressionPercent !== null) {
      // Has both periods - show progression
      const sign = progressionPercent >= 0 ? '+' : '';
      progressionAnalysis.push(`${exerciseName}: ${sign}${progressionPercent}% over 30 days (${Math.round(olderBest1RM)}→${Math.round(recentBest1RM)}lbs est. 1RM)`);
    } else if (recentBest1RM > 0) {
      // Only recent data
      progressionAnalysis.push(`${exerciseName}: new/returning (current: ${Math.round(recentBest1RM)}lbs est. 1RM)`);
    } else if (olderBest1RM > 0) {
      // Only old data
      progressionAnalysis.push(`${exerciseName}: not trained recently (previous: ${Math.round(olderBest1RM)}lbs est. 1RM)`);
    } else {
      // Never trained
      progressionAnalysis.push(`${exerciseName}: never trained`);
    }
    
    // Check for issues that need attention
    if (recentBest1RM === 0 && olderBest1RM > 0) {
      progressionIssues.push(`${exerciseName} hasn't been trained in 30+ days`);
      weakerAreas.push(`${exerciseName} frequency`);
    } else if (recentBest1RM === 0 && olderBest1RM === 0) {
      progressionIssues.push(`${exerciseName} never trained - missing from ${selectedSplit} routine`);
      weakerAreas.push(`${exerciseName} introduction`);
    } else if (progressionPercent !== null) {
      if (progressionPercent < -5) {
        progressionIssues.push(`${exerciseName} declining: ${progressionPercent}% over 30 days`);
        weakerAreas.push(`${exerciseName} strength recovery`);
      } else if (progressionPercent === 0) {
        progressionIssues.push(`${exerciseName} stagnant: no progress in 30 days`);
        weakerAreas.push(`${exerciseName} progression`);
      }
    }
  });
  
  return {
    weakerAreas,
    progressionAnalysis,
    progressionIssues
  };
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


export { convertWeightToKg, convertWeightToLbs };
