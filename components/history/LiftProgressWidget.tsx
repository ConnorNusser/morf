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
import AnimatedBar from "@/components/AnimatedBar";
import FlipCard from "@/components/gamification/FlipCard";
import { Text, useInk } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import { useTheme } from "@/contexts/ThemeContext";
import { getTierColor } from "@/lib/data/strengthStandards";
import { LiftProgress, LiftTier } from "@/lib/history/liftProgress";
import { space, trend } from "@/lib/ui/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { View as RNView, StyleSheet, TouchableOpacity } from "react-native";

// Semantic gain/loss colors — the shared trend tokens, so the same green means
// the same thing across every tab.
const UP = trend.up;
const DOWN = trend.down;

// Fixed row height — FlipCard stacks its faces absolutely, so both faces are built
// to this height and plain (ungraded) rows match it for an even rhythm.
const ROW_H = 76;

const shortName = (name: string): string =>
  name.replace(/\s*\([^)]*\)\s*$/, "").trim();
const setLabel = (weight: number, reps: number): string =>
  weight > 0 ? `${weight}×${reps}` : `×${reps}`;
const metricOf = (p: { weight: number; reps: number }): number =>
  p.weight > 0 ? p.weight : p.reps;

// One layout for every row, stacked so the data line gets the full panel width:
// the lift name (with its tier badge) on top, and under it every month side by
// side — plain value-over-month columns, oldest → newest ending "now" at the
// right edge. No boxes, no per-chip colors: older months are muted text, and the
// only change accent is the latest value tinted green/red by its month-over-month
// direction. Tier color stays on the badge (identity). Ungraded lifts simply
// omit the badge — no fake tiers.
function RowFront({
  lift,
  tier,
}: {
  lift: LiftProgress;
  tier: LiftTier | null;
}) {
  const ink = useInk();
  const points = lift.points;
  const latest = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2] : null;
  const delta = prev ? metricOf(latest) - metricOf(prev) : 0;
  const latestColor = delta > 0 ? UP : delta < 0 ? DOWN : ink.primary;

  return (
    <RNView style={styles.face}>
      <RNView style={styles.titleRow}>
        <Text
          variant="emphasis"
          tone="primary"
          weight="semiBold"
          style={styles.name}
          numberOfLines={1}
        >
          {shortName(lift.name)}
        </Text>
      </RNView>
      {/* Left-aligned timeline: month → month → month, the arrow doing the
          "this became that" storytelling between columns. */}
      <RNView style={styles.monthsRow}>
        {points.map((p, i) => {
          const isLatest = i === points.length - 1;
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <Ionicons
                  name="arrow-forward"
                  size={11}
                  color={ink.faint}
                  style={styles.monthArrow}
                />
              )}
              <RNView style={styles.monthCol}>
                <Text
                  variant="meta"
                  weight={isLatest ? "bold" : "semiBold"}
                  style={{ color: isLatest ? latestColor : ink.muted }}
                  numberOfLines={1}
                >
                  {setLabel(p.weight, p.reps)}
                </Text>
                <Text
                  variant="meta"
                  tone="faint"
                  weight="medium"
                  style={styles.monthLabel}
                >
                  {p.monthLabel.toUpperCase()}
                </Text>
              </RNView>
            </React.Fragment>
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
  const ink = useInk();
  const tierColor = getTierColor(tier.tier);
  const delta = tier.e1rmDelta;
  const deltaColor = delta > 0 ? UP : delta < 0 ? DOWN : ink.muted;

  return (
    <RNView style={styles.backFace}>
      <RNView style={styles.backHead}>
        <SectionLabel style={styles.backLabel}>
          {tier.nextTier ? "NEXT TIER" : "MAX TIER"}
        </SectionLabel>
        <RNView style={styles.backTrend}>
          <Text variant="meta" tone="secondary" weight="medium">
            e1RM {tier.e1rm} {lift.unit}
          </Text>
          {delta !== 0 && (
            <>
              <Ionicons
                name={delta > 0 ? "arrow-up" : "arrow-down"}
                size={10}
                color={deltaColor}
              />
              <Text variant="meta" weight="semiBold" style={{ color: deltaColor }}>
                {Math.abs(delta)}
              </Text>
            </>
          )}
        </RNView>
      </RNView>

      <RNView style={styles.backMainRow}>
        {tier.nextTier && tier.gapWeight != null ? (
          <Text
            variant="body"
            tone="primary"
            weight="semiBold"
            style={styles.backMain}
            numberOfLines={1}
          >
            {tier.gapWeight} {lift.unit} to{" "}
            <Text
              variant="body"
              weight="bold"
              style={[styles.backMain, { color: getTierColor(tier.nextTier) }]}
            >
              {tier.nextTier}
            </Text>
          </Text>
        ) : (
          <Text
            variant="body"
            weight="semiBold"
            style={[styles.backMain, { color: tierColor }]}
          >
            Max tier reached
          </Text>
        )}
        <Text variant="meta" tone="muted" weight="medium">
          {tier.percentile}th pctile
        </Text>
      </RNView>

      <AnimatedBar
        progress={tier.bandProgress}
        color={tierColor}
        trackColor={ink.ghost}
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
    ? {
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: currentTheme.colors.border,
      }
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

export default function LiftProgressWidget({
  lifts,
  maxRows = 4,
}: {
  lifts: LiftProgress[];
  maxRows?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (lifts.length === 0) return null;
  const anyGraded = lifts.some((l) => l.tierInfo);

  const visible = expanded ? lifts : lifts.slice(0, maxRows);
  const hasMore = lifts.length > visible.length || expanded;

  return (
    <RNView style={styles.panel}>
      {/* Same uppercase micro-label header grammar as the Career card (ACTIVITY / NEXT),
          so the two History sections and the Profile read as one design system. */}
      <RNView style={styles.head}>
        <SectionLabel style={styles.headLabel}>LIFTS</SectionLabel>
        <Text variant="meta" tone="secondary">
          {anyGraded ? "tap for next tier" : "best set · monthly trend"}
        </Text>
      </RNView>
      {visible.map((lift, i) => (
        <LiftRow key={lift.id} lift={lift} last={i === visible.length - 1} />
      ))}
      {/* Same viewAll text-button grammar as the sessions feed below. */}
      {hasMore && (
        <TouchableOpacity
          style={styles.viewAll}
          onPress={() => setExpanded((v) => !v)}
          activeOpacity={0.7}
        >
          <Text variant="meta" weight="semiBold">
            {expanded ? "Show less" : `All ${lifts.length} lifts`}
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
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingBottom: space.md,
  },
  headLabel: { marginBottom: 0 },
  // Plain (ungraded) rows match the FlipCard rows' fixed height for an even rhythm.
  row: { height: ROW_H },
  // Stacked: title line over the full-width data line.
  face: {
    height: "100%",
    justifyContent: "center",
    gap: space.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.sm,
  },
  name: { flexShrink: 1 },
  // Same expander grammar as the sessions feed's "View all N sessions".
  viewAll: { paddingVertical: space.lg, alignItems: "center" },
  // The month strip: a left-aligned timeline of value-over-month columns with a
  // quiet arrow between each — one type size throughout, no chip chrome.
  monthsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  monthCol: { alignItems: "center", gap: 1 },
  // Raised so the arrow sits on the value line, not between the two text lines.
  monthArrow: { marginBottom: space.lg },
  monthLabel: {
    letterSpacing: 0.3,
  },
  // Back face — the Career NEXT-block grammar: micro-label, "X to <tier>", filling bar.
  backFace: { height: "100%", justifyContent: "center", gap: space.xs },
  backHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backLabel: { marginBottom: 0 },
  backTrend: { flexDirection: "row", alignItems: "center", gap: 2 },
  backMainRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: space.md,
  },
  backMain: {
    letterSpacing: -0.2,
  },
  backBar: { marginTop: 2 },
});
