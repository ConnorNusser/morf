import WorkoutLaunch from '@/components/home/WorkoutLaunch';
import { userService } from '@/lib/services/userService';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface LaunchConfig {
  routineName: string;
  subtitle?: string;
  onArrive: () => void; // fired while the overlay still covers the screen
}

const WorkoutLaunchContext = createContext<(cfg: LaunchConfig) => void>(() => {});

// Trigger the shared "get ready" launch interstitial from anywhere (home routine,
// empty-state start, Quick start, repeating a recent workout).
export const useWorkoutLaunch = () => useContext(WorkoutLaunchContext);

export function WorkoutLaunchProvider({ children }: { children: React.ReactNode }) {
  const [cfg, setCfg] = useState<LaunchConfig | null>(null);
  const [percentile, setPercentile] = useState(0);
  const cfgRef = useRef<LaunchConfig | null>(null);
  cfgRef.current = cfg;

  const loadPercentile = useCallback(async () => {
    try {
      const lifts = await userService.getAllFeaturedLifts();
      const pcts = lifts.map(l => l.percentileRanking);
      setPercentile(pcts.length ? calculateOverallPercentile(pcts) : 0);
    } catch {
      // keep the last known percentile
    }
  }, []);

  useEffect(() => {
    loadPercentile();
  }, [loadPercentile]);

  const launch = useCallback(
    (c: LaunchConfig) => {
      loadPercentile();
      setCfg(c);
    },
    [loadPercentile],
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
        percentile={percentile}
        onLaunch={handleLaunch}
        onClose={handleClose}
      />
    </WorkoutLaunchContext.Provider>
  );
}
