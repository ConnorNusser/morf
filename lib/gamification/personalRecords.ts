// Personal records for the main lifts — the best estimated 1RM the user has
// hit on squat / bench / deadlift / overhead press, with the set + date that
// produced it. Pure, derived from workout history.
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { getExercise } from '@/lib/workout/workouts';
import { ALL_MAIN_LIFTS, convertWeight, GeneratedWorkout, WeightUnit } from '@/types';

export interface LiftPR {
  exerciseId: string;
  name: string;
  estimatedOneRM: number; // in preferred unit, rounded
  topWeight: number; // weight of the set that produced the best e1RM
  topReps: number;
  date: Date;
  unit: WeightUnit;
}

export function computeMainLiftPRs(workouts: GeneratedWorkout[], unit: WeightUnit): LiftPR[] {
  // exerciseId -> best record so far
  const best = new Map<string, { e1rm: number; weight: number; reps: number; date: Date }>();

  for (const workout of workouts) {
    const date = new Date(workout.createdAt);
    for (const exercise of workout.exercises || []) {
      if (!ALL_MAIN_LIFTS.includes(exercise.id as (typeof ALL_MAIN_LIFTS)[number])) continue;
      for (const set of exercise.completedSets || []) {
        if (!set.completed) continue;
        const weight = set.unit === unit ? set.weight : convertWeight(set.weight, set.unit, unit);
        const e1rm = OneRMCalculator.estimate(weight, set.reps);
        const prev = best.get(exercise.id);
        if (!prev || e1rm > prev.e1rm) {
          best.set(exercise.id, { e1rm, weight, reps: set.reps, date });
        }
      }
    }
  }

  // Keep the canonical main-lift order.
  return ALL_MAIN_LIFTS.filter(id => best.has(id)).map(id => {
    const r = best.get(id)!;
    return {
      exerciseId: id,
      name: getExercise(id)?.name ?? id,
      estimatedOneRM: Math.round(r.e1rm),
      topWeight: Math.round(r.weight),
      topReps: r.reps,
      date: r.date,
      unit,
    };
  });
}
