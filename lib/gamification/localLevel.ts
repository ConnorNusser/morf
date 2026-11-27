// The viewer's own level, computed from local history with the same inputs as
// loadCareerData (so the synced/leaderboard number matches the Career surfaces),
// minus the heavier Career-only work and its storage side effects.
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { convertWeight } from '@/types';
import { SyncedLevel } from './levelSocial';
import { buildRewardSnapshot } from './sessionRewards';

export async function loadLocalLevel(): Promise<SyncedLevel> {
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

  const { level } = buildRewardSnapshot(history, {
    unit: profile.weightUnitPreference || 'lbs',
    overall,
    bodyWeightLbs,
    leagueResults,
    weeklyGoal,
    gender: profile.gender,
    age: profile.age,
  });
  return { level: level.level, totalXp: level.totalXp };
}
