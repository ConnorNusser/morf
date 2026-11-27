import { Text, useInk } from "@/components/Themed";
import { useTheme } from "@/contexts/ThemeContext";
import { space } from "@/lib/ui/tokens";
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
        // Swiss: a "card" row is a ruled row (hairline above and below), not a filled box.
        variant === "card" && [styles.card, { borderColor: ink.hairline }],
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
    paddingVertical: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  labelGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
});
