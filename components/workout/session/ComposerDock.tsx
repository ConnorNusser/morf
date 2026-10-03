import IconButton from "@/components/IconButton";
import { Text, useInk } from "@/components/Themed";
import PredictiveCard from "@/components/workout/PredictiveCard";
import WorkoutNoteInput, {
  WorkoutNoteInputRef,
} from "@/components/workout/WorkoutNoteInput";
import { useTheme } from "@/contexts/ThemeContext";
import { radius, screenGutter, space } from "@/lib/ui/tokens";
import type { WeightUnit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Platform,
  View as RNView,
  StyleSheet,
  TouchableOpacity,
} from "react-native";

// Matches the absolute tab bar height in app/(tabs)/_layout.tsx so the composer
// sits clear of it (the bar overlays content). Collapsed when the keyboard is up.
const TAB_BAR_CLEARANCE = 85;

// Height the floating composer dock occupies at the bottom when collapsed (pill +
// its top padding + the clearance that lifts it above the tab bar). The workout
// list scrolls *behind* the dock, so it pads its content by this much to let the
// last row clear the pill instead of tucking under it.
export const COMPOSER_DOCK_HEIGHT = TAB_BAR_CLEARANCE + space.lg + 48 + space.sm;

// Height of the open composer's input row (34pt single-line pill + vertical
// padding) — lifts the empty state clear of the bar when the keyboard is up.
export const COMPOSER_OPEN_BAR_HEIGHT = space.sm + 34 + space.sm;

interface ComposerDockProps {
  open: boolean;
  text: string;
  onChangeText: (text: string) => void;
  inputRef: React.RefObject<WorkoutNoteInputRef | null>;
  weightUnit: WeightUnit;
  keyboardVisible: boolean;
  keyboardHeight: number;
  isListening: boolean;
  onOpen: () => void;
  onBlur: () => void;
  onSend: () => void;
  onMicPress: () => void;
}

// Floating composer dock — overlays the list bottom so the workout uses the
// full height and scrolls behind it. box-none lets taps fall through the
// transparent area to the list; only the pill/mic/send capture touches.
// iOS: pad by keyboardHeight to lift the bar above the keyboard (dock is
// anchored to bottom:0). Android already lifts it via adjustResize
// (windowSoftInputMode=resize), so padding there would double-offset.
export default function ComposerDock({
  open,
  text,
  onChangeText,
  inputRef,
  weightUnit,
  keyboardVisible,
  keyboardHeight,
  isListening,
  onOpen,
  onBlur,
  onSend,
  onMicPress,
}: ComposerDockProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <RNView
      style={[
        styles.composerDock,
        Platform.OS === "ios" &&
          keyboardVisible && { paddingBottom: keyboardHeight },
      ]}
      pointerEvents="box-none"
    >
      {open ? (
        <>
          {/* Predictive card — previews the paused composer text, tap to commit */}
          <PredictiveCard
            text={text}
            weightUnit={weightUnit}
            onCommit={onSend}
          />

          {/* Composer (open) — auto-growing input + mic + send. No Done button:
            scrolling the workout, tapping outside, or swiping the keyboard down
            collapses it (the typed text stays cached for next time). */}
          <RNView
            style={{
              ...styles.composerBar,
              paddingBottom: keyboardVisible
                ? 0
                : TAB_BAR_CLEARANCE + space.lg,
            }}
          >
            <RNView style={styles.composerRow}>
              {/* Visible input surface (matches the collapsed pill) so the field
                reads as its own box and occludes the list behind it as it grows,
                rather than a screen-colored block that looks like it's covering
                the view. */}
              <RNView
                style={[
                  styles.composerInput,
                  {
                    backgroundColor: currentTheme.colors.surface,
                    borderColor: currentTheme.colors.border,
                  },
                ]}
              >
                <WorkoutNoteInput
                  ref={inputRef}
                  value={text}
                  onChangeText={onChangeText}
                  onBlur={onBlur}
                  autoGrow
                  placeholder="Log a set — Bench 135×8"
                />
              </RNView>
              <IconButton
                icon={isListening ? "stop" : "mic"}
                onPress={onMicPress}
                iconColor={isListening ? "#fff" : currentTheme.colors.text}
                style={{
                  ...styles.circleBtn,
                  // Opaque fill — the composer floats over the list, so a
                  // translucent hairline would let rows show through the button.
                  backgroundColor: isListening
                    ? currentTheme.colors.accent
                    : currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                }}
              />
              <IconButton
                icon="arrow-up"
                onPress={onSend}
                disabled={!text.trim()}
                iconColor={text.trim() ? "#fff" : ink.muted}
                style={{
                  ...styles.circleBtn,
                  backgroundColor: text.trim()
                    ? currentTheme.colors.primary
                    : currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                  // Override IconButton's built-in disabled dim (opacity 0.5):
                  // over the floating list that would make the button see-through.
                  opacity: 1,
                }}
              />
            </RNView>
          </RNView>
        </>
      ) : (
        /* Collapsed — a compose bar that opens the composer, plus a mic */
        <RNView
          style={{
            ...styles.collapsedBar,
            paddingBottom: keyboardVisible
              ? space.sm
              : TAB_BAR_CLEARANCE + space.lg,
          }}
        >
          <TouchableOpacity
            style={[
              styles.collapsedInput,
              {
                backgroundColor: currentTheme.colors.surface,
                borderColor: currentTheme.colors.border,
              },
            ]}
            onPress={onOpen}
            activeOpacity={0.7}
          >
            <Ionicons
              name="create-outline"
              size={18}
              color={ink.secondary}
            />
            <Text variant="body" tone="secondary">
              Log a set — type or speak
            </Text>
          </TouchableOpacity>
          <IconButton
            icon={isListening ? "stop" : "mic"}
            onPress={onMicPress}
            iconColor={isListening ? "#fff" : currentTheme.colors.text}
            style={{
              ...styles.fabCircle,
              backgroundColor: isListening
                ? currentTheme.colors.accent
                : currentTheme.colors.surface,
              borderColor: currentTheme.colors.border,
            }}
          />
        </RNView>
      )}
    </RNView>
  );
}

const styles = StyleSheet.create({
  composerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  composerBar: {
    // No bar background/border — the input pill and the two circle buttons each
    // float over the workout content, lined up by the row's flex-end alignment.
    paddingTop: space.sm,
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: space.sm,
    paddingHorizontal: screenGutter,
    paddingBottom: space.sm,
  },
  collapsedBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    paddingHorizontal: screenGutter,
    paddingTop: space.sm,
  },
  collapsedInput: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  fabCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  composerInput: {
    flex: 1,
    // Hug the input's measured height (WorkoutNoteInput drives it). overflow
    // hidden clips the text to the rounded corners so glyphs can't spill out
    // as it grows or scrolls at max height. The 20pt radius is deliberate
    // geometry: radius.pill would balloon as the field grows tall.
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    // Float a touch above the input's baseline (the row aligns to flex-end).
    marginBottom: space.xs,
  },
});
