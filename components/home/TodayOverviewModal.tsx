import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space } from '@/lib/ui/tokens';
import { CalculatedRoutine } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  routine: CalculatedRoutine;
  splitLabel?: string | null;
  onStart: () => void;
}

// Read-only overview of today's session — every exercise and its target sets.
export default function TodayOverviewModal({ visible, onClose, routine, splitLabel, onStart }: Props) {
  const { currentTheme } = useTheme();

  const totalSets = routine.exercises.reduce((sum, ex) => sum + ex.sets.length, 0);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={styles.backdropFill} activeOpacity={1} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: currentTheme.colors.background }]}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text variant="title" tone="primary" weight="semiBold">
                {routine.name}
              </Text>
              <Text variant="meta" tone="secondary" style={styles.subtitle}>
                {splitLabel ? `${splitLabel} · ` : ''}
                {routine.exercises.length} exercises · {totalSets} sets
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {routine.exercises.map((ex, i) => (
              <View
                key={`${ex.exerciseId}-${i}`}
                style={[styles.exerciseBlock, { borderTopColor: currentTheme.colors.border }]}
              >
                <View style={styles.exerciseHeader}>
                  <Text variant="emphasis" tone="primary" weight="semiBold" style={styles.exerciseName}>
                    {ex.exerciseName}
                  </Text>
                </View>

                {ex.sets.map((set, si) => (
                  <View key={si} style={styles.setRow}>
                    <Text variant="meta" tone="secondary">
                      {set.isWarmup ? 'Warmup' : `Set ${ex.sets.slice(0, si + 1).filter(s => !s.isWarmup).length}`}
                    </Text>
                    <Text variant="body" tone="primary">
                      {set.targetWeight > 0 ? `${set.targetWeight} ${ex.unit}` : 'Bodyweight'} × {set.reps}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: space.md }} />
          </ScrollView>

          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={onStart}
            activeOpacity={0.85}
          >
            <Text variant="title" weight="semiBold" style={{ color: currentTheme.colors.surface }}>
              Start workout
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#00000066',
    justifyContent: 'flex-end',
  },
  backdropFill: {
    flex: 1,
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.xl,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: space.sm,
  },
  headerText: {
    flex: 1,
    marginRight: space.md,
  },
  subtitle: {
    marginTop: space.xs,
  },
  scroll: {
    flexGrow: 0,
  },
  exerciseBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: space.lg,
    marginTop: space.lg,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  exerciseName: {
    flexShrink: 1,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  // Primary CTA: pill shape (C1).
  startButton: {
    paddingVertical: space.lg,
    borderRadius: radius.pill,
    alignItems: 'center',
    marginTop: space.lg,
  },
});
