/**
 * Routine Progression System
 *
 * Implements double progression: increase reps first, then weight.
 * Uses 1RM calculations to determine smart weight increases.
 *
 * Flow:
 * 1. Start at base reps (e.g., 3x8 @ 135 lbs)
 * 2. Complete all sets → add reps based on performance:
 *    - Hit target or 1-2 extra reps: +1 rep per set
 *    - 3-4 extra reps: +2 reps per set (accelerated)
 *    - 5+ extra reps: Auto-increase weight immediately using 1RM
 * 3. At max rep bonus (+3) → next success increases weight using 1RM
 * 4. If fail 3x in a row → deload 10%, reset
 */

import {
  Routine,
  ExerciseProgressionState,
  GeneratedWorkout,
  WeightUnit,
  convertWeight
} from '@/types';
import { getWorkoutById } from './workouts';
import { roundWeight } from '@/lib/utils/utils';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { bestCompletedSet, completedWorkingSets } from './setStats';

// Max rep bonus before weight increase
const MAX_REP_BONUS = 3;

// Failures before suggesting deload
const DELOAD_THRESHOLD = 3;

// Deload percentage
const DELOAD_PERCENT = 0.9;

/**
 * Calculate working weight from 1RM based on target reps
 * Uses standard percentage guidelines from OneRMCalculator
 */
function calculateWorkingWeight(oneRM: number, targetReps: number): number {
  const percentage = OneRMCalculator.getPercentageFor(targetReps);
  return OneRMCalculator.getWeightForPercentage(oneRM, percentage);
}

/**
 * Get minimum weight increment based on exercise type
 * Uses actual exercise category from database
 */
function getMinWeightIncrement(exerciseId: string, unit: WeightUnit): number {
  const exercise = getWorkoutById(exerciseId);

  if (!exercise) {
    return unit === 'kg' ? 2.5 : 5;
  }

  // Use exercise category and primary muscles for smarter detection
  const isCompound = exercise.category === 'compound';
  const primaryMuscles = exercise.primaryMuscles || [];

  // Big compounds (legs, back) - larger increments
  const isBigCompound = isCompound &&
    (primaryMuscles.includes('legs') || primaryMuscles.includes('glutes') || primaryMuscles.includes('back'));

  if (isBigCompound) {
    return unit === 'kg' ? 5 : 10;
  }

  // Upper body compounds (chest, shoulders)
  if (isCompound) {
    return unit === 'kg' ? 2.5 : 5;
  }

  // Isolation exercises - smaller increments
  return unit === 'kg' ? 1.25 : 2.5;
}

/**
 * Calculate next weight based on 1RM from recent performance
 * Looks at best set(s) to estimate true strength
 */
function calculateNextWeight(
  exerciseId: string,
  workout: GeneratedWorkout,
  targetReps: number,
  currentWeight: number,
  unit: WeightUnit
): number {
  const exercise = workout.exercises.find(e => e.id === exerciseId);
  if (!exercise?.completedSets?.length) return currentWeight;

  const workingSets = exercise.completedSets.filter(s => s.completed && s.weight > 0);
  if (workingSets.length === 0) return currentWeight;

  // Calculate 1RM from best 2 sets using averaged formula
  const setsWith1RM = workingSets
    .map(s => ({ weight: s.weight, reps: s.reps, oneRM: OneRMCalculator.estimate(s.weight, s.reps) }))
    .sort((a, b) => b.oneRM - a.oneRM);

  // Use average of top 2 sets (or just 1 if only 1 set)
  const topSets = setsWith1RM.slice(0, 2);
  const estimated1RM = topSets.reduce((sum, s) => sum + s.oneRM, 0) / topSets.length;

  // Calculate appropriate working weight for target reps
  const idealWeight = calculateWorkingWeight(estimated1RM, targetReps);
  const minIncrement = getMinWeightIncrement(exerciseId, unit);

  // Only increase if the calculated weight is meaningfully higher
  const roundedIdeal = roundWeight(idealWeight, unit);

  if (roundedIdeal > currentWeight + minIncrement / 2) {
    // Cap the increase at 2x the normal increment to avoid huge jumps
    const maxIncrease = minIncrement * 2;
    return Math.min(roundedIdeal, currentWeight + maxIncrease);
  }

  // Default: add minimum increment
  return roundWeight(currentWeight + minIncrement, unit);
}

/**
 * Round weight to nearest plate increment
 */

/**
 * Check if exercise was completed successfully
 *
 * Requirements:
 * 1. Calculate the minimum 1RM required (from target sets)
 * 2. Count how many actual sets meet or exceed that 1RM
 * 3. Success if actual count >= target count
 *
 * This allows warmups (low 1RM) without penalty,
 * and ensures they hit the target intensity for enough sets
 */
function wasExerciseSuccessful(
  exerciseId: string,
  workout: GeneratedWorkout
): boolean {
  const exercise = workout.exercises.find(e => e.id === exerciseId);
  if (!exercise || !exercise.completedSets?.length) return false;

  const actualSets = exercise.completedSets.filter(s => s.completed && s.weight > 0);
  if (actualSets.length === 0) return false;

  const targetSets = exercise.targetSets;

  if (!targetSets?.length) {
    return actualSets.length > 0;
  }

  // Get the minimum 1RM from target sets (the "bar" they need to clear)
  const min1RMRequired = Math.min(
    ...targetSets.map(s => OneRMCalculator.estimate(s.weight, s.reps))
  );

  // Count how many actual sets meet or exceed that 1RM
  const qualitySets = actualSets.filter(
    s => OneRMCalculator.estimate(s.weight, s.reps) >= min1RMRequired
  );

  return qualitySets.length >= targetSets.length;
}

