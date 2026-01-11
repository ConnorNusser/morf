import { useAlert } from '@/components/CustomAlert';
import ExerciseCard from '@/components/history/ExerciseCard';
import MuscleFocusWidget from '@/components/history/MuscleFocusWidget';
import WorkoutCard from '@/components/history/WorkoutCard';
import WorkoutDetailModal from '@/components/history/WorkoutDetailModal';
import MonthlyTrendsModal from '@/components/MonthlyTrendsModal';
import { Text, View } from '@/components/Themed';
import { TutorialTarget } from '@/components/tutorial';
import WeeklyOverview from '@/components/WeeklyOverview';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { storageService } from '@/lib/storage/storage';
import { layout } from '@/lib/ui/styles';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { formatSet } from '@/lib/utils/utils';
import { userService } from '@/lib/services/userService';
import { ALL_WORKOUTS } from '@/lib/workout/workouts';
import { convertWeight, ExerciseWithMax, GeneratedWorkout, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

type TabType = 'workouts' | 'exercises';

export default function HistoryScreen() {
  const { currentTheme } = useTheme();
  const { showAlert } = useAlert();
  const { userProfile } = useUser();
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

  const handleDeleteWorkout = (workout: GeneratedWorkout) => {
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
  };

  // Get recent workouts (last 5)
  const recentWorkouts = useMemo(() =>
    showAllWorkouts ? workouts : workouts.slice(0, 5),
    [workouts, showAllWorkouts]
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

    // Calculate streak
    let streak = 0;
    const sortedWorkouts = [...workouts].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    if (sortedWorkouts.length > 0) {
      const workoutDates = new Set<string>();
      sortedWorkouts.forEach(w => {
        const date = new Date(w.createdAt);
        workoutDates.add(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`);
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Check if worked out today or yesterday
      const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

      if (workoutDates.has(todayKey) || workoutDates.has(yesterdayKey)) {
        // Count consecutive days going back
        let checkDate = workoutDates.has(todayKey) ? today : yesterday;
        while (true) {
          const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
          if (workoutDates.has(key)) {
            streak++;
            checkDate = new Date(checkDate);
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
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

  // Filter exercises with data for the Your Lifts section
  const liftsWithData = useMemo(() =>
    exerciseStats.filter(ex => ex.estimated1RM > 0).slice(0, 10),
    [exerciseStats]
  );

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
            {/* Weekly Overview */}
            <TutorialTarget id="history-content">
              <WeeklyOverview workoutHistory={workouts} />
            </TutorialTarget>

            {/* Quick Stats - Inline */}
            {workouts.length > 0 && (
              <View style={[styles.quickStatsInline, { backgroundColor: 'transparent' }]}>
                {quickStats.streak > 0 ? (
                  <>
                    <Text style={[styles.quickStatInlineText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                      {quickStats.streak} day streak
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

            {/* Recent Workouts */}
            {recentWorkouts.length > 0 && (
              <View style={styles.section}>
                {recentWorkouts.map((workout) => (
                  <WorkoutCard
                    key={workout.id}
                    workout={workout}
                    exerciseStats={exerciseStats}
                    weightUnit={weightUnit}
                    customExercises={customExercises}
                    onPress={() => setSelectedWorkout(workout)}
                    onLongPress={() => handleDeleteWorkout(workout)}
                  />
                ))}

                {workouts.length > 5 && !showAllWorkouts && (
                  <TouchableOpacity
                    style={styles.viewAllButton}
                    onPress={() => setShowAllWorkouts(true)}
                  >
                    <Text style={[styles.viewAllText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
                      View all {workouts.length} workouts
                    </Text>
                  </TouchableOpacity>
                )}
                {showAllWorkouts && workouts.length > 5 && (
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
              </View>
            )}
          </>
        ) : activeTab === 'exercises' ? (
          <>
            {/* Exercises Tab */}
            {liftsWithData.length > 0 ? (
              <View style={styles.section}>
                {liftsWithData.map((exercise) => (
                  <ExerciseCard
                    key={exercise.id}
                    exercise={exercise}
                    weightUnit={weightUnit}
                    onPress={() => setSelectedExercise(exercise)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="fitness-outline" size={48} color={currentTheme.colors.text + '20'} />
                <Text style={[styles.emptyText, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.medium }]}>
                  No exercises tracked
                </Text>
                <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '30', fontFamily: currentTheme.fonts.regular }]}>
                  Complete workouts to build your exercise history
                </Text>
              </View>
            )}
          </>
        ) : null}
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
      <Modal visible={!!selectedExercise} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={() => setSelectedExercise(null)}>
              <Ionicons name="close" size={28} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              Exercise History
            </Text>
            <View style={{ width: 28 }} />
          </View>
          {selectedExercise && (
            <ScrollView style={styles.modalContent}>
              <Text style={[styles.modalWorkoutTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                {selectedExercise.name}
              </Text>

              {selectedExercise.estimated1RM > 0 && (
                <View style={[styles.exerciseStatsBanner, { backgroundColor: currentTheme.colors.surface }]}>
                  <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statValue, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.bold }]}>
                      {selectedExercise.estimated1RM}
                    </Text>
                    <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                      Est. 1RM
                    </Text>
                  </View>
                  <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                      {selectedExercise.maxWeight}
                    </Text>
                    <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                      Best Weight
                    </Text>
                  </View>
                  <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                    <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.bold }]}>
                      {selectedExercise.history.length}
                    </Text>
                    <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
                      Total Sets
                    </Text>
                  </View>
                </View>
              )}

              <Text style={[styles.historyHeader, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.semiBold }]}>
                SET HISTORY
              </Text>

              {selectedExercise.history.length === 0 ? (
                <Text style={[styles.noHistoryText, { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.regular }]}>
                  No history recorded yet
                </Text>
              ) : (
                selectedExercise.history.map((entry, idx) => {
                  // Default to 'lbs' for legacy data without unit field
                  const entryUnit = entry.unit || 'lbs';
                  // Convert to user's preferred unit for display
                  const displayWeight = Math.round(convertWeight(entry.weight, entryUnit, weightUnit));
                  // Calculate 1RM in lbs first, then convert for display
                  const weightInLbs = convertWeight(entry.weight, entryUnit, 'lbs');
                  const oneRMInLbs = OneRMCalculator.estimate(weightInLbs, entry.reps);
                  const displayOneRM = weightUnit === 'kg' ? Math.round(convertWeight(oneRMInLbs, 'lbs', 'kg')) : Math.round(oneRMInLbs);

                  return (
                    <View key={idx} style={[styles.historyRow, { borderBottomColor: currentTheme.colors.border }]}>
                      <Text style={[styles.historyDate, { color: currentTheme.colors.text + '60', fontFamily: currentTheme.fonts.regular }]}>
                        {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                      <Text style={[styles.historyValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                        {formatSet({ weight: displayWeight, reps: entry.reps, unit: weightUnit }, { showUnit: true })}
                      </Text>
                      <Text style={[styles.historyOneRM, { color: currentTheme.colors.text + '40', fontFamily: currentTheme.fonts.regular }]}>
                        ~{displayOneRM} 1RM
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
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
  // Section styles
  section: {
    marginTop: 16,
  },
  widgetSection: {
    marginTop: 16,
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
  // Exercise history modal
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  modalWorkoutTitle: {
    fontSize: 24,
    marginBottom: 16,
  },
  exerciseStatsBanner: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
  },
  statLabel: {
    fontSize: 11,
    marginTop: 4,
  },
  historyHeader: {
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 12,
  },
  noHistoryText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  historyDate: {
    width: 60,
    fontSize: 13,
  },
  historyValue: {
    flex: 1,
    fontSize: 15,
  },
  historyOneRM: {
    fontSize: 13,
  },
});
