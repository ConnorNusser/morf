// The Sessions feed — History's reflective centerpiece. Replaces the abstract
// Strength Index with a re-livable record of each gym session: the latest workout
// as a cinematic hero recap, past sessions as narrative moment cards. Every card
// leads with meaning (a headline or the standout set), not a stat dump.
import AnimatedCount from '@/components/AnimatedCount';
import { Text } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { formatCompact } from '@/lib/utils/utils';
import { SessionRecap } from '@/lib/history/sessionRecap';
import { sessionIdentity } from '@/lib/history/sessionIdentity';
import { GeneratedWorkout, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

// Suppress the auto-generated default title ("Workout - 7/3/2026") so the eyebrow
// reads as just the day; keep real titles like "Leg Day".
const cleanTitle = (t: string): string | null => {
  const s = (t || '').trim();
  return !s || /^workout\b/i.test(s) ? null : s;
};

// Drop the trailing "(Equipment)" — matches the shortening sessionRecap's headlines
// use, so "does the headline already name this lift?" compares like with like.
const shortHeroName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();

// The per-split visual identity: a custom white movement pictogram on a solid PPL
// circle — bold, instantly legible, giving each session a scannable, memorable face.
// `size` distinguishes hero vs moment cards.
function Emblem({ color, emblem, size }: { color: string; emblem: ImageSourcePropType; size: number }) {
  return (
    <RNView style={[styles.emblem, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Image source={emblem} style={{ width: size * 0.62, height: size * 0.62, tintColor: '#fff' }} resizeMode="contain" />
    </RNView>
  );
}

// ── one session as a feed post — the SAME anatomy for every session, the way an
// Instagram feed repeats one post shape. Header row: avatar + name + timestamp on
// the left, the session's effort details (volume / sets / time) right-aligned on
// the right. Content below: headline, the standout set, caption. The newest post
// simply comes first and gets the count-up; nothing else about it is special.
function SessionPost({ recap, weightUnit, animate, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  animate: boolean;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const isPR = !!recap.pr;
  // The trophy is reserved for MAJOR records so celebration stays rare and meaningful.
  const showTrophy = recap.pr?.tier === 'major';
  const id = sessionIdentity(recap.title, recap.muscles);

  // One statement per fact: when the headline already names the PR lift, the caption
  // only quantifies the record; it repeats the lift name only when the headline didn't.
  const headline = recap.headline ?? (recap.standout ? shortHeroName(recap.standout.name) : null);
  const headlineNamesLift =
    !!recap.standout && !!recap.headline && recap.headline.includes(shortHeroName(recap.standout.name));
  const caption = !recap.standout
    ? null
    : isPR
      ? headlineNamesLift
        ? `+${recap.prGainDisplay} ${weightUnit} over your best`
        : `${recap.standout.name} · +${recap.prGainDisplay} ${weightUnit} over your best`
      : recap.headline
        ? recap.standout.name
        : 'top set';

  const standoutValue = recap.standout
    ? recap.standout.weight > 0 ? recap.standout.weight : recap.standout.reps
    : null;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(recap.workout)}
      style={styles.post}
    >
      {/* post header — avatar + stacked identity on the left (bold name, quiet
          timestamp), the session's effort details right-aligned opposite them. The
          emblem is the card's single split-color statement. */}
      <RNView style={styles.postHead}>
        <Emblem color={id.color} emblem={id.emblem} size={40} />
        <RNView style={styles.postIdentity}>
          <RNView style={styles.postTitleRow}>
            <Text style={[styles.postTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
              {cleanTitle(recap.title) ?? 'Workout'}
            </Text>
            {showTrophy && <Ionicons name="trophy" size={12} color={id.color} />}
          </RNView>
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

      {/* content — the standout set is the post's payload: narrative line, the set
          number, quiet caption. Plain text color; scale carries the emphasis. */}
      {headline && (
        <Text style={[styles.postHeadline, { color: colors.text + 'CC', fontFamily: fonts.medium }]} numberOfLines={1}>
          {headline}
        </Text>
      )}
      {standoutValue != null && recap.standout && (
        <RNView style={styles.postStandout}>
          <Text style={[styles.standoutValue, { color: colors.text, fontFamily: fonts.bold }]}>
            {animate ? (
              <AnimatedCount
                value={standoutValue}
                duration={900}
                style={[styles.standoutValue, { color: colors.text, fontFamily: fonts.bold }]}
              />
            ) : (
              `${standoutValue}`
            )}
            <Text style={[styles.standoutUnit, { color: colors.text + '70', fontFamily: fonts.medium }]}>
              {recap.standout.weight > 0 ? ` ${weightUnit} × ${recap.standout.reps}` : ' reps'}
            </Text>
          </Text>
          {caption && (
            <Text style={[styles.standoutName, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={1}>
              {caption}
            </Text>
          )}
        </RNView>
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
          <SessionPost recap={r} weightUnit={weightUnit} animate={i === 0} onPress={onPressSession} />
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
  emblem: { alignItems: 'center', justifyContent: 'center' },
  // posts — one repeated anatomy, separated by hairlines like a feed. No box: the
  // app's flat Card language IS the flat-post feed language.
  post: { paddingVertical: 14 },
  postDivider: { borderBottomWidth: StyleSheet.hairlineWidth },
  // Header: identity left, effort details right. A deliberately tight type ramp —
  // primaries are semiBold 15/13, secondaries regular 12 at 60% — so the post reads
  // as two organized tiers instead of a scatter of sizes and weights.
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postIdentity: { flex: 1, gap: 1 },
  postTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postTitle: { fontSize: 15, letterSpacing: -0.2, flexShrink: 1 },
  postWhen: { fontSize: 12 },
  postDetails: { alignItems: 'flex-end', gap: 1 },
  detailMain: { fontSize: 13, letterSpacing: -0.2 },
  detailSub: { fontSize: 12 },
  postHeadline: { fontSize: 14, lineHeight: 19, letterSpacing: -0.2, marginTop: 10 },
  postStandout: { marginTop: 2 },
  standoutValue: { fontSize: 22, letterSpacing: -0.5 },
  standoutUnit: { fontSize: 14, letterSpacing: -0.2 },
  standoutName: { fontSize: 12, marginTop: 2 },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: 14 },
  // Career-grammar shared bits: 10/bold/tracked micro-label at ~45%.
  microLabel: { fontSize: 10, letterSpacing: 1 },
  feedHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 10 },
});
