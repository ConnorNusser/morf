// Editable workout draft (source of truth); check-off-first logging. Each
// exercise has an options menu (⋯ → bottom sheet) for reordering and removal.
import { Text, useInk } from '@/components/Themed';
import BottomSheet from '@/components/ui/BottomSheet';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { formatCompact } from '@/lib/gamification/careerStats';
import { danger, radius, screenGutter, space, tint, track, trend } from '@/lib/ui/tokens';
import playHapticFeedback from '@/lib/utils/haptic';
import { DraftExercise, DraftSet, WorkoutDraft, totalSets, totalVolume } from '@/lib/workout/workoutDraft';
import { WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

const DONE_GREEN = trend.up;

interface EditableWorkoutProps {
  draft: WorkoutDraft;
  weightUnit: WeightUnit;
  onEditField: (key: string, index: number, field: 'weight' | 'reps') => void;
  activeField?: { key: string; index: number; field: 'weight' | 'reps' } | null;
  onAddSet: (key: string) => void;
  onAddWarmupSet?: (key: string) => void;
  onRemoveSet: (key: string, index: number) => void;
  onToggleDone: (key: string, index: number) => void;
  onRemoveExercise: (key: string) => void;
  onMoveExercise?: (key: string, dir: -1 | 1) => void;
  onMoveExerciseToEdge?: (key: string, edge: 'top' | 'bottom') => void;
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

function MenuRow({ icon, label, onPress, disabled, destructive }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  const ink = useInk();
  const iconColor = destructive ? danger : disabled ? ink.ghost : ink.secondary;
  const textColor = destructive ? danger : disabled ? ink.faint : ink.primary;
  return (
    <TouchableOpacity
      style={styles.menuRow}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text variant="body" weight="medium" style={{ color: textColor }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function ExerciseSection({ exercise, weightUnit, onEditField, activeField, onAddSet, onRemoveSet, onToggleDone, onOpenMenu, previous }: {
  exercise: DraftExercise;
  previous: DraftSet[] | null;
  onOpenMenu: (key: string) => void;
} & Omit<EditableWorkoutProps, 'draft' | 'weightUnit' | 'getPreviousSets' | 'onRemoveExercise' | 'onMoveExercise' | 'onMoveExerciseToEdge' | 'onAddWarmupSet'> & { weightUnit: WeightUnit }) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const hasPrev = !!previous && previous.length > 0;

  return (
    <RNView style={styles.section}>
      <RNView style={styles.exHeaderRow}>
        <Text variant="emphasis" tone="primary" weight="semiBold" style={styles.exName} numberOfLines={1}>
          {exercise.name || 'Unnamed exercise'}
        </Text>

        {/* Single entry point for exercise actions (reorder lives in the sheet) —
            a bordered circle so it reads as a button, not stray glyphs. */}
        <TouchableOpacity
          hitSlop={8}
          style={[styles.menuButton, { borderColor: currentTheme.colors.border, backgroundColor: currentTheme.colors.surface }]}
          onPress={() => { playHapticFeedback('light', false); onOpenMenu(exercise.key); }}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${exercise.name || 'exercise'}`}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={ink.secondary} />
        </TouchableOpacity>
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
                  {set.isWarmup ? (
                    <Text variant="meta" tone="muted" numberOfLines={1} style={styles.warmupLabel}>warmup</Text>
                  ) : prev ? (
                    <Text variant="meta" tone="muted" numberOfLines={1}>{fmtPrev(prev)}</Text>
                  ) : null}
                </RNView>
                <RNView style={styles.removeCol}>
                  <TouchableOpacity
                    hitSlop={4}
                    style={[styles.removeBtn, { backgroundColor: ink.hairline }]}
                    onPress={() => { playHapticFeedback('light', false); onRemoveSet(exercise.key, i); }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove set ${i + 1}`}
                  >
                    <Ionicons name="close" size={16} color={ink.secondary} />
                  </TouchableOpacity>
                </RNView>
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

export default function EditableWorkout({ draft, weightUnit, onEditField, activeField, onAddSet, onAddWarmupSet, onRemoveSet, onToggleDone, onRemoveExercise, onMoveExercise, onMoveExerciseToEdge, getPreviousSets, onScrollBeginDrag, bottomInset }: EditableWorkoutProps) {
  const ink = useInk();
  // Which exercise's options sheet is open (by key so draft updates never go stale).
  const [menuKey, setMenuKey] = useState<string | null>(null);

  if (draft.length === 0) return null;

  const sets = totalSets(draft);
  const volume = totalVolume(draft);

  const menuIndex = draft.findIndex(ex => ex.key === menuKey);
  const menuExercise = menuIndex >= 0 ? draft[menuIndex] : null;
  const closeMenu = () => setMenuKey(null);
  const menuAction = (fn: () => void, haptic: 'light' | 'medium' = 'light') => () => {
    playHapticFeedback(haptic, false);
    fn();
    closeMenu();
  };

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, bottomInset != null && { paddingBottom: bottomInset }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScrollBeginDrag={onScrollBeginDrag} showsVerticalScrollIndicator>
        <SectionLabel style={styles.summary}>
          {draft.length} {draft.length === 1 ? 'exercise' : 'exercises'} · {sets} {sets === 1 ? 'set' : 'sets'}
          {volume > 0 ? ` · ${formatCompact(volume)} ${weightUnit}` : ''}
        </SectionLabel>

        {draft.map(ex => (
          <ExerciseSection
            key={ex.key}
            exercise={ex}
            previous={getPreviousSets?.(ex.exerciseId) ?? null}
            weightUnit={weightUnit}
            onEditField={onEditField}
            activeField={activeField}
            onAddSet={onAddSet}
            onRemoveSet={onRemoveSet}
            onToggleDone={onToggleDone}
            onOpenMenu={setMenuKey}
          />
        ))}
      </ScrollView>

      <BottomSheet visible={menuExercise != null} onClose={closeMenu}>
        {menuExercise && (
          <RNView style={styles.menuContent}>
            <RNView style={styles.menuHeader}>
              <Text variant="title" tone="primary" weight="semiBold" numberOfLines={1}>
                {menuExercise.name || 'Unnamed exercise'}
              </Text>
              <Text variant="meta" tone="muted" style={styles.menuSub}>
                {menuExercise.sets.length} {menuExercise.sets.length === 1 ? 'set' : 'sets'}
              </Text>
            </RNView>

            {onAddWarmupSet && (
              <MenuRow
                icon="flame-outline"
                label="Add warmup set"
                onPress={menuAction(() => onAddWarmupSet(menuExercise.key))}
              />
            )}
            {draft.length > 1 && onMoveExercise && (
              <>
                <MenuRow
                  icon="arrow-up"
                  label="Move up"
                  disabled={menuIndex === 0}
                  onPress={menuAction(() => onMoveExercise(menuExercise.key, -1))}
                />
                <MenuRow
                  icon="arrow-down"
                  label="Move down"
                  disabled={menuIndex === draft.length - 1}
                  onPress={menuAction(() => onMoveExercise(menuExercise.key, 1))}
                />
              </>
            )}
            {draft.length > 2 && onMoveExerciseToEdge && (
              <>
                <MenuRow
                  icon="arrow-up-circle-outline"
                  label="Move to top"
                  disabled={menuIndex === 0}
                  onPress={menuAction(() => onMoveExerciseToEdge(menuExercise.key, 'top'))}
                />
                <MenuRow
                  icon="arrow-down-circle-outline"
                  label="Move to bottom"
                  disabled={menuIndex === draft.length - 1}
                  onPress={menuAction(() => onMoveExerciseToEdge(menuExercise.key, 'bottom'))}
                />
              </>
            )}
            <RNView style={[styles.menuDivider, { backgroundColor: ink.hairline }]} />
            <MenuRow
              icon="trash-outline"
              label="Remove exercise"
              destructive
              onPress={menuAction(() => onRemoveExercise(menuExercise.key), 'medium')}
            />
          </RNView>
        )}
      </BottomSheet>
    </>
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
  exName: { flex: 1, paddingBottom: space.xs },
  exHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  menuButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.xs,
  },

  menuContent: { paddingHorizontal: screenGutter, paddingTop: space.xs },
  menuHeader: { paddingBottom: space.md },
  menuSub: { marginTop: 2 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  menuDivider: { height: StyleSheet.hairlineWidth, marginVertical: space.xs },

  colHeader: { flexDirection: 'row', alignItems: 'center', gap: ROW_GAP, paddingBottom: space.xs },
  checkCol: { width: CHECK_W, alignItems: 'center', justifyContent: 'center' },
  colLabelCol: { width: FIELD_W, textAlign: 'center', textTransform: 'uppercase', letterSpacing: track.caps },
  prevCol: { flex: 1, minWidth: PREV_W, alignItems: 'flex-start', justifyContent: 'center', paddingLeft: space.xs },
  prevHeaderLabel: { textTransform: 'uppercase', letterSpacing: track.caps },
  warmupLabel: { textTransform: 'uppercase', letterSpacing: track.caps },
  removeCol: { width: REMOVE_W, alignItems: 'center' },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
