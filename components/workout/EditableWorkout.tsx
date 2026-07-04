// The structured workout — the editable source of truth, styled like a flat
// notes page (no boxed cards, just sections and hairline-separated rows).
// Logging is check-off-first: tap the circle to mark a set done (the row goes
// green) rather than deleting. Removal is available but de-emphasized via
// long-press, so the common path stays frictionless.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCompact } from '@/lib/gamification/careerStats';
import playHapticFeedback from '@/lib/utils/haptic';
import { DraftExercise, WorkoutDraft, totalSets, totalVolume } from '@/lib/workout/workoutDraft';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

const DONE_GREEN = '#34C759';

interface EditableWorkoutProps {
  draft: WorkoutDraft;
  weightUnit: WeightUnit;
  onEditField: (key: string, index: number, field: 'weight' | 'reps') => void;
  activeField?: { key: string; index: number; field: 'weight' | 'reps' } | null;
  onAddSet: (key: string) => void;
  onRemoveSet: (key: string, index: number) => void;
  onToggleDone: (key: string, index: number) => void;
  onRemoveExercise: (key: string) => void;
  // Fired when the user starts dragging the list — used to collapse the composer.
  onScrollBeginDrag?: () => void;
}

// A flat, underlined value that opens the custom number pad on tap (no OS
// keyboard). The unit/reps label lives in the column header, not per cell.
function NumberField({ value, active, onPress, theme }: {
  value: number;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['currentTheme'];
}) {
  return (
    <TouchableOpacity
      style={[styles.field, { borderBottomColor: active ? theme.colors.primary : theme.colors.border, backgroundColor: active ? theme.colors.primary + '12' : 'transparent' }]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text style={[styles.fieldValue, { color: theme.colors.text }]}>{value}</Text>
    </TouchableOpacity>
  );
}

function ExerciseSection({ exercise, weightUnit, onEditField, activeField, onAddSet, onRemoveSet, onToggleDone, onRemoveExercise }: {
  exercise: DraftExercise;
} & Omit<EditableWorkoutProps, 'draft' | 'weightUnit'> & { weightUnit: WeightUnit }) {
  const { currentTheme } = useTheme();
  const text = currentTheme.colors.text;

  return (
    <RNView style={styles.section}>
      <TouchableOpacity
        activeOpacity={0.6}
        onLongPress={() => { playHapticFeedback('medium', false); onRemoveExercise(exercise.key); }}
      >
        <Text style={[styles.exName, { color: text, fontFamily: currentTheme.fonts.semiBold }]} numberOfLines={1}>
          {exercise.name || 'Unnamed exercise'}
        </Text>
      </TouchableOpacity>

      {/* Column header: check spacer · lbs · reps · (spacer) · remove spacer */}
      <RNView style={styles.colHeader}>
        <RNView style={styles.checkCol} />
        <Text style={[styles.colLabelCol, { color: text + '55' }]}>{weightUnit}</Text>
        <Text style={[styles.colLabelCol, { color: text + '55' }]}>reps</Text>
        <RNView style={{ flex: 1 }} />
        <RNView style={styles.removeCol} />
      </RNView>

      {exercise.sets.map((set, i) => {
            return (
              <RNView
                key={i}
                style={[styles.setRow, set.done && { backgroundColor: DONE_GREEN + '14' }]}
              >
                <TouchableOpacity
                  style={styles.checkCol}
                  hitSlop={6}
                  onPress={() => { playHapticFeedback('light', false); onToggleDone(exercise.key, i); }}
                >
                  <Ionicons name={set.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={set.done ? DONE_GREEN : text + '33'} />
                </TouchableOpacity>
                <NumberField
                  value={set.weight}
                  active={activeField?.key === exercise.key && activeField.index === i && activeField.field === 'weight'}
                  onPress={() => onEditField(exercise.key, i, 'weight')}
                  theme={currentTheme}
                />
                <NumberField
                  value={set.reps}
                  active={activeField?.key === exercise.key && activeField.index === i && activeField.field === 'reps'}
                  onPress={() => onEditField(exercise.key, i, 'reps')}
                  theme={currentTheme}
                />
                <RNView style={{ flex: 1 }} />
                <TouchableOpacity
                  hitSlop={8}
                  style={styles.removeCol}
                  onPress={() => { playHapticFeedback('light', false); onRemoveSet(exercise.key, i); }}
                >
                  <Ionicons name="close" size={17} color={text + '40'} />
                </TouchableOpacity>
              </RNView>
            );
          })}

          <TouchableOpacity style={styles.addSet} onPress={() => { playHapticFeedback('light', false); onAddSet(exercise.key); }}>
            <Ionicons name="add" size={15} color={currentTheme.colors.primary} />
            <Text style={[styles.addSetText, { color: currentTheme.colors.primary }]}>Add set</Text>
          </TouchableOpacity>
    </RNView>
  );
}

export default function EditableWorkout({ draft, weightUnit, onEditField, activeField, onAddSet, onRemoveSet, onToggleDone, onRemoveExercise, onScrollBeginDrag }: EditableWorkoutProps) {
  const { currentTheme } = useTheme();
  if (draft.length === 0) return null;

  const sets = totalSets(draft);
  const volume = totalVolume(draft);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={onScrollBeginDrag} showsVerticalScrollIndicator>
      <Text style={[styles.summary, { color: currentTheme.colors.text + '99' }]}>
        {draft.length} {draft.length === 1 ? 'exercise' : 'exercises'} · {sets} {sets === 1 ? 'set' : 'sets'}
        {volume > 0 ? ` · ${formatCompact(volume)} ${weightUnit}` : ''}
      </Text>

      {draft.map(ex => (
        <ExerciseSection
          key={ex.key}
          exercise={ex}
          weightUnit={weightUnit}
          onEditField={onEditField}
          activeField={activeField}
          onAddSet={onAddSet}
          onRemoveSet={onRemoveSet}
          onToggleDone={onToggleDone}
          onRemoveExercise={onRemoveExercise}
        />
      ))}
    </ScrollView>
  );
}

// Column geometry — fields + header labels share a width so they line up.
const FIELD_W = 60;
const REMOVE_W = 28;
const CHECK_W = 28;
const ROW_GAP = 10;

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  summary: { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', paddingBottom: 12 },
  section: { marginBottom: 22 },
  exName: { fontSize: 17, paddingBottom: 2 },

  colHeader: { flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, paddingBottom: 4 },
  checkCol: { width: CHECK_W, alignItems: 'center', justifyContent: 'center' },
  colLabelCol: { width: FIELD_W, textAlign: 'center', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
  removeCol: { width: REMOVE_W, alignItems: 'center' },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    paddingVertical: 9,
    paddingHorizontal: 6,
    marginHorizontal: -6,
    borderRadius: 8,
  },
  field: { width: FIELD_W, alignItems: 'center', borderBottomWidth: 1, borderRadius: 6, paddingVertical: 4 },
  fieldValue: { fontSize: 17 },

  addSet: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10 },
  addSetText: { fontSize: 13 },
});
