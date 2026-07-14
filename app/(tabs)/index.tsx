import DashboardHeader, { HeaderStats } from "@/components/DashboardHeader";
import { FeedView } from "@/components/feed";
import CareerModal from "@/components/gamification/CareerModal";
import LeagueBoard from "@/components/home/league/LeagueBoard";
import LeagueCard from "@/components/home/league/LeagueCard";
import TodayCard from "@/components/home/TodayCard";
import WeeklyGoalCard from "@/components/home/WeeklyGoalCard";
import UserProfileModal from "@/components/profile/UserProfileModal";
import SkeletonCard from "@/components/SkeletonCard";
import StrengthProgressOverlay from "@/components/StrengthProgressOverlay";
import { View } from "@/components/Themed";
import ScreenBackground from "@/components/ui/ScreenBackground";
import UnlockNotificationModal, {
  NotificationType,
} from "@/components/UnlockNotificationModal";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { getStrengthTier } from "@/lib/data/strengthStandards";
import { getTierBandProgress } from "@/lib/gamification/tierTimeline";
import { userService } from "@/lib/services/userService";
import { userSyncService } from "@/lib/services/userSyncService";
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
  const { feed: feedParam, league: leagueParam } = useLocalSearchParams<{ feed?: string; league?: string }>();
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [pendingProgress, setPendingProgress] =
    useState<PendingStrengthProgress | null>(null);
  const [unlockNotification, setUnlockNotification] =
    useState<NotificationType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedRefreshTrigger] = useState(0);
  const [showLeague, setShowLeague] = useState(false);
  const [showCareer, setShowCareer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [lifetimeStats, setLifetimeStats] = useState<HeaderStats | null>(null);
  // The viewer's own backend user, for the feed header's profile button.
  const [currentUser, setCurrentUser] = useState<RemoteUser | null>(null);

  useEffect(() => {
    const loadViewMode = async () => {
      const savedMode = await storageService.getHomeViewMode();
      setViewMode(savedMode);
    };
    loadViewMode();
    userSyncService.getCurrentUser().then(setCurrentUser);
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

  // League deep link (?league=1) — overtake pushes land here.
  useFocusEffect(
    useCallback(() => {
      if (!leagueParam) return;
      setViewMode("home");
      setShowLeague(true);
      router.setParams({ league: "" });
    }, [leagueParam, router]),
  );

  if (isLoading) {
    return (
      <ScreenBackground>
        <ScrollView
          style={layout.flex1}
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
      </ScreenBackground>
    );
  }

  // Feed mode uses its own FlatList for infinite scrolling
  if (viewMode === "feed") {
    return (
      <>
        <ScreenBackground>
          <View
            style={[
              styles.feedHeader,
              { paddingTop: contentTopPadding },
            ]}
          >
            <DashboardHeader
              viewMode={viewMode}
              onViewModeChange={handleViewModeChange}
              onProfilePress={
                currentUser ? () => setSelectedUser(currentUser) : undefined
              }
              profileImageUrl={currentUser?.profile_picture_url}
            />
          </View>
          <FeedView
            onUserPress={setSelectedUser}
            refreshTrigger={feedRefreshTrigger}
          />
        </ScreenBackground>

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
      {/* Scroll when content is tall (so the last card is never sliced);
          flexGrow fills the viewport when it's short so the flex spacer can
          pin the league card to the bottom instead of leaving dead space. */}
      <ScreenBackground>
      <ScrollView
        style={layout.flex1}
        contentContainerStyle={[
          styles.content,
          styles.homeContent,
          {
            paddingTop: contentTopPadding,
            // Clear the floating tab bar so the last card (the league card)
            // isn't sliced — matches the scrollBottom clearance used elsewhere.
            paddingBottom: scrollBottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <DashboardHeader
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          stats={lifetimeStats ?? undefined}
          onTierPress={() => setShowCareer(true)}
        />

        <WeeklyGoalCard />
        <TodayCard />

        {/* Absorbs leftover height; collapses to zero once content scrolls. */}
        <View style={layout.flex1} />

        <LeagueCard onPress={() => setShowLeague(true)} />
      </ScrollView>
      </ScreenBackground>

      <LeagueBoard
        visible={showLeague}
        onClose={() => setShowLeague(false)}
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
  homeContent: {
    flexGrow: 1,
  },
  feedHeader: {
    paddingHorizontal: screenGutter,
    paddingBottom: space.sm,
  },
});
