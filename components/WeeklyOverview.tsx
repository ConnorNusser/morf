import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCompact, formatMinutes as formatTime, calculateWorkoutStats, combineWorkoutStats, formatDistance, formatDuration, WorkoutStats } from '@/lib/utils/utils';
import { getWorkoutByIdWithCustom } from '@/lib/workout/workouts';
import { CustomExercise, GeneratedWorkout, MuscleGroup, TrackingType } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from './Card';
import MuscleFocusChips, { MuscleGroupData } from './MuscleFocusChips';
import WeeklyOverviewModal from './WeeklyOverviewModal';

// All trackable muscle groups
const ALL_MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'glutes', 'core'];

// Completed ("hard") sets per muscle for a set of workouts — the standard hypertrophy
// balance unit. Each completed set of an exercise counts once toward every primary
// muscle it targets. Honest and able to fall: skip a group and its count drops to zero.
function countSetsByMuscle(workouts: GeneratedWorkout[], customExercises: CustomExercise[]): Record<MuscleGroup, number> {
  const map: Record<MuscleGroup, number> = {
    chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, glutes: 0, core: 0, 'full-body': 0,
  };
  for (const workout of workouts) {
    for (const exercise of workout.exercises) {
      const info = getWorkoutByIdWithCustom(exercise.id, customExercises);
      if (!info) continue;
      const completed = (exercise.completedSets || []).filter(set => set.completed).length;
      if (completed === 0) continue;
      for (const muscle of info.primaryMuscles) {
        map[muscle] += completed;
      }
    }
  }
  return map;
}

interface WeeklyOverviewProps {
  workoutHistory: GeneratedWorkout[];
}

interface WeekData {
  startDate: Date;
  endDate: Date;
  workouts: GeneratedWorkout[];
  weekDays: {
    date: Date;
    dayNumber: number;
    dayLetter: string;
    hasWorkout: boolean;
    dayWorkouts: GeneratedWorkout[];
  }[];
}

