// Shared loader for everything the Career surfaces need, so the inline Profile
// section and the full Career modal compute from one place.
import { getStrengthTier, StrengthTier } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { convertWeight } from '@/types';
import { Achievement, computeAchievements, newlyUnlocked } from './achievements';
import { CareerStats, computeCareerStats } from './careerStats';
import { computeLevel, LevelInfo } from './level';
import { computeMuscleMastery, MuscleMastery } from './muscleMastery';
import { resolveProfileIconId } from './profileIcons';
import { computeMainLiftPRs, LiftPR } from './personalRecords';
import { computeStrengthMilestones } from './strengthMilestones';
import { computeTierTimeline, getTierLadder, TierMilestone, TierRung } from './tierTimeline';
import { computeTrainingHeatmap, TrainingHeatmap } from './trainingHeatmap';
import { computeWeeklyChallenge, WeeklyChallenge } from './weeklyChallenge';

export interface CareerData {
  stats: CareerStats;
  overall: number;
  tier: StrengthTier;
  level: LevelInfo;
  ladder: TierRung[];
  timeline: TierMilestone[];
  achievements: Achievement[];
  newIds: Set<string>; // achievements unlocked since last acknowledged
  prs: LiftPR[];
  muscleMastery: MuscleMastery[];
  heatmap: TrainingHeatmap;
  weeklyChallenge: WeeklyChallenge;
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
  const stats = computeCareerStats(history, unit);

  const visibleLifts = lifts.filter(l => !filters.hiddenLiftIds.includes(l.workoutId));
  const overall = visibleLifts.length
    ? calculateOverallPercentile(visibleLifts.map(l => l.percentileRanking))
    : 0;

  const bodyWeightLbs = profile.weight ? convertWeight(profile.weight.value, profile.weight.unit, 'lbs') : 0;
  const timeline = computeTierTimeline(
    history,
    { bodyWeightLbs, gender: profile.gender, age: profile.age },
    visibleLifts.map(l => l.workoutId), // same lift set the hero averages → consistent tier
  );

  // Strength milestones (bodyweight ratios) flow through the same achievement
  // machinery. Computed in lbs so the ratio matches the lbs bodyweight.
  const milestones = computeStrengthMilestones(computeMainLiftPRs(history, 'lbs'), bodyWeightLbs);
  const achievements = [...computeAchievements(stats, overall), ...milestones];
  const unlockedCount = achievements.filter(a => a.unlocked).length;
  const level = computeLevel(stats, unlockedCount);

  return {
    stats,
    overall,
    tier: getStrengthTier(overall),
    level,
    ladder: getTierLadder(overall),
    timeline,
    achievements,
    newIds: new Set(newlyUnlocked(achievements, seen).map(a => a.id)),
    prs: computeMainLiftPRs(history, unit),
    muscleMastery: computeMuscleMastery(visibleLifts),
    heatmap: computeTrainingHeatmap(history, 12),
    weeklyChallenge: computeWeeklyChallenge(history),
    profileIconId: resolveProfileIconId(chosenIconId, level.level),
  };
}
