// One exercise row: status indicator, current weight + guidance, expandable weight chart.
// Shared by the filtered cross-routine list and each routine's expanded list.

import { Text, useInk } from '@/components/Themed';
import WeightHistoryChart from '@/components/workout/routineProgress/WeightHistoryChart';
import { useTheme } from '@/contexts/ThemeContext';
import { ExerciseProgress, ExerciseStatus, getStatusLabel } from '@/lib/history/routineProgress';
import { space, trend } from '@/lib/ui/tokens';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface ExerciseProgressRowProps {
  exercise: ExerciseProgress & { routineName?: string };
  index: number;
  weightUnit: string;
  isExpanded: boolean;
  onToggle: (exerciseId: string) => void;
  showRoutineLabel?: boolean;
  showNoData?: boolean;
}

const ProgressDots =({ filled, total = 3, color }: { filled: number, total?: number, color: string }) => {
  const { currentTheme } = useTheme();
  const colors = currentTheme.colors;

  return (
    <View style={styles.progressDots}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            {
              backgroundColor: i < filled ? color : colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
};

const StatusIndicator =({ status, repBonus }: { status: ExerciseStatus, repBonus: number }) => {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const colors = currentTheme.colors;

  if (status === 'improving') {
    return (
      <View style={styles.statusIndicator}>
        <ProgressDots filled={repBonus} color={trend.up} />
      </View>
    );
  }
  if (status === 'stable') {
    return (
      <View style={styles.statusIndicator}>
        <View style={[styles.statusDash, { backgroundColor: ink.faint }]} />
      </View>
    );
  }
  if (status === 'declining') {
    return (
      <View style={styles.statusIndicator}>
        <View style={[styles.statusDot, { backgroundColor: trend.down }]} />
      </View>
    );
  }
  return (
    <View style={styles.statusIndicator}>
      <View style={[styles.statusDot, { backgroundColor: colors.border }]} />
    </View>
  );
};

export default function ExerciseProgressRow({
  exercise,
  index,
  weightUnit,
  isExpanded,
  onToggle,
  showRoutineLabel,
  showNoData,
}: ExerciseProgressRowProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const colors = currentTheme.colors;

  const isExerciseExpanded = isExpanded;
  const weightGain = exercise.currentWeight - exercise.startWeight;
  const statusLabel = getStatusLabel(exercise);

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.exerciseRow,
          index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
        ]}
        onPress={() => exercise.weightHistory.length > 0 && onToggle(exercise.exerciseId)}
        activeOpacity={exercise.weightHistory.length > 0 ? 0.7 : 1}
      >
        <View style={styles.exerciseLeft}>
          <View style={styles.exerciseNameRow}>
            <StatusIndicator status={exercise.status} repBonus={exercise.repBonus} />
            {showRoutineLabel ? (
              <View>
                <Text variant="meta" tone="primary" weight="medium">
                  {exercise.name}
                </Text>
                <Text variant="meta" tone="faint" style={styles.routineLabel}>
                  {exercise.routineName}
                </Text>
              </View>
            ) : (
              <Text variant="meta" tone="primary" weight="medium">
                {exercise.name}
              </Text>
            )}
          </View>

          {exercise.status !== 'new' && (
            <View style={styles.exerciseDetail}>
              <Text variant="meta" tone="muted">
                {exercise.currentWeight} {weightUnit}
                {weightGain > 0 && (
                  <Text variant="meta" style={{ color: trend.up }}> (+{weightGain})</Text>
                )}
              </Text>
              {statusLabel && (
                // Engine deloads automatically now — this is just the label, no manual button.
                <Text
                  variant="meta"
                  weight="medium"
                  style={{ color: exercise.status === 'declining' ? trend.down : colors.primary }}
                >
                  {statusLabel}
                </Text>
              )}
            </View>
          )}

          {showNoData && exercise.status === 'new' && (
            <Text variant="meta" tone="faint" style={styles.noDataText}>
              No data yet
            </Text>
          )}
        </View>

        {exercise.weightHistory.length > 0 && (
          <Ionicons
            name={isExerciseExpanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={ink.faint}
          />
        )}
      </TouchableOpacity>

      {isExerciseExpanded && exercise.weightHistory.length > 0 && (
        <View style={[styles.chartWrapper, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
          <WeightHistoryChart data={exercise.weightHistory} unit={weightUnit} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  progressDots: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  statusIndicator: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDash: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  exerciseLeft: {
    flex: 1,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  routineLabel: {
    marginTop: space.xs,
  },
  exerciseDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.xs,
    marginLeft: 28,
  },
  noDataText: {
    marginTop: space.xs,
    marginLeft: 28,
  },

  chartWrapper: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
});
