import {
  AchievementShowcase,
  UserLiftData,
  summarizeAchievementShowcase,
} from '@/lib/gamification/userProfileInsights';
import { WorkoutSummary } from '@/lib/services/feedService';
import { supabase } from '@/lib/services/supabase';
import { userService } from '@/lib/services/userService';
import { userSyncService } from '@/lib/services/userSyncService';
import { RemoteUser, RemoteUserData, UserPercentileData } from '@/types';
import { useCallback, useEffect, useState } from 'react';

/**
 * Everything the profile sheet loads for `user` while it is visible: their
 * lifts, profile, percentile data, recent workouts and showcase, the viewer's
 * own lifts for the comparison, and the friend toggle.
 */
export function useUserProfileData(visible: boolean, user: RemoteUser | null) {
  const [lifts, setLifts] = useState<UserLiftData[]>([]);
  const [userData, setUserData] = useState<RemoteUserData | null>(null);
  const [percentileData, setPercentileData] = useState<UserPercentileData | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [workoutCount, setWorkoutCount] = useState<number>(0);
  const [showcase, setShowcase] = useState<AchievementShowcase | null>(null);
  const [myLifts, setMyLifts] = useState<UserLiftData[]>([]);
  const [myUserData, setMyUserData] = useState<RemoteUserData | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memberSince, setMemberSince] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFriend, setIsFriend] = useState(false);
  const [isFriendLoading, setIsFriendLoading] = useState(false);

  const checkFriendStatus = useCallback(async () => {
    if (!user) return;
    const friendStatus = await userSyncService.isFriend(user.id);
    setIsFriend(friendStatus);
  }, [user]);

  const handleToggleFriend = async () => {
    if (!user) return;
    setIsFriendLoading(true);
    try {
      if (isFriend) {
        await userSyncService.removeFriend(user.id);
        setIsFriend(false);
      } else {
        await userSyncService.addFriend(user.id);
        setIsFriend(true);
      }
    } catch (error) {
      console.error('Error toggling friend:', error);
    } finally {
      setIsFriendLoading(false);
    }
  };

  const loadUserData = useCallback(async () => {
    if (!user || !supabase) return;

    setIsLoading(true);
    try {
      const currentUser = await userSyncService.getCurrentUser();
      setCurrentUserId(currentUser?.id || null);

      const [liftsResult, userResult, percentileResult, workoutsResult, workoutCountResult, feedDataResult] = await Promise.all([
        supabase
          .from('user_best_lifts')
          .select('exercise_id, estimated_1rm, recorded_at')
          .eq('user_id', user.id),
        supabase
          .from('users')
          .select('user_data, country_code, created_at')
          .eq('id', user.id)
          .single(),
        userSyncService.getUserPercentileData(user.id),
        userSyncService.getUserWorkouts(user.id, 5),
        supabase
          .from('user_workouts')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id),
        // Just the gamification snapshots — aggregated below into career PRs
        // and the rarest-achievements showcase.
        supabase
          .from('user_workouts')
          .select('feed_data')
          .eq('user_id', user.id)
      ]);

      if (liftsResult.error) {
        console.error('Error loading user lifts:', liftsResult.error);
        setLifts([]);
      } else {
        setLifts(liftsResult.data || []);
      }

      if (userResult.data) {
        if (userResult.data.user_data) {
          setUserData(userResult.data.user_data as RemoteUserData);
        } else {
          setUserData(null);
        }
        if (userResult.data.country_code && user) {
          user.country_code = userResult.data.country_code;
        }
        if (userResult.data.created_at) {
          setMemberSince(new Date(userResult.data.created_at));
        }
      } else {
        setUserData(null);
        setMemberSince(null);
      }

      setPercentileData(percentileResult);

      setRecentWorkouts(workoutsResult);

      setWorkoutCount(workoutCountResult.count || 0);

      setShowcase(summarizeAchievementShowcase(feedDataResult.data || []));

      // Current user's lifts and profile, for the comparison
      if (currentUser && currentUser.id !== user.id) {
        const [myLiftsResult, myProfile] = await Promise.all([
          supabase
            .from('user_best_lifts')
            .select('exercise_id, estimated_1rm, recorded_at')
            .eq('user_id', currentUser.id),
          userService.getUserProfileOrDefault()
        ]);
        setMyLifts(myLiftsResult.data || []);
        setMyUserData({
          height: myProfile.height,
          weight: myProfile.weight,
          gender: myProfile.gender,
        });
      } else {
        setMyLifts([]);
        setMyUserData(null);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      setLifts([]);
      setUserData(null);
      setPercentileData(null);
      setRecentWorkouts([]);
      setWorkoutCount(0);
      setShowcase(null);
      setMyLifts([]);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (visible && user) {
      loadUserData();
      checkFriendStatus();
    }
  }, [visible, user, loadUserData, checkFriendStatus]);

  return {
    lifts,
    userData,
    percentileData,
    recentWorkouts,
    workoutCount,
    showcase,
    myLifts,
    myUserData,
    currentUserId,
    memberSince,
    isLoading,
    isFriend,
    isFriendLoading,
    handleToggleFriend,
  };
}
