import { Text, useInk } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import WeeklyOverviewModal from "@/components/WeeklyOverviewModal";
import { useTheme } from "@/contexts/ThemeContext";
import {
  MUSCLE_TO_PPL,
  PPL_COLORS,
  PPLCategory,
} from "@/lib/data/pplCategories";
import { storageService } from "@/lib/storage/storage";
import { space, trend } from "@/lib/ui/tokens";
import { formatVolume } from "@/lib/utils/utils";
import {
  DEFAULT_WEEKLY_GOAL,
  getWeeklyLoad,
  getWeekProgress,
  WEEKLY_GOAL_MAX,
  WEEKLY_GOAL_MIN,
} from "@/lib/workout/weeklyGoal";
import { getWorkoutById } from "@/lib/workout/workouts";
import { GeneratedWorkout, WeightUnit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useMemo, useState } from "react";
import { Modal, StyleSheet, TouchableOpacity, View } from "react-native";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"]; // Monday-start

// Dominant Push/Pull/Legs category for a day's workouts, by majority of each
// exercise's primary muscle. Null when nothing categorizable was logged.
function dominantPPL(workouts: GeneratedWorkout[]): PPLCategory | null {
  const counts: Record<PPLCategory, number> = { push: 0, pull: 0, legs: 0 };
  for (const workout of workouts) {
    for (const exercise of workout.exercises || []) {
      const muscle = getWorkoutById(exercise.id)?.primaryMuscles?.[0];
      const category = muscle ? MUSCLE_TO_PPL[muscle] : undefined;
      if (category) counts[category]++;
    }
  }
  if (counts.push + counts.pull + counts.legs === 0) return null;
  return (["push", "pull", "legs"] as PPLCategory[]).reduce((best, c) =>
    counts[c] > counts[best] ? c : best,
  );
}

// Accent once the weekly goal is met — the same gold as a "legendary" Career
// badge, so hitting a goal reads as the same kind of win across both surfaces.
const GOAL_MET_COLOR = "#F59E0B";

// Week-over-week volume trend colors — the shared trend tokens (green up / red down).
const TREND_UP = trend.up;
const TREND_DOWN = trend.down;

// Selectable goal values (1..7).
const GOAL_OPTIONS = Array.from(
  { length: WEEKLY_GOAL_MAX - WEEKLY_GOAL_MIN + 1 },
  (_, i) => WEEKLY_GOAL_MIN + i,
);

