import { Text, useInk } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { radius, space } from "@/lib/ui/tokens";
import { Ionicons } from "@expo/vector-icons";
import React, { ComponentProps } from "react";
import { StyleProp, StyleSheet, TouchableOpacity, View, ViewStyle } from "react-native";

interface NavRowProps {
  label: string;
  onPress: () => void;
  icon?: ComponentProps<typeof Ionicons>["name"];
  variant?: "plain" | "card";
  style?: StyleProp<ViewStyle>;
}

function NavRow({ label, onPress, icon, variant = "plain", style }: NavRowProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <TouchableOpacity
      style={[
        styles.row,
        variant === "card" && [
          styles.card,
          {
            backgroundColor: currentTheme.colors.surface,
            borderColor: currentTheme.colors.border,
          },
        ],
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.labelGroup}>
        {icon && (
          <Ionicons name={icon} size={18} color={currentTheme.colors.primary} />
        )}
        <Text variant="body" tone="primary" weight="medium">
          {label}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={ink.muted} />
    </TouchableOpacity>
  );
}

export default React.memo(NavRow);

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: space.md,
  },
  card: {
    paddingHorizontal: space.lg,
    paddingVertical: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
});
