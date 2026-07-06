import Card from '@/components/Card';
import ExerciseCard from '@/components/history/ExerciseCard';
import { computeExerciseTrend } from '@/lib/history/exerciseTrend';
import ExerciseHistoryModal from '@/components/history/ExerciseHistoryModal';
import SessionsFeed from '@/components/history/SessionsFeed';
import LiftProgressWidget from '@/components/history/LiftProgressWidget';
import { buildSessionRecaps } from '@/lib/history/sessionRecap';
import { buildLiftProgressions } from '@/lib/history/liftProgress';
import TopMovers from '@/components/history/TopMovers';
import { buildPRDays } from '@/components/history/prSessions';
import WorkoutDetailModal from '@/components/history/WorkoutDetailModal';
import MonthlyTrendsModal from '@/components/MonthlyTrendsModal';
import { Text, View } from '@/components/Themed';
import MuscleBalanceCard from '@/components/MuscleBalanceCard';
import WeeklyOverview from '@/components/WeeklyOverview';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { buildExerciseStats } from '@/lib/history/exerciseStats';
import {
  calculateStrengthPercentile,
  FEMALE_STANDARDS,
  getPercentileColor,
  getStrengthTier,
  MALE_STANDARDS,
} from '@/lib/data/strengthStandards';
import { storageService } from '@/lib/storage/storage';
import { layout } from '@/lib/ui/styles';
import { type as typeScale } from '@/lib/ui/typography';
import { userService } from '@/lib/services/userService';
import { convertWeight, ExerciseWithMax, GeneratedWorkout, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
} from 'react-native';

type TabType = 'workouts' | 'exercises';
type ExerciseSort = '1rm' | 'recent' | 'name' | 'improved';

const EXERCISE_SORTS: { key: ExerciseSort; label: string }[] = [
  { key: '1rm', label: 'Top 1RM' },
  { key: 'recent', label: 'Recent' },
  { key: 'improved', label: 'Improved' },
  { key: 'name', label: 'A–Z' },
];

// Improvement drives the "Improved" sort. Reuse the single shared trend definition
// (e1RM variant) so the sort agrees with the per-card delta instead of being a third,
// divergent calc. Signed gain: latest day-bucket best e1RM minus the earliest.
function getImprovement(history: ExerciseWithMax['history']): number {
  const trend = computeExerciseTrend(history, 'lbs', 'e1rm');
  return trend.isPositive ? trend.deltaDisplay : -trend.deltaDisplay;
}

