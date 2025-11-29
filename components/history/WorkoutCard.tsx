import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { getWorkoutById } from '@/lib/workouts';
import { GeneratedWorkout, WeightUnit } from '@/types';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

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
  onPress: () => void;
  onLongPress: () => void;
}

export default function WorkoutCard({
  workout,
  exerciseStats,
  weightUnit,
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
        totalVolume += set.weight * set.reps;
      });
    });
    return { totalSets, totalVolume };
  };

  const getWorkoutExercises = (): { name: string; sets: string[]; isPR: boolean }[] => {
    const exercises: { name: string; sets: string[]; isPR: boolean; volume: number }[] = [];

    workout.exercises.forEach(ex => {
      const exerciseInfo = getWorkoutById(ex.id);
      const name = exerciseInfo?.name || ex.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];

      if (ex.completedSets && ex.completedSets.length > 0) {
        const sets = ex.completedSets.map(set => `${set.weight}×${set.reps}`);

        const bestSet = ex.completedSets.reduce((best, current) => {
          return (current.weight > best.weight) ? current : best;
        }, ex.completedSets[0]);

        const volume = ex.completedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);

        const exerciseStat = exerciseStats.find(s => s.id === ex.id);
        const isPR = exerciseStat ? bestSet.weight >= exerciseStat.maxWeight : false;

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
            <View key={idx} style={[styles.exerciseRow, { backgroundColor: 'transparent' }]}>
              <View style={[styles.exerciseNameContainer, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.exerciseName, { color: currentTheme.colors.text + '90', fontFamily: 'Raleway_500Medium' }]}>
                  {ex.name}
                </Text>
                {ex.isPR && (
                  <View style={[styles.prBadge, { backgroundColor: currentTheme.colors.accent + '20' }]}>
                    <Text style={[styles.prText, { color: currentTheme.colors.accent, fontFamily: 'Raleway_600SemiBold' }]}>PR</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.exerciseSets, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                {ex.sets.join(' · ')}
              </Text>
            </View>
          ))}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  workoutCard: {
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  workoutHeader: {
    marginBottom: 12,
  },
  workoutTitle: {
    fontSize: 16,
    marginBottom: 4,
  },
  workoutMeta: {
    fontSize: 13,
  },
  exercisesList: {
    gap: 8,
  },
  exerciseRow: {},
  exerciseNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  exerciseName: {
    fontSize: 14,
  },
  exerciseSets: {
    fontSize: 13,
  },
  prBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  prText: {
    fontSize: 9,
  },
});
