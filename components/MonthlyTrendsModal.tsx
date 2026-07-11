import IconButton from '@/components/IconButton';
import { Text, useInk } from '@/components/Themed';
import ScreenModal from '@/components/ui/ScreenModal';
import SectionLabel from '@/components/ui/SectionLabel';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/utils/haptic';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { formatCompact, formatMinutes as formatTime, calculateWorkoutStats, combineWorkoutStats, formatDistance, formatDuration, WorkoutStats, convertWeightForPreference} from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { LoggedWorkout, MuscleGroup, TrackingType, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const BAR_WIDTH = (SCREEN_WIDTH - 80) / 6;

type PPLCategory = 'push' | 'pull' | 'legs';

const MUSCLE_TO_PPL: Record<MuscleGroup, PPLCategory> = {
  chest: 'push',
  shoulders: 'push',
  back: 'pull',
  arms: 'pull', // biceps are pull-dominant
  legs: 'legs',
  glutes: 'legs',
  core: 'push', // categorized with push for simplicity
  'full-body': 'push',
};

const PPL_COLORS: Record<PPLCategory, string> = {
  push: '#FF6B6B',
  pull: '#4ECDC4',
  legs: '#9B59B6',
};

const PPL_LABELS: Record<PPLCategory, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
};

interface MonthlyTrendsModalProps {
  visible: boolean;
  onClose: () => void;
  workoutHistory: LoggedWorkout[];
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

  const getTrackingType = (exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getExercise(exerciseId);
    return exerciseInfo?.trackingType;
  };

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
            const primaryMuscle = exerciseInfo.primaryMuscles[0];
            const pplCategory = MUSCLE_TO_PPL[primaryMuscle];
            if (pplCategory) {
              pplCounts[pplCategory]++;
            }
          }
        });
      });

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
    <ScreenModal visible={visible} onClose={handleClose} title="Monthly Trends">

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeIn.delay(100)} style={styles.paginationHeader}>
            <IconButton
              icon="chevron-back"
              onPress={() => handlePageChange('back')}
              disabled={!canGoBack}
              iconColor={canGoBack ? ink.primary : ink.ghost}
            />

            <Text variant="title" tone="primary" weight="semiBold">
              {dateRangeLabel}
            </Text>

            <IconButton
              icon="chevron-forward"
              onPress={() => handlePageChange('forward')}
              disabled={!canGoForward}
              iconColor={canGoForward ? ink.primary : ink.ghost}
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150)} style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <SectionLabel style={styles.sectionTitle}>Training Focus</SectionLabel>
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

                const pushHeight = (month.pplCounts.push / maxPPLTotal) * maxHeight;
                const pullHeight = (month.pplCounts.pull / maxPPLTotal) * maxHeight;
                const legsHeight = (month.pplCounts.legs / maxPPLTotal) * maxHeight;

                return (
                  <View key={index} style={styles.barColumn}>
                    <Text variant="meta" tone="secondary" weight="semiBold" style={styles.barValue}>
                      {total || '-'}
                    </Text>
                    <View style={styles.barWrapper}>
                      {/* legs bottom, pull middle, push top (column-reverse) */}
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

          <Animated.View entering={FadeInDown.delay(250)} style={styles.cardsSection}>
            <SectionLabel style={styles.sectionTitle}>Details</SectionLabel>

            {currentMonthlyData.slice().reverse().map((month, index) => {
              const pplTotal = month.pplCounts.push + month.pplCounts.pull + month.pplCounts.legs;

              return (
                <View
                  key={index}
                  style={[styles.monthCard, { backgroundColor: currentTheme.colors.surface }]}
                >
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
                          {formatVolume(weightUnit === 'kg' ? convertWeightForPreference(month.totalVolume, 'lbs', 'kg') : month.totalVolume)} {weightUnit}
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
    </ScreenModal>
  );
}

const styles = StyleSheet.create({
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
