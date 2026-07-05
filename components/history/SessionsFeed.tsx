// The Sessions feed — History's reflective centerpiece. Replaces the abstract
// Strength Index with a re-livable record of each gym session: the latest workout
// as a cinematic hero recap, past sessions as narrative moment cards. Every card
// leads with meaning (a headline or the standout set), not a stat dump.
import AnimatedBar from '@/components/AnimatedBar';
import AnimatedCount from '@/components/AnimatedCount';
import { Text } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { getTierColor } from '@/lib/data/strengthStandards';
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
  // The standout set's earned strength tier — graded by the SAME gradeE1rm path the
  // lift rows above use, null when there's no published standard or no bodyweight/
  // gender on the profile. Null = the hero renders exactly as before: no fake tiers.
  const tier = recap.standout?.tierInfo ?? null;
  const tierColor = tier ? getTierColor(tier.tier) : colors.text;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => onPress(recap.workout)}
      style={styles.hero}
    >
      {/* emblem + eyebrow (the day, tinted by the split's identity colour) */}
      <RNView style={styles.heroEyebrow}>
        <Emblem color={id.color} emblem={id.emblem} size={40} />
        <Text style={[styles.eyebrowText, { color: id.color, fontFamily: fonts.semiBold }]} numberOfLines={1}>
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

      {/* the emotional hook: a narrative headline, else the standout lift name */}
      <Text style={[styles.heroHeadline, { color: colors.text, fontFamily: fonts.bold }]} numberOfLines={2}>
        {recap.headline ?? (recap.standout ? `${recap.standout.name}` : recap.title)}
      </Text>

      {/* the standout moment as a big, re-livable stat — the number counts up on
          entry, the same AnimatedCount treatment as the Career hero percentile.
          Subtitle never repeats the headline: on a PR it quantifies the record,
          otherwise it names the lift. */}
      {recap.standout && (
        <RNView style={styles.heroStandout}>
          {/* The big number wears its EARNED tier color (plain text color when ungraded)
              — the same strengthStandards hue the lift rows above and the Career hero
              use, so the hero's focal figure carries meaning, not decoration. */}
          <Text style={[styles.standoutValue, { color: tierColor, fontFamily: fonts.bold }]}>
            <AnimatedCount
              value={recap.standout.weight > 0 ? recap.standout.weight : recap.standout.reps}
              duration={900}
              style={[styles.standoutValue, { color: tierColor, fontFamily: fonts.bold }]}
            />
            <Text style={[styles.standoutUnit, { color: colors.text + '70', fontFamily: fonts.medium }]}>
              {recap.standout.weight > 0 ? ` ${weightUnit} × ${recap.standout.reps}` : ' reps'}
            </Text>
          </Text>
          <Text style={[styles.standoutName, { color: colors.text + '80', fontFamily: fonts.medium }]} numberOfLines={1}>
            {isPR
              ? `${recap.standout.name} · +${recap.prGainDisplay} ${weightUnit} over your best`
              : recap.headline
                ? recap.standout.name
                : 'top set'}
          </Text>

          {/* Career's "X to Gold" mechanic on the session itself: the set's tier badge,
              how much e1RM stands between it and the NEXT tier (named in that tier's
              color), and a filling band-progress track. Derived from this session's
              actual set — a lighter day honestly reads further from the line — and the
              whole block disappears when the lift can't be graded. */}
          {tier && (
            <>
              <RNView style={styles.tierRow}>
                <TierBadge tier={tier.tier} size="tiny" showTooltip={false} />
                <Text style={[styles.tierText, { color: colors.text + '80', fontFamily: fonts.medium }]} numberOfLines={1}>
                  e1RM {tier.e1rm}
                  {tier.nextTier && tier.gapWeight != null ? (
                    <>
                      {' · '}{tier.gapWeight} {weightUnit} to{' '}
                      <Text style={[styles.tierNext, { color: getTierColor(tier.nextTier), fontFamily: fonts.bold }]}>
                        {tier.nextTier}
                      </Text>
                    </>
                  ) : (
                    ' · max tier'
                  )}
                </Text>
              </RNView>
              <AnimatedBar
                progress={tier.bandProgress}
                color={tierColor}
                trackColor={colors.text + '15'}
                height={4}
                delay={250}
                style={styles.tierBar}
              />
            </>
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
  const standoutLine = recap.standout
    ? `${recap.standout.name} · ${recap.standout.weight > 0 ? `${recap.standout.weight} ${weightUnit} × ${recap.standout.reps}` : `${recap.standout.reps} reps`}`
    : null;

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

        {/* lead with the headline if there is one, else the standout set */}
        <Text style={[styles.momentLead, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {recap.headline ?? standoutLine ?? recap.title}
        </Text>

        {/* the standout set gets its own line whenever a headline already claimed the lead,
            so it never has to be crammed into the same truncating string as volume/sets. */}
        {recap.headline && standoutLine && (
          <Text
            style={[styles.momentStandout, { color: colors.text + '80', fontFamily: fonts.regular }]}
            numberOfLines={1}
          >
            {standoutLine}
          </Text>
        )}

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
            <Text style={[styles.milestoneGap, { color: colors.primary, fontFamily: fonts.semiBold }]}>
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
            color={colors.primary}
            trackColor={colors.text + '15'}
            height={5}
            delay={150}
            style={styles.milestoneBar}
          />
        </RNView>
      )}

      {/* SESSIONS — the same uppercase micro-label header grammar the Career card
          (ACTIVITY, NEXT, ACHIEVEMENTS) uses, so History and Profile read as one system. */}
      <RNView style={styles.feedHead}>
        <Text style={[styles.microLabel, { color: colors.text + '73', fontFamily: fonts.bold }]}>SESSIONS</Text>
        <Text style={[styles.headMeta, { color: colors.text + '80', fontFamily: fonts.regular }]}>
          {totalCount} logged
        </Text>
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
  // hero — flat, full-width (no box); content separated by spacing and the footer rule
  hero: { paddingTop: 4, paddingBottom: 6, marginBottom: 4 },
  heroEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  eyebrowText: { flex: 1, fontSize: 12, letterSpacing: 0.4 },
  heroHeadline: { fontSize: 24, lineHeight: 29, letterSpacing: -0.4 },
  heroStandout: { marginTop: 14 },
  standoutValue: { fontSize: 34, letterSpacing: -1 },
  standoutUnit: { fontSize: 18, letterSpacing: -0.3 },
  standoutName: { fontSize: 13, marginTop: 1 },
  // tier context under the standout — same quiet-text + 4pt band-progress grammar as
  // the lift rows' flip-backs and the NEXT milestone block above.
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 10 },
  tierText: { flex: 1, fontSize: 12, letterSpacing: 0.1 },
  tierNext: { fontSize: 12, letterSpacing: 0.1 },
  tierBar: { marginTop: 7 },
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
  momentStandout: { fontSize: 13, lineHeight: 17, marginTop: 2 },
  momentMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 3, gap: 8 },
  momentMetaText: { flex: 1, fontSize: 12, lineHeight: 16 },
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: 14 },
  // Career-grammar shared bits: 10/bold/tracked micro-label at ~45% + quiet 11pt meta.
  microLabel: { fontSize: 10, letterSpacing: 1 },
  headMeta: { fontSize: 11 },
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
