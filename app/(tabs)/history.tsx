import { useAlert } from '@/components/CustomAlert';
import ExerciseCard from '@/components/history/ExerciseCard';
import ExerciseHistoryModal from '@/components/history/ExerciseHistoryModal';
import HistoryHero from '@/components/history/HistoryHero';
import MuscleFocusWidget from '@/components/history/MuscleFocusWidget';
import WorkoutCard from '@/components/history/WorkoutCard';
import WorkoutDetailModal from '@/components/history/WorkoutDetailModal';
import MonthlyTrendsModal from '@/components/MonthlyTrendsModal';
import StrengthHistoryCard from '@/components/StrengthHistoryCard';
import { Text, View } from '@/components/Themed';
import WeeklyOverview from '@/components/WeeklyOverview';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { layout } from '@/lib/ui/styles';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { userService } from '@/lib/services/userService';
import { ALL_WORKOUTS } from '@/lib/workout/workouts';
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

// Improvement in user's preferred unit: latest session best 1RM vs earliest.
// Returns the absolute estimated-1RM gain (lbs) across the full history.
function getImprovement(history: ExerciseWithMax['history']): number {
  if (history.length < 2) return 0;
  const sorted = [...history].sort((a, b) => a.date.getTime() - b.date.getTime());
  const oneRM = (e: ExerciseWithMax['history'][number]) => {
    const lbs = e.unit === 'kg' ? convertWeight(e.weight, 'kg', 'lbs') : e.weight;
    return OneRMCalculator.estimate(lbs, e.reps);
  };
  const earliest = oneRM(sorted[0]);
  const latest = Math.max(...sorted.slice(-3).map(oneRM));
  return latest - earliest;
}

