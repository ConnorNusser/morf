// The viewer's own level, computed from local history with the same inputs as
// loadCareerData (so the synced/leaderboard number matches the Career surfaces),
// minus the heavier Career-only work and its storage side effects. Shared by the
// Home hero, the profile sync and the leaderboard so they can never disagree.
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { convertWeight } from '@/types';
import { SyncedLevel } from './levelSocial';
import { buildRewardSnapshot, RewardSnapshot } from './sessionRewards';

export interface LocalLevelSnapshot {
  snapshot: RewardSnapshot;
  overall: number; // visible-lift overall percentile (0 = unranked)
}

export async function loadLocalLevelSnapshot(): Promise<LocalLevelSnapshot> {
  const [history, profile, lifts, filters, leagueResults, weeklyGoal] = await Promise.all([
    storageService.getWorkoutHistory(),
    userService.getUserProfileOrDefault(),
    userService.getAllFeaturedLifts(),
    storageService.getLiftDisplayFilters(),
    storageService.getLeagueWeekResults(),
    storageService.getWeeklyGoal(),
  ]);

  const visibleLifts = lifts.filter(l => !filters.hiddenLiftIds.includes(l.workoutId));
  const overall = visibleLifts.length
    ? calculateOverallPercentile(visibleLifts.map(l => l.percentileRanking))
    : 0;
  const bodyWeightLbs = profile.weight ? convertWeight(profile.weight.value, profile.weight.unit, 'lbs') : 0;

  const snapshot = buildRewardSnapshot(history, {
    unit: profile.weightUnitPreference || 'lbs',
    overall,
    bodyWeightLbs,
    leagueResults,
    weeklyGoal,
    gender: profile.gender,
    age: profile.age,
  });
  return { snapshot, overall };
}

export async function loadLocalLevel(): Promise<SyncedLevel> {
  const { snapshot } = await loadLocalLevelSnapshot();
  return { level: snapshot.level.level, totalXp: snapshot.level.totalXp };
}
