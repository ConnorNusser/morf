import DashboardHeader, { HeaderStats } from "@/components/DashboardHeader";
import { FeedView } from "@/components/feed";
import CareerModal from "@/components/gamification/CareerModal";
import TodayCard from "@/components/home/TodayCard";
import WeeklyGoalCard from "@/components/home/WeeklyGoalCard";
import LiftDisplayFilter from "@/components/LiftDisplayFilter";
import OverallStatsCard from "@/components/OverallStatsCard";
import LeaderboardModal from "@/components/profile/LeaderboardModal";
import UserProfileModal from "@/components/profile/UserProfileModal";
import SkeletonCard from "@/components/SkeletonCard";
import Spacer from "@/components/Spacer";
import StrengthProgressOverlay from "@/components/StrengthProgressOverlay";
import { Text, View } from "@/components/Themed";
import { TutorialTarget } from "@/components/tutorial";
import UnlockNotificationModal, {
  NotificationType,
} from "@/components/UnlockNotificationModal";
import WorkoutStatsCard from "@/components/WorkoutStatsCard";
import { useTheme } from "@/contexts/ThemeContext";
import { useTutorial } from "@/contexts/TutorialContext";
import { useUser } from "@/contexts/UserContext";
import { getStrengthLevelName, getStrengthTier } from "@/lib/data/strengthStandards";
import { getTierBandProgress } from "@/lib/gamification/tierTimeline";
import { userService } from "@/lib/services/userService";
import { getLifetimeTotals } from "@/lib/workout/recapStats";
import {
  HomeViewMode,
  PendingStrengthProgress,
  storageService,
} from "@/lib/storage/storage";
import { gap, layout } from "@/lib/ui/styles";
import { isSeasonalThemeAvailable } from "@/lib/ui/theme";
import { calculateOverallPercentile } from "@/lib/utils/utils";
import { LiftDisplayFilters, RemoteUser, UserProgress } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useState } from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ViewMode = HomeViewMode;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  // Tighten the top: clear the status bar/notch via real insets instead of a
  // hardcoded 60px, which left a big gap above the Today card on most devices.
  const contentTopPadding = insets.top - 2;
  const { currentTheme, setThemeLevel } = useTheme();
  const { tutorialState } = useTutorial();
  const { userProfile } = useUser();
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [pendingProgress, setPendingProgress] =
    useState<PendingStrengthProgress | null>(null);
  const [unlockNotification, setUnlockNotification] =
    useState<NotificationType | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [filteredProgress, setFilteredProgress] = useState<UserProgress[]>([]);
  const [liftFilters, setLiftFilters] = useState<LiftDisplayFilters>({
    hiddenLiftIds: [],
  });
  const [overallStats, setOverallStats] = useState({
    overallPercentile: 0,
    strengthLevel: "E-",
    improvementTrend: "stable" as "improving" | "stable" | "declining",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedRefreshTrigger, setFeedRefreshTrigger] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCareer, setShowCareer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [lifetimeStats, setLifetimeStats] = useState<HeaderStats | null>(null);

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
      const profile = await userService.getUserProfileOrDefault();

      const [userProgressData, savedFilters, history] = await Promise.all([
        userService.getAllFeaturedLifts(),
        storageService.getLiftDisplayFilters(),
        storageService.getWorkoutHistory(),
      ]);

      setUserProgress(userProgressData);
      setLiftFilters(savedFilters);

      const unit = profile?.weightUnitPreference || "lbs";

      // Surface the strength tier on the header (gamification).
      const visibleLifts = userProgressData.filter(
        (p) => !savedFilters.hiddenLiftIds.includes(p.workoutId),
      );
      const overall = visibleLifts.length
        ? calculateOverallPercentile(visibleLifts.map((p) => p.percentileRanking))
        : 0;

      setLifetimeStats({
        ...getLifetimeTotals(history, unit),
        unit,
        tier: getStrengthTier(overall),
        tierProgress: getTierBandProgress(overall).progress,
      });

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading user data:", error);
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    const filtered = userProgress.filter(
      (progress) => !liftFilters.hiddenLiftIds.includes(progress.workoutId),
    );
    setFilteredProgress(filtered);
  };

  const updateOverallStats = () => {
    const percentiles = filteredProgress.map((p) => p.percentileRanking);
    const calculatedPercentile =
      percentiles.length > 0 ? calculateOverallPercentile(percentiles) : 0;
    const strengthLevel =
      calculatedPercentile > 0
        ? getStrengthLevelName(calculatedPercentile)
        : "E-";
    setOverallStats({
      overallPercentile: calculatedPercentile,
      strengthLevel,
      improvementTrend: "improving",
    });
  };

  const handleViewModeChange = async (mode: ViewMode) => {
    setViewMode(mode);
    await storageService.saveHomeViewMode(mode);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (viewMode === "feed") {
      setFeedRefreshTrigger((prev) => prev + 1);
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

    // Check Winter theme (Dec 1 - Mar 20)
    if (isSeasonalThemeAvailable("winter_2026")) {
      const shown =
        await storageService.hasNotificationBeenShown("winter_2026");
      if (!shown) {
        setUnlockNotification("winter_theme");
        return;
      }
    }
  }, [userProfile, tutorialState.hasCompletedAppTutorial]);

  const handleDismissUnlock = useCallback(async () => {
    if (unlockNotification === "winter_theme") {
      await storageService.markNotificationShown("winter_2026");
    }
    setUnlockNotification(null);
  }, [unlockNotification]);

  const handleActivateUnlock = useCallback(() => {
    if (unlockNotification === "winter_theme") {
      setThemeLevel("winter_2026");
    }
  }, [unlockNotification, setThemeLevel]);

  useFocusEffect(
    useCallback(() => {
      loadUserData();
      checkPendingProgress();
      checkUnlockNotifications();
    }, [checkPendingProgress, checkUnlockNotifications]),
  );

  if (isLoading) {
    return (
      <ScrollView
        style={[
          layout.flex1,
          { backgroundColor: currentTheme.colors.background },
        ]}
      >
        <View
          style={[
            styles.content,
            { paddingTop: contentTopPadding, backgroundColor: "transparent" },
          ]}
        >
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
  if (viewMode === "feed") {
    return (
      <>
        <View
          style={[
            layout.flex1,
            { backgroundColor: currentTheme.colors.background },
          ]}
        >
          <View
            style={[
              styles.feedHeader,
              { paddingTop: contentTopPadding, backgroundColor: "transparent" },
            ]}
          >
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
        style={[
          layout.flex1,
          { backgroundColor: currentTheme.colors.background },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={currentTheme.colors.primary}
          />
        }
      >
        <View
          style={[
            styles.content,
            { paddingTop: contentTopPadding, backgroundColor: "transparent" },
          ]}
        >
          <Animated.View entering={FadeIn.duration(350)}>
            <DashboardHeader
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              stats={lifetimeStats ?? undefined}
              onTierPress={() => setShowCareer(true)}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(450).springify().damping(18)}>
            <TodayCard />
          </Animated.View>
          <Animated.View entering={FadeInDown.delay(130).duration(450).springify().damping(18)}>
            <WeeklyGoalCard />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(450).springify().damping(18)}>
            <TutorialTarget id="home-overall-stats">
              <OverallStatsCard stats={overallStats} />
            </TutorialTarget>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(270).duration(450).springify().damping(18)}>
            <TutorialTarget id="home-leaderboard-button">
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
                onPress={() => setShowLeaderboard(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.actionButtonText,
                    {
                      color: currentTheme.colors.text,
                      fontFamily: currentTheme.fonts.medium,
                    },
                  ]}
                >
                  View Leaderboards
                </Text>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={currentTheme.colors.text + "60"}
                />
              </TouchableOpacity>
            </TutorialTarget>
          </Animated.View>

          {userProgress.length > 0 && (
            <>
              <Animated.View entering={FadeInDown.delay(340).duration(450).springify().damping(18)}>
                <Text
                  style={[
                    styles.sectionTitle,
                    {
                      color: currentTheme.colors.text,
                      marginBottom: 0,
                    },
                  ]}
                >
                  Your Lifts
                </Text>
                <LiftDisplayFilter
                  availableLifts={userProgress}
                  onFiltersChanged={handleFiltersChanged}
                />
              </Animated.View>

              <TutorialTarget id="home-lift-cards">
                <View style={gap.gap20}>
                  {filteredProgress.map((progress, i) => (
                    <Animated.View
                      key={progress.workoutId}
                      entering={FadeInDown.delay(400 + i * 70).duration(450).springify().damping(18)}
                    >
                      <WorkoutStatsCard stats={progress} />
                    </Animated.View>
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

      <CareerModal
        visible={showCareer}
        onClose={() => {
          setShowCareer(false);
          loadUserData();
        }}
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
    gap: 20,
  },
  feedHeader: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: 15,
  },
});
