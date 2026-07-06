// The Sessions feed — a workout HISTORY: the last few sessions as detailed log
// entries (header + a per-exercise table), newest first. Reads like a training
// log, not a social feed. (The volume-per-session bars live on the This Week
// card, which owns the volume story.)
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS, PPL_LABELS } from '@/lib/data/pplCategories';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { type as typeScale } from '@/lib/ui/typography';
import { formatCompact } from '@/lib/utils/utils';
import { SessionRecap } from '@/lib/history/sessionRecap';
import { GeneratedWorkout, WeightUnit } from '@/types';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View as RNView } from 'react-native';

// One green accent per screen: the newest entry's PR row. Rare and earned — older
// entries mark their PRs quietly, so celebration never becomes wallpaper.
const POS = '#34C759';

// Suppress the auto-generated default title ("Workout - 7/3/2026") so the entry
// header reads as just the day; keep real titles like "Leg Day".
const cleanTitle = (t: string): string | null => {
  const s = (t || '').trim();
  return !s || /^workout\b/i.test(s) ? null : s;
};

// Drop the trailing "(Equipment)" — matches the shortening the lineup/headlines use.
const shortHeroName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

// ── one session as a detailed log entry: header (title, date · sets · time,
// volume right), an optional narrative note, then the per-exercise table —
// every exercise with its set count and top set, PRs marked on their row.
function SessionEntry({ recap, weightUnit, celebrate, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  celebrate: boolean;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const prName = recap.pr ? shortHeroName(recap.pr.name) : null;
  // The narrative note earns its line only when it says something the exercise
  // table can't (comeback / biggest-yet); a plain "X PR" is told on the row itself.
  const note = recap.headline && !/\bPR\b/.test(recap.headline) ? recap.headline : null;

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(recap.workout)} style={styles.entry}>
      {/* entry header — identity left (split-colored dot: the Career activity
          grid's Push/Pull/Legs language), volume + vs-last-same-split right */}
      <RNView style={styles.entryHead}>
        <RNView style={styles.entryIdentity}>
          <RNView style={styles.titleLine}>
            {recap.split && (
              <RNView style={[styles.splitDot, { backgroundColor: PPL_COLORS[recap.split] }]} />
            )}
            <Text style={[styles.entryTitle, { color: colors.text }]} numberOfLines={1}>
              {cleanTitle(recap.title) ?? (recap.split ? `${PPL_LABELS[recap.split]} session` : 'Workout')}
            </Text>
          </RNView>
          <Text style={[styles.entryMeta, { color: colors.text }]} numberOfLines={1}>
            {formatRelativeDate(recap.workout.createdAt)} · {recap.sets} sets · {recap.durationMin}m
          </Text>
        </RNView>
        <RNView style={styles.entryRight}>
          <Text style={[styles.entryVolume, { color: colors.text }]} numberOfLines={1}>
            {formatCompact(recap.volumeDisplay)} {weightUnit}
          </Text>
          {recap.comparison && Math.round(recap.comparison.deltaVolumePct) !== 0 && (
            <Text
              style={[
                styles.entryDelta,
                // Up is the earned green; down reads muted, not alarmed — a
                // lighter session isn't a failure.
                { color: recap.comparison.deltaVolumePct > 0 ? POS : colors.text + '99' },
              ]}
              numberOfLines={1}
            >
              {recap.comparison.deltaVolumePct > 0 ? '+' : ''}
              {Math.round(recap.comparison.deltaVolumePct)}% vs {recap.comparison.refLabel}
            </Text>
          )}
        </RNView>
      </RNView>

      {note && (
        <Text style={[styles.entryNote, { color: colors.text }]} numberOfLines={1}>
          {note}
        </Text>
      )}

      {/* the log proper — one aligned row per exercise: name + set count left,
          top set right; the day's PR wears its marker on the row it happened. */}
      <RNView style={styles.exList}>
        {recap.lineup.map((l, i) => {
          const isPRRow = prName != null && l.name === prName;
          return (
            <RNView key={`${l.name}-${i}`} style={styles.exRow}>
              <Text style={[styles.exName, { color: colors.text }]} numberOfLines={1}>
                {l.name}
                <Text style={[styles.exSets, { color: colors.text + '55' }]}>  {l.sets}×</Text>
              </Text>
              {isPRRow && (
                <Text
                  style={[
                    styles.prTag,
                    celebrate ? { color: POS } : { color: colors.text + '80' },
                  ]}
                >
                  {celebrate && recap.prGainDisplay > 0 ? `PR +${recap.prGainDisplay}` : 'PR'}
                </Text>
              )}
              <Text
                style={[
                  styles.exSet,
                  { color: isPRRow && celebrate ? POS : colors.text + 'CC' },
                ]}
                numberOfLines={1}
              >
                {l.weight > 0 ? `${l.weight} × ${l.reps}` : `${l.reps} reps`}
              </Text>
            </RNView>
          );
        })}
      </RNView>
    </TouchableOpacity>
  );
}

