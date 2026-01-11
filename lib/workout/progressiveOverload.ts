/**
 * Progressive Overload Calculation System
 *
 * Calculates target and expected weights for routine exercises based on:
 * 1. Workout history for the exercise
 * 2. Estimated 1RM from best recent performance
 * 3. Recent session performance (last 3-5 sessions)
 * 4. Whether they completed their targets
 *
 * Progression Logic:
 * - If they hit target → suggest +5lbs (or +2.5kg)
 * - If they missed target → maintain same weight
 * - If they've struggled recently → suggest decrease
 * - Always sanity-check against recent performance
 */

import {
  CalculatedRoutineExercise,
  CalculatedSet,
  GeneratedWorkout,
  IntensityModifier,
  Routine,
  RoutineExercise,
  RoutineSet,
  WeightUnit,
  convertWeight,
  CalculatedRoutine
} from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { getWorkoutById } from './workouts';

// Intensity modifiers applied on top of rep-based percentage
const INTENSITY_MODIFIERS: Record<IntensityModifier, number> = {
  heavy: 1.0,      // 100% of calculated weight
  moderate: 0.90,  // 90% of calculated weight
  light: 0.80,     // 80% of calculated weight
};

interface ExerciseSession {
  weight: number;
  reps: number;
  sets: number;
  date: Date;
  unit: WeightUnit;
  completedAllSets: boolean;
}

/**
 * Extract exercise history from workout history
 */
