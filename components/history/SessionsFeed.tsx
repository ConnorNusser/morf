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

const topSet = (l: { weight: number; reps: number }): string =>
  l.weight > 0 ? `${l.weight}×${l.reps}` : `${l.reps} reps`;

// ── one session as a log entry with a spine and a hero: a split-colored bar
// down the left edge (the Career activity grid's Push/Pull/Legs language),
// header (title, date · sets · time, volume right), then ONE focal line — the
// session's standout set, big — with the rest of the lineup compressed into a
// muted single breath underneath. Full detail stays a tap away in the modal.
function SessionEntry({ recap, weightUnit, celebrate, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  celebrate: boolean;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const heroName = recap.standout ? shortHeroName(recap.standout.name) : null;
  const isPRHero = recap.pr != null && heroName === shortHeroName(recap.pr.name);
  // The narrative note earns its line only when it says something the hero
  // line can't (comeback / biggest-yet); a plain "X PR" is told on the hero.
  const note = recap.headline && !/\bPR\b/.test(recap.headline) ? recap.headline : null;
  const rest = recap.lineup.filter(l => l.name !== heroName);

  return (
    <TouchableOpacity activeOpacity={0.7} onPress={() => onPress(recap.workout)} style={styles.entry}>
      <RNView
        style={[
          styles.spine,
          { backgroundColor: recap.split ? PPL_COLORS[recap.split] : colors.border },
        ]}
      />
      <RNView style={styles.entryBody}>
        {/* header — identity left, session volume right */}
        <RNView style={styles.entryHead}>
          <RNView style={styles.entryIdentity}>
            <Text style={[styles.entryTitle, { color: colors.text }]} numberOfLines={1}>
              {cleanTitle(recap.title) ?? (recap.split ? `${PPL_LABELS[recap.split]} session` : 'Workout')}
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

        {/* the hero — the session's standout working set, PR marker on the line */}
        {recap.standout && (
          <RNView style={styles.heroLine}>
            <Text
              style={[styles.heroSet, { color: isPRHero && celebrate ? POS : colors.text }]}
              numberOfLines={1}
            >
              {topSet(recap.standout)}
            </Text>
            <Text style={[styles.heroName, { color: colors.text + 'AA' }]} numberOfLines={1}>
              {heroName}
            </Text>
            {isPRHero && (
              <Text style={[styles.prTag, { color: celebrate ? POS : colors.text + '80' }]}>
                {celebrate && recap.prGainDisplay > 0 ? `PR +${recap.prGainDisplay}` : 'PR'}
              </Text>
            )}
          </RNView>
        )}

        {/* everything else, one muted breath */}
        {rest.length > 0 && (
          <Text style={[styles.restLine, { color: colors.text + '66' }]} numberOfLines={2}>
            {rest.map(l => `${topSet(l)} ${l.name}`).join('   ·   ')}
          </Text>
        )}
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
  entry: { flexDirection: 'row', paddingTop: 14, paddingBottom: 12 },
  // The split-colored spine: one committed stroke of the Push/Pull/Legs color
  // down the entry's left edge, so the feed scans as a colored timeline.
  spine: { width: 3, borderRadius: 2, marginRight: 12, alignSelf: 'stretch' },
  entryBody: { flex: 1 },
  entryHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  entryIdentity: { flex: 1, gap: 2 },
  entryTitle: { fontSize: typeScale.title, fontWeight: '600', letterSpacing: -0.2 },
  entryMeta: { fontSize: typeScale.meta, opacity: 0.5 },
  entryVolume: { fontSize: typeScale.emphasis, fontWeight: '700', letterSpacing: -0.2 },
  entryNote: { fontSize: typeScale.meta, opacity: 0.5, marginTop: 6 },
  // The hero line: one big set, its lift, its marker.
  heroLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 12 },
  heroSet: { fontSize: typeScale.heading, fontWeight: '700', letterSpacing: -0.4 },
  heroName: { fontSize: typeScale.body, fontWeight: '500', flexShrink: 1 },
  prTag: { fontSize: typeScale.meta, fontWeight: '700', letterSpacing: 0.3 },
  restLine: { fontSize: typeScale.meta, lineHeight: 19, marginTop: 8 },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: typeScale.meta, fontWeight: '600' },
});
