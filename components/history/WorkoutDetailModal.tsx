import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/haptic';
import { OneRMCalculator } from '@/lib/strengthStandards';
import { getWorkoutByIdWithCustom } from '@/lib/workouts';
import { convertWeight, CustomExercise, ExerciseWithMax, GeneratedWorkout, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

interface WorkoutDetailModalProps {
  workout: GeneratedWorkout | null;
  weightUnit: WeightUnit;
  exerciseStats: ExerciseWithMax[];
  customExercises: CustomExercise[];
  onClose: () => void;
  onDelete: (workout: GeneratedWorkout) => void;
}

export default function WorkoutDetailModal({
  workout,
  weightUnit,
  exerciseStats,
  customExercises,
  onClose,
  onDelete,
}: WorkoutDetailModalProps) {
  const { currentTheme } = useTheme();
  const [copied, setCopied] = useState(false);

  // Convert workout to copyable text format
  const workoutAsText = useMemo(() => {
    if (!workout) return '';

    const lines: string[] = [];

    workout.exercises.forEach(exercise => {
      const exerciseInfo = getWorkoutByIdWithCustom(exercise.id, customExercises);
      const name = exerciseInfo?.name || exercise.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];

      if (exercise.completedSets && exercise.completedSets.length > 0) {
        // Group sets by weight for cleaner output
        const setsByWeight: Record<string, number[]> = {};
        exercise.completedSets.forEach(set => {
          const setUnit = set.unit || 'lbs';
          const displayWeight = Math.round(convertWeight(set.weight, setUnit, weightUnit));
          const key = `${displayWeight}`;
          if (!setsByWeight[key]) setsByWeight[key] = [];
          setsByWeight[key].push(set.reps);
        });

        // Format: "Bench Press 135x8, 135x8, 155x6" or "Bench Press 135x8x3" for same reps
        const setParts: string[] = [];
        Object.entries(setsByWeight).forEach(([weight, reps]) => {
          // Check if all reps are the same
          const allSameReps = reps.every(r => r === reps[0]);
          if (allSameReps && reps.length > 1) {
            setParts.push(`${weight}x${reps[0]}x${reps.length}`);
          } else {
            reps.forEach(r => setParts.push(`${weight}x${r}`));
          }
        });

        lines.push(`${name} ${setParts.join(', ')}`);
      }
    });

    return lines.join('\n');
  }, [workout, customExercises, weightUnit]);

  const handleCopy = useCallback(async () => {
    if (!workoutAsText) return;

    await Clipboard.setStringAsync(workoutAsText);
    playHapticFeedback('light', false);
    setCopied(true);

    // Reset after 2 seconds
    setTimeout(() => setCopied(false), 2000);
  }, [workoutAsText]);

  const formatFullDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const handleDelete = () => {
    if (!workout) return;
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workout.title}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(workout),
        },
      ]
    );
  };

  // Calculate estimated 1RM for a set
  const calculateE1RM = (weight: number, reps: number, unit: WeightUnit): number => {
    const weightInLbs = unit === 'kg' ? convertWeight(weight, 'kg', 'lbs') : weight;
    const e1rmInLbs = OneRMCalculator.estimate(weightInLbs, reps);
    return weightUnit === 'kg' ? Math.round(convertWeight(e1rmInLbs, 'lbs', 'kg')) : e1rmInLbs;
  };

  // Get best estimated 1RM from all sets
  const getBestE1RM = (sets: { weight: number; reps: number; unit?: WeightUnit }[]): { e1rm: number; weight: number; reps: number; unit: WeightUnit } | null => {
    if (!sets || sets.length === 0) return null;
    let best = { e1rm: 0, weight: 0, reps: 0, unit: 'lbs' as WeightUnit };
    sets.forEach(set => {
      // Default to 'lbs' for legacy data without unit field
      const setUnit = set.unit || 'lbs';
      const e1rm = calculateE1RM(set.weight, set.reps, setUnit);
      if (e1rm > best.e1rm) {
        best = { e1rm, weight: set.weight, reps: set.reps, unit: setUnit };
      }
    });
    return best.e1rm > 0 ? best : null;
  };

  // Detect PRs - compare workout's best e1rm to historical best
  const prs = useMemo(() => {
    if (!workout) return [];
    const prList: { name: string; e1rm: number }[] = [];

    workout.exercises.forEach(ex => {
      if (!ex.completedSets || ex.completedSets.length === 0) return;

      const exerciseInfo = getWorkoutByIdWithCustom(ex.id, customExercises);
      const name = exerciseInfo?.name || ex.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];
      const stat = exerciseStats.find(s => s.id === ex.id);

      // Get best e1rm from this workout
      const bestFromWorkout = getBestE1RM(ex.completedSets);
      if (!bestFromWorkout) return;

      // Compare to historical best (stat.estimated1RM is in user's preferred unit)
      if (stat) {
        // If workout's best e1rm >= historical best, it's a PR
        if (bestFromWorkout.e1rm >= stat.estimated1RM) {
          prList.push({ name, e1rm: bestFromWorkout.e1rm });
        }
      } else {
        // No history = this is their first time = PR
        prList.push({ name, e1rm: bestFromWorkout.e1rm });
      }
    });

    return prList;
  }, [workout, exerciseStats, customExercises]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!workout) return { sets: 0, volume: 0 };
    let sets = 0;
    let volume = 0;
    workout.exercises.forEach(ex => {
      ex.completedSets?.forEach(set => {
        sets++;
        // Convert weight to user's preferred unit before calculating volume
        // Default to 'lbs' for legacy data without unit field
        const setUnit = set.unit || 'lbs';
        const weightInPreferredUnit = convertWeight(set.weight, setUnit, weightUnit);
        volume += weightInPreferredUnit * set.reps;
      });
    });
    return { sets, volume: Math.round(volume) };
  }, [workout, weightUnit]);

  return (
    <Modal visible={!!workout} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCopy}
            style={[styles.headerButton, { backgroundColor: copied ? currentTheme.colors.primary + '20' : currentTheme.colors.surface }]}
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={20}
              color={copied ? currentTheme.colors.primary : currentTheme.colors.text}
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            Workout
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.headerButton, { backgroundColor: currentTheme.colors.surface }]}
          >
            <Ionicons name="close" size={20} color={currentTheme.colors.text} />
          </TouchableOpacity>
        </View>

        {workout && (
          <>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Hero section with title */}
              <View style={styles.hero}>
                <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: 'Raleway_700Bold' }]}>
                  {workout.title}
                </Text>
                <Text style={[styles.date, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_400Regular' }]}>
                  {formatFullDate(workout.createdAt)}
                </Text>
              </View>

              {/* PR Chips */}
              {prs.length > 0 && (
                <View style={styles.prSection}>
                  <View style={styles.prChipsRow}>
                    {prs.map((pr, idx) => (
                      <View key={idx} style={[styles.prChip, { backgroundColor: currentTheme.colors.primary }]}>
                        <Text style={[styles.prChipText, { fontFamily: 'Raleway_600SemiBold' }]}>
                          {pr.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.prLabel, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_400Regular' }]}>
                    Personal Records
                  </Text>
                </View>
              )}

              {/* Summary stats - horizontal inline */}
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryText, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_400Regular' }]}>
                  {workout.exercises.length} exercises · {stats.sets} sets · {stats.volume > 1000 ? `${(stats.volume / 1000).toFixed(1)}k` : stats.volume} {weightUnit}
                </Text>
              </View>

              {/* Exercise List - Clean table style */}
              <View style={styles.exerciseList}>
                {workout.exercises.map((exercise, idx) => {
                  const exerciseInfo = getWorkoutByIdWithCustom(exercise.id, customExercises);
                  const name = exerciseInfo?.name || exercise.id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];
                  const bestE1RM = getBestE1RM(exercise.completedSets || []);
                  const isPR = prs.some(pr => pr.name === name);

                  return (
                    <View key={idx} style={[styles.exerciseRow, { borderBottomColor: currentTheme.colors.border }]}>
                      <View style={styles.exerciseHeader}>
                        <View style={styles.exerciseNameRow}>
                          <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                            {name}
                          </Text>
                          {isPR && (
                            <View style={[styles.prBadge, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                              <Text style={[styles.prBadgeText, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
                                PR
                              </Text>
                            </View>
                          )}
                        </View>
                        {bestE1RM && (
                          <Text style={[styles.exerciseBest, { color: currentTheme.colors.text + '99', fontFamily: 'Raleway_400Regular' }]}>
                            e1RM: {bestE1RM.e1rm} {weightUnit}
                          </Text>
                        )}
                      </View>
                      <View style={styles.setsGrid}>
                        {exercise.completedSets?.map((set, setIdx) => {
                          // Convert weight to user's preferred unit
                          // Default to 'lbs' for legacy data without unit field
                          const setUnit = set.unit || 'lbs';
                          const displayWeight = Math.round(convertWeight(set.weight, setUnit, weightUnit));
                          return (
                            <View key={setIdx} style={styles.setPill}>
                              <Text style={[styles.setPillText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                                {displayWeight} x {set.reps}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            {/* Delete button at bottom */}
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleDelete}
                style={styles.deleteButton}
              >
                <Text style={[styles.deleteButtonText, { fontFamily: 'Raleway_600SemiBold' }]}>
                  Delete Workout
                </Text>
              </TouchableOpacity>
            </View>
          </>
        )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  hero: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  date: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 4,
  },
  prSection: {
    marginBottom: 24,
  },
  prChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  prChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  prChipText: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  prLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryRow: {
    marginBottom: 32,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    lineHeight: 22,
  },
  prBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prBadgeText: {
    fontSize: 10,
  },
  exerciseBest: {
    fontSize: 13,
    lineHeight: 18,
  },
  setsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  setPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  setPillText: {
    fontSize: 14,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
  },
  deleteButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
});
