import Card from "@/components/Card";
import Chip from "@/components/Chip";
import ExerciseCard from "@/components/history/ExerciseCard";
import ExerciseHistoryModal from "@/components/history/ExerciseHistoryModal";
import LiftProgressWidget from "@/components/history/LiftProgressWidget";
import { buildPRDays } from "@/components/history/prSessions";
import SessionsFeed from "@/components/history/SessionsFeed";
import TopMovers from "@/components/history/TopMovers";
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
import WeeklyOverview from "@/components/WeeklyOverview";
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
import { buildLiftProgressions } from "@/lib/history/liftProgress";
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
import { useFocusEffect, useRouter } from "expo-router";
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

// Improvement drives the "Improved" sort. Reuse the single shared trend definition
// (e1RM variant) so the sort agrees with the per-card delta instead of being a third,
// divergent calc. Signed gain: latest day-bucket best e1RM minus the earliest.
function getImprovement(history: ExerciseWithMax["history"]): number {
  const trend = computeExerciseTrend(history, "lbs", "e1rm");
  return trend.isPositive ? trend.deltaDisplay : -trend.deltaDisplay;
}

export default function HistoryScreen() {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { userProfile } = useUser();
  const router = useRouter();
  const { customExercises } = useCustomExercises();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  // History state
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);

  // Exercise stats state
  const [exerciseStats, setExerciseStats] = useState<ExerciseWithMax[]>([]);

  // Featured lifts → the strength summary's overall percentile.
  const [userProgress, setUserProgress] = useState<UserProgress[]>([]);

  // Modal states
  const [selectedWorkout, setSelectedWorkout] =
    useState<GeneratedWorkout | null>(null);
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseWithMax | null>(null);
  const [showMonthlyTrends, setShowMonthlyTrends] = useState(false);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);

  // Search controls
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseSort, setExerciseSort] = useState<ExerciseSort>("1rm");

  // Get user's weight unit preference
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

  // Load data
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
      // Pure, node-tested ingestion (lib/history/exerciseStats). Keeps bodyweight
      // (weight-0) lifts, scoring them on reps instead of dropping them silently.
      setExerciseStats(
        buildExerciseStats(workoutHistory, customExercises, weightUnit),
      );
    } catch (error) {
      console.error("Error loading exercise stats:", error);
    }
  }, [weightUnit, customExercises]);

  // Featured lifts power the strength summary's overall percentile.
  const loadStrength = useCallback(async () => {
    try {
      setUserProgress(await userService.getAllFeaturedLifts());
    } catch (error) {
      console.error("Error loading strength stats:", error);
    }
  }, []);

  // Pin achievements on the session that earned them — replayed from history
  // itself (see lib/history/achievementAttribution), so it's deterministic and
  // works retroactively with no unlock timestamps.
  const achievementsByWorkout = useMemo(
    () => attributeAchievements(workouts, weightUnit),
    [workouts, weightUnit],
  );

  useEffect(() => {
    loadHistory();
    loadExerciseStats();
    loadStrength();
  }, [loadHistory, loadExerciseStats, loadStrength]);

  // Refresh data when screen comes into focus (e.g., after completing a workout)
  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadExerciseStats();
      loadStrength();
    }, [loadHistory, loadExerciseStats, loadStrength]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHistory(), loadExerciseStats(), loadStrength()]);
    setRefreshing(false);
  };

  // The reflective session feed: each workout enriched with its standout set, the
  // day's record, a narrative headline, muscles worked, and how its volume stacks up
  // against the last session of the same kind. Newest first. When the profile can
  // support honest grading (bodyweight + gender), the standout set also carries its
  // strength tier + gap-to-next-tier — the same gradeE1rm path the lift board uses.
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

  // Per-lift monthly progression — best set per month per lift, ranked, for the
  // "arrows" timeline below This Week. Graded lifts flip to their tier stake.
  const liftProgress = useMemo(
    () =>
      buildLiftProgressions(
        workouts,
        exerciseStats
          .filter((e) => e.estimated1RM > 0 || (e.bestReps ?? 0) > 0)
          .map((e) => e.id),
        weightUnit,
        6,
        bodyweightLbs && gender ? { bodyweightLbs, gender, age } : null,
      ),
    [workouts, exerciseStats, weightUnit, bodyweightLbs, gender, age],
  );

  // Strength summary — the aggregate percentile/tier the featured lifts roll up to.
  const overallStats = useMemo(() => {
    const pcts = userProgress.map((p) => p.percentileRanking);
    const pct = pcts.length ? calculateOverallPercentile(pcts) : 0;
    return {
      overallPercentile: pct,
      strengthLevel: pct > 0 ? getStrengthLevelName(pct) : "E-",
      improvementTrend: "improving" as const,
    };
  }, [userProgress]);

  // Powerlifting "big 3" total — combined best e1RM of squat + bench + deadlift,
  // in lb. Reuses the same PR + feat math the Career screen does; no new tracking.
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

  // Exercises with a usable signal: a weighted 1RM, OR a bodyweight rep count
  // (calisthenics lifts have no 1RM but are still real, tracked exercises).
  const trackedExercises = useMemo(
    () =>
      exerciseStats.filter(
        (ex) => ex.estimated1RM > 0 || (ex.bestReps ?? 0) > 0,
      ),
    [exerciseStats],
  );

  // Per-exercise set of day-keys that set a new all-time best. Drives the WorkoutCard
  // PR chips so the whole ascending progression is surfaced, not just the record holder.
  const prDays = useMemo(() => buildPRDays(exerciseStats), [exerciseStats]);

  // Grading profile for the Exercises tab's per-lift tier/percentile — the same
  // bodyweight + gender inputs the Career card and lift board use.
  const grading = useMemo(
    () =>
      bodyweightLbs && gender
        ? { bodyweightLbs, gender, age: userProfile?.age }
        : null,
    [bodyweightLbs, gender, userProfile?.age],
  );

  // All-time roll-up for the Exercises tab overview strip.
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

  // Apply search + sort to the full tracked-exercise list (no arbitrary cap).
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
      {/* Header */}
      <View style={styles.header}>
        <Text
          variant="screenTitle"
          tone="primary"
          weight="bold"
          style={styles.headerTitle}
        >
          History
        </Text>

        {/* Tabs */}
        <SegmentedTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </View>

      {/* Content */}
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
            {/* Strength summary — overall percentile/tier + Big-3 total, at the top. */}
            {workouts.length > 0 && (
              <View>
                <OverallStatsCard stats={overallStats} />
                {powerliftingTotal && (
                  <>
                    <Divider style={styles.strengthDivider} />
                    <PowerliftingTotal data={powerliftingTotal} />
                  </>
                )}
              </View>
            )}

            {/* Top Movers — the lifts trending up, as a quick highlight; tap through
                to the Exercises tab for the full graded list. */}
            {workouts.length > 0 && (
              <View style={styles.section}>
                <TopMovers
                  exercises={trackedExercises}
                  weightUnit={weightUnit}
                  onSelect={setSelectedExercise}
                  onSeeAll={() => setActiveTab("exercises")}
                />
              </View>
            )}

            {/* This Week — the macro summary (Q4/Q5/Q6), promoted directly under the
                Strength Index hero so the screen reads summary-first instead of burying it
                below the session log. WeeklyOverview owns its own "This Week · <range>"
                header, so no section heading is stacked on top of the card title — the
                block wears exactly one label. */}
            {workouts.length > 0 && (
              <View style={styles.section}>
                <WeeklyOverview
                  workoutHistory={workouts}
                  sessionRecaps={sessionRecaps}
                />
              </View>
            )}

            {/* Lift progression — best set per month per lift with arrows between,
                so you can read "120 → 140 → 155" at a glance; graded rows flip to
                the tier stake. */}
            {workouts.length > 0 && liftProgress.length > 0 && (
              <Card padding={panelPad} style={styles.section}>
                <LiftProgressWidget lifts={liftProgress} />
              </Card>
            )}

            {/* Secondary drill-downs — deeper analysis, below the primary content. */}
            {workouts.length > 0 && (
              <NavRow
                label="View Monthly Trends"
                icon="stats-chart"
                variant="card"
                onPress={() => setShowMonthlyTrends(true)}
                style={styles.monthlyTrendsButton}
              />
            )}

            {/* Empty State */}
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
            {/* Sessions Tab — the workout log, its own tab now. */}
            {sessionRecaps.length > 0 ? (
              <Card padding={panelPad}>
                <SessionsFeed
                  recaps={sessionRecaps}
                  weightUnit={weightUnit}
                  visibleCount={showAllWorkouts ? sessionRecaps.length : 5}
                  totalCount={sessionRecaps.length}
                  onPressSession={setSelectedWorkout}
                  onToggleShowAll={
                    sessionRecaps.length > 5
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
            {/* Exercises Tab */}
            {trackedExercises.length > 0 ? (
              <>
                {/* All-time overview */}
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

                {/* Search */}
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

                {/* Sort chips */}
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

      {/* Workout Detail Modal */}
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

      {/* Monthly Trends Modal */}
      <MonthlyTrendsModal
        visible={showMonthlyTrends}
        onClose={() => setShowMonthlyTrends(false)}
        workoutHistory={workouts}
      />

      {/* Exercise History Modal */}
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
  // Exercises tab: overview + search + sort
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
  // Section styles
  section: {
    marginTop: space.section,
  },
  // Strength summary: hairline between overall-tier and the Big-3 total.
  strengthDivider: {
    marginTop: space.xs,
    marginBottom: space.md,
  },
  // Monthly trends button
  monthlyTrendsButton: {
    marginTop: space.md,
    marginBottom: space.sm,
  },
});
