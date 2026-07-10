/** Calculates target/expected weights for routine exercises from workout history. */

import {
  CalculatedRoutineExercise,
  ExerciseRecord,
  GeneratedWorkout,
  Routine,
  RoutineExercise,
  RoutineSet,
  WeightUnit,
  convertWeight,
  CalculatedRoutine
} from '@/types';
import { roundWeight } from '@/lib/utils/utils';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { LastPerformance, LoggedSet, nextPrescription, loadIncrement, recordableSet, NextPrescription } from './progression';
import { getWorkoutById } from './workouts';

/** The coach's-notebook anchor: this routine's own column in the log. */
export interface RoutineAnchor extends LastPerformance {
  at: Date;
}

/** Anchor for (routine, exercise): the working set from the most recent saved
 *  session OF THIS ROUTINE that logged the exercise. Freestyle sessions and
 *  other days can't move it — each routine progresses against its own last
 *  performance, so a 3×12 day and a 5×5 day sharing an exercise never read each
 *  other's work as a miss or a top-out. Derived from history (workouts carry
 *  routineId); no stored counter to drift. */
export function getRoutineAnchor(
  routineId: string,
  exerciseId: string,
  history: GeneratedWorkout[],
): RoutineAnchor | null {
  const sessions = history
    .filter(w => w.routineId === routineId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const w of sessions) {
    const ex = w.exercises?.find(e => e.id === exerciseId);
    if (!ex) continue;
    const set = recordableSet((ex.completedSets ?? []) as LoggedSet[]);
    if (set) return { ...set, at: new Date(w.createdAt) };
  }
  return null;
}

// A global record whose reps sit within this of the slot's floor is judged by the
// progression rule directly; further out it's another day's work and gets
// re-expressed at the slot's reps instead (seedWeight).
const REP_RANGE_TOLERANCE = 2;

/** Seed a slot with no history of its own from the global working set. The
 *  record is the CURRENT working set (not best-ever e1RM — that's a trophy),
 *  re-expressed at the slot's reps via the rep-max curve (getPercentageFor)
 *  and rounded down an increment: a conservative starting point the first
 *  session validates, after which the routine's own anchor takes over. */
function seedWeight(
  record: ExerciseRecord,
  floorReps: number,
  weightUnit: WeightUnit,
  increment: number,
): number {
  const lbs = record.unit === 'lbs' ? record.weight : convertWeight(record.weight, record.unit, 'lbs');
  const equivalentLbs =
    OneRMCalculator.estimate(lbs, record.reps) * (OneRMCalculator.getPercentageFor(floorReps) / 100);
  const display = weightUnit === 'kg' ? convertWeight(equivalentLbs, 'lbs', 'kg') : equivalentLbs;
  return Math.max(increment, Math.floor(display / increment) * increment - increment);
}

/** Compute display targets for one routine exercise via reactive double
 *  progression against this routine's own anchor. No anchor yet → seed from the
 *  global working set (rep-translated when the ranges differ); no record at all
 *  → cold-start, working sets stay blank (0). */
function calculateRoutineExerciseWeights(
  exercise: RoutineExercise,
  weightUnit: WeightUnit,
  record?: ExerciseRecord,
  anchor?: RoutineAnchor | null
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

  const increment = loadIncrement(exercise.exerciseId, weightUnit);
  const range = { floor: workingReps, ceiling: workingReps + 2 };

  let prescription: NextPrescription | undefined;
  let lastPerformed: CalculatedRoutineExercise['lastPerformed'] | undefined;
  if (anchor) {
    // This routine's own last session — run the progression rule against it.
    const anchorWeight = anchor.unit === weightUnit
      ? anchor.weight
      : convertWeight(anchor.weight, anchor.unit, weightUnit);
    prescription = nextPrescription(
      { weight: anchorWeight, reps: anchor.reps, unit: weightUnit },
      range,
      increment,
    );
    lastPerformed = { weight: Math.round(anchorWeight), reps: anchor.reps, date: anchor.at, completed: true };
  } else if (record) {
    // No history in this routine yet — seed from the global working set.
    const recordWeight = record.unit === weightUnit
      ? record.weight
      : convertWeight(record.weight, record.unit, weightUnit);
    if (Math.abs(record.reps - workingReps) <= REP_RANGE_TOLERANCE) {
      // Same rep neighborhood: the record is directly comparable.
      prescription = nextPrescription(
        { weight: recordWeight, reps: record.reps, unit: weightUnit },
        range,
        increment,
      );
    } else {
      // Another day's rep range: re-express it at this slot's reps and hold.
      prescription = { weight: seedWeight(record, workingReps, weightUnit, increment), reps: workingReps, change: 'hold' };
    }
    lastPerformed = { weight: Math.round(recordWeight), reps: record.reps, date: record.updatedAt, completed: true };
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

/** Calculate one routine's display targets. Each exercise anchors to this
 *  routine's own history first; the global record only seeds slots with no
 *  history of their own. */
export function calculateRoutine(
  routine: Routine,
  records: Record<string, ExerciseRecord>,
  weightUnit: WeightUnit,
  history: GeneratedWorkout[] = []
): CalculatedRoutine {
  const exercises = routine?.exercises || [];
  return {
    ...routine,
    exercises: exercises.map(exercise =>
      calculateRoutineExerciseWeights(
        exercise,
        weightUnit,
        records[exercise.exerciseId],
        exercise.exerciseId ? getRoutineAnchor(routine.id, exercise.exerciseId, history) : null
      )
    ),
  };
}

export function calculateAllRoutines(
  routines: Routine[],
  records: Record<string, ExerciseRecord>,
  weightUnit: WeightUnit,
  history: GeneratedWorkout[] = []
): CalculatedRoutine[] {
  if (!routines || !Array.isArray(routines)) return [];
  return routines.map(routine => calculateRoutine(routine, records, weightUnit, history));
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
