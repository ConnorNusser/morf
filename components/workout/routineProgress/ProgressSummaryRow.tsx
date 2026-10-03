// Totals row: sessions plus the three tappable status-filter cards.

import { Text, useInk } from '@/components/Themed';
import { ExerciseStatus, RoutineProgressTotals } from '@/lib/history/routineProgress';
import { radius, space, tint, trend } from '@/lib/ui/tokens';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface ProgressSummaryRowProps {
  overallStats: RoutineProgressTotals;
  statusFilter: ExerciseStatus | null;
  onToggleFilter: (filter: ExerciseStatus) => void;
}

export default function ProgressSummaryRow({
  overallStats,
  statusFilter,
  onToggleFilter,
}: ProgressSummaryRowProps) {
  const ink = useInk();

  return (
    <View style={styles.summaryRow}>
      <View style={[styles.summaryCard, { borderColor: ink.ghost }]}>
        <Text variant="title" tone="primary" weight="semiBold">
          {overallStats.totalSessions}
        </Text>
        <Text variant="meta" tone="muted" style={styles.summaryLabel}>
          sessions
        </Text>
      </View>

      <TouchableOpacity
        style={[
          styles.summaryCard,
          {
            backgroundColor: statusFilter === 'improving' ? tint(trend.up) : 'transparent',
            borderColor: statusFilter === 'improving' ? trend.up : ink.ghost,
          },
        ]}
        onPress={() => onToggleFilter('improving')}
        activeOpacity={0.7}
      >
        <Text variant="title" weight="semiBold" style={{ color: trend.up }}>
          {overallStats.totalImproving}
        </Text>
        <Text variant="meta" tone="muted" style={styles.summaryLabel}>
          improving
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.summaryCard,
          {
            backgroundColor: statusFilter === 'stable' ? ink.hairline : 'transparent',
            borderColor: statusFilter === 'stable' ? ink.faint : ink.ghost,
          },
        ]}
        onPress={() => onToggleFilter('stable')}
        activeOpacity={0.7}
      >
        <Text variant="title" tone="muted" weight="semiBold">
          {overallStats.totalStable}
        </Text>
        <Text variant="meta" tone="muted" style={styles.summaryLabel}>
          stable
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.summaryCard,
          {
            backgroundColor: statusFilter === 'declining' ? tint(trend.down) : 'transparent',
            borderColor: statusFilter === 'declining' ? trend.down : ink.ghost,
          },
        ]}
        onPress={() => onToggleFilter('declining')}
        activeOpacity={0.7}
      >
        <Text variant="title" weight="semiBold" style={{ color: trend.down }}>
          {overallStats.totalDeclining}
        </Text>
        <Text variant="meta" tone="muted" style={styles.summaryLabel}>
          declining
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    gap: space.md,
    marginBottom: space.xl,
  },
  summaryCard: {
    flex: 1,
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.card,
    borderWidth: 1,
    alignItems: 'center',
  },
  summaryLabel: {
    marginTop: space.xs,
  },
});
