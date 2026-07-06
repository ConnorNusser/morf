// LIFTS — the STANDINGS TABLE of the season page that tops the History tab.
// Each lift is a competitor in the league: a rank numeral (buildLiftProgressions
// already orders by tier proximity × recent movement, so #1 IS the "closest to
// leveling up" story), a team-color tick (the lift's Push/Pull/Legs split — the
// same PPL hue the session results below wear), the lift name, its FORM (the
// existing best-set-per-month data as a win/loss-style month strip: green rose,
// red fell), and its GRADE (the existing tier badge) in the right column.
//
// This table and the SESSIONS results below are ONE visual system. Shared
// primitives, byte-for-byte with SessionsFeed:
//   1. the 10/700/tracked/45% micro-label grammar (section labels + column captions),
//   2. the SCORE CELL — a value-over-micro-caption capsule, radius 8, pad 6/8,
//      "weight×reps" notation (month cells here; the final-score chip there),
//   3. the TEAM TICK — a 3×14 rounded bar in PPL_COLORS before every name/title,
//   4. hairline row dividers + the same viewAll text-button.
// ONE accent rule for the whole season page: green (UP) marks a new high — here
// only as form-strip text on rising months. The single celebration moment lives
// in the SESSIONS feed (the latest PR), never here. Tier colors are grade
// identity (badge + the latest month's capsule), exactly as Records below uses
// them.
//
// Tapping a graded row flips it (the Career FlipCard) to the stake: how much
// e1RM to the next tier, with band progress. Every fact of the old board is
// kept: monthly best sets, month labels, tier, gap-to-next, percentile, e1RM
// trend. No mascots, no confetti — and every number here can go down.
import AnimatedBar from '@/components/AnimatedBar';
import FlipCard from '@/components/gamification/FlipCard';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS, PPLCategory } from '@/lib/data/pplCategories';
import { getTierColor } from '@/lib/data/strengthStandards';
import { LiftProgress, LiftTier } from '@/lib/history/liftProgress';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View as RNView } from 'react-native';

// Semantic gain/loss colors, matched to ExerciseCard / TopMovers / SessionsFeed
// so the same green means "new high" across the whole tab.
const UP = '#00C85C';
const DOWN = '#FF6B6B';

// Fixed row height — FlipCard stacks its faces absolutely, so both faces are built
// to this height and plain (ungraded) rows match it for an even rhythm.
const ROW_H = 64;

const shortName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();
// Shared box-score notation: "225×5", "×12" for bodyweight — identical to the
// final-score chip in SessionsFeed.
const setLabel = (weight: number, reps: number): string => (weight > 0 ? `${weight}×${reps}` : `×${reps}`);
const metricOf = (p: { weight: number; reps: number }): number => (p.weight > 0 ? p.weight : p.reps);

// Shared primitive #3: the team tick — a small PPL-colored bar before the name,
// the way a standings row carries its team color. Quiet neutral for unmapped lifts.
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

// The FORM column — best set per month, oldest → newest, right-aligned so the
// latest month lines up down the right edge like a standings stat column. Each
// month is a SCORE CELL (shared primitive #2): the latest is the tier-tinted
// "current form" capsule, earlier months read green/red by whether they rose or
// fell — a win/loss strip in barbell numbers.
function FormStrip({ lift, accent }: { lift: LiftProgress; accent: string }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  return (
    <RNView style={styles.form}>
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
              styles.scoreCell,
              latest
                ? { backgroundColor: accent + '16' }
                : { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.scoreValue,
                { color: latest ? accent : trendColor, fontWeight: latest ? '700' : '600' },
              ]}
              numberOfLines={1}
            >
              {setLabel(p.weight, p.reps)}
            </Text>
            <Text style={[styles.scoreCaption, { color: colors.text + '55' }]}>
              {p.monthLabel}
            </Text>
          </RNView>
        );
      })}
    </RNView>
  );
}

// One standings row, front face: rank · team tick · name · grade on the top
// line, the FORM strip beneath. Ungraded lifts keep the grade column honest
// with a quiet em-dash — no fake tiers.
function RowFront({ lift, rank, tier }: { lift: LiftProgress; rank: number; tier: LiftTier | null }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const accent = tier ? getTierColor(tier.tier) : colors.primary;
  return (
    <RNView style={styles.face}>
      <RNView style={styles.rowTop}>
        <Text style={[styles.rank, { color: colors.text + '40' }]}>{rank}</Text>
        <TeamTick split={lift.split} />
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {shortName(lift.name)}
        </Text>
        {tier ? (
          <TierBadge tier={tier.tier} size="tiny" showTooltip={false} />
        ) : (
          <Text style={[styles.gradeGhost, { color: colors.text + '30' }]}>—</Text>
        )}
      </RNView>
      <FormStrip lift={lift} accent={accent} />
    </RNView>
  );
}

