import { useAlert } from "@/components/CustomAlert";
import IconButton from "@/components/IconButton";
import SessionAnalysis from "@/components/history/SessionAnalysis";
import { Text, useInk } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { screenGutter, space, tint } from "@/lib/ui/tokens";
import { lineHeightFor, type } from "@/lib/ui/typography";
import { formatMinutes } from "@/lib/utils/utils";
import playHapticFeedback from "@/lib/utils/haptic";
import { getExercise } from "@/lib/workout/workouts";
import { convertWeight, GeneratedWorkout, WeightUnit } from "@/types";
import * as Clipboard from "expo-clipboard";
import React, { useCallback, useMemo, useState } from "react";
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

interface WorkoutDetailModalProps {
  workout: GeneratedWorkout | null;
  weightUnit: WeightUnit;
  prDays: Map<string, Set<string>>;
  onClose: () => void;
  onDelete: (workout: GeneratedWorkout) => void;
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
        const parts = e.completedSets!.map(
          (s) =>
            `${Math.round(convertWeight(s.weight, s.unit || "lbs", weightUnit))}x${s.reps}`,
        );
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
    <Modal visible={!!workout} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        <View style={styles.header}>
          <IconButton
            icon={copied ? "checkmark" : "copy-outline"}
            onPress={handleCopy}
            style={copied ? { backgroundColor: tint(currentTheme.colors.primary) } : undefined}
            iconColor={copied ? currentTheme.colors.primary : undefined}
          />
          <Text variant="title" tone="primary" weight="semiBold">
            Session
          </Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

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
              <Text variant="body" tone="secondary" style={styles.date}>
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
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: screenGutter, paddingBottom: space.section },
  hero: { marginBottom: space.lg },
  title: { lineHeight: lineHeightFor(type.screenTitle), letterSpacing: -0.5 },
  date: { marginTop: space.xs },
  delete: { alignItems: "center", paddingVertical: space.section },
});
