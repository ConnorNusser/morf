// The structured workout — the editable source of truth. Freeform text/voice
// from the composer is parsed and merged into this list; here the user edits it
// with traditional UI: tap weight/reps to change them, add or remove sets, and
// remove exercises. No freeform parsing happens on these edits.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import playHapticFeedback from '@/lib/utils/haptic';
import { DraftExercise, DraftSet, WorkoutDraft, totalSets, totalVolume } from '@/lib/workout/workoutDraft';
import { formatCompact } from '@/lib/gamification/careerStats';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View as RNView } from 'react-native';

interface EditableWorkoutProps {
  draft: WorkoutDraft;
  weightUnit: WeightUnit;
  onEditSet: (key: string, index: number, patch: Partial<DraftSet>) => void;
  onAddSet: (key: string) => void;
  onRemoveSet: (key: string, index: number) => void;
  onRemoveExercise: (key: string) => void;
  onAcceptAutofill: (key: string) => void;
  onDismissAutofill: (key: string) => void;
}

function setSummary(sets: DraftSet[], unit: WeightUnit): string {
  return sets
    .map(s => (s.weight > 0 ? `${s.weight}${unit}×${s.reps}` : `×${s.reps}`))
    .join(', ');
}

// A small numeric field that commits on blur so typing intermediate values
// (e.g. clearing to retype) doesn't fight the controlled value.
function NumberField({ value, suffix, onCommit, theme }: {
  value: number;
  suffix?: string;
  onCommit: (n: number) => void;
  theme: ReturnType<typeof useTheme>['currentTheme'];
}) {
  const [text, setText] = React.useState(String(value));
  React.useEffect(() => setText(String(value)), [value]);
  return (
    <RNView style={[styles.field, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
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

function ExerciseCard({ exercise, weightUnit, onEditSet, onAddSet, onRemoveSet, onRemoveExercise, onAcceptAutofill, onDismissAutofill }: {
  exercise: DraftExercise;
} & Omit<EditableWorkoutProps, 'draft' | 'weightUnit'> & { weightUnit: WeightUnit }) {
  const { currentTheme } = useTheme();
  return (
    <RNView style={[styles.card, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
      <RNView style={styles.cardHeader}>
        <Ionicons
          name={exercise.recognized ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={exercise.recognized ? currentTheme.colors.primary : currentTheme.colors.text + '40'}
        />
        <Text style={[styles.exName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]} numberOfLines={1}>
          {exercise.name || 'Unnamed exercise'}
        </Text>
        <TouchableOpacity
          hitSlop={8}
          onPress={() => {
            playHapticFeedback('light', false);
            onRemoveExercise(exercise.key);
          }}
        >
          <Ionicons name="trash-outline" size={16} color={currentTheme.colors.text + '55'} />
        </TouchableOpacity>
      </RNView>

      {exercise.suggestion && exercise.sets.length === 0 ? (
        /* Algorithmic autofill: offer last time's sets in one tap */
        <RNView style={[styles.autofill, { borderTopColor: currentTheme.colors.border + '80' }]}>
          <RNView style={styles.autofillText}>
            <Text style={[styles.autofillLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
              Last time
            </Text>
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
          <TouchableOpacity
            hitSlop={8}
            onPress={() => {
              playHapticFeedback('light', false);
              onDismissAutofill(exercise.key);
            }}
          >
            <Ionicons name="close" size={18} color={currentTheme.colors.text + '40'} />
          </TouchableOpacity>
        </RNView>
      ) : (
        <>
          {exercise.sets.map((set, i) => (
            <RNView key={i} style={[styles.setRow, { borderTopColor: currentTheme.colors.border + '80' }]}>
              <Text style={[styles.setLabel, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                Set {i + 1}
              </Text>
              <RNView style={styles.fields}>
                <NumberField
                  value={set.weight}
                  suffix={weightUnit}
                  theme={currentTheme}
                  onCommit={n => onEditSet(exercise.key, i, { weight: n })}
                />
                <Text style={[styles.times, { color: currentTheme.colors.text + '66' }]}>×</Text>
                <NumberField
                  value={set.reps}
                  suffix="reps"
                  theme={currentTheme}
                  onCommit={n => onEditSet(exercise.key, i, { reps: n })}
                />
              </RNView>
              <TouchableOpacity
                hitSlop={8}
                onPress={() => {
                  playHapticFeedback('light', false);
                  onRemoveSet(exercise.key, i);
                }}
              >
                <Ionicons name="close" size={16} color={currentTheme.colors.text + '40'} />
              </TouchableOpacity>
            </RNView>
          ))}

          <TouchableOpacity
            style={styles.addSet}
            onPress={() => {
              playHapticFeedback('light', false);
              onAddSet(exercise.key);
            }}
          >
            <Ionicons name="add" size={16} color={currentTheme.colors.primary} />
            <Text style={[styles.addSetText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>Add set</Text>
          </TouchableOpacity>
        </>
      )}
    </RNView>
  );
}

export default function EditableWorkout({ draft, weightUnit, onEditSet, onAddSet, onRemoveSet, onRemoveExercise, onAcceptAutofill, onDismissAutofill }: EditableWorkoutProps) {
  const { currentTheme } = useTheme();
  if (draft.length === 0) return null;

  const sets = totalSets(draft);
  const volume = totalVolume(draft);

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator
    >
      {/* Synthesized summary — live rollup of the workout */}
      <Text style={[styles.summary, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.medium }]}>
        {draft.length} {draft.length === 1 ? 'exercise' : 'exercises'} · {sets} {sets === 1 ? 'set' : 'sets'}
        {volume > 0 ? ` · ${formatCompact(volume)} ${weightUnit}` : ''}
      </Text>

      {draft.map(ex => (
        <ExerciseCard
          key={ex.key}
          exercise={ex}
          weightUnit={weightUnit}
          onEditSet={onEditSet}
          onAddSet={onAddSet}
          onRemoveSet={onRemoveSet}
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
  scrollContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24, gap: 10 },
  summary: { fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase', paddingHorizontal: 2, paddingBottom: 2 },
  autofill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  autofillText: { flex: 1 },
  autofillLabel: { fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3 },
  autofillSets: { fontSize: 14, marginTop: 1 },
  autofillBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16 },
  autofillBtnText: { color: '#fff', fontSize: 13 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 8 },
  exName: { fontSize: 16, flex: 1 },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  setLabel: { fontSize: 13, width: 44 },
  fields: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 64,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  fieldInput: { fontSize: 15, minWidth: 28, padding: 0 },
  fieldSuffix: { fontSize: 11 },
  times: { fontSize: 14 },
  addSet: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  addSetText: { fontSize: 13 },
});