export default function HistoryScreen() {
  const { currentTheme } = useTheme();
  const { userProfile } = useUser();
  const router = useRouter();
  const { customExercises } = useCustomExercises();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('workouts');

  // History state
  const [workouts, setWorkouts] = useState<GeneratedWorkout[]>([]);

  // Exercise stats state
  const [exerciseStats, setExerciseStats] = useState<ExerciseWithMax[]>([]);

  // Modal states
  const [selectedWorkout, setSelectedWorkout] = useState<GeneratedWorkout | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<ExerciseWithMax | null>(null);
  const [showMonthlyTrends, setShowMonthlyTrends] = useState(false);
  const [showAllWorkouts, setShowAllWorkouts] = useState(false);

  // Search controls
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseSort, setExerciseSort] = useState<ExerciseSort>('1rm');

  // Get user's weight unit preference
  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';

  // Bodyweight (lbs) powers the aggregate Strength Index percentile in the hero.
  const bodyweightLbs = useMemo(
    () =>
      userProfile?.weight
        ? Math.round(convertWeight(userProfile.weight.value, userProfile.weight.unit, 'lbs'))
        : undefined,
    [userProfile?.weight]
  );

  // Load data
  const loadHistory = useCallback(async () => {
    try {
      const history = await storageService.getWorkoutHistory();
      const sorted = history.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setWorkouts(sorted);
    } catch (error) {
      console.error('Error loading workout history:', error);
    }
  }, []);

  const loadExerciseStats = useCallback(async () => {
    try {
      const workoutHistory = await storageService.getWorkoutHistory();
      // Pure, node-tested ingestion (lib/history/exerciseStats). Keeps bodyweight
      // (weight-0) lifts, scoring them on reps instead of dropping them silently.
      setExerciseStats(buildExerciseStats(workoutHistory, customExercises, weightUnit));
    } catch (error) {
      console.error('Error loading exercise stats:', error);
    }
  }, [weightUnit, customExercises]);

  useEffect(() => {
    loadHistory();
    loadExerciseStats();
  }, [loadHistory, loadExerciseStats]);

  // Refresh data when screen comes into focus (e.g., after completing a workout)
  useFocusEffect(
    useCallback(() => {
      loadHistory();
      loadExerciseStats();
    }, [loadHistory, loadExerciseStats])
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
    [workouts, customExercises, weightUnit, bodyweightLbs, gender, age]
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
        exerciseStats.filter(e => e.estimated1RM > 0 || (e.bestReps ?? 0) > 0).map(e => e.id),
        weightUnit,
        4,
        bodyweightLbs && gender ? { bodyweightLbs, gender, age } : null,
      ),
    [workouts, exerciseStats, weightUnit, bodyweightLbs, gender, age]
  );

  // Exercises with a usable signal: a weighted 1RM, OR a bodyweight rep count
  // (calisthenics lifts have no 1RM but are still real, tracked exercises).
  const trackedExercises = useMemo(() =>
    exerciseStats.filter(ex => ex.estimated1RM > 0 || (ex.bestReps ?? 0) > 0),
    [exerciseStats]
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
    const stdMap = gender === 'female' ? FEMALE_STANDARDS : MALE_STANDARDS;
    const rows = trackedExercises
      .filter(ex => ex.metric === 'weight' && ex.estimated1RM > 0 && !!stdMap[ex.id])
      .map(ex => {
        const oneRmLbs =
          weightUnit === 'kg' ? convertWeight(ex.estimated1RM, 'kg', 'lbs') : ex.estimated1RM;
        const pct =
          bodyweightLbs && gender
            ? Math.round(
                calculateStrengthPercentile(oneRmLbs, bodyweightLbs, gender, ex.id, userProfile?.age)
              )
            : null;
        return { ex, pct };
      });
    rows.sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.ex.estimated1RM - a.ex.estimated1RM);
    return rows.slice(0, 3);
  }, [trackedExercises, bodyweightLbs, gender, userProfile?.age, weightUnit]);

  // All-time roll-up for the Exercises tab overview strip.
  const exerciseSummary = useMemo(() => {
    const totalSets = trackedExercises.reduce((sum, ex) => sum + ex.history.length, 0);
    const topLift = trackedExercises.reduce<ExerciseWithMax | null>(
      (best, ex) => (!best || ex.estimated1RM > best.estimated1RM ? ex : best),
      null
    );
    return { count: trackedExercises.length, totalSets, topLift };
  }, [trackedExercises]);

  // Apply search + sort to the full tracked-exercise list (no arbitrary cap).
  const liftsWithData = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    const filtered = query
      ? trackedExercises.filter(ex => ex.name.toLowerCase().includes(query))
      : trackedExercises;

    const sorted = [...filtered];
    switch (exerciseSort) {
      case 'recent':
        sorted.sort((a, b) => (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0));
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'improved':
        sorted.sort((a, b) => getImprovement(b.history) - getImprovement(a.history));
        break;
      case '1rm':
      default:
        sorted.sort((a, b) => b.estimated1RM - a.estimated1RM || a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [trackedExercises, exerciseSearch, exerciseSort]);

  return (
    <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontWeight: '700' }]}>
          History
        </Text>

        {/* Tabs */}
        <View style={[styles.tabContainer, { backgroundColor: 'transparent' }]}>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'workouts' && styles.activeTab,
                activeTab === 'workouts' && { borderBottomColor: currentTheme.colors.primary }
              ]}
              onPress={() => setActiveTab('workouts')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'workouts' ? currentTheme.colors.text : currentTheme.colors.text + '50' },
                { fontWeight: activeTab === 'workouts' ? '600' : '400' }
              ]}>
                Workouts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                activeTab === 'exercises' && styles.activeTab,
                activeTab === 'exercises' && { borderBottomColor: currentTheme.colors.primary }
              ]}
              onPress={() => setActiveTab('exercises')}
            >
              <Text style={[
                styles.tabText,
                { color: activeTab === 'exercises' ? currentTheme.colors.text : currentTheme.colors.text + '50' },
                { fontWeight: activeTab === 'exercises' ? '600' : '400' }
              ]}>
                Exercises
              </Text>
            </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        style={layout.flex1}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={currentTheme.colors.primary} />}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {activeTab === 'workouts' ? (
          <>
            {/* The top region is ONE instrument panel — the LIFTS board and the
                SESSIONS feed live on a single shared Card (the exact Card grammar
                CareerSection sits on: variant="elevated", padding 18), with a
                hairline divider fusing the sub-blocks instead of two unframed
                sections floating on the page.
                - LiftProgressWidget: a short RANKED board (top rows only, expander
                  for the rest); tier detail on each row's flip side.
                - SessionsFeed: a workout history — volume-per-session bars, then
                  the last 3 sessions as detailed log entries (per-exercise table);
                  the newest PR row is the page's one celebrated accent. */}
            {workouts.length > 0 && (
              <Card variant="elevated" padding={18}>
                <LiftProgressWidget lifts={liftProgress} />
                {liftProgress.length > 0 && sessionRecaps.length > 0 && (
                  <View style={[styles.panelDivider, { backgroundColor: currentTheme.colors.text + '10' }]} />
                )}
                <SessionsFeed
                  recaps={sessionRecaps}
                  weightUnit={weightUnit}
                  visibleCount={showAllWorkouts ? sessionRecaps.length : 3}
                  totalCount={sessionRecaps.length}
                  onPressSession={setSelectedWorkout}
                  onToggleShowAll={sessionRecaps.length > 3 ? () => setShowAllWorkouts(v => !v) : undefined}
                />
              </Card>
            )}

            {/* Records — the "what are my records?" half of Q3, on the hub. Up to three
                headline lifts, each with its actual all-time est-1RM and normalized tier,
                tappable straight into that lift's history. */}
            {workouts.length > 0 && topRecords.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionHeading, { color: currentTheme.colors.text }]}>RECORDS</Text>
                <View style={[styles.recordsStrip, { backgroundColor: 'transparent' }]}>
                  {topRecords.map(({ ex, pct }) => {
                    const tierColor = pct != null ? getPercentileColor(pct) : currentTheme.colors.primary;
                    return (
                      <TouchableOpacity
                        key={ex.id}
                        style={[styles.recordCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                        onPress={() => setSelectedExercise(ex)}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[styles.recordName, { color: currentTheme.colors.text + '99', fontWeight: '500' }]}
                          numberOfLines={1}
                        >
                          {ex.name.replace(/\s*\([^)]*\)\s*$/, '').trim()}
                        </Text>
                        <View style={[styles.recordValueRow, { backgroundColor: 'transparent' }]}>
                          <Text style={[styles.recordValue, { color: currentTheme.colors.text, fontWeight: '700' }]} numberOfLines={1}>
                            {ex.estimated1RM}
                          </Text>
                          <Text style={[styles.recordUnit, { color: currentTheme.colors.text + '70', fontWeight: '400' }]}>
                            {weightUnit}
                          </Text>
                        </View>
                        {pct != null && (
                          <View style={[styles.recordTierBadge, { backgroundColor: tierColor + '1F' }]}>
                            <Text style={[styles.recordTierText, { color: tierColor, fontWeight: '600' }]}>
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

            {/* Your Movers — the per-lift trajectory answer ("how is THIS lift progressing?")
                placed directly under the Strength Index hero, so the hub reads portfolio-value
                (hero) -> your movers (per-lift) -> volume (This Week) -> recent sessions,
                mirroring Robinhood's holdings-under-hero layout. Renders nothing until a lift
                is actually moving, so the summary-first density is preserved. Tapping a row
                opens that lift's history; "See all" jumps to the full Exercises list. */}
            {workouts.length > 0 && (
              <TopMovers
                exercises={trackedExercises}
                weightUnit={weightUnit}
                onSelect={setSelectedExercise}
                onSeeAll={() => setActiveTab('exercises')}
              />
            )}

            {/* This Week — the macro summary (Q4/Q5/Q6), promoted directly under the
                Strength Index hero so the screen reads summary-first instead of burying it
                below the session log. WeeklyOverview owns its own "This Week · <range>"
                header, so no section heading is stacked on top of the card title — the
                block wears exactly one label. */}
            {workouts.length > 0 && (
              <View style={styles.section}>
                <WeeklyOverview workoutHistory={workouts} sessionRecaps={sessionRecaps} />
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
              <TouchableOpacity
                style={[styles.monthlyTrendsButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                onPress={() => setShowMonthlyTrends(true)}
                activeOpacity={0.7}
              >
                <View style={styles.monthlyTrendsContent}>
                  <Ionicons name="stats-chart" size={18} color={currentTheme.colors.primary} />
                  <Text style={[styles.monthlyTrendsText, { color: currentTheme.colors.text, fontWeight: '500' }]}>
                    View Monthly Trends
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={currentTheme.colors.text + '60'} />
              </TouchableOpacity>
            )}

            {/* Empty State */}
            {workouts.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="barbell-outline" size={48} color={currentTheme.colors.text + '20'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontWeight: '500' }]}>
                  No workouts yet
                </Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontWeight: '400' }]}>
                  Start logging to track your progress
                </Text>
                <TouchableOpacity
                  style={[styles.emptyCta, { backgroundColor: currentTheme.colors.primary }]}
                  onPress={() => router.push('/workout')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={[styles.emptyCtaText, { fontWeight: '600' }]}>
                    Start a workout
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <>
            {/* Exercises Tab */}
            {trackedExercises.length > 0 ? (
              <>
                {/* All-time overview */}
                <View style={[styles.exerciseSummary, { backgroundColor: currentTheme.colors.surface }]}>
                  <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.summaryValue, { color: currentTheme.colors.text, fontWeight: '700' }]}>
                      {exerciseSummary.count}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}>
                      Exercises
                    </Text>
                  </View>
                  <View style={[styles.summaryDivider, { backgroundColor: currentTheme.colors.border }]} />
                  <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.summaryValue, { color: currentTheme.colors.text, fontWeight: '700' }]}>
                      {exerciseSummary.totalSets.toLocaleString()}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}>
                      Sets logged
                    </Text>
                  </View>
                  {exerciseSummary.topLift && (
                    <>
                      <View style={[styles.summaryDivider, { backgroundColor: currentTheme.colors.border }]} />
                      <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
                        <Text
                          style={[styles.summaryValue, { color: currentTheme.colors.primary, fontWeight: '700' }]}
                          numberOfLines={1}
                        >
                          {exerciseSummary.topLift.estimated1RM}
                        </Text>
                        <Text
                          style={[styles.summaryLabel, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}
                          numberOfLines={1}
                        >
                          Top 1RM
                        </Text>
                      </View>
                    </>
                  )}
                </View>

                {/* Search */}
                <View style={[styles.searchBar, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                  <Ionicons name="search" size={18} color={currentTheme.colors.text + '60'} />
                  <TextInput
                    style={[styles.searchInput, { color: currentTheme.colors.text, fontWeight: '400' }]}
                    placeholder="Search exercises..."
                    placeholderTextColor={currentTheme.colors.text + '40'}
                    value={exerciseSearch}
                    onChangeText={setExerciseSearch}
                    autoCapitalize="none"
                    autoCorrect={false}
                    returnKeyType="search"
                  />
                  {exerciseSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setExerciseSearch('')} hitSlop={8}>
                      <Ionicons name="close-circle" size={18} color={currentTheme.colors.text + '60'} />
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
                  {EXERCISE_SORTS.map(({ key, label }) => {
                    const active = exerciseSort === key;
                    return (
                      <TouchableOpacity
                        key={key}
                        onPress={() => setExerciseSort(key)}
                        activeOpacity={0.7}
                        style={[
                          styles.sortChip,
                          {
                            backgroundColor: active ? currentTheme.colors.primary : currentTheme.colors.surface,
                            borderColor: active ? currentTheme.colors.primary : currentTheme.colors.border,
                          },
                        ]}
                      >
                        <Text style={[
                          styles.sortChipText,
                          {
                            color: active ? '#fff' : currentTheme.colors.text + '99',
                            fontWeight: active ? '600' : '500',
                          },
                        ]}>
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                {liftsWithData.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={[styles.resultCount, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}>
                      {liftsWithData.length} exercise{liftsWithData.length !== 1 ? 's' : ''}
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
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={40} color={currentTheme.colors.text + '20'} />
                    <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontWeight: '500' }]}>
                      No matches for &quot;{exerciseSearch.trim()}&quot;
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="fitness-outline" size={48} color={currentTheme.colors.text + '20'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontWeight: '500' }]}>
                  No exercises tracked
                </Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontWeight: '400' }]}>
                  Complete workouts to build your exercise history
                </Text>
                <TouchableOpacity
                  style={[styles.emptyCta, { backgroundColor: currentTheme.colors.primary }]}
                  onPress={() => router.push('/workout')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={[styles.emptyCtaText, { fontWeight: '600' }]}>
                    Start a workout
                  </Text>
                </TouchableOpacity>
              </View>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 0,
  },
  headerTitle: {
    fontSize: typeScale.screenTitle,
    marginBottom: 12,
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    gap: 24,
  },
  tab: {
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: typeScale.body,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  // Exercises tab: overview + search + sort
  exerciseSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4,
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  summaryValue: {
    fontSize: typeScale.emphasis,
  },
  summaryLabel: {
    fontSize: typeScale.meta,
    marginTop: 3,
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
    marginTop: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: typeScale.body,
    padding: 0,
  },
  workoutSearchBar: {
    marginBottom: 12,
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 2,
  },
  sortChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 16,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: typeScale.meta,
  },
  resultCount: {
    fontSize: typeScale.meta,
    marginBottom: 4,
  },
  // Hairline sub-block divider inside the top instrument panel — the same
  // divider grammar CareerSection uses between its hero / stats / NEXT blocks.
  panelDivider: {
    height: StyleSheet.hairlineWidth,
    opacity: 0.7,
  },
  // Section styles
  section: {
    marginTop: 24,
  },
  // Same micro-label grammar as LIFTS / SESSIONS / the Career card.
  sectionHeading: {
    fontSize: typeScale.meta,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.45,
    marginBottom: 10,
  },
  viewAllButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: typeScale.meta,
  },
  // Records strip
  recordsStrip: {
    flexDirection: 'row',
    gap: 10,
  },
  recordCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  recordName: {
    fontSize: typeScale.meta,
  },
  recordValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    marginTop: 6,
  },
  recordValue: {
    fontSize: typeScale.title,
    letterSpacing: -0.5,
  },
  recordUnit: {
    fontSize: typeScale.meta,
  },
  recordTierBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  recordTierText: {
    fontSize: typeScale.meta,
    letterSpacing: 0.3,
  },
  // Monthly trends button
  monthlyTrendsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 8,
  },
  monthlyTrendsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthlyTrendsText: {
    fontSize: typeScale.body,
  },
  // Lift card styles - minimal
  liftCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  liftNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  liftName: {
    fontSize: typeScale.body,
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  customBadgeText: {
    fontSize: typeScale.meta,
  },
  liftStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liftValue: {
    fontSize: typeScale.emphasis,
  },
  liftLabel: {
    fontSize: typeScale.meta,
  },
  deltaContainer: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deltaText: {
    fontSize: typeScale.meta,
  },
  liftRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: typeScale.heading,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: typeScale.body,
    marginTop: 8,
    textAlign: 'center',
  },
  emptyCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  emptyCtaText: {
    color: '#fff',
    fontSize: typeScale.title,
  },
});
