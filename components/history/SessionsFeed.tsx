// The Sessions feed — History's reflective centerpiece. Replaces the abstract
// Strength Index with a re-livable record of each gym session: the latest workout
// as a cinematic hero recap, past sessions as narrative moment cards. Every card
// leads with meaning (a headline or the standout set), not a stat dump.
import AnimatedBar from '@/components/AnimatedBar';
import AnimatedCount from '@/components/AnimatedCount';
import { Text } from '@/components/Themed';
import { PPL_COLORS } from '@/lib/data/pplCategories';
import { useTheme } from '@/contexts/ThemeContext';
import { formatRelativeDate } from '@/lib/ui/formatters';
import { formatCompact } from '@/lib/utils/utils';
import { SessionRecap } from '@/lib/history/sessionRecap';
import { NextMilestone } from '@/lib/history/milestones';
import { sessionIdentity } from '@/lib/history/sessionIdentity';
import { GeneratedWorkout, WeightUnit } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, ImageSourcePropType, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

const POS = '#34C759';

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

// Asymmetric by design: a bigger session is celebrated (green), a lighter one is
// stated neutrally, never punished with an alarm color. The research is clear that
// "failure"-framed regressions drive avoidance, so a deload should read as information,
// not a red mark.
function DeltaPill({ pct }: { pct: number }) {
  const { currentTheme } = useTheme();
  if (pct === 0) return null;
  const up = pct > 0;
  const color = up ? POS : currentTheme.colors.text + '70';
  return (
    <RNView style={styles.deltaRow}>
      <Ionicons name={up ? 'arrow-up' : 'arrow-down'} size={12} color={color} />
      <Text style={[styles.deltaText, { color, fontFamily: currentTheme.fonts.semiBold }]}>
        {Math.abs(pct)}%
      </Text>
    </RNView>
  );
}

