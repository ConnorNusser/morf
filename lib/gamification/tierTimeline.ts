// Tier-progression timeline. Reconstructs the user's overall strength tier over
// time from workout history, using the SAME math the dashboard uses
// (estimated 1RM -> per-lift percentile -> averaged overall -> tier), so the
// final point lines up with what the app shows today.
//
// We base the overall percentile on the four main lifts (squat / bench /
// deadlift / OHP) — the canonical strength measure with real standards — and
// use the user's current bodyweight for every point (bodyweight history isn't
// tracked). The result is a clean "when you reached each tier" timeline.
import {
  calculateStrengthPercentile,
  getStrengthTier,
  OneRMCalculator,
  StrengthTier,
  TIER_THRESHOLDS,
} from '@/lib/data/strengthStandards';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { ALL_MAIN_LIFTS, convertWeight, Gender, GeneratedWorkout } from '@/types';

export interface TierMilestone {
  tier: StrengthTier;
  percentile: number;
  date: Date;
}

export interface TimelineProfile {
  bodyWeightLbs: number;
  gender: Gender;
  age?: number;
}

// Rank of a tier (TIER_THRESHOLDS is ordered worst -> best, so the index itself
// is the rank: higher index = better tier). Used to detect tier-ups.
function tierRank(tier: StrengthTier): number {
  return TIER_THRESHOLDS.findIndex(t => t.label === tier);
}

export function computeTierTimeline(
  workouts: GeneratedWorkout[],
  profile: TimelineProfile,
  // Which lifts feed the overall percentile. Defaults to the four main lifts;
  // pass the dashboard's featured-lift set so the timeline matches the hero tier.
  liftIds: readonly string[] = ALL_MAIN_LIFTS,
): TierMilestone[] {
  if (!profile.bodyWeightLbs || profile.bodyWeightLbs <= 0) return [];

  const liftSet = new Set(liftIds);
  const chronological = [...workouts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const bestOneRM = new Map<string, number>(); // lift id -> best estimated 1RM (lbs)
  const milestones: TierMilestone[] = [];
  let bestRankSoFar = -1;

  for (const workout of chronological) {
    let improved = false;

    for (const exercise of workout.exercises || []) {
      if (!liftSet.has(exercise.id)) continue;
      for (const set of exercise.completedSets || []) {
        if (!set.completed) continue;
        const weightLbs = set.unit === 'lbs' ? set.weight : convertWeight(set.weight, set.unit, 'lbs');
        const oneRM = OneRMCalculator.estimate(weightLbs, set.reps);
        if (oneRM > (bestOneRM.get(exercise.id) ?? 0)) {
          bestOneRM.set(exercise.id, oneRM);
          improved = true;
        }
      }
    }

    if (!improved || bestOneRM.size === 0) continue;

    const percentiles = liftIds
      .filter(id => bestOneRM.has(id))
      .map(id =>
        calculateStrengthPercentile(bestOneRM.get(id)!, profile.bodyWeightLbs, profile.gender, id, profile.age),
      );
    const overall = calculateOverallPercentile(percentiles);
    const tier = getStrengthTier(overall);
    const rank = tierRank(tier);

    if (rank > bestRankSoFar) {
      bestRankSoFar = rank;
      milestones.push({ tier, percentile: Math.round(overall), date: new Date(workout.createdAt) });
    }
  }

  return milestones;
}

// The full tier ladder (worst -> best) for rendering a progression bar, with the
// current tier flagged. Threshold = minimum percentile to reach that tier.
export interface TierRung {
  tier: StrengthTier;
  threshold: number;
  reached: boolean;
  current: boolean;
}

export function getTierLadder(currentPercentile: number): TierRung[] {
  const currentTier = getStrengthTier(currentPercentile);
  // TIER_THRESHOLDS is already worst -> best (E- ... S++), the order we want.
  return TIER_THRESHOLDS.map(({ label, threshold }) => ({
    tier: label,
    threshold,
    reached: currentPercentile >= threshold,
    current: label === currentTier,
  }));
}
