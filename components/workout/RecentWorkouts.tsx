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

export default function RecentWorkouts({ workouts, customExercises, onPick }: RecentWorkoutsProps) {
  const { currentTheme } = useTheme();
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="always">
      <Text style={[styles.title, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 10 },
  title: { fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, paddingBottom: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowText: { flex: 1, gap: 2 },
  date: { fontSize: 15 },
  summary: { fontSize: 13 },
});
