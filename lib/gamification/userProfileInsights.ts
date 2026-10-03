import { achievementMeta, AchievementMeta } from '@/lib/gamification/achievementMeta';
import { rarityRank } from '@/lib/gamification/rarity';
import { calculateStrengthPercentile, getStrengthTier, getTierColor, StrengthTier } from '@/lib/data/strengthStandards';
import { WorkoutFeedData } from '@/lib/services/feedService';
import { convertWeightToLbs } from '@/lib/utils/utils';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import {
  MAIN_LIFTS,
  PercentileHistoryEntry,
  RemoteUserData,
  TopContribution,
  UserPercentileData,
  UserProgress,
  isFeaturedLift,
} from '@/types';

/**
 * Pure derivations behind another user's profile sheet (UserProfileModal):
 * the achievement showcase, the You-vs-Them lift comparison, Big-3 totals and
 * the percentile trend. All inputs are Supabase rows fetched by the modal's
 * data hook; nothing here touches the network or React.
 */

export interface UserLiftData {
  exercise_id: string;
  estimated_1rm: number;
  recorded_at: string;
}

// Aggregated from every workout's feed_data: career PRs + earned achievements.
export interface AchievementShowcase {
  totalPRs: number;
  totalAchievements: number;
  rarest: AchievementMeta[];
}

export type ComparisonMode = 'weight' | 'percentile';

export interface LiftComparisonRow {
  exerciseId: string;
  name: string;
  myValue: number;
  theirValue: number;
  myWeight: number;
  theirWeight: number;
  myPercentile: number;
  theirPercentile: number;
  iWin: boolean;
  isTie: boolean;
}

export interface LiftComparison {
  comparisons: LiftComparisonRow[];
  myWins: number;
  theirWins: number;
  ties: number;
}

export const BIG_3 = [MAIN_LIFTS.BENCH_PRESS, MAIN_LIFTS.SQUAT, MAIN_LIFTS.DEADLIFT];

/** Catalog display name for an exercise id, falling back to the raw id. */
export const catalogExerciseName = (id: string): string => {
  const workout = getCatalogExercise(id);
  return workout?.name || id;
};

/** Career PR count plus the six rarest earned achievements across every workout's feed_data. */
export function summarizeAchievementShowcase(rows: { feed_data: unknown }[]): AchievementShowcase {
  let totalPRs = 0;
  const earnedIds = new Set<string>();
  for (const row of rows) {
    const fd = row.feed_data as WorkoutFeedData | null;
    totalPRs += fd?.pr_count || 0;
    (fd?.achievement_ids || []).forEach(id => earnedIds.add(id));
  }
  // Unknown ids (older app versions) resolve to undefined and drop out.
  const rarest = [...earnedIds]
    .map(achievementMeta)
    .filter((m): m is AchievementMeta => m != null)
    .sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity))
    .slice(0, 6);
  return { totalPRs, totalAchievements: earnedIds.size, rarest };
}

/** Fill in each top contribution's 1RM from the user's best lifts when the server omitted it. */
export function withContributionWeights(
  topContributions: TopContribution[] | undefined,
  lifts: UserLiftData[],
): TopContribution[] {
  if (!topContributions) return [];

  const liftWeightMap: Record<string, number> = {};
  lifts.forEach(lift => {
    liftWeightMap[lift.exercise_id] = lift.estimated_1rm;
  });

  return topContributions.map(c => ({
    ...c,
    weight: c.weight || liftWeightMap[c.exercise_id] || undefined,
  }));
}

