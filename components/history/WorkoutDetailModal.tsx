import { useAlert } from "@/components/CustomAlert";
import IconButton from "@/components/IconButton";
import SessionAnalysis from "@/components/history/SessionAnalysis";
import { Text, useInk } from "@/components/Themed";
import ScreenModal from "@/components/ui/ScreenModal";
import { useTheme } from "@/contexts/ThemeContext";
import { screenGutter, space, tint } from "@/lib/ui/tokens";
import { lineHeightFor, type } from "@/lib/ui/typography";
import { formatMinutes } from "@/lib/utils/utils";
import playHapticFeedback from "@/lib/utils/haptic";
import { getExercise } from "@/lib/workout/exerciseCatalog";
import { convertWeight, LoggedWorkout, WeightUnit } from "@/types";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

interface WorkoutDetailModalProps {
  workout: LoggedWorkout | null;
  weightUnit: WeightUnit;
  prDays: Map<string, Set<string>>;
  onClose: () => void;
  onDelete: (workout: LoggedWorkout) => void;
}

const getExerciseName = (id: string, info?: { name?: string } | null): string =>
  info?.name || id.replace("custom_", "").replace(/-/g, " ").split("_")[0];

export default function WorkoutDetailModal({
  workout,
  weightUnit,
  prDays,
  onClose,
  onDelete,
}: WorkoutDetailModalProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { showAlert } = useAlert();
  const [copied, setCopied] = useState(false);

  const workoutAsText = useMemo(() => {
    if (!workout) return "";
    return workout.exercises
      .filter((e) => e.completedSets && e.completedSets.length > 0)
      .map((e) => {
        const name = getExerciseName(e.id, getExercise(e.id));
        // Parser-compatible tokens (see draftToLogText): decimals kept — rounding
        // here silently corrupted 32.5-lb sets on paste-back — and kg suffixed.
        const parts = e.completedSets!.map((s) => {
          const w = convertWeight(s.weight, s.unit || "lbs", weightUnit);
          return w > 0 ? `${w}${weightUnit === "kg" ? "kg" : ""}x${s.reps}` : `x${s.reps}`;
        });
        return `${name} ${parts.join(", ")}`;
      })
      .join("\n");
  }, [workout, weightUnit]);

  const handleCopy = useCallback(async () => {
    if (!workoutAsText) return;
    await Clipboard.setStringAsync(workoutAsText);
    playHapticFeedback("light", false);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [workoutAsText]);

  const handleDelete = () => {
    if (!workout) return;
    showAlert({
      title: "Delete Session",
      message: `Delete "${workout.title}"? This cannot be undone.`,
      type: "confirm",
      buttons: [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => onDelete(workout) },
      ],
    });
  };

  const formatFullDate = (date: Date): string =>
    new Date(date).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <ScreenModal
      visible={!!workout}
      onClose={onClose}
      presentation="pageSheet"
      rightActions={
        <IconButton
          icon={copied ? "checkmark" : "copy-outline"}
          onPress={handleCopy}
          style={copied ? { backgroundColor: tint(currentTheme.colors.primary) } : undefined}
          iconColor={copied ? currentTheme.colors.primary : undefined}
        />
      }
    >
      {workout && (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.hero}>
            <Text variant="screenTitle" tone="primary" weight="bold" style={styles.title}>
              {workout.title}
            </Text>
            <Text variant="meta" tone="secondary" style={styles.date}>
              {formatFullDate(workout.createdAt)}
              {workout.estimatedDuration > 0 &&
                ` · ${formatMinutes(workout.estimatedDuration)}`}
            </Text>
          </View>

          <SessionAnalysis workout={workout} weightUnit={weightUnit} prDays={prDays} />

          <TouchableOpacity onPress={handleDelete} style={styles.delete} hitSlop={8}>
            <Text variant="meta" weight="semiBold" style={{ color: ink.faint }}>
              Delete session
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </ScreenModal>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  scrollContent: {
    paddingHorizontal: screenGutter,
    paddingTop: space.lg,
    paddingBottom: space.section,
  },
  hero: { marginBottom: space.section },
  title: { lineHeight: lineHeightFor(type.screenTitle), letterSpacing: -0.5 },
  date: { marginTop: space.xs },
  delete: { alignItems: "center", paddingVertical: space.section },
});
