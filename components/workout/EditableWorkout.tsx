// The structured workout — the editable source of truth, styled like a flat
// notes page (no boxed cards, just sections and hairline-separated rows).
// Logging is check-off-first: tap the circle to mark a set done (the row goes
// green) rather than deleting. Removal is available but de-emphasized via
// long-press, so the common path stays frictionless.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCompact } from '@/lib/gamification/careerStats';
import playHapticFeedback from '@/lib/utils/haptic';
import { DraftExercise, DraftSet, WorkoutDraft, totalSets, totalVolume } from '@/lib/workout/workoutDraft';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View as RNView } from 'react-native';

const DONE_GREEN = '#34C759';

interface EditableWorkoutProps {
  draft: WorkoutDraft;
  weightUnit: WeightUnit;
  onEditSet: (key: string, index: number, patch: Partial<DraftSet>) => void;
  onAddSet: (key: string) => void;
  onRemoveSet: (key: string, index: number) => void;
  onToggleDone: (key: string, index: number) => void;
  onRemoveExercise: (key: string) => void;
  onAcceptAutofill: (key: string) => void;
  onDismissAutofill: (key: string) => void;
}

function setSummary(sets: DraftSet[], unit: WeightUnit): string {
  return sets.map(s => (s.weight > 0 ? `${s.weight}${unit}×${s.reps}` : `×${s.reps}`)).join(', ');
}

// A flat, underlined numeric field — commits on blur so mid-edit values don't
// fight the controlled value.
function NumberField({ value, suffix, onCommit, theme }: {
  value: number;
  suffix?: string;
  onCommit: (n: number) => void;
  theme: ReturnType<typeof useTheme>['currentTheme'];
}) {
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => setText(String(value)), [value]);
  return (
    <RNView style={[styles.field, { borderBottomColor: theme.colors.border }]}>
      <TextInput
        style={[styles.fieldInput, { color: theme.colors.text, fontFamily: theme.fonts.semiBold }]}
        value={text}
        onChangeText={setText}
        onBlur={() => {
          const n = parseFloat(text);
          onCommit(Number.isFinite(n) ? n : 0);
        }}
        keyboardType="numeric"
        selectTextOnFocus
        returnKeyType="done"
      />
      {!!suffix && <Text style={[styles.fieldSuffix, { color: theme.colors.text + '66', fontFamily: theme.fonts.regular }]}>{suffix}</Text>}
    </RNView>
  );
}

