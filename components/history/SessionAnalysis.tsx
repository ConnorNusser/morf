// The per-session analysis block: KPI row, the standout lift, a muscle-focus
// breakdown, and every exercise with its volume share + sets. Rendered inline for
// each session on the Sessions tab (and inside the focused detail view), so a
// session reads as a full dashboard without a tap.
import AnimatedBar from "@/components/AnimatedBar";
import { prExerciseIdsForWorkout } from "@/components/history/prSessions";
import { Text, useInk } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import StatStrip from "@/components/ui/StatStrip";
import { useTheme } from "@/contexts/ThemeContext";
import { OneRMCalculator } from "@/lib/data/strengthStandards";
import { radius, space, trend } from "@/lib/ui/tokens";
import {
  calculateWorkoutStats,
  convertWeightForPreference,
  formatCompact,
  formatSet,
} from "@/lib/utils/utils";
import { getExercise } from "@/lib/workout/workouts";
import {
  convertWeight,
  GeneratedWorkout,
  TrackingType,
  WeightUnit,
} from "@/types";
import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";

const nameOf = (id: string, info?: { name?: string } | null): string =>
  info?.name || id.replace("custom_", "").replace(/-/g, " ").split("_")[0];
const shortName = (name: string): string =>
  name.replace(/\s*\([^)]*\)\s*$/, "").trim();
const cap = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

interface SessionAnalysisProps {
  workout: GeneratedWorkout;
  weightUnit: WeightUnit;
  prDays: Map<string, Set<string>>;
}

