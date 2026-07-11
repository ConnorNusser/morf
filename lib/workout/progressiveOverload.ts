/** Calculates target/expected weights for routine exercises from workout history. */

import {
  CalculatedRoutineExercise,
  ExerciseRecord,
  LoggedWorkout,
  Routine,
  RoutineExercise,
  RoutineSet,
  WeightUnit,
  convertWeight,
  CalculatedRoutine
} from '@/types';
import { roundWeight } from '@/lib/utils/utils';
import { LastPerformance, LoggedSet, nextPrescription, loadIncrement, resolveWorkingSet, NextPrescription } from './progression';
import { getCatalogExercise } from './exerciseCatalog';

/** The coach's-notebook anchor: this routine's own column in the log. */
export interface RoutineAnchor extends LastPerformance {
  at: Date;
}

/** Working set from this routine's most recent readable session — other days and
 *  freestyle sessions can't move it. `occurrence`: the nth slot of a duplicated
 *  exercise reads the nth logged entry. An unreadable session (nothing resolves)
 *  is skipped rather than guessed at. */
export function getRoutineAnchor(
  routineId: string,
  exerciseId: string,
  history: LoggedWorkout[],
  occurrence = 0,
): RoutineAnchor | null {
  const sessions = history
    .filter(w => w.routineId === routineId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  for (const w of sessions) {
    const ex = (w.exercises ?? []).filter(e => e.id === exerciseId)[occurrence];
    if (!ex) continue;
    const set = resolveWorkingSet((ex.completedSets ?? []) as LoggedSet[]);
    if (set) return { ...set, at: new Date(w.createdAt) };
  }
  return null;
}

// Reps within this of the slot's floor are directly comparable; further out is
// another rep range's work and gets re-expressed (equivalentWeight).
const REP_RANGE_TOLERANCE = 2;

// Anchors older than this with a fresher record reseed (layoffs).
const ANCHOR_STALE_MS = 56 * 24 * 60 * 60 * 1000; // 8 weeks

/** Re-express a performed set at a different rep count via the Epley ratio
 *  (weight × (1 + reps/30) is unit-free, so no damped-e1RM/percentage-table
 *  distortion at high reps), grid-floored to the increment. Prescribed as a
 *  hold, so the next session validates it. Clamped monotonic against reality:
 *  asking FEWER reps than performed can never prescribe below the performed
 *  weight; asking more can never prescribe above it. */
function equivalentWeight(
  performed: LastPerformance,
  floorReps: number,
  weightUnit: WeightUnit,
  increment: number,
): number {
  const performedDisplay = performed.unit === weightUnit
    ? performed.weight
    : convertWeight(performed.weight, performed.unit, weightUnit);
  const display = performedDisplay * (1 + performed.reps / 30) / (1 + floorReps / 30);
  const estimated = Math.max(increment, Math.floor(display / increment) * increment);

  if (floorReps <= performed.reps) {
    return Math.max(estimated, Math.ceil(performedDisplay / increment) * increment);
  }
  return Math.min(estimated, Math.max(increment, Math.floor(performedDisplay / increment) * increment));
}

/** Targets for one routine exercise: double progression against the routine's
 *  own anchor; no anchor → seed from the global record; no record → blank. */
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
    exerciseName = getCatalogExercise(exercise.exerciseId)?.name || exercise.exerciseId;
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
  const inBand = (reps: number) => Math.abs(reps - workingReps) <= REP_RANGE_TOLERANCE;

  const anchorStale =
    anchor && record &&
    new Date(record.updatedAt).getTime() > anchor.at.getTime() &&
    Date.now() - anchor.at.getTime() > ANCHOR_STALE_MS;

  let prescription: NextPrescription | undefined;
  let lastPerformed: CalculatedRoutineExercise['lastPerformed'] | undefined;
  if (anchor && !anchorStale) {
    const anchorWeight = anchor.unit === weightUnit
      ? anchor.weight
      : convertWeight(anchor.weight, anchor.unit, weightUnit);
    if (anchorWeight === 0 || inBand(anchor.reps)) {
      // Bodyweight anchors are reps-only — never rep-translated, whatever the reps.
      prescription = nextPrescription(
        { weight: anchorWeight, reps: anchor.reps, unit: weightUnit },
        range,
        increment,
      );
    } else {
      // Routine's reps were edited since that session — translate, don't judge.
      prescription = { weight: equivalentWeight(anchor, workingReps, weightUnit, increment), reps: workingReps, change: 'hold' };
    }
    lastPerformed = { weight: Math.round(anchorWeight), reps: anchor.reps, date: anchor.at, completed: true };
  } else if (record) {
    // Seed from the global record and HOLD — day one validates; it never earns
    // an increase off another day's work.
    const recordWeight = record.unit === weightUnit
      ? record.weight
      : convertWeight(record.weight, record.unit, weightUnit);
    const seed = recordWeight === 0
      ? 0 // bodyweight record seeds bodyweight
      : inBand(record.reps)
        ? roundWeight(recordWeight, weightUnit)
        : equivalentWeight(record, workingReps, weightUnit, increment);
    prescription = { weight: seed, reps: workingReps, change: 'hold' };
    lastPerformed = { weight: Math.round(recordWeight), reps: record.reps, date: record.updatedAt, completed: true };
  }

  // Warmups ramp toward 60% — distinct weights, so a warmup pair can never be
  // mistaken for the working set.
  const warmupCount = sets.filter(s => s.isWarmup).length;
  let warmupIndex = 0;
  const calculatedSets = sets.map(set => {
    if (!prescription) return { ...set, targetWeight: 0 }; // cold-start
    if (set.isWarmup) {
      const fraction = Math.max(0.3, 0.6 - 0.15 * (warmupCount - 1 - warmupIndex));
      warmupIndex += 1;
      return { ...set, targetWeight: roundWeight(prescription.weight * fraction, weightUnit) };
    }
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

/** One routine's display targets, anchored to its own history. */
export function calculateRoutine(
  routine: Routine,
  records: Record<string, ExerciseRecord>,
  weightUnit: WeightUnit,
  history: LoggedWorkout[] = []
): CalculatedRoutine {
  const exercises = routine?.exercises || [];
  // nth slot of a duplicated exercise reads the nth logged entry.
  const seen = new Map<string, number>();
  return {
    ...routine,
    exercises: exercises.map(exercise => {
      const occurrence = seen.get(exercise.exerciseId) ?? 0;
      if (exercise.exerciseId) seen.set(exercise.exerciseId, occurrence + 1);
      return calculateRoutineExerciseWeights(
        exercise,
        weightUnit,
        records[exercise.exerciseId],
        exercise.exerciseId ? getRoutineAnchor(routine.id, exercise.exerciseId, history, occurrence) : null
      );
    }),
  };
}

export function calculateAllRoutines(
  routines: Routine[],
  records: Record<string, ExerciseRecord>,
  weightUnit: WeightUnit,
  history: LoggedWorkout[] = []
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