export default function HistoryScreen() {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
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
  const [workoutSearch, setWorkoutSearch] = useState('');
  const [exerciseSearch, setExerciseSearch] = useState('');
  const [exerciseSort, setExerciseSort] = useState<ExerciseSort>('1rm');

  // Get user's weight unit preference
  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';

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
      const profile = await userService.getRealUserProfile();
      const workoutHistory = await storageService.getWorkoutHistory();

      // Build a map of exercise IDs to their history and max
      const exerciseDataMap: Record<string, {
        maxWeight: number;
        maxReps: number;
        maxOneRM: number;
        history: { weight: number; reps: number; date: Date; unit: WeightUnit }[];
      }> = {};

      // Helper to add entry
      const addEntry = (id: string, weight: number, reps: number, date: Date, unit: WeightUnit) => {
        if (weight <= 0) return;
        const weightInLbs = unit === 'kg' ? convertWeight(weight, 'kg', 'lbs') : weight;
        const oneRM = OneRMCalculator.estimate(weightInLbs, reps);

        if (!exerciseDataMap[id]) {
          exerciseDataMap[id] = { maxWeight: 0, maxReps: 0, maxOneRM: 0, history: [] };
        }

        exerciseDataMap[id].history.push({ weight, reps, date, unit });

        if (oneRM > exerciseDataMap[id].maxOneRM) {
          exerciseDataMap[id].maxWeight = weightInLbs;
          exerciseDataMap[id].maxReps = reps;
          exerciseDataMap[id].maxOneRM = oneRM;
        }
      };

      // Get from main lifts
      for (const lift of profile?.lifts || []) {
        addEntry(lift.id, lift.weight, lift.reps, new Date(lift.dateRecorded), lift.unit);
      }

      // Get from secondary lifts
      for (const lift of profile?.secondaryLifts || []) {
        addEntry(lift.id, lift.weight, lift.reps, new Date(lift.dateRecorded), lift.unit);
      }

      // Scan workout history
      for (const workout of workoutHistory) {
        for (const exercise of workout.exercises) {
          for (const set of exercise.completedSets || []) {
            // Default to 'lbs' for legacy data without unit field
            addEntry(exercise.id, set.weight, set.reps, new Date(workout.createdAt), set.unit || 'lbs');
          }
        }
      }

      // Build stats list
      const stats: ExerciseWithMax[] = [];

      // Add exercises from database
      for (const workout of ALL_WORKOUTS) {
        const data = exerciseDataMap[workout.id];
        if (data && data.history.length > 0) {
          const displayWeight = weightUnit === 'kg' ? convertWeight(data.maxWeight, 'lbs', 'kg') : data.maxWeight;
          const displayOneRM = weightUnit === 'kg' ? convertWeight(data.maxOneRM, 'lbs', 'kg') : data.maxOneRM;

          // Sort history by date descending
          const sortedHistory = data.history.sort((a, b) => b.date.getTime() - a.date.getTime());

          stats.push({
            id: workout.id,
            name: workout.name,
            maxWeight: Math.round(displayWeight),
            maxReps: data.maxReps,
            estimated1RM: Math.round(displayOneRM),
            isCustom: false,
            lastUsed: sortedHistory[0]?.date,
            history: sortedHistory,
          });
        }
      }

      // Add custom exercises
      for (const custom of customExercises) {
        const data = exerciseDataMap[custom.id];
        const displayWeight = data && weightUnit === 'kg' ? convertWeight(data.maxWeight, 'lbs', 'kg') : (data?.maxWeight || 0);
        const displayOneRM = data && weightUnit === 'kg' ? convertWeight(data.maxOneRM, 'lbs', 'kg') : (data?.maxOneRM || 0);
        const sortedHistory = data?.history.sort((a, b) => b.date.getTime() - a.date.getTime()) || [];

        stats.push({
          id: custom.id,
          name: custom.name,
          maxWeight: data ? Math.round(displayWeight) : 0,
          maxReps: data?.maxReps || 0,
          estimated1RM: data ? Math.round(displayOneRM) : 0,
          isCustom: true,
          lastUsed: sortedHistory[0]?.date || custom.createdAt,
          history: sortedHistory,
        });
      }

      // Sort by estimated 1RM descending
      stats.sort((a, b) => b.estimated1RM - a.estimated1RM || a.name.localeCompare(b.name));

      setExerciseStats(stats);
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

  const handleDeleteWorkout = useCallback((workout: GeneratedWorkout) => {
    showAlert({
      title: 'Delete Workout',
      message: `Delete "${workout.title}"?`,
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await userService.deleteWorkoutAndLifts(workout.id);
            setSelectedWorkout(null);
            await loadHistory();
            await loadExerciseStats();
          },
        },
      ],
    });
  }, [showAlert, loadHistory, loadExerciseStats]);

  // Get the workouts to render: a search query filters the full list by
  // title; otherwise show the 5 most recent (or all when expanded).
  const workoutQuery = workoutSearch.trim().toLowerCase();
  const filteredWorkouts = useMemo(() => {
    if (!workoutQuery) return workouts;
    return workouts.filter(w => (w.title || '').toLowerCase().includes(workoutQuery));
  }, [workouts, workoutQuery]);

  const recentWorkouts = useMemo(() =>
    workoutQuery || showAllWorkouts ? filteredWorkouts : filteredWorkouts.slice(0, 5),
    [filteredWorkouts, showAllWorkouts, workoutQuery]
  );

  // Calculate quick stats
  const quickStats = useMemo(() => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // This week's workouts
    const thisWeekWorkouts = workouts.filter(w => new Date(w.createdAt) >= startOfWeek);

    // This month's workouts
    const thisMonthWorkouts = workouts.filter(w => new Date(w.createdAt) >= startOfMonth);

    // Calculate streak as consecutive WEEKS with at least one workout. A day-based
    // streak is meaningless for lifting, where rest days are mandatory — a normal
    // 3x/week program would never exceed a 1-day streak. Weeks start Sunday, matching
    // startOfWeek above.
    let streak = 0;
    // The Sunday (midnight) that starts the week containing `d`.
    const weekStartOf = (d: Date) => {
      const s = new Date(d);
      s.setHours(0, 0, 0, 0);
      s.setDate(s.getDate() - s.getDay());
      return s;
    };
    const weekKey = (d: Date) => {
      const s = weekStartOf(d);
      return `${s.getFullYear()}-${s.getMonth()}-${s.getDate()}`;
    };

    if (workouts.length > 0) {
      const workoutWeeks = new Set<string>();
      workouts.forEach(w => workoutWeeks.add(weekKey(new Date(w.createdAt))));

      const thisWeek = weekStartOf(now);
      const lastWeek = new Date(thisWeek);
      lastWeek.setDate(lastWeek.getDate() - 7);

      // Start at this week if it has a workout; otherwise last week, since the current
      // week isn't over yet and shouldn't break a streak prematurely.
      let cursor: Date | null = workoutWeeks.has(weekKey(thisWeek))
        ? thisWeek
        : workoutWeeks.has(weekKey(lastWeek))
          ? lastWeek
          : null;

      while (cursor && workoutWeeks.has(weekKey(cursor))) {
        streak++;
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() - 7);
      }
    }

    // Total volume this week (converted to user's preferred unit)
    let weekVolume = 0;
    thisWeekWorkouts.forEach(workout => {
      workout.exercises.forEach(ex => {
        ex.completedSets?.forEach(set => {
          // Default to 'lbs' for legacy data without unit field
          const setUnit = set.unit || 'lbs';
          const weightInPreferredUnit = convertWeight(set.weight, setUnit, weightUnit);
          weekVolume += weightInPreferredUnit * set.reps;
        });
      });
    });

    return {
      streak,
      thisWeek: thisWeekWorkouts.length,
      thisMonth: thisMonthWorkouts.length,
      weekVolume: Math.round(weekVolume),
    };
  }, [workouts, weightUnit]);

  // Exercises that have at least one recorded set with strength data.
  const trackedExercises = useMemo(() =>
    exerciseStats.filter(ex => ex.estimated1RM > 0),
    [exerciseStats]
  );

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
        <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
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
                { fontFamily: activeTab === 'workouts' ? currentTheme.fonts.semiBold : currentTheme.fonts.regular }
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
                { fontFamily: activeTab === 'exercises' ? currentTheme.fonts.semiBold : currentTheme.fonts.regular }
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
            {/* Animated momentum hero */}
            {workouts.length > 0 && (
              <HistoryHero
                exerciseStats={exerciseStats}
                weightUnit={weightUnit}
              />
            )}

            {/* Weekly Overview */}
            <WeeklyOverview workoutHistory={workouts} />

            {/* Quick Stats - Inline */}
            {workouts.length > 0 && (
              <View style={[styles.quickStatsInline, { backgroundColor: 'transparent' }]}>
                {quickStats.streak > 0 ? (
                  <>
                    <Text style={[styles.quickStatInlineText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                      {quickStats.streak} week streak
                    </Text>
                    <Text style={[styles.quickStatDivider, { color: currentTheme.colors.text + '30' }]}>·</Text>
                  </>
                ) : null}
                {quickStats.thisWeek > 0 ? (
                  <>
                    <Text style={[styles.quickStatInlineText, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                      {quickStats.thisWeek} workout{quickStats.thisWeek !== 1 ? 's' : ''} this week
                    </Text>
                    {quickStats.weekVolume > 0 && (
                      <>
                        <Text style={[styles.quickStatDivider, { color: currentTheme.colors.text + '30' }]}>·</Text>
                        <Text style={[styles.quickStatInlineText, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                          {quickStats.weekVolume > 1000 ? `${(quickStats.weekVolume / 1000).toFixed(1)}k` : quickStats.weekVolume} {weightUnit}
                        </Text>
                      </>
                    )}
                  </>
                ) : (
                  <Text style={[styles.quickStatInlineText, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                    {quickStats.thisMonth > 0 ? `${quickStats.thisMonth} workout${quickStats.thisMonth !== 1 ? 's' : ''} this month` : `${workouts.length} total workout${workouts.length !== 1 ? 's' : ''}`}
                  </Text>
                )}
              </View>
            )}

            {/* Muscle Focus Widget */}
            {workouts.length > 0 && (
              <View style={styles.widgetSection}>
                <MuscleFocusWidget />
              </View>
            )}

            {/* Monthly Trends Button */}
            {workouts.length > 0 && (
              <TouchableOpacity
                style={[styles.monthlyTrendsButton, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                onPress={() => setShowMonthlyTrends(true)}
                activeOpacity={0.7}
              >
                <View style={styles.monthlyTrendsContent}>
                  <Ionicons name="stats-chart" size={18} color={currentTheme.colors.primary} />
                  <Text style={[styles.monthlyTrendsText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                    View Monthly Trends
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={currentTheme.colors.text + '60'} />
              </TouchableOpacity>
            )}

            {/* Strength Percentile History */}
            <View style={styles.strengthHistorySection}>
              <StrengthHistoryCard />
            </View>

            {/* Recent Workouts */}
            {workouts.length > 0 && (
              <View style={styles.section}>
                {/* Search (only worth showing once there's a backlog) */}
                {workouts.length >= 5 && (
                  <View style={[styles.searchBar, styles.workoutSearchBar, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
                    <Ionicons name="search" size={18} color={currentTheme.colors.text + '60'} />
                    <TextInput
                      style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}
                      placeholder="Search workouts..."
                      placeholderTextColor={currentTheme.colors.text + '40'}
                      value={workoutSearch}
                      onChangeText={setWorkoutSearch}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    {workoutSearch.length > 0 && (
                      <TouchableOpacity onPress={() => setWorkoutSearch('')} hitSlop={8}>
                        <Ionicons name="close-circle" size={18} color={currentTheme.colors.text + '60'} />
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {workoutQuery.length > 0 && (
                  <Text style={[styles.resultCount, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                    {recentWorkouts.length} result{recentWorkouts.length !== 1 ? 's' : ''}
                  </Text>
                )}

                {recentWorkouts.map((workout) => (
                  <WorkoutCard
                    key={workout.id}
                    workout={workout}
                    exerciseStats={exerciseStats}
                    weightUnit={weightUnit}
                    customExercises={customExercises}
                    onPress={setSelectedWorkout}
                    onLongPress={handleDeleteWorkout}
                  />
                ))}

                {/* No matches for an active search */}
                {workoutQuery.length > 0 && recentWorkouts.length === 0 && (
                  <View style={styles.emptyState}>
                    <Ionicons name="search-outline" size={40} color={currentTheme.colors.text + '20'} />
                    <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.medium }]}>
                      No workouts match &quot;{workoutSearch.trim()}&quot;
                    </Text>
                  </View>
                )}

                {!workoutQuery && workouts.length > 5 && !showAllWorkouts && (
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => setShowAllWorkouts(true)}
                  >
                    <Text style={[styles.viewAllText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
                      View all {workouts.length} workouts
                    </Text>
                  </TouchableOpacity>
                )}
                {!workoutQuery && showAllWorkouts && workouts.length > 5 && (
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => setShowAllWorkouts(false)}
                  >
                    <Text style={[styles.viewAllText, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.medium }]}>
                      Show less
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* Empty State */}
            {workouts.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="barbell-outline" size={48} color={currentTheme.colors.text + '20'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.medium }]}>
                  No workouts yet
                </Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontFamily: currentTheme.fonts.regular }]}>
                  Start logging to track your progress
                </Text>
                <TouchableOpacity
                  style={[styles.emptyCta, { backgroundColor: currentTheme.colors.primary }]}
                  onPress={() => router.push('/workout')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={[styles.emptyCtaText, { fontFamily: currentTheme.fonts.semiBold }]}>
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
                    <Text style={[styles.summaryValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                      {exerciseSummary.count}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                      Exercises
                    </Text>
                  </View>
                  <View style={[styles.summaryDivider, { backgroundColor: currentTheme.colors.border }]} />
                  <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.summaryValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                      {exerciseSummary.totalSets.toLocaleString()}
                    </Text>
                    <Text style={[styles.summaryLabel, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                      Sets logged
                    </Text>
                  </View>
                  {exerciseSummary.topLift && (
                    <>
                      <View style={[styles.summaryDivider, { backgroundColor: currentTheme.colors.border }]} />
                      <View style={[styles.summaryItem, { backgroundColor: 'transparent' }]}>
                        <Text
                          style={[styles.summaryValue, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.bold }]}
                          numberOfLines={1}
                        >
                          {exerciseSummary.topLift.estimated1RM}
                        </Text>
                        <Text
                          style={[styles.summaryLabel, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}
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
                    style={[styles.searchInput, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.regular }]}
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
                            fontFamily: active ? currentTheme.fonts.semiBold : currentTheme.fonts.medium,
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
                    <Text style={[styles.resultCount, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
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
                    <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.medium }]}>
                      No matches for &quot;{exerciseSearch.trim()}&quot;
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="fitness-outline" size={48} color={currentTheme.colors.text + '20'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.medium }]}>
                  No exercises tracked
                </Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontFamily: currentTheme.fonts.regular }]}>
                  Complete workouts to build your exercise history
                </Text>
                <TouchableOpacity
                  style={[styles.emptyCta, { backgroundColor: currentTheme.colors.primary }]}
                  onPress={() => router.push('/workout')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="add" size={18} color="#fff" />
                  <Text style={[styles.emptyCtaText, { fontFamily: currentTheme.fonts.semiBold }]}>
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
        exerciseStats={exerciseStats}
        customExercises={customExercises}
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
    fontSize: 28,
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
    fontSize: 15,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  // Quick stats inline
  quickStatsInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  quickStatInlineText: {
    fontSize: 13,
  },
  quickStatDivider: {
    fontSize: 13,
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
    fontSize: 20,
  },
  summaryLabel: {
    fontSize: 11,
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
    fontSize: 16,
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
  },
  sortChipText: {
    fontSize: 13,
  },
  resultCount: {
    fontSize: 12,
    marginBottom: 4,
  },
  // Section styles
  section: {
    marginTop: 16,
  },
  widgetSection: {
    marginTop: 16,
  },
  strengthHistorySection: {
    marginTop: 8,
  },
  viewAllButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
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
    fontSize: 15,
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
    fontSize: 15,
  },
  customBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  customBadgeText: {
    fontSize: 9,
  },
  liftStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  liftValue: {
    fontSize: 18,
  },
  liftLabel: {
    fontSize: 13,
  },
  deltaContainer: {
    marginLeft: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  deltaText: {
    fontSize: 11,
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
    fontSize: 18,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
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
    fontSize: 15,
  },
});
