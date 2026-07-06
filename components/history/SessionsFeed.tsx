// The Sessions feed — a workout HISTORY: a volume-by-session bar chart for the
// section's at-a-glance rhythm, then the last few sessions as detailed log
// entries (header + a per-exercise table), newest first. Reads like a training
// log, not a social feed.
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS } from '@/lib/data/pplCategories';
import { formatRelativeDate } from '@/lib/ui/formatters';
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

// ── the section's glance: volume per session as BARS (one bar = one workout,
// oldest → newest, wearing the session's split color; the newest bar is full
// strength, older ones fade). Bars, deliberately not a line: sessions are discrete
// efforts, and the This Week card below already owns the weekly-trend view.
const CHART_SESSIONS = 10;
const BAR_MAX_H = 34;
const BAR_MIN_H = 6;

function VolumeBars({ recaps }: { recaps: SessionRecap[] }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const bars = recaps.slice(0, CHART_SESSIONS).reverse(); // oldest → newest
  if (bars.length < 3) return null;
  const max = Math.max(...bars.map(r => r.volumeDisplay), 1);

  return (
    <RNView style={styles.chart}>
      {bars.map((r, i) => {
        const latest = i === bars.length - 1;
        const h = BAR_MIN_H + (r.volumeDisplay / max) * (BAR_MAX_H - BAR_MIN_H);
        const color = r.split ? PPL_COLORS[r.split] : colors.primary;
        return (
          <RNView
            key={r.workout.id}
            style={[
              styles.chartBar,
              { height: h, backgroundColor: color, opacity: latest ? 1 : 0.35 + (i / bars.length) * 0.4 },
            ]}
          />
        );
      })}
    </RNView>
  );
}

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
      {/* entry header — identity left, session volume right */}
      <RNView style={styles.entryHead}>
        <RNView style={styles.entryIdentity}>
          <Text style={[styles.entryTitle, { color: colors.text }]} numberOfLines={1}>
            {cleanTitle(recap.title) ?? 'Workout'}
          </Text>
          <Text style={[styles.entryMeta, { color: colors.text }]} numberOfLines={1}>
            {formatRelativeDate(recap.workout.createdAt)} · {recap.sets} sets · {recap.durationMin}m
          </Text>
        </RNView>
        <Text style={[styles.entryVolume, { color: colors.text }]} numberOfLines={1}>
          {formatCompact(recap.volumeDisplay)} {weightUnit}
        </Text>
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
        <Text style={[styles.headMeta, { color: colors.text }]}>volume per session</Text>
      </RNView>

      <VolumeBars recaps={recaps} />

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
  microLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },
  headMeta: { fontSize: 11, opacity: 0.5 },
  // The bar chart: bottom-aligned bars, evenly spread.
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: BAR_MAX_H, marginBottom: 4 },
  chartBar: { flex: 1, borderRadius: 2.5 },
  // Log entries, separated by hairlines like every list on the tab.
  entryWrap: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 10 },
  entry: { paddingTop: 12, paddingBottom: 4 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryIdentity: { flex: 1, gap: 1 },
  entryTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  entryMeta: { fontSize: 12, opacity: 0.5 },
  entryVolume: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2 },
  entryNote: { fontSize: 12, opacity: 0.5, marginTop: 6 },
  // The per-exercise table.
  exList: { marginTop: 8, gap: 7 },
  exRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  exName: { flex: 1, fontSize: 13 },
  exSets: { fontSize: 11 },
  prTag: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  exSet: { fontSize: 13, fontWeight: '600', letterSpacing: -0.2, minWidth: 64, textAlign: 'right' },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: 13, fontWeight: '600' },
});
