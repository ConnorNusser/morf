import { useAlert } from '@/components/CustomAlert';
import { Text, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { calculateWorkoutStats, formatMinutes, formatSet, formatWorkoutStatsLine } from '@/lib/utils/utils';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { prExerciseIdsForWorkout } from '@/components/history/prSessions';
import { getExercise } from '@/lib/workout/workouts';
import { convertWeight, GeneratedWorkout, TrackingType, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useMemo, useState } from 'react';
import {
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
  // Per-exercise set of day-keys that set a new all-time best (buildPRDays), shared
  // with WorkoutCard so the modal's PR badges match the card's chips exactly.
  prDays: Map<string, Set<string>>;
  onClose: () => void;
  onDelete: (workout: GeneratedWorkout) => void;
}

// Display name for an exercise: the catalog/custom name, else a readable form of its id.
const getExerciseName = (id: string, info?: { name?: string } | null): string =>
  info?.name || id.replace('custom_', '').replace(/-/g, ' ').split('_')[0];

export default function WorkoutDetailModal({
  workout,
  weightUnit,
  prDays,
  onClose,
  onDelete,
}: WorkoutDetailModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { showAlert } = useAlert();
  const [copied, setCopied] = useState(false);

  // Convert workout to copyable text format
  const workoutAsText = useMemo(() => {
    if (!workout) return '';

    const lines: string[] = [];

    workout.exercises.forEach(exercise => {
      const exerciseInfo = getExercise(exercise.id);
      const name = getExerciseName(exercise.id, exerciseInfo);

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
  }, [workout, weightUnit]);

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
    showAlert({
      title: 'Delete Workout',
      message: `Are you sure you want to delete "${workout.title}"? This cannot be undone.`,
      type: 'confirm',
      buttons: [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(workout),
        },
      ],
    });
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

  // Detect PRs — reuse the ONE ratcheted PR definition (buildPRDays, threaded in as
  // prDays and evaluated via prExerciseIdsForWorkout) instead of a divergent inline
  // heuristic. A PR is a training day that set a new all-time best; this makes the
  // modal's badge set identical to WorkoutCard's chips by construction. The old code
  // compared each set's e1RM to the ALL-TIME max with `>=`, which only ever badged the
  // single record-holding workout and false-fired on any repeat-peak day.
  const prs = useMemo(() => {
    if (!workout) return [] as { id: string; name: string }[];
    const prIds = prExerciseIdsForWorkout(workout, prDays);
    return workout.exercises
      .filter(ex => prIds.has(ex.id) && !!ex.completedSets && ex.completedSets.length > 0)
      .map(ex => ({
        id: ex.id,
        name: getExerciseName(ex.id, getExercise(ex.id)),
      }));
  }, [workout, prDays]);

  // Helper to get tracking type for an exercise
  const getTrackingType = useCallback((exerciseId: string): TrackingType | undefined => {
    const exerciseInfo = getExercise(exerciseId);
    return exerciseInfo?.trackingType;
  }, []);

  // Calculate stats using the universal utility
  const workoutStats = useMemo(() => {
    if (!workout) return { totalSets: 0, totalVolumeLbs: 0, totalDistanceMeters: 0, totalCardioDurationSeconds: 0, hasWeightedExercises: false, hasCardioExercises: false };
    return calculateWorkoutStats(workout.exercises, getTrackingType);
  }, [workout, getTrackingType]);

  // Format the summary stats line
  const statsLine = useMemo(() => {
    return formatWorkoutStatsLine(workoutStats, { unit: weightUnit, includeExerciseCount: workout?.exercises.length });
  }, [workoutStats, weightUnit, workout?.exercises.length]);

  return (
    <Modal visible={!!workout} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCopy}
            style={[styles.headerButton, { backgroundColor: copied ? tint(currentTheme.colors.primary) : currentTheme.colors.surface }]}
          >
            <Ionicons
              name={copied ? "checkmark" : "copy-outline"}
              size={20}
              color={copied ? currentTheme.colors.primary : currentTheme.colors.text}
            />
          </TouchableOpacity>
          <Text variant="title" tone="primary" weight="semiBold" style={styles.headerTitle}>
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
                <Text variant="screenTitle" tone="primary" weight="bold" style={styles.title}>
                  {workout.title}
                </Text>
                <Text variant="body" tone="secondary" style={styles.date}>
                  {formatFullDate(workout.createdAt)}
                </Text>
              </View>

              {/* PR Chips */}
              {prs.length > 0 && (
                <View style={styles.prSection}>
                  <View style={styles.prChipsRow}>
                    {prs.map(pr => (
                      <View key={pr.id} style={[styles.prChip, { backgroundColor: currentTheme.colors.primary }]}>
                        <Text variant="meta" weight="semiBold" style={styles.prChipText}>
                          {pr.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text variant="meta" tone="secondary" style={styles.prLabel}>
                    Personal Records
                  </Text>
                </View>
              )}

              {/* Summary stats - horizontal inline */}
              <View style={styles.summaryRow}>
                <Text variant="body" tone="secondary" style={styles.summaryText}>
                  {workout.estimatedDuration > 0 ? `${formatMinutes(workout.estimatedDuration)} · ` : ''}{statsLine}
                </Text>
              </View>

              {/* Exercise List - Clean table style */}
              <View style={styles.exerciseList}>
                {workout.exercises.map((exercise, idx) => {
                  const exerciseInfo = getExercise(exercise.id);
                  const name = getExerciseName(exercise.id, exerciseInfo);
                  const trackingType = exerciseInfo?.trackingType || 'reps';
                  const isRepsExercise = trackingType === 'reps';
                  const bestE1RM = isRepsExercise ? getBestE1RM(exercise.completedSets || []) : null;
                  const isPR = prs.some(pr => pr.id === exercise.id);

                  return (
                    <View key={idx} style={[styles.exerciseRow, { borderBottomColor: currentTheme.colors.border }]}>
                      <View style={styles.exerciseHeader}>
                        <View style={styles.exerciseNameRow}>
                          <Text variant="body" tone="primary" weight="semiBold" style={styles.exerciseName}>
                            {name}
                          </Text>
                          {isPR && (
                            <View style={[styles.prBadge, { backgroundColor: tint(currentTheme.colors.primary) }]}>
                              <Text variant="meta" weight="semiBold">
                                PR
                              </Text>
                            </View>
                          )}
                        </View>
                        {bestE1RM && (
                          <Text variant="meta" tone="secondary" style={styles.exerciseBest}>
                            e1RM: {bestE1RM.e1rm} {weightUnit}
                          </Text>
                        )}
                      </View>
                      <View style={styles.setsGrid}>
                        {exercise.completedSets?.map((set, setIdx) => {
                          // Convert weight to user's preferred unit for reps-based exercises
                          const setUnit = set.unit || 'lbs';
                          const displayWeight = Math.round(convertWeight(set.weight, setUnit, weightUnit));

                          return (
                            <View key={setIdx} style={[styles.setPill, { backgroundColor: ink.ghost }]}>
                              <Text variant="body" tone="primary" weight="medium" style={styles.setPillText}>
                                {formatSet(
                                  { weight: displayWeight, reps: set.reps, unit: weightUnit, duration: set.duration, distance: set.distance },
                                  { trackingType, compact: true }
                                )}
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
                <Text variant="title" weight="semiBold" style={styles.deleteButtonText}>
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
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  headerTitle: {
    lineHeight: 24,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingBottom: space.xl,
  },
  hero: {
    marginBottom: space.sm,
  },
  title: {
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  date: {
    lineHeight: 22,
    marginTop: space.xs,
  },
  prSection: {
    marginBottom: space.section,
  },
  prChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    marginBottom: space.sm,
  },
  prChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  prChipText: {
    color: '#FFFFFF',
  },
  prLabel: {
    lineHeight: 19,
  },
  summaryRow: {
    marginBottom: 32,
  },
  summaryText: {
    lineHeight: 22,
  },
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space.md,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flex: 1,
  },
  exerciseName: {
    lineHeight: 22,
  },
  prBadge: {
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  exerciseBest: {
    lineHeight: 19,
  },
  setsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  setPill: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.badge,
  },
  setPillText: {
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.lg,
    borderRadius: radius.card,
  },
  deleteButtonText: {
    color: '#FFFFFF',
  },
});
