import { BodyRegion } from '@/lib/data/bodyRegions';
import { trainRegionRequest } from '@/lib/gamification/bodyGraphDisplay';
import { setPendingGenerate } from '@/lib/workout/pendingRoutine';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';

// "Train this": hand an AI-generation request to the Workout tab, which opens the
// plan builder pre-submitted with a workout focused on the region's muscle group.
export function useTrainRegion(): (region: BodyRegion) => void {
  const router = useRouter();
  return useCallback(
    (region: BodyRegion) => {
      setPendingGenerate(trainRegionRequest(region));
      router.push('/workout');
    },
    [router],
  );
}
