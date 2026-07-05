// History widget: a full-width panel listing the user's lifts, each row showing its
// best set per month across time (oldest → newest, right-aligned so the latest
// lines up down the right edge). Month under each point makes the timeline explicit;
// left→right is time. Each point is a themed chip: the latest is an accent-filled
// "you are here" capsule, earlier ones are quiet outlined chips colored by whether
// that month rose or fell from the one before it — reusing the same green/red
// gain-loss language as ExerciseCard and TopMovers so the whole app reads as one system.
//
// Graded lifts carry their CURRENT strength tier as identity (the Career card's
// strongest visual element): a tier-colored rail + micro TierBadge, and the latest
// chip filled in the tier color. Tapping a graded row flips it (the Career FlipCard)
// to the stake: how many lbs/kg of e1RM to the next tier, with a filling band-progress
// bar — so the grid reads as a "which lift do I level up next" board.
import AnimatedBar from '@/components/AnimatedBar';
import FlipCard from '@/components/gamification/FlipCard';
import { Text } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { LiftProgress, LiftTier } from '@/lib/history/liftProgress';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, View as RNView } from 'react-native';

// Semantic gain/loss colors, matched to ExerciseCard / TopMovers so the same green
// means the same thing across every tab.
const UP = '#00C85C';
const DOWN = '#FF6B6B';

// Fixed row height — FlipCard stacks its faces absolutely, so both faces are built
// to this height and plain (ungraded) rows match it for an even rhythm.
const ROW_H = 74;

const shortName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();
const setLabel = (weight: number, reps: number): string => (weight > 0 ? `${weight}×${reps}` : `×${reps}`);
const metricOf = (p: { weight: number; reps: number }): number => (p.weight > 0 ? p.weight : p.reps);

// The month-chip strip — shared by graded fronts and ungraded plain rows.
// `accent` tints the latest "you are here" capsule (tier color when graded).
function ChipStrip({ lift, accent }: { lift: LiftProgress; accent: string }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  return (
    <RNView style={styles.points}>
      {lift.points.map((p, i) => {
        const latest = i === lift.points.length - 1;
        const prev = i > 0 ? lift.points[i - 1] : null;
        const trendColor = prev
          ? metricOf(p) > metricOf(prev)
            ? UP
            : metricOf(p) < metricOf(prev)
              ? DOWN
              : colors.text + '80'
          : colors.text + '80';

        return (
          <RNView
            key={i}
            style={[
              styles.point,
              latest
                ? { backgroundColor: accent + '16' }
                : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.set,
                {
                  color: latest ? accent : trendColor,
                  fontFamily: latest ? fonts.bold : fonts.semiBold,
                },
              ]}
              numberOfLines={1}
            >
              {setLabel(p.weight, p.reps)}
            </Text>
            <Text style={[styles.month, { color: colors.text + '55', fontFamily: fonts.medium }]}>
              {p.monthLabel}
            </Text>
          </RNView>
        );
      })}
    </RNView>
  );
}

