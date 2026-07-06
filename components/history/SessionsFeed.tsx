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

// ── the latest session, given the cinematic treatment ────────────────────────
function SessionHero({ recap, weightUnit, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const isPR = !!recap.pr;
  // The trophy is reserved for MAJOR records so celebration stays rare and meaningful
  // (badge spam reads as childish and de-motivating past a point). Standard PRs still
  // earn the narrative headline, just not the icon.
  const showTrophy = recap.pr?.tier === 'major';
  const id = sessionIdentity(recap.title, recap.muscles);
  // One statement per fact: when the headline already names the PR lift, the caption
  // only quantifies the record; it repeats the lift name only when the headline didn't.
  const headline = recap.headline ?? (recap.standout ? recap.standout.name : recap.title);
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

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(recap.workout)}
      style={styles.hero}
    >
      {/* emblem + eyebrow. The emblem is the ONE split-color statement on the card;
          the eyebrow text stays neutral so the hero doesn't say the same hue twice. */}
      <RNView style={styles.heroEyebrow}>
        <Emblem color={id.color} emblem={id.emblem} size={40} />
        <Text style={[styles.eyebrowText, { color: colors.text + '70', fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {formatRelativeDate(recap.workout.createdAt).toUpperCase()}
          {cleanTitle(recap.title) ? ` · ${cleanTitle(recap.title)}` : ''}
        </Text>
        {showTrophy && (
          <RNView style={[styles.prChip, { backgroundColor: id.color }]}>
            <Ionicons name="trophy" size={10} color="#fff" />
            <Text style={[styles.prChipText, { color: '#fff', fontFamily: fonts.semiBold }]}>PR</Text>
          </RNView>
        )}
      </RNView>

      {/* the narrative hook — compact, one line, so the standout number below is the
          hero's ONLY hero-scale element (Career's rule: scale is reserved for numbers) */}
      <Text style={[styles.heroHeadline, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
        {headline}
      </Text>

      {/* the standout moment as a big, re-livable stat — the number counts up on entry,
          the same AnimatedCount treatment as the Career hero percentile, and like that
          hero it stays plain text color: scale carries the emphasis, not another hue.
          (Tier context lives on the LIFTS board above — its badge and flip-back already
          grade this lift, so the hero doesn't restate it.) */}
      {recap.standout && (
        <RNView style={styles.heroStandout}>
          <Text style={[styles.standoutValue, { color: colors.text, fontFamily: fonts.bold }]}>
            <AnimatedCount
              value={recap.standout.weight > 0 ? recap.standout.weight : recap.standout.reps}
              duration={900}
              style={[styles.standoutValue, { color: colors.text, fontFamily: fonts.bold }]}
            />
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

      {/* effort footer — spread across the FULL width (not clumped left) so the hero uses
          the whole card. The volume-vs-last-time delta now rides right next to the Volume
          figure it actually describes, instead of floating as its own unlabeled line that
          read as a second, disconnected comparison next to the PR gain above it. */}
      <RNView style={[styles.heroFooter, { borderTopColor: colors.text + '10' }]}>
        <FooterStat
          label="Volume"
          value={`${formatCompact(recap.volumeDisplay)} ${weightUnit}`}
          deltaPct={recap.comparison?.deltaVolumePct}
        />
        <FooterStat label="Sets" value={`${recap.sets}`} />
        <FooterStat label="Time" value={`${recap.durationMin}m`} />
      </RNView>
    </TouchableOpacity>
  );
}

function FooterStat({ label, value, deltaPct }: { label: string; value: string; deltaPct?: number }) {
  const { currentTheme } = useTheme();
  return (
    <RNView style={styles.footerStat}>
      <RNView style={styles.footerValueRow}>
        <Text style={[styles.footerValue, { color: currentTheme.colors.text, fontFamily: currentTheme.fonts.semiBold }]}>{value}</Text>
        {deltaPct != null && <DeltaPill pct={deltaPct} />}
      </RNView>
      <Text style={[styles.footerLabel, { color: currentTheme.colors.text + '55', fontFamily: currentTheme.fonts.regular }]}>{label}</Text>
    </RNView>
  );
}

// ── a past session as a compact moment card ──────────────────────────────────
function MomentCard({ recap, weightUnit, onPress }: {
  recap: SessionRecap;
  weightUnit: WeightUnit;
  onPress: (w: GeneratedWorkout) => void;
}) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const id = sessionIdentity(recap.title, recap.muscles);
  const setText = recap.standout
    ? recap.standout.weight > 0
      ? `${recap.standout.weight} ${weightUnit} × ${recap.standout.reps}`
      : `${recap.standout.reps} reps`
    : null;
  // ONE lead line per card: the headline with its set fused on ("Row PR · 160 lbs × 6"),
  // or the plain standout when there's no narrative. The old separate headline +
  // standout lines said the lift name twice and made every card four text rows deep.
  const lead = recap.headline
    ? setText
      ? `${recap.headline} · ${setText}`
      : recap.headline
    : recap.standout && setText
      ? `${shortHeroName(recap.standout.name)} · ${setText}`
      : recap.title;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(recap.workout)}
      style={[styles.moment, { borderBottomColor: colors.border }]}
    >
      {/* the split emblem gives the row a scannable, colour-coded identity */}
      <Emblem color={id.color} emblem={id.emblem} size={38} />
      <RNView style={styles.momentBody}>
        <RNView style={styles.momentTop}>
          <Text style={[styles.momentWhen, { color: colors.text + '70', fontFamily: fonts.medium }]} numberOfLines={1}>
            {formatRelativeDate(recap.workout.createdAt)}
            {cleanTitle(recap.title) ? ` · ${cleanTitle(recap.title)}` : ''}
          </Text>
          {recap.pr?.tier === 'major' && (
            <RNView style={[styles.prDot, { backgroundColor: id.color }]}>
              <Ionicons name="trophy" size={9} color="#fff" />
            </RNView>
          )}
        </RNView>

        <Text style={[styles.momentLead, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {lead}
        </Text>

        <RNView style={styles.momentMeta}>
          <Text style={[styles.momentMetaText, { color: colors.text + '60', fontFamily: fonts.regular }]} numberOfLines={1}>
            {formatCompact(recap.volumeDisplay)} {weightUnit} · {recap.sets} sets
          </Text>
          {recap.comparison && recap.comparison.deltaVolumePct !== 0 && (
            <DeltaPill pct={recap.comparison.deltaVolumePct} />
          )}
        </RNView>
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

  const [hero, ...rest] = recaps;
  const moments = rest.slice(0, Math.max(0, visibleCount - 1));
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
      <SessionHero recap={hero} weightUnit={weightUnit} onPress={onPressSession} />
      {moments.length > 0 && (
        <RNView style={styles.momentsList}>
          {moments.map(r => (
            <MomentCard key={r.workout.id} recap={r} weightUnit={weightUnit} onPress={onPressSession} />
          ))}
        </RNView>
      )}
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
  // hero — a sub-block of the shared top panel; content separated by spacing and the
  // footer rule. Vertical gaps are tightened toward Career's stat-row density.
  hero: { paddingTop: 2, paddingBottom: 6, marginBottom: 4 },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  eyebrowText: { flex: 1, fontSize: 12, letterSpacing: 0.4 },
  // ONE hero-scale element per screen: the headline sits at compact 16pt semiBold so
  // only the 34pt tier-colored standout number reads as the hero (Career's rule —
  // scale is reserved for numbers).
  heroHeadline: { fontSize: 16, lineHeight: 21, letterSpacing: -0.2 },
  heroStandout: { marginTop: 8 },
  standoutValue: { fontSize: 34, letterSpacing: -1 },
  standoutUnit: { fontSize: 18, letterSpacing: -0.3 },
  standoutName: { fontSize: 13, marginTop: 1 },
  // space-between spreads the three stats across the FULL card width instead of
  // clumping them on the left with empty space to the right.
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerStat: {},
  footerValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerValue: { fontSize: 15 },
  footerLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  // shared
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  deltaText: { fontSize: 13 },
  prChip: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  prChipText: { fontSize: 10, letterSpacing: 0.5 },
  // moments
  momentsList: { marginTop: 8 },
  moment: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  momentBody: { flex: 1 },
  momentTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  momentWhen: { fontSize: 12, letterSpacing: 0.2 },
  prDot: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  momentLead: { fontSize: 15, lineHeight: 20, letterSpacing: -0.2, marginTop: 4 },
  momentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, gap: 8 },
  momentMetaText: { flex: 1, fontSize: 12, lineHeight: 16 },
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
