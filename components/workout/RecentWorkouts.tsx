// Empty-state list of the last few workouts — tap one to load it into the draft
// and repeat/edit it. Replaces the single "repeat last workout" button.
import StartButton from '@/components/home/StartButton';
import { Text, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { useWorkoutLaunch } from '@/contexts/WorkoutLaunchContext';
import { radius, screenGutter, space, track } from '@/lib/ui/tokens';
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
  const ink = useInk();
  const launch = useWorkoutLaunch();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator onScrollBeginDrag={onScrollBeginDrag}>
      {/* Generate / Import — bordered secondary buttons (C2) */}
      <RNView style={styles.actionRow}>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} activeOpacity={0.7} onPress={() => { playHapticFeedback('light', false); onGenerate(); }}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
          <Text variant="meta" tone="primary" weight="semiBold">Generate</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} activeOpacity={0.7} onPress={() => { playHapticFeedback('light', false); onImport(); }}>
          <Ionicons name="download-outline" size={16} color={colors.primary} />
          <Text variant="meta" tone="primary" weight="semiBold">Import</Text>
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

      <SectionLabel style={styles.title}>Recent workouts</SectionLabel>
      {/* Flat list, rows split by faint hairlines (no card fill/border). */}
      <RNView>
        {workouts.map((w, i) => (
          <TouchableOpacity
            key={w.id}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ink.hairline }]}
            activeOpacity={0.6}
            onPress={() => {
              playHapticFeedback('medium', false);
              launch({
                routineName: 'Repeat Workout',
                exercises: exerciseNames(w),
                onArrive: () => onPick(w),
              });
            }}
          >
            <RNView style={styles.rowText}>
              <Text variant="meta" tone="secondary" style={styles.date}>{dateLabel(w.createdAt)}</Text>
              {exerciseNames(w).map((name, j) => (
                <Text key={j} variant="body" tone="primary" numberOfLines={1}>{name}</Text>
              ))}
              {exerciseNames(w).length === 0 && (
                <Text variant="body" tone="primary">Workout</Text>
              )}
            </RNView>
            <RNView style={styles.rowAction}>
              <Text variant="meta" tone="secondary" weight="semiBold">Repeat</Text>
              <Ionicons name="chevron-forward" size={16} color={ink.muted} />
            </RNView>
          </TouchableOpacity>
        ))}
      </RNView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: screenGutter, paddingTop: space.md, paddingBottom: space.section, gap: space.sm },
  actionRow: { flexDirection: 'row', gap: space.md },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 44,
    borderWidth: 1,
    borderRadius: radius.card,
  },
  quickStart: { marginBottom: space.sm },
  title: { paddingTop: space.sm, marginBottom: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
  },
  rowText: { flex: 1, gap: space.xs },
  date: { textTransform: 'uppercase', letterSpacing: track.caps, marginBottom: space.xs },
  rowAction: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
