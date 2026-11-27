// Home "Last 14 days" recap: a per-day volume strip (colored by PPL split),
// window totals, and the most-improved lift. Data from computeRecap14.
import ExerciseHistoryModal from "@/components/history/ExerciseHistoryModal";
import { Text, useInk } from "@/components/Themed";
import Divider from "@/components/ui/Divider";
import EmptyState from "@/components/ui/EmptyState";
import SectionLabel from "@/components/ui/SectionLabel";
import StatStrip from "@/components/ui/StatStrip";
import TierGlass from "@/components/ui/TierGlass";
import { useCustomExercises } from "@/contexts/CustomExercisesContext";
import { useTheme } from "@/contexts/ThemeContext";
import { PPL_COLORS } from "@/lib/data/pplCategories";
import { buildExerciseStats } from "@/lib/history/exerciseStats";
import { computeRecap14, RecapDay } from "@/lib/history/recap14";
import { storageService } from "@/lib/storage/storage";
import { radius, space, trend } from "@/lib/ui/tokens";
import { formatCompact } from "@/lib/utils/utils";
import { ExerciseWithMax, LoggedWorkout, WeightUnit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, TouchableOpacity, View } from "react-native";

const CHART_HEIGHT = 56;
const MIN_BAR = 4; // a trained day never renders thinner than this
const REST_STUB = 3;
const TODAY_DOT = 4;

const dayLabel = (d: Date) =>
  d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const shortDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const volumeLabel = (v: number, unit: WeightUnit) => `${formatCompact(v)} ${unit}`;

