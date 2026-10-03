import { cardStyles } from '@/components/profile/userProfile/cardStyles';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { WorkoutSummary } from '@/lib/services/feedService';
import { formatRelativeTime, formatDurationWords } from '@/lib/ui/formatters';
import { space, radius, tint } from '@/lib/ui/tokens';
import { formatVolume} from '@/lib/utils/utils';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';

interface RecentWorkoutsCardProps {
  recentWorkouts: WorkoutSummary[];
  expandedWorkoutId: string | null;
  onToggleWorkout: (workoutId: string | null) => void;
}

/** The user's latest workouts; tapping a row expands its per-exercise best sets. */
export default function RecentWorkoutsCard({ recentWorkouts, expandedWorkoutId, onToggleWorkout }: RecentWorkoutsCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <View style={[cardStyles.card, { backgroundColor: currentTheme.colors.surface }]}>
      <Text variant="body" weight="semiBold" tone="primary">
        Recent Workouts
      </Text>
      <View style={styles.workoutsList}>
        {recentWorkouts.map((workout) => {
          const isExpanded = expandedWorkoutId === workout.id;
          return (
            <View key={workout.id}>
              <TouchableOpacity
                style={[
                  styles.workoutRowInteractive,
                  {
                    backgroundColor: currentTheme.colors.background,
                    borderColor: isExpanded ? currentTheme.colors.primary : currentTheme.colors.border,
                    borderWidth: isExpanded ? 1.5 : 1,
                  }
                ]}
                onPress={() => onToggleWorkout(isExpanded ? null : workout.id)}
                activeOpacity={0.7}
              >
                <View style={styles.workoutRowContent}>
                  <View style={styles.workoutRowTop}>
                    <Text variant="body" weight="semiBold" tone="primary" style={styles.workoutTitle}>
                      {workout.title}
                    </Text>
                    <Text variant="meta" weight="regular" tone="muted">
                      {formatRelativeTime(workout.created_at)}
                    </Text>
                  </View>
                  <Text variant="meta" weight="regular" tone="secondary">
                    {workout.exercise_count} exercises · {formatDurationWords(workout.duration_seconds)} · {formatVolume(workout.total_volume, 'lbs')}
                  </Text>
                </View>
                <View style={[styles.workoutChevron, { backgroundColor: isExpanded ? tint(currentTheme.colors.primary) : currentTheme.colors.border + '50' }]}>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={isExpanded ? currentTheme.colors.primary : ink.muted}
                  />
                </View>
              </TouchableOpacity>

              {isExpanded && workout.exercises && workout.exercises.length > 0 && (
                <View style={[
                  styles.workoutExercisesExpanded,
                  {
                    backgroundColor: currentTheme.colors.background,
                    borderColor: currentTheme.colors.primary,
                  }
                ]}>
                  {workout.exercises.map((exercise, exIndex) => (
                    <View
                      key={exIndex}
                      style={[
                        styles.workoutExerciseRow,
                        exIndex < workout.exercises.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: currentTheme.colors.border + '50',
                        }
                      ]}
                    >
                      <View style={styles.workoutExerciseLeft}>
                        <Text variant="meta" weight="medium" tone="primary">
                          {exercise.name}
                        </Text>
                        <Text variant="meta" weight="regular" tone="muted">
                          {exercise.sets} sets
                        </Text>
                      </View>
                      <View style={styles.workoutExerciseRight}>
                        <Text variant="meta" weight="semiBold" tone="secondary">
                          {exercise.bestSet}
                        </Text>
                        {exercise.isPR && (
                          <View style={[styles.prBadge, { backgroundColor: '#FFD700' }]}>
                            <Text variant="meta" weight="bold" style={styles.prBadgeText}>PR</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  workoutsList: {
    gap: space.sm,
  },
  workoutRowInteractive: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingLeft: space.lg,
    paddingRight: space.md,
    borderRadius: radius.card,
  },
  workoutRowContent: {
    flex: 1,
    gap: space.xs,
  },
  workoutRowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutTitle: {
    flex: 1,
  },
  workoutChevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: space.md,
  },
  workoutExercisesExpanded: {
    marginTop: -4,
    marginBottom: space.xs,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  workoutExerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.sm,
  },
  workoutExerciseLeft: {
    flex: 1,
    gap: space.xs,
  },
  workoutExerciseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  prBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  prBadgeText: {
    color: '#000',
  },
});
