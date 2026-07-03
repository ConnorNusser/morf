import { CustomExercise, ExerciseHistoryEntry, ExerciseWithMax, GeneratedWorkout, WeightUnit, convertWeight } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { ALL_WORKOUTS } from '@/lib/workout/workouts';

// Pure (no React / react-native) so the Exercises-tab ingestion is unit-testable and
// node-gate-able. Extracted verbatim from history.tsx's loadExerciseStats, with one
// deliberate behaviour change: a set logged at weight <= 0 is NO LONGER discarded.
//
// The old inline `if (weight <= 0) return;` meant a full calisthenics workout
// (pull-ups, push-ups) produced an EMPTY exerciseStats — the Exercises tab fell back to
// "No exercises tracked" and the hero to its generic "log a lift" nudge, both flatly
// false for someone who just logged five sets. Here we KEEP those rows and score them on
// a reps signal (`metric: 'bodyweight'`, `bestReps`) instead of an (undefined) 1RM.

interface Accum {
  maxWeightLbs: number; // heaviest working weight (lbs) at the best-1RM set
  maxReps: number;      // reps at that best-1RM set
  maxOneRM: number;     // best estimated 1RM (lbs); 0 ⇒ never lifted a positive weight
  bestReps: number;     // highest reps across ALL sets — the bodyweight headline number
  history: ExerciseHistoryEntry[];
}

/**
 * Fold a user's workout history into per-exercise stat rows for the Exercises tab.
 *
 * - Weighted lifts are summarised by estimated 1RM exactly as before.
 * - Bodyweight lifts (every set at weight 0) are kept and tagged `metric: 'bodyweight'`
 *   with a `bestReps` headline; downstream (ExerciseCard, trackedExercises, the hero's
 *   nearestLift) treats them as real, tracked exercises.
 * - All weight comparison happens in lbs so mixed kg/lbs logs bucket correctly; only the
 *   final display numbers are converted to the user's preferred unit.
 */
export function buildExerciseStats(
  workouts: GeneratedWorkout[],
  customExercises: CustomExercise[],
  weightUnit: WeightUnit
): ExerciseWithMax[] {
  const map: Record<string, Accum> = {};

  const addEntry = (id: string, weight: number, reps: number, date: Date, unit: WeightUnit) => {
    const weightInLbs = unit === 'kg' ? convertWeight(weight, 'kg', 'lbs') : weight;
    // A 0-weight set has no meaningful 1RM; leave maxOneRM at 0 so the row reads bodyweight.
    const oneRM = weight > 0 ? OneRMCalculator.estimate(weightInLbs, reps) : 0;

    if (!map[id]) {
      map[id] = { maxWeightLbs: 0, maxReps: 0, maxOneRM: 0, bestReps: 0, history: [] };
    }
    const acc = map[id];
    acc.history.push({ weight, reps, date, unit });
    if (reps > acc.bestReps) acc.bestReps = reps;
    if (oneRM > acc.maxOneRM) {
      acc.maxWeightLbs = weightInLbs;
      acc.maxReps = reps;
      acc.maxOneRM = oneRM;
    }
  };

  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      for (const set of exercise.completedSets || []) {
        // Default to 'lbs' for legacy data without a unit field.
        addEntry(exercise.id, set.weight, set.reps, new Date(workout.createdAt), set.unit || 'lbs');
      }
    }
  }

  const toDisplayWeight = (lbs: number) => (weightUnit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs);

  const rowFor = (
    id: string,
    name: string,
    isCustom: boolean,
    data: Accum | undefined,
    fallbackDate?: Date
  ): ExerciseWithMax => {
    // Sort history newest-first (a stable copy — never mutate the accumulator's array).
    const sortedHistory = data ? [...data.history].sort((a, b) => b.date.getTime() - a.date.getTime()) : [];
    return {
      id,
      name,
      maxWeight: data ? Math.round(toDisplayWeight(data.maxWeightLbs)) : 0,
      maxReps: data?.maxReps || 0,
      estimated1RM: data ? Math.round(toDisplayWeight(data.maxOneRM)) : 0,
      isCustom,
      // A lift with any positive-weight set is weighted; otherwise it's bodyweight.
      metric: data && data.maxOneRM > 0 ? 'weight' : 'bodyweight',
      bestReps: data?.bestReps || 0,
      lastUsed: sortedHistory[0]?.date || fallbackDate,
      history: sortedHistory,
    };
  };

  const stats: ExerciseWithMax[] = [];

  // Catalogue exercises that were actually logged.
  for (const workout of ALL_WORKOUTS) {
    const data = map[workout.id];
    if (data && data.history.length > 0) {
      stats.push(rowFor(workout.id, workout.name, false, data));
    }
  }

  // Custom exercises always surface (matching the original tab), even with no logged sets.
  for (const custom of customExercises) {
    stats.push(rowFor(custom.id, custom.name, true, map[custom.id], custom.createdAt));
  }

  // Weighted lifts lead (by 1RM); bodyweight rows (1RM 0) fall to the end, alphabetised.
  stats.sort((a, b) => b.estimated1RM - a.estimated1RM || a.name.localeCompare(b.name));

  return stats;
}
