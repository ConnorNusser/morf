/** Calculates target/expected weights for routine exercises from workout history. */

import {
  CalculatedRoutineExercise,
  ExerciseRecord,
  Routine,
  RoutineExercise,
  RoutineSet,
  WeightUnit,
  convertWeight,
  CalculatedRoutine
} from '@/types';
import { roundWeight } from '@/lib/utils/utils';
import { nextPrescription, loadIncrement, NextPrescription } from './progression';
import { getWorkoutById } from './workouts';


/** Compute display targets for one routine exercise, anchoring to the global
 *  ExerciseRecord and applying reactive double progression. No estimated-1RM math,
 *  so the number can never exceed what you've demonstrated. Cold-start (no record)
 *  shows blank (0) working sets until the first logged session. */
function calculateRoutineExerciseWeights(
  exercise: RoutineExercise,
  weightUnit: WeightUnit,
  record?: ExerciseRecord
): CalculatedRoutineExercise {
  // Handle both old format (sets as number) and new (sets as array).
  let sets: RoutineSet[];
  if (Array.isArray(exercise?.sets)) {
    sets = exercise.sets;
  } else {
    const numSets = typeof exercise?.sets === 'number' ? exercise.sets : 3;
    const reps = (exercise as any)?.reps || 10;
    sets = Array(numSets).fill(null).map(() => ({ reps }));
  }

  // Prefer stored name, fall back to lookup for legacy routines.
  let exerciseName = exercise.exerciseName;
  if (!exerciseName) {
    exerciseName = getWorkoutById(exercise.exerciseId)?.name || exercise.exerciseId;
  }

  if (!exercise?.exerciseId) {
    return {
      ...exercise,
      sets: sets.map(s => ({ ...s, targetWeight: 0 })),
      exerciseName: exerciseName || 'Unknown Exercise',
      workingWeight: 0,
      progression: 'maintain',
      unit: weightUnit,
    };
  }

  // Programmed working-set reps are the rep-range floor.
  const workingReps = sets.find(s => !s.isWarmup)?.reps ?? sets[0]?.reps ?? 10;

  // Anchor to the record (in display unit) and run the progression rule; no record
  // means cold-start and working sets stay blank (0).
  let prescription: NextPrescription | undefined;
  let lastPerformed: CalculatedRoutineExercise['lastPerformed'] | undefined;
  if (record) {
    const anchorWeight = record.unit === weightUnit
      ? record.weight
      : convertWeight(record.weight, record.unit, weightUnit);
    prescription = nextPrescription(
      { weight: anchorWeight, reps: record.reps, unit: weightUnit },
      { floor: workingReps, ceiling: workingReps + 2 },
      loadIncrement(exercise.exerciseId, weightUnit),
    );
    lastPerformed = { weight: Math.round(anchorWeight), reps: record.reps, date: record.updatedAt, completed: true };
  }

  const calculatedSets = sets.map(set => {
    if (!prescription) return { ...set, targetWeight: 0 }; // cold-start
    if (set.isWarmup) return { ...set, targetWeight: roundWeight(prescription.weight * 0.6, weightUnit) };
    return { ...set, reps: prescription.reps, targetWeight: prescription.weight };
  });

  const workingWeight = prescription?.weight ?? 0;

  let progression: 'increase' | 'maintain' | 'decrease' = 'maintain';
  if (prescription?.change === 'increase' || prescription?.change === 'add-rep') progression = 'increase';
  else if (prescription?.change === 'deload') progression = 'decrease';

  const estimated1RM = record
    ? Math.round(weightUnit === 'kg' ? convertWeight(record.bestE1RMLbs, 'lbs', 'kg') : record.bestE1RMLbs)
    : 0;

  return {
    ...exercise,
    sets: calculatedSets,
    exerciseName,
    workingWeight,
    lastPerformed,
    progression,
    unit: weightUnit,
    estimated1RM,
  };
}

/** Calculate one routine's display targets, anchored to the global exercise records. */
export function calculateRoutine(
  routine: Routine,
  records: Record<string, ExerciseRecord>,
  weightUnit: WeightUnit
): CalculatedRoutine {
  const exercises = routine?.exercises || [];
  return {
    ...routine,
    exercises: exercises.map(exercise =>
      calculateRoutineExerciseWeights(exercise, weightUnit, records[exercise.exerciseId])
    ),
  };
}

export function calculateAllRoutines(
  routines: Routine[],
  records: Record<string, ExerciseRecord>,
  weightUnit: WeightUnit
): CalculatedRoutine[] {
  if (!routines || !Array.isArray(routines)) return [];
  return routines.map(routine => calculateRoutine(routine, records, weightUnit));
}


// Adherence measures progress against the program's own prescription, not e1RM:
// a routine rarely asks for a true max, so raw e1RM bounces with rep/weight
// selection and reads as "declining" even when every prescribed mark is hit.
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
