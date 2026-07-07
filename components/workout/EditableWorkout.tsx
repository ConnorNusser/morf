// Editable workout draft (source of truth); check-off-first logging, remove via long-press.
import { Text, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCompact } from '@/lib/gamification/careerStats';
import { radius, screenGutter, space, tint, track, trend } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import { DraftExercise, DraftSet, WorkoutDraft, totalSets, totalVolume } from '@/lib/workout/workoutDraft';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

const DONE_GREEN = trend.up;

interface EditableWorkoutProps {
  draft: WorkoutDraft;
  weightUnit: WeightUnit;
  onEditField: (key: string, index: number, field: 'weight' | 'reps') => void;
  activeField?: { key: string; index: number; field: 'weight' | 'reps' } | null;
  onAddSet: (key: string) => void;
  onRemoveSet: (key: string, index: number) => void;
  onToggleDone: (key: string, index: number) => void;
  onRemoveExercise: (key: string) => void;
  onMoveExercise?: (key: string, dir: -1 | 1) => void;
  getPreviousSets?: (exerciseId?: string) => DraftSet[] | null;
  onScrollBeginDrag?: () => void;
  // Bottom padding so the last row can scroll clear of the floating composer dock.
  bottomInset?: number;
}

function fmtPrev(set: DraftSet): string {
  const w = Number.isInteger(set.weight) ? String(set.weight) : String(parseFloat(set.weight.toFixed(2)));
  return set.weight > 0 ? `${w}×${set.reps}` : `${set.reps}`;
}

// Opens the custom number pad on tap (no OS keyboard); cell geometry is a named exception (spreadsheet grid).
function NumberField({ value, active, onPress, theme }: {
  value: number;
  active: boolean;
  onPress: () => void;
  theme: ReturnType<typeof useTheme>['currentTheme'];
}) {
  return (
    <TouchableOpacity
      style={[
        styles.field,
        { borderBottomColor: active ? theme.colors.primary : theme.colors.border },
        active && { backgroundColor: tint(theme.colors.primary) },
      ]}
      onPress={onPress}
      activeOpacity={0.6}
    >
      <Text variant="emphasis" tone="primary">{value}</Text>
    </TouchableOpacity>
  );
}

function ExerciseSection({ exercise, weightUnit, onEditField, activeField, onAddSet, onRemoveSet, onToggleDone, onRemoveExercise, onMoveExercise, previous, canMoveUp, canMoveDown }: {
  exercise: DraftExercise;
  previous: DraftSet[] | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
} & Omit<EditableWorkoutProps, 'draft' | 'weightUnit' | 'getPreviousSets'> & { weightUnit: WeightUnit }) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const hasPrev = !!previous && previous.length > 0;

  return (
    <RNView style={styles.section}>
      <RNView style={styles.exHeaderRow}>
        <TouchableOpacity
          style={styles.exNameTouch}
          activeOpacity={0.6}
          onLongPress={() => { playHapticFeedback('medium', false); onRemoveExercise(exercise.key); }}
        >
          <Text variant="emphasis" tone="primary" weight="semiBold" style={styles.exName} numberOfLines={1}>
            {exercise.name || 'Unnamed exercise'}
          </Text>
        </TouchableOpacity>

        {/* Reordering here also reorders the routine (offered on finish). */}
        {onMoveExercise && (
          <RNView style={styles.reorderCluster}>
            <TouchableOpacity
              hitSlop={8}
              disabled={!canMoveUp}
              onPress={() => { playHapticFeedback('light', false); onMoveExercise(exercise.key, -1); }}
            >
              <Ionicons name="chevron-up" size={18} color={canMoveUp ? ink.secondary : ink.ghost} />
            </TouchableOpacity>
            <TouchableOpacity
              hitSlop={8}
              disabled={!canMoveDown}
              onPress={() => { playHapticFeedback('light', false); onMoveExercise(exercise.key, 1); }}
            >
              <Ionicons name="chevron-down" size={18} color={canMoveDown ? ink.secondary : ink.ghost} />
            </TouchableOpacity>
          </RNView>
        )}
      </RNView>

      <RNView style={styles.colHeader}>
        <RNView style={styles.checkCol} />
        <Text variant="meta" tone="muted" style={styles.colLabelCol}>{weightUnit}</Text>
        <Text variant="meta" tone="muted" style={styles.colLabelCol}>reps</Text>
        <RNView style={styles.prevCol}>
          {hasPrev && <Text variant="meta" tone="muted" style={styles.prevHeaderLabel}>prev</Text>}
        </RNView>
        <RNView style={styles.removeCol} />
      </RNView>

      {exercise.sets.map((set, i) => {
            const prev = previous?.[i];
            return (
              <RNView
                key={i}
                style={[styles.setRow, set.done && { backgroundColor: tint(DONE_GREEN) }]}
              >
                <TouchableOpacity
                  style={styles.checkCol}
                  hitSlop={10}
                  onPress={() => { playHapticFeedback('light', false); onToggleDone(exercise.key, i); }}
                >
                  <Ionicons name={set.done ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={set.done ? DONE_GREEN : ink.ghost} />
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
                <RNView style={styles.prevCol}>
                  {prev && (
                    <Text variant="meta" tone="muted" numberOfLines={1}>{fmtPrev(prev)}</Text>
                  )}
                </RNView>
                <TouchableOpacity
                  hitSlop={8}
                  style={styles.removeCol}
                  onPress={() => { playHapticFeedback('light', false); onRemoveSet(exercise.key, i); }}
                >
                  <Ionicons name="close" size={17} color={ink.faint} />
                </TouchableOpacity>
              </RNView>
            );
          })}

          <TouchableOpacity style={styles.addSet} hitSlop={8} onPress={() => { playHapticFeedback('light', false); onAddSet(exercise.key); }}>
            <Ionicons name="add" size={15} color={currentTheme.colors.primary} />
            <Text variant="meta">Add set</Text>
          </TouchableOpacity>
    </RNView>
  );
}