/**
 * Calculate 1RM improvement percentage
 * Compares best actual 1RM vs best target 1RM
 */
function get1RMImprovement(
  exerciseId: string,
  workout: GeneratedWorkout
): number {
  const exercise = workout.exercises.find(e => e.id === exerciseId);
  if (!exercise?.completedSets?.length || !exercise.targetSets?.length) {
    return 0;
  }

  const actualSets = exercise.completedSets.filter(s => s.completed && s.weight > 0);
  if (actualSets.length === 0) return 0;

  // Best 1RM from actual sets
  const actualBest1RM = Math.max(
    ...actualSets.map(s => OneRMCalculator.estimate(s.weight, s.reps))
  );

  // Best 1RM from target sets
  const targetBest1RM = Math.max(
    ...exercise.targetSets.map(s => OneRMCalculator.estimate(s.weight, s.reps))
  );

  if (targetBest1RM === 0) return 0;

  const improvement = ((actualBest1RM - targetBest1RM) / targetBest1RM) * 100;

  return improvement;
}

/**
 * Calculate rep bonus based on 1RM improvement percentage
 * - 0-2% improvement: +1 bonus (met target)
 * - 3-5% improvement: +2 bonus (exceeded target)
 * - 6%+ improvement: +3 bonus (crushed it - ready to add weight)
 */
function calculateRepBonusFrom1RM(improvementPercent: number): number {
  if (improvementPercent >= 6) return 3;
  if (improvementPercent >= 3) return 2;
  return 1;
}

/**
 * Get the working weight used in a workout for an exercise
 */
function getWorkoutWeight(
  exerciseId: string,
  workout: GeneratedWorkout,
  unit: WeightUnit
): number {
  const exercise = workout.exercises.find(e => e.id === exerciseId);
  if (!exercise?.completedSets?.length) return 0;

  // Heaviest working set, expressed in the target unit
  const best = bestCompletedSet(completedWorkingSets(exercise.completedSets), 'weight');
  return best ? convertWeight(best.weight, best.unit, unit) : 0;
}

/**
 * Update a routine's progression state after completing a workout
 */
export function updateRoutineProgression(
  routine: Routine,
  workout: GeneratedWorkout,
  weightUnit: WeightUnit
): Routine {
  // Initialize progression state if needed
  const progressionState: Record<string, ExerciseProgressionState> = routine.progressionState
    ? { ...routine.progressionState }
    : {};

  // Process each exercise in the routine
  for (const routineExercise of routine.exercises) {
    const exerciseId = routineExercise.exerciseId;

    // Get or initialize this exercise's progression
    let state = progressionState[exerciseId];
    if (!state) {
      // Get base reps from routine (first working set)
      const workingSets = routineExercise.sets.filter(s => !s.isWarmup);
      const baseReps = workingSets[0]?.reps || 10;

      // Get current weight from workout (or 0 if not performed)
      const currentWeight = getWorkoutWeight(exerciseId, workout, weightUnit);

      state = {
        baseReps,
        currentRepBonus: 0,
        currentWeight,
        consecutiveFailures: 0,
        lastSessionDate: new Date(),
      };
    }

    // Check if they completed this exercise in the workout
    const exerciseInWorkout = workout.exercises.find(e => e.id === exerciseId);
    if (!exerciseInWorkout?.completedSets?.length) {
      // Exercise wasn't performed, skip
      continue;
    }

    // Check success: actual 1RM >= target 1RM for required number of sets
    const success = wasExerciseSuccessful(exerciseId, workout);

    // Update stored weight to what they actually used
    const usedWeight = getWorkoutWeight(exerciseId, workout, weightUnit);
    if (usedWeight > 0) {
      state.currentWeight = usedWeight;
    }

    if (success) {
      // Reset failure counter
      state.consecutiveFailures = 0;

      // Calculate 1RM improvement percentage
      const improvement = get1RMImprovement(exerciseId, workout);

      // Significant improvement (6%+) - they already proved they can handle the weight they used
      if (improvement >= 6) {
        // Just keep the weight they actually used - no additional increase needed
        // They already self-selected a higher weight
        state.currentRepBonus = 0;
      }
      // At max rep bonus (+3) - time to increase weight
      else if (state.currentRepBonus >= MAX_REP_BONUS) {
        const newWeight = calculateNextWeight(
          exerciseId,
          workout,
          state.baseReps,
          state.currentWeight,
          weightUnit
        );
        state.currentWeight = newWeight;
        state.currentRepBonus = 0;
      }
      // Normal progression - add rep bonus based on improvement
      else {
        const bonusIncrease = calculateRepBonusFrom1RM(improvement);
        const newBonus = Math.min(state.currentRepBonus + bonusIncrease, MAX_REP_BONUS);
        state.currentRepBonus = newBonus;
      }
    } else {
      // Failed to complete
      state.consecutiveFailures++;

      if (state.consecutiveFailures >= DELOAD_THRESHOLD) {
        // Deload: reduce weight by 10%, reset everything
        const newWeight = roundWeight(state.currentWeight * DELOAD_PERCENT, weightUnit);
        state.currentWeight = newWeight;
        state.currentRepBonus = 0;
        state.consecutiveFailures = 0;
      }
      // Otherwise, stay at current level (no change)
    }

    state.lastSessionDate = new Date();
    progressionState[exerciseId] = state;
  }

  return {
    ...routine,
    progressionState,
  };
}

