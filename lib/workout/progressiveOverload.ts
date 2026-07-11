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
import { LastPerformance, LoggedSet, nextPrescription, loadIncrement, resolveWorkingSet, NextPrescription } from './progression';
import { getWorkoutById } from './workouts';

/** The coach's-notebook anchor: this routine's own column in the log. */
export interface RoutineAnchor extends LastPerformance {
  at: Date;
}

/** Anchor for (routine, exercise slot): the working set from the most recent
 *  saved session OF THIS ROUTINE that logged the exercise. Freestyle sessions
 *  and other days can't move it — each routine progresses against its own last
 *  performance, so a 3×12 day and a 5×5 day sharing an exercise never read each
 *  other's work as a miss or a top-out. Derived from history (workouts carry
 *  routineId); no stored counter to drift.
 *
 *  `occurrence` handles the same exercise programmed twice in one routine
 *  (top sets + backoff sets): the nth routine slot reads the nth logged entry.
 *
 *  Strict resolveWorkingSet only — no lone-set fallback. A session with nothing
 *  repeated (cut short, a PR single, only warmups checked) simply doesn't move
 *  the anchor; we look one session further back, and a routine with no readable
 *  session holds via the seed path instead of lurching off one stray set. */
export function getRoutineAnchor(
  routineId: string,
  exerciseId: string,
  history: GeneratedWorkout[],
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

// An anchor/record whose reps sit within this of the slot's floor is directly
// comparable; further out it's another rep range's work and gets re-expressed
// at the slot's reps instead (equivalentWeight).
const REP_RANGE_TOLERANCE = 2;

// An anchor this old, with a fresher global record on file, no longer reflects
// current strength (layoffs, long routine pauses) — reseed from the record.
const ANCHOR_STALE_MS = 56 * 24 * 60 * 60 * 1000; // 8 weeks

/** Re-express a performed set at a different rep count via the rep-max curve
 *  (getPercentageFor), grid-floored minus one increment — a conservative
 *  starting point the next session validates. Uses the CURRENT working set,
 *  never best-ever e1RM (that's a trophy). */
function equivalentWeight(
  performed: LastPerformance,
  floorReps: number,
  weightUnit: WeightUnit,
  increment: number,
): number {
  const lbs = performed.unit === 'lbs' ? performed.weight : convertWeight(performed.weight, performed.unit, 'lbs');
  const equivalentLbs =
    OneRMCalculator.estimate(lbs, performed.reps) * (OneRMCalculator.getPercentageFor(floorReps) / 100);
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
  const inBand = (reps: number) => Math.abs(reps - workingReps) <= REP_RANGE_TOLERANCE;

  // An anchor much older than a fresher global record is a pre-layoff number —
  // reseed from the record instead of prescribing at-or-above ancient peak.
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
    if (inBand(anchor.reps)) {
      // This routine's own last session, same rep range — run the progression rule.
      prescription = nextPrescription(
        { weight: anchorWeight, reps: anchor.reps, unit: weightUnit },
        range,
        increment,
      );
    } else {
      // The routine's reps were edited since that session — re-express the old
      // work at the new reps and hold, instead of reading a 5→12 edit as a
      // catastrophic miss or a 12→5 edit as a top-out.
      prescription = { weight: equivalentWeight(anchor, workingReps, weightUnit, increment), reps: workingReps, change: 'hold' };
    }
    lastPerformed = { weight: Math.round(anchorWeight), reps: anchor.reps, date: anchor.at, completed: true };
  } else if (record) {
    // No usable history in this routine — SEED from the global working set and
    // always hold: day one validates the number, it never earns an increase off
    // another day's work. In-band reps use the record weight as performed;
    // out-of-band reps are re-expressed at this slot's reps.
    const recordWeight = record.unit === weightUnit
      ? record.weight
      : convertWeight(record.weight, record.unit, weightUnit);
    const seed = inBand(record.reps)
      ? roundWeight(recordWeight, weightUnit)
      : equivalentWeight(record, workingReps, weightUnit, increment);
    prescription = { weight: seed, reps: workingReps, change: 'hold' };
    lastPerformed = { weight: Math.round(recordWeight), reps: record.reps, date: record.updatedAt, completed: true };
  }

  // Warmups ramp (…45% → 60% of the working weight for the last one) — ramping
  // also means prescribed warmups never repeat a weight, so a cut-short session
  // can't read a warmup pair as the working set and collapse the anchor.
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
  // Same exercise in two slots (top sets + backoff sets): the nth slot reads
  // the nth logged entry, so each slot progresses on its own work.
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