export default function WeeklyGoalCard() {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [history, setHistory] = useState<GeneratedWorkout[] | null>(null);
  const [goal, setGoal] = useState(DEFAULT_WEEKLY_GOAL);
  const [unit, setUnit] = useState<WeightUnit>("lbs");
  const [picking, setPicking] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Promise.all([
        storageService.getWorkoutHistory(),
        storageService.getWeeklyGoal(),
        storageService.getUserProfile(),
      ]).then(([h, g, profile]) => {
        if (!active) return;
        setHistory(h);
        setGoal(g);
        setUnit(profile?.weightUnitPreference || "lbs");
      });
      return () => {
        active = false;
      };
    }, []),
  );

  const progress = useMemo(
    () => (history ? getWeekProgress(history, goal) : null),
    [history, goal],
  );

  const load = useMemo(
    () => (history ? getWeeklyLoad(history) : null),
    [history],
  );

  const selectGoal = useCallback((next: number) => {
    setGoal(next);
    storageService.saveWeeklyGoal(next);
    setPicking(false);
  }, []);

  if (!progress) return null;

  const { daysTrained, metGoal, trainedDays, workoutsByDay, weekStart } =
    progress;

  // Flattened list of this week's completed workouts, for the overview modal.
  const thisWeekWorkouts = workoutsByDay.flat();

  // Celebrate once the goal is reached: the count takes the accent color.
  const accent = metGoal ? GOAL_MET_COLOR : currentTheme.colors.primary;

  // Each trained dot is colored by that day's Push/Pull/Legs category.
  const dayColors = workoutsByDay.map((day) => {
    const category = dominantPPL(day);
    return category ? PPL_COLORS[category] : currentTheme.colors.primary;
  });

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.7}
        onPress={() => setOverviewOpen(true)}
      >
        <View style={styles.header}>
          {/* The shared uppercase micro-label section grammar (History / Career). */}
          <SectionLabel style={styles.title}>THIS WEEK</SectionLabel>

          <TouchableOpacity
            style={styles.goalButton}
            activeOpacity={0.7}
            // The row is only ~17pt tall; hitSlop brings the effective target ≥44pt.
            hitSlop={14}
            onPress={() => setPicking(true)}
          >
            {metGoal && <Ionicons name="checkmark" size={15} color={accent} />}
            <Text
              variant="emphasis"
              tone="secondary"
              weight="semiBold"
              style={metGoal ? { color: accent } : undefined}
            >
              {daysTrained}/{goal}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={ink.muted} />
          </TouchableOpacity>
        </View>

        <View style={styles.dotRow}>
          {trainedDays.map((trained, i) => (
            <View key={i} style={styles.dayColumn}>
              <View
                style={[
                  styles.dot,
                  trained
                    ? {
                        backgroundColor: dayColors[i],
                        borderColor: dayColors[i],
                      }
                    : { borderColor: currentTheme.colors.border },
                ]}
              />
              <Text variant="meta" tone="secondary">
                {DAY_LABELS[i]}
              </Text>
            </View>
          ))}
        </View>

        {load && load.sets > 0 && (
          <View
            style={[
              styles.loadRow,
              { borderBottomColor: currentTheme.colors.border },
            ]}
          >
            <Text variant="meta" tone="secondary">
              <Text tone="primary">{formatVolume(load.volumeLbs, unit)}</Text>
              {" lifted · "}
              <Text tone="primary">{load.sets}</Text>
              {load.sets === 1 ? " set" : " sets"}
            </Text>
            {load.deltaPct !== null && (
              <View style={styles.trendChip}>
                <Text
                  variant="meta"
                  weight="semiBold"
                  tone="secondary"
                  style={
                    load.deltaPct !== 0
                      ? { color: load.deltaPct > 0 ? TREND_UP : TREND_DOWN }
                      : undefined
                  }
                >
                  {load.deltaPct > 0 ? "+" : ""}
                  {load.deltaPct}% vs last week
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>

      <WeeklyOverviewModal
        visible={overviewOpen}
        onClose={() => setOverviewOpen(false)}
        invocationType="week"
        workouts={thisWeekWorkouts}
        weekStartDate={weekStart}
        allWorkouts={history ?? undefined}
        onWeeklyGoalChange={setGoal}
      />

      <Modal
        visible={picking}
        animationType="slide"
        transparent
        onRequestClose={() => setPicking(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setPicking(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.sheet,
              { backgroundColor: currentTheme.colors.background },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text variant="title" tone="primary" weight="semiBold">
                Weekly goal
              </Text>
              <TouchableOpacity onPress={() => setPicking(false)} hitSlop={12}>
                <Ionicons
                  name="close"
                  size={22}
                  color={currentTheme.colors.text}
                />
              </TouchableOpacity>
            </View>
            <Text variant="meta" tone="secondary" style={styles.sheetSubtitle}>
              How many days a week do you want to train?
            </Text>

            <View style={styles.optionsRow}>
              {GOAL_OPTIONS.map((value) => {
                const selected = value === goal;
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => selectGoal(value)}
                    activeOpacity={0.8}
                    style={[
                      styles.option,
                      selected
                        ? {
                            backgroundColor: currentTheme.colors.primary,
                            borderColor: currentTheme.colors.primary,
                          }
                        : {
                            backgroundColor: currentTheme.colors.surface,
                            borderColor: currentTheme.colors.border,
                          },
                    ]}
                  >
                    <Text
                      variant="emphasis"
                      tone="primary"
                      weight="semiBold"
                      style={
                        selected
                          ? { color: currentTheme.colors.surface }
                          : undefined
                      }
                    >
                      {value}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Flat: no surface/border/radius — reads as inline content and saves the card's
  // padding + chrome height.
  card: {
    paddingHorizontal: 0,
    paddingVertical: space.xs,
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
  goalButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayColumn: {
    alignItems: "center",
    gap: space.sm,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
  },
  loadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: space.xs,
    paddingTop: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  trendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "#00000066",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.xl,
    paddingBottom: 34,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetSubtitle: {
    marginTop: space.xs,
    marginBottom: space.xl,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  option: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
});
