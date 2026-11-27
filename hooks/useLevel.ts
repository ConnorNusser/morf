import { decideLevelIntro, projectNextWorkoutXp } from '@/lib/gamification/levelDisplay';
import { LevelProgress } from '@/lib/gamification/levelCurve';
import { loadLocalLevelSnapshot } from '@/lib/gamification/localLevel';
import { storageService } from '@/lib/storage/storage';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef, useState } from 'react';

// Home's level + hero stats, recomputed from history on every focus (XP is
// never stored). Uses the shared loader so Home, sync and leaderboard agree.
export interface LevelHeroStats {
  workouts: number;
  weekStreak: number;
  nextWorkoutXp: number; // projected XP for the next session (ghost segment)
}

export interface UseLevel {
  level: LevelProgress | null;
  stats: LevelHeroStats | null;
  // Non-null while the one-time "You're Level N" intro should show.
  intro: LevelProgress | null;
  dismissIntro: () => void;
}

export default function useLevel(): UseLevel {
  const [level, setLevel] = useState<LevelProgress | null>(null);
  const [stats, setStats] = useState<LevelHeroStats | null>(null);
  const [intro, setIntro] = useState<LevelProgress | null>(null);
  const loading = useRef(false);

  const refresh = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const { snapshot } = await loadLocalLevelSnapshot();
      const lp = snapshot.level;
      setLevel(lp);
      setStats({
        workouts: snapshot.stats.totalWorkouts,
        weekStreak: snapshot.stats.currentStreak,
        nextWorkoutXp: projectNextWorkoutXp(snapshot.xp),
      });
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

  return { level, stats, intro, dismissIntro };
}