interface SessionsFeedProps {
  recaps: SessionRecap[];
  weightUnit: WeightUnit;
  visibleCount: number;
  onPressSession: (w: GeneratedWorkout) => void;
  onToggleShowAll?: () => void;
  totalCount: number;
}

export default function SessionsFeed({ recaps, weightUnit, visibleCount, onPressSession, onToggleShowAll, totalCount }: SessionsFeedProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  if (recaps.length === 0) return null;

  const entries = recaps.slice(0, Math.max(1, visibleCount));
  const hasMore = totalCount > visibleCount;

  return (
    <RNView>
      {/* SESSIONS — the same micro-label header grammar as every section on the tab. */}
      <RNView style={styles.feedHead}>
        <Text style={[styles.microLabel, { color: colors.text }]}>SESSIONS</Text>
      </RNView>

      {entries.map((r, i) => (
        <RNView
          key={r.workout.id}
          style={[styles.entryWrap, { borderTopColor: colors.border }]}
        >
          <SessionEntry recap={r} weightUnit={weightUnit} celebrate={i === 0} onPress={onPressSession} />
        </RNView>
      ))}

      {onToggleShowAll && (hasMore || visibleCount > 6) && (
        <TouchableOpacity style={styles.viewAll} onPress={onToggleShowAll} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: colors.primary }]}>
            {hasMore ? `View all ${totalCount} sessions` : 'Show less'}
          </Text>
        </TouchableOpacity>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  // Career-grammar shared bits: 10/bold/tracked micro-label at ~45% + quiet 11pt meta.
  feedHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 10 },
  microLabel: { fontSize: typeScale.meta, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },
  // Log entries, separated by hairlines like every list on the tab.
  entryWrap: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10 },
  entry: { paddingTop: 14, paddingBottom: 8 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryIdentity: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  splitDot: { width: 8, height: 8, borderRadius: 4 },
  entryTitle: { fontSize: typeScale.title, fontWeight: '600', letterSpacing: -0.2, flexShrink: 1 },
  entryMeta: { fontSize: typeScale.meta, opacity: 0.5 },
  entryRight: { alignItems: 'flex-end', gap: 2 },
  entryVolume: { fontSize: typeScale.emphasis, fontWeight: '700', letterSpacing: -0.2 },
  entryDelta: { fontSize: typeScale.meta, fontWeight: '500' },
  entryNote: { fontSize: typeScale.meta, opacity: 0.5, marginTop: 6 },
  // The per-exercise table.
  exList: { marginTop: 10, gap: 8 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exName: { flex: 1, fontSize: typeScale.body },
  exSets: { fontSize: typeScale.meta },
  prTag: { fontSize: typeScale.meta, fontWeight: '700', letterSpacing: 0.3 },
  exSet: { fontSize: typeScale.emphasis, fontWeight: '600', letterSpacing: -0.2, minWidth: 64, textAlign: 'right' },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: typeScale.meta, fontWeight: '600' },
});