// Front face of a graded row: tier rail + name + micro tier badge (the flip
// affordance) + the same dense chip strip as before.
function GradedFront({ lift, tier }: { lift: LiftProgress; tier: LiftTier }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const tierColor = getTierColor(tier.tier);
  return (
    <RNView style={styles.face}>
      <RNView style={[styles.rail, { backgroundColor: tierColor }]} />
      <RNView style={styles.nameCol}>
        <Text style={[styles.name, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {shortName(lift.name)}
        </Text>
        <RNView style={styles.gradeRow}>
          <TierBadge tier={tier.tier} size="tiny" showTooltip={false} />
        </RNView>
      </RNView>
      <ChipStrip lift={lift} accent={tierColor} />
    </RNView>
  );
}

// Back face: the stake. How much e1RM stands between this lift and the next tier,
// with the Career card's band-progress AnimatedBar, plus the honest month-over-month
// e1RM trend (it reads red-and-down when the lifter regresses).
function GradedBack({ lift, tier }: { lift: LiftProgress; tier: LiftTier }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const tierColor = getTierColor(tier.tier);
  const delta = tier.e1rmDelta;
  const deltaColor = delta > 0 ? UP : delta < 0 ? DOWN : colors.text + '55';

  return (
    <RNView style={styles.backFace}>
      <RNView style={styles.backHead}>
        <Text style={[styles.backLabel, { color: colors.text + '73', fontFamily: fonts.bold }]}>
          {tier.nextTier ? 'NEXT TIER' : 'MAX TIER'}
        </Text>
        <RNView style={styles.backTrend}>
          <Text style={[styles.backTrendText, { color: colors.text + '80', fontFamily: fonts.medium }]}>
            e1RM {tier.e1rm} {lift.unit}
          </Text>
          {delta !== 0 && (
            <>
              <Ionicons name={delta > 0 ? 'arrow-up' : 'arrow-down'} size={10} color={deltaColor} />
              <Text style={[styles.backTrendText, { color: deltaColor, fontFamily: fonts.semiBold }]}>
                {Math.abs(delta)}
              </Text>
            </>
          )}
        </RNView>
      </RNView>

      <RNView style={styles.backMainRow}>
        {tier.nextTier && tier.gapWeight != null ? (
          <Text style={[styles.backMain, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
            {tier.gapWeight} {lift.unit} to{' '}
            <Text style={[styles.backMain, { color: getTierColor(tier.nextTier), fontFamily: fonts.bold }]}>
              {tier.nextTier}
            </Text>
          </Text>
        ) : (
          <Text style={[styles.backMain, { color: tierColor, fontFamily: fonts.semiBold }]}>
            Max tier reached
          </Text>
        )}
        <Text style={[styles.backPct, { color: colors.text + '60', fontFamily: fonts.medium }]}>
          {tier.percentile}th pctile
        </Text>
      </RNView>

      <AnimatedBar
        progress={tier.bandProgress}
        color={tierColor}
        trackColor={colors.text + '15'}
        height={4}
        delay={120}
        style={styles.backBar}
      />
    </RNView>
  );
}

// A lift with no honest grade (no published standard, bodyweight-only, or the profile
// lacks bodyweight/gender) keeps the exact quiet row it had — no fake tiers.
function PlainRow({ lift }: { lift: LiftProgress }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  return (
    <RNView style={styles.face}>
      <Text style={[styles.name, styles.plainName, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
        {shortName(lift.name)}
      </Text>
      <ChipStrip lift={lift} accent={colors.primary} />
    </RNView>
  );
}

function LiftRow({ lift, last }: { lift: LiftProgress; last: boolean }) {
  const { currentTheme } = useTheme();
  const divider = !last
    ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: currentTheme.colors.border }
    : null;

  if (!lift.tierInfo) {
    return (
      <RNView style={[styles.row, divider]}>
        <PlainRow lift={lift} />
      </RNView>
    );
  }
  return (
    <FlipCard
      height={ROW_H}
      style={divider ?? undefined}
      front={<GradedFront lift={lift} tier={lift.tierInfo} />}
      back={<GradedBack lift={lift} tier={lift.tierInfo} />}
    />
  );
}

export default function LiftProgressWidget({ lifts }: { lifts: LiftProgress[] }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  if (lifts.length === 0) return null;
  const anyGraded = lifts.some(l => l.tierInfo);
  return (
    <RNView style={styles.panel}>
      {/* Same uppercase micro-label header grammar as the Career card (ACTIVITY / NEXT),
          so the two History sections and the Profile read as one design system. */}
      <RNView style={styles.head}>
        <Text style={[styles.headLabel, { color: colors.text + '73', fontFamily: fonts.bold }]}>LIFTS</Text>
        <Text style={[styles.headMeta, { color: colors.text + '80', fontFamily: fonts.regular }]}>
          {anyGraded ? 'best set · by month · tap for tier' : 'best set · by month'}
        </Text>
      </RNView>
      {lifts.map((lift, i) => (
        <LiftRow key={lift.id} lift={lift} last={i === lifts.length - 1} />
      ))}
    </RNView>
  );
}

const styles = StyleSheet.create({
  // Flat: no surface/border on the panel itself — rows sit on the page, separated by
  // hairline dividers, so the panel reads as a clean list, not a boxed card.
  panel: {
    paddingHorizontal: 0,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 6,
  },
  headLabel: { fontSize: 10, letterSpacing: 1 },
  headMeta: { fontSize: 11 },
  // Plain (ungraded) rows match the FlipCard rows' fixed height for an even rhythm.
  row: { height: ROW_H },
  face: {
    height: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  // The tier-colored identity rail — the row's "team color", same source as the
  // Career hero bar and the Records tier chips.
  rail: { width: 3, borderRadius: 1.5, alignSelf: 'stretch', marginVertical: 17 },
  nameCol: { flex: 1, gap: 4 },
  name: { fontSize: 14 },
  plainName: { flex: 1 },
  gradeRow: { flexDirection: 'row', alignItems: 'center' },
  points: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  // Each point is a small themed chip (matches the pill language used by delta/sort/
  // record chips elsewhere in History) rather than bare floating text.
  point: {
    alignItems: 'center',
    minWidth: 50,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  set: { fontSize: 13, letterSpacing: -0.2 },
  month: { fontSize: 9, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3 },
  // Back face — the Career NEXT-block grammar: micro-label, "X to <tier>", filling bar.
  backFace: { height: '100%', justifyContent: 'center', gap: 5 },
  backHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backLabel: { fontSize: 10, letterSpacing: 1 },
  backTrend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTrendText: { fontSize: 11 },
  backMainRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  backMain: { fontSize: 14, letterSpacing: -0.2 },
  backPct: { fontSize: 11 },
  backBar: { marginTop: 2 },
});
