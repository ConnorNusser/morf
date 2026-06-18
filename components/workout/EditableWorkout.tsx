// The structured workout — the editable source of truth, styled as a flat,
// disciplined notes page: aligned columns, consistent chip/field controls, one
// green for "done" and one accent for actions. Check off a set (row goes green);
// a muted ✕ on each row removes it; a muted trash on each heading removes the
// exercise. Set-less exercises offer one-tap autofill from target and/or last time.
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
  onAcceptAutofill: (key: string, source: 'previous' | 'target') => void;
  onDismissAutofill: (key: string) => void;
}

function refSummary(set: DraftSet, unit: WeightUnit): string {
  return set.weight > 0 ? `${set.weight} ${unit} × ${set.reps}` : `${set.reps} reps`;
}

function setListSummary(sets: DraftSet[], unit: WeightUnit): string {
  return sets.map(s => (s.weight > 0 ? `${s.weight}×${s.reps}` : `×${s.reps}`)).join(', ');
}

// Flat underlined numeric field; commits on blur so mid-edit values don't fight
// the controlled value. Fixed width so columns line up across every row.
function NumberField({ value, suffix, onCommit, theme }: {
  value: number;
  suffix: string;
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
      <Text style={[styles.fieldSuffix, { color: theme.colors.text + '66', fontFamily: theme.fonts.regular }]}>{suffix}</Text>
    </RNView>
  );
}

