import DashboardHeader from '@/components/DashboardHeader';
import { FeedView } from '@/components/feed';
import LiftDisplayFilter from '@/components/LiftDisplayFilter';
import OverallStatsCard from '@/components/OverallStatsCard';
import LeaderboardModal from '@/components/profile/LeaderboardModal';
import UserProfileModal from '@/components/profile/UserProfileModal';
import SkeletonCard from '@/components/SkeletonCard';
import Spacer from '@/components/Spacer';
import StrengthProgressOverlay from '@/components/StrengthProgressOverlay';
import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial';
import UnlockNotificationModal, { NotificationType } from '@/components/UnlockNotificationModal';
import WorkoutStatsCard from '@/components/WorkoutStatsCard';
import { useTheme } from '@/contexts/ThemeContext';
import { useTutorial } from '@/contexts/TutorialContext';
import { useUser } from '@/contexts/UserContext';
import { gap, layout } from '@/lib/ui/styles';
import { HomeViewMode, PendingStrengthProgress, storageService } from '@/lib/storage/storage';
import { getStrengthLevelName } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { isSeasonalThemeAvailable } from '@/lib/ui/theme';
import { calculateOverallPercentile } from '@/lib/utils/utils';
import { LiftDisplayFilters, RemoteUser, UserProgress } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

type ViewMode = HomeViewMode;

