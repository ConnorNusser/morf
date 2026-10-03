import Button from "@/components/Button";
import { Text, useInk, View } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { radius, screenGutter, space, track } from "@/lib/ui/tokens";
import playHapticFeedback from "@/lib/utils/haptic";
import type { WeightUnit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View as RNView, StyleSheet, TouchableOpacity } from "react-native";

interface WorkoutHeaderProps {
  hasWorkoutStarted: boolean;
  isResting: boolean;
  isPaused: boolean;
  formattedRestTime: string;
  elapsedTime: number;
  formatTime: (seconds: number) => string;
  weightUnit: WeightUnit;
  onSelectUnit: (unit: WeightUnit) => void;
  onDiscard: () => void;
  onTimerTap: () => void;
  onTimerLongPress: () => void;
  onFinish: () => void;
}

// Header — overflow (utilities) · timer/title · Finish
export default function WorkoutHeader({
  hasWorkoutStarted,
  isResting,
  isPaused,
  formattedRestTime,
  elapsedTime,
  formatTime,
  weightUnit,
  onSelectUnit,
  onDiscard,
  onTimerTap,
  onTimerLongPress,
  onFinish,
}: WorkoutHeaderProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <View style={styles.header}>
      <View style={[styles.headerSide, { alignItems: "flex-start" }]}>
        {hasWorkoutStarted && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onDiscard}
            hitSlop={8}
          >
            <Text variant="body" tone="secondary">
              Cancel
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.headerCenter}>
        {hasWorkoutStarted ? (
          <TouchableOpacity
            onPress={onTimerTap}
            onLongPress={onTimerLongPress}
            activeOpacity={0.7}
          >
            <RNView
              style={[
                styles.timerContainer,
                {
                  backgroundColor: isResting
                    ? currentTheme.colors.primary
                    : currentTheme.colors.surface,
                  borderColor: isResting
                    ? currentTheme.colors.primary
                    : currentTheme.colors.border,
                },
              ]}
            >
              <Ionicons
                name={isResting ? "hourglass-outline" : isPaused ? "pause" : "time-outline"}
                size={16}
                color={isResting ? "#fff" : isPaused ? "#F59E0B" : currentTheme.colors.accent}
              />
              <Text
                variant="emphasis"
                tone="primary"
                style={isResting && { color: "#fff" }}
              >
                {isResting ? formattedRestTime : formatTime(elapsedTime)}
              </Text>
              {isResting && (
                <Text
                  variant="meta"
                  style={[
                    styles.restLabel,
                    { color: "rgba(255,255,255,0.8)" },
                  ]}
                >
                  REST
                </Text>
              )}
              {!isResting && isPaused && (
                <Text
                  variant="meta"
                  weight="semiBold"
                  style={[styles.restLabel, { color: "#F59E0B" }]}
                >
                  PAUSED
                </Text>
              )}
              {/* The pill opens a sheet — say so. */}
              <Ionicons
                name="chevron-down"
                size={12}
                color={isResting ? "rgba(255,255,255,0.8)" : ink.faint}
              />
            </RNView>
          </TouchableOpacity>
        ) : (
          <Text variant="title" weight="semiBold" tone="primary">
            Workout
          </Text>
        )}
      </View>

      <View style={[styles.headerSide, { alignItems: "flex-end" }]}>
        {hasWorkoutStarted ? (
          <Button
            title="Finish"
            variant="primary"
            size="small"
            onPress={onFinish}
            style={styles.finishButton}
          />
        ) : (
          <RNView
            style={[styles.unitSegment, { backgroundColor: ink.hairline }]}
          >
            {(["lbs", "kg"] as const).map((u) => (
              <TouchableOpacity
                key={u}
                style={[
                  styles.unitSegmentBtn,
                  weightUnit === u && {
                    backgroundColor: currentTheme.colors.surface,
                  },
                ]}
                onPress={() => {
                  playHapticFeedback("selection", false);
                  onSelectUnit(u);
                }}
              >
                <Text
                  variant="meta"
                  tone={weightUnit === u ? "primary" : "muted"}
                  style={styles.unitSegmentText}
                >
                  {u}
                </Text>
              </TouchableOpacity>
            ))}
          </RNView>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: screenGutter,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  headerSide: {
    width: 88,
    justifyContent: "center",
  },
  cancelButton: {
    height: 40,
    justifyContent: "center",
    paddingHorizontal: space.xs,
  },
  // The lbs/kg thumb segment keeps its compact geometry (named exception) —
  // only its colors are tokenized.
  unitSegment: {
    flexDirection: "row",
    borderRadius: radius.pill,
    padding: 2,
  },
  unitSegmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  unitSegmentText: {
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  timerContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: space.xs,
  },
  restLabel: {
    letterSpacing: track.caps,
    marginLeft: space.xs,
  },
  finishButton: {
    // Keep the 40pt header row height stable (Button small is minHeight 36).
    height: 40,
  },
});
