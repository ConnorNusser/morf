import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { dayKeyOf } from '@/components/history/liftSeries';
import { calculateWorkoutStats, formatSet, formatWorkoutStatsLine } from '@/lib/utils/utils';
import { getWorkoutByIdWithCustom } from '@/lib/workout/workouts';
import { convertWeight, CustomExercise, GeneratedWorkout, TrackingType, WeightUnit } from '@/types';
import React, { useCallback, useMemo } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface WorkoutCardProps {
  workout: GeneratedWorkout;
  // Per exercise, the set of day-keys that set a new all-time best (buildPRDays).
  prDays: Map<string, Set<string>>;
  weightUnit: WeightUnit;
  customExercises: CustomExercise[];
  onPress: (workout: GeneratedWorkout) => void;
  onLongPress: (workout: GeneratedWorkout) => void;
}

function WorkoutCard({
  workout,
  prDays,
  weightUnit,
  customExercises,
  onPress,
  onLongPress,
}: WorkoutCardProps) {
  const { currentTheme } = useTheme();


  // Helper to get tracking type for an exercise
  const getTrackingType = useCallback((exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getWorkoutByIdWithCustom(exerciseId, customExercises);
    return exerciseInfo?.trackingType;
  }, [customExercises]);

  // Calculate stats using the universal utility
  const workoutStats = useMemo(
    () => calculateWorkoutStats(workout.exercises, getTrackingType),
    [workout.exercises, getTrackingType]
  );

  const exercises = useMemo((): { name: string; sets: string[]; isPR: boolean; volume: number }[] => {
    const exercises: { name: string; sets: string[]; isPR: boolean; volume: number }[] = [];
    const workoutDayKey = dayKeyOf(workout.createdAt);

    workout.exercises.forEach(ex => {
      const exerciseInfo = getWorkoutByIdWithCustom(ex.id, customExercises);
      const name = exerciseInfo?.name || ex.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];
      const trackingType = exerciseInfo?.trackingType || 'reps';

      if (ex.completedSets && ex.completedSets.length > 0) {
        // Format sets using universal formatter
        const sets = ex.completedSets.map(set => {
          const setUnit = set.unit || 'lbs';
          const displayWeight = set.weight != null ? Math.round(convertWeight(set.weight, setUnit, weightUnit)) : 0;
          return formatSet(
            { weight: displayWeight, reps: set.reps, unit: weightUnit, duration: set.duration, distance: set.distance },
            { trackingType, compact: true }
          );
        });

        // For reps-based exercises, flag a PR and compute volume.
        let isPR = false;
        let volume = 0;

        if (trackingType === 'reps') {
          // Calculate volume in user's preferred unit
          volume = ex.completedSets.reduce((sum, set) => {
            const setUnit = set.unit || 'lbs';
            const weightInPreferredUnit = convertWeight(set.weight || 0, setUnit, weightUnit);
            return sum + weightInPreferredUnit * (set.reps || 0);
          }, 0);

          // A PR is a *new all-time best at the time logged*: this workout's day set a
          // record that strictly beat every prior day for the exercise (buildPRDays).
          // The old test compared this set's 1RM to the all-time max with `>=`, which
          // only ever flagged the single record-holding workout — so a strictly
          // ascending history chipped just its most-recent session, and a plateau that
          // merely re-hit its peak lit a false PR on every repeat. Unit/rounding
          // normalization is handled inside buildPRDays (all math in lbs).
          isPR = prDays.get(ex.id)?.has(workoutDayKey) ?? false;
        }

        exercises.push({ name, sets, isPR, volume });
      }
    });

    return exercises.sort((a, b) => b.volume - a.volume);
  }, [workout.exercises, workout.createdAt, customExercises, prDays, weightUnit]);

  const statsLine = formatWorkoutStatsLine(workoutStats, { unit: weightUnit });

  return (
    <TouchableOpacity
      style={[styles.workoutCard, { borderColor: currentTheme.colors.border }]}
      onPress={() => onPress(workout)}
      onLongPress={() => onLongPress(workout)}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={[styles.workoutHeader, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.workoutTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]} numberOfLines={1}>
          {workout.title}
        </Text>
        <Text style={[styles.workoutMeta, { color: currentTheme.colors.text + '50', fontFamily: currentTheme.fonts.regular }]}>
          {formatRelativeDate(workout.createdAt)} • {statsLine}
        </Text>
      </View>

      {/* Exercise list */}
      {exercises.length > 0 && (
        <View style={styles.exercisesList}>
          {exercises.map((ex, idx) => (
            <RNView key={idx} style={[styles.exerciseRow, { backgroundColor: currentTheme.colors.surface }]}>
              <RNView style={styles.exerciseContent}>
                <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                  {ex.name}
                </Text>
                <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                  {ex.sets.join(' · ')}
                </Text>
              </RNView>
              {ex.isPR && (
                <RNView style={[styles.prChip, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                  <Text style={[styles.prChipText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                    PR
                  </Text>
                </RNView>
              )}
            </RNView>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

export default React.memo(WorkoutCard);

const styles = StyleSheet.create({
  workoutCard: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  workoutHeader: {
    marginBottom: 12,
  },
  workoutTitle: {
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  workoutMeta: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  exercisesList: {
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exerciseContent: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 15,
    lineHeight: 20,
  },
  exerciseSets: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  prChip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 12,
  },
  prChipText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
