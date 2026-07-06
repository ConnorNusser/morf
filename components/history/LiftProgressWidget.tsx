// History widget: a full-width panel listing the user's lifts as stacked rows —
// lift name (plus tier badge) on top, and under it every month's best set side
// by side (oldest → newest, ending "now" at the right edge). Plain value-over-
// month text columns, older months muted; the single change accent is the
// latest value tinted green/red by its month-over-month direction.
//
// The board is RANKED and CAPPED: buildLiftProgressions orders lifts by tier
// proximity × recent movement, so the top row IS the "closest to leveling up"
// story — no extra tag restates it. An "All N lifts" expander (the same viewAll
// text-button grammar as the sessions feed) holds the rest.
//
// Organized to scan as three aligned columns: a fixed tier-badge slot, the lift
// name, the chip strip. Exactly TWO color systems live on a row — tier color
// (identity: the badge + the latest chip) and green/red (change: the chip trend)
// — so the board reads calm. Split colors stay on the session emblems and the
// NEXT dot where they already mean something. Tapping a graded row flips it
// (the Career FlipCard) to the stake: how much e1RM to the next tier.
import AnimatedBar from '@/components/AnimatedBar';
import FlipCard from '@/components/gamification/FlipCard';
import TierBadge from '@/components/TierBadge';
import { useTheme } from '@/contexts/ThemeContext';
import { getTierColor } from '@/lib/data/strengthStandards';
import { LiftProgress, LiftTier } from '@/lib/history/liftProgress';
import { type as typeScale } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View as RNView } from 'react-native';

// Semantic gain/loss colors, matched to ExerciseCard / TopMovers so the same green
// means the same thing across every tab.
const UP = '#00C85C';
const DOWN = '#FF6B6B';

// Fixed row height — FlipCard stacks its faces absolutely, so both faces are built
// to this height and plain (ungraded) rows match it for an even rhythm.
const ROW_H = 76;

const shortName = (name: string): string => name.replace(/\s*\([^)]*\)\s*$/, '').trim();
const setLabel = (weight: number, reps: number): string => (weight > 0 ? `${weight}×${reps}` : `×${reps}`);
const metricOf = (p: { weight: number; reps: number }): number => (p.weight > 0 ? p.weight : p.reps);

// One layout for every row, stacked so the data line gets the full panel width:
// the lift name (with its tier badge) on top, and under it every month side by
// side — plain value-over-month columns, oldest → newest ending "now" at the
// right edge. No boxes, no per-chip colors: older months are muted text, and the
// only change accent is the latest value tinted green/red by its month-over-month
// direction. Tier color stays on the badge (identity). Ungraded lifts simply
// omit the badge — no fake tiers.
function RowFront({ lift, tier }: { lift: LiftProgress; tier: LiftTier | null }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const points = lift.points;
  const latest = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  const delta = prev ? metricOf(latest) - metricOf(prev) : 0;
  const latestColor = delta > 0 ? UP : delta < 0 ? DOWN : colors.text;

  return (
    <RNView style={styles.face}>
      <RNView style={styles.titleRow}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {shortName(lift.name)}
        </Text>
        {tier && <TierBadge tier={tier.tier} size="tiny" showTooltip={false} />}
      </RNView>
      {/* space-between spreads a full strip edge to edge; short histories keep
          their months packed at the "now" end instead of floating apart. */}
      <RNView style={[styles.monthsRow, points.length < 4 && styles.monthsRowShort]}>
        {points.map((p, i) => {
          const isLatest = i === points.length - 1;
          return (
            <RNView key={i} style={styles.monthCol}>
              <Text
                style={[styles.monthVal, { color: isLatest ? latestColor : colors.text + '77' }, isLatest && styles.monthValLatest]}
                numberOfLines={1}
              >
                {setLabel(p.weight, p.reps)}
              </Text>
              <Text style={[styles.monthLabel, { color: colors.text + '4D' }]}>
                {p.monthLabel.toUpperCase()}
              </Text>
            </RNView>
          );
        })}
      </RNView>
    </RNView>
  );
}

