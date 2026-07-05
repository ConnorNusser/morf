import WorkoutLaunch from '@/components/home/WorkoutLaunch';
import { loadCareerData } from '@/lib/gamification/careerData';
import { WeightUnit } from '@/types';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

export interface CareerSnapshot {
  percentile: number;
  unit?: WeightUnit;
  totalVolume?: number;
  totalWorkouts?: number;
  totalSets?: number;
  daysActive?: number;
  currentStreak?: number;
  recentAchievement?: string;
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
      const recent =
        d.achievements.find(a => d.newIds.has(a.id)) ??
        [...d.achievements].reverse().find(a => a.unlocked);
      setCareer({
        percentile: d.overall,
        unit: d.stats.unit,
        totalVolume: d.stats.totalVolume,
        totalWorkouts: d.stats.totalWorkouts,
        totalSets: d.stats.totalSets,
        daysActive: d.stats.daysActive,
        currentStreak: d.stats.currentStreak,
        recentAchievement: d.newIds.size > 0 ? recent?.title : undefined,
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
