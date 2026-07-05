// History widget: a full-width panel listing the user's lifts, each row showing its
// best set per month across time (oldest → newest, right-aligned so the latest
// lines up down the right edge). Month under each point makes the timeline explicit;
// left→right is time. Each point is a themed chip: the latest is an accent-filled
// "you are here" capsule, earlier ones are quiet outlined chips colored by whether
// that month rose or fell from the one before it — reusing the same green/red
// gain-loss language as ExerciseCard and TopMovers so the whole app reads as one system.
//
// The board is RANKED and CAPPED: buildLiftProgressions orders lifts by tier
// proximity × recent movement, and only the top few rows show (an "All N lifts"
// expander — the same viewAll text-button grammar as the sessions feed — holds the
// rest), so the panel reads as a short leaderboard, not a wall. The single lift
// nearest its next milestone/tier wears a primary "+X to …" tag that the NEXT
// banner below visibly answers.
//
// Color discipline (one hue = one meaning, the Career rule): the left rail is the
// lift's Push/Pull/Legs SPLIT color — the same PPL_COLORS the session emblems and
// the Career heatmap wear. Tier color appears ONLY on the TierBadge, the latest
// "you are here" chip, and the back-face progress bar. Tapping a graded row flips
// it (the Career FlipCard) to the stake: how much e1RM to the next tier.
import AnimatedBar from '@/components/AnimatedBar';
import FlipCard from '@/components/gamification/FlipCard';
import { Text } from '@/components/Themed';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS } from '@/lib/data/pplCategories';
import { getTierColor } from '@/lib/data/strengthStandards';
import { LiftProgress, LiftTier } from '@/lib/history/liftProgress';
import { NextMilestone } from '@/lib/history/milestones';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View as RNView } from 'react-native';

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

// The split-colored identity rail — SPLIT is the only thing this hue ever means
// (session emblems, Career heatmap, milestone dot). Unmapped lifts get a quiet
// neutral sliver instead of a fake team color.
function SplitRail({ lift }: { lift: LiftProgress }) {
  const { currentTheme } = useTheme();
  const color = lift.split ? PPL_COLORS[lift.split] : currentTheme.colors.text + '20';
  return <RNView style={[styles.rail, { backgroundColor: color }]} />;
}

// The focal "+X to …" tag: worn by exactly ONE row — the lift nearest its next
// milestone/tier — in the same primary the NEXT banner below uses, so the board's
// focal point and the banner read as one thread.
function FocalTag({ label }: { label: string }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  return (
    <RNView style={[styles.focalTag, { backgroundColor: colors.primary + '14' }]}>
      <Text style={[styles.focalTagText, { color: colors.primary, fontFamily: fonts.bold }]} numberOfLines={1}>
        {label}
      </Text>
    </RNView>
  );
}

