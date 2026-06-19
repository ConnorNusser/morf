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
  ExerciseProgressionState,
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
import { roundWeight } from '@/lib/utils/utils';
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

/**
 * Calculate target and expected weights for a single routine exercise
 * If progressionState is provided, uses tracked progression (weight + rep bonus)
 * Otherwise falls back to 1RM-based calculation from history
 */
function calculateRoutineExerciseWeights(
  exercise: RoutineExercise,
  workoutHistory: GeneratedWorkout[],
  weightUnit: WeightUnit,
  progressionState?: ExerciseProgressionState
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

  // Get exercise name - prefer stored name, fall back to lookup for legacy routines
  let exerciseName = exercise.exerciseName;
  if (!exerciseName) {
    const workoutInfo = getWorkoutById(exercise.exerciseId);
    exerciseName = workoutInfo?.name || exercise.exerciseId;
  }

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

  // Calculate weight for each set
  // If progressionState exists, use tracked weight and apply rep bonus
  // Otherwise fall back to 1RM-based calculation
  const calculatedSets = sets.map(set => {
    let targetWeight: number;
    let targetReps = set.reps;

    if (progressionState && progressionState.currentWeight > 0) {
      // Use progression-tracked weight
      if (set.isWarmup) {
        // Warmups: 60% of working weight
        targetWeight = progressionState.currentWeight * 0.6;
      } else {
        // Working sets use tracked weight directly
        targetWeight = progressionState.currentWeight;
        // Apply rep bonus from progression
        targetReps = progressionState.baseReps + progressionState.currentRepBonus;
      }
    } else if (estimated1RMInUnit > 0) {
      // Fall back to 1RM-based calculation
      if (set.isWarmup) {
        targetWeight = estimated1RMInUnit * WARMUP_1RM_PERCENTAGE;
      } else {
        const repPercentage = OneRMCalculator.getPercentageFor(set.reps) / 100;
        targetWeight = estimated1RMInUnit * repPercentage * intensityMultiplier;
      }
    } else {
      targetWeight = 0;
    }

    return {
      ...set,
      reps: targetReps,
      targetWeight: roundWeight(targetWeight, weightUnit),
    };
  });

  // Calculate working weight as the heaviest non-warmup set (for display)
  const workingSetWeights = calculatedSets.filter(s => !s.isWarmup).map(s => s.targetWeight);
  const workingWeight = workingSetWeights.length > 0 ? Math.max(...workingSetWeights) : 0;

  // Determine progression indicator
  // Priority: failures > rep bonuses > weight increases
  // Note: We don't show 'decrease' just because weight dropped (could be intentional deload)
  // Only show 'decrease' when there are consecutive failures
  if (progressionState) {
    if (progressionState.consecutiveFailures >= 2) {
      // Two consecutive failures = declining
      progression = 'decrease';
    } else if (progressionState.currentRepBonus > 0) {
      // Earning rep bonuses = improving
      progression = 'increase';
    } else if (lastPerformed && workingWeight > lastPerformed.weight + 2) {
      // Weight increased = improving
      progression = 'increase';
    }
    // else: maintain (stable) - includes post-deload state
  } else if (lastPerformed && workingWeight > 0) {
    // No progression state, fall back to weight comparison for improvement only
    if (workingWeight > lastPerformed.weight + 2) {
      progression = 'increase';
    }
    // Don't show decrease without progression tracking
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
 * Uses routine's progressionState if available for each exercise
 */
export function calculateRoutine(
  routine: Routine,
  workoutHistory: GeneratedWorkout[],
  weightUnit: WeightUnit
): CalculatedRoutine {
  const exercises = routine?.exercises || [];
  const calculatedExercises = exercises.map(exercise => {
    // Get progression state for this exercise if it exists
    const progressionState = routine.progressionState?.[exercise.exerciseId];
    return calculateRoutineExerciseWeights(exercise, workoutHistory, weightUnit, progressionState);
  });

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

export interface StrengthTrend {
  current1RM: number;   // estimated 1RM of the latest session, in display unit
  delta1RM: number;     // current minus baseline, in display unit
  deltaPercent: number; // rounded percentage change vs baseline
  direction: 'up' | 'down' | 'flat';
  sessions: number;     // how many logged sessions back this exercise
}

// Strength trend for one exercise: latest estimated 1RM vs a baseline ~3+ weeks
// back (falling back to the oldest logged session). Lets the Routines screen
// show whether the numbers are actually moving, not just the next target.
// Returns null when the exercise has never been logged.
export function getStrengthTrend(
  exerciseId: string,
  workoutHistory: GeneratedWorkout[],
  weightUnit: WeightUnit
): StrengthTrend | null {
  const sessions = getExerciseHistory(exerciseId, workoutHistory); // most-recent first
  if (sessions.length === 0) return null;

  const oneRM = (s: ExerciseSession): number => {
    const lbs = s.unit === 'kg' ? convertWeight(s.weight, 'kg', 'lbs') : s.weight;
    return OneRMCalculator.estimate(lbs, s.reps);
  };
  const toUnit = (lbs: number): number =>
    weightUnit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs;

  const newest = sessions[0];
  const currentLbs = oneRM(newest);

  if (sessions.length < 2) {
    return { current1RM: Math.round(toUnit(currentLbs)), delta1RM: 0, deltaPercent: 0, direction: 'flat', sessions: sessions.length };
  }

  // Baseline: the most recent session that's at least ~3 weeks older than the
  // latest — "now vs ~a month ago". If everything is recent, use the oldest.
  const THREE_WEEKS = 21 * 24 * 60 * 60 * 1000;
  let baseline = sessions[sessions.length - 1];
  for (let i = 1; i < sessions.length; i++) {
    if (newest.date.getTime() - sessions[i].date.getTime() >= THREE_WEEKS) {
      baseline = sessions[i];
      break;
    }
  }

  const baselineLbs = oneRM(baseline);
  const deltaLbs = currentLbs - baselineLbs;
  const deltaPercent = baselineLbs > 0 ? Math.round((deltaLbs / baselineLbs) * 100) : 0;
  const direction: StrengthTrend['direction'] = deltaPercent >= 1 ? 'up' : deltaPercent <= -1 ? 'down' : 'flat';

  return {
    current1RM: Math.round(toUnit(currentLbs)),
    delta1RM: Math.round(toUnit(deltaLbs)),
    deltaPercent,
    direction,
    sessions: sessions.length,
  };
}

// Whether a routine exercise is progressing *against the program's own
// prescription* — rep bonuses earned, working weight climbing, or stalling out.
// This deliberately ignores estimated 1RM: a routine rarely asks for a true max,
// so raw e1RM bounces with rep/weight selection and reads as "declining" even
// when the lifter is hitting every prescribed mark. Adherence is the source of
// truth for "improving"; e1RM is left to the analytics/strength screens.
//   improving — beating the prescription (rep bonus or weight up)
//   holding   — meeting it, no recent gain (includes intentional post-deload)
//   easing    — repeated misses; the program is backing the weight off
//   new       — never logged, nothing to judge yet
export type AdherenceStatus = 'improving' | 'holding' | 'easing' | 'new';

export function getExerciseAdherenceStatus(
  exercise: CalculatedRoutineExercise
): AdherenceStatus {
  if (!exercise.lastPerformed) return 'new';
  if (exercise.progression === 'increase') return 'improving';
  if (exercise.progression === 'decrease') return 'easing';
  return 'holding';
}
