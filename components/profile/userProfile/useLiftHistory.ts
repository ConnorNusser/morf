import { liftHistoryToProgress } from '@/lib/gamification/userProfileInsights';
import { userSyncService } from '@/lib/services/userSyncService';
import { RemoteUser, UserProgress } from '@/types';
import { useCallback, useState } from 'react';

/** Selected lift + its remote 1RM history; tapping the selected lift again collapses it. */
export function useLiftHistory(user: RemoteUser | null) {
  const [selectedLiftId, setSelectedLiftId] = useState<string | null>(null);
  const [liftHistory, setLiftHistory] = useState<UserProgress[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const loadLiftHistory = useCallback(async (exerciseId: string) => {
    if (!user) return;

    if (selectedLiftId === exerciseId) {
      setSelectedLiftId(null);
      setLiftHistory([]);
      return;
    }

    setSelectedLiftId(exerciseId);
    setIsLoadingHistory(true);

    try {
      const history = await userSyncService.getUserLiftHistory(user.id, exerciseId);

      const progressData: UserProgress[] = liftHistoryToProgress(exerciseId, history);

      setLiftHistory(progressData);
    } catch (error) {
      console.error('Error loading lift history:', error);
      setLiftHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [user, selectedLiftId]);

  return { selectedLiftId, liftHistory, isLoadingHistory, loadLiftHistory };
}