export default function RecapPanel() {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { customExercises } = useCustomExercises();
  const [history, setHistory] = useState<LoggedWorkout[] | null>(null);
  const [unit, setUnit] = useState<WeightUnit>("lbs");
  const [selected, setSelected] = useState<number | null>(null);
  const [historyExercise, setHistoryExercise] = useState<ExerciseWithMax | null>(null);
  // Re-stamped on focus so "today" rolls over when the app is left open overnight.
  const [now, setNow] = useState(() => new Date());

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([storageService.getWorkoutHistory(), storageService.getUserProfile()]).then(
        ([h, profile]) => {
          if (!active) return;
          setHistory(h);
          setUnit(profile?.weightUnitPreference || "lbs");
          setNow(new Date());
          setSelected(null);
        },
      );
      return () => {
        active = false;
      };
    }, []),
  );

  const recap = useMemo(
    () => (history ? computeRecap14(history, unit, now) : null),
    [history, unit, now],
  );

  // The lift-history modal takes an ExerciseWithMax; resolve it only when one exists.
  const improvedStats = useMemo(() => {
    const id = recap?.mostImproved?.exerciseId;
    if (!history || !id) return null;
    return buildExerciseStats(history, customExercises, unit).find((e) => e.id === id) ?? null;
  }, [history, customExercises, unit, recap?.mostImproved?.exerciseId]);

  if (!recap) return null;

  const { days, totals, deltaVsPrev14, mostImproved } = recap;
  const maxVolume = Math.max(1, ...days.map((d) => d.volume));
  const barColor = (d: RecapDay) =>
    d.split ? PPL_COLORS[d.split] : currentTheme.colors.primary;
  const selectedDay = selected !== null ? days[selected] : null;

  return (
    <>
      <TierGlass style={styles.panel}>
        <View style={styles.header}>
          <SectionLabel style={styles.title}>Last 14 days</SectionLabel>
          {deltaVsPrev14 !== null && totals.workouts > 0 && (
            <Text
              variant="meta"
              weight="semiBold"
              tone="secondary"
              style={
                deltaVsPrev14 !== 0
                  ? { color: deltaVsPrev14 > 0 ? trend.up : trend.down }
                  : undefined
              }
            >
              {deltaVsPrev14 > 0 ? "+" : ""}
              {deltaVsPrev14}% vs prior 14
            </Text>
          )}
        </View>

        {totals.workouts === 0 ? (
          <EmptyState
            icon="barbell-outline"
            title="Fresh start"
            subtitle="Log a workout and your two-week recap fills in here."
          />
        ) : (
          <>
            <View style={styles.chart}>
              {days.map((d, i) => {
                const isToday = i === days.length - 1;
                const trained = d.workouts > 0;
                const height = trained
                  ? Math.max(MIN_BAR, (d.volume / maxVolume) * CHART_HEIGHT)
                  : REST_STUB;
                const dimmed = selected !== null && selected !== i;
                return (
                  <Pressable
                    key={i}
                    style={styles.barSlot}
                    hitSlop={{ top: space.sm, bottom: space.sm }}
                    onPress={() => setSelected(selected === i ? null : i)}
                    accessibilityRole="button"
                    accessibilityLabel={`${dayLabel(d.date)}, ${
                      trained ? volumeLabel(d.volume, unit) : "rest day"
                    }`}
                  >
                    <View
                      style={[
                        styles.bar,
                        {
                          height,
                          backgroundColor: trained ? barColor(d) : ink.ghost,
                          opacity: dimmed ? 0.4 : 1,
                        },
                      ]}
                    />
                    <View
                      style={[
                        styles.todayDot,
                        { backgroundColor: isToday ? ink.secondary : undefined },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.caption}>
              {selectedDay ? (
                <Text variant="meta" tone="secondary" numberOfLines={1}>
                  {dayLabel(selectedDay.date)}
                  {" · "}
                  <Text variant="meta" tone="primary" weight="semiBold">
                    {selectedDay.workouts > 0
                      ? volumeLabel(selectedDay.volume, unit)
                      : "Rest day"}
                  </Text>
                </Text>
              ) : (
                <>
                  <Text variant="meta" tone="faint">
                    {shortDate(days[0].date)}
                  </Text>
                  <Text variant="meta" tone="faint">
                    Today
                  </Text>
                </>
              )}
            </View>

            <StatStrip
              style={styles.stats}
              items={[
                { value: totals.workouts, label: totals.workouts === 1 ? "Workout" : "Workouts" },
                { value: totals.activeDays, label: "Active days" },
                { value: volumeLabel(totals.volume, unit), label: "Volume" },
              ]}
            />

            <Divider />

            {mostImproved ? (
              <TouchableOpacity
                style={styles.improvedRow}
                activeOpacity={0.7}
                disabled={!improvedStats}
                onPress={() => setHistoryExercise(improvedStats)}
                accessibilityRole={improvedStats ? "button" : undefined}
              >
                <View style={styles.flex}>
                  <Text variant="meta" tone="muted">
                    Most improved
                  </Text>
                  <Text variant="body" tone="primary" weight="semiBold" numberOfLines={1}>
                    {mostImproved.name}
                  </Text>
                  <Text variant="meta" tone="secondary">
                    {mostImproved.fromE1rm} → {mostImproved.toE1rm} {unit} e1RM
                  </Text>
                </View>
                <View style={styles.gain}>
                  <Ionicons name="arrow-up" size={16} color={trend.up} />
                  <Text variant="emphasis" weight="bold" style={{ color: trend.up }}>
                    +{mostImproved.deltaPct}%
                  </Text>
                  {improvedStats && (
                    <Ionicons name="chevron-forward" size={16} color={ink.muted} />
                  )}
                </View>
              </TouchableOpacity>
            ) : (
              <Text variant="meta" tone="faint" style={styles.improvedEmpty}>
                Keep logging to see your most improved lift
              </Text>
            )}
          </>
        )}
      </TierGlass>

      <ExerciseHistoryModal
        exercise={historyExercise}
        weightUnit={unit}
        onClose={() => setHistoryExercise(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: radius.card,
    padding: space.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.md,
  },
  title: {
    marginBottom: 0,
  },
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: CHART_HEIGHT + TODAY_DOT + space.xs,
    gap: space.xs,
  },
  barSlot: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bar: {
    alignSelf: "stretch",
    borderRadius: radius.badge,
  },
  todayDot: {
    width: TODAY_DOT,
    height: TODAY_DOT,
    borderRadius: TODAY_DOT / 2,
    marginTop: space.xs,
  },
  caption: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: space.xs,
  },
  stats: {
    // Sits on the panel's glass; StatStrip's own surface fill would read as a slab.
    backgroundColor: "transparent",
    paddingVertical: space.md,
  },
  improvedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingTop: space.md,
  },
  flex: {
    flex: 1,
  },
  gain: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  improvedEmpty: {
    paddingTop: space.md,
  },
});
