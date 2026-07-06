import Card from "@/components/Card";
import StartButton from "@/components/home/StartButton";
import TodayOverviewModal from "@/components/home/TodayOverviewModal";
import IconButton from "@/components/IconButton";
import { Text, useInk } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { useWorkoutLaunch } from "@/contexts/WorkoutLaunchContext";
import { storageService } from "@/lib/storage/storage";
import { formatRelativeTime } from "@/lib/ui/formatters";
import { space } from "@/lib/ui/tokens";
import {
  getUpNextCandidates,
  getUpNextRoutine,
} from "@/lib/workout/activeRoutine";
import { loadExerciseRecords } from "@/lib/workout/exerciseRecordsStore";
import { setPendingRoutine } from "@/lib/workout/pendingRoutine";
import { calculateRoutine } from "@/lib/workout/progressiveOverload";
import { getStreakState } from "@/lib/workout/retentionSignals";
import { CalculatedRoutine } from "@/types";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Spacer from "../Spacer";

// The card's floor across loading / freestyle / routine states, so the page
// doesn't jump as it resolves or its content changes.
const CARD_MIN_HEIGHT = 200;

// Human-readable label for the routine's split type.
function splitLabel(splitType?: string): string | null {
  if (!splitType || splitType === "custom") return null;
  return splitType
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// Drop the trailing equipment suffix, e.g. "Bench Press (Barbell)" -> "Bench Press".
function cleanName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export default function TodayCard() {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { userProfile } = useUser();
  const router = useRouter();
  const launch = useWorkoutLaunch();

  const [calculated, setCalculated] = useState<CalculatedRoutine | null>(null);
  // The active program's days in ring order, so the user can flip through them.
  const [days, setDays] = useState<CalculatedRoutine[]>([]);
  const [trainedToday, setTrainedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [lastWorkoutAt, setLastWorkoutAt] = useState<Date | null>(null);

  const weightUnit = userProfile?.weightUnitPreference || "lbs";

  // Read routines fresh from storage on every focus, so pausing or deleting a
  // routine elsewhere is reflected without restarting the app. (The routine
  // context only loads once at startup, which is why it went stale before.)
  const load = useCallback(async () => {
    try {
      const [history, routines, programs, pointerId] = await Promise.all([
        storageService.getWorkoutHistory(),
        storageService.getRoutines(),
        storageService.getPrograms(),
        storageService.getUpNextPointerId(),
      ]);
      setTrainedToday(getStreakState(history).trainedToday);

      const latest = history.reduce<Date | null>((max, w) => {
        const d = new Date(w.createdAt);
        return !max || d > max ? d : max;
      }, null);
      setLastWorkoutAt(latest);

      const records = await loadExerciseRecords(history);
      const candidates = getUpNextCandidates(routines, programs);
      setDays(
        candidates.map((rt) => calculateRoutine(rt, records, weightUnit)),
      );
      const today = getUpNextRoutine(routines, programs, pointerId);
      setCalculated(
        today ? calculateRoutine(today, records, weightUnit) : null,
      );
    } catch (err) {
      console.error("TodayCard: failed to load", err);
    } finally {
      setLoading(false);
    }
  }, [weightUnit]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Flip to the previous/next day in the program ring and remember the choice,
  // so both this card and the Routines screen treat it as the new up-next.
  const flip = useCallback(
    (dir: -1 | 1) => {
      setCalculated((prev) => {
        if (days.length < 2 || !prev) return prev;
        const idx = days.findIndex((d) => d.id === prev.id);
        const base = idx < 0 ? 0 : idx;
        const next = days[(base + dir + days.length) % days.length];
        storageService.setUpNextPointerId(next.id);
        return next;
      });
    },
    [days],
  );

  // Tapping Start plays the shared launch interstitial; the navigation fires from
  // inside the overlay once its animation lands.
  const handleStart = useCallback(() => {
    if (!calculated) return;
    const sets = calculated.exercises.reduce((n, ex) => n + ex.sets.length, 0);
    launch({
      routineName: calculated.name,
      subtitle: `${calculated.exercises.length} exercises · ${sets} sets`,
      exercises: calculated.exercises.map((ex) => cleanName(ex.exerciseName)),
      onArrive: () => {
        setPendingRoutine(calculated);
        router.push("/workout");
      },
    });
  }, [calculated, launch, router]);

  const startFreestyle = useCallback(() => {
    launch({
      routineName: "Empty Workout",
      subtitle: "Freestyle — log as you go",
      onArrive: () => router.push("/workout"),
    });
  }, [launch, router]);

  if (loading) {
    return (
      <Card style={styles.loadingCard}>
        <ActivityIndicator color={currentTheme.colors.primary} />
      </Card>
    );
  }

  // No active routine — one job: start a freestyle workout.
  if (!calculated) {
    const freestyleSubtitle = trainedToday
      ? "You've trained today — back for more?"
      : lastWorkoutAt
        ? `Last workout ${formatRelativeTime(lastWorkoutAt)}.`
        : "Jump straight in — log sets as you go.";
    return (
      <Card style={styles.card}>
        <SectionLabel style={styles.eyebrow}>TODAY</SectionLabel>
        <Text
          variant="heading"
          tone="primary"
          weight="bold"
          style={styles.emptyTitle}
        >
          Ready to train?
        </Text>
        <Text variant="meta" tone="secondary">
          {freestyleSubtitle}
        </Text>

        <StartButton
          label="Start a workout"
          onPress={startFreestyle}
          style={styles.primaryButton}
        />
      </Card>
    );
  }

  const label = splitLabel(calculated.splitType);
  const totalSets = calculated.exercises.reduce(
    (sum, ex) => sum + ex.sets.length,
    0,
  );
  const exercises = calculated.exercises;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => setShowOverview(true)}
      >
        <Card padding={0} style={styles.pagerCard}>
          <View style={styles.headerRow}>
            <Text
              numberOfLines={1}
              variant="heading"
              tone="primary"
              weight="bold"
              style={styles.routineName}
            >
              {calculated.name}
            </Text>
            {days.length > 1 && (
              <View style={styles.navRow}>
                {/* Hairline background override keeps the pager quieter than the
                    default surface square. */}
                <IconButton
                  icon="chevron-back"
                  onPress={() => flip(-1)}
                  style={{ backgroundColor: ink.hairline }}
                />
                <IconButton
                  icon="chevron-forward"
                  onPress={() => flip(1)}
                  style={{ backgroundColor: ink.hairline }}
                />
              </View>
            )}
          </View>
          <View style={styles.subRow}>
            <Text variant="meta" tone="secondary">
              {calculated.exercises.length} exercises · {totalSets} sets
            </Text>
            {days.length > 1 && (
              <View style={styles.dots}>
                {days.map((d) => (
                  <View
                    key={d.id}
                    style={[
                      styles.dot,
                      {
                        backgroundColor:
                          d.id === calculated.id
                            ? currentTheme.colors.primary
                            : ink.ghost,
                      },
                    ]}
                  />
                ))}
              </View>
            )}
          </View>

          <View style={styles.exerciseList}>
            {exercises.map((ex, i) => {
              const workingSets = ex.sets.filter((s) => !s.isWarmup);
              const setCount = workingSets.length || ex.sets.length;
              const reps = (workingSets[0] ?? ex.sets[0])?.reps;
              const detail =
                ex.workingWeight > 0
                  ? `${setCount}×${reps} · ${ex.workingWeight} ${ex.unit}`
                  : `${setCount}×${reps}`;
              return (
                <View key={`${ex.exerciseId}-${i}`} style={styles.exerciseRow}>
                  <Text
                    variant="body"
                    tone="primary"
                    weight="medium"
                    style={styles.exerciseName}
                    numberOfLines={1}
                  >
                    {cleanName(ex.exerciseName)}
                  </Text>
                  <Text variant="meta" tone="secondary">
                    {detail}
                  </Text>
                </View>
              );
            })}
          </View>
          <Spacer height={12} />
          <StartButton
            label={trainedToday ? "Train again" : "Start workout"}
            variant={trainedToday ? "outlined" : "solid"}
            onPress={handleStart}
            style={styles.primaryButton}
          />
        </Card>
      </TouchableOpacity>

      <TodayOverviewModal
        visible={showOverview}
        onClose={() => setShowOverview(false)}
        routine={calculated}
        splitLabel={label}
        onStart={() => {
          setShowOverview(false);
          handleStart();
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: CARD_MIN_HEIGHT,
  },
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: CARD_MIN_HEIGHT,
  },
  eyebrow: {
    marginBottom: 0,
  },
  routineName: {
    flex: 1,
  },
  // The pager card owns its vertical padding (Card's default is zeroed out):
  // the heading sits flush at the top, with a small breath below the button.
  pagerCard: {
    paddingBottom: space.sm,
    minHeight: CARD_MIN_HEIGHT,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    marginBottom: space.lg,
  },
  navRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.lg,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: space.xs,
  },
  dots: {
    flexDirection: "row",
    gap: space.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  emptyTitle: {
    marginTop: space.sm,
    marginBottom: space.xs,
  },
  exerciseList: {
    marginTop: space.lg,
    gap: space.lg,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseName: {
    flex: 1,
    marginRight: space.md,
  },
  primaryButton: {
    marginTop: space.lg,
  },
});
