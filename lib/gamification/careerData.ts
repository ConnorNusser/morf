// Shared loader for the Career surfaces, so the Profile section and the Career modal compute from one place.
import { getStrengthTier, StrengthTier } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { convertWeight, UserProfile, UserProgress, WeightUnit } from '@/types';
import { Achievement, newlyUnlocked, unlockedIds } from './achievements';
import { CareerStats } from './careerStats';
import { computeBodyGraph, findLaggingRegion, RegionState } from './bodyGraph';
import { LevelProgress } from './levelCurve';
import { XpLedger } from './xp';
import { iconUnlockContext, resolveProfileIconId } from './profileIcons';
import { LiftPR } from './personalRecords';
import { buildRewardSnapshot } from './sessionRewards';
import { computeTierTimeline, getTierLadder, TierMilestone, TierRung } from './tierTimeline';
import { computeTrainingHeatmap, TrainingHeatmap } from './trainingHeatmap';

export interface CareerData {
  stats: CareerStats;
  overall: number;
  tier: StrengthTier;
  ladder: TierRung[];
  timeline: TierMilestone[];
  achievements: Achievement[];
  newIds: Set<string>; // achievements unlocked since last acknowledged
  achievementUnlockedAt: Record<string, string>; // achievement id → ISO first-unlocked date
  prs: LiftPR[];
  heatmap: TrainingHeatmap;
  profileIconId: string; // resolved career emblem (chosen if unlocked, else default)
  level: LevelProgress;
  xp: XpLedger;
  bodyGraph: RegionState[]; // empty until bodyweight is set
  laggingRegion: RegionState | null;
}

// Overall percentile over the lifts the user hasn't hidden — the same set the hero averages.
function visibleOverall(lifts: UserProgress[], hiddenLiftIds: string[]) {
  const visibleLifts = lifts.filter(l => !hiddenLiftIds.includes(l.workoutId));
  const overall = visibleLifts.length
    ? calculateOverallPercentile(visibleLifts.map(l => l.percentileRanking))
    : 0;
  return { visibleLifts, overall };
}

function bodyWeightLbsOf(profile: UserProfile): number {
  return profile.weight ? convertWeight(profile.weight.value, profile.weight.unit, 'lbs') : 0;
}

export interface BodyGraphData {
  bodyGraph: RegionState[]; // empty until bodyweight is set
  laggingRegion: RegionState | null;
  overall: number;
  unit: WeightUnit;
}

// Lightweight loader for surfaces that only need the body graph (Home's lagging
// card) — skips achievements/XP and the unlock-date write in loadCareerData.
export async function loadBodyGraphData(): Promise<BodyGraphData> {
  const [history, profile, lifts, filters] = await Promise.all([
    storageService.getWorkoutHistory(),
    userService.getUserProfileOrDefault(),
    userService.getAllFeaturedLifts(),
    storageService.getLiftDisplayFilters(),
  ]);
  const { overall } = visibleOverall(lifts, filters.hiddenLiftIds);
  const bodyWeightLbs = bodyWeightLbsOf(profile);
  const bodyGraph =
    bodyWeightLbs > 0 ? computeBodyGraph(history, { bodyWeightLbs, gender: profile.gender, age: profile.age }) : [];
  return {
    bodyGraph,
    laggingRegion: findLaggingRegion(bodyGraph, overall),
    overall,
    unit: profile.weightUnitPreference || 'lbs',
  };
}

export async function loadCareerData(): Promise<CareerData> {
  const [history, profile, lifts, filters, seen, chosenIconId, leagueResults, weeklyGoal] = await Promise.all([
    storageService.getWorkoutHistory(),
    userService.getUserProfileOrDefault(),
    userService.getAllFeaturedLifts(),
    storageService.getLiftDisplayFilters(),
    storageService.getSeenAchievements(),
    storageService.getProfileIconId(),
    storageService.getLeagueWeekResults(),
    storageService.getWeeklyGoal(),
  ]);

  const unit = profile.weightUnitPreference || 'lbs';

  const { visibleLifts, overall } = visibleOverall(lifts, filters.hiddenLiftIds);
  const bodyWeightLbs = bodyWeightLbsOf(profile);

  // Shared snapshot builder, so Career surfaces and the session-reward diff never drift.
  const { stats, achievements, prs, xp, level } = buildRewardSnapshot(history, {
    unit,
    overall,
    bodyWeightLbs,
    leagueResults,
    weeklyGoal,
    gender: profile.gender,
    age: profile.age,
  });

  const bodyGraph =
    bodyWeightLbs > 0 ? computeBodyGraph(history, { bodyWeightLbs, gender: profile.gender, age: profile.age }) : [];

  const timeline = computeTierTimeline(
    history,
    { bodyWeightLbs, gender: profile.gender, age: profile.age },
    visibleLifts.map(l => l.workoutId), // same lift set the hero averages → consistent tier
  );

  // Stamp/read first-unlocked date per achievement; backfills already-earned ones with an old
  // date on first call so only genuinely new wins read as "recent".
  const achievementUnlockedAt = await storageService.reconcileAchievementUnlocks(
    unlockedIds(achievements),
    new Date().toISOString(),
  );

  return {
    stats,
    overall,
    tier: getStrengthTier(overall),
    ladder: getTierLadder(overall),
    timeline,
    achievements,
    achievementUnlockedAt,
    newIds: new Set(newlyUnlocked(achievements, seen).map(a => a.id)),
    prs,
    heatmap: computeTrainingHeatmap(history, 12),
    profileIconId: resolveProfileIconId(chosenIconId, iconUnlockContext(achievements)),
    level,
    xp,
    bodyGraph,
    laggingRegion: findLaggingRegion(bodyGraph, overall),
  };
}