export default function WeeklyOverview({ workoutHistory }: WeeklyOverviewProps) {
  const { currentTheme } = useTheme();
  const { customExercises } = useCustomExercises();

  const [currentWeekOffset, setCurrentWeekOffset] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalInvocationType, setModalInvocationType] = useState<'day' | 'week' | 'volume' | 'time'>('day');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [modalWorkouts, setModalWorkouts] = useState<GeneratedWorkout[]>([]);


  const getWeekData = (weekOffset: number = 0): WeekData => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Adjust to get Monday
    
    const mondayOfWeek = new Date(today);
    mondayOfWeek.setDate(today.getDate() + mondayOffset + (weekOffset * 7));
    mondayOfWeek.setHours(0, 0, 0, 0);
    
    const sundayOfWeek = new Date(mondayOfWeek);
    sundayOfWeek.setDate(mondayOfWeek.getDate() + 6);
    sundayOfWeek.setHours(23, 59, 59, 999);

    const weekWorkouts = workoutHistory.filter(workout => {
      const workoutDate = new Date(workout.createdAt);
      return workoutDate >= mondayOfWeek && workoutDate <= sundayOfWeek;
    });

    const weekDays = [];
    const dayLetters = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfWeek);
      date.setDate(mondayOfWeek.getDate() + i);
      
      const dayWorkouts = weekWorkouts.filter(workout => {
        const workoutDate = new Date(workout.createdAt);
        return workoutDate.toDateString() === date.toDateString();
      });
      
      weekDays.push({
        date,
        dayNumber: date.getDate(),
        dayLetter: dayLetters[i],
        hasWorkout: dayWorkouts.length > 0,
        dayWorkouts,
      });
    }

    return {
      startDate: mondayOfWeek,
      endDate: sundayOfWeek,
      workouts: weekWorkouts,
      weekDays,
    };
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- getWeekData is stable, uses workoutHistory via closure
  const weekData = useMemo(() => getWeekData(currentWeekOffset), [workoutHistory, currentWeekOffset]);

  // Calculate muscle groups trained this week with exercise details
  const muscleGroupData = useMemo((): MuscleGroupData[] => {
    const muscleMap: Record<MuscleGroup, { count: number; exercises: Record<string, { id: string; name: string; count: number }> }> = {
      chest: { count: 0, exercises: {} },
      back: { count: 0, exercises: {} },
      shoulders: { count: 0, exercises: {} },
      arms: { count: 0, exercises: {} },
      legs: { count: 0, exercises: {} },
      glutes: { count: 0, exercises: {} },
      core: { count: 0, exercises: {} },
      'full-body': { count: 0, exercises: {} },
    };

    weekData.workouts.forEach(workout => {
      workout.exercises.forEach(exercise => {
        const exerciseInfo = getWorkoutByIdWithCustom(exercise.id, customExercises);
        if (exerciseInfo) {
          exerciseInfo.primaryMuscles.forEach(muscle => {
            muscleMap[muscle].count++;
            if (!muscleMap[muscle].exercises[exercise.id]) {
              muscleMap[muscle].exercises[exercise.id] = {
                id: exercise.id,
                name: exerciseInfo.name,
                count: 0,
              };
            }
            muscleMap[muscle].exercises[exercise.id].count++;
          });
        }
      });
    });

    // This week's hard sets per muscle, plus the lifter's trailing-4-completed-week
    // weekly average as the personal baseline to read balance/neglect against.
    const thisWeekSets = countSetsByMuscle(weekData.workouts, customExercises);
    const BASELINE_WEEKS = 4;
    const normAccum: Record<MuscleGroup, number> = {
      chest: 0, back: 0, shoulders: 0, arms: 0, legs: 0, glutes: 0, core: 0, 'full-body': 0,
    };
    for (let i = 1; i <= BASELINE_WEEKS; i++) {
      const wkSets = countSetsByMuscle(getWeekData(currentWeekOffset - i).workouts, customExercises);
      (Object.keys(normAccum) as MuscleGroup[]).forEach(m => { normAccum[m] += wkSets[m]; });
    }

    return ALL_MUSCLE_GROUPS.map(muscle => ({
      muscle,
      count: muscleMap[muscle].count,
      sets: thisWeekSets[muscle],
      normSets: normAccum[muscle] / BASELINE_WEEKS,
      exercises: Object.values(muscleMap[muscle].exercises),
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getWeekData is stable, keyed by workoutHistory + currentWeekOffset
  }, [weekData.workouts, customExercises, currentWeekOffset, workoutHistory]);

  // Helper to get tracking type for an exercise
  const getTrackingType = (exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getWorkoutByIdWithCustom(exerciseId, customExercises);
    return exerciseInfo?.trackingType;
  };

  const weekStats = useMemo(() => {
    const totalWorkouts = weekData.workouts.length;
    const totalTime = weekData.workouts.reduce((sum, workout) => sum + workout.estimatedDuration, 0);

    // Calculate combined workout stats using the utility
    const workoutStatsList: WorkoutStats[] = weekData.workouts.map(workout =>
      calculateWorkoutStats(workout.exercises, getTrackingType)
    );
    const combinedStats = combineWorkoutStats(workoutStatsList);

    const volumeOf = (list: GeneratedWorkout[]) =>
      combineWorkoutStats(list.map(w => calculateWorkoutStats(w.exercises, getTrackingType))).totalVolumeLbs;

    // 8-week volume trend ending at the viewed week — a shape, not a scalar. The current
    // in-progress week is flagged so it can render ghosted instead of masquerading as a
    // finished bar.
    const TREND_WEEKS = 8;
    const volumeTrend: { volume: number; inProgress: boolean }[] = [];
    for (let i = TREND_WEEKS - 1; i >= 0; i--) {
      const offset = currentWeekOffset - i;
      volumeTrend.push({ volume: volumeOf(getWeekData(offset).workouts), inProgress: offset === 0 });
    }

    // Pace-aware WoW delta: an in-progress week is compared to the SAME elapsed slice of
    // last week (Mon..today), not last week's finished total — so a Wednesday check-in
    // stops firing a false red just because the week isn't over yet. Past weeks compare
    // full-to-full.
    const inProgress = currentWeekOffset === 0;
    const today = new Date();
    const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0 .. Sun=6
    const prevWeek = getWeekData(currentWeekOffset - 1);
    let prevPacedVolume = 0;
    prevWeek.weekDays.forEach((d, idx) => {
      if (inProgress && idx > todayIdx) return;
      prevPacedVolume += volumeOf(d.dayWorkouts);
    });
    const volumeDeltaPct = prevPacedVolume > 0
      ? Math.round(((combinedStats.totalVolumeLbs - prevPacedVolume) / prevPacedVolume) * 100)
      : null;

    const formatVolume = (volume: number) => formatCompact(volume);

    return {
      totalWorkouts,
      totalTime: formatTime(totalTime),
      totalVolume: formatVolume(combinedStats.totalVolumeLbs),
      rawVolume: combinedStats.totalVolumeLbs,
      volumeDeltaPct,
      volumeDeltaPaced: inProgress,
      volumeTrend,
      // Cardio stats
      hasCardio: combinedStats.hasCardioExercises,
      totalDistanceMeters: combinedStats.totalDistanceMeters,
      totalCardioDurationSeconds: combinedStats.totalCardioDurationSeconds,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- getTrackingType is stable
  }, [weekData.workouts, customExercises]);

  const formatDateRange = (startDate: Date, endDate: Date) => {
    const startMonth = startDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const endMonth = endDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    const startDay = startDate.getDate();
    const endDay = endDate.getDate();

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay}-${endDay}`;
    }
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  };

  const getDayBackgroundColor = (hasWorkout: boolean) => {
    if (!hasWorkout) return 'transparent';
    return currentTheme.colors.primary + '1A'; // 10% opacity
  };

  const getDayTextColor = (hasWorkout: boolean) => {
    if (!hasWorkout) return currentTheme.colors.text + '4D'; // 30%
    return currentTheme.colors.primary;
  };

  const handleDayPress = (day: WeekData['weekDays'][0]) => {
    setSelectedDate(day.date);
    setModalWorkouts(day.dayWorkouts);
    setModalInvocationType('day');
    setModalVisible(true);
  };

  const handleWeekPress = () => {
    setModalWorkouts(weekData.workouts);
    setModalInvocationType('week');
    setModalVisible(true);
  };

  const handleVolumePress = () => {
    setModalWorkouts(weekData.workouts);
    setModalInvocationType('volume');
    setModalVisible(true);
  };

  const handleTimePress = () => {
    setModalWorkouts(weekData.workouts);
    setModalInvocationType('time');
    setModalVisible(true);
  };

  const handleModalClose = () => {
    setModalVisible(false);
    setSelectedDate(undefined);
    setModalWorkouts([]);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    setCurrentWeekOffset(prev => direction === 'prev' ? prev - 1 : prev + 1);
  };

  // Muted for small moves (< 5%) so week-to-week noise never fires an alarm color; only
  // a real swing goes green/red.
  const deltaPct = weekStats.volumeDeltaPct;
  const deltaColor = deltaPct === null || Math.abs(deltaPct) < 5
    ? currentTheme.colors.text + '80'
    : deltaPct > 0 ? '#34C759' : '#FF3B30';
  const deltaSign = deltaPct === null ? '' : deltaPct > 0 ? '+' : deltaPct < 0 ? '−' : '±';

  // How far through the viewed week we are (1 for any past/completed week). Lets the
  // muscle-balance panel compare an in-progress week against its pro-rated norm.
  const paceFraction = currentWeekOffset === 0
    ? (() => { const dow = new Date().getDay(); const idx = dow === 0 ? 6 : dow - 1; return (idx + 1) / 7; })()
    : 1;

  return (
    <>
      <Card variant="elevated" style={styles.container}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.header}>
            <Text style={[
              styles.title,
              {
                color: currentTheme.colors.text,
              }
            ]}>
              Weekly Overview
            </Text>
            <Text style={[
              styles.dateRange,
              {
                color: currentTheme.colors.text + '99',
              }
            ]}>
              {formatDateRange(weekData.startDate, weekData.endDate)}
            </Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={handleWeekPress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              {weekStats.totalWorkouts}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
              Workouts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={handleTimePress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              {weekStats.totalTime}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
              Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={handleVolumePress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              {weekStats.totalVolume}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
              Volume
            </Text>
          </TouchableOpacity>
        </View>

        {/* Week Days with navigation */}
        <View style={styles.weekContainer}>
          <TouchableOpacity
            onPress={() => navigateWeek('prev')}
            style={styles.navButton}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-back" size={24} color={currentTheme.colors.text + '4D'} />
          </TouchableOpacity>

          <View style={styles.daysContainer}>
            {weekData.weekDays.map((day, index) => (
              <View key={index} style={styles.dayColumn}>
                <TouchableOpacity
                  onPress={() => handleDayPress(day)}
                  style={[
                    styles.dayButton,
                    { backgroundColor: getDayBackgroundColor(day.hasWorkout) }
                  ]}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.dayNumber,
                    { color: getDayTextColor(day.hasWorkout) }
                  ]}>
                    {day.dayNumber}
                  </Text>
                </TouchableOpacity>
                <Text style={[
                  styles.dayLabel,
                  {
                    color: day.hasWorkout ? currentTheme.colors.text + '99' : currentTheme.colors.text + '4D',
                  }
                ]}>
                  {day.dayLetter}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => navigateWeek('next')}
            style={styles.navButton}
            activeOpacity={0.6}
          >
            <Ionicons name="chevron-forward" size={24} color={currentTheme.colors.text + '4D'} />
          </TouchableOpacity>
        </View>

        {/* Cardio Stats - only show if week has cardio exercises */}
        {weekStats.hasCardio && (weekStats.totalDistanceMeters > 0 || weekStats.totalCardioDurationSeconds > 0) && (
          <View style={[styles.statsContainer, styles.cardioStatsContainer]}>
            {weekStats.totalDistanceMeters > 0 && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                  {formatDistance(weekStats.totalDistanceMeters)}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                  Distance
                </Text>
              </View>
            )}
            {weekStats.totalCardioDurationSeconds > 0 && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                  {formatDuration(weekStats.totalCardioDurationSeconds)}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                  Cardio
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 8-week volume trend — replaces the lone in-progress-vs-complete scalar with a
            paced, glanceable direction. The current (in-progress) week renders ghosted so
            it never masquerades as a finished bar. */}
        {weekStats.volumeTrend.some(w => w.volume > 0) && (
          <View style={styles.trendSection}>
            <View style={styles.trendBars}>
              {(() => {
                const maxVol = Math.max(...weekStats.volumeTrend.map(w => w.volume), 1);
                return weekStats.volumeTrend.map((w, i) => (
                  <View
                    key={i}
                    style={[
                      styles.trendBar,
                      {
                        height: w.volume > 0 ? Math.max(3, Math.round((w.volume / maxVol) * 28)) : 2,
                        backgroundColor: w.inProgress ? currentTheme.colors.primary + '33' : currentTheme.colors.primary + 'B3',
                        borderWidth: w.inProgress ? StyleSheet.hairlineWidth : 0,
                        borderColor: currentTheme.colors.primary + '80',
                      },
                    ]}
                  />
                ));
              })()}
            </View>
            <View style={styles.trendCaption}>
              <Text style={[styles.trendLabel, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                Volume · last 8 wk
              </Text>
              {deltaPct !== null && (
                <Text style={[styles.trendDelta, { color: deltaColor, fontFamily: currentTheme.fonts.semiBold }]}>
                  {deltaSign}{Math.abs(deltaPct)}% vs last week
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Muscle Groups Focus */}
        <View style={[styles.muscleSection, { borderTopColor: currentTheme.colors.border }]}>
          <MuscleFocusChips muscleData={muscleGroupData} paceFraction={paceFraction} showMissing={false} />
        </View>
      </Card>

      <WeeklyOverviewModal
        visible={modalVisible}
        onClose={handleModalClose}
        invocationType={modalInvocationType}
        workouts={modalWorkouts}
        selectedDate={selectedDate}
        weekStartDate={weekData.startDate}
        weekEndDate={weekData.endDate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  header: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  dateRange: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  chevronIcon: {
    marginLeft: 4,
  },
  weekContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: {
    width: 32,
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flex: 1,
    marginHorizontal: 8,
  },
  dayColumn: {
    alignItems: 'center',
    flex: 1,
  },
  dayButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 3,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: '600',
  },
  dayLabel: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  cardioStatsContainer: {
    borderTopWidth: 0,
    paddingTop: 12,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  trendSection: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  trendBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 28,
    gap: 6,
  },
  trendBar: {
    flex: 1,
    borderRadius: 2,
  },
  trendCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  trendLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  trendDelta: {
    fontSize: 12,
    lineHeight: 16,
  },
  muscleSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
}); 