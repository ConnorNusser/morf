import Card from "@/components/Card";
import Chip from "@/components/Chip";
import ExerciseCard from "@/components/history/ExerciseCard";
import ExerciseHistoryModal from "@/components/history/ExerciseHistoryModal";
import YourLifts from "@/components/history/YourLifts";
import { buildPRDays } from "@/components/history/prSessions";
import SessionsFeed from "@/components/history/SessionsFeed";
import WorkoutDetailModal from "@/components/history/WorkoutDetailModal";
import PowerliftingTotal from "@/components/home/PowerliftingTotal";
import MonthlyTrendsModal from "@/components/MonthlyTrendsModal";
import OverallStatsCard from "@/components/OverallStatsCard";
import { Text, useInk, View } from "@/components/Themed";
import Divider from "@/components/ui/Divider";
import EmptyState from "@/components/ui/EmptyState";
import NavRow from "@/components/ui/NavRow";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import StatStrip from "@/components/ui/StatStrip";
import { useCustomExercises } from "@/contexts/CustomExercisesContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { PPL_COLORS } from "@/lib/data/pplCategories";
import { getStrengthLevelName } from "@/lib/data/strengthStandards";
import { computeMainLiftPRs } from "@/lib/gamification/personalRecords";
import { computeStrengthFeats } from "@/lib/gamification/strengthFeats";
import { attributeAchievements } from "@/lib/history/achievementAttribution";
import { buildExerciseStats } from "@/lib/history/exerciseStats";
import { computeExerciseTrend } from "@/lib/history/exerciseTrend";
import { buildSessionRecaps } from "@/lib/history/sessionRecap";
import { userService } from "@/lib/services/userService";
import { storageService } from "@/lib/storage/storage";
import { layout } from "@/lib/ui/styles";
import {
  panelPad,
  radius,
  screenGutter,
  scrollBottom,
  space,
} from "@/lib/ui/tokens";
import { type as typeScale } from "@/lib/ui/typography";
import { calculateOverallPercentile } from "@/lib/utils/utils";
import {
  convertWeight,
  ExerciseWithMax,
  GeneratedWorkout,
  UserProgress,
  WeightUnit,
} from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import playHapticFeedback from "@/lib/utils/haptic";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from "react-native";

type TabType = "overview" | "sessions" | "exercises";
type ExerciseSort = "1rm" | "recent" | "name" | "improved";

const TABS: { key: TabType; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "sessions", label: "Sessions" },
  { key: "exercises", label: "Exercises" },
];

const EXERCISE_SORTS: { key: ExerciseSort; label: string }[] = [
  { key: "1rm", label: "Top 1RM" },
  { key: "recent", label: "Recent" },
  { key: "improved", label: "Improved" },
  { key: "name", label: "A–Z" },
];

// Signed e1RM gain (shared trend def) so "Improved" sort agrees with the per-card delta.
function getImprovement(history: ExerciseWithMax["history"]): number {
  const trend = computeExerciseTrend(history, "lbs", "e1rm");
  return trend.isPositive ? trend.deltaDisplay : -trend.deltaDisplay;
}

