// One routine: tappable header (badges, last session, trend bar) and its expandable exercise list.

import { Text, useInk } from '@/components/Themed';
import ExerciseProgressRow from '@/components/workout/routineProgress/ExerciseProgressRow';
import { RoutineProgress } from '@/lib/history/routineProgress';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { radius, space, tint, trend } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface RoutineProgressSectionProps {
  routine: RoutineProgress;
  isExpanded: boolean;
  onToggle: (routineId: string) => void;
  weightUnit: string;
  expandedExerciseId: string | null;
  onToggleExercise: (exerciseId: string) => void;
}

// Same vocabulary as the routines tab cards (formatRelativeDate).
const formatLastWorkout = (date: Date | null) => (date ? formatRelativeDate(date) : 'Never');

export default function RoutineProgressSection({
  routine,
  isExpanded,
  onToggle,
  weightUnit,
  expandedExerciseId,
  onToggleExercise,
}: RoutineProgressSectionProps) {
  const ink = useInk();

  return (
    <View style={styles.routineSection}>
      <TouchableOpacity
        style={styles.routineHeader}
        onPress={() => onToggle(routine.id)}
        activeOpacity={0.7}
      >
        <View style={styles.routineHeaderTop}>
          <Text variant="body" tone="primary" weight="semiBold" style={styles.routineName}>
            {routine.name}
          </Text>
          <View style={styles.headerBadges}>
            {routine.improving > 0 && (
              <View style={[styles.miniBadge, { backgroundColor: tint(trend.up) }]}>
                <Text variant="meta" weight="medium" style={{ color: trend.up }}>
                  {routine.improving} improving
                </Text>
              </View>
            )}
            {routine.declining > 0 && (
              <View style={[styles.miniBadge, { backgroundColor: tint(trend.down) }]}>
                <Text variant="meta" weight="medium" style={{ color: trend.down }}>
                  {routine.declining} declining
                </Text>
              </View>
            )}
            <Ionicons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={ink.faint}
            />
          </View>
        </View>

        <View style={styles.routineMeta}>
          <Text variant="meta" tone="faint">
            {routine.completions} sessions · Last: {formatLastWorkout(routine.lastWorkoutDate)}
          </Text>
        </View>

        {/* One segment per lift, colored by trend (matches the routines-screen momentum bar). */}
        {routine.exercises.length > 0 && (
          <View style={styles.distBar}>
            {routine.exercises.map((ex, i) => {
              const c = ex.status === 'improving' ? trend.up
                : ex.status === 'declining' ? trend.down
                : ex.status === 'stable' ? ink.faint
                : ink.ghost;
              return <View key={`${ex.exerciseId}-${i}`} style={[styles.distSeg, { backgroundColor: c }]} />;
            })}
          </View>
        )}
      </TouchableOpacity>

      {isExpanded && (
        <View style={[styles.exerciseList, { borderWidth: 1, borderColor: ink.ghost }]}>
          {routine.exercises.map((exercise, index) => (
            <ExerciseProgressRow
              key={exercise.exerciseId}
              exercise={exercise}
              index={index}
              weightUnit={weightUnit}
              isExpanded={expandedExerciseId === exercise.exerciseId}
              onToggle={onToggleExercise}
              showNoData
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  distBar: {
    flexDirection: 'row',
    gap: space.xs,
    marginTop: space.md,
  },
  distSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },

  routineSection: {
    marginBottom: space.md,
  },
  routineHeader: {
    padding: space.lg,
    borderRadius: radius.card,
  },
  routineHeaderTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineName: {
    flex: 1,
  },
  headerBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  miniBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
    gap: space.xs,
  },
  routineMeta: {
    marginTop: space.sm,
  },

  exerciseList: {
    marginTop: space.xs,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
});