// ── one session as a feed post — the SAME anatomy for every session, the way an
// Instagram feed repeats one post shape. Header (avatar + name + timestamp), then
// the content payload (the standout set as the "photo": headline, big number,
// caption), then a quiet stat row (the likes-row analog). The newest post simply
// comes first and gets the count-up; nothing else about it is special.
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
      {/* post header — avatar + stacked identity, the Instagram grammar: bold name
          ("Leg Day"), quiet timestamp underneath. The emblem is the card's single
          split-color statement. */}
      <RNView style={styles.postHead}>
        <Emblem color={id.color} emblem={id.emblem} size={40} />
        <RNView style={styles.postIdentity}>
          <Text style={[styles.postTitle, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
            {cleanTitle(recap.title) ?? 'Workout'}
          </Text>
          <Text style={[styles.postWhen, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={1}>
            {formatRelativeDate(recap.workout.createdAt)}
          </Text>
        </RNView>
        {showTrophy && (
          <RNView style={[styles.prChip, { backgroundColor: id.color }]}>
            <Ionicons name="trophy" size={10} color="#fff" />
            <Text style={[styles.prChipText, { color: '#fff', fontFamily: fonts.semiBold }]}>PR</Text>
          </RNView>
        )}
      </RNView>

      {/* content — the standout set is the post's "photo": narrative line, big number,
          quiet caption. Plain text color; scale carries the emphasis (the Career rule). */}
      {headline && (
        <Text style={[styles.postHeadline, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
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
            <Text style={[styles.standoutName, { color: colors.text + '80', fontFamily: fonts.medium }]} numberOfLines={1}>
              {caption}
            </Text>
          )}
        </RNView>
      )}

      {/* stat row — the likes-row analog: one quiet line of session effort, with the
          volume-vs-last delta riding right where a feed would put its counter. */}
      <RNView style={styles.postStats}>
        <Text style={[styles.postStatsText, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={1}>
          {formatCompact(recap.volumeDisplay)} {weightUnit} · {recap.sets} sets · {recap.durationMin}m
        </Text>
        {recap.comparison && recap.comparison.deltaVolumePct !== 0 && (
          <DeltaPill pct={recap.comparison.deltaVolumePct} />
        )}
      </RNView>
    </TouchableOpacity>
  );
}

interface SessionsFeedProps {
  recaps: SessionRecap[];
  weightUnit: WeightUnit;
  visibleCount: number;
  milestone?: NextMilestone | null;
  onPressSession: (w: GeneratedWorkout) => void;
  onToggleShowAll?: () => void;
  totalCount: number;
}

export default function SessionsFeed({ recaps, weightUnit, visibleCount, milestone, onPressSession, onToggleShowAll, totalCount }: SessionsFeedProps) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  if (recaps.length === 0) return null;

  const posts = recaps.slice(0, Math.max(1, visibleCount));
  const hasMore = totalCount > visibleCount;

  // The NEXT banner wears its goal lift's Push/Pull/Legs color end-to-end — dot,
  // "X to go" and the filling bar — so color keeps meaning split everywhere and the
  // banner stops sharing a hue with the plain "View all" actions. Primary is only
  // the fallback when the lift maps to no split.
  const milestoneColor = milestone?.split ? PPL_COLORS[milestone.split] : colors.primary;

  return (
    <RNView>
      {/* Forward pull, in the Career card's NEXT grammar: the round/plate target the
          lifter is closest to actually hitting (goal-gradient), with a filling track of
          best-so-far vs target. Honest by construction — `current` is the real best
          lifted weight, and the whole block disappears when nothing is within reach. */}
      {milestone && (
        <RNView style={[styles.milestone, { borderBottomColor: colors.text + '10' }]}>
          <RNView style={styles.milestoneHead}>
            <Text style={[styles.microLabel, { color: colors.text + '73', fontFamily: fonts.bold }]}>NEXT</Text>
            <Text style={[styles.milestoneGap, { color: milestoneColor, fontFamily: fonts.semiBold }]}>
              {milestone.gap} {milestone.unit} to go
            </Text>
          </RNView>
          <RNView style={styles.milestoneRow}>
            {/* The goal lift wears its split's dot — the same Push/Pull/Legs color the
                session emblems below and the Career heatmap use, so the color reads. */}
            {milestone.split && (
              <RNView style={[styles.milestoneSplitDot, { backgroundColor: PPL_COLORS[milestone.split] }]} />
            )}
            <Text style={[styles.milestoneName, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
              {milestone.label}
            </Text>
            <Text style={[styles.milestoneCount, { color: colors.text + '99', fontFamily: fonts.semiBold }]}>
              {milestone.current}/{milestone.target}
            </Text>
          </RNView>
          <AnimatedBar
            progress={milestone.current / milestone.target}
            color={milestoneColor}
            trackColor={colors.text + '15'}
            height={5}
            delay={150}
            style={styles.milestoneBar}
          />
        </RNView>
      )}

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
  postHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  postIdentity: { flex: 1, gap: 1 },
  postTitle: { fontSize: 15, letterSpacing: -0.2 },
  postWhen: { fontSize: 12 },
  postHeadline: { fontSize: 15, lineHeight: 20, letterSpacing: -0.2, marginTop: 10 },
  postStandout: { marginTop: 2 },
  standoutValue: { fontSize: 28, letterSpacing: -0.8 },
  standoutUnit: { fontSize: 16, letterSpacing: -0.3 },
  standoutName: { fontSize: 13, marginTop: 1 },
  postStats: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 10 },
  postStatsText: { flex: 1, fontSize: 12, lineHeight: 16 },
  // shared
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  deltaText: { fontSize: 13 },
  prChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  prChipText: { fontSize: 10, letterSpacing: 0.5 },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: 14 },
  // Career-grammar shared bits: 10/bold/tracked micro-label at ~45%.
  microLabel: { fontSize: 10, letterSpacing: 1 },
  // NEXT milestone block — hairline divider separates it from the feed below.
  milestone: { paddingTop: 14, paddingBottom: 14, marginBottom: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  milestoneHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  milestoneGap: { fontSize: 11 },
  milestoneRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 5 },
  milestoneSplitDot: { width: 9, height: 9, borderRadius: 3, marginRight: -3 },
  milestoneName: { flex: 1, fontSize: 14, letterSpacing: -0.2 },
  milestoneCount: { fontSize: 12 },
  milestoneBar: { marginTop: 8 },
  feedHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 10 },
});
