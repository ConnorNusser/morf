import { CustomExercise, ExerciseHistoryEntry, ExerciseWithMax, LoggedWorkout, WeightUnit, convertWeight } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { EXERCISE_CATALOG } from '@/lib/workout/exerciseCatalog';

// Behaviour change vs the old inline loadExerciseStats: a set at weight <= 0 is NO LONGER
// discarded, so a calisthenics workout yields bodyweight rows instead of EMPTY stats.

interface Accum {
  maxWeightLbs: number; // lbs, at the best-1RM set
  maxReps: number;
  maxOneRM: number; // best e1RM (lbs); 0 ⇒ never lifted a positive weight
  bestReps: number; // highest reps across ALL sets — bodyweight headline
  history: ExerciseHistoryEntry[];
}

// Fold workout history into per-exercise rows. Bodyweight lifts (every set weight 0) kept,
// tagged `metric: 'bodyweight'`. Comparison in lbs; display numbers converted last.
export function buildExerciseStats(
  workouts: LoggedWorkout[],
  customExercises: CustomExercise[],
  weightUnit: WeightUnit
): ExerciseWithMax[] {
  const map: Record<string, Accum> = {};

  const addEntry = (id: string, weight: number, reps: number, date: Date, unit: WeightUnit) => {
    const weightInLbs = unit === 'kg' ? convertWeight(weight, 'kg', 'lbs') : weight;
    // 0-weight set has no meaningful 1RM; leave maxOneRM at 0 so the row reads bodyweight.
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
        // Default 'lbs' for legacy data without a unit field.
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
    // Newest-first; stable copy — never mutate the accumulator's array.
    const sortedHistory = data ? [...data.history].sort((a, b) => b.date.getTime() - a.date.getTime()) : [];
    return {
      id,
      name,
      maxWeight: data ? Math.round(toDisplayWeight(data.maxWeightLbs)) : 0,
      maxReps: data?.maxReps || 0,
      estimated1RM: data ? Math.round(toDisplayWeight(data.maxOneRM)) : 0,
      isCustom,
      metric: data && data.maxOneRM > 0 ? 'weight' : 'bodyweight',
      bestReps: data?.bestReps || 0,
      lastUsed: sortedHistory[0]?.date || fallbackDate,
      history: sortedHistory,
    };
  };

  const stats: ExerciseWithMax[] = [];

  for (const workout of EXERCISE_CATALOG) {
    const data = map[workout.id];
    if (data && data.history.length > 0) {
      stats.push(rowFor(workout.id, workout.name, false, data));
    }
  }

  // Custom exercises always surface, even with no logged sets.
  for (const custom of customExercises) {
    stats.push(rowFor(custom.id, custom.name, true, map[custom.id], custom.createdAt));
  }

  // Weighted lifts lead (by 1RM); bodyweight rows (1RM 0) fall to the end, alphabetised.
  stats.sort((a, b) => b.estimated1RM - a.estimated1RM || a.name.localeCompare(b.name));

  return stats;
}
