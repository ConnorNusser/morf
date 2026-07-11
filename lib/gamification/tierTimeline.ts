// Tier-progression timeline. Reconstructs overall strength tier over time from history using the
// SAME dashboard math (e1RM -> per-lift percentile -> averaged overall -> tier). Uses current
// bodyweight for every point (bodyweight history isn't tracked).
import {
  calculateStrengthPercentile,
  getStrengthTier,
  OneRMCalculator,
  StrengthTier,
  TIER_THRESHOLDS,
} from '@/lib/data/strengthStandards';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { ALL_MAIN_LIFTS, convertWeight, Gender, LoggedWorkout } from '@/types';

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

// Rank of a tier; TIER_THRESHOLDS is ordered worst -> best, so index = rank.
function tierRank(tier: StrengthTier): number {
  return TIER_THRESHOLDS.findIndex(t => t.label === tier);
}

export function computeTierTimeline(
  workouts: LoggedWorkout[],
  profile: TimelineProfile,
  // Lifts feeding the overall percentile; pass the dashboard's featured set to match the hero tier.
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

// Full tier ladder (worst -> best) for a progression bar. threshold = min percentile for that tier.
export interface TierRung {
  tier: StrengthTier;
  threshold: number;
  reached: boolean;
  current: boolean;
}

export interface TierBandProgress {
  tier: StrengthTier;
  nextTier: StrengthTier | null;
  toNext: number; // percentile points to the next tier (0 at max)
  progress: number; // 0..1 through the current tier band
}

// Progress through the current tier band; shared so max-tier behavior stays in one place.
export function getTierBandProgress(percentile: number): TierBandProgress {
  const tier = getStrengthTier(percentile);
  const idx = TIER_THRESHOLDS.findIndex(t => t.label === tier);
  const floor = idx >= 0 ? TIER_THRESHOLDS[idx].threshold : 0;
  const next = idx >= 0 && idx < TIER_THRESHOLDS.length - 1 ? TIER_THRESHOLDS[idx + 1] : null;
  return {
    tier,
    nextTier: next?.label ?? null,
    toNext: next ? next.threshold - percentile : 0,
    progress: next ? Math.max(0, Math.min(1, (percentile - floor) / Math.max(1, next.threshold - floor))) : 1,
  };
}

export function getTierLadder(currentPercentile: number): TierRung[] {
  const currentTier = getStrengthTier(currentPercentile);
  return TIER_THRESHOLDS.map(({ label, threshold }) => ({
    tier: label,
    threshold,
    reached: currentPercentile >= threshold,
    current: label === currentTier,
  }));
}