export default function HistoryScreen() {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { userProfile } = useUser();
  const router = useRouter();
  const { celebrate } = useLocalSearchParams<{ celebrate?: string }>();
  const { customExercises } = useCustomExercises();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // Post-workout replay: bumping replayKey remounts the strength summary so bars
  // sweep up; replayFrom = pre-workout percentile to animate from (undefined = fresh fill).
  const [replayKey, setReplayKey] = useState(0);
  const [replayFrom, setReplayFrom] = useState<number | undefined>(undefined);

  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);
  const [exerciseStats, setExerciseStats] = useState<ExerciseWithMax[]>([]);
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);

  const [selectedWorkout, setSelectedWorkout] =
    useState<GeneratedWorkout | null>(null);
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseWithMax | null>(null);
  const [showMonthlyTrends, setShowMonthlyTrends] = useState(false);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);

  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseSort, setExerciseSort] = useState<ExerciseSort>("1rm");

  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || "lbs";

  // Bodyweight (lbs) powers the aggregate Strength Index percentile in the hero.
  const bodyweightLbs = useMemo(
    () =>
      userProfile?.weight
        ? Math.round(
            convertWeight(
              userProfile.weight.value,
              userProfile.weight.unit,
              "lbs",
            ),
          )
        : undefined,
    [userProfile?.weight],
  );

  const loadHistory = useCallback(async () => {
    try {
      const history = await storageService.getWorkoutHistory();
      const sorted = history.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setWorkouts(sorted);
    } catch (error) {
      console.error("Error loading workout history:", error);
    }
  }, []);

  const loadExerciseStats = useCallback(async () => {
    try {
      const workoutHistory = await storageService.getWorkoutHistory();
      // Keeps bodyweight (weight-0) lifts, scoring them on reps instead of dropping them.
      setExerciseStats(
        buildExerciseStats(workoutHistory, customExercises, weightUnit),
      );
    } catch (error) {
      console.error("Error loading exercise stats:", error);
    }
  }, [weightUnit, customExercises]);

  const loadStrength = useCallback(async () => {
    try {
      setUserProgress(await userService.getAllFeaturedLifts());
    } catch (error) {
      console.error("Error loading strength stats:", error);
    }
  }, []);

  // Pin achievements on the session that earned them — replayed deterministically
  // from history, so it works retroactively with no unlock timestamps.
  const achievementsByWorkout = useMemo(
    () => attributeAchievements(workouts, weightUnit),
    [workouts, weightUnit],
  );

  useEffect(() => {
    loadHistory();
    loadExerciseStats();
    loadStrength();
  }, [loadHistory, loadExerciseStats, loadStrength]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadExerciseStats();
      loadStrength();
    }, [loadHistory, loadExerciseStats, loadStrength]),
  );

  // Post-workout arrival (?celebrate=1): reload strength so cards hold new numbers,
  // then remount to sweep bars up from the pre-workout percentile. Consume-once.
  useFocusEffect(
    useCallback(() => {
      if (!celebrate) return;
      let cancelled = false;
      (async () => {
        await Promise.all([loadHistory(), loadStrength(), loadExerciseStats()]);
        if (cancelled) return;
        const progress = await storageService.getPendingStrengthProgress();
        setReplayFrom(progress?.previousPercentile);
        setReplayKey((k) => k + 1);
        playHapticFeedback("success", false);
        await storageService.clearPendingStrengthProgress();
        router.setParams({ celebrate: "" });
      })();
      return () => {
        cancelled = true;
      };
    }, [celebrate, router, loadHistory, loadStrength, loadExerciseStats]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHistory(), loadExerciseStats(), loadStrength()]);
    setRefreshing(false);
  };

  // Reflective session feed, newest first. When the profile supports grading
  // (bodyweight + gender), the standout set also carries its strength tier.
  const gender = userProfile?.gender;
  const age = userProfile?.age;
  const sessionRecaps = useMemo(
    () =>
      buildSessionRecaps(
        workouts,
        customExercises,
        weightUnit,
        bodyweightLbs && gender ? { bodyweightLbs, gender, age } : null,
      ),
    [workouts, customExercises, weightUnit, bodyweightLbs, gender, age],
  );

  const overallStats = useMemo(() => {
    const pcts = userProgress.map((p) => p.percentileRanking);
    const pct = pcts.length ? calculateOverallPercentile(pcts) : 0;
    return {
      overallPercentile: pct,
      strengthLevel: pct > 0 ? getStrengthLevelName(pct) : "E-",
      improvementTrend: "improving" as const,
    };
  }, [userProgress]);

  // Powerlifting "big 3" total (lb): combined best e1RM of squat + bench + deadlift.
  const powerliftingTotal = useMemo(() => {
    if (!workouts.length) return null;
    const prsLbs = computeMainLiftPRs(workouts, "lbs");
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
    const nextIdx = feats.findIndex((f) => !f.unlocked);
    const hiIdx = nextIdx === -1 ? feats.length - 1 : nextIdx;
    const clubs = feats
      .slice(Math.max(0, hiIdx - 2), hiIdx + 1)
      .map((f) => ({ value: f.target, achieved: f.unlocked }));
    const allUnlocked = feats.every((f) => f.unlocked);
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
  }, [workouts]);

  // Usable signal = a weighted 1RM OR a bodyweight rep count (calisthenics has no 1RM).
  const trackedExercises = useMemo(
    () =>
      exerciseStats.filter(
        (ex) => ex.estimated1RM > 0 || (ex.bestReps ?? 0) > 0,
      ),
    [exerciseStats],
  );

  // Per-exercise day-keys that set a new all-time best — drives WorkoutCard PR chips
  // so the whole ascending progression shows, not just the record holder.
  const prDays = useMemo(() => buildPRDays(exerciseStats), [exerciseStats]);

  const grading = useMemo(
    () =>
      bodyweightLbs && gender
        ? { bodyweightLbs, gender, age: userProfile?.age }
        : null,
    [bodyweightLbs, gender, userProfile?.age],
  );

  const exerciseSummary = useMemo(() => {
    const totalSets = trackedExercises.reduce(
      (sum, ex) => sum + ex.history.length,
      0,
    );
    const topLift = trackedExercises.reduce<ExerciseWithMax | null>(
      (best, ex) => (!best || ex.estimated1RM > best.estimated1RM ? ex : best),
      null,
    );
    return { count: trackedExercises.length, totalSets, topLift };
  }, [trackedExercises]);

  const liftsWithData = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    const filtered = query
      ? trackedExercises.filter((ex) => ex.name.toLowerCase().includes(query))
      : trackedExercises;

    const sorted = [...filtered];
    switch (exerciseSort) {
      case "recent":
        sorted.sort(
          (a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0),
        );
        break;
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "improved":
        sorted.sort(
          (a, b) => getImprovement(b.history) - getImprovement(a.history),
        );
        break;
      case "1rm":
      default:
        sorted.sort(
          (a, b) =>
            b.estimated1RM - a.estimated1RM || a.name.localeCompare(b.name),
        );
        break;
    }
    return sorted;
  }, [trackedExercises, exerciseSearch, exerciseSort]);

  return (
    <SafeAreaView
      style={[
        layout.flex1,
        { backgroundColor: currentTheme.colors.background },
      ]}
    >
      <View style={styles.header}>
        <Text
          variant="screenTitle"
          tone="primary"
          weight="bold"
          style={styles.headerTitle}
        >
          History
        </Text>

        <SegmentedTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </View>

      <ScrollView
        style={layout.flex1}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={currentTheme.colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {activeTab === "overview" ? (
          <>
            {/* Keyed on replayKey so a post-workout arrival remounts and sweeps bars up. */}
            {workouts.length > 0 && (
              <View key={`strength-${replayKey}`}>
                <OverallStatsCard stats={overallStats} animateFrom={replayFrom} />
                {powerliftingTotal && (
                  <>
                    <Divider style={styles.strengthDivider} />
                    <PowerliftingTotal data={powerliftingTotal} />
                  </>
                )}
              </View>
            )}

            {/* Keyed to replay the fill on post-workout arrival. */}
            {workouts.length > 0 && userProgress.length > 0 && (
              <View style={styles.section} key={`lifts-${replayKey}`}>
                <YourLifts lifts={userProgress} />
              </View>
            )}

            {workouts.length > 0 && (
              <NavRow
                label="View Monthly Trends"
                icon="stats-chart"
                variant="card"
                onPress={() => setShowMonthlyTrends(true)}
                style={styles.monthlyTrendsButton}
              />
            )}

            {workouts.length === 0 && (
              <EmptyState
                icon="barbell-outline"
                title="No workouts yet"
                subtitle="Start logging to track your progress"
                cta={{
                  label: "Start a workout",
                  icon: "add",
                  onPress: () => router.push("/workout"),
                }}
              />
            )}
          </>
        ) : activeTab === "sessions" ? (
          <>
            {sessionRecaps.length > 0 ? (
              <Card padding={panelPad}>
                <SessionsFeed
                  recaps={sessionRecaps}
                  visibleCount={showAllWorkouts ? sessionRecaps.length : 8}
                  totalCount={sessionRecaps.length}
                  onPressSession={setSelectedWorkout}
                  onToggleShowAll={
                    sessionRecaps.length > 8
                      ? () => setShowAllWorkouts((v) => !v)
                      : undefined
                  }
                  achievementsByWorkout={achievementsByWorkout}
                />
              </Card>
            ) : (
              <EmptyState
                icon="barbell-outline"
                title="No sessions yet"
                subtitle="Your workout log will show here"
                cta={{
                  label: "Start a workout",
                  icon: "add",
                  onPress: () => router.push("/workout"),
                }}
              />
            )}
          </>
        ) : (
          <>
            {trackedExercises.length > 0 ? (
              <>
                <StatStrip
                  style={styles.exerciseSummary}
                  items={[
                    { value: exerciseSummary.count, label: "Exercises" },
                    {
                      value: exerciseSummary.totalSets.toLocaleString(),
                      label: "Sets logged",
                    },
                    ...(exerciseSummary.topLift
                      ? [
                          {
                            value: exerciseSummary.topLift.estimated1RM,
                            label: "Top 1RM",
                            accent: true,
                          },
                        ]
                      : []),
                  ]}
                />

                <View
                  style={[
                    styles.searchBar,
                    {
                      backgroundColor: currentTheme.colors.surface,
                      borderColor: currentTheme.colors.border,
                    },
                  ]}
                >
                  <Ionicons name="search" size={18} color={ink.muted} />
                  <TextInput
                    style={[styles.searchInput, { color: ink.primary }]}
                    placeholder="Search exercises..."
                    placeholderTextColor={ink.faint}
                    value={exerciseSearch}
                    onChangeText={setExerciseSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {exerciseSearch.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setExerciseSearch("")}
                      hitSlop={8}
                    >
                      <Ionicons
                        name="close-circle"
                        size={18}
                        color={ink.muted}
                      />
                    </TouchableOpacity>
                  )}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.sortRow}
                  keyboardShouldPersistTaps="handled"
                >
                  {EXERCISE_SORTS.map(({ key, label }) => (
                    <Chip
                      key={key}
                      label={label}
                      selected={exerciseSort === key}
                      onPress={() => setExerciseSort(key)}
                    />
                  ))}
                </ScrollView>

                {liftsWithData.length > 0 ? (
                  <View style={styles.section}>
                    <Text
                      variant="meta"
                      tone="faint"
                      style={styles.resultCount}
                    >
                      {liftsWithData.length} exercise
                      {liftsWithData.length !== 1 ? "s" : ""}
                    </Text>
                    {liftsWithData.map((exercise) => (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        weightUnit={weightUnit}
                        grading={grading}
                        onPress={setSelectedExercise}
                      />
                    ))}
                  </View>
                ) : (
                  <EmptyState
                    icon="search-outline"
                    title={`No matches for "${exerciseSearch.trim()}"`}
                  />
                )}
              </>
            ) : (
              <EmptyState
                icon="fitness-outline"
                title="No exercises tracked"
                subtitle="Complete workouts to build your exercise history"
                cta={{
                  label: "Start a workout",
                  icon: "add",
                  onPress: () => router.push("/workout"),
                }}
              />
            )}
          </>
        )}
      </ScrollView>

      <WorkoutDetailModal
        workout={selectedWorkout}
        weightUnit={weightUnit}
        prDays={prDays}
        onClose={() => setSelectedWorkout(null)}
        onDelete={async (workout) => {
          await userService.deleteWorkoutAndLifts(workout.id);
          setSelectedWorkout(null);
          await loadHistory();
          await loadExerciseStats();
        }}
      />

      <MonthlyTrendsModal
        visible={showMonthlyTrends}
        onClose={() => setShowMonthlyTrends(false)}
        workoutHistory={workouts}
      />

      <ExerciseHistoryModal
        exercise={selectedExercise}
        weightUnit={weightUnit}
        onClose={() => setSelectedExercise(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: screenGutter,
    paddingTop: space.xs,
  },
  headerTitle: {
    marginBottom: space.sm,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.sm,
    paddingBottom: scrollBottom,
  },
  exerciseSummary: {
    marginTop: space.xs,
    marginBottom: space.md,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
    gap: space.sm,
    marginTop: space.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: typeScale.body,
    padding: 0,
  },
  sortRow: {
    flexDirection: "row",
    gap: space.sm,
    paddingTop: space.md,
    paddingBottom: 2,
  },
  resultCount: {
    marginBottom: space.xs,
  },
  section: {
    marginTop: space.section,
  },
  strengthDivider: {
    marginTop: space.xs,
    marginBottom: space.md,
  },
  monthlyTrendsButton: {
    marginTop: space.md,
    marginBottom: space.sm,
  },
});
