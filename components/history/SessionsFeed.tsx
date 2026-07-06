// SESSIONS — the MATCH RESULTS of the season page, directly under the LIFTS
// standings table. Each workout is a game played, told as a compact box score:
//   · the matchup line — team tick (the session's dominant Push/Pull/Legs split,
//     its "home colors") + title + when, with the FINAL SCORE at right: the
//     session's standout set in a score-cell chip ("225×5" over the lift name),
//   · the game note — the narrative headline (PR / comeback / biggest yet),
//   · the stat line — VOLUME · SETS · TIME as captioned box-score columns,
//   · the box score proper — the lineup, every exercise's top set in order.
//
// One visual system with the standings above; shared primitives, byte-for-byte
// with LiftProgressWidget:
//   1. the 10/700/tracked/45% micro-label grammar (section label + stat captions),
//   2. the SCORE CELL — value-over-micro-caption capsule, radius 8, pad 6/8,
//      "weight×reps" notation (month cells there; the final-score chip here),
//   3. the TEAM TICK — a 3×14 rounded PPL_COLORS bar before every name/title,
//   4. hairline dividers + the same viewAll text-button.
// ONE accent rule: green (UP) marks a new high. The season page's single
// celebration moment lives HERE — the latest PR session is the match-winning
// highlight: its final-score chip fills green, the headline takes the accent,
// and the gain counts up (AnimatedCount) over a short green underline sweep
// (AnimatedBar). Every other PR stays a quiet one-line note, and next week the
// highlight moves on — nothing here is permanent decoration.
import AnimatedBar from '@/components/AnimatedBar';
import AnimatedCount from '@/components/AnimatedCount';
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS, PPLCategory } from '@/lib/data/pplCategories';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { formatCompact } from '@/lib/utils/utils';
import { SessionRecap } from '@/lib/history/sessionRecap';
import { GeneratedWorkout, WeightUnit } from '@/types';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View as RNView } from 'react-native';

// Same "new high" green as the standings' form strip (and ExerciseCard/TopMovers).
const UP = '#00C85C';

// Suppress the auto-generated default title ("Workout - 7/3/2026") so the matchup
// line reads as just the day; keep real titles like "Leg Day".
const cleanTitle = (t: string): string | null => {
  const s = (t || '').trim();
  return !s || /^workout\b/i.test(s) ? null : s;
};

// Drop the trailing "(Equipment)" — matches the shortening sessionRecap's headlines
// use, so the score chip's caption and the headline name lifts the same way.
const shortHeroName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

// Shared box-score notation: "225×5", "×12" for bodyweight — identical to the
// standings table's month cells.
const setLabel = (weight: number, reps: number): string => (weight > 0 ? `${weight}×${reps}` : `×${reps}`);

// Shared primitive #3: the team tick — the session's dominant split as its team
// color, the same bar every standings row wears. Quiet neutral when unmapped.
function TeamTick({ split }: { split: PPLCategory | null }) {
  const { currentTheme } = useTheme();
  return (
    <RNView
      style={[
        styles.tick,
        { backgroundColor: split ? PPL_COLORS[split] : currentTheme.colors.text + '25' },
      ]}
    />
  );
}

// One captioned stat column of the box-score stat line.
function Stat({ value, caption }: { value: string; caption: string }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  return (
    <RNView style={styles.stat}>
      <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statCaption, { color: colors.text }]}>{caption}</Text>
    </RNView>
  );
}

