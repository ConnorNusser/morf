import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { calculateWorkoutStats, formatSet, formatWorkoutStatsLine } from '@/lib/utils/utils';
import { getWorkoutByIdWithCustom } from '@/lib/workout/workouts';
import { convertWeight, CustomExercise, ExerciseWithMax, GeneratedWorkout, TrackingType, WeightUnit } from '@/types';
import React from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface WorkoutCardProps {
  workout: GeneratedWorkout;
  exerciseStats: ExerciseWithMax[];
  weightUnit: WeightUnit;
  customExercises: CustomExercise[];
  onPress: () => void;
  onLongPress: () => void;
}

export default function WorkoutCard({
  workout,
  exerciseStats,
  weightUnit,
  customExercises,
  onPress,
  onLongPress,
}: WorkoutCardProps) {
  const { currentTheme } = useTheme();

  const formatRelativeDate = (date: Date): string => {
    const now = new Date();
    const d = new Date(date);
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Helper to get tracking type for an exercise
  const getTrackingType = (exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getWorkoutByIdWithCustom(exerciseId, customExercises);
    return exerciseInfo?.trackingType;
  };

  // Calculate stats using the universal utility
  const workoutStats = calculateWorkoutStats(workout.exercises, getTrackingType);

  const getWorkoutExercises = (): { name: string; sets: string[]; isPR: boolean }[] => {
    const exercises: { name: string; sets: string[]; isPR: boolean; volume: number }[] = [];

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

        // For reps-based exercises, find best set by estimated 1RM
        let isPR = false;
        let volume = 0;

        if (trackingType === 'reps') {
          const bestSet = ex.completedSets.reduce((best, current) => {
            const bestUnit = best.unit || 'lbs';
            const currentUnit = current.unit || 'lbs';
            const bestInLbs = convertWeight(best.weight || 0, bestUnit, 'lbs');
            const currentInLbs = convertWeight(current.weight || 0, currentUnit, 'lbs');
            const best1RM = OneRMCalculator.estimate(bestInLbs, best.reps || 0);
            const current1RM = OneRMCalculator.estimate(currentInLbs, current.reps || 0);
            return current1RM > best1RM ? current : best;
          }, ex.completedSets[0]);

          // Calculate volume in user's preferred unit
          volume = ex.completedSets.reduce((sum, set) => {
            const setUnit = set.unit || 'lbs';
            const weightInPreferredUnit = convertWeight(set.weight || 0, setUnit, weightUnit);
            return sum + weightInPreferredUnit * (set.reps || 0);
          }, 0);

          // Compare best set 1RM to exercise stats (use estimated1RM for consistency)
          const exerciseStat = exerciseStats.find(s => s.id === ex.id);
          const bestSetUnit = bestSet.unit || 'lbs';
          const bestSetInLbs = convertWeight(bestSet.weight || 0, bestSetUnit, 'lbs');
          const bestSet1RM = OneRMCalculator.estimate(bestSetInLbs, bestSet.reps || 0);
          isPR = exerciseStat ? bestSet1RM >= exerciseStat.estimated1RM : false;
        }

        exercises.push({ name, sets, isPR, volume });
      }
    });

    return exercises.sort((a, b) => b.volume - a.volume);
  };

  const exercises = getWorkoutExercises();
  const statsLine = formatWorkoutStatsLine(workoutStats, { unit: weightUnit });

  return (
    <TouchableOpacity
      style={[styles.workoutCard, { borderColor: currentTheme.colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={[styles.workoutHeader, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.workoutTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
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