// Back face: the stake. How much e1RM stands between this lift and the next tier,
// with the Career card's band-progress AnimatedBar, plus the honest month-over-month
// e1RM trend (it reads red-and-down when the lifter regresses).
function GradedBack({ lift, tier }: { lift: LiftProgress; tier: LiftTier }) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const tierColor = getTierColor(tier.tier);
  const delta = tier.e1rmDelta;
  const deltaColor = delta > 0 ? UP : delta < 0 ? DOWN : colors.text + '55';

  return (
    <RNView style={styles.backFace}>
      <RNView style={styles.backHead}>
        <Text style={[styles.backLabel, { color: colors.text }]}>
          {tier.nextTier ? 'NEXT TIER' : 'MAX TIER'}
        </Text>
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

function LiftRow({ lift, last }: { lift: LiftProgress; last: boolean }) {
  const { currentTheme } = useTheme();
  const divider = !last
    ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: currentTheme.colors.border }
    : null;

  if (!lift.tierInfo) {
    return (
      <RNView style={[styles.row, divider]}>
        <RowFront lift={lift} tier={null} />
      </RNView>
    );
  }
  return (
    <FlipCard
      height={ROW_H}
      style={divider ?? undefined}
      front={<RowFront lift={lift} tier={lift.tierInfo} />}
      back={<GradedBack lift={lift} tier={lift.tierInfo} />}
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
      {/* Same uppercase micro-label header grammar as the Career card (ACTIVITY / NEXT),
          so the two History sections and the Profile read as one design system. */}
      <RNView style={styles.head}>
        <Text style={[styles.headLabel, { color: colors.text }]}>LIFTS</Text>
        <Text style={[styles.headMeta, { color: colors.text }]}>
          {anyGraded ? 'tap for next tier' : 'best set · monthly trend'}
        </Text>
      </RNView>
      {visible.map((lift, i) => (
        <LiftRow key={lift.id} lift={lift} last={i === visible.length - 1} />
      ))}
      {/* Same viewAll text-button grammar as the sessions feed below. */}
      {hasMore && (
        <TouchableOpacity style={styles.viewAll} onPress={() => setExpanded(v => !v)} activeOpacity={0.7}>
          <Text style={[styles.viewAllText, { color: colors.primary }]}>
            {expanded ? 'Show less' : `All ${lifts.length} lifts`}
          </Text>
        </TouchableOpacity>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  // No surface of its own: the board is the first sub-block of the shared top-panel
  // Card in history.tsx (the same Card grammar CareerSection lives on), separated
  // from the NEXT/SESSIONS blocks below by that panel's hairline dividers.
  panel: {
    paddingHorizontal: 0,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: 10,
  },
  headLabel: { fontSize: typeScale.meta, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },
  headMeta: { fontSize: typeScale.meta, opacity: 0.5 },
  // Plain (ungraded) rows match the FlipCard rows' fixed height for an even rhythm.
  row: { height: ROW_H },
  // Stacked: title line over the full-width data line.
  face: {
    height: '100%',
    justifyContent: 'center',
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: { fontSize: typeScale.emphasis, fontWeight: '600', flexShrink: 1 },
  // Same expander grammar as the sessions feed's "View all N sessions".
  viewAll: { paddingVertical: 16, alignItems: 'center' },
  viewAllText: { fontSize: typeScale.meta, fontWeight: '600' },
  // The month strip: every month side by side, value over label, newest at the
  // right edge. Plain text columns — no chip chrome.
  monthsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthsRowShort: {
    justifyContent: 'flex-end',
    gap: 20,
  },
  monthCol: { alignItems: 'center', gap: 1 },
  monthVal: { fontSize: typeScale.meta, fontWeight: '600', letterSpacing: -0.2 },
  monthValLatest: { fontSize: typeScale.emphasis, fontWeight: '700' },
  monthLabel: { fontSize: typeScale.meta, fontWeight: '500', letterSpacing: 0.3 },
  // Back face — the Career NEXT-block grammar: micro-label, "X to <tier>", filling bar.
  backFace: { height: '100%', justifyContent: 'center', gap: 5 },
  backHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backLabel: { fontSize: typeScale.meta, fontWeight: '700', letterSpacing: 1, opacity: 0.45 },
  backTrend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backTrendText: { fontSize: typeScale.meta, fontWeight: '500' },
  backMainRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  backMain: { fontSize: typeScale.body, fontWeight: '600', letterSpacing: -0.2 },
  backPct: { fontSize: typeScale.meta, fontWeight: '500' },
  backBar: { marginTop: 2 },
});