// Back face: the stake. How much e1RM stands between this competitor and the
// next grade, with the Career card's band-progress AnimatedBar, plus the honest
// month-over-month e1RM trend (it reads red-and-down when the lifter regresses).
function GradedBack({ lift, rank, tier }: { lift: LiftProgress; rank: number; tier: LiftTier }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const tierColor = getTierColor(tier.tier);
  const delta = tier.e1rmDelta;
  const deltaColor = delta > 0 ? UP : delta < 0 ? DOWN : colors.text + '55';

  return (
    <RNView style={styles.backFace}>
      <RNView style={styles.backHead}>
        <RNView style={styles.backIdentity}>
          <Text style={[styles.rank, { color: colors.text + '40' }]}>{rank}</Text>
          <TeamTick split={lift.split} />
          <Text style={[styles.microLabel, { color: colors.text }]}>
            {tier.nextTier ? 'NEXT TIER' : 'MAX TIER'}
          </Text>
        </RNView>
        <RNView style={styles.backTrend}>
          <Text style={[styles.backTrendText, { color: colors.text + '80' }]}>
            e1RM {tier.e1rm} {lift.unit}
          </Text>
          {delta !== 0 && (
            <>
              <Ionicons name={delta > 0 ? 'arrow-up' : 'arrow-down'} size={10} color={deltaColor} />
              <Text style={[styles.backTrendText, { color: deltaColor, fontWeight: '600' }]}>
                {Math.abs(delta)}
              </Text>
            </>
          )}
        </RNView>
      </RNView>

      <RNView style={styles.backMainRow}>
        {tier.nextTier && tier.gapWeight != null ? (
          <Text style={[styles.backMain, { color: colors.text }]} numberOfLines={1}>
            {tier.gapWeight} {lift.unit} to{' '}
            <Text style={[styles.backMain, { color: getTierColor(tier.nextTier), fontWeight: '700' }]}>
              {tier.nextTier}
            </Text>
          </Text>
        ) : (
          <Text style={[styles.backMain, { color: tierColor }]}>
            Max tier reached
          </Text>
        )}
        <Text style={[styles.backPct, { color: colors.text + '60' }]}>
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

function LiftRow({ lift, rank, last }: { lift: LiftProgress; rank: number; last: boolean }) {
  const { currentTheme } = useTheme();
  const divider = !last
    ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: currentTheme.colors.border }
    : null;

  if (!lift.tierInfo) {
    return (
      <RNView style={[styles.row, divider]}>
        <RowFront lift={lift} rank={rank} tier={null} />
      </RNView>
    );
  }
  return (
    <FlipCard
      height={ROW_H}
      style={divider ?? undefined}
      front={<RowFront lift={lift} rank={rank} tier={lift.tierInfo} />}
      back={<GradedBack lift={lift} rank={rank} tier={lift.tierInfo} />}
    />
  );
}

export default function LiftProgressWidget({ lifts, maxRows = 4 }: {
  lifts: LiftProgress[];
  maxRows?: number;
}) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const [expanded, setExpanded] = useState(false);
  if (lifts.length === 0) return null;
  const anyGraded = lifts.some(l => l.tierInfo);

  const visible = expanded ? lifts : lifts.slice(0, maxRows);
  const hasMore = lifts.length > visible.length || expanded;

  return (
    <RNView style={styles.panel}>
      {/* Section label — the same micro-label grammar as SESSIONS below and the
          Career card (ACTIVITY / NEXT), so the season page reads as one system. */}
      <RNView style={styles.head}>
        <Text style={[styles.microLabel, { color: colors.text }]}>LIFTS</Text>
        <Text style={[styles.headMeta, { color: colors.text }]}>
          {anyGraded ? 'best set by month · tap for next tier' : 'best set · by month'}
        </Text>
      </RNView>
      {/* Column captions — the standings-table header row. */}
      <RNView style={[styles.captions, { borderBottomColor: colors.border }]}>
        <Text style={[styles.microLabel, { color: colors.text }]}>LIFT</Text>
        <Text style={[styles.microLabel, { color: colors.text }]}>FORM · GRADE</Text>
      </RNView>
      {visible.map((lift, i) => (
        <LiftRow key={lift.id} lift={lift} rank={i + 1} last={i === visible.length - 1} />
      ))}
      {/* Same viewAll text-button grammar as the sessions results below. */}
      {hasMore && (
        <TouchableOpacity style={styles.viewAll} onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: colors.primary }]}>
            {expanded ? 'Show less' : `View all ${lifts.length} lifts`}
          </Text>
        </TouchableOpacity>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  // No surface of its own: the table is the first sub-block of the shared top-panel
  // Card in history.tsx, separated from SESSIONS by that panel's hairline divider —
  // the same flatness as Records / This Week below.
  panel: {
    paddingHorizontal: 0,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 8,
  },
  // Shared primitive #1: the 10/700/tracked/45% micro-label — section labels,
  // column captions, and SessionsFeed's stat captions all speak this.
  microLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },
  headMeta: { fontSize: 11, opacity: 0.5 },
  captions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Plain (ungraded) rows match the FlipCard rows' fixed height for an even rhythm.
  row: { height: ROW_H },
  face: {
    height: '100%',
    justifyContent: 'center',
    gap: 5,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  // Rank numeral — the league position (the data is already ranked by tier
  // proximity × movement, so this is honest and it can fall).
  rank: {
    width: 14,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  // Shared primitive #3: the team tick (PPL split color).
  tick: { width: 3, height: 14, borderRadius: 1.5 },
  name: { flex: 1, fontSize: 15, fontWeight: '600', letterSpacing: -0.2 },
  gradeGhost: { fontSize: 12, fontWeight: '600' },
  // Same expander grammar as the sessions results' "View all N sessions".
  viewAll: { paddingVertical: 12, alignItems: 'center' },
  viewAllText: { fontSize: 13, fontWeight: '600' },
  form: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  // Shared primitive #2: the SCORE CELL — value over micro-caption in a radius-8
  // capsule. SessionsFeed's final-score chip is this exact shape.
  scoreCell: {
    alignItems: 'center',
    minWidth: 50,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  scoreValue: { fontSize: 13, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
  scoreCaption: { fontSize: 9, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3, fontWeight: '500' },
  // Back face — the Career NEXT-block grammar: micro-label, "X to <tier>", filling bar.
  backFace: { height: '100%', justifyContent: 'center', gap: 5 },
  backHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backIdentity: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  backTrend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTrendText: { fontSize: 11, fontWeight: '500' },
  backMainRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  backMain: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  backPct: { fontSize: 11, fontWeight: '500' },
  backBar: { marginTop: 2 },
});
