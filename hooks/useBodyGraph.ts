import { BodyGraphData, loadBodyGraphData } from '@/lib/gamification/careerData';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

// Body-graph state for the current user, recomputed each time the screen gains
// focus (a finished workout changes volume and tiers). null until first load.
export function useBodyGraph(): BodyGraphData | null {
  const [data, setData] = useState<BodyGraphData | null>(null);
  useFocusEffect(
    useCallback(() => {
      let active = true;
      loadBodyGraphData()
        .then(d => {
          if (active) setData(d);
        })
        .catch(err => console.error('useBodyGraph: failed to load', err));
      return () => {
        active = false;
      };
    }, []),
  );
  return data;
}
