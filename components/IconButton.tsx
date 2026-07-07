import { useTheme } from "@/contexts/ThemeContext";
import { radius } from "@/lib/ui/tokens";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TouchableOpacity, ViewStyle } from "react-native";

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface IconButtonProps {
  icon: IoniconsName;
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  iconColor?: string;
}

/** Icon-only button: 40pt surface square, hitSlop keeps the tap target ≥44pt. */
function IconButton({
  icon,
  onPress,
  disabled = false,
  style,
  iconColor,
}: IconButtonProps) {
  const { currentTheme } = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      hitSlop={8}
      style={[
        styles.button,
        { backgroundColor: currentTheme.colors.surface },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={iconColor ?? currentTheme.colors.text}
      />
    </TouchableOpacity>
  );
}

export default React.memo(IconButton);

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: radius.control,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});
