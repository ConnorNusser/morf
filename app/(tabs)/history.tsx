import Card from "@/components/Card";
import ExerciseCard from "@/components/history/ExerciseCard";
import ExerciseHistoryModal from "@/components/history/ExerciseHistoryModal";
import LiftProgressWidget from "@/components/history/LiftProgressWidget";
import { buildPRDays } from "@/components/history/prSessions";
import SessionsFeed from "@/components/history/SessionsFeed";
import TopMovers from "@/components/history/TopMovers";
import WorkoutDetailModal from "@/components/history/WorkoutDetailModal";
import MonthlyTrendsModal from "@/components/MonthlyTrendsModal";
import MuscleBalanceCard from "@/components/MuscleBalanceCard";
import { Text, useInk, View } from "@/components/Themed";
import Chip from "@/components/Chip";
import Divider from "@/components/ui/Divider";
import EmptyState from "@/components/ui/EmptyState";
import NavRow from "@/components/ui/NavRow";
import SectionLabel from "@/components/ui/SectionLabel";
import SegmentedTabs from "@/components/ui/SegmentedTabs";
import StatStrip from "@/components/ui/StatStrip";
import WeeklyOverview from "@/components/WeeklyOverview";
import { useCustomExercises } from "@/contexts/CustomExercisesContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import {
  calculateStrengthPercentile,
  FEMALE_STANDARDS,
  getPercentileColor,
  getStrengthTier,
  MALE_STANDARDS,
} from "@/lib/data/strengthStandards";
import { attributeAchievements } from "@/lib/history/achievementAttribution";
import { buildExerciseStats } from "@/lib/history/exerciseStats";
import { computeExerciseTrend } from "@/lib/history/exerciseTrend";
import { buildLiftProgressions } from "@/lib/history/liftProgress";
import { buildSessionRecaps } from "@/lib/history/sessionRecap";
import { userService } from "@/lib/services/userService";
import { storageService } from "@/lib/storage/storage";
import { layout } from "@/lib/ui/styles";
import { radius, screenGutter, space, tint, track } from "@/lib/ui/tokens";
import { type as typeScale } from "@/lib/ui/typography";
import {
  convertWeight,
  ExerciseWithMax,
  GeneratedWorkout,
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

type TabType = "workouts" | "exercises";
type ExerciseSort = "1rm" | "recent" | "name" | "improved";

const TABS: { key: TabType; label: string }[] = [
  { key: "workouts", label: "Workouts" },
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
  const [activeTab, setActiveTab] = useState<TabType>("workouts");

  // History state
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);

  // Exercise stats state
  const [exerciseStats, setExerciseStats] = useState<ExerciseWithMax[]>([]);

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
  }, [loadHistory, loadExerciseStats]);

  // Refresh data when screen comes into focus (e.g., after completing a workout)
  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadExerciseStats();
    }, [loadHistory, loadExerciseStats]),
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadHistory(), loadExerciseStats()]);
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

  // Per-lift progression widget: best set per month for the lifts you've trained,
  // RANKED by tier proximity × recent movement (the widget shows the top few and
  // holds the rest behind an "All N lifts" expander). When the profile can support
  // honest grading (bodyweight + gender), each standard lift also carries its
  // CURRENT strength tier + progress-to-next-tier — the same percentile model Records
  // below and the Career card already use.
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

  // Records strip — the "what ARE my records?" half of Q3, answered on the hub without a
  // tab-hop. The top standard lifts by bodyweight percentile (not raw heaviest, so a
  // huge leg-press doesn't crowd out a strong bench), each shown with its actual all-time
  // est-1RM AND its normalized strength tier. The tier is the honest, comparative signal
  // — it reuses the app's own percentile model, so it can go DOWN if bodyweight outpaces
  // the bar, unlike a vanity total. Falls back to 1RM ordering when bodyweight is unknown.
  const topRecords = useMemo(() => {
    const stdMap = gender === "female" ? FEMALE_STANDARDS : MALE_STANDARDS;
    const rows = trackedExercises
      .filter(
        (ex) =>
          ex.metric === "weight" && ex.estimated1RM > 0 && !!stdMap[ex.id],
      )
      .map((ex) => {
        const oneRmLbs =
          weightUnit === "kg"
            ? convertWeight(ex.estimated1RM, "kg", "lbs")
            : ex.estimated1RM;
        const pct =
          bodyweightLbs && gender
            ? Math.round(
                calculateStrengthPercentile(
                  oneRmLbs,
                  bodyweightLbs,
                  gender,
                  ex.id,
                  userProfile?.age,
                ),
              )
            : null;
        return { ex, pct };
      });
    rows.sort(
      (a, b) =>
        (b.pct ?? -1) - (a.pct ?? -1) || b.ex.estimated1RM - a.ex.estimated1RM,
    );
    return rows.slice(0, 3);
  }, [trackedExercises, bodyweightLbs, gender, userProfile?.age, weightUnit]);

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
        {activeTab === "workouts" ? (
          <>
            {workouts.length > 0 && (
              <Card variant="elevated" padding={18}>
                <LiftProgressWidget lifts={liftProgress} />
                {liftProgress.length > 0 && sessionRecaps.length > 0 && (
                  <Divider />
                )}
                <SessionsFeed
                  recaps={sessionRecaps}
                  weightUnit={weightUnit}
                  visibleCount={showAllWorkouts ? sessionRecaps.length : 3}
                  totalCount={sessionRecaps.length}
                  onPressSession={setSelectedWorkout}
                  onToggleShowAll={
                    sessionRecaps.length > 3
                      ? () => setShowAllWorkouts((v) => !v)
                      : undefined
                  }
                  achievementsByWorkout={achievementsByWorkout}
                />
              </Card>
            )}

            {/* Records — the "what are my records?" half of Q3, on the hub. Up to three
                headline lifts, each with its actual all-time est-1RM and normalized tier,
                tappable straight into that lift's history. */}
            {workouts.length > 0 && topRecords.length > 0 && (
              <View style={styles.section}>
                <SectionLabel>Records</SectionLabel>
                <View style={styles.recordsStrip}>
                  {topRecords.map(({ ex, pct }) => {
                    const tierColor =
                      pct != null
                        ? getPercentileColor(pct)
                        : currentTheme.colors.primary;
                    return (
                      <TouchableOpacity
                        key={ex.id}
                        style={[
                          styles.recordCard,
                          {
                            backgroundColor: currentTheme.colors.surface,
                            borderColor: currentTheme.colors.border,
                          },
                        ]}
                        onPress={() => setSelectedExercise(ex)}
                        activeOpacity={0.7}
                      >
                        <Text
                          variant="meta"
                          tone="secondary"
                          weight="medium"
                          numberOfLines={1}
                        >
                          {ex.name.replace(/\s*\([^)]*\)\s*$/, "").trim()}
                        </Text>
                        <View style={styles.recordValueRow}>
                          <Text
                            variant="title"
                            tone="primary"
                            weight="bold"
                            style={styles.recordValue}
                            numberOfLines={1}
                          >
                            {ex.estimated1RM}
                          </Text>
                          <Text variant="meta" tone="muted">
                            {weightUnit}
                          </Text>
                        </View>
                        {pct != null && (
                          <View
                            style={[
                              styles.recordTierBadge,
                              { backgroundColor: tint(tierColor) },
                            ]}
                          >
                            <Text
                              variant="meta"
                              weight="semiBold"
                              style={[
                                styles.recordTierText,
                                { color: tierColor },
                              ]}
                            >
                              {getStrengthTier(pct)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            {workouts.length > 0 && (
              <TopMovers
                exercises={trackedExercises}
                weightUnit={weightUnit}
                onSelect={setSelectedExercise}
                onSeeAll={() => setActiveTab("exercises")}
              />
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

            {/* Muscle Balance — the cross-group "am I training in balance, or neglecting a
                group?" answer (Q6), lifted OUT of the This Week volume card into its own
                block. Driven by a trailing multi-week average of completed sets per muscle
                (not one in-progress week), so a light Monday can't fire a false "neglect"
                alarm and the verdict reflects a real trend that can still fall when a group
                is dropped. */}
            {workouts.length > 0 && (
              <View style={styles.section}>
                <MuscleBalanceCard workoutHistory={workouts} />
              </View>
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
                    <Text variant="meta" tone="faint" style={styles.resultCount}>
                      {liftsWithData.length} exercise
                      {liftsWithData.length !== 1 ? "s" : ""}
                    </Text>
                    {liftsWithData.map((exercise) => (
                      <ExerciseCard
                        key={exercise.id}
                        exercise={exercise}
                        weightUnit={weightUnit}
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
    paddingTop: space.md,
  },
  headerTitle: {
    marginBottom: space.md,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
    paddingBottom: 120,
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
  // Records strip
  recordsStrip: {
    flexDirection: "row",
    gap: space.md,
  },
  recordCard: {
    flex: 1,
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
  },
  recordValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.xs,
    marginTop: space.sm,
  },
  recordValue: {
    letterSpacing: track.display,
  },
  recordTierBadge: {
    alignSelf: "flex-start",
    marginTop: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  recordTierText: {
    letterSpacing: 0.3,
  },
  // Monthly trends button
  monthlyTrendsButton: {
    marginTop: space.md,
    marginBottom: space.sm,
  },
});
