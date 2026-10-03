import { Text, useInk } from "@/components/Themed";
import { COMPOSER_OPEN_BAR_HEIGHT } from "@/components/workout/session/ComposerDock";
import { screenGutter, space } from "@/lib/ui/tokens";
import { lineHeightFor, type as typeScale } from "@/lib/ui/typography";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet } from "react-native";

interface EmptyWorkoutOverlayProps {
  keyboardVisible: boolean;
  keyboardHeight: number;
  onPress: () => void;
}

// With no list rendered (EditableWorkout is null when the draft is empty) this
// overlay is the only surface behind the composer, so it doubles as the
// tap-outside-to-dismiss target. While the keyboard is up it re-centers in the
// strip that stays visible above the composer bar instead of hiding behind the
// keyboard.
export default function EmptyWorkoutOverlay({
  keyboardVisible,
  keyboardHeight,
  onPress,
}: EmptyWorkoutOverlayProps) {
  const ink = useInk();

  return (
    <Pressable
      style={[
        styles.empty,
        keyboardVisible && {
          bottom: keyboardHeight + COMPOSER_OPEN_BAR_HEIGHT,
        },
      ]}
      onPress={onPress}
    >
      <Ionicons name="barbell-outline" size={56} color={ink.ghost} />
      <Text
        variant="heading"
        weight="semiBold"
        tone="primary"
        style={styles.emptyTitle}
      >
        Empty workout
      </Text>
      <Text variant="body" tone="muted" style={styles.emptyText}>
        Add your first set below — type or speak it.
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  empty: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: screenGutter * 2,
  },
  emptyTitle: {
    marginTop: space.md,
  },
  emptyText: {
    textAlign: "center",
    lineHeight: lineHeightFor(typeScale.body),
    marginBottom: space.sm,
    paddingHorizontal: space.section,
  },
});
