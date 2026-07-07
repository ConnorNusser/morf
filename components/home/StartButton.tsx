import { Text, useInk } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { radius, space } from "@/lib/ui/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface StartButtonProps {
  label: string;
  onPress: () => void;
  variant?: "solid" | "outlined";
  style?: ViewStyle;
}

// Primary "go" button (shared by routine card + Quick start): button springs to 0.96 and the arrow nudges/flings forward on press.
export default function StartButton({
  label,
  onPress,
  variant = "solid",
  style,
}: StartButtonProps) {
  const { currentTheme } = useTheme();
  const { colors } = currentTheme;
  const ink = useInk();
  const outlined = variant === "outlined";

  const pressScale = useSharedValue(1);
  const arrowShift = useSharedValue(0);
  const buttonAnim = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));
  const arrowAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowShift.value }],
  }));

  const onPressIn = useCallback(() => {
    pressScale.value = withSpring(0.96, { damping: 18, stiffness: 320 });
    arrowShift.value = withSpring(4);
  }, [pressScale, arrowShift]);
  const onPressOut = useCallback(() => {
    pressScale.value = withSpring(1, { damping: 14, stiffness: 260 });
    arrowShift.value = withSpring(0);
  }, [pressScale, arrowShift]);
  const handlePress = useCallback(() => {
    arrowShift.value = withSequence(
      withTiming(14, { duration: 130 }),
      withSpring(0),
    );
    onPress();
  }, [arrowShift, onPress]);

  return (
    <AnimatedPressable
      style={[
        styles.button,
        buttonAnim,
        outlined
          ? {
              backgroundColor: "transparent",
              borderWidth: 1.5,
              borderColor: colors.border,
            }
          : { backgroundColor: colors.text },
        style,
      ]}
      onPress={handlePress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
    >
      <Text
        variant="emphasis"
        weight="semiBold"
        style={{ color: outlined ? colors.text : colors.background }}
      >
        {label}
      </Text>
      <Animated.View
        style={[
          styles.arrow,
          arrowAnim,
          {
            backgroundColor: outlined ? ink.ghost : colors.background,
          },
        ]}
      >
        <Ionicons name="arrow-forward" size={18} color={colors.text} />
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.md,
    paddingLeft: space.section,
    paddingRight: space.md,
    // CTA grammar: primary launch actions are pills, like EmptyState's CTA.
    borderRadius: radius.pill,
  },
  arrow: {
    width: 43,
    height: 43,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
