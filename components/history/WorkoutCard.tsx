import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { type as typeScale } from '@/lib/ui/typography';
import { dayKeyOf } from '@/components/history/liftSeries';
import { SessionPR } from '@/components/history/prSessions';
import { calculateWorkoutStats, formatWorkoutStatsLine } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/workouts';
import { convertWeight, GeneratedWorkout, TrackingType, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface WorkoutCardProps {
  workout: GeneratedWorkout;
  // The single most significant all-time PR per training day (buildSessionPRs). At most
  // one PR per session — the card is a glanceable summary, the full per-exercise PR
  // breakdown lives one tap deeper in WorkoutDetailModal.
  sessionPRs: Map<string, SessionPR>;
  weightUnit: WeightUnit;
  onPress: (workout: GeneratedWorkout) => void;
  onLongPress: (workout: GeneratedWorkout) => void;
}

function WorkoutCard({
  workout,
  sessionPRs,
  weightUnit,
  onPress,
  onLongPress,
}: WorkoutCardProps) {
  const { currentTheme } = useTheme();

  // Helper to get tracking type for an exercise
  const getTrackingType = useCallback((exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getExercise(exerciseId);
    return exerciseInfo?.trackingType;
  }, []);

  // Whole-session roll-up (sets + volume) — the "what did I do" glance.
  const workoutStats = useMemo(
    () => calculateWorkoutStats(workout.exercises, getTrackingType),
    [workout.exercises, getTrackingType]
  );

  // The session's headline movement: the highest-volume lift. Names the main thing you
  // did without exploding every exercise × every set inline (that detail is one tap away).
  const topLift = useMemo(() => {
    let best: { name: string; setCount: number; volume: number } | null = null;
    for (const ex of workout.exercises) {
      if (!ex.completedSets || ex.completedSets.length === 0) continue;
      const info = getExercise(ex.id);
      const name = info?.name || ex.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];
      const trackingType = info?.trackingType || 'reps';
      let volume = 0;
      if (trackingType === 'reps') {
        volume = ex.completedSets.reduce((sum, set) => {
          const setUnit = set.unit || 'lbs';
          return sum + convertWeight(set.weight || 0, setUnit, weightUnit) * (set.reps || 0);
        }, 0);
      }
      if (!best || volume > best.volume) {
        best = { name, setCount: ex.completedSets.length, volume };
      }
    }
    return best;
  }, [workout.exercises, weightUnit]);

  // At most one PR per session — the single biggest *notable compound* record set that
  // day (buildSessionPRs already applies the significance floor, so most cards get none).
  const sessionPR = useMemo(
    () => sessionPRs.get(dayKeyOf(workout.createdAt)) ?? null,
    [sessionPRs, workout.createdAt]
  );
  const prGainDisplay = sessionPR
    ? Math.max(1, Math.round(convertWeight(sessionPR.gainLbs, 'lbs', weightUnit)))
    : 0;
  // The badge is reserved for MAJOR records so it stays rare and meaningful. A standard
  // (notable-but-modest) PR still gets a subtle highlight line, just no headline chip.
  const isMajorPR = sessionPR?.tier === 'major';

  const statsLine = formatWorkoutStatsLine(workoutStats, { unit: weightUnit });

  return (
    <TouchableOpacity
      style={[styles.workoutCard, { borderColor: currentTheme.colors.border }]}
      onPress={() => onPress(workout)}
      onLongPress={() => onLongPress(workout)}
      activeOpacity={0.7}
    >
      {/* Title + at-most-one PR marker — the filled badge is reserved for MAJOR records */}
      <View style={[styles.titleRow, { backgroundColor: 'transparent' }]}>
        <Text
          style={[styles.workoutTitle, { color: currentTheme.colors.text, fontWeight: '600' }]}
          numberOfLines={1}
        >
          {workout.title}
        </Text>
        {isMajorPR && (
          <RNView style={[styles.prChip, { backgroundColor: currentTheme.colors.primary }]}>
            <Ionicons name="trophy" size={10} color="#fff" />
            <Text style={[styles.prChipText, { color: '#fff', fontWeight: '600' }]}>
              PR
            </Text>
          </RNView>
        )}
        <Ionicons name="chevron-forward" size={16} color={currentTheme.colors.text + '35'} />
      </View>

      {/* Summary line: when + total sets + session volume */}
      <Text style={[styles.workoutMeta, { color: currentTheme.colors.text + '80', fontWeight: '400' }]} numberOfLines={1}>
        {formatRelativeDate(workout.createdAt)} • {statsLine}
      </Text>

      {/* Highlight line: a record takes precedence, else the top lift. A major PR reads
          bold/primary; a standard PR is present but de-emphasized so it doesn't shout. */}
      {sessionPR ? (
        <Text
          style={[
            styles.prLine,
            isMajorPR
              ? { color: currentTheme.colors.primary, fontWeight: '600' }
              : { color: currentTheme.colors.primary + 'B0', fontWeight: '500' },
          ]}
          numberOfLines={1}
        >
          {sessionPR.name} · {isMajorPR ? 'new PR' : 'PR'} +{prGainDisplay} {weightUnit}
        </Text>
      ) : topLift ? (
        <Text style={[styles.topLiftLine, { color: currentTheme.colors.text + '99', fontWeight: '400' }]} numberOfLines={1}>
          {topLift.name} · {topLift.setCount} set{topLift.setCount !== 1 ? 's' : ''}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default React.memo(WorkoutCard);

const styles = StyleSheet.create({
  workoutCard: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  workoutTitle: {
    flex: 1,
    fontSize: typeScale.title,
    lineHeight: 23,
    letterSpacing: -0.2,
  },
  workoutMeta: {
    fontSize: typeScale.meta,
    lineHeight: 18,
    marginTop: 3,
  },
  topLiftLine: {
    fontSize: typeScale.meta,
    lineHeight: 18,
    marginTop: 4,
  },
  prLine: {
    fontSize: typeScale.meta,
    lineHeight: 18,
    marginTop: 4,
  },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  prChipText: {
    fontSize: typeScale.meta,
    letterSpacing: 0.5,
  },
});
