// Empty-state list of the last few workouts — tap one to load it into the draft
// and repeat/edit it. Replaces the single "repeat last workout" button.
import StartButton from '@/components/home/StartButton';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkoutLaunch } from '@/contexts/WorkoutLaunchContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getExercise } from '@/lib/workout/workouts';
import { GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface RecentWorkoutsProps {
  workouts: GeneratedWorkout[];
  onPick: (w: GeneratedWorkout) => void;
  onQuickStart: () => void;
  onGenerate: () => void;
  onImport: () => void;
  // Collapse the composer when the list is scrolled (mirrors EditableWorkout).
  onScrollBeginDrag?: () => void;
}

function dateLabel(value: Date | string): string {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function exerciseNames(w: GeneratedWorkout): string[] {
  return (w.exercises || []).map(e => getExercise(e.id)?.name || e.id);
}

export default function RecentWorkouts({ workouts, onPick, onQuickStart, onGenerate, onImport, onScrollBeginDrag }: RecentWorkoutsProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const launch = useWorkoutLaunch();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator onScrollBeginDrag={onScrollBeginDrag}>
      {/* Generate / Import */}
      <RNView style={styles.actionRow}>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} activeOpacity={0.7} onPress={() => { playHapticFeedback('light', false); onGenerate(); }}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <Text style={[styles.secondaryText, { color: colors.text }]}>Generate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} activeOpacity={0.7} onPress={() => { playHapticFeedback('light', false); onImport(); }}>
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text style={[styles.secondaryText, { color: colors.text }]}>Import</Text>
        </TouchableOpacity>
      </RNView>

      <StartButton
        label="Quick start — empty workout"
        onPress={() => {
          playHapticFeedback('medium', false);
          launch({
            routineName: 'Empty Workout',
            subtitle: 'Freestyle — log as you go',
            onArrive: onQuickStart,
          });
        }}
        style={styles.quickStart}
      />

      <Text style={[styles.title, { color: colors.text + '99', fontFamily: currentTheme.fonts.semiBold }]}>
        Recent workouts
      </Text>
      {/* Flat list, rows split by faint hairlines (no card fill/border). */}
      <RNView style={styles.card}>
        {workouts.map((w, i) => (
          <TouchableOpacity
            key={w.id}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.text + '14' }]}
            activeOpacity={0.6}
            onPress={() => {
              playHapticFeedback('medium', false);
              launch({
                routineName: 'Repeat Workout',
                subtitle: `${exerciseNames(w).length || ''} ${exerciseNames(w).length === 1 ? 'exercise' : 'exercises'}`.trim(),
                onArrive: () => onPick(w),
              });
            }}
          >
            <RNView style={styles.rowText}>
              <Text style={[styles.date, { color: colors.text + '99' }]}>{dateLabel(w.createdAt)}</Text>
              {exerciseNames(w).map((name, j) => (
                <Text key={j} style={[styles.exName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
              ))}
              {exerciseNames(w).length === 0 && (
                <Text style={[styles.exName, { color: colors.text }]}>Workout</Text>
              )}
            </RNView>
            <RNView style={styles.rowAction}>
              <Text style={[styles.rowActionText, { color: colors.text + '99' }]}>Repeat</Text>
              <RNView style={[styles.rowChip, { backgroundColor: colors.text + '0D' }]}>
                <Ionicons name="arrow-forward" size={16} color={colors.text} />
              </RNView>
            </RNView>
          </TouchableOpacity>
        ))}
      </RNView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, gap: 8 },
  actionRow: { flexDirection: 'row', gap: 10 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderWidth: 1,
    borderRadius: 14,
  },
  secondaryText: { fontSize: 14 },
  quickStart: { marginBottom: 6 },
  title: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 6, paddingBottom: 2 },
  card: {},
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rowText: { flex: 1, gap: 3 },
  date: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  exName: { fontSize: 15 },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowActionText: { fontSize: 13, fontWeight: '600' },
  rowChip: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
});