/** Head-to-head on shared exercises, by 1RM or by percentile; null when there is nothing to compare. */
export function buildLiftComparison({
  currentUserId,
  userId,
  myLifts,
  lifts,
  comparisonMode,
  myUserData,
  userData,
}: {
  currentUserId: string | null;
  userId: string | undefined;
  myLifts: UserLiftData[];
  lifts: UserLiftData[];
  comparisonMode: ComparisonMode;
  myUserData: RemoteUserData | null;
  userData: RemoteUserData | null;
}): LiftComparison | null {
  if (!currentUserId || currentUserId === userId || myLifts.length === 0 || lifts.length === 0) {
    return null;
  }

  const myBodyWeight = myUserData?.weight ? convertWeightToLbs(myUserData.weight.value, myUserData.weight.unit) : 0;
  const myGender = myUserData?.gender === 'male' || myUserData?.gender === 'female' ? myUserData.gender : 'male';
  const theirBodyWeight = userData?.weight ? convertWeightToLbs(userData.weight.value, userData.weight.unit) : 0;
  const theirGender = userData?.gender === 'male' || userData?.gender === 'female' ? userData.gender : 'male';

  const myLiftMap: Record<string, number> = {};
  myLifts.forEach(lift => {
    myLiftMap[lift.exercise_id] = lift.estimated_1rm;
  });

  const theirLiftMap: Record<string, number> = {};
  lifts.forEach(lift => {
    theirLiftMap[lift.exercise_id] = lift.estimated_1rm;
  });

  let commonExercises = Object.keys(myLiftMap).filter(id => id in theirLiftMap);
  if (comparisonMode === 'percentile') {
    commonExercises = commonExercises.filter(id => isFeaturedLift(id));
  }
  if (commonExercises.length === 0) return null;

  const comparisons = commonExercises
    .map(exerciseId => {
      const myWeight = myLiftMap[exerciseId];
      const theirWeight = theirLiftMap[exerciseId];

      const myPercentile = myBodyWeight > 0 && isFeaturedLift(exerciseId)
        ? Math.round(calculateStrengthPercentile(myWeight, myBodyWeight, myGender, exerciseId))
        : 0;
      const theirPercentile = theirBodyWeight > 0 && isFeaturedLift(exerciseId)
        ? Math.round(calculateStrengthPercentile(theirWeight, theirBodyWeight, theirGender, exerciseId))
        : 0;

      const usePercentile = comparisonMode === 'percentile';
      const myValue = usePercentile ? myPercentile : Math.round(myWeight);
      const theirValue = usePercentile ? theirPercentile : Math.round(theirWeight);

      return {
        exerciseId,
        name: getCatalogExercise(exerciseId)?.name || exerciseId,
        myValue,
        theirValue,
        myWeight: Math.round(myWeight),
        theirWeight: Math.round(theirWeight),
        myPercentile,
        theirPercentile,
        iWin: myValue > theirValue,
        isTie: myValue === theirValue,
      };
    })
    .filter(c => comparisonMode !== 'percentile' || (c.myPercentile > 0 && c.theirPercentile > 0))
    .sort((a, b) => b.theirValue - a.theirValue);

  if (comparisons.length === 0) return null;

  const myWins = comparisons.filter(c => c.iWin && !c.isTie).length;
  const theirWins = comparisons.filter(c => !c.iWin && !c.isTie).length;

  return {
    comparisons,
    myWins,
    theirWins,
    ties: comparisons.length - myWins - theirWins,
  };
}

/** Big-3 maxes, 1000lb-club progress, summed 1RMs, and the top five non-Big-3 catalog lifts. */
export function summarizeLifts(lifts: UserLiftData[]) {
  const getBig3Lift = (exerciseId: string) => {
    const lift = lifts.find(l => l.exercise_id === exerciseId);
    return lift ? Math.round(lift.estimated_1rm) : 0;
  };

  const benchMax = getBig3Lift(MAIN_LIFTS.BENCH_PRESS);
  const squatMax = getBig3Lift(MAIN_LIFTS.SQUAT);
  const deadliftMax = getBig3Lift(MAIN_LIFTS.DEADLIFT);
  const big3Total = benchMax + squatMax + deadliftMax;
  const thousandPoundProgress = Math.min(100, Math.round((big3Total / 1000) * 100));

  // Sum of all 1RMs, a rough proxy for volume
  const totalVolume = lifts.reduce((sum, lift) => sum + lift.estimated_1rm, 0);

  const otherLifts = lifts
    .filter(l => !BIG_3.includes(l.exercise_id as typeof MAIN_LIFTS.BENCH_PRESS))
    .filter(l => getCatalogExercise(l.exercise_id) !== null)
    .sort((a, b) => b.estimated_1rm - a.estimated_1rm)
    .slice(0, 5);

  return { benchMax, squatMax, deadliftMax, big3Total, thousandPoundProgress, totalVolume, otherLifts };
}

/** Overall percentile and the tier (plus its color) that drives the sheet's identity color. */
export function overallStanding(percentileData: UserPercentileData | null) {
  const overallPercentile = percentileData?.overall_percentile ?? null;
  // Overall tier drives the identity color, same as feed usernames.
  const overallTier = (percentileData?.strength_level as StrengthTier | undefined)
    ?? (overallPercentile !== null ? getStrengthTier(overallPercentile) : undefined);
  const tierColor = overallTier ? getTierColor(overallTier) : undefined;
  return { overallPercentile, overallTier, tierColor };
}

/** Last 30 percentile entries, the net change across them, and the month they start in. */
export function percentileTrend(history: PercentileHistoryEntry[] | undefined) {
  const sparkHistory = history?.slice(-30) ?? [];
  const sparkDelta = sparkHistory.length >= 2
    ? Math.round(sparkHistory[sparkHistory.length - 1].percentile - sparkHistory[0].percentile)
    : 0;
  const sparkSince = sparkHistory.length >= 2
    ? new Date(sparkHistory[0].date).toLocaleDateString('en-US', { month: 'short' })
    : '';
  return { sparkHistory, sparkDelta, sparkSince };
}

/** Shape a remote lift history as chart points for InteractiveProgressChart. */
export function liftHistoryToProgress(
  exerciseId: string,
  history: { estimated_1rm: number; recorded_at: Date }[],
): UserProgress[] {
  return history.map(lift => ({
    workoutId: exerciseId,
    personalRecord: lift.estimated_1rm,
    lastUpdated: lift.recorded_at,
    percentileRanking: 0,
    strengthLevel: '',
  }));
}
