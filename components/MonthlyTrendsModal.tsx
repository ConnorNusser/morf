import { Text, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/utils/haptic';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { formatCompact, formatMinutes as formatTime, calculateWorkoutStats, combineWorkoutStats, formatDistance, formatDuration, WorkoutStats } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/workouts';
import { GeneratedWorkout, MuscleGroup, TrackingType, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_WIDTH = (SCREEN_WIDTH - 80) / 6;

// Push/Pull/Legs category definitions
type PPLCategory = 'push' | 'pull' | 'legs';

const MUSCLE_TO_PPL: Record<MuscleGroup, PPLCategory> = {
  chest: 'push',
  shoulders: 'push',
  back: 'pull',
  arms: 'pull', // biceps are pull-dominant
  legs: 'legs',
  glutes: 'legs',
  core: 'push', // categorize with push for simplicity
  'full-body': 'push', // default
};

const PPL_COLORS: Record<PPLCategory, string> = {
  push: '#FF6B6B', // coral red
  pull: '#4ECDC4', // teal
  legs: '#9B59B6', // purple
};

const PPL_LABELS: Record<PPLCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
};

interface MonthlyTrendsModalProps {
  visible: boolean;
  onClose: () => void;
  workoutHistory: GeneratedWorkout[];
}

interface MonthData {
  month: string;
  shortMonth: string;
  year: number;
  workoutCount: number;
  totalVolume: number;
  totalTime: number;
  pplCounts: Record<PPLCategory, number>;
  totalExercises: number;
  // Cardio stats
  hasCardio: boolean;
  totalDistanceMeters: number;
  totalCardioDurationSeconds: number;
}

export default function MonthlyTrendsModal({
  visible,
  onClose,
  workoutHistory,
}: MonthlyTrendsModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { customExercises } = useCustomExercises();
  const { userProfile } = useUser();
  const { play: playTap } = useSound('tapVariant1');

  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';
  const [pageOffset, setPageOffset] = useState(0);

  // Helper to get tracking type for an exercise
  const getTrackingType = (exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getExercise(exerciseId);
    return exerciseInfo?.trackingType;
  };

  // Calculate data for all available months (up to 24 months back)
  const allMonthlyData = useMemo(() => {
    const data: MonthData[] = [];
    const now = new Date();

    for (let i = 23; i >= 0; i--) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const endOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const monthWorkouts = workoutHistory.filter(workout => {
        const workoutDate = new Date(workout.createdAt);
        return workoutDate >= startOfMonth && workoutDate <= endOfMonth;
      });

      const pplCounts: Record<PPLCategory, number> = {
        push: 0, pull: 0, legs: 0
      };

      let totalTime = 0;
      let totalExercises = 0;

      monthWorkouts.forEach(workout => {
        totalTime += workout.estimatedDuration;

        workout.exercises.forEach(exercise => {
          totalExercises++;
          const exerciseInfo = getExercise(exercise.id);
          if (exerciseInfo && exerciseInfo.primaryMuscles.length > 0) {
            // Count exercise once based on its first primary muscle's PPL category
            const primaryMuscle = exerciseInfo.primaryMuscles[0];
            const pplCategory = MUSCLE_TO_PPL[primaryMuscle];
            if (pplCategory) {
              pplCounts[pplCategory]++;
            }
          }
        });
      });

      // Calculate combined stats using the utility for cardio support
      const workoutStatsList: WorkoutStats[] = monthWorkouts.map(workout =>
        calculateWorkoutStats(workout.exercises, getTrackingType)
      );
      const combinedStats = combineWorkoutStats(workoutStatsList);

      data.push({
        month: targetDate.toLocaleDateString('en-US', { month: 'long' }),
        shortMonth: targetDate.toLocaleDateString('en-US', { month: 'short' }),
        year: targetDate.getFullYear(),
        workoutCount: monthWorkouts.length,
        totalVolume: combinedStats.totalVolumeLbs,
        totalTime,
        pplCounts,
        totalExercises,
        hasCardio: combinedStats.hasCardioExercises,
        totalDistanceMeters: combinedStats.totalDistanceMeters,
        totalCardioDurationSeconds: combinedStats.totalCardioDurationSeconds,
      });
    }

    return data;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getTrackingType is stable
  }, [workoutHistory, customExercises]);

  // Get the current 6 months based on page offset
  const currentMonthlyData = useMemo(() => {
    const startIndex = allMonthlyData.length - 6 - (pageOffset * 6);
    const endIndex = allMonthlyData.length - (pageOffset * 6);
    return allMonthlyData.slice(Math.max(0, startIndex), endIndex);
  }, [allMonthlyData, pageOffset]);

  const canGoBack = (pageOffset + 1) * 6 < allMonthlyData.length;
  const canGoForward = pageOffset > 0;

  const dateRangeLabel = useMemo(() => {
    if (currentMonthlyData.length === 0) return '';
    const first = currentMonthlyData[0];
    const last = currentMonthlyData[currentMonthlyData.length - 1];
    if (first.year === last.year) {
      return `${first.shortMonth} - ${last.shortMonth} ${last.year}`;
    }
    return `${first.shortMonth} ${first.year} - ${last.shortMonth} ${last.year}`;
  }, [currentMonthlyData]);

  const maxPPLTotal = Math.max(...currentMonthlyData.map(m =>
    m.pplCounts.push + m.pplCounts.pull + m.pplCounts.legs
  ), 1);

  const formatVolume = (volume: number) => formatCompact(volume, { millions: true });


  const handleClose = () => {
    playTap();
    playHapticFeedback('light', false);
    onClose();
  };

  const handlePageChange = (direction: 'back' | 'forward') => {
    playTap();
    playHapticFeedback('light', false);
    if (direction === 'back' && canGoBack) {
      setPageOffset(prev => prev + 1);
    } else if (direction === 'forward' && canGoForward) {
      setPageOffset(prev => prev - 1);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text variant="title" tone="primary" weight="semiBold">
            Monthly Trends
          </Text>
          <View style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Pagination */}
          <Animated.View entering={FadeIn.delay(100)} style={styles.paginationHeader}>
            <TouchableOpacity
              onPress={() => handlePageChange('back')}
              disabled={!canGoBack}
              style={styles.pageButton}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={canGoBack ? ink.primary : ink.ghost}
              />
            </TouchableOpacity>

            <Text variant="title" tone="primary" weight="semiBold">
              {dateRangeLabel}
            </Text>

            <TouchableOpacity
              onPress={() => handlePageChange('forward')}
              disabled={!canGoForward}
              style={styles.pageButton}
            >
              <Ionicons
                name="chevron-forward"
                size={24}
                color={canGoForward ? ink.primary : ink.ghost}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* PPL Stacked Chart */}
          <Animated.View entering={FadeInDown.delay(150)} style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <SectionLabel style={styles.sectionTitle}>Training Focus</SectionLabel>
              {/* Legend */}
              <View style={styles.legend}>
                {(['push', 'pull', 'legs'] as PPLCategory[]).map(category => (
                  <View key={category} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: PPL_COLORS[category] }]} />
                    <Text variant="meta" tone="secondary" weight="medium">
                      {PPL_LABELS[category]}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.barChart}>
              {currentMonthlyData.map((month, index) => {
                const total = month.pplCounts.push + month.pplCounts.pull + month.pplCounts.legs;
                const maxHeight = 80;
                const isCurrentMonth = pageOffset === 0 && index === currentMonthlyData.length - 1;

                // Calculate stacked heights
                const pushHeight = (month.pplCounts.push / maxPPLTotal) * maxHeight;
                const pullHeight = (month.pplCounts.pull / maxPPLTotal) * maxHeight;
                const legsHeight = (month.pplCounts.legs / maxPPLTotal) * maxHeight;

                return (
                  <View key={index} style={styles.barColumn}>
                    <Text variant="meta" tone="secondary" weight="semiBold" style={styles.barValue}>
                      {total || '-'}
                    </Text>
                    <View style={styles.barWrapper}>
                      {/* Stacked bars - legs at bottom, pull middle, push top */}
                      <View style={styles.stackedBar}>
                        {legsHeight > 0 && (
                          <View style={[styles.barSegment, { height: legsHeight, backgroundColor: PPL_COLORS.legs, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 }]} />
                        )}
                        {pullHeight > 0 && (
                          <View style={[styles.barSegment, { height: pullHeight, backgroundColor: PPL_COLORS.pull }]} />
                        )}
                        {pushHeight > 0 && (
                          <View style={[styles.barSegment, { height: pushHeight, backgroundColor: PPL_COLORS.push, borderTopLeftRadius: 4, borderTopRightRadius: 4 }]} />
                        )}
                        {total === 0 && (
                          <View style={[styles.barSegment, { height: 2, backgroundColor: currentTheme.colors.border, borderRadius: 4 }]} />
                        )}
                      </View>
                    </View>
                    <Text
                      variant="meta"
                      tone={isCurrentMonth ? undefined : 'muted'}
                      weight={isCurrentMonth ? 'semiBold' : 'medium'}
                      style={styles.barLabel}
                    >
                      {month.shortMonth}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* Monthly Cards */}
          <Animated.View entering={FadeInDown.delay(250)} style={styles.cardsSection}>
            <SectionLabel style={styles.sectionTitle}>Details</SectionLabel>

            {currentMonthlyData.slice().reverse().map((month, index) => {
              const pplTotal = month.pplCounts.push + month.pplCounts.pull + month.pplCounts.legs;

              return (
                <View
                  key={index}
                  style={[styles.monthCard, { backgroundColor: currentTheme.colors.surface }]}
                >
                  {/* Month Header */}
                  <View style={styles.monthHeader}>
                    <View>
                      <Text variant="title" tone="primary" weight="semiBold">
                        {month.month}
                      </Text>
                      <Text variant="meta" tone="muted" style={styles.monthYear}>
                        {month.year}
                      </Text>
                    </View>
                    <View style={[styles.workoutsBadge, { backgroundColor: tint(currentTheme.colors.primary) }]}>
                      <Text variant="title" weight="bold">
                        {month.workoutCount}
                      </Text>
                      <Text variant="meta" weight="medium" style={styles.workoutsLabel}>
                        workouts
                      </Text>
                    </View>
                  </View>

                  {/* Stats Row */}
                  {month.workoutCount > 0 && (
                    <View style={[styles.statsRow, { borderTopColor: currentTheme.colors.border }]}>
                      <View style={styles.statItem}>
                        <Ionicons name="fitness-outline" size={16} color={ink.muted} />
                        <Text variant="meta" tone="primary" weight="medium">
                          {month.totalExercises} exercises
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="barbell-outline" size={16} color={ink.muted} />
                        <Text variant="meta" tone="primary" weight="medium">
                          {formatVolume(month.totalVolume)} {weightUnit}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="time-outline" size={16} color={ink.muted} />
                        <Text variant="meta" tone="primary" weight="medium">
                          {formatTime(month.totalTime)}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Cardio Stats Row */}
                  {month.hasCardio && (month.totalDistanceMeters > 0 || month.totalCardioDurationSeconds > 0) && (
                    <View style={[styles.statsRow, { borderTopColor: currentTheme.colors.border, marginTop: 0, paddingTop: space.md }]}>
                      {month.totalDistanceMeters > 0 && (
                        <View style={styles.statItem}>
                          <Ionicons name="navigate-outline" size={16} color={ink.muted} />
                          <Text variant="meta" tone="primary" weight="medium">
                            {formatDistance(month.totalDistanceMeters)}
                          </Text>
                        </View>
                      )}
                      {month.totalCardioDurationSeconds > 0 && (
                        <View style={styles.statItem}>
                          <Ionicons name="heart-outline" size={16} color={ink.muted} />
                          <Text variant="meta" tone="primary" weight="medium">
                            {formatDuration(month.totalCardioDurationSeconds)} cardio
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* PPL Focus */}
                  {pplTotal > 0 && (
                    <View style={styles.pplSection}>
                      <View style={styles.pplChips}>
                        {(['push', 'pull', 'legs'] as PPLCategory[]).map(category => (
                          month.pplCounts[category] > 0 && (
                            <View
                              key={category}
                              style={[styles.pplChip, { backgroundColor: tint(PPL_COLORS[category]) }]}
                            >
                              <View style={[styles.pplDot, { backgroundColor: PPL_COLORS[category] }]} />
                              <Text variant="meta" tone="primary" weight="medium">
                                {PPL_LABELS[category]}
                              </Text>
                              <Text variant="meta" weight="bold" style={{ color: PPL_COLORS[category] }}>
                                {month.pplCounts[category]}
                              </Text>
                            </View>
                          )
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Empty State */}
                  {month.workoutCount === 0 && (
                    <View style={styles.emptyMonth}>
                      <Text variant="meta" tone="faint" style={styles.emptyText}>
                        No workouts recorded
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: screenGutter,
    paddingTop: space.xl,
    paddingBottom: 40,
  },
  paginationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.section,
  },
  pageButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartSection: {
    marginBottom: 32,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.lg,
  },
  // Spacing after the label comes from chartHeader/cardsSection, not the label itself.
  sectionTitle: {
    marginBottom: 0,
  },
  legend: {
    flexDirection: 'row',
    gap: space.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
  },
  barColumn: {
    alignItems: 'center',
    width: BAR_WIDTH,
  },
  barValue: {
    marginBottom: space.sm,
  },
  barWrapper: {
    height: 80,
    justifyContent: 'flex-end',
    width: '100%',
    alignItems: 'center',
  },
  stackedBar: {
    width: 20,
    flexDirection: 'column-reverse',
  },
  barSegment: {
    width: '100%',
  },
  barLabel: {
    marginTop: space.sm,
  },
  cardsSection: {
    gap: space.md,
  },
  monthCard: {
    borderRadius: radius.card,
    padding: space.lg,
    marginBottom: space.md,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  monthYear: {
    marginTop: 2,
  },
  workoutsBadge: {
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.card,
  },
  workoutsLabel: {
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: space.lg,
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.lg,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  pplSection: {
    marginTop: space.lg,
  },
  pplChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  pplChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    gap: space.sm,
  },
  pplDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyMonth: {
    paddingVertical: space.md,
  },
  emptyText: {
    textAlign: 'center',
  },
});
