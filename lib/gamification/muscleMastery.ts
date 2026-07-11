// Per-muscle-group strength mastery — averages the percentile of the lifts training each group.
import { getStrengthTier, StrengthTier } from '@/lib/data/strengthStandards';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { MuscleGroup, UserProgress } from '@/types';

export interface MuscleMastery {
  group: MuscleGroup;
  percentile: number;
  tier: StrengthTier;
  liftCount: number;
}

// Surfaced groups, head-to-toe order.
const DISPLAY_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes'];

export function computeMuscleMastery(lifts: UserProgress[]): MuscleMastery[] {
  const byGroup = new Map<MuscleGroup, number[]>();
  for (const lift of lifts) {
    const muscle = getExercise(lift.workoutId)?.primaryMuscles?.[0];
    if (!muscle) continue;
    const list = byGroup.get(muscle) ?? [];
    list.push(lift.percentileRanking);
    byGroup.set(muscle, list);
  }

  return DISPLAY_GROUPS.filter(g => byGroup.has(g)).map(group => {
    const arr = byGroup.get(group)!;
    const percentile = Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);
    return { group, percentile, tier: getStrengthTier(percentile), liftCount: arr.length };
  });
}
