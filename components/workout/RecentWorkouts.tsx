// Empty-state list of the last few workouts — tap one to load it into the draft
// and repeat/edit it. Replaces the single "repeat last workout" button.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getWorkoutByIdWithCustom } from '@/lib/workout/workouts';
import { CustomExercise, GeneratedWorkout } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface RecentWorkoutsProps {
  workouts: GeneratedWorkout[];
  customExercises: CustomExercise[];
  onPick: (w: GeneratedWorkout) => void;
  onQuickStart: () => void;
  onGenerate: () => void;
  onImport: () => void;
}

function dateLabel(value: Date | string): string {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function exerciseNames(w: GeneratedWorkout, custom: CustomExercise[]): string[] {
  return (w.exercises || []).map(e => getWorkoutByIdWithCustom(e.id, custom)?.name || e.id);
}

export default function RecentWorkouts({ workouts, customExercises, onPick, onQuickStart, onGenerate, onImport }: RecentWorkoutsProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator>
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

      <TouchableOpacity
        style={[styles.quickStart, { backgroundColor: colors.primary }]}
        activeOpacity={0.85}
        onPress={() => { playHapticFeedback('medium', false); onQuickStart(); }}
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={[styles.quickStartText, { fontFamily: currentTheme.fonts.semiBold }]}>Quick start — empty workout</Text>
      </TouchableOpacity>

      <Text style={[styles.title, { color: colors.text + '99', fontFamily: currentTheme.fonts.semiBold }]}>
        Recent workouts
      </Text>
      {/* One card that grows downward, rows split by hairlines */}
      <RNView style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {workouts.map((w, i) => (
          <TouchableOpacity
            key={w.id}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            activeOpacity={0.6}
            onPress={() => { playHapticFeedback('medium', false); onPick(w); }}
          >
            <RNView style={styles.rowText}>
              <Text style={[styles.date, { color: colors.text + '99' }]}>{dateLabel(w.createdAt)}</Text>
              {exerciseNames(w, customExercises).map((name, j) => (
                <Text key={j} style={[styles.exName, { color: colors.text }]} numberOfLines={1}>{name}</Text>
              ))}
              {exerciseNames(w, customExercises).length === 0 && (
                <Text style={[styles.exName, { color: colors.text }]}>Workout</Text>
              )}
            </RNView>
            <Ionicons name="repeat" size={18} color={colors.primary} />
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
  quickStart: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginBottom: 6,
  },
  quickStartText: { color: '#fff', fontSize: 15 },
  title: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 6, paddingBottom: 2 },
  card: { borderWidth: 1, borderRadius: 14, overflow: 'hidden' },
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
});
