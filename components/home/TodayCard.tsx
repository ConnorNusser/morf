import Card from "@/components/Card";
import { generateRoutineText } from "@/components/workout/RoutineImportModal";
import { useTheme } from "@/contexts/ThemeContext";
import { useUser } from "@/contexts/UserContext";
import { storageService } from "@/lib/storage/storage";
import { useRoutinesChanged } from "@/lib/storage/routineEvents";
import { formatRelativeTime } from "@/lib/ui/formatters";
import { getTodayRoutine } from "@/lib/workout/activeRoutine";
import { setPendingRoutine } from "@/lib/workout/pendingRoutine";
import { calculateRoutine } from "@/lib/workout/progressiveOverload";
import { getStreakState } from "@/lib/workout/retentionSignals";
import TodayOverviewModal from "@/components/home/TodayOverviewModal";
import { CalculatedRoutine } from "@/types";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// After dismissing the "build a routine" nudge, re-surface it once this much
// time has passed (5 days).
const ROUTINE_ADVICE_COOLDOWN_MS = 5 * 24 * 60 * 60 * 1000;

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
  const { userProfile } = useUser();
  const router = useRouter();

  const [calculated, setCalculated] = useState<CalculatedRoutine | null>(null);
  const [trainedToday, setTrainedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showOverview, setShowOverview] = useState(false);
  const [adviceDismissed, setAdviceDismissed] = useState(false);
  const [lastWorkoutAt, setLastWorkoutAt] = useState<Date | null>(null);

  const weightUnit = userProfile?.weightUnitPreference || "lbs";

  // Read routines fresh from storage on every focus, so pausing or deleting a
  // routine elsewhere is reflected without restarting the app. (The routine
  // context only loads once at startup, which is why it went stale before.)
  const load = useCallback(async () => {
    try {
      const [history, dismissedAt, routines, currentRoutine] = await Promise.all([
        storageService.getWorkoutHistory(),
        storageService.getRoutineAdviceDismissedAt(),
        storageService.getRoutines(),
        storageService.getCurrentRoutine(),
      ]);
      setTrainedToday(getStreakState(history).trainedToday);

      // Advice stays hidden only until the cooldown elapses, then re-surfaces.
      setAdviceDismissed(
        dismissedAt !== null && Date.now() - dismissedAt < ROUTINE_ADVICE_COOLDOWN_MS,
      );

      const latest = history.reduce<Date | null>((max, w) => {
        const d = new Date(w.createdAt);
        return !max || d > max ? d : max;
      }, null);
      setLastWorkoutAt(latest);

      const today = getTodayRoutine(routines, currentRoutine);
      setCalculated(today ? calculateRoutine(today, history, weightUnit) : null);
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

  // Push update: refresh immediately when a routine is edited/paused/deleted
  // anywhere, even while this card is mounted-but-unfocused in the tab navigator.
  useRoutinesChanged(load);

  const handleStart = useCallback(() => {
    if (!calculated) return;
    setPendingRoutine(generateRoutineText(calculated), calculated.id);
    router.push("/workout");
  }, [calculated, router]);

  if (loading) {
    return (
      <Card variant="elevated" style={styles.loadingCard}>
        <ActivityIndicator color={currentTheme.colors.primary} />
      </Card>
    );
  }

  // No active routine — offer to start freestyle (and optionally build a routine).
  if (!calculated) {
    const freestyleSubtitle = trainedToday
      ? "You've trained today — back for more?"
      : lastWorkoutAt
        ? `Last workout ${formatRelativeTime(lastWorkoutAt)}.`
        : null;
    return (
      <Card variant="elevated">
        <Text
          style={[
            styles.eyebrow,
            {
              color: currentTheme.colors.text,
            },
          ]}
        >
          TODAY
        </Text>
        <Text
          style={[
            styles.emptyTitle,
            {
              color: currentTheme.colors.text,
            },
          ]}
        >
          Ready to train?
        </Text>
        {!adviceDismissed ? (
          <Text style={[styles.subtle, { color: currentTheme.colors.text }]}>
            Jump straight in — or build a routine for guided sessions and progress tracking.
          </Text>
        ) : freestyleSubtitle ? (
          <Text style={[styles.subtle, { color: currentTheme.colors.text }]}>
            {freestyleSubtitle}
          </Text>
        ) : null}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            { backgroundColor: currentTheme.colors.primary },
          ]}
          onPress={() => router.push("/workout")}
          activeOpacity={0.85}
        >
          <Text
            style={[
              styles.primaryButtonText,
              {
                color: currentTheme.colors.surface,
              },
            ]}
          >
            Start a workout
          </Text>
        </TouchableOpacity>

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
              <Text style={[styles.secondaryButtonText, { color: currentTheme.colors.text }]}>
                Build a routine
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={dismissAdvice} hitSlop={8} activeOpacity={0.6}>
              <Text style={[styles.dismissText, { color: currentTheme.colors.text }]}>
                Don&apos;t suggest routines
              </Text>
            </TouchableOpacity>
          </>
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
    <TouchableOpacity activeOpacity={0.9} onPress={() => setShowOverview(true)}>
    <Card variant="elevated">
      <Text
        style={[
          styles.eyebrow,
          {
            color: currentTheme.colors.text,
          },
        ]}
      >
        {(trainedToday ? "DONE TODAY" : "UP NEXT") + (label ? ` · ${label.toUpperCase()}` : "")}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          styles.routineName,
          {
            color: currentTheme.colors.text,
          },
        ]}
      >
        {calculated.name}
      </Text>
      <Text style={[styles.subtle, { color: currentTheme.colors.text }]}>
        {calculated.exercises.length} exercises · {totalSets} sets
      </Text>

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
                style={[
                  styles.exerciseName,
                  {
                    color: currentTheme.colors.text,
                    fontFamily: currentTheme.fonts.medium,
                  },
                ]}
                numberOfLines={1}
              >
                {cleanName(ex.exerciseName)}
              </Text>
              <Text style={[styles.exerciseDetail, { color: currentTheme.colors.text }]}>
                {detail}
              </Text>
            </View>
          );
        })}
      </View>

      <TouchableOpacity
        style={[
          styles.primaryButton,
          {
            backgroundColor: trainedToday
              ? currentTheme.colors.secondary
              : currentTheme.colors.primary,
          },
        ]}
        onPress={handleStart}
        activeOpacity={0.85}
      >
        <Text
          style={[
            styles.primaryButtonText,
            {
              color: trainedToday
                ? currentTheme.colors.text
                : currentTheme.colors.surface,
            },
          ]}
        >
          {trainedToday ? "Train again" : "Start workout"}
        </Text>
      </TouchableOpacity>
    </Card>
    </TouchableOpacity>

    <TodayOverviewModal
      visible={showOverview}
      onClose={() => setShowOverview(false)}
      routine={calculated}
      name={calculated.name}
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
  loadingCard: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerRight: {
    alignItems: "flex-end",
    gap: 6,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.2,
    opacity: 0.6,
    fontWeight: "600",
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pillText: {
    fontSize: 12,
  },
  routineName: {
    fontSize: 20,
    marginTop: 2,
    fontWeight: "700",
  },
  emptyTitle: {
    fontSize: 20,
    marginTop: 6,
    marginBottom: 4,
    fontWeight: "700",
  },
  subtle: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  subtleRight: {
    textAlign: "right",
  },
  exerciseList: {
    marginTop: 10,
    gap: 6,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseName: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  exerciseDetail: {
    fontSize: 14,
    opacity: 0.55,
  },
  secondaryButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 10,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  dismissText: {
    fontSize: 13,
    opacity: 0.4,
    textAlign: "center",
    marginTop: 12,
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
