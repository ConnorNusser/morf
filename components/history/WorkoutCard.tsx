import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getWorkoutByIdWithCustom } from '@/lib/workouts';
import { convertWeight, CustomExercise, GeneratedWorkout, WeightUnit } from '@/types';
import React from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface ExerciseWithMax {
  id: string;
  name: string;
  maxWeight: number;
  maxReps: number;
  estimated1RM: number;
  isCustom: boolean;
  lastUsed?: Date;
  history: { weight: number; reps: number; date: Date; unit: WeightUnit }[];
}

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

  const getWorkoutStats = () => {
    let totalSets = 0;
    let totalVolume = 0;
    workout.exercises.forEach(ex => {
      ex.completedSets?.forEach(set => {
        totalSets++;
        // Convert weight to user's preferred unit before calculating volume
        // Default to 'lbs' for legacy data without unit field
        const setUnit = set.unit || 'lbs';
        const weightInPreferredUnit = convertWeight(set.weight, setUnit, weightUnit);
        totalVolume += weightInPreferredUnit * set.reps;
      });
    });
    return { totalSets, totalVolume: Math.round(totalVolume) };
  };

  const getWorkoutExercises = (): { name: string; sets: string[]; isPR: boolean }[] => {
    const exercises: { name: string; sets: string[]; isPR: boolean; volume: number }[] = [];

    workout.exercises.forEach(ex => {
      const exerciseInfo = getWorkoutByIdWithCustom(ex.id, customExercises);
      const name = exerciseInfo?.name || ex.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];

      if (ex.completedSets && ex.completedSets.length > 0) {
        // Convert weights to user's preferred unit for display
        // Default to 'lbs' for legacy data without unit field
        const sets = ex.completedSets.map(set => {
          const setUnit = set.unit || 'lbs';
          const displayWeight = Math.round(convertWeight(set.weight, setUnit, weightUnit));
          return `${displayWeight}×${set.reps}`;
        });

        // Find best set by converting to same unit for comparison
        const bestSet = ex.completedSets.reduce((best, current) => {
          const bestUnit = best.unit || 'lbs';
          const currentUnit = current.unit || 'lbs';
          const bestInLbs = convertWeight(best.weight, bestUnit, 'lbs');
          const currentInLbs = convertWeight(current.weight, currentUnit, 'lbs');
          return currentInLbs > bestInLbs ? current : best;
        }, ex.completedSets[0]);

        // Calculate volume in user's preferred unit
        const volume = ex.completedSets.reduce((sum, set) => {
          const setUnit = set.unit || 'lbs';
          const weightInPreferredUnit = convertWeight(set.weight, setUnit, weightUnit);
          return sum + weightInPreferredUnit * set.reps;
        }, 0);

        // Compare best set to exercise stats (stats are in lbs)
        const exerciseStat = exerciseStats.find(s => s.id === ex.id);
        const bestSetUnit = bestSet.unit || 'lbs';
        const bestSetInLbs = convertWeight(bestSet.weight, bestSetUnit, 'lbs');
        const isPR = exerciseStat ? bestSetInLbs >= exerciseStat.maxWeight : false;

        exercises.push({ name, sets, isPR, volume });
      }
    });

    return exercises.sort((a, b) => b.volume - a.volume);
  };

  const stats = getWorkoutStats();
  const exercises = getWorkoutExercises();

  return (
    <TouchableOpacity
      style={[styles.workoutCard, { borderColor: currentTheme.colors.border }]}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={[styles.workoutHeader, { backgroundColor: 'transparent' }]}>
        <Text style={[styles.workoutTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
          {workout.title}
        </Text>
        <Text style={[styles.workoutMeta, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
          {formatRelativeDate(workout.createdAt)} • {stats.totalSets} sets • {stats.totalVolume > 1000 ? `${(stats.totalVolume / 1000).toFixed(1)}k` : stats.totalVolume} {weightUnit}
        </Text>
      </View>

      {/* Exercise list */}
      {exercises.length > 0 && (
        <View style={styles.exercisesList}>
          {exercises.map((ex, idx) => (
            <RNView key={idx} style={[styles.exerciseRow, { backgroundColor: currentTheme.colors.surface }]}>
              <RNView style={styles.exerciseContent}>
                <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                  {ex.name}
                </Text>
                <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_400Regular' }]}>
                  {ex.sets.join(' · ')}
                </Text>
              </RNView>
              {ex.isPR && (
                <RNView style={[styles.prChip, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                  <Text style={[styles.prChipText, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
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
