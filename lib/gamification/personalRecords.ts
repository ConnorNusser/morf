// Personal records for the featured lifts — best estimated 1RM per lift with the set + date. Pure.
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { getExercise } from '@/lib/workout/workouts';
import { ALL_FEATURED_SECONDARY_LIFTS, ALL_MAIN_LIFTS, convertWeight, GeneratedWorkout, WeightUnit } from '@/types';

export interface LiftPR {
  exerciseId: string;
  name: string;
  estimatedOneRM: number; // in preferred unit, rounded
  topWeight: number; // weight of the set that produced the best e1RM
  topReps: number;
  date: Date;
  unit: WeightUnit;
}

// Main + featured secondary lifts: anything the app treats as PR-worthy
// elsewhere (friend pushes, tier badges) must be PR-worthy on the lifter's own
// celebration screen too — friends congratulating a PR the lifter never saw is
// the loop celebrating outward before inward.
const FEATURED_LIFT_IDS: readonly string[] = [...ALL_MAIN_LIFTS, ...ALL_FEATURED_SECONDARY_LIFTS];

export function computeMainLiftPRs(workouts: GeneratedWorkout[], unit: WeightUnit): LiftPR[] {
  return computeLiftPRs(workouts, unit, ALL_MAIN_LIFTS);
}

export function computeFeaturedLiftPRs(workouts: GeneratedWorkout[], unit: WeightUnit): LiftPR[] {
  return computeLiftPRs(workouts, unit, FEATURED_LIFT_IDS);
}

function computeLiftPRs(workouts: GeneratedWorkout[], unit: WeightUnit, liftIds: readonly string[]): LiftPR[] {
  const best = new Map<string, { e1rm: number; weight: number; reps: number; date: Date }>();

  for (const workout of workouts) {
    const date = new Date(workout.createdAt);
    for (const exercise of workout.exercises || []) {
      if (!liftIds.includes(exercise.id)) continue;
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

  // Keep the canonical lift order.
  return liftIds.filter(id => best.has(id)).map(id => {
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
