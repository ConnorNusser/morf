import DashboardHeader, { HeaderStats } from "@/components/DashboardHeader";
import { FeedView } from "@/components/feed";
import CareerModal from "@/components/gamification/CareerModal";
import TodayCard from "@/components/home/TodayCard";
import WeeklyGoalCard from "@/components/home/WeeklyGoalCard";
import LeaderboardModal from "@/components/profile/LeaderboardModal";
import UserProfileModal from "@/components/profile/UserProfileModal";
import SkeletonCard from "@/components/SkeletonCard";
import StrengthProgressOverlay from "@/components/StrengthProgressOverlay";
import { View } from "@/components/Themed";
import NavRow from "@/components/ui/NavRow";
import UnlockNotificationModal, {
  NotificationType,
} from "@/components/UnlockNotificationModal";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { getStrengthTier } from "@/lib/data/strengthStandards";
import { getTierBandProgress } from "@/lib/gamification/tierTimeline";
import { userService } from "@/lib/services/userService";
import {
  HomeViewMode,
  PendingStrengthProgress,
  storageService,
} from "@/lib/storage/storage";
import { layout } from "@/lib/ui/styles";
import { isSeasonalThemeAvailable } from "@/lib/ui/theme";
import { screenGutter, scrollBottom, space } from "@/lib/ui/tokens";
import { calculateOverallPercentile } from "@/lib/utils/utils";
import { RemoteUser } from "@/types";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ViewMode = HomeViewMode;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  // Clear the status bar/notch via real insets; content scrolls under it.
  const contentTopPadding = insets.top;
  const { currentTheme, setThemeLevel } = useTheme();
  const { userProfile } = useUser();
  const router = useRouter();
  const { feed: feedParam } = useLocalSearchParams<{ feed?: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [pendingProgress, setPendingProgress] =
    useState<PendingStrengthProgress | null>(null);
  const [unlockNotification, setUnlockNotification] =
    useState<NotificationType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedRefreshTrigger] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCareer, setShowCareer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [lifetimeStats, setLifetimeStats] = useState<HeaderStats | null>(null);

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

  const loadUserData = async () => {
    try {
      // Ensure a profile exists before reading user-scoped data.
      await userService.getUserProfileOrDefault();

      const [userProgressData, savedFilters] = await Promise.all([
        userService.getAllFeaturedLifts(),
        storageService.getLiftDisplayFilters(),
      ]);

      const visibleLifts = userProgressData.filter(
        (p) => !savedFilters.hiddenLiftIds.includes(p.workoutId),
      );
      const overall = visibleLifts.length
        ? calculateOverallPercentile(
            visibleLifts.map((p) => p.percentileRanking),
          )
        : 0;

      setLifetimeStats({
        tier: getStrengthTier(overall),
        tierProgress: getTierBandProgress(overall).progress,
      });

      setIsLoading(false);
    } catch (error) {
      console.error("Error loading user data:", error);
      setIsLoading(false);
    }
  };

  const handleViewModeChange = async (mode: ViewMode) => {
    setViewMode(mode);
    await storageService.saveHomeViewMode(mode);
  };

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

  const checkUnlockNotifications = useCallback(async () => {
    if (!userProfile) return;

    // Winter theme window: Dec 1 - Mar 20
    if (isSeasonalThemeAvailable("winter_2026")) {
      const shown =
        await storageService.hasNotificationBeenShown("winter_2026");
      if (!shown) {
        setUnlockNotification("winter_theme");
        return;
      }
    }
  }, [userProfile]);

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

  // Post-workout (no strength win) arrival (?feed=1): show feed without persisting
  // the preference, then clear the param so a later visit respects the saved default.
  useFocusEffect(
    useCallback(() => {
      if (!feedParam) return;
      setViewMode("feed");
      router.setParams({ feed: "" });
    }, [feedParam, router]),
  );

  if (isLoading) {
    return (
      <ScrollView
        style={[
          layout.flex1,
          { backgroundColor: currentTheme.colors.background },
        ]}
        contentContainerStyle={styles.scrollContent}
      >
        <View
          style={[
            styles.content,
            { paddingTop: contentTopPadding },
          ]}
        >
          <DashboardHeader />
          <SkeletonCard variant="overall" />
          <SkeletonCard variant="button" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
          <SkeletonCard variant="stats" />
        </View>
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
              { paddingTop: contentTopPadding },
            ]}
          >
            <DashboardHeader
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
            />
          </View>
          <FeedView
            onUserPress={setSelectedUser}
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
      <View
        style={[
          styles.content,
          layout.flex1,
          {
            backgroundColor: currentTheme.colors.background,
            paddingTop: contentTopPadding,
            // Clear the floating tab bar so the last card (View Leaderboards)
            // isn't sliced — matches the scrollBottom clearance used elsewhere.
            paddingBottom: scrollBottom,
          },
        ]}
      >
        <DashboardHeader
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          stats={lifetimeStats ?? undefined}
          onTierPress={() => setShowCareer(true)}
        />

        <WeeklyGoalCard />
        <TodayCard />

        <NavRow
          label="View Leaderboards"
          icon="trophy-outline"
          variant="card"
          onPress={() => setShowLeaderboard(true)}
        />
      </View>

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
  scrollContent: {
    paddingBottom: scrollBottom,
  },
  content: {
    padding: screenGutter,
    gap: space.sm,
  },
  feedHeader: {
    paddingHorizontal: screenGutter,
    paddingBottom: space.sm,
  },
});