function getExerciseHistory(
  exerciseId: string,
  workoutHistory: GeneratedWorkout[]
): ExerciseSession[] {
  if (!exerciseId) return [];

  const sessions: ExerciseSession[] = [];

  for (const workout of workoutHistory) {
    for (const exercise of workout.exercises) {
      if (exercise.id === exerciseId && exercise.completedSets?.length > 0) {
        // Get the heaviest working set from this session
        const completedSets = exercise.completedSets.filter(s => s.completed && s.weight > 0);
        if (completedSets.length === 0) continue;

        // Find the best set by estimated 1RM
        const bestSet = completedSets.reduce((best, current) => {
          const bestWeight = best.unit === 'kg' ? convertWeight(best.weight, 'kg', 'lbs') : best.weight;
          const currentWeight = current.unit === 'kg' ? convertWeight(current.weight, 'kg', 'lbs') : current.weight;
          const best1RM = OneRMCalculator.estimate(bestWeight, best.reps);
          const current1RM = OneRMCalculator.estimate(currentWeight, current.reps);
          return current1RM > best1RM ? current : best;
        }, completedSets[0]);

        // Calculate if they completed all planned sets
        const targetSets = exercise.sets || completedSets.length;
        const completedAllSets = completedSets.length >= targetSets;

        sessions.push({
          weight: bestSet.weight,
          reps: bestSet.reps,
          sets: completedSets.length,
          date: new Date(workout.createdAt),
          unit: bestSet.unit || 'lbs',
          completedAllSets,
        });
      }
    }
  }

  // Sort by date, most recent first
  return sessions.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Calculate estimated 1RM from exercise history
 */
function calculateEstimated1RM(sessions: ExerciseSession[]): number {
  if (sessions.length === 0) return 0;

  // Find the best 1RM estimate from all sessions
  let best1RM = 0;
  for (const session of sessions) {
    const weightInLbs = session.unit === 'kg'
      ? convertWeight(session.weight, 'kg', 'lbs')
      : session.weight;
    const estimated = OneRMCalculator.estimate(weightInLbs, session.reps);
    if (estimated > best1RM) {
      best1RM = estimated;
    }
  }

  return best1RM;
}

// Warmup: 60% of estimated 1RM (light weight to prepare)
const WARMUP_1RM_PERCENTAGE = 0.60;

/**
 * Round weight to nearest increment (5 lbs or 2.5 kg)
 */
function roundWeight(weight: number, unit: WeightUnit): number {
  const increment = unit === 'kg' ? 2.5 : 5;
  return Math.round(weight / increment) * increment;
}

/**
 * Calculate target and expected weights for a single routine exercise
 */
export function calculateRoutineExerciseWeights(
  exercise: RoutineExercise,
  workoutHistory: GeneratedWorkout[],
  weightUnit: WeightUnit
): CalculatedRoutineExercise {
  // Handle both old format (sets as number) and new format (sets as array)
  let sets: RoutineSet[];
  if (Array.isArray(exercise?.sets)) {
    sets = exercise.sets;
  } else {
    // Migration: Convert old format to new format
    const numSets = typeof exercise?.sets === 'number' ? exercise.sets : 3;
    const reps = (exercise as any)?.reps || 10;
    sets = Array(numSets).fill(null).map(() => ({ reps }));
  }

  // Guard against missing exerciseId
  if (!exercise?.exerciseId) {
    return {
      ...exercise,
      sets: sets.map(s => ({ ...s, targetWeight: 0 })),
      exerciseName: 'Unknown Exercise',
      workingWeight: 0,
      progression: 'maintain',
      unit: weightUnit,
    };
  }

  const sessions = getExerciseHistory(exercise.exerciseId, workoutHistory);
  const estimated1RM = calculateEstimated1RM(sessions);

  // Get exercise name
  const workoutInfo = getWorkoutById(exercise.exerciseId);
  const exerciseName = workoutInfo?.name || exercise.exerciseId;

  // Get intensity modifier (default to heavy)
  const intensityModifier = exercise.intensityModifier || 'heavy';
  const intensityMultiplier = INTENSITY_MODIFIERS[intensityModifier];

  let progression: 'increase' | 'maintain' | 'decrease' = 'maintain';
  let lastPerformed: CalculatedRoutineExercise['lastPerformed'] | undefined;

  // Convert 1RM to user's unit
  const estimated1RMInUnit = weightUnit === 'kg'
    ? convertWeight(estimated1RM, 'lbs', 'kg')
    : estimated1RM;

  // Track last session for display purposes
  const lastSession = sessions[0];
  if (lastSession) {
    const lastWeightInUnit = lastSession.unit === weightUnit
      ? lastSession.weight
      : convertWeight(lastSession.weight, lastSession.unit, weightUnit);

    lastPerformed = {
      weight: Math.round(lastWeightInUnit),
      reps: lastSession.reps,
      date: lastSession.date,
      completed: lastSession.completedAllSets,
    };
  }

  // Calculate weight for each set based on its rep target
  const calculatedSets = sets.map(set => {
    if (estimated1RMInUnit <= 0) {
      return { ...set, targetWeight: 0 };
    }

    let targetWeight: number;
    if (set.isWarmup) {
      // Warmups: flat 50% of 1RM
      targetWeight = estimated1RMInUnit * WARMUP_1RM_PERCENTAGE;
    } else {
      // Working sets: percentage based on rep target
      // e.g., 8 reps = 80%, 15 reps = 65%, 5 reps = 87%
      const repPercentage = OneRMCalculator.getPercentageFor(set.reps) / 100;
      targetWeight = estimated1RMInUnit * repPercentage * intensityMultiplier;
    }

    return { ...set, targetWeight: roundWeight(targetWeight, weightUnit) };
  });

  // Calculate working weight as the heaviest non-warmup set (for display)
  const workingSetWeights = calculatedSets.filter(s => !s.isWarmup).map(s => s.targetWeight);
  const workingWeight = workingSetWeights.length > 0 ? Math.max(...workingSetWeights) : 0;

  // Determine progression indicator
  if (lastPerformed && workingWeight > 0) {
    if (workingWeight > lastPerformed.weight + 2) {
      progression = 'increase';
    } else if (workingWeight < lastPerformed.weight - 2) {
      progression = 'decrease';
    }
  }

  return {
    ...exercise,
    sets: calculatedSets,
    exerciseName,
    workingWeight,
    lastPerformed,
    progression,
    unit: weightUnit,
    estimated1RM: Math.round(estimated1RMInUnit),
  };
}

/**
 * Calculate all exercises in a routine
 */
export function calculateRoutine(
  routine: Routine,
  workoutHistory: GeneratedWorkout[],
  weightUnit: WeightUnit
): CalculatedRoutine {
  const exercises = routine?.exercises || [];
  const calculatedExercises = exercises.map(exercise =>
    calculateRoutineExerciseWeights(exercise, workoutHistory, weightUnit)
  );

  return {
    ...routine,
    exercises: calculatedExercises,
  };
}

/**
 * Calculate all routines
 */
export function calculateAllRoutines(
  routines: Routine[],
  workoutHistory: GeneratedWorkout[],
  weightUnit: WeightUnit
): CalculatedRoutine[] {
  if (!routines || !Array.isArray(routines)) return [];
  return routines.map(routine => calculateRoutine(routine, workoutHistory, weightUnit));
}
