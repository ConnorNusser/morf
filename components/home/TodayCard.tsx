import Card from "@/components/Card";
import StartButton from "@/components/home/StartButton";
import TodayOverviewModal from "@/components/home/TodayOverviewModal";
import IconButton from "@/components/IconButton";
import { Text, useInk } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import RecentWorkoutRow from "@/components/workout/RecentWorkoutRow";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { useWorkoutLaunch } from "@/contexts/WorkoutLaunchContext";
import { storageService } from "@/lib/storage/storage";
import { radius, space } from "@/lib/ui/tokens";
import {
  getUpNextCandidates,
  getUpNextRoutine,
} from "@/lib/workout/activeRoutine";
import { loadExerciseRecords } from "@/lib/workout/exerciseRecordsStore";
import {
  setPendingQuickStart,
  setPendingRepeatWorkout,
  setPendingRoutine,
} from "@/lib/workout/pendingRoutine";
import { calculateRoutine } from "@/lib/workout/progressiveOverload";
import { getStreakState } from "@/lib/workout/retentionSignals";
import { getExercise } from "@/lib/workout/workouts";
import { CalculatedRoutine, GeneratedWorkout } from "@/types";
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

const ROUTINE_ADVICE_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;

const CARD_MIN_HEIGHT = 200;

const EXERCISE_ROW_HEIGHT = 16;
const EXERCISE_ROW_GAP = space.md;

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
  const [days, setDays] = useState<CalculatedRoutine[]>([]);
  const [trainedToday, setTrainedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [adviceDismissed, setAdviceDismissed] = useState(false);
  const [recent, setRecent] = useState<GeneratedWorkout[]>([]);

  const weightUnit = userProfile?.weightUnitPreference || "lbs";

  // Read routines fresh from storage on every focus: the routine context only loads once at startup, so pause/delete elsewhere would go stale.
  const load = useCallback(async () => {
    try {
      const [history, dismissedAt, routines, programs, pointerId] =
        await Promise.all([
          storageService.getWorkoutHistory(),
          storageService.getRoutineAdviceDismissedAt(),
          storageService.getRoutines(),
          storageService.getPrograms(),
          storageService.getUpNextPointerId(),
        ]);
      setTrainedToday(getStreakState(history).trainedToday);

      setAdviceDismissed(
        dismissedAt !== null &&
          Date.now() - dismissedAt < ROUTINE_ADVICE_COOLDOWN_MS,
      );

      setRecent(
        [...history]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 3),
      );

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

  const dismissAdvice = useCallback(() => {
    setAdviceDismissed(true);
    storageService.setRoutineAdviceDismissedAt(Date.now());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
      onArrive: () => {
        // Start the session on arrival, not just navigate: the workout tab consumes this on focus and opens the composer.
        setPendingQuickStart();
        router.push("/workout");
      },
    });
  }, [launch, router]);

  const repeatWorkout = useCallback(
    (w: GeneratedWorkout) => {
      launch({
        routineName: w.title || "Repeat Workout",
        exercises: (w.exercises || []).map((e) =>
          cleanName(getExercise(e.id)?.name || e.id),
        ),
        onArrive: () => {
          setPendingRepeatWorkout(w);
          router.push("/workout");
        },
      });
    },
    [launch, router],
  );

  if (loading) {
    return (
      <Card style={styles.loadingCard}>
        <ActivityIndicator color={currentTheme.colors.primary} />
      </Card>
    );
  }

  if (!calculated) {
    return (
      <Card style={styles.card}>
        <View>
          <SectionLabel style={styles.eyebrow}>TODAY</SectionLabel>
          <Text
            variant="heading"
            tone="primary"
            weight="bold"
            style={styles.emptyTitle}
          >
            Ready to train?
          </Text>
        </View>

        <View>
          <StartButton
            label="Start a workout"
            onPress={startFreestyle}
            style={styles.primaryButton}
          />
          {!adviceDismissed && (
            <>
              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  { borderColor: currentTheme.colors.border },
                ]}
                onPress={() => router.push("/notes")}
                activeOpacity={0.85}
              >
                <Text variant="title" tone="primary" weight="semiBold">
                  Build a routine
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={dismissAdvice}
                // Single line of meta text; hitSlop keeps the target ≥44pt.
                hitSlop={16}
                activeOpacity={0.6}
              >
                <Text variant="meta" tone="muted" style={styles.dismissText}>
                  Don&apos;t suggest routines
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {recent.length > 0 && (
          <View style={styles.recentBlock}>
            <SectionLabel>Recent</SectionLabel>
            {recent.map((w, i) => (
              <RecentWorkoutRow
                key={w.id}
                workout={w}
                separator={i > 0}
                maxExercises={3}
                onPress={() => repeatWorkout(w)}
              />
            ))}
          </View>
        )}
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
                {/* Hairline background keeps the pager quieter than the default surface square. */}
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

          {/* Natural height — the home screen itself scrolls now, so a fixed
              7-row inner scroll window would only fight it (and waste space
              on short routines / trap long ones). */}
          <View style={[styles.exerciseList, styles.exerciseListContent]}>
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
  // Pager card owns its vertical padding (Card's default is zeroed out).
  pagerCard: {
    paddingBottom: space.sm,
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
  },
  exerciseListContent: {
    gap: EXERCISE_ROW_GAP,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    height: EXERCISE_ROW_HEIGHT,
  },
  exerciseName: {
    flex: 1,
    marginRight: space.md,
  },
  primaryButton: {
    marginTop: space.lg,
  },
  dismissText: {
    textAlign: "center",
    marginTop: space.md,
  },
  recentBlock: {
    marginTop: space.section,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: space.md,
  },
});
