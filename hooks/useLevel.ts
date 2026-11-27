import { decideLevelIntro } from '@/lib/gamification/levelDisplay';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { buildRewardSnapshot } from '@/lib/gamification/sessionRewards';
import { userService } from '@/lib/services/userService';
import { storageService } from '@/lib/storage/storage';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { convertWeight } from '@/types';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

// Account level for Home: recomputed from history on every focus (XP is never
// stored). Inputs mirror loadCareerData so the header pill and Career agree —
// achievement XP depends on the overall percentile and league results.
async function loadLevel(): Promise<LevelProgress> {
  const [history, profile, lifts, filters, leagueResults, weeklyGoal] = await Promise.all([
    storageService.getWorkoutHistory(),
    userService.getUserProfileOrDefault(),
    userService.getAllFeaturedLifts(),
    storageService.getLiftDisplayFilters(),
    storageService.getLeagueWeekResults(),
    storageService.getWeeklyGoal(),
  ]);
  const visible = lifts.filter(l => !filters.hiddenLiftIds.includes(l.workoutId));
  const overall = visible.length ? calculateOverallPercentile(visible.map(l => l.percentileRanking)) : 0;
  const bodyWeightLbs = profile.weight ? convertWeight(profile.weight.value, profile.weight.unit, 'lbs') : 0;
  return buildRewardSnapshot(history, {
    unit: profile.weightUnitPreference || 'lbs',
    overall,
    bodyWeightLbs,
    leagueResults,
    weeklyGoal,
    gender: profile.gender,
    age: profile.age,
  }).level;
}

export interface UseLevel {
  level: LevelProgress | null;
  // Non-null while the one-time "You're Level N" intro should show.
  intro: LevelProgress | null;
  dismissIntro: () => void;
}

export default function useLevel(): UseLevel {
  const [level, setLevel] = useState<LevelProgress | null>(null);
  const [intro, setIntro] = useState<LevelProgress | null>(null);
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const lp = await loadLevel();
      setLevel(lp);
      const [introSeen, lastSeenLevel] = await Promise.all([
        storageService.hasSeenLevelIntro(),
        storageService.getLastSeenLevel(),
      ]);
      const d = decideLevelIntro({ introSeen, lastSeenLevel }, lp);
      if (d.markIntroSeen) await storageService.markLevelIntroSeen();
      if (d.syncLastSeenLevel !== null) await storageService.setLastSeenLevel(d.syncLastSeenLevel);
      if (d.showIntro) setIntro(lp);
    } catch (err) {
      console.error('useLevel: failed to load', err);
    } finally {
      loading.current = false;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const dismissIntro = useCallback(() => {
    if (intro) {
      storageService.markLevelIntroSeen();
      storageService.setLastSeenLevel(intro.level);
    }
    setIntro(null);
  }, [intro]);

  return { level, intro, dismissIntro };
}