function ExerciseSection({ exercise, weightUnit, onEditSet, onAddSet, onRemoveSet, onToggleDone, onRemoveExercise, onAcceptAutofill, onDismissAutofill }: {
  exercise: DraftExercise;
} & Omit<EditableWorkoutProps, 'draft' | 'weightUnit'> & { weightUnit: WeightUnit }) {
  const { currentTheme } = useTheme();
  return (
    <RNView style={styles.section}>
      <TouchableOpacity
        style={styles.sectionHeader}
        activeOpacity={0.6}
        onLongPress={() => {
          playHapticFeedback('medium', false);
          onRemoveExercise(exercise.key);
        }}
      >
        {exercise.recognized && (
          <Ionicons name="checkmark-circle" size={15} color={currentTheme.colors.primary} style={{ marginRight: 6 }} />
        )}
        <Text style={[styles.exName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]} numberOfLines={1}>
          {exercise.name || 'Unnamed exercise'}
        </Text>
      </TouchableOpacity>

      {exercise.suggestion && exercise.sets.length === 0 ? (
        /* Algorithmic autofill: offer last time's sets in one tap */
        <RNView style={styles.autofill}>
          <RNView style={styles.autofillText}>
            <Text style={[styles.autofillLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>Last time</Text>
            <Text style={[styles.autofillSets, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]} numberOfLines={1}>
              {setSummary(exercise.suggestion, weightUnit)}
            </Text>
          </RNView>
          <TouchableOpacity
            style={[styles.autofillBtn, { backgroundColor: currentTheme.colors.primary }]}
            onPress={() => {
              playHapticFeedback('medium', false);
              onAcceptAutofill(exercise.key);
            }}
          >
            <Text style={[styles.autofillBtnText, { fontFamily: currentTheme.fonts.semiBold }]}>Autofill</Text>
          </TouchableOpacity>
          <TouchableOpacity hitSlop={8} onPress={() => { playHapticFeedback('light', false); onDismissAutofill(exercise.key); }}>
            <Ionicons name="close" size={18} color={currentTheme.colors.text + '40'} />
          </TouchableOpacity>
        </RNView>
      ) : (
        <>
          {exercise.sets.map((set, i) => (
            <TouchableOpacity
              key={i}
              activeOpacity={1}
              onLongPress={() => { playHapticFeedback('medium', false); onRemoveSet(exercise.key, i); }}
              style={[
                styles.setRow,
                { borderTopColor: currentTheme.colors.border + '60' },
                set.done && { backgroundColor: DONE_GREEN + '1A' },
              ]}
            >
              <TouchableOpacity
                hitSlop={8}
                onPress={() => { playHapticFeedback('light', false); onToggleDone(exercise.key, i); }}
              >
                <Ionicons
                  name={set.done ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={set.done ? DONE_GREEN : currentTheme.colors.text + '33'}
                />
              </TouchableOpacity>
              <Text style={[styles.setIndex, { color: currentTheme.colors.text + '66', fontFamily: currentTheme.fonts.regular }]}>{i + 1}</Text>
              <RNView style={styles.fields}>
                <NumberField value={set.weight} suffix={weightUnit} theme={currentTheme} onCommit={n => onEditSet(exercise.key, i, { weight: n })} />
                <Text style={[styles.times, { color: currentTheme.colors.text + '55' }]}>×</Text>
                <NumberField value={set.reps} suffix="reps" theme={currentTheme} onCommit={n => onEditSet(exercise.key, i, { reps: n })} />
              </RNView>
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.addSet} onPress={() => { playHapticFeedback('light', false); onAddSet(exercise.key); }}>
            <Ionicons name="add" size={15} color={currentTheme.colors.primary} />
            <Text style={[styles.addSetText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>Add set</Text>
          </TouchableOpacity>
        </>
      )}
    </RNView>
  );
}

export default function EditableWorkout({ draft, weightUnit, onEditSet, onAddSet, onRemoveSet, onToggleDone, onRemoveExercise, onAcceptAutofill, onDismissAutofill }: EditableWorkoutProps) {
  const { currentTheme } = useTheme();
  if (draft.length === 0) return null;

  const sets = totalSets(draft);
  const volume = totalVolume(draft);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
      <Text style={[styles.summary, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.medium }]}>
        {draft.length} {draft.length === 1 ? 'exercise' : 'exercises'} · {sets} {sets === 1 ? 'set' : 'sets'}
        {volume > 0 ? ` · ${formatCompact(volume)} ${weightUnit}` : ''}
      </Text>

      {draft.map(ex => (
        <ExerciseSection
          key={ex.key}
          exercise={ex}
          weightUnit={weightUnit}
          onEditSet={onEditSet}
          onAddSet={onAddSet}
          onRemoveSet={onRemoveSet}
          onToggleDone={onToggleDone}
          onRemoveExercise={onRemoveExercise}
          onAcceptAutofill={onAcceptAutofill}
          onDismissAutofill={onDismissAutofill}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  summary: { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', paddingBottom: 12 },
  section: { marginBottom: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  exName: { fontSize: 17, flex: 1 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 6,
    marginHorizontal: -6,
    borderRadius: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setIndex: { fontSize: 13, width: 12 },
  fields: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  field: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 1, paddingBottom: 2, minWidth: 52 },
  fieldInput: { fontSize: 16, minWidth: 28, padding: 0 },
  fieldSuffix: { fontSize: 11, paddingBottom: 2 },
  times: { fontSize: 15 },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10 },
  addSetText: { fontSize: 13 },
  autofill: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  autofillText: { flex: 1 },
  autofillLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
  autofillSets: { fontSize: 14, marginTop: 1 },
  autofillBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  autofillBtnText: { color: '#fff', fontSize: 13 },
});
