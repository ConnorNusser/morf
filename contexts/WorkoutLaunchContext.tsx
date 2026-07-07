import WorkoutLaunch from '@/components/home/WorkoutLaunch';
import { loadCareerData } from '@/lib/gamification/careerData';
import { Rarity } from '@/lib/gamification/rarity';
import { WeightUnit } from '@/types';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface AchievementFact {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: Rarity;
  isNew: boolean;
  unlockedAt: string; // ISO date it was first seen unlocked
}

export interface CareerSnapshot {
  percentile: number;
  unit?: WeightUnit;
  totalVolume?: number;
  totalWorkouts?: number;
  totalSets?: number;
  daysActive?: number;
  currentStreak?: number;
  achievements?: AchievementFact[]; // unlocked, new ones first
}

interface LaunchConfig {
  routineName: string;
  subtitle?: string;
  exercises?: string[]; // shown as a staggered "loadout" list
  onArrive: () => void; // fired while the overlay still covers the screen
}

const WorkoutLaunchContext = createContext<(cfg: LaunchConfig) => void>(() => {});

// Trigger the shared launch interstitial from anywhere (home routine, empty-state
// start, Quick start, repeating a recent workout).
export const useWorkoutLaunch = () => useContext(WorkoutLaunchContext);

export function WorkoutLaunchProvider({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<LaunchConfig | null>(null);
  const [career, setCareer] = useState<CareerSnapshot>({ percentile: 0 });
  const cfgRef = useRef<LaunchConfig | null>(null);
  cfgRef.current = cfg;

  const loadCareer = useCallback(async () => {
    try {
      const d = await loadCareerData();
      const unlocked = d.achievements.filter(a => a.unlocked);
      // loadCareerData already stamped/read first-unlocked dates — reuse that map.
      const dates = d.achievementUnlockedAt;
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
      // Only surface wins from the last two weeks, most recent first.
      const achievements = unlocked
        .filter(a => dates[a.id] && new Date(dates[a.id]).getTime() >= twoWeeksAgo)
        .map(a => ({
          id: a.id,
          title: a.title,
          description: a.description,
          icon: a.icon,
          rarity: a.rarity,
          isNew: d.newIds.has(a.id),
          unlockedAt: dates[a.id],
        }))
        .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime());
      setCareer({
        percentile: d.overall,
        unit: d.stats.unit,
        totalVolume: d.stats.totalVolume,
        totalWorkouts: d.stats.totalWorkouts,
        totalSets: d.stats.totalSets,
        daysActive: d.stats.daysActive,
        currentStreak: d.stats.currentStreak,
        achievements,
      });
    } catch {
      // keep the last known snapshot
    }
  }, []);

  useEffect(() => {
    loadCareer();
  }, [loadCareer]);

  const launch = useCallback(
    (c: LaunchConfig) => {
      loadCareer();
      setCfg(c);
    },
    [loadCareer],
  );

  const handleLaunch = useCallback(() => cfgRef.current?.onArrive(), []);
  const handleClose = useCallback(() => setCfg(null), []);

  return (
    <WorkoutLaunchContext.Provider value={launch}>
      {children}
      <WorkoutLaunch
        visible={!!cfg}
        routineName={cfg?.routineName ?? ''}
        subtitle={cfg?.subtitle}
        exercises={cfg?.exercises}
        career={career}
        onLaunch={handleLaunch}
        onClose={handleClose}
      />
    </WorkoutLaunchContext.Provider>
  );
}