// Front face of a graded row: split rail + name + micro tier badge (the flip
// affordance) + the same dense chip strip as before.
function GradedFront({ lift, tier, tag }: { lift: LiftProgress; tier: LiftTier; tag: string | null }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const tierColor = getTierColor(tier.tier);
  return (
    <RNView style={styles.face}>
      <SplitRail lift={lift} />
      <RNView style={styles.nameCol}>
        <Text style={[styles.name, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {shortName(lift.name)}
        </Text>
        <RNView style={styles.gradeRow}>
          <TierBadge tier={tier.tier} size="tiny" showTooltip={false} />
          {tag && <FocalTag label={tag} />}
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
// lacks bodyweight/gender) keeps a quiet row — split rail, no fake tiers.
function PlainRow({ lift, tag }: { lift: LiftProgress; tag: string | null }) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  return (
    <RNView style={styles.face}>
      <SplitRail lift={lift} />
      <RNView style={styles.nameCol}>
        <Text style={[styles.name, { color: colors.text, fontFamily: fonts.semiBold }]} numberOfLines={1}>
          {shortName(lift.name)}
        </Text>
        {tag && (
          <RNView style={styles.gradeRow}>
            <FocalTag label={tag} />
          </RNView>
        )}
      </RNView>
      <ChipStrip lift={lift} accent={colors.primary} />
    </RNView>
  );
}

function LiftRow({ lift, last, tag }: { lift: LiftProgress; last: boolean; tag: string | null }) {
  const { currentTheme } = useTheme();
  const divider = !last
    ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: currentTheme.colors.border }
    : null;

  if (!lift.tierInfo) {
    return (
      <RNView style={[styles.row, divider]}>
        <PlainRow lift={lift} tag={tag} />
      </RNView>
    );
  }
  return (
    <FlipCard
      height={ROW_H}
      style={divider ?? undefined}
      front={<GradedFront lift={lift} tier={lift.tierInfo} tag={tag} />}
      back={<GradedBack lift={lift} tier={lift.tierInfo} />}
    />
  );
}

// The one lift the board should pull the eye to: the NEXT banner's milestone lift
// when it's on the board, else the graded lift with the smallest absolute gap to
// its next tier. Returns the tag text keyed by lift id (or null when nothing is
// honestly close — no focal point is faked).
function focalTagFor(lifts: LiftProgress[], milestone?: NextMilestone | null): { id: string; tag: string } | null {
  if (milestone) {
    const hit = lifts.find(l => l.id === milestone.exerciseId);
    if (hit) return { id: hit.id, tag: `+${milestone.gap} to ${milestone.target}` };
  }
  let best: { id: string; tag: string; gap: number } | null = null;
  for (const l of lifts) {
    const t = l.tierInfo;
    if (!t?.nextTier || t.gapWeight == null) continue;
    if (!best || t.gapWeight < best.gap) best = { id: l.id, tag: `+${t.gapWeight} to ${t.nextTier}`, gap: t.gapWeight };
  }
  return best ? { id: best.id, tag: best.tag } : null;
}

export default function LiftProgressWidget({ lifts, milestone, maxRows = 4 }: {
  lifts: LiftProgress[];
  milestone?: NextMilestone | null;
  maxRows?: number;
}) {
  const { currentTheme } = useTheme();
  const { colors, fonts } = currentTheme;
  const [expanded, setExpanded] = useState(false);
  if (lifts.length === 0) return null;
  const anyGraded = lifts.some(l => l.tierInfo);

  const focal = focalTagFor(lifts, milestone);
  // Top ranked rows only; if the focal (NEXT-banner) lift ranks below the cut it
  // takes the last visible slot, so the banner always points at a visible row.
  let visible = expanded ? lifts : lifts.slice(0, maxRows);
  if (!expanded && focal && !visible.some(l => l.id === focal.id)) {
    const pinned = lifts.find(l => l.id === focal.id);
    if (pinned) visible = [...visible.slice(0, maxRows - 1), pinned];
  }
  const hasMore = lifts.length > visible.length || expanded;

  return (
    <RNView style={styles.panel}>
      {/* Same uppercase micro-label header grammar as the Career card (ACTIVITY / NEXT),
          so the two History sections and the Profile read as one design system. */}
      <RNView style={styles.head}>
        <Text style={[styles.headLabel, { color: colors.text + '73', fontFamily: fonts.bold }]}>LIFTS</Text>
        <Text style={[styles.headMeta, { color: colors.text + '80', fontFamily: fonts.regular }]}>
          {anyGraded ? 'closest to leveling up · tap for tier' : 'best set · by month'}
        </Text>
      </RNView>
      {visible.map((lift, i) => (
        <LiftRow
          key={lift.id}
          lift={lift}
          last={i === visible.length - 1}
          tag={focal && focal.id === lift.id ? focal.tag : null}
        />
      ))}
      {/* Same viewAll text-button grammar as the sessions feed below. */}
      {hasMore && (
        <TouchableOpacity style={styles.viewAll} onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: colors.primary, fontFamily: fonts.medium }]}>
            {expanded ? 'Show less' : `All ${lifts.length} lifts`}
          </Text>
        </TouchableOpacity>
      )}
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
  // The split-colored identity rail — the row's Push/Pull/Legs "team color", the
  // same PPL_COLORS the session emblems and the Career heatmap use.
  rail: { width: 3, borderRadius: 1.5, alignSelf: 'stretch', marginVertical: 17 },
  nameCol: { flex: 1, gap: 4 },
  name: { fontSize: 14 },
  gradeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // The single focal "+X to …" tag — primary, like the NEXT banner it points to.
  focalTag: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2, flexShrink: 1 },
  focalTagText: { fontSize: 10, letterSpacing: 0.2 },
  // Same expander grammar as the sessions feed's "View all N sessions".
  viewAll: { paddingVertical: 12, alignItems: 'center' },
  viewAllText: { fontSize: 14 },
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
