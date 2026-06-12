// Shared loader for everything the Career surfaces need, so the inline Profile
// section and the full Career modal compute from one place.
import { getStrengthTier, StrengthTier } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { convertWeight } from '@/types';
import { Achievement, newlyUnlocked } from './achievements';
import { CareerStats } from './careerStats';
import { computeMuscleMastery, MuscleMastery } from './muscleMastery';
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
  prs: LiftPR[];
  muscleMastery: MuscleMastery[];
  heatmap: TrainingHeatmap;
  profileIconId: string; // resolved career emblem (chosen if unlocked, else default)
}

export async function loadCareerData(): Promise<CareerData> {
  const [history, profile, lifts, filters, seen, chosenIconId] = await Promise.all([
    storageService.getWorkoutHistory(),
    userService.getUserProfileOrDefault(),
    userService.getAllFeaturedLifts(),
    storageService.getLiftDisplayFilters(),
    storageService.getSeenAchievements(),
    storageService.getProfileIconId(),
  ]);

  const unit = profile.weightUnitPreference || 'lbs';

  const visibleLifts = lifts.filter(l => !filters.hiddenLiftIds.includes(l.workoutId));
  const overall = visibleLifts.length
    ? calculateOverallPercentile(visibleLifts.map(l => l.percentileRanking))
    : 0;

  const bodyWeightLbs = profile.weight ? convertWeight(profile.weight.value, profile.weight.unit, 'lbs') : 0;

  // stats / achievements / prs come from the shared snapshot builder
  // so the Career surfaces and the session-reward diff never drift.
  const { stats, achievements, prs } = buildRewardSnapshot(history, {
    unit,
    overall,
    bodyWeightLbs,
  });

  const timeline = computeTierTimeline(
    history,
    { bodyWeightLbs, gender: profile.gender, age: profile.age },
    visibleLifts.map(l => l.workoutId), // same lift set the hero averages → consistent tier
  );

  return {
    stats,
    overall,
    tier: getStrengthTier(overall),
    ladder: getTierLadder(overall),
    timeline,
    achievements,
    newIds: new Set(newlyUnlocked(achievements, seen).map(a => a.id)),
    prs,
    muscleMastery: computeMuscleMastery(visibleLifts),
    heatmap: computeTrainingHeatmap(history, 12),
    profileIconId: resolveProfileIconId(chosenIconId, iconUnlockContext(achievements)),
  };
}
