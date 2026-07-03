import React, { useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { MuscleGroup } from '@/types';
import { Ionicons } from '@expo/vector-icons';

// Order muscles by size/priority so the balance ladder reads naturally top-to-bottom.
const ALL_MUSCLE_GROUPS: MuscleGroup[] = ['legs', 'back', 'chest', 'shoulders', 'arms', 'glutes', 'core'];

// A muscle needs at least this many baseline sets/wk before we'll call a zero week a
// genuine "skip" — protects small/accessory groups from false neglect flags.
const BASELINE_THRESHOLD = 1.5;

const RED = '#FF3B30'; // matches the volume-delta down color used elsewhere in this screen

export interface MuscleExerciseInfo {
  id: string;
  name: string;
  count: number; // number of times performed
}

export interface MuscleGroupData {
  muscle: MuscleGroup;
  count: number; // exercise instances that contributed (drives the detail modal)
  sets: number; // completed hard sets this week targeting this muscle
  normSets: number; // avg weekly completed sets over the trailing 4 completed weeks
  exercises: MuscleExerciseInfo[]; // exercises that contributed
}

interface MuscleFocusChipsProps {
  muscleData: MuscleGroupData[];
  // Fraction of the viewed week elapsed (1 for any completed/past week). The current
  // in-progress week is compared against its pro-rated norm so a Wednesday check-in
  // isn't unfairly flagged "below".
  paceFraction?: number;
  showMissing?: boolean;
}

type Tone = 'ahead' | 'ontrack' | 'below' | 'skipped' | 'new' | 'none';
type BalanceState = 'building' | 'balanced' | 'lagging';

interface Verdict {
  label: string;
  tone: Tone;
}

const getMuscleGroupLabel = (muscle: MuscleGroup): string => {
  switch (muscle) {
    case 'chest': return 'Chest';
    case 'back': return 'Back';
    case 'shoulders': return 'Shoulders';
    case 'arms': return 'Arms';
    case 'legs': return 'Legs';
    case 'glutes': return 'Glutes';
    case 'core': return 'Core';
    case 'full-body': return 'Full Body';
    default: return muscle;
  }
};

const getVerdict = (sets: number, normSets: number, pace: number): Verdict => {
  // No established baseline for this muscle — can't judge neglect, only presence.
  if (normSets < 0.5) {
    return sets > 0 ? { label: 'New', tone: 'new' } : { label: '—', tone: 'none' };
  }
  if (sets === 0) {
    // Mid-week a zero isn't neglect yet — it's pending. Only a finished week earns "Skipped".
    return pace < 1 ? { label: 'To hit', tone: 'below' } : { label: 'Skipped', tone: 'skipped' };
  }
  const pacedNorm = normSets * pace;
  const ratio = pacedNorm > 0 ? sets / pacedNorm : 2;
  if (ratio < 0.7) return { label: 'Below avg', tone: 'below' };
  if (ratio <= 1.3) return { label: 'On track', tone: 'ontrack' };
  return { label: `${(Math.round(ratio * 10) / 10).toFixed(1)}× avg`, tone: 'ahead' };
};

export default function MuscleFocusChips({ muscleData, paceFraction = 1, showMissing = true }: MuscleFocusChipsProps) {
  const { currentTheme } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupData | null>(null);
  // Detail-on-tap: the full 7-bar dual-channel ladder is the slowest read on the page,
  // so it stays collapsed behind the one-line verdict until the lifter asks for it.
  const [expanded, setExpanded] = useState(false);
  const pace = Math.min(Math.max(paceFraction, 0.15), 1);

  const rows = ALL_MUSCLE_GROUPS.map(muscle => {
    const data = muscleData.find(m => m.muscle === muscle);
    const sets = data?.sets ?? 0;
    const normSets = data?.normSets ?? 0;
    return { muscle, data, sets, normSets, verdict: getVerdict(sets, normSets, pace) };
  });

  // Shared scale keeps bars comparable across muscles while each carries its own norm tick.
  const scaleMax = Math.max(1, ...rows.map(r => Math.max(r.sets, r.normSets)));

  const fillColor = (tone: Tone): string => {
    switch (tone) {
      case 'ahead': return currentTheme.colors.accent;
      case 'ontrack':
      case 'new': return currentTheme.colors.primary;
      case 'below': return currentTheme.colors.primary + '80';
      default: return 'transparent';
    }
  };

  // Rank the muscles with an established baseline by how far each sits below its own paced
  // norm. This single ordering drives BOTH the derived verdict headline and the 1–2 worst
  // deviation bars shown while collapsed, so the glance answer and its evidence agree.
  const ranked = rows
    .filter(r => r.normSets >= 0.5)
    .map(r => ({ ...r, ratio: r.normSets * pace > 0 ? r.sets / (r.normSets * pace) : 1 }))
    .sort((a, b) => a.ratio - b.ratio);
  const worst = ranked[0];

  // Derived headline — the one-line answer to "am I neglecting a group?". Based on the
  // worst muscle vs its own paced norm, so it flips to "balanced" when the lifter recovers.
  let headline: string;
  let headlineColor: string;
  let state: BalanceState;
  if (ranked.length === 0) {
    headline = 'Building your baseline — keep logging';
    headlineColor = currentTheme.colors.text + '99';
    state = 'building';
  } else if (worst.ratio < 0.5) {
    const name = getMuscleGroupLabel(worst.muscle);
    headline = worst.sets === 0 && pace >= 1 && worst.normSets >= BASELINE_THRESHOLD
      ? `Neglecting ${name} this week`
      : `${name} lagging behind`;
    headlineColor = RED;
    state = 'lagging';
  } else {
    headline = 'Balanced across your groups';
    headlineColor = currentTheme.colors.accent;
    state = 'balanced';
  }

  // Only when genuinely lagging do we surface the culprits — the worst 1–2 groups as
  // single-channel "how far below your usual" bars. A balanced week shows only the verdict.
  const worstChips = state === 'lagging' ? ranked.filter(r => r.ratio < 0.7).slice(0, 2) : [];

  const statusIcon: keyof typeof Ionicons.glyphMap =
    state === 'balanced' ? 'checkmark-circle' : state === 'lagging' ? 'alert-circle' : 'ellipse-outline';

  const handleRowPress = (data: MuscleGroupData | undefined) => {
    if (data && data.count > 0) {
      setSelectedMuscle(data);
      setModalVisible(true);
    }
  };

  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedMuscle(null);
  };

  return (
    <>
      <View style={styles.container}>
        {/* Verdict — the one-glance answer to "am I training in balance?". The raw ladder
            is the page's slowest preattentive read, so it lives one tap away; this line
            owns the state (balanced / X lagging) on its own. */}
        <TouchableOpacity
          style={styles.verdictRow}
          activeOpacity={0.6}
          onPress={() => setExpanded(e => !e)}
        >
          <View style={styles.verdictLeft}>
            <Ionicons name={statusIcon} size={16} color={headlineColor} />
            <Text style={[styles.verdict, { color: headlineColor, fontFamily: currentTheme.fonts.semiBold }]} numberOfLines={1}>
              {headline}
            </Text>
          </View>
          <View style={styles.verdictRight}>
            <Text style={[styles.eyebrow, { color: currentTheme.colors.text + '66', fontFamily: currentTheme.fonts.medium }]}>
              Balance
            </Text>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={currentTheme.colors.text + '55'} />
          </View>
        </TouchableOpacity>

        {/* Collapsed: only the 1–2 groups pulling the verdict down, as single-channel
            deviation bars (this week's sets vs your weekly average). Tappable into detail. */}
        {!expanded && worstChips.map(r => {
          const target = Math.max(1, Math.round(r.normSets));
          const fillPct = Math.min(100, (r.sets / Math.max(r.normSets, 1)) * 100);
          const barColor = r.sets === 0 ? RED : currentTheme.colors.primary + '99';
          const tappable = !!r.data && r.data.count > 0;
          return (
            <TouchableOpacity
              key={r.muscle}
              style={styles.devRow}
              onPress={() => handleRowPress(r.data)}
              activeOpacity={tappable ? 0.6 : 1}
              disabled={!tappable}
            >
              <Text style={[styles.devName, { color: currentTheme.colors.text + 'CC', fontFamily: currentTheme.fonts.medium }]}>
                {getMuscleGroupLabel(r.muscle)}
              </Text>
              <View style={[styles.devTrack, { backgroundColor: currentTheme.colors.text + '12' }]}>
                {fillPct > 0 && (
                  <View style={[styles.devFill, { width: `${fillPct}%`, backgroundColor: barColor }]} />
                )}
              </View>
              <Text style={[styles.devValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
                {r.sets}
                <Text style={[styles.devValueDim, { color: currentTheme.colors.text + '66', fontFamily: currentTheme.fonts.regular }]}>
                  {' / '}{target}
                </Text>
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Expanded: the full dual-channel ladder + legend — the detailed per-group read,
            unchanged, now opt-in instead of always-on. */}
        {expanded && (
          <>
            <View style={styles.rows}>
              {rows.map(({ muscle, data, sets, normSets, verdict }) => {
                const trained = data ? data.count > 0 : false;
                const fillPct = Math.min(100, (sets / scaleMax) * 100);
                const tickPct = Math.min(100, (normSets / scaleMax) * 100);
                return (
                  <TouchableOpacity
                    key={muscle}
                    style={styles.row}
                    onPress={() => handleRowPress(data)}
                    activeOpacity={trained ? 0.6 : 1}
                    disabled={!trained}
                  >
                    <Text style={[styles.muscleName, { color: currentTheme.colors.text + (sets > 0 ? 'CC' : '80'), fontFamily: currentTheme.fonts.medium }]}>
                      {getMuscleGroupLabel(muscle)}
                    </Text>

                    <View style={[styles.track, { backgroundColor: currentTheme.colors.text + '12' }]}>
                      {fillPct > 0 && (
                        <View style={[styles.fill, { width: `${fillPct}%`, backgroundColor: fillColor(verdict.tone) }]} />
                      )}
                      {normSets >= 0.5 && (
                        <View style={[styles.tick, { left: `${tickPct}%`, backgroundColor: currentTheme.colors.text + '80' }]} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: currentTheme.colors.primary }]} />
              <Text style={[styles.legendText, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                sets this week
              </Text>
              <View style={[styles.legendTick, { backgroundColor: currentTheme.colors.text + '80' }]} />
              <Text style={[styles.legendText, { color: currentTheme.colors.text + '80', fontFamily: currentTheme.fonts.regular }]}>
                your 4-wk avg
              </Text>
            </View>

            {showMissing && ranked.length > 0 && (
              <Text style={[styles.legendText, { color: currentTheme.colors.text + '4D', fontFamily: currentTheme.fonts.regular, marginTop: 6 }]}>
                Compared to your trailing-4-week weekly average.
              </Text>
            )}
          </>
        )}
      </View>

      {/* Exercise Detail Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseModal}
      >
        <SafeAreaView style={[styles.modalContainer, { backgroundColor: currentTheme.colors.background }]}>
          {/* Header */}
          <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
            <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={currentTheme.colors.text} />
            </TouchableOpacity>
            <Text style={[styles.modalTitle, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>
              {selectedMuscle ? getMuscleGroupLabel(selectedMuscle.muscle) : ''}
            </Text>
            <View style={styles.closeButton} />
          </View>

          {/* Content */}
          <ScrollView style={styles.modalContent} contentContainerStyle={styles.modalContentContainer}>
            {selectedMuscle && (
              <>
                <Text style={[styles.exerciseCount, { color: currentTheme.colors.text + '99', fontFamily: currentTheme.fonts.regular }]}>
                  {selectedMuscle.sets} set{selectedMuscle.sets !== 1 ? 's' : ''} this week
                  {selectedMuscle.normSets >= 0.5 ? ` · ${Math.round(selectedMuscle.normSets)}/wk avg` : ''}
                </Text>

                <View style={styles.exerciseList}>
                  {selectedMuscle.exercises
                    .sort((a, b) => b.count - a.count)
                    .map((exercise, index) => (
                      <View
                        key={exercise.id + index}
                        style={[styles.exerciseRow, { borderBottomColor: currentTheme.colors.border }]}
                      >
                        <Text style={[styles.exerciseName, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.medium }]}>
                          {exercise.name}
                        </Text>
                        <View style={[styles.exerciseCountBadge, { backgroundColor: currentTheme.colors.primary + '15' }]}>
                          <Text style={[styles.exerciseCountText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.semiBold }]}>
                            {exercise.count}x
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

const styles = StyleSheet.create({
  container: {},
  // Verdict header — the collapsed one-glance state, doubles as the expand toggle.
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  verdictLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  verdict: {
    fontSize: 14,
    lineHeight: 19,
    flexShrink: 1,
  },
  verdictRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  eyebrow: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  // Collapsed deviation bars — the 1–2 worst groups, single channel.
  devRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  devName: {
    fontSize: 12,
    lineHeight: 16,
    width: 62,
  },
  devTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  devFill: {
    height: '100%',
    borderRadius: 4,
  },
  devValue: {
    fontSize: 12,
    lineHeight: 16,
    minWidth: 44,
    textAlign: 'right',
  },
  devValueDim: {
    fontSize: 12,
  },
  // Expanded dual-channel ladder.
  rows: {
    gap: 9,
    marginTop: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  muscleName: {
    fontSize: 12,
    lineHeight: 16,
    width: 62,
  },
  track: {
    flex: 1,
    height: 9,
    borderRadius: 5,
    overflow: 'hidden',
    position: 'relative',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 5,
  },
  tick: {
    position: 'absolute',
    top: -1,
    bottom: -1,
    width: 2,
    borderRadius: 1,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 8,
    borderRadius: 2,
  },
  legendTick: {
    width: 2,
    height: 10,
    borderRadius: 1,
    marginLeft: 6,
  },
  legendText: {
    fontSize: 11,
    lineHeight: 15,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 17,
    lineHeight: 22,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: 16,
  },
  exerciseCount: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  exerciseList: {
    gap: 0,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  exerciseName: {
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  exerciseCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  exerciseCountText: {
    fontSize: 13,
  },
});