function ExerciseSection({ exercise, weightUnit, onEditSet, onAddSet, onRemoveSet, onToggleDone, onRemoveExercise, onAcceptAutofill, onDismissAutofill }: {
  exercise: DraftExercise;
} & Omit<EditableWorkoutProps, 'draft' | 'weightUnit'> & { weightUnit: WeightUnit }) {
  const { currentTheme } = useTheme();
  const muted = currentTheme.colors.text + '40';
  const needsAutofill = exercise.sets.length === 0 && (exercise.target || exercise.previous);

  return (
    <RNView style={styles.section}>
      <RNView style={styles.sectionHeader}>
        {exercise.recognized && (
          <Ionicons name="ellipse" size={7} color={currentTheme.colors.primary} style={{ marginRight: 8 }} />
        )}
        <Text style={[styles.exName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]} numberOfLines={1}>
          {exercise.name || 'Unnamed exercise'}
        </Text>
        <TouchableOpacity hitSlop={8} onPress={() => { playHapticFeedback('light', false); onRemoveExercise(exercise.key); }}>
          <Ionicons name="trash-outline" size={17} color={muted} />
        </TouchableOpacity>
      </RNView>

      {needsAutofill ? (
        <RNView style={styles.autofill}>
          {exercise.target && (
            <Text style={[styles.refLine, { color: currentTheme.colors.text }]}>
              <Text style={{ color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }}>Target  </Text>
              <Text style={{ fontFamily: currentTheme.fonts.medium }}>{setListSummary(exercise.target, weightUnit)}</Text>
            </Text>
          )}
          {exercise.previous && (
            <Text style={[styles.refLine, { color: currentTheme.colors.text + 'AA', fontFamily: currentTheme.fonts.regular }]}>
              Last time  {setListSummary(exercise.previous, weightUnit)}
            </Text>
          )}
          <RNView style={styles.chipRow}>
            {exercise.target && (
              <TouchableOpacity style={[styles.chip, { backgroundColor: currentTheme.colors.primary }]} onPress={() => { playHapticFeedback('medium', false); onAcceptAutofill(exercise.key, 'target'); }}>
                <Text style={[styles.chipText, { color: '#fff', fontFamily: currentTheme.fonts.semiBold }]}>Use target</Text>
              </TouchableOpacity>
            )}
            {exercise.previous && (
              <TouchableOpacity style={[styles.chip, styles.chipOutline, { borderColor: currentTheme.colors.border }]} onPress={() => { playHapticFeedback('medium', false); onAcceptAutofill(exercise.key, 'previous'); }}>
                <Text style={[styles.chipText, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>Last time</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.chip, styles.chipOutline, { borderColor: currentTheme.colors.border }]} onPress={() => { playHapticFeedback('light', false); onDismissAutofill(exercise.key); }}>
              <Text style={[styles.chipText, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.medium }]}>Start empty</Text>
            </TouchableOpacity>
          </RNView>
        </RNView>
      ) : (
        <>
          {exercise.sets.map((set, i) => {
            const ghost = exercise.target?.[i] ?? exercise.previous?.[i];
            const ghostLabel = exercise.target?.[i] ? 'target' : 'last';
            return (
              <RNView key={i} style={[styles.setRow, set.done && { backgroundColor: DONE_GREEN + '14' }]}>
                <RNView style={styles.setMain}>
                  <TouchableOpacity hitSlop={6} onPress={() => { playHapticFeedback('light', false); onToggleDone(exercise.key, i); }}>
                    <Ionicons name={set.done ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={set.done ? DONE_GREEN : currentTheme.colors.text + '30'} />
                  </TouchableOpacity>
                  <NumberField value={set.weight} suffix={weightUnit} theme={currentTheme} onCommit={n => onEditSet(exercise.key, i, { weight: n })} />
                  <Text style={[styles.times, { color: currentTheme.colors.text + '55' }]}>×</Text>
                  <NumberField value={set.reps} suffix="reps" theme={currentTheme} onCommit={n => onEditSet(exercise.key, i, { reps: n })} />
                  <RNView style={{ flex: 1 }} />
                  <TouchableOpacity hitSlop={8} onPress={() => { playHapticFeedback('light', false); onRemoveSet(exercise.key, i); }}>
                    <Ionicons name="close" size={18} color={muted} />
                  </TouchableOpacity>
                </RNView>
                {ghost && (
                  <Text style={[styles.ghost, { color: currentTheme.colors.text + '55', fontFamily: currentTheme.fonts.regular }]}>
                    {ghostLabel} {refSummary(ghost, weightUnit)}
                  </Text>
                )}
              </RNView>
            );
          })}

          <TouchableOpacity style={styles.addSet} onPress={() => { playHapticFeedback('light', false); onAddSet(exercise.key); }}>
            <Ionicons name="add" size={16} color={currentTheme.colors.primary} />
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

      {draft.map((ex, i) => (
        <RNView key={ex.key} style={i > 0 ? [styles.divider, { borderTopColor: currentTheme.colors.border + '60' }] : undefined}>
          <ExerciseSection
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
        </RNView>
      ))}
    </ScrollView>
  );
}

// Column geometry shared so check / weight / × / reps line up on every row.
const CHECK = 22;
const FIELD_W = 64;

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: 'transparent' },
  scrollContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28 },
  summary: { fontSize: 11, letterSpacing: 0.5, textTransform: 'uppercase', paddingBottom: 14 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 18, marginTop: 18 },
  section: {},
  sectionHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 8 },
  exName: { fontSize: 17, flex: 1 },

  setRow: { borderRadius: 10, paddingVertical: 7, paddingHorizontal: 6, marginHorizontal: -6 },
  setMain: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  field: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, borderBottomWidth: 1, paddingBottom: 2, width: FIELD_W },
  fieldInput: { fontSize: 16, flex: 1, padding: 0 },
  fieldSuffix: { fontSize: 11, paddingBottom: 2 },
  times: { fontSize: 15, marginHorizontal: -4 },
  ghost: { fontSize: 12, marginLeft: CHECK + 12, marginTop: 2 },

  addSet: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10, marginLeft: 2 },
  addSetText: { fontSize: 13 },

  autofill: { gap: 8, paddingBottom: 4 },
  refLine: { fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  chipOutline: { borderWidth: 1, paddingVertical: 7 },
  chipText: { fontSize: 13 },
});