export default function SessionAnalysis({
  workout,
  weightUnit,
  prDays,
}: SessionAnalysisProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  const toDisplay = (weight: number, unit: WeightUnit) =>
    Math.round(convertWeight(weight, unit, weightUnit));
  const e1rmDisplay = (weight: number, reps: number, unit: WeightUnit): number => {
    const lbs = unit === "kg" ? convertWeight(weight, "kg", "lbs") : weight;
    const e = OneRMCalculator.estimate(lbs, reps);
    return weightUnit === "kg"
      ? Math.round(convertWeight(e, "lbs", "kg"))
      : Math.round(e);
  };

  const stats = useMemo(
    () =>
      calculateWorkoutStats(
        workout.exercises,
        (id) => getExercise(id)?.trackingType,
      ),
    [workout],
  );

  const analysis = useMemo(() => {
    const prIds = prExerciseIdsForWorkout(workout, prDays);
    const rows = workout.exercises.map((ex) => {
      const info = getExercise(ex.id);
      const isReps = (info?.trackingType || "reps") === "reps";
      const sets = ex.completedSets || [];
      let volLbs = 0;
      let best = { e1rm: 0, weight: 0, reps: 0, unit: "lbs" as WeightUnit };
      for (const s of sets) {
        const unit = s.unit || "lbs";
        const lbs =
          unit === "kg" ? convertWeight(s.weight, "kg", "lbs") : s.weight;
        volLbs += lbs * s.reps;
        if (isReps) {
          const e = e1rmDisplay(s.weight, s.reps, unit);
          if (e > best.e1rm)
            best = { e1rm: e, weight: s.weight, reps: s.reps, unit };
        }
      }
      return {
        id: ex.id,
        name: nameOf(ex.id, info),
        sets,
        trackingType: (info?.trackingType || "reps") as TrackingType,
        volLbs,
        best: best.e1rm > 0 ? best : null,
        isPR: prIds.has(ex.id),
        muscles: info?.primaryMuscles ?? [],
      };
    });

    const maxVol = Math.max(1, ...rows.map((r) => r.volLbs));
    const topLift = rows.reduce<(typeof rows)[number] | null>(
      (b, r) => (r.best && (!b?.best || r.best.e1rm > b.best.e1rm) ? r : b),
      null,
    );

    const muscle: Record<string, number> = {};
    for (const r of rows)
      for (const m of r.muscles) muscle[m] = (muscle[m] ?? 0) + r.sets.length;
    const muscleRows = Object.entries(muscle)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1]);
    const maxMuscle = Math.max(1, ...muscleRows.map(([, n]) => n));

    return { rows, maxVol, topLift, muscleRows, maxMuscle };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toDisplay/e1rmDisplay are pure, keyed by weightUnit
  }, [workout, prDays, weightUnit]);

  const volDisplay = Math.round(
    convertWeightForPreference(stats.totalVolumeLbs, "lbs", weightUnit),
  );

  return (
    <View>
      <StatStrip
        style={styles.kpis}
        items={[
          { value: formatCompact(volDisplay), label: `Volume ${weightUnit}` },
          { value: stats.totalSets, label: stats.totalSets === 1 ? "Set" : "Sets" },
          {
            value: analysis.rows.length,
            label: analysis.rows.length === 1 ? "Lift" : "Lifts",
          },
        ]}
      />

      {analysis.topLift?.best && (
        <View style={styles.standout}>
          <SectionLabel style={styles.blockLabel}>Standout</SectionLabel>
          <View style={styles.standoutRow}>
            <Text variant="emphasis" tone="primary" weight="semiBold" numberOfLines={1} style={styles.standoutName}>
              {shortName(analysis.topLift.name)}
            </Text>
            <Text variant="emphasis" tone="primary" weight="bold" style={styles.tabular}>
              {toDisplay(analysis.topLift.best.weight, analysis.topLift.best.unit)} × {analysis.topLift.best.reps}
              <Text variant="meta" tone="muted" weight="medium">
                {"  "}e1RM {analysis.topLift.best.e1rm}
              </Text>
            </Text>
          </View>
        </View>
      )}

      {analysis.muscleRows.length > 0 && (
        <View style={styles.block}>
          <SectionLabel style={styles.blockLabel}>Muscle focus</SectionLabel>
          {analysis.muscleRows.map(([m, n]) => (
            <View key={m} style={styles.mRow}>
              <Text variant="meta" tone="secondary" weight="medium" style={styles.mName}>
                {cap(m)}
              </Text>
              <AnimatedBar
                progress={n / analysis.maxMuscle}
                color={currentTheme.colors.primary}
                trackColor={ink.hairline}
                height={6}
                style={styles.flex}
              />
              <Text variant="meta" tone="muted" weight="semiBold" style={styles.mVal}>
                {n} {n === 1 ? "set" : "sets"}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.block}>
        <SectionLabel style={styles.blockLabel}>Exercises</SectionLabel>
        {analysis.rows.map((r) => (
          <View key={r.id} style={[styles.exRow, { borderTopColor: ink.hairline }]}>
            <View style={styles.exHead}>
              <View style={styles.exNameRow}>
                <Text variant="body" tone="primary" weight="semiBold" numberOfLines={1} style={styles.flexShrink}>
                  {shortName(r.name)}
                </Text>
                {r.isPR && (
                  <Text variant="meta" weight="bold" style={[styles.prTag, { color: trend.up, borderColor: trend.up }]}>
                    PR
                  </Text>
                )}
              </View>
              {r.best && (
                <Text variant="meta" tone="muted" weight="medium">
                  e1RM {r.best.e1rm}
                </Text>
              )}
            </View>
            {analysis.rows.length > 1 && (
              <AnimatedBar
                progress={r.volLbs / analysis.maxVol}
                color={ink.muted}
                trackColor={ink.hairline}
                height={3}
                style={styles.volBar}
              />
            )}
            <View style={styles.setsGrid}>
              {r.sets.map((s, i) => (
                <View key={i} style={[styles.setPill, { backgroundColor: ink.ghost }]}>
                  <Text variant="meta" tone="primary" weight="medium">
                    {formatSet(
                      {
                        weight: toDisplay(s.weight, s.unit || "lbs"),
                        reps: s.reps,
                        unit: weightUnit,
                        duration: s.duration,
                        distance: s.distance,
                      },
                      { trackingType: r.trackingType, compact: true },
                    )}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  tabular: { fontVariant: ["tabular-nums"] },
  kpis: { marginBottom: space.lg },
  block: { marginTop: space.lg },
  blockLabel: { marginBottom: space.md },
  standout: { marginTop: space.lg },
  standoutRow: { flexDirection: "row", alignItems: "baseline", gap: space.md },
  standoutName: { flex: 1 },
  mRow: { flexDirection: "row", alignItems: "center", gap: space.md, paddingVertical: space.sm },
  mName: { width: 74 },
  mVal: { minWidth: 48, textAlign: "right" },
  exRow: { paddingVertical: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  exHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: space.sm },
  exNameRow: { flexDirection: "row", alignItems: "center", gap: space.sm, flex: 1 },
  prTag: {
    borderWidth: 1,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
    letterSpacing: 0.3,
    overflow: "hidden",
  },
  volBar: { marginTop: space.sm, marginBottom: space.md },
  setsGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  setPill: { paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.badge },
});