// ── one session as a match report — the SAME anatomy for every game, the way a
// results page repeats one box-score shape.
function SessionPost({ recap, weightUnit, celebrated, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  celebrated: boolean;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const isPR = !!recap.pr;

  // The box score proper: every exercise's top set, workout order.
  const lineup = recap.lineup
    .map(l => `${l.name} ${setLabel(l.weight, l.reps)}`)
    .join('  ·  ');

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(recap.workout)}
      style={styles.post}
    >
      {/* matchup line — identity left, FINAL SCORE (the standout set) right */}
      <RNView style={styles.postHead}>
        <TeamTick split={recap.split} />
        <RNView style={styles.postIdentity}>
          <Text style={[styles.postTitle, { color: colors.text }]} numberOfLines={1}>
            {cleanTitle(recap.title) ?? 'Workout'}
          </Text>
          <Text style={[styles.postWhen, { color: colors.text }]} numberOfLines={1}>
            {formatRelativeDate(recap.workout.createdAt)}
          </Text>
        </RNView>
        {recap.standout && (
          <RNView
            style={[
              styles.scoreCell,
              { backgroundColor: celebrated ? UP + '18' : colors.text + '0A' },
            ]}
          >
            <Text
              style={[
                styles.scoreValue,
                { color: celebrated ? UP : colors.text, fontWeight: '700' },
              ]}
              numberOfLines={1}
            >
              {setLabel(recap.standout.weight, recap.standout.reps)}
            </Text>
            <Text style={[styles.scoreCaption, { color: colors.text + '55' }]} numberOfLines={1}>
              {shortHeroName(recap.standout.name)}
            </Text>
          </RNView>
        )}
      </RNView>

      {/* the game note — narrative headline; on the celebrated match it takes the accent */}
      {recap.headline && (
        <Text
          style={[styles.postLead, { color: celebrated ? UP : colors.text }]}
          numberOfLines={1}
        >
          {recap.headline}
        </Text>
      )}

      {/* PR gain — the season's ONE celebration on the latest PR: the number counts
          up over a short green sweep. Older PRs stay a quiet one-line note. */}
      {isPR && recap.standout && (
        celebrated ? (
          <RNView style={styles.gainBlock}>
            <AnimatedCount
              value={recap.prGainDisplay}
              prefix="+"
              suffix={` ${weightUnit} over your best`}
              duration={900}
              delay={150}
              style={[styles.gainText, { color: UP }]}
              numberOfLines={1}
            />
            <AnimatedBar
              progress={1}
              color={UP}
              trackColor={colors.text + '10'}
              height={2}
              delay={150}
              style={styles.gainBar}
            />
          </RNView>
        ) : (
          <Text style={[styles.postCaption, { color: colors.text }]} numberOfLines={1}>
            +{recap.prGainDisplay} {weightUnit} over your best
          </Text>
        )
      )}

      {/* the stat line — captioned box-score columns (micro-label grammar) */}
      <RNView style={styles.statRow}>
        <Stat value={`${formatCompact(recap.volumeDisplay)} ${weightUnit}`} caption="VOLUME" />
        <Stat value={`${recap.sets}`} caption="SETS" />
        <Stat value={`${recap.durationMin}m`} caption="TIME" />
      </RNView>

      {/* the box score proper — the full lineup, each exercise's top set */}
      {lineup.length > 0 && (
        <Text style={[styles.postLineup, { color: colors.text }]} numberOfLines={2}>
          {lineup}
        </Text>
      )}
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

  const posts = recaps.slice(0, Math.max(1, visibleCount));
  const hasMore = totalCount > visibleCount;

  // The season's single celebration: the most recent session that set a record.
  // Exactly one match on the page gets the highlight treatment; it moves on when
  // a newer PR lands and disappears entirely in a PR drought. Honest by design.
  const celebratedId = recaps.find(r => r.pr)?.workout.id ?? null;

  return (
    <RNView>
      {/* SESSIONS — the same micro-label header grammar as the LIFTS table above
          (and the Career card), with a games-played meta where LIFTS has its own. */}
      <RNView style={styles.feedHead}>
        <Text style={[styles.microLabel, { color: colors.text }]}>SESSIONS</Text>
        <Text style={[styles.headMeta, { color: colors.text }]}>
          {totalCount} logged
        </Text>
      </RNView>
      {posts.map((r, i) => (
        <RNView
          key={r.workout.id}
          style={i < posts.length - 1 ? [styles.postDivider, { borderBottomColor: colors.border }] : undefined}
        >
          <SessionPost
            recap={r}
            weightUnit={weightUnit}
            celebrated={r.workout.id === celebratedId}
            onPress={onPressSession}
          />
        </RNView>
      ))}
      {onToggleShowAll && (hasMore || visibleCount > 6) && (
        <TouchableOpacity style={styles.viewAll} onPress={onToggleShowAll} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: currentTheme.colors.primary }]}>
            {hasMore ? `View all ${totalCount} sessions` : 'Show less'}
          </Text>
        </TouchableOpacity>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  // match reports — one repeated anatomy, separated by hairlines like a results
  // page. No box: the page's flat Card language IS the flat-results language.
  post: { paddingVertical: 14 },
  postDivider: { borderBottomWidth: StyleSheet.hairlineWidth },
  // Matchup line: identity left, final score right.
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  postIdentity: { flex: 1, gap: 1 },
  postTitle: { fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  postWhen: { fontSize: 12, opacity: 0.5 },
  // Shared primitive #3: the team tick (PPL split color) — same as the standings.
  tick: { width: 3, height: 14, borderRadius: 1.5 },
  // Shared primitive #2: the SCORE CELL — the exact capsule the standings' month
  // cells use (radius 8, pad 6/8, value over micro-caption), here as FINAL SCORE.
  scoreCell: {
    alignItems: 'center',
    minWidth: 50,
    maxWidth: 120,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  scoreValue: { fontSize: 13, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  scoreCaption: { fontSize: 9, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '500' },
  // The game note + quiet PR caption.
  postLead: { fontSize: 14, fontWeight: '600', lineHeight: 19, letterSpacing: -0.2, marginTop: 10 },
  postCaption: { fontSize: 12, lineHeight: 16, marginTop: 4, opacity: 0.5 },
  // The one celebration: counting gain over a short accent sweep.
  gainBlock: { marginTop: 4, alignItems: 'flex-start', gap: 5 },
  gainText: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  gainBar: { width: 72 },
  // The stat line — captioned columns, micro-label grammar.
  statRow: { flexDirection: 'row', gap: 22, marginTop: 10 },
  stat: { gap: 2 },
  statValue: { fontSize: 13, fontWeight: '700', letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  statCaption: { fontSize: 9, fontWeight: '700', letterSpacing: 0.6, opacity: 0.4 },
  postLineup: { fontSize: 12, lineHeight: 17, marginTop: 8, opacity: 0.5 },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: 13, fontWeight: '600' },
  // Shared primitive #1: the 10/700/tracked/45% micro-label.
  microLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },
  headMeta: { fontSize: 11, opacity: 0.5 },
  feedHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 10 },
});