export default function HomeScreen() {
  const { currentTheme, setThemeLevel } = useTheme();
  const { tutorialState } = useTutorial();
  const { userProfile } = useUser();
  const [viewMode, setViewMode] = useState<ViewMode>('home');
  const [pendingProgress, setPendingProgress] = useState<PendingStrengthProgress | null>(null);
  const [unlockNotification, setUnlockNotification] = useState<NotificationType | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<UserProgress[]>([]);
  const [liftFilters, setLiftFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });
  const [overallStats, setOverallStats] = useState({
    overallPercentile: 0,
    strengthLevel: 'E-',
    improvementTrend: 'stable' as 'improving' | 'stable' | 'declining',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedRefreshTrigger, setFeedRefreshTrigger] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);

  // Load saved view mode on mount
  useEffect(() => {
    const loadViewMode = async () => {
      const savedMode = await storageService.getHomeViewMode();
      setViewMode(savedMode);
    };
    loadViewMode();
  }, []);

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProgress, liftFilters]);

  useEffect(() => {
    updateOverallStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredProgress]);

  const loadUserData = async () => {
    try {
      await userService.getUserProfileOrDefault();

      const [userProgressData, savedFilters] = await Promise.all([
        userService.getAllFeaturedLifts(),
        storageService.getLiftDisplayFilters()
      ]);

      setUserProgress(userProgressData);
      setLiftFilters(savedFilters);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading user data:', error);
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    const filtered = userProgress.filter(progress =>
      !liftFilters.hiddenLiftIds.includes(progress.workoutId)
    );
    setFilteredProgress(filtered);
  };

  const updateOverallStats = () => {
    const percentiles = filteredProgress.map(p => p.percentileRanking);
    const calculatedPercentile = percentiles.length > 0 ? calculateOverallPercentile(percentiles) : 0;
    const strengthLevel = calculatedPercentile > 0 ? getStrengthLevelName(calculatedPercentile) : 'E-';
    setOverallStats({
      overallPercentile: calculatedPercentile,
      strengthLevel,
      improvementTrend: 'improving',
    });
  };

  const handleViewModeChange = async (mode: ViewMode) => {
    setViewMode(mode);
    await storageService.saveHomeViewMode(mode);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (viewMode === 'feed') {
      setFeedRefreshTrigger(prev => prev + 1);
    } else {
      await loadUserData();
    }
    setIsRefreshing(false);
  };

  const handleFiltersChanged = (newFilters: LiftDisplayFilters) => {
    setLiftFilters(newFilters);
  };

  const handleUserPress = (user: RemoteUser) => {
    setSelectedUser(user);
  };

  // Check for pending strength progress on focus
  const checkPendingProgress = useCallback(async () => {
    const progress = await storageService.getPendingStrengthProgress();
    if (progress) {
      setPendingProgress(progress);
    }
  }, []);

  const handleDismissProgress = useCallback(async () => {
    setPendingProgress(null);
    await storageService.clearPendingStrengthProgress();
  }, []);

  // Check for unlock notifications (seasonal themes, etc.)
  const checkUnlockNotifications = useCallback(async () => {
    // Only show to logged-in users who completed tutorial
    if (!userProfile) return;
    if (!tutorialState.hasCompletedAppTutorial) return;

    // Check Christmas theme (Dec 1 - Jan 15)
    if (isSeasonalThemeAvailable('christmas_theme_2025')) {
      const shown = await storageService.hasNotificationBeenShown('christmas_theme_2025');
      if (!shown) {
        setUnlockNotification('christmas_theme');
        return;
      }
    }
  }, [userProfile, tutorialState.hasCompletedAppTutorial]);

  const handleDismissUnlock = useCallback(async () => {
    if (unlockNotification === 'christmas_theme') {
      await storageService.markNotificationShown('christmas_theme_2025');
    }
    setUnlockNotification(null);
  }, [unlockNotification]);

  const handleActivateUnlock = useCallback(() => {
    if (unlockNotification === 'christmas_theme') {
      setThemeLevel('christmas_theme_2025');
    }
  }, [unlockNotification, setThemeLevel]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      checkPendingProgress();
      checkUnlockNotifications();
    }, [checkPendingProgress, checkUnlockNotifications])
  );

  if (isLoading) {
    return (
      <ScrollView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
          <DashboardHeader />
          <SkeletonCard variant="overall" />
          <SkeletonCard variant="button" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </View>
        <Spacer height={100} />
      </ScrollView>
    );
  }

  // Feed mode uses its own FlatList for infinite scrolling
  if (viewMode === 'feed') {
    return (
      <>
        <View style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.feedHeader, { backgroundColor: 'transparent' }]}>
            <DashboardHeader
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />
          </View>
          <FeedView
            onUserPress={handleUserPress}
            refreshTrigger={feedRefreshTrigger}
          />
        </View>

        <UserProfileModal
          visible={selectedUser !== null}
          onClose={() => setSelectedUser(null)}
          user={selectedUser}
        />
      </>
    );
  }

  return (
    <>
      <ScrollView
        style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={currentTheme.colors.primary}
          />
        }
      >
        <View style={[styles.content, { backgroundColor: 'transparent' }]}>
          <DashboardHeader
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
          />

          <TutorialTarget id="home-overall-stats">
            <OverallStatsCard stats={overallStats} />
          </TutorialTarget>

          <TutorialTarget id="home-leaderboard-button">
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
              onPress={() => setShowLeaderboard(true)}
              activeOpacity={0.7}
            >
              <Text style={[styles.actionButtonText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                View Leaderboards
              </Text>
              <Ionicons name="chevron-forward" size={18} color={currentTheme.colors.text + '60'} />
            </TouchableOpacity>
          </TutorialTarget>

          {userProgress.length > 0 && (
            <>
              <View>
                <Text style={[
                  styles.sectionTitle,
                  {
                    color: currentTheme.colors.text,
                    marginBottom: 0,
                  }
                ]}>
                  Your Lifts
                </Text>
                <LiftDisplayFilter
                  availableLifts={userProgress}
                  onFiltersChanged={handleFiltersChanged}
                />
              </View>

              <TutorialTarget id="home-lift-cards">
                <View style={gap.gap20}>
                  {filteredProgress.map((progress) => (
                    <WorkoutStatsCard key={progress.workoutId} stats={progress} />
                  ))}
                </View>
              </TutorialTarget>
            </>
          )}
        </View>
        <Spacer height={100} />
      </ScrollView>

      <LeaderboardModal
        visible={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
      />

      <UserProfileModal
        visible={selectedUser !== null}
        onClose={() => setSelectedUser(null)}
        user={selectedUser}
      />

      {pendingProgress && (
        <StrengthProgressOverlay
          progress={pendingProgress}
          visible={pendingProgress !== null}
          onDismiss={handleDismissProgress}
        />
      )}

      <UnlockNotificationModal
        visible={unlockNotification !== null}
        notificationType={unlockNotification}
        onDismiss={handleDismissUnlock}
        onActivate={handleActivateUnlock}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingTop: 60,
    gap: 20,
  },
  feedHeader: {
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
  },
});
