import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useUser } from '@/contexts/UserContext';
import { useSound } from '@/hooks/useSound';
import playHapticFeedback from '@/lib/haptic';
import { getWorkoutByIdWithCustom } from '@/lib/workouts';
import { GeneratedWorkout, MuscleGroup, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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
}

export default function MonthlyTrendsModal({
  visible,
  onClose,
  workoutHistory,
}: MonthlyTrendsModalProps) {
  const { currentTheme } = useTheme();
  const { customExercises } = useCustomExercises();
  const { userProfile } = useUser();
  const { play: playTap } = useSound('tapVariant1');

  const weightUnit: WeightUnit = userProfile?.weightUnitPreference || 'lbs';
  const [pageOffset, setPageOffset] = useState(0);

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

      let totalVolume = 0;
      let totalTime = 0;
      let totalExercises = 0;

      monthWorkouts.forEach(workout => {
        totalTime += workout.estimatedDuration;

        workout.exercises.forEach(exercise => {
          totalExercises++;
          const exerciseInfo = getWorkoutByIdWithCustom(exercise.id, customExercises);
          if (exerciseInfo && exerciseInfo.primaryMuscles.length > 0) {
            // Count exercise once based on its first primary muscle's PPL category
            const primaryMuscle = exerciseInfo.primaryMuscles[0];
            const pplCategory = MUSCLE_TO_PPL[primaryMuscle];
            if (pplCategory) {
              pplCounts[pplCategory]++;
            }
          }

          exercise.completedSets.forEach(set => {
            totalVolume += set.weight * set.reps;
          });
        });
      });

      data.push({
        month: targetDate.toLocaleDateString('en-US', { month: 'long' }),
        shortMonth: targetDate.toLocaleDateString('en-US', { month: 'short' }),
        year: targetDate.getFullYear(),
        workoutCount: monthWorkouts.length,
        totalVolume: Math.round(totalVolume),
        totalTime,
        pplCounts,
        totalExercises,
      });
    }

    return data;
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

  const formatVolume = (volume: number) => {
    if (volume >= 1000000) return `${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `${(volume / 1000).toFixed(1)}k`;
    return volume.toString();
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
  };

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
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
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
                color={canGoBack ? currentTheme.colors.text : currentTheme.colors.text + '20'}
              />
            </TouchableOpacity>

            <Text style={[styles.dateRangeLabel, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
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
                color={canGoForward ? currentTheme.colors.text : currentTheme.colors.text + '20'}
              />
            </TouchableOpacity>
          </Animated.View>

          {/* PPL Stacked Chart */}
          <Animated.View entering={FadeInDown.delay(150)} style={styles.chartSection}>
            <View style={styles.chartHeader}>
              <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                Training Focus
              </Text>
              {/* Legend */}
              <View style={styles.legend}>
                {(['push', 'pull', 'legs'] as PPLCategory[]).map(category => (
                  <View key={category} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: PPL_COLORS[category] }]} />
                    <Text style={[styles.legendText, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_500Medium' }]}>
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
                const pushHeight = total > 0 ? (month.pplCounts.push / maxPPLTotal) * maxHeight : 0;
                const pullHeight = total > 0 ? (month.pplCounts.pull / maxPPLTotal) * maxHeight : 0;
                const legsHeight = total > 0 ? (month.pplCounts.legs / maxPPLTotal) * maxHeight : 0;

                return (
                  <View key={index} style={styles.barColumn}>
                    <Text style={[
                      styles.barValue,
                      { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_600SemiBold' }
                    ]}>
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
                    <Text style={[
                      styles.barLabel,
                      {
                        color: isCurrentMonth ? currentTheme.colors.primary : currentTheme.colors.text + '60',
                        fontFamily: isCurrentMonth ? 'Raleway_600SemiBold' : 'Raleway_500Medium',
                      }
                    ]}>
                      {month.shortMonth}
                    </Text>
                  </View>
                );
              })}
            </View>
          </Animated.View>

          {/* Monthly Cards */}
          <Animated.View entering={FadeInDown.delay(250)} style={styles.cardsSection}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
              Details
            </Text>

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
                      <Text style={[styles.monthName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                        {month.month}
                      </Text>
                      <Text style={[styles.monthYear, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                        {month.year}
                      </Text>
                    </View>
                    <View style={[styles.workoutsBadge, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                      <Text style={[styles.workoutsCount, { color: currentTheme.colors.primary, fontFamily: 'Raleway_700Bold' }]}>
                        {month.workoutCount}
                      </Text>
                      <Text style={[styles.workoutsLabel, { color: currentTheme.colors.primary, fontFamily: 'Raleway_500Medium' }]}>
                        workouts
                      </Text>
                    </View>
                  </View>

                  {/* Stats Row */}
                  {month.workoutCount > 0 && (
                    <View style={[styles.statsRow, { borderTopColor: currentTheme.colors.border }]}>
                      <View style={styles.statItem}>
                        <Ionicons name="fitness-outline" size={16} color={currentTheme.colors.text + '60'} />
                        <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                          {month.totalExercises} exercises
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="barbell-outline" size={16} color={currentTheme.colors.text + '60'} />
                        <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                          {formatVolume(month.totalVolume)} {weightUnit}
                        </Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="time-outline" size={16} color={currentTheme.colors.text + '60'} />
                        <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                          {formatTime(month.totalTime)}
                        </Text>
                      </View>
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
                              style={[styles.pplChip, { backgroundColor: PPL_COLORS[category] + '20' }]}
                            >
                              <View style={[styles.pplDot, { backgroundColor: PPL_COLORS[category] }]} />
                              <Text style={[styles.pplChipText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                                {PPL_LABELS[category]}
                              </Text>
                              <Text style={[styles.pplChipCount, { color: PPL_COLORS[category], fontFamily: 'Raleway_700Bold' }]}>
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
                      <Text style={[styles.emptyText, { color: currentTheme.colors.text + '40', fontFamily: 'Raleway_400Regular' }]}>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  paginationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pageButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateRangeLabel: {
    fontSize: 17,
  },
  chartSection: {
    marginBottom: 32,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  legend: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
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
    fontSize: 13,
    marginBottom: 6,
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
    fontSize: 12,
    marginTop: 8,
  },
  cardsSection: {
    gap: 12,
  },
  monthCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  monthName: {
    fontSize: 18,
  },
  monthYear: {
    fontSize: 13,
    marginTop: 2,
  },
  workoutsBadge: {
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  workoutsCount: {
    fontSize: 20,
  },
  workoutsLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statValue: {
    fontSize: 13,
  },
  pplSection: {
    marginTop: 16,
  },
  pplChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pplChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  pplDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pplChipText: {
    fontSize: 13,
  },
  pplChipCount: {
    fontSize: 14,
  },
  emptyMonth: {
    paddingVertical: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
