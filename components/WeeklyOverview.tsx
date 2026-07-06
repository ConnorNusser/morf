import SessionVolumeBars from '@/components/history/SessionVolumeBars';
import { useCustomExercises } from '@/contexts/CustomExercisesContext';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCompact, formatMinutes as formatTime, calculateWorkoutStats, combineWorkoutStats, formatDistance, formatDuration, WorkoutStats } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/workouts';
import { SessionRecap } from '@/lib/history/sessionRecap';
import { GeneratedWorkout, TrackingType } from '@/types';
import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Card from './Card';
import WeeklyOverviewModal from './WeeklyOverviewModal';

// The summary is deliberately scoped to the CURRENT week. Past weeks already live in the
// hero's timeframe toggle (strength over time) and the Monthly Trends drill-down, so an
// in-card week navigator would just add a second, redundant time control to a block whose
// whole job is a one-glance "am I on track THIS week?" read. Muscle balance — a
// cross-group, multi-week question — is answered by its own MuscleBalanceCard below this
// one, so the volume card no longer does triple duty.
const CURRENT_WEEK = 0;

interface WeeklyOverviewProps {
  workoutHistory: GeneratedWorkout[];
  /** Per-session recaps (newest first) — drives the split-colored volume bars. */
  sessionRecaps: SessionRecap[];
}

interface WeekData {
  startDate: Date;
  endDate: Date;
  workouts: GeneratedWorkout[];
  weekDays: {
    date: Date;
    dayWorkouts: GeneratedWorkout[];
  }[];
}

export default function WeeklyOverview({ workoutHistory, sessionRecaps }: WeeklyOverviewProps) {
  const { currentTheme } = useTheme();
  const { customExercises } = useCustomExercises();

  const [modalVisible, setModalVisible] = useState(false);
  const [modalInvocationType, setModalInvocationType] = useState<'week' | 'volume' | 'time'>('week');
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
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayOfWeek);
      date.setDate(mondayOfWeek.getDate() + i);

      const dayWorkouts = weekWorkouts.filter(workout => {
        const workoutDate = new Date(workout.createdAt);
        return workoutDate.toDateString() === date.toDateString();
      });

      weekDays.push({ date, dayWorkouts });
    }

    return {
      startDate: mondayOfWeek,
      endDate: sundayOfWeek,
      workouts: weekWorkouts,
      weekDays,
    };
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps -- getWeekData is stable, uses workoutHistory via closure
  const weekData = useMemo(() => getWeekData(CURRENT_WEEK), [workoutHistory]);

  // Helper to get tracking type for an exercise
  const getTrackingType = (exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getExercise(exerciseId);
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

    const formatVolume = (volume: number) => formatCompact(volume);

    return {
      totalWorkouts,
      totalTime: formatTime(totalTime),
      totalVolume: formatVolume(combinedStats.totalVolumeLbs),
      rawVolume: combinedStats.totalVolumeLbs,
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
      return `${startMonth} ${startDay}–${endDay}`;
    }
    return `${startMonth} ${startDay} – ${endMonth} ${endDay}`;
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
    setModalWorkouts([]);
  };

  return (
    <>
      <Card variant="elevated" style={styles.container}>
        {/* One label for the whole block: "This Week" + its date range. The parent screen
            no longer renders a separate section heading, so this card wears exactly one title. */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: currentTheme.colors.text }]}>THIS WEEK</Text>
          <Text style={[styles.dateRange, { color: currentTheme.colors.text }]}>
            {formatDateRange(weekData.startDate, weekData.endDate)}
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.statItem}
            onPress={handleWeekPress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '600' }]}>
              {weekStats.totalWorkouts}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontWeight: '400' }]}>
              Workouts
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={handleTimePress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '600' }]}>
              {weekStats.totalTime}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontWeight: '400' }]}>
              Time
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statItem}
            onPress={handleVolumePress}
            activeOpacity={0.6}
          >
            <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '600' }]}>
              {weekStats.totalVolume}
            </Text>
            <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontWeight: '400' }]}>
              Volume
            </Text>
          </TouchableOpacity>
        </View>

        {/* Cardio Stats - only show if week has cardio exercises */}
        {weekStats.hasCardio && (weekStats.totalDistanceMeters > 0 || weekStats.totalCardioDurationSeconds > 0) && (
          <View style={[styles.statsContainer, styles.cardioStatsContainer]}>
            {weekStats.totalDistanceMeters > 0 && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '600' }]}>
                  {formatDistance(weekStats.totalDistanceMeters)}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontWeight: '400' }]}>
                  Distance
                </Text>
              </View>
            )}
            {weekStats.totalCardioDurationSeconds > 0 && (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '600' }]}>
                  {formatDuration(weekStats.totalCardioDurationSeconds)}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text + '99', fontWeight: '400' }]}>
                  Cardio
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Volume per session — one PPL-colored bar per workout (oldest → newest,
            newest full-strength), moved here from the SESSIONS section so the This
            Week card owns the volume story in one place. */}
        {sessionRecaps.length > 0 && (
          <View style={styles.trendSection}>
            <SessionVolumeBars recaps={sessionRecaps} />
            <View style={styles.trendCaption}>
              <Text style={[styles.trendLabel, { color: currentTheme.colors.text + '99', fontWeight: '400' }]}>
                Volume · per session
              </Text>
            </View>
          </View>
        )}
      </Card>

      <WeeklyOverviewModal
        visible={modalVisible}
        onClose={handleModalClose}
        invocationType={modalInvocationType}
        workouts={modalWorkouts}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    opacity: 0.45,
  },
  dateRange: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.2,
    opacity: 0.5,
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
});
