// The Sessions feed — History's reflective centerpiece. Replaces the abstract
// Strength Index with a re-livable record of each gym session: the latest workout
// as a cinematic hero recap, past sessions as narrative moment cards. Every card
// leads with meaning (a headline or the standout set), not a stat dump.
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { formatCompact } from '@/lib/utils/utils';
import { SessionRecap } from '@/lib/history/sessionRecap';
import { GeneratedWorkout, WeightUnit } from '@/types';
import React from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

// Suppress the auto-generated default title ("Workout - 7/3/2026") so the eyebrow
// reads as just the day; keep real titles like "Leg Day".
const cleanTitle = (t: string): string | null => {
  const s = (t || '').trim();
  return !s || /^workout\b/i.test(s) ? null : s;
};

// Drop the trailing "(Equipment)" — matches the shortening sessionRecap's headlines
// use, so "does the headline already name this lift?" compares like with like.
const shortHeroName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

// ── one session as a feed post — the SAME anatomy for every session, the way a
// feed repeats one post shape. Header row: name + timestamp left, effort details
// (volume / sets · time) right. Content below: the narrative + top set on one
// compact line, then the lineup — what actually happened in the workout, every
// exercise with its top set.
function SessionPost({ recap, weightUnit, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const isPR = !!recap.pr;

  // One compact lead: narrative (or standout lift) + the top set, one line.
  const setText = recap.standout
    ? recap.standout.weight > 0
      ? `${recap.standout.weight} ${weightUnit} × ${recap.standout.reps}`
      : `${recap.standout.reps} reps`
    : null;
  const lead = recap.headline ?? (recap.standout ? shortHeroName(recap.standout.name) : null);
  const caption = isPR && recap.standout ? `+${recap.prGainDisplay} ${weightUnit} over your best` : null;

  // What happened: every exercise's top set, workout order.
  const lineup = recap.lineup
    .map(l => `${l.name} ${l.weight > 0 ? `${l.weight}×${l.reps}` : `×${l.reps}`}`)
    .join('  ·  ');

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(recap.workout)}
      style={styles.post}
    >
      {/* post header — identity left (bold name, quiet timestamp), effort right */}
      <RNView style={styles.postHead}>
        <RNView style={styles.postIdentity}>
          <Text style={[styles.postTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
            {cleanTitle(recap.title) ?? 'Workout'}
          </Text>
          <Text style={[styles.postWhen, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={1}>
            {formatRelativeDate(recap.workout.createdAt)}
          </Text>
        </RNView>
        <RNView style={styles.postDetails}>
          <Text style={[styles.detailMain, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
            {formatCompact(recap.volumeDisplay)} {weightUnit}
          </Text>
          <Text style={[styles.detailSub, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={1}>
            {recap.sets} sets · {recap.durationMin}m
          </Text>
        </RNView>
      </RNView>

      {/* the story: narrative + top set on one modest line, PR gain as a quiet tail */}
      {lead && (
        <Text style={[styles.postLead, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {lead}
          {setText ? (
            <Text style={[styles.postLeadSet, { color: colors.text + '99', fontFamily: fonts.medium }]}>
              {'  ·  '}{setText}
            </Text>
          ) : null}
        </Text>
      )}
      {caption && (
        <Text style={[styles.postCaption, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={1}>
          {caption}
        </Text>
      )}

      {/* what happened — the full lineup, each exercise's top set */}
      {lineup.length > 0 && (
        <Text style={[styles.postLineup, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={2}>
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
  const { colors, fonts } = currentTheme;
  if (recaps.length === 0) return null;

  const posts = recaps.slice(0, Math.max(1, visibleCount));
  const hasMore = totalCount > visibleCount;

  return (
    <RNView>
      {/* SESSIONS — the same uppercase micro-label header grammar the Career card
          (ACTIVITY, NEXT, ACHIEVEMENTS) uses, so History and Profile read as one system.
          No count meta here: the "View all N sessions" action below already states it. */}
      <RNView style={styles.feedHead}>
        <Text style={[styles.microLabel, { color: colors.text + '73', fontFamily: fonts.bold }]}>SESSIONS</Text>
      </RNView>
      {posts.map((r, i) => (
        <RNView
          key={r.workout.id}
          style={i < posts.length - 1 ? [styles.postDivider, { borderBottomColor: colors.border }] : undefined}
        >
          <SessionPost recap={r} weightUnit={weightUnit} onPress={onPressSession} />
        </RNView>
      ))}
      {onToggleShowAll && (hasMore || visibleCount > 6) && (
        <TouchableOpacity style={styles.viewAll} onPress={onToggleShowAll} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: currentTheme.colors.primary, fontFamily: currentTheme.fonts.medium }]}>
            {hasMore ? `View all ${totalCount} sessions` : 'Show less'}
          </Text>
        </TouchableOpacity>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  // posts — one repeated anatomy, separated by hairlines like a feed. No box: the
  // app's flat Card language IS the flat-post feed language.
  post: { paddingVertical: 14 },
  postDivider: { borderBottomWidth: StyleSheet.hairlineWidth },
  // Header: identity left, effort details right. A deliberately tight type ramp —
  // primaries are semiBold 15/13, secondaries regular 12 at 60% — so the post reads
  // as two organized tiers instead of a scatter of sizes and weights.
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postIdentity: { flex: 1, gap: 1 },
  postTitle: { fontSize: 15, letterSpacing: -0.2 },
  postWhen: { fontSize: 12 },
  postDetails: { alignItems: 'flex-end', gap: 1 },
  detailMain: { fontSize: 13, letterSpacing: -0.2 },
  detailSub: { fontSize: 12 },
  // The story: lead (narrative · top set) at body scale, quiet caption and lineup.
  postLead: { fontSize: 14, lineHeight: 19, letterSpacing: -0.2, marginTop: 10 },
  postLeadSet: { fontSize: 13, letterSpacing: -0.2 },
  postCaption: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  postLineup: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: 14 },
  // Career-grammar shared bits: 10/bold/tracked micro-label at ~45%.
  microLabel: { fontSize: 10, letterSpacing: 1 },
  feedHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 10 },
});
