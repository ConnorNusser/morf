import DashboardHeader, { HeaderStats } from "@/components/DashboardHeader";
import { FeedView } from "@/components/feed";
import CareerModal from "@/components/gamification/CareerModal";
import PowerliftingTotal from "@/components/home/PowerliftingTotal";
import TodayCard from "@/components/home/TodayCard";
import WeeklyGoalCard from "@/components/home/WeeklyGoalCard";
import LiftDisplayFilter from "@/components/LiftDisplayFilter";
import OverallStatsCard from "@/components/OverallStatsCard";
import LeaderboardModal from "@/components/profile/LeaderboardModal";
import UserProfileModal from "@/components/profile/UserProfileModal";
import SkeletonCard from "@/components/SkeletonCard";
import Spacer from "@/components/Spacer";
import StrengthProgressOverlay from "@/components/StrengthProgressOverlay";
import { View } from "@/components/Themed";
import Divider from "@/components/ui/Divider";
import NavRow from "@/components/ui/NavRow";
import SectionLabel from "@/components/ui/SectionLabel";
import UnlockNotificationModal, {
  NotificationType,
} from "@/components/UnlockNotificationModal";
import WorkoutStatsCard from "@/components/WorkoutStatsCard";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { PPL_COLORS } from "@/lib/data/pplCategories";
import {
  getStrengthLevelName,
  getStrengthTier,
} from "@/lib/data/strengthStandards";
import { computeMainLiftPRs } from "@/lib/gamification/personalRecords";
import { computeStrengthFeats } from "@/lib/gamification/strengthFeats";
import { getTierBandProgress } from "@/lib/gamification/tierTimeline";
import { userService } from "@/lib/services/userService";
import {
  HomeViewMode,
  PendingStrengthProgress,
  storageService,
} from "@/lib/storage/storage";
import { gap, layout } from "@/lib/ui/styles";
import { isSeasonalThemeAvailable } from "@/lib/ui/theme";
import { screenGutter, space } from "@/lib/ui/tokens";
import { calculateOverallPercentile } from "@/lib/utils/utils";
import { getLifetimeTotals } from "@/lib/workout/recapStats";
import {
  GeneratedWorkout,
  LiftDisplayFilters,
  RemoteUser,
  UserProgress,
} from "@/types";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ViewMode = HomeViewMode;

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  // Tighten the top: clear the status bar/notch via real insets instead of a
  // hardcoded 60px, which left a big gap above the Today card on most devices.
  const contentTopPadding = insets.top - 2;
  const { currentTheme, setThemeLevel } = useTheme();
  const { userProfile } = useUser();
  const [viewMode, setViewMode] = useState<ViewMode>("home");
  const [pendingProgress, setPendingProgress] =
    useState<PendingStrengthProgress | null>(null);
  const [unlockNotification, setUnlockNotification] =
    useState<NotificationType | null>(null);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);
  const [liftFilters, setLiftFilters] = useState<LiftDisplayFilters>({
    hiddenLiftIds: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedRefreshTrigger, setFeedRefreshTrigger] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showCareer, setShowCareer] = useState(false);
  const [selectedUser, setSelectedUser] = useState<RemoteUser | null>(null);
  const [lifetimeStats, setLifetimeStats] = useState<HeaderStats | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<GeneratedWorkout[]>([]);

  const filteredProgress = useMemo(
    () =>
      userProgress.filter(
        (p) => !liftFilters.hiddenLiftIds.includes(p.workoutId),
      ),
    [userProgress, liftFilters],
  );

  const overallStats = useMemo(() => {
    const pcts = filteredProgress.map((p) => p.percentileRanking);
    const pct = pcts.length ? calculateOverallPercentile(pcts) : 0;
    return {
      overallPercentile: pct,
      strengthLevel: pct > 0 ? getStrengthLevelName(pct) : "E-",
      improvementTrend: "improving" as const,
    };
  }, [filteredProgress]);

  // Powerlifting "big 3" total — combined best e1RM of squat + bench + deadlift,
  // computed in lb (the 1,000 lb club is an absolute lb milestone). Reuses the
  // same PR + feat math the Career screen does; no new tracking.
  const powerliftingTotal = useMemo(() => {
    if (!workoutHistory.length) return null;
    const prsLbs = computeMainLiftPRs(workoutHistory, "lbs");
    const feats = computeStrengthFeats(prsLbs);
    const total = feats[0]?.current ?? 0;
    if (total <= 0) return null;
    const next = feats.find((f) => !f.unlocked) ?? feats[feats.length - 1];
    const e1 = (id: string) =>
      Math.round(prsLbs.find((p) => p.exerciseId === id)?.estimatedOneRM ?? 0);
    const lifts = [
      { label: "Squat", value: e1("squat-barbell"), color: PPL_COLORS.legs },
      {
        label: "Bench",
        value: e1("bench-press-barbell"),
        color: PPL_COLORS.push,
      },
      {
        label: "Deadlift",
        value: e1("deadlift-barbell"),
        color: PPL_COLORS.pull,
      },
    ];
    // The ladder shows a rolling window — up to two clubs behind you plus the
    // one you're chasing — so the scale stays readable now that the club list
    // runs to 2,000 lb. Conquered clubs still count via achievedCount.
    const nextIdx = feats.findIndex((f) => !f.unlocked);
    const hiIdx = nextIdx === -1 ? feats.length - 1 : nextIdx;
    const clubs = feats
      .slice(Math.max(0, hiIdx - 2), hiIdx + 1)
      .map((f) => ({ value: f.target, achieved: f.unlocked }));
    const allUnlocked = feats.every((f) => f.unlocked);
    // The biggest claimed club, as the REAL achievement — the widget shows its
    // badge art and opens the shared achievement spotlight on tap.
    const claimed = [...feats].reverse().find((f) => f.unlocked);
    const currentClub = claimed
      ? {
          id: claimed.id,
          title: claimed.title,
          description: claimed.description,
          icon: claimed.icon,
          rarity: claimed.rarity,
        }
      : null;
    return {
      total,
      lifts,
      clubs,
      nextTarget: allUnlocked ? 0 : next.target,
      remaining: Math.max(0, next.target - total),
      achievedCount: feats.filter((f) => f.unlocked).length,
      allUnlocked,
      currentClub,
    };
  }, [workoutHistory]);

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
      setWorkoutHistory(history);

      const unit = profile?.weightUnitPreference || "lbs";

      // Surface the strength tier on the header (gamification).
      const visibleLifts = userProgressData.filter(
        (p) => !savedFilters.hiddenLiftIds.includes(p.workoutId),
      );
      const overall = visibleLifts.length
        ? calculateOverallPercentile(
            visibleLifts.map((p) => p.percentileRanking),
          )
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
    if (!userProfile) return;

    // Check Winter theme (Dec 1 - Mar 20)
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
            { paddingTop: contentTopPadding },
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
            onPress={() => setShowLeaderboard(true)}
          />

          {/* Strength summary: relative (percentile/tier) + absolute (Big-3 total)
              grouped as one block, split by a hairline divider. */}
          <View>
            <OverallStatsCard stats={overallStats} />
            {powerliftingTotal && (
              <>
                <Divider style={styles.strengthDivider} />
                <PowerliftingTotal data={powerliftingTotal} />
              </>
            )}
          </View>

          {userProgress.length > 0 && (
            <>
              <SectionLabel style={styles.sectionTitle}>
                Your lifts
              </SectionLabel>

              <LiftDisplayFilter
                availableLifts={userProgress}
                onFiltersChanged={setLiftFilters}
              />

              <View style={gap.gap20}>
                {filteredProgress.map((progress) => (
                  <WorkoutStatsCard key={progress.workoutId} stats={progress} />
                ))}
              </View>
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
    padding: screenGutter,
    gap: space.md,
  },
  feedHeader: {
    paddingHorizontal: screenGutter,
    paddingBottom: space.sm,
  },
  sectionTitle: {
    marginBottom: 0,
  },
  strengthDivider: {
    marginTop: space.xs,
    marginBottom: space.md,
  },
});
