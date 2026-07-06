import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { layout } from '@/lib/ui/styles';
import { convertWeight, ExerciseWithMax, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';

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
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={28} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: currentTheme.colors.text, fontWeight: '600' }]} numberOfLines={1}>
            {exercise.name}
          </Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          {exercise.estimated1RM > 0 && (
            <View style={[styles.statsBanner, { backgroundColor: currentTheme.colors.surface }]}>
              <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.statValue, { color: currentTheme.colors.primary, fontWeight: '700' }]}>
                  {exercise.estimated1RM}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}>
                  Est. 1RM
                </Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '700' }]}>
                  {exercise.maxWeight}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}>
                  Best Weight
                </Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.statValue, { color: currentTheme.colors.text, fontWeight: '700' }]}>
                  {sessions.length}
                </Text>
                <Text style={[styles.statLabel, { color: currentTheme.colors.text + '50', fontWeight: '400' }]}>
                  Session{sessions.length !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          )}

          {trend && (
            <View style={[styles.trendRow, { backgroundColor: 'transparent' }]}>
              <Ionicons
                name={trend.change > 0 ? 'trending-up' : trend.change < 0 ? 'trending-down' : 'remove'}
                size={16}
                color={trend.change > 0 ? '#00C85C' : trend.change < 0 ? '#FF6B6B' : currentTheme.colors.text + '60'}
              />
              <Text style={[styles.trendText, { color: currentTheme.colors.text + '99', fontWeight: '500' }]}>
                {trend.change === 0
                  ? 'No 1RM change'
                  : `${trend.change > 0 ? '+' : '−'}${Math.abs(trend.change)} ${weightUnit} 1RM`}
                {' '}since {trend.firstDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </Text>
            </View>
          )}

          <Text style={[styles.sectionHeader, { color: currentTheme.colors.text + '50', fontWeight: '600' }]}>
            SESSION HISTORY
          </Text>

          {sessions.length === 0 ? (
            <Text style={[styles.noHistoryText, { color: currentTheme.colors.text + '40', fontWeight: '400' }]}>
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
                  <View style={[styles.sessionTop, { backgroundColor: 'transparent' }]}>
                    <View style={[styles.sessionDateRow, { backgroundColor: 'transparent' }]}>
                      <Text style={[styles.sessionDate, { color: currentTheme.colors.text, fontWeight: '600' }]}>
                        {session.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Text>
                      {session.isPR && (
                        <View style={[styles.prChip, { backgroundColor: currentTheme.colors.primary + '18' }]}>
                          <Ionicons name="trophy" size={10} color={currentTheme.colors.primary} />
                          <Text style={[styles.prChipText, { color: currentTheme.colors.primary, fontWeight: '700' }]}>
                            BEST
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.sessionOneRM, { color: currentTheme.colors.text, fontWeight: '700' }]}>
                      {session.bestOneRMDisplay}
                      <Text style={[styles.sessionOneRMLabel, { color: currentTheme.colors.text + '40', fontWeight: '400' }]}>
                        {' '}1RM
                      </Text>
                    </Text>
                  </View>

                  {/* Relative 1RM bar */}
                  <View style={[styles.barTrack, { backgroundColor: currentTheme.colors.text + '10' }]}>
                    <View style={[styles.barFill, { width: `${barPct * 100}%`, backgroundColor: currentTheme.colors.primary + (session.isPR ? 'FF' : '80') }]} />
                  </View>

                  <View style={[styles.sessionSets, { backgroundColor: 'transparent' }]}>
                    {session.sets.map((set, i) => (
                      <View key={i} style={[styles.setPill, { backgroundColor: currentTheme.colors.background }]}>
                        <Text style={[styles.setPillText, { color: currentTheme.colors.text + 'CC', fontWeight: '500' }]}>
                          {set.displayWeight > 0 ? `${set.displayWeight}×${set.reps}` : `${set.reps} reps`}
                        </Text>
                      </View>
                    ))}
                  </View>

                  <Text style={[styles.sessionVolume, { color: currentTheme.colors.text + '45', fontWeight: '400' }]}>
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    flex: 1,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  statsBanner: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
  },
  statLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 18,
    marginTop: -8,
  },
  trendText: {
    fontSize: 16,
  },
  sectionHeader: {
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 12,
  },
  noHistoryText: {
    fontSize: 17,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sessionCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  sessionTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sessionDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDate: {
    fontSize: 17,
  },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  prChipText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  sessionOneRM: {
    fontSize: 20,
  },
  sessionOneRMLabel: {
    fontSize: 14,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    borderRadius: 2,
  },
  sessionSets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  setPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setPillText: {
    fontSize: 16,
  },
  sessionVolume: {
    fontSize: 14,
    marginTop: 10,
  },
});