export default function EditableWorkout({ draft, weightUnit, onEditField, activeField, onAddSet, onRemoveSet, onToggleDone, onRemoveExercise, onMoveExercise, getPreviousSets, onScrollBeginDrag, bottomInset }: EditableWorkoutProps) {
  if (draft.length === 0) return null;

  const sets = totalSets(draft);
  const volume = totalVolume(draft);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, bottomInset != null && { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={onScrollBeginDrag} showsVerticalScrollIndicator>
      <SectionLabel style={styles.summary}>
        {draft.length} {draft.length === 1 ? 'exercise' : 'exercises'} · {sets} {sets === 1 ? 'set' : 'sets'}
        {volume > 0 ? ` · ${formatCompact(volume)} ${weightUnit}` : ''}
      </SectionLabel>

      {draft.map((ex, i) => (
        <ExerciseSection
          key={ex.key}
          exercise={ex}
          previous={getPreviousSets?.(ex.exerciseId) ?? null}
          canMoveUp={i > 0}
          canMoveDown={i < draft.length - 1}
          weightUnit={weightUnit}
          onEditField={onEditField}
          activeField={activeField}
          onAddSet={onAddSet}
          onRemoveSet={onRemoveSet}
          onToggleDone={onToggleDone}
          onRemoveExercise={onRemoveExercise}
          onMoveExercise={draft.length > 1 ? onMoveExercise : undefined}
        />
      ))}
    </ScrollView>
  );
}

// Grid cell geometry — a named exception to the spacing tokens.
const FIELD_W = 60;
const REMOVE_W = 28;
const CHECK_W = 28;
const PREV_W = 62;
const ROW_GAP = 10;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingTop: space.sm, paddingBottom: space.section },
  summary: { marginBottom: space.md },
  section: { marginBottom: space.section },
  exName: { paddingBottom: space.xs },
  exHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  exNameTouch: { flex: 1 },
  reorderCluster: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.sm, paddingBottom: space.xs },

  colHeader: { flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, paddingBottom: space.xs },
  checkCol: { width: CHECK_W, alignItems: 'center', justifyContent: 'center' },
  colLabelCol: { width: FIELD_W, textAlign: 'center', textTransform: 'uppercase', letterSpacing: track.caps },
  prevCol: { flex: 1, minWidth: PREV_W, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: space.xs },
  prevHeaderLabel: { textTransform: 'uppercase', letterSpacing: track.caps },
  removeCol: { width: REMOVE_W, alignItems: 'center' },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: ROW_GAP,
    paddingVertical: space.sm,
    paddingHorizontal: 6,
    marginHorizontal: -6,
    borderRadius: 8,
  },
  field: { width: FIELD_W, alignItems: 'center', borderBottomWidth: 1, borderRadius: radius.badge, paddingVertical: space.xs },

  addSet: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.md },
});
