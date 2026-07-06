import { Text, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, space, tint, withAlpha } from '@/lib/ui/tokens';
import { getExercise } from '@/lib/workout/workouts';
import { GeneratedWorkout, MuscleGroup } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import Card from './Card';

// "Balance" is a distribution question, not a this-week question. It reads across the
// lifter's OWN muscle groups over a multi-week window and answers "is one group starved
// relative to the rest?". A single week's sets are noise (a 1-workout week reads every
// unhit group as "neglected"); a trailing average is a real trend that can still fall
// when a group is dropped — so the number stays honest.
const WINDOW_WEEKS = 6;

// You need at least this many training weeks in the window before an average is a trend
// rather than an accident. Below it we don't judge — we just say we're still learning.
const MIN_ACTIVE_WEEKS = 2;

// The big compound groups a program is expected to hit every week. Neglecting one of
// these is a real programming hole worth flagging; an accessory group (arms/glutes/core)
// running lighter is normal and never fires the attention state on its own.
const MAJOR_GROUPS: MuscleGroup[] = ['legs', 'back', 'chest', 'shoulders'];

// A major group averaging this far below the lifter's most-trained group over the window
// is meaningfully underweighted. Purely relative to the lifter's own distribution — no
// invented "ideal" per-muscle target — so it can't shame a low-volume program, only an
// imbalanced one.
const UNDERWEIGHT_GAP = 0.6; // 60% under the leader

// Order for the distribution ladder: biggest movers first so the read is natural.
const LADDER_ORDER: MuscleGroup[] = ['legs', 'back', 'chest', 'shoulders', 'arms', 'glutes', 'core'];

// Warm amber — attention, not alarm. The old single-week widget used the volume-down RED
// on every partial week and read as "broken"; a multi-week trend earns a calmer signal.
const AMBER = '#E8A33D';

interface MuscleExerciseInfo {
  id: string;
  name: string;
  count: number;
}

interface MuscleBalanceRow {
  muscle: MuscleGroup;
  avgSets: number; // completed hard sets per ACTIVE week over the window
  isMajor: boolean;
  instanceCount: number; // exercise instances contributing (drives tappability)
  exercises: MuscleExerciseInfo[];
}

const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', arms: 'Arms',
  legs: 'Legs', glutes: 'Glutes', core: 'Core', 'full-body': 'Full Body',
};

