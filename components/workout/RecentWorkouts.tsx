// Empty-state list of the last few workouts — tap one to load it into the draft
// and repeat/edit it. Replaces the single "repeat last workout" button.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { getWorkoutByIdWithCustom } from '@/lib/workout/workouts';
import { CustomExercise, GeneratedWorkout, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

interface RecentWorkoutsProps {
  workouts: GeneratedWorkout[];
  customExercises: CustomExercise[];
  weightUnit: WeightUnit;
  onPick: (w: GeneratedWorkout) => void;
  onQuickStart: () => void;
  onGenerate: () => void;
  onImport: () => void;
  onSetUnit: (u: WeightUnit) => void;
}

function dateLabel(value: Date | string): string {
  const d = new Date(value);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function summarize(w: GeneratedWorkout, custom: CustomExercise[]): string {
  const names = (w.exercises || []).map(e => getWorkoutByIdWithCustom(e.id, custom)?.name || e.id);
  const shown = names.slice(0, 3).join(', ');
  const extra = names.length - Math.min(names.length, 3);
  return extra > 0 ? `${shown} +${extra}` : shown;
}

export default function RecentWorkouts({ workouts, customExercises, weightUnit, onPick, onQuickStart, onGenerate, onImport, onSetUnit }: RecentWorkoutsProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always" showsVerticalScrollIndicator>
      {/* Units toggle */}
      <RNView style={styles.topRow}>
        <RNView style={[styles.segment, { borderColor: colors.border }]}>
          {(['lbs', 'kg'] as const).map(u => (
            <TouchableOpacity
              key={u}
              style={[styles.segmentBtn, weightUnit === u && { backgroundColor: colors.primary }]}
              onPress={() => { playHapticFeedback('selection', false); onSetUnit(u); }}
            >
              <Text style={[styles.segmentText, { color: weightUnit === u ? '#fff' : colors.text + '99' }]}>{u}</Text>
            </TouchableOpacity>
          ))}
        </RNView>
      </RNView>

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

      <Text style={[styles.title, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.semiBold }]}>
        Recent workouts
      </Text>
      {workouts.map(w => (
        <TouchableOpacity
          key={w.id}
          style={[styles.row, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.surface }]}
          activeOpacity={0.7}
          onPress={() => { playHapticFeedback('medium', false); onPick(w); }}
        >
          <RNView style={styles.rowText}>
            <Text style={[styles.date, { color: currentTheme.colors.text }]}>{dateLabel(w.createdAt)}</Text>
            <Text style={[styles.summary, { color: currentTheme.colors.text + '99' }]} numberOfLines={1}>
              {summarize(w, customExercises) || 'Workout'}
            </Text>
          </RNView>
          <Ionicons name="repeat" size={18} color={currentTheme.colors.primary} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 8 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingBottom: 2 },
  segment: { flexDirection: 'row', borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: 16, paddingVertical: 6, minWidth: 48, alignItems: 'center' },
  segmentText: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.3 },
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
  title: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, paddingTop: 4, paddingBottom: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowText: { flex: 1, gap: 2 },
  date: { fontSize: 15 },
  summary: { fontSize: 13 },
});
