// Cross-routine list of every exercise matching the active status filter.

import Chip from '@/components/Chip';
import { Text, useInk } from '@/components/Themed';
import ExerciseProgressRow from '@/components/workout/routineProgress/ExerciseProgressRow';
import { ExerciseStatus, RoutineProgress } from '@/lib/history/routineProgress';
import { radius, space } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, View } from 'react-native';

interface FilteredExerciseListProps {
  routineProgressList: RoutineProgress[];
  statusFilter: ExerciseStatus;
  weightUnit: string;
  expandedExerciseId: string | null;
  onToggleExercise: (exerciseId: string) => void;
  onClearFilter: () => void;
}

export default function FilteredExerciseList({
  routineProgressList,
  statusFilter,
  weightUnit,
  expandedExerciseId,
  onToggleExercise,
  onClearFilter,
}: FilteredExerciseListProps) {
  const ink = useInk();

  return (
    <>
    {/* Explicit way back to the full view; summary cards only deselect on exact re-tap. */}
    <View style={styles.filterBar}>
      <Text variant="meta" tone="secondary" weight="medium" style={styles.filterBarLabel}>
        Showing {statusFilter}
      </Text>
      <Chip
        label="Show all"
        size="small"
        onPress={onClearFilter}
      />
    </View>
    <View style={[styles.exerciseList, styles.filteredList, { borderColor: ink.ghost }]}>
      {routineProgressList.flatMap(routine =>
        routine.exercises
          .filter(e => e.status === statusFilter)
          .map(exercise => ({ ...exercise, routineName: routine.name, routineId: routine.id }))
      ).map((exercise, index) => (
        <ExerciseProgressRow
          key={exercise.exerciseId}
          exercise={exercise}
          index={index}
          weightUnit={weightUnit}
          isExpanded={expandedExerciseId === exercise.exerciseId}
          onToggle={onToggleExercise}
          showRoutineLabel
        />
      ))}
    </View>
    </>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  filterBarLabel: {
    textTransform: 'capitalize',
  },
  exerciseList: {
    marginTop: space.xs,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  filteredList: {
    borderWidth: 1,
    marginBottom: space.md,
  },
});
