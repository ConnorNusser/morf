import IconButton from '@/components/IconButton';
import { Text, View, useInk } from '@/components/Themed';
import SectionLabel from '@/components/ui/SectionLabel';
import StatStrip from '@/components/ui/StatStrip';
import { useTheme } from '@/contexts/ThemeContext';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { layout } from '@/lib/ui/styles';
import { radius, screenGutter, space, tint, trend as trendColor, withAlpha } from '@/lib/ui/tokens';
import { convertWeight, ExerciseWithMax, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet } from 'react-native';

interface ExerciseHistoryModalProps {
  exercise: ExerciseWithMax | null;
  weightUnit: WeightUnit;
  onClose: () => void;
}

interface SessionSet {
  displayWeight: number;
  reps: number;
  oneRMLbs: number;
}

interface Session {
  dayKey: string;
  date: Date;
  sets: SessionSet[];
  bestOneRMLbs: number;
  bestOneRMDisplay: number;
  volume: number; // in preferred unit
  isPR: boolean;
}

const dayKeyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function ExerciseHistoryModal({ exercise, weightUnit, onClose }: ExerciseHistoryModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  // Group the flat set history into per-day sessions with a best 1RM and volume.
  const sessions = useMemo<Session[]>(() => {
    if (!exercise) return [];

    const byDay = new Map<string, Session>();

    for (const entry of exercise.history) {
      const unit = entry.unit || 'lbs';
      const weightInLbs = convertWeight(entry.weight, unit, 'lbs');
      const oneRMLbs = OneRMCalculator.estimate(weightInLbs, entry.reps);
      const displayWeight = Math.round(convertWeight(entry.weight, unit, weightUnit));
      const date = new Date(entry.date);
      const key = dayKeyOf(date);

      let session = byDay.get(key);
      if (!session) {
        session = {
          dayKey: key,
          date,
          sets: [],
          bestOneRMLbs: 0,
          bestOneRMDisplay: 0,
          volume: 0,
          isPR: false,
        };
        byDay.set(key, session);
      }

      session.sets.push({ displayWeight, reps: entry.reps, oneRMLbs });
      session.volume += convertWeight(entry.weight, unit, weightUnit) * entry.reps;
      if (oneRMLbs > session.bestOneRMLbs) session.bestOneRMLbs = oneRMLbs;
    }

    const list = Array.from(byDay.values());

    // Compute the display 1RM and order sets best-first within each session.
    for (const s of list) {
      s.bestOneRMDisplay =
        weightUnit === 'kg'
          ? Math.round(convertWeight(s.bestOneRMLbs, 'lbs', 'kg'))
          : Math.round(s.bestOneRMLbs);
      s.sets.sort((a, b) => b.oneRMLbs - a.oneRMLbs);
    }

    // Flag the single best session as the all-time PR.
    const prSession = list.reduce<Session | null>(
      (best, s) => (!best || s.bestOneRMLbs > best.bestOneRMLbs ? s : best),
      null
    );
    if (prSession) prSession.isPR = true;

    // Most recent session first.
    list.sort((a, b) => b.date.getTime() - a.date.getTime());
    return list;
  }, [exercise, weightUnit]);

  const maxOneRMLbs = useMemo(
    () => sessions.reduce((m, s) => Math.max(m, s.bestOneRMLbs), 0),
    [sessions]
  );

  // Estimated-1RM change from the first recorded session to the most recent,
  // in the user's display unit. Null when there's nothing to compare.
  const trend = useMemo(() => {
    if (sessions.length < 2) return null;
    const first = sessions[sessions.length - 1];
    // Compare the best of the few most recent sessions against the first, so a single
    // light/deload day (sessions[0] is the latest) can't flip the progress indicator
    // negative right after a PR. Mirrors getImprovement()'s "max of last 3" approach.
    const recentBest = Math.max(...sessions.slice(0, 3).map(s => s.bestOneRMDisplay));
    const change = recentBest - first.bestOneRMDisplay;
    return { change, firstDate: first.date, sessionCount: sessions.length };
  }, [sessions]);

  if (!exercise) return null;

  return (
    <Modal visible={!!exercise} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[layout.flex1, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="close" onPress={onClose} />
          <Text variant="title" tone="primary" weight="semiBold" style={styles.modalTitle} numberOfLines={1}>
            {exercise.name}
          </Text>
          {/* Spacer mirrors the close button so the title stays centered. */}
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {exercise.estimated1RM > 0 && (
            <StatStrip
              style={styles.statsBanner}
              items={[
                { value: exercise.estimated1RM, label: 'Est. 1RM', accent: true },
                { value: exercise.maxWeight, label: 'Best Weight' },
                { value: sessions.length, label: `Session${sessions.length !== 1 ? 's' : ''}` },
              ]}
            />
          )}

          {trend && (
            <View style={styles.trendRow}>
              <Ionicons
                name={trend.change > 0 ? 'trending-up' : trend.change < 0 ? 'trending-down' : 'remove'}
                size={16}
                color={trend.change > 0 ? trendColor.up : trend.change < 0 ? trendColor.down : ink.muted}
              />
              <Text variant="meta" tone="secondary" weight="medium">
                {trend.change === 0
                  ? 'No 1RM change'
                  : `${trend.change > 0 ? '+' : '−'}${Math.abs(trend.change)} ${weightUnit} 1RM`}
                {' '}since {trend.firstDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </Text>
            </View>
          )}

          <SectionLabel style={styles.sectionHeader}>Session History</SectionLabel>

          {sessions.length === 0 ? (
            <Text variant="body" tone="faint" style={styles.noHistoryText}>
              No history recorded yet
            </Text>
          ) : (
            sessions.map((session) => {
              const barPct = maxOneRMLbs > 0 ? Math.max(0.04, session.bestOneRMLbs / maxOneRMLbs) : 0;
              return (
                <View
                  key={session.dayKey}
                  style={[styles.sessionCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                >
                  <View style={styles.sessionTop}>
                    <View style={styles.sessionDateRow}>
                      <Text variant="body" tone="primary" weight="semiBold">
                        {session.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      {session.isPR && (
                        <View style={[styles.prChip, { backgroundColor: tint(currentTheme.colors.primary) }]}>
                          <Ionicons name="trophy" size={10} color={currentTheme.colors.primary} />
                          <Text variant="meta" weight="bold" style={styles.prChipText}>
                            BEST
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text variant="emphasis" tone="primary" weight="bold">
                      {session.bestOneRMDisplay}
                      <Text variant="meta" tone="faint">
                        {' '}1RM
                      </Text>
                    </Text>
                  </View>

                  {/* Relative 1RM bar */}
                  <View style={[styles.barTrack, { backgroundColor: ink.hairline }]}>
                    <View style={[styles.barFill, { width: `${barPct * 100}%`, backgroundColor: session.isPR ? currentTheme.colors.primary : withAlpha(currentTheme.colors.primary, 'secondary') }]} />
                  </View>

                  <View style={styles.sessionSets}>
                    {session.sets.map((set, i) => (
                      <View key={i} style={[styles.setPill, { backgroundColor: currentTheme.colors.background }]}>
                        <Text variant="meta" tone="secondary" weight="medium">
                          {set.displayWeight > 0 ? `${set.displayWeight}×${set.reps}` : `${set.reps} reps`}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text variant="meta" tone="faint" style={styles.sessionVolume}>
                    {session.sets.length} set{session.sets.length !== 1 ? 's' : ''} · {Math.round(session.volume).toLocaleString()} {weightUnit} volume
                  </Text>
                </View>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default React.memo(ExerciseHistoryModal);

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    flex: 1,
    textAlign: 'center',
    marginHorizontal: space.sm,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: screenGutter,
    paddingTop: space.xl,
  },
  statsBanner: {
    marginBottom: space.section,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.xl,
    marginTop: -space.sm,
  },
  sectionHeader: {
    marginBottom: space.md,
  },
  noHistoryText: {
    textAlign: 'center',
    paddingVertical: space.xl,
  },
  sessionCard: {
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.lg,
    marginBottom: space.md,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.badge,
  },
  prChipText: {
    letterSpacing: 0.5,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: space.md,
    marginBottom: space.md,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  sessionSets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  setPill: {
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderRadius: radius.badge,
  },
  sessionVolume: {
    marginTop: space.md,
  },
});