// Monday-anchored week window `weekOffset` back from today (0 = current, matches
// WeeklyOverview so the two blocks agree on where a week starts).
function weekRange(weekOffset: number): { start: Date; end: Date } {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sun
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
  const start = new Date(today);
  start.setDate(today.getDate() + mondayOffset + weekOffset * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

interface MuscleBalanceCardProps {
  workoutHistory: GeneratedWorkout[];
}

interface Balance {
  rows: MuscleBalanceRow[]; // ladder rows, sorted by avgSets desc
  activeWeeks: number;
  leader: MuscleBalanceRow | null;
  laggard: MuscleBalanceRow | null; // most-underweighted MAJOR group, if any
  gapPct: number; // how far the laggard sits below the leader (0-100)
  state: 'building' | 'balanced' | 'underweight';
}

function computeBalance(
  workoutHistory: GeneratedWorkout[],
): Balance {
  const totals: Record<MuscleGroup, { sets: number; instances: number; exercises: Record<string, MuscleExerciseInfo> }> = {
    chest: { sets: 0, instances: 0, exercises: {} },
    back: { sets: 0, instances: 0, exercises: {} },
    shoulders: { sets: 0, instances: 0, exercises: {} },
    arms: { sets: 0, instances: 0, exercises: {} },
    legs: { sets: 0, instances: 0, exercises: {} },
    glutes: { sets: 0, instances: 0, exercises: {} },
    core: { sets: 0, instances: 0, exercises: {} },
    'full-body': { sets: 0, instances: 0, exercises: {} },
  };

  let activeWeeks = 0;
  // Trailing COMPLETED weeks only (offset -1..-WINDOW_WEEKS) — the in-progress week is
  // excluded so a fresh Monday can't drag every average toward zero.
  for (let i = 1; i <= WINDOW_WEEKS; i++) {
    const { start, end } = weekRange(-i);
    const weekWorkouts = workoutHistory.filter(w => {
      const d = new Date(w.createdAt);
      return d >= start && d <= end;
    });
    if (weekWorkouts.length === 0) continue;
    activeWeeks++;
    for (const workout of weekWorkouts) {
      for (const exercise of workout.exercises) {
        const info = getExercise(exercise.id);
        if (!info) continue;
        const completed = (exercise.completedSets || []).filter(s => s.completed).length;
        if (completed === 0) continue;
        for (const muscle of info.primaryMuscles) {
          const bucket = totals[muscle];
          bucket.sets += completed;
          bucket.instances += 1;
          if (!bucket.exercises[exercise.id]) {
            bucket.exercises[exercise.id] = { id: exercise.id, name: info.name, count: 0 };
          }
          bucket.exercises[exercise.id].count += 1;
        }
      }
    }
  }

  const denom = Math.max(1, activeWeeks);
  const allRows: MuscleBalanceRow[] = LADDER_ORDER.map(muscle => ({
    muscle,
    avgSets: totals[muscle].sets / denom,
    isMajor: MAJOR_GROUPS.includes(muscle),
    instanceCount: totals[muscle].instances,
    exercises: Object.values(totals[muscle].exercises),
  }));

  // Show every group that's actually trained, plus any MAJOR group sitting at zero —
  // a skipped leg day is exactly the answer this card exists to surface.
  const rows = allRows
    .filter(r => r.avgSets > 0 || r.isMajor)
    .sort((a, b) => b.avgSets - a.avgSets);

  if (activeWeeks < MIN_ACTIVE_WEEKS || rows.length === 0 || rows[0].avgSets <= 0) {
    return { rows, activeWeeks, leader: null, laggard: null, gapPct: 0, state: 'building' };
  }

  const leader = rows[0];
  // Most-underweighted MAJOR group relative to the leader.
  const majorRows = rows.filter(r => r.isMajor);
  const worstMajor = majorRows.reduce<MuscleBalanceRow | null>(
    (worst, r) => (!worst || r.avgSets < worst.avgSets ? r : worst),
    null,
  );

  if (worstMajor && worstMajor.muscle !== leader.muscle) {
    const gap = 1 - worstMajor.avgSets / leader.avgSets;
    if (gap >= UNDERWEIGHT_GAP) {
      return {
        rows,
        activeWeeks,
        leader,
        laggard: worstMajor,
        gapPct: Math.round(gap * 100),
        state: 'underweight',
      };
    }
  }

  return { rows, activeWeeks, leader, laggard: null, gapPct: 0, state: 'balanced' };
}

// "~4/wk", or "0/wk" (no tilde — a true zero, not a rounded estimate).
function fmtAvg(avg: number): string {
  if (avg <= 0) return '0/wk';
  const rounded = avg >= 2 ? Math.round(avg) : Math.round(avg * 10) / 10;
  return `~${rounded}/wk`;
}

export default function MuscleBalanceCard({ workoutHistory }: MuscleBalanceCardProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState<MuscleBalanceRow | null>(null);

  const balance = useMemo(
    () => computeBalance(workoutHistory),
    [workoutHistory],
  );

  const { rows, activeWeeks, leader, laggard, gapPct, state } = balance;

  // One-line verdict — the glance answer to "am I in balance?".
  let headline: string;
  let evidence: string | null;
  let headlineColor: string;
  let icon: keyof typeof Ionicons.glyphMap;
  if (state === 'building') {
    headline = 'Building your baseline';
    evidence = 'Log a couple weeks and your balance shows here';
    headlineColor = ink.secondary;
    icon = 'ellipse-outline';
  } else if (state === 'underweight' && laggard && leader) {
    const name = MUSCLE_LABEL[laggard.muscle];
    if (laggard.avgSets <= 0) {
      headline = `You're skipping ${name}`;
      evidence = `No ${name.toLowerCase()} sets in your last ${activeWeeks} weeks`;
    } else {
      headline = `${name} is underweighted`;
      evidence = `${fmtAvg(laggard.avgSets)} vs ${fmtAvg(leader.avgSets)} ${MUSCLE_LABEL[leader.muscle]} · ${gapPct}% under`;
    }
    headlineColor = AMBER;
    icon = 'alert-circle';
  } else {
    headline = 'Balanced across your major groups';
    evidence = leader ? `${MUSCLE_LABEL[leader.muscle]} leads at ${fmtAvg(leader.avgSets)}` : null;
    headlineColor = currentTheme.colors.accent;
    icon = 'checkmark-circle';
  }

  // Leader sets the ladder scale so every bar is read relative to the lifter's own top group.
  const scaleMax = Math.max(1, ...rows.map(r => r.avgSets));

  const barColor = (r: MuscleBalanceRow): string => {
    if (laggard && r.muscle === laggard.muscle) return AMBER;
    if (leader && r.muscle === leader.muscle) return currentTheme.colors.primary;
    return withAlpha(currentTheme.colors.primary, 'secondary');
  };

  const handleRowPress = (r: MuscleBalanceRow) => {
    if (r.instanceCount > 0) setSelected(r);
  };

  return (
    <>
      <Card variant="elevated">
        {/* Header — one label, matching the This Week card's single-title restraint. */}
        <View style={styles.header}>
          <SectionLabel style={styles.title}>MUSCLE BALANCE</SectionLabel>
          {state !== 'building' && (
            <Text variant="meta" tone="secondary" style={styles.subtitle}>
              SETS/WK · LAST {activeWeeks} WK
            </Text>
          )}
        </View>

        {/* Verdict — the derived one-glance answer, doubling as the expand toggle for the
            full per-group ladder. */}
        <TouchableOpacity
          style={styles.verdictRow}
          activeOpacity={0.6}
          onPress={() => setExpanded(e => !e)}
          disabled={state === 'building'}
        >
          <View style={styles.verdictLeft}>
            <Ionicons name={icon} size={16} color={headlineColor} />
            <View style={styles.verdictText}>
              <Text variant="body" weight="semiBold" style={[styles.verdict, { color: headlineColor }]} numberOfLines={1}>
                {headline}
              </Text>
              {evidence && (
                <Text variant="meta" tone="secondary" style={styles.evidence} numberOfLines={1}>
                  {evidence}
                </Text>
              )}
            </View>
          </View>
          {state !== 'building' && (
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={ink.muted} />
          )}
        </TouchableOpacity>

        {/* Collapsed: just the underweighted group's bar as evidence for the verdict.
            Balanced weeks show only the verdict — nothing to fix, nothing to render. */}
        {!expanded && state === 'underweight' && laggard && (
          <View style={styles.ladder}>
            <BalanceBar
              row={laggard}
              scaleMax={scaleMax}
              color={AMBER}
              onPress={handleRowPress}
            />
          </View>
        )}

        {/* Expanded: the full distribution ladder — every trained group + any skipped
            major group, ranked, so the balance read is complete on demand. */}
        {expanded && state !== 'building' && (
          <View style={styles.ladder}>
            {rows.map(r => (
              <BalanceBar
                key={r.muscle}
                row={r}
                scaleMax={scaleMax}
                color={barColor(r)}
                onPress={handleRowPress}
              />
            ))}
            <Text variant="meta" tone="faint" style={styles.footnote}>
              Average completed sets per training week, each muscle vs your most-trained group.
            </Text>
          </View>
        )}
      </Card>

      {/* Per-group detail: which exercises drove this group's volume over the window. */}
      <Modal
        visible={!!selected}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={ink.primary} />
            </TouchableOpacity>
            <Text variant="title" tone="primary" weight="semiBold" style={styles.modalTitle}>
              {selected ? MUSCLE_LABEL[selected.muscle] : ''}
            </Text>
            <View style={styles.closeButton} />
          </View>

          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            {selected && (
              <>
                <Text variant="meta" tone="secondary" style={styles.modalMeta}>
                  {fmtAvg(selected.avgSets)} over your last {activeWeeks} training week{activeWeeks !== 1 ? 's' : ''}
                </Text>
                <View style={styles.exerciseList}>
                  {selected.exercises
                    .sort((a, b) => b.count - a.count)
                    .map((ex, i) => (
                      <View key={ex.id + i} style={[styles.exerciseRow, { borderBottomColor: currentTheme.colors.border }]}>
                        <Text variant="body" tone="primary" weight="medium" style={styles.exerciseName}>
                          {ex.name}
                        </Text>
                        <View style={[styles.exerciseCountBadge, { backgroundColor: tint(currentTheme.colors.primary) }]}>
                          <Text variant="meta" weight="semiBold">
                            {ex.count}x
                          </Text>
                        </View>
                      </View>
                    ))}
                </View>
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

interface BalanceBarProps {
  row: MuscleBalanceRow;
  scaleMax: number;
  color: string;
  onPress: (r: MuscleBalanceRow) => void;
}

function BalanceBar({ row, scaleMax, color, onPress }: BalanceBarProps) {
  const ink = useInk();
  const fillPct = Math.min(100, (row.avgSets / scaleMax) * 100);
  const tappable = row.instanceCount > 0;
  return (
    <TouchableOpacity
      style={styles.barRow}
      activeOpacity={tappable ? 0.6 : 1}
      disabled={!tappable}
      onPress={() => onPress(row)}
    >
      <Text
        variant="meta"
        tone={row.avgSets > 0 ? 'primary' : 'secondary'}
        weight="medium"
        style={styles.barName}
      >
        {MUSCLE_LABEL[row.muscle]}
      </Text>
      <View style={[styles.barTrack, { backgroundColor: ink.hairline }]}>
        {fillPct > 0 && <View style={[styles.barFill, { width: `${fillPct}%`, backgroundColor: color }]} />}
      </View>
      <Text variant="meta" tone="primary" weight="semiBold" style={styles.barValue}>
        {fmtAvg(row.avgSets)}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.md,
  },
  title: {
    marginBottom: 0,
  },
  subtitle: {
    lineHeight: 19,
    letterSpacing: 0.4,
  },
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  verdictLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    flexShrink: 1,
  },
  verdictText: {
    flexShrink: 1,
  },
  verdict: {
    lineHeight: 22,
  },
  evidence: {
    lineHeight: 19,
    marginTop: 1,
  },
  ladder: {
    marginTop: space.lg,
    gap: space.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  barName: {
    lineHeight: 19,
    width: 66,
  },
  barTrack: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 5,
  },
  barValue: {
    lineHeight: 19,
    minWidth: 52,
    textAlign: 'right',
  },
  footnote: {
    lineHeight: 19,
    marginTop: space.xs,
  },
  // Modal
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    lineHeight: 27,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: space.lg,
  },
  modalMeta: {
    lineHeight: 20,
    marginBottom: space.lg,
  },
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: {
    lineHeight: 22,
    flex: 1,
  },
  exerciseCountBadge: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
    marginLeft: space.md,
  },
});
