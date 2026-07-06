import { useTheme } from '@/contexts/ThemeContext';
import { CalculatedRoutine } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
  routine: CalculatedRoutine;
  splitLabel?: string | null;
  onStart: () => void;
}

// Full read-only overview of today's session — every exercise and its target
// sets. Opened from the "+N more" link on the Today card.
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
              <Text style={[styles.title, { color: currentTheme.colors.text, fontWeight: '700' }]}>
                {routine.name}
              </Text>
              <Text style={[styles.subtitle, { color: currentTheme.colors.text }]}>
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
                  <Text
                    style={[styles.exerciseName, { color: currentTheme.colors.text, fontWeight: '600' }]}
                  >
                    {ex.exerciseName}
                  </Text>
                </View>

                {ex.sets.map((set, si) => (
                  <View key={si} style={styles.setRow}>
                    <Text style={[styles.setLabel, { color: currentTheme.colors.text }]}>
                      {set.isWarmup ? 'Warmup' : `Set ${ex.sets.slice(0, si + 1).filter(s => !s.isWarmup).length}`}
                    </Text>
                    <Text style={[styles.setValue, { color: currentTheme.colors.text }]}>
                      {set.targetWeight > 0 ? `${set.targetWeight} ${ex.unit}` : 'Bodyweight'} × {set.reps}
                    </Text>
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 12 }} />
          </ScrollView>

          <TouchableOpacity
            style={[styles.startButton, { backgroundColor: currentTheme.colors.primary }]}
            onPress={onStart}
            activeOpacity={0.85}
          >
            <Text style={[styles.startText, { color: currentTheme.colors.surface, fontWeight: '600' }]}>
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
    padding: 20,
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 22,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  scroll: {
    flexGrow: 0,
  },
  exerciseBlock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 14,
  },
  exerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 16,
    flexShrink: 1,
  },
  setRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  setLabel: {
    fontSize: 14,
    opacity: 0.55,
  },
  setValue: {
    fontSize: 15,
  },
  startButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  startText: {
    fontSize: 16,
  },
});
